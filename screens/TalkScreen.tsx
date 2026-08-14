import { observer } from 'mobx-react';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';
import { useStores } from '../components/StoreProvider';
import { ttsService } from '../services/ttsService';
import { whisperService } from '../services/whisperService';
import { ConversationPromptBuilder, cleanTranscript } from '../utils/chat';

const { width, height } = Dimensions.get('window');

const cleanLLMResponse = (response: string): string => {
  return response
    .replace(/^(Solution \d+:|Answer:|Response:)\s*/i, '')
    .replace(/<\|assistant\|>/g, '')
    .replace(/<\|user\|>/g, '')
    .replace(/<\|system\|>/g, '')
    .replace(/<\|endoftext\|>/g, '')
    .replace(/^---+$/gm, '')
    .replace(/^(Instruction|Inst)\s*$/gm, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
};

type TalkState = 'idle' | 'listening' | 'processing' | 'speaking';

// Animated waveform bar component
const WaveBar: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 400 + delay, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.2, duration: 400 + delay, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.waveBar,
        { backgroundColor: color, transform: [{ scaleY: anim }] },
      ]}
    />
  );
};

// Pulsing ring component
const PulseRing: React.FC<{ size: number; color: string; delay: number }> = ({ size, color, delay }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.6, duration: 1200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
};

const TalkScreen: React.FC = observer(() => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { chatSessionStore, modelStore } = useStores();
  const insets = useSafeAreaInsets();
  let tabBarHeight = 0;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch (e) {
    tabBarHeight = 0;
  }

  const [state, setState] = useState<TalkState>('idle');
  const [isWhisperLoading, setIsWhisperLoading] = useState(!whisperService.isModelLoaded());
  const [whisperError, setWhisperError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [autoResume, setAutoResume] = useState(false); // Fix 1: state not ref

  const ttsRef = useRef('');
  const ttsQueue = useRef<string[]>([]);
  const ttsSpeakingRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const shouldAutoResumeRef = useRef(false); // stays in sync with autoResume state
  const transcriptRef = useRef('');
  const isProcessingRef = useRef(false);
  const generationActiveRef = useRef(false);
  const stopCalledRef = useRef(false); // Fix 3: prevent double handleSTTResult

  const isNoiseOrHallucination = (text: string): boolean => {
    const cleanedText = cleanTranscript(text);
    if (!cleanedText) return true;
    const normalized = cleanedText
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '')
      .trim();
    if (!normalized) return true;
    const noisePhrases = new Set([
      'subtitles by', 'thanks for watching', 'please subscribe', 'viewers like you',
      'english subtitles', 'english sub', 'amara.org', 'bye for now',
      'inaudible', 'blank audio', 'music', 'applause', 'laughter',
    ]);
    if (noisePhrases.has(normalized)) return true;
    return false;
  };

  useEffect(() => {
    let mounted = true;
    if (!chatSessionStore.activeSession) {
      chatSessionStore.createConversationSession('Voice Assistant');
    }
    if (!whisperService.isModelLoaded()) {
      setIsWhisperLoading(true);
      whisperService.initialize()
        .then(() => { if (mounted) setIsWhisperLoading(false); })
        .catch((err) => {
          if (mounted) {
            setWhisperError(err?.message || 'Failed to initialize Whisper');
            setIsWhisperLoading(false);
          }
        });
    }
    return () => {
      mounted = false;
      whisperService.stopRealtimeTranscription().catch(console.error);
      ttsService.stop().catch(console.error);
    };
  }, []);

  // Mic pulse animation
  useEffect(() => {
    if (state === 'listening') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  const speakNextSentence = async () => {
    if (ttsQueue.current.length > 0 && !ttsSpeakingRef.current) {
      const nextSentence = ttsQueue.current.shift();
      if (nextSentence) {
        ttsSpeakingRef.current = true;
        setState('speaking');
        try {
          await ttsService.speak(nextSentence);
        } catch (err) {
          console.error('TTS speak error:', err);
        } finally {
          ttsSpeakingRef.current = false;
          if (ttsQueue.current.length > 0) {
            speakNextSentence();
          } else {
            setState('idle');
            // Fix 4: 800ms gives Android audio session time to release before Whisper starts
            setTimeout(() => {
              if (shouldAutoResumeRef.current) startListening();
            }, 800);
          }
        }
      }
    } else if (ttsQueue.current.length === 0 && !ttsSpeakingRef.current) {
      setState('idle');
      setTimeout(() => {
        if (shouldAutoResumeRef.current) startListening();
      }, 800);
    }
  };

  const handleSTTResult = async (text: string) => {
    if (isProcessingRef.current) return;
    const cleaned = cleanTranscript(text);
    if (!cleaned || isNoiseOrHallucination(cleaned)) {
      setState('idle');
      isProcessingRef.current = false;
      return;
    }
    isProcessingRef.current = true;
    generationActiveRef.current = true;
    setTranscript(cleaned);
    setState('processing');

    if (!chatSessionStore.activeSession) {
      chatSessionStore.createConversationSession('Voice Assistant');
    }

    chatSessionStore.addMessage({ text: cleaned, author: 'user', type: 'conversation' });
    try {
      const promptBuilder = new ConversationPromptBuilder(
        chatSessionStore.settings.systemPrompt
      );
      const messages = promptBuilder.buildMessages(cleaned, chatSessionStore.currentMessages);
      let assistantMessage = chatSessionStore.addMessage({ text: '', author: 'assistant', type: 'conversation' });
      if (!assistantMessage) {
        chatSessionStore.createConversationSession('Voice Assistant');
        assistantMessage = chatSessionStore.addMessage({ text: '', author: 'assistant', type: 'conversation' });
      }
      if (!assistantMessage) throw new Error('Failed to create assistant message in store');

      setAssistantText('');
      ttsRef.current = '';
      ttsQueue.current = [];
      let accumulatedResponse = '';
      await modelStore.generateCompletion(
        messages,
        // Voice replies should be short — 180 tokens keeps time-to-first-spoken-word
        // low. The model's real end-of-turn token (via the chat template) still
        // stops generation earlier whenever the answer naturally finishes sooner.
        { temperature: 0.7, max_tokens: 180, stop: ['\nUser:', '\nAssistant:'] },
        (token: string) => {
          if (!generationActiveRef.current) return;
          accumulatedResponse += token;
          const cleanedResponse = cleanLLMResponse(accumulatedResponse);
          setAssistantText(cleanedResponse);
          if (assistantMessage) {
            chatSessionStore.updateMessage(assistantMessage.id, cleanedResponse);
          }
          ttsRef.current += token;
          const sentenceRegex = /([^.?!]+[.?!]+["')\]]*\s*)/g;
          let match;
          let lastIndex = 0;
          while ((match = sentenceRegex.exec(ttsRef.current)) !== null) {
            const sentence = match[0].trim();
            if (sentence && !/^[\s.,!?;:]+$/.test(sentence)) {
              ttsQueue.current.push(sentence);
              lastIndex = sentenceRegex.lastIndex;
            }
          }
          if (lastIndex > 0) {
            ttsRef.current = ttsRef.current.slice(lastIndex);
            speakNextSentence();
          }
        }
      );

      // Flush any remaining text in ttsRef after generation finishes
      if (ttsRef.current.trim()) {
        const remaining = ttsRef.current.trim();
        if (remaining && !/^[\s.,!?;:]+$/.test(remaining)) {
          ttsQueue.current.push(remaining);
        }
        ttsRef.current = '';
      }

      if (ttsQueue.current.length > 0 && !ttsSpeakingRef.current) {
        speakNextSentence();
      } else if (ttsQueue.current.length === 0 && !ttsSpeakingRef.current) {
        setState('idle');
        setTimeout(() => {
          if (shouldAutoResumeRef.current) startListening();
        }, 800);
      }
    } catch (error) {
      console.error('Generation error:', error);
      setState('idle');
    } finally {
      isProcessingRef.current = false;
    }
  };

  const startListening = async () => {
    if (state !== 'idle') return;
    if (!modelStore.context) return;
    try {
      isProcessingRef.current = false;
      generationActiveRef.current = false;
      stopCalledRef.current = false;
      transcriptRef.current = '';

      // 1. Stop TTS so it releases the Android audio session
      await ttsService.stop();

      // 2. Clean up any leftover Whisper session (prevents State: -100)
      try {
        await whisperService.stopRealtimeTranscription();
      } catch (e) {
        // If stopRealtimeTranscription fails, force-reset Whisper's internal state
        (whisperService as any).resetRealtimeState?.();
      }

      // 3. Give Android time to fully release the audio session
      await new Promise(res => setTimeout(res, 500));

      setState('listening');
      setTranscript('');
      setAssistantText('');
      await whisperService.startRealtimeTranscription({
        onTranscriptionUpdate: (result) => {
          const cleaned = cleanTranscript(result.text);
          setTranscript(cleaned);
          transcriptRef.current = cleaned;
        },
        onComplete: (result) => {
          // Skip if stopListening already processed this result
          if (stopCalledRef.current) return;
          const cleaned = cleanTranscript(result.text);
          if (cleaned) handleSTTResult(cleaned);
          else setState('idle');
        },
        onError: (err) => {
          console.error('Whisper error:', err);
          setState('idle');
        },
      });
    } catch (err) {
      console.error('Failed to start listening:', err);
      setState('idle');
    }
  };


  const stopListening = async () => {
    if (state !== 'listening') return;
    stopCalledRef.current = true; // Fix 3: mark that we handled it, block onComplete
    try {
      await whisperService.stopRealtimeTranscription();
      const finalTranscript = transcriptRef.current;
      const cleaned = cleanTranscript(finalTranscript);
      if (cleaned && !isNoiseOrHallucination(cleaned)) handleSTTResult(cleaned);
      else setState('idle');
    } catch (err) {
      console.error('Failed to stop listening:', err);
      setState('idle');
    }
  };

  const stopAll = async () => {
    shouldAutoResumeRef.current = false;
    setAutoResume(false); // keep state in sync when manually stopping everything
    isProcessingRef.current = false;
    generationActiveRef.current = false;
    ttsQueue.current = [];
    ttsSpeakingRef.current = false;
    try { await ttsService.stop(); } catch (err) { console.error('Failed to stop TTS:', err); }
    setState('idle');
  };

  const toggleAutoResume = () => {
    const next = !autoResume;
    setAutoResume(next);         // Fix 1: triggers re-render
    shouldAutoResumeRef.current = next; // keep ref in sync for async callbacks
  };

  const toggleMic = () => {
    if (state === 'listening') stopListening();
    else if (state === 'speaking' || state === 'processing') stopAll();
    else if (state === 'idle') startListening();
  };

  // ── State config ─────────────────────────────────────────────────────────────
  const stateConfig = {
    idle:       { label: 'Tap to Talk',     icon: 'mic' as const,          color: colors.primary,              desc: 'Ready for your voice' },
    listening:  { label: 'Listening...',    icon: 'stop-circle' as const,  color: colors.error ?? '#ef4444',   desc: 'Tap to send' },
    processing: { label: 'Thinking...',     icon: 'stop-circle' as const,  color: '#f59e0b',                   desc: 'AI is composing a reply' },
    speaking:   { label: 'Speaking...',     icon: 'stop-circle' as const,  color: '#10b981',                   desc: 'Tap to interrupt' },
  };
  const cfg = stateConfig[state];

  // ── Loading / Error screens ───────────────────────────────────────────────────
  if (isWhisperLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <View style={styles.centerContent}>
          <View style={[styles.loadingIconBox, { backgroundColor: `${colors.primary}15` }]}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
          <Text style={[styles.loadingTitle, { color: colors.text }]}>Initializing Voice AI</Text>
          <Text style={[styles.loadingSubtitle, { color: colors.muted }]}>Loading Whisper model…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (whisperError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <View style={styles.centerContent}>
          <View style={[styles.loadingIconBox, { backgroundColor: '#ef444415' }]}>
            <Ionicons name="alert-circle" size={36} color="#ef4444" />
          </View>
          <Text style={[styles.loadingTitle, { color: colors.text }]}>Voice Setup Failed</Text>
          <Text style={[styles.loadingSubtitle, { color: '#ef4444' }]}>{whisperError}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => whisperService.initialize()}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const noModel = !modelStore.context;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="mic" size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Voice Assistant</Text>
            <Text style={[styles.headerSub, { color: colors.muted }]}>Hands-free conversation</Text>
          </View>
        </View>
        {/* Auto-resume toggle pill */}
        <TouchableOpacity
          style={[
            styles.resumePill,
            {
              backgroundColor: autoResume ? `${colors.primary}18` : 'transparent',
              borderColor: autoResume ? `${colors.primary}50` : colors.border,
            }
          ]}
          onPress={toggleAutoResume}
          activeOpacity={0.75}
        >
          <Ionicons
            name={autoResume ? 'infinite' : 'infinite-outline'}
            size={14}
            color={autoResume ? colors.primary : colors.muted}
          />
          <Text style={[styles.resumeText, { color: autoResume ? colors.primary : colors.muted }]}>
            Auto
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* No model warning */}
        {noModel && (
          <View style={[styles.warningCard, { backgroundColor: '#f59e0b18', borderColor: '#f59e0b40' }]}>
            <Ionicons name="warning-outline" size={18} color="#f59e0b" />
            <Text style={[styles.warningText, { color: '#f59e0b' }]}>
              No model loaded. Go to the Models tab and load a model first.
            </Text>
          </View>
        )}

        {/* Transcript card */}
        {transcript ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardBadge, { backgroundColor: `${colors.primary}18` }]}>
                <Ionicons name="person" size={11} color={colors.primary} />
                <Text style={[styles.cardBadgeText, { color: colors.primary }]}>YOU SAID</Text>
              </View>
            </View>
            <Text style={[styles.transcriptText, { color: colors.text }]}>{transcript}</Text>
          </View>
        ) : null}

        {/* AI response card */}
        {assistantText ? (
          <View style={[styles.card, styles.aiCard, { backgroundColor: colors.surface, borderColor: `${colors.primary}30` }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardBadge, { backgroundColor: `${colors.primary}18` }]}>
                <Ionicons name="sparkles" size={11} color={colors.primary} />
                <Text style={[styles.cardBadgeText, { color: colors.primary }]}>AI RESPONSE</Text>
              </View>
              {/* Waveform bars shown during speaking */}
              {state === 'speaking' && (
                <View style={styles.waveform}>
                  {[0, 80, 160, 240, 320].map((d, i) => (
                    <WaveBar key={i} delay={d} color={colors.primary} />
                  ))}
                </View>
              )}
            </View>
            <Text style={[styles.assistantText, { color: colors.text }]}>{assistantText}</Text>
          </View>
        ) : null}

        {/* Idle placeholder */}
        {!transcript && !assistantText && state === 'idle' && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBox, { backgroundColor: `${colors.primary}12` }]}>
              <Ionicons name="mic-circle-outline" size={52} color={`${colors.primary}80`} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Ready to Listen</Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
              {noModel ? 'Load a model to start talking' : 'Tap the mic button below to begin'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Controls area */}
      <View style={styles.controls}>
        {/* State label pill */}
        <View style={[styles.statePill, { backgroundColor: `${cfg.color}15`, borderColor: `${cfg.color}40` }]}>
          <View style={[styles.stateDot, { backgroundColor: cfg.color }]} />
          <Text style={[styles.stateLabel, { color: cfg.color }]}>{cfg.label}</Text>
        </View>

        {/* Mic button with pulse rings */}
        <View style={styles.micContainer}>
          {/* Pulse rings only during listening */}
          {state === 'listening' && (
            <>
              <PulseRing size={108} color={cfg.color} delay={0} />
              <PulseRing size={108} color={cfg.color} delay={400} />
              <PulseRing size={108} color={cfg.color} delay={800} />
            </>
          )}
          <TouchableOpacity
            onPress={toggleMic}
            disabled={state === 'processing' || noModel}
            activeOpacity={0.85}
          >
            <Animated.View style={[
              styles.micButton,
              {
                backgroundColor: noModel ? colors.disabled ?? '#ccc' : cfg.color,
                transform: [{ scale: state === 'listening' ? pulseAnim : 1 }],
                opacity: (state === 'processing' || noModel) ? 0.55 : 1,
                shadowColor: cfg.color,
              }
            ]}>
              {state === 'processing' ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <Ionicons name={cfg.icon} size={38} color="#fff" />
              )}
            </Animated.View>
          </TouchableOpacity>
        </View>

        <Text style={[styles.stateDesc, { color: colors.muted }]}>{cfg.desc}</Text>
      </View>
    </SafeAreaView>
  );
});

const MIC_SIZE = 88;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  loadingIconBox: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  loadingTitle: { fontSize: 20, fontFamily: 'Sora-Bold', textAlign: 'center' },
  loadingSubtitle: { fontSize: 14, fontFamily: 'Sora-Medium', textAlign: 'center', opacity: 0.7 },
  retryButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryText: { color: '#fff', fontFamily: 'Sora-Bold', fontSize: 15 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontFamily: 'Sora-Bold', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, fontFamily: 'Sora-Medium', opacity: 0.65, marginTop: 1 },
  resumePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  resumeText: { fontSize: 11, fontFamily: 'Sora-Bold' },

  // Content
  content: { flex: 1 },
  contentInner: { padding: 16, gap: 14, flexGrow: 1 },

  // Warning
  warningCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14 },
  warningText: { flex: 1, fontSize: 13, fontFamily: 'Sora-Medium', lineHeight: 18 },

  // Cards
  card: { borderRadius: 20, borderWidth: 1, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  aiCard: { borderLeftWidth: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cardBadgeText: { fontSize: 10, fontFamily: 'Sora-Bold', letterSpacing: 1 },
  transcriptText: { fontSize: 18, fontFamily: 'Sora-Medium', lineHeight: 26 },
  assistantText: { fontSize: 17, fontFamily: 'Sora-Medium', lineHeight: 26 },

  // Waveform
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 22 },
  waveBar: { width: 3, height: 18, borderRadius: 2 },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, minHeight: 200 },
  emptyIconBox: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontFamily: 'Sora-Bold', letterSpacing: -0.3 },
  emptySubtitle: { fontSize: 14, fontFamily: 'Sora-Medium', textAlign: 'center', opacity: 0.65, maxWidth: 240 },

  // Controls
  controls: { alignItems: 'center', gap: 12, paddingBottom: 36, paddingTop: 8 },
  statePill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  stateDot: { width: 7, height: 7, borderRadius: 4 },
  stateLabel: { fontSize: 12, fontFamily: 'Sora-Bold', letterSpacing: 0.5 },
  stateDesc: { fontSize: 12, fontFamily: 'Sora-Medium', opacity: 0.6 },
  micContainer: { width: MIC_SIZE + 60, height: MIC_SIZE + 60, justifyContent: 'center', alignItems: 'center' },
  micButton: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
});

export default TalkScreen;
