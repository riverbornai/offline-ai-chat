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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';
import { useStores } from '../components/StoreProvider';
import { ttsService } from '../services/ttsService';
import { whisperService } from '../services/whisperService';
import { ConversationPromptBuilder, ConversationContext } from '../utils/chat';

const { width } = Dimensions.get('window');

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

const TalkScreen: React.FC = observer(() => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { chatSessionStore, modelStore } = useStores();

  const [state, setState] = useState<TalkState>('idle');
  const [isWhisperLoading, setIsWhisperLoading] = useState(!whisperService.isModelLoaded());
  const [whisperError, setWhisperError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [assistantText, setAssistantText] = useState('');
  
  const ttsRef = useRef('');
  const ttsQueue = useRef<string[]>([]);
  const ttsSpeakingRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Refs for robust voice control & race condition prevention
  const shouldAutoResumeRef = useRef(false);
  const transcriptRef = useRef('');
  const isProcessingRef = useRef(false);
  const generationActiveRef = useRef(false);

  // Common Whisper hallucinations during silence or background noise
  const isNoiseOrHallucination = (text: string): boolean => {
    const cleanedText = text
      .trim()
      .replace(/\[BLANK_AUDIO\]/gi, '')
      .replace(/\(BLANK_AUDIO\)/gi, '')
      .trim();

    if (!cleanedText) return true;

    const normalized = cleanedText
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '') // remove punctuation
      .trim();

    if (!normalized) return true;

    // Standard high-probability Whisper static/silence hallucinations
    const noisePhrases = new Set([
      'you', 'thank you', 'thanks', 'um', 'uh', 'ah', 'oh', 'er', 'hm', 'hmm', 
      'mhm', 'huh', 'so', 'and', 'yeah', 'yes', 'no', 'ok', 'okay', 'bye', 
      'bye bye', 'bye-bye', 'go', 'to', 'the', 'it', 'of', 'in', 'that', 'for',
      'he', 'she', 'they', 'we', 'i', 'me', 'my', 'your', 'ours', 'us',
      'subtitles by', 'thanks for watching', 'please subscribe', 'viewers like you',
      'english subtitles', 'english sub'
    ]);

    if (noisePhrases.has(normalized)) {
      return true;
    }

    // Repeated word hallucinations like "you you you" or "thank you thank you"
    const words = normalized.split(/\s+/);
    if (words.length > 1 && new Set(words).size === 1) {
      const uniqueWord = words[0];
      if (noisePhrases.has(uniqueWord) || uniqueWord.length <= 4) {
        return true;
      }
    }

    return false;
  };

  // Initialize Whisper lazily
  useEffect(() => {
    let mounted = true;
    if (!whisperService.isModelLoaded()) {
      setIsWhisperLoading(true);
      whisperService.initialize()
        .then(() => {
          if (mounted) setIsWhisperLoading(false);
        })
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

  // Animation for pulse effect during listening
  useEffect(() => {
    if (state === 'listening') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
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
            // Auto-resume listening after a short delay if enabled and not manually stopped
            setTimeout(() => {
              if (shouldAutoResumeRef.current) {
                startListening();
              }
            }, 500);
          }
        }
      }
    } else if (ttsQueue.current.length === 0 && !ttsSpeakingRef.current) {
      setState('idle');
      // Auto-resume listening after a short delay if enabled and not manually stopped
      setTimeout(() => {
        if (shouldAutoResumeRef.current) {
          startListening();
        }
      }, 500);
    }
  };

  const handleSTTResult = async (text: string) => {
    if (isProcessingRef.current) return;

    const cleaned = text.trim().replace(/\[BLANK_AUDIO\]/g, '').trim();
    if (!cleaned || isNoiseOrHallucination(cleaned)) {
        setState('idle');
        isProcessingRef.current = false;
        return;
    }
    
    isProcessingRef.current = true;
    generationActiveRef.current = true;
    setTranscript(cleaned);
    setState('processing');
    
    // Add user message to store
    chatSessionStore.addMessage({
      text: cleaned,
      author: 'user',
      type: 'conversation',
    });

    try {
      const conversationContext: ConversationContext = {
        targetLanguage: chatSessionStore.activeSession?.targetLanguage || chatSessionStore.settings.targetLanguage || 'English',
        nativeLanguage: chatSessionStore.activeSession?.nativeLanguage || chatSessionStore.settings.nativeLanguage || 'English',
        learningLevel: chatSessionStore.settings.learningLevel || 'beginner',
        topic: chatSessionStore.activeSession?.title || 'general conversation',
      };
      
      const promptBuilder = new ConversationPromptBuilder(conversationContext);
      const prompt = promptBuilder.buildPrompt(cleaned, chatSessionStore.currentMessages);
      
      const assistantMessage = chatSessionStore.addMessage({
        text: '',
        author: 'assistant',
        type: 'conversation',
      });

      if (!assistantMessage) {
        throw new Error('Failed to create assistant message in store');
      }

      setAssistantText('');
      ttsRef.current = '';
      ttsQueue.current = [];
      
      let accumulatedResponse = '';

      await modelStore.generateCompletion(
        prompt,
        {
          temperature: 0.7,
          max_tokens: 512,
          stop: ['\nUser:', '\nAssistant:'],
        },
        (token: string) => {
          // Discard tokens if the generation has been cancelled
          if (!generationActiveRef.current) return;

          accumulatedResponse += token;
          const cleanedResponse = cleanLLMResponse(accumulatedResponse);
          setAssistantText(cleanedResponse);
          chatSessionStore.updateMessage(assistantMessage.id, cleanedResponse);

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
    } catch (error) {
      console.error('Generation error:', error);
      setState('idle');
    } finally {
      isProcessingRef.current = false;
    }
  };

  const startListening = async () => {
    // Only allow starting if not already active or processing
    if (state !== 'idle') return;
    
    try {
      shouldAutoResumeRef.current = true;
      isProcessingRef.current = false;
      generationActiveRef.current = false;
      transcriptRef.current = '';
      
      await ttsService.stop();
      setState('listening');
      setTranscript('');
      setAssistantText('');
      
      await whisperService.startRealtimeTranscription({
        onTranscriptionUpdate: (result) => {
          setTranscript(result.text);
          transcriptRef.current = result.text;
        },
        onComplete: (result) => {
          if (result.text.trim()) {
            handleSTTResult(result.text);
          } else {
            setState('idle');
          }
        },
        onError: (err) => {
          console.error('Whisper error:', err);
          setState('idle');
        }
      });
    } catch (err) {
      console.error('Failed to start listening:', err);
      setState('idle');
    }
  };

  const stopListening = async () => {
    if (state !== 'listening') return;
    shouldAutoResumeRef.current = false;
    try {
      await whisperService.stopRealtimeTranscription();
      
      // Immediately process the current transcription instead of waiting for delayed complete callback
      const finalTranscript = transcriptRef.current;
      const cleaned = finalTranscript.trim().replace(/\[BLANK_AUDIO\]/g, '').trim();
      
      if (cleaned && !isNoiseOrHallucination(cleaned)) {
        handleSTTResult(cleaned);
      } else {
        setState('idle');
      }
    } catch (err) {
      console.error('Failed to stop listening:', err);
      setState('idle');
    }
  };

  const stopSpeakingAndProcessing = async () => {
    shouldAutoResumeRef.current = false;
    isProcessingRef.current = false;
    generationActiveRef.current = false;
    ttsQueue.current = [];
    ttsSpeakingRef.current = false;
    try {
      await ttsService.stop();
    } catch (err) {
      console.error('Failed to stop TTS:', err);
    }
    setState('idle');
  };

  const toggleMic = () => {
    if (state === 'listening') {
      stopListening();
    } else if (state === 'speaking' || state === 'processing') {
      stopSpeakingAndProcessing();
    } else if (state === 'idle') {
      startListening();
    }
  };

  if (isWhisperLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.statusText, { color: colors.text, marginTop: 12 }]}>Initializing Voice AI...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (whisperError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle" size={64} color={colors.error} />
          <Text style={[styles.statusText, { color: colors.error, marginTop: 12 }]}>{whisperError}</Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => whisperService.initialize()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Voice Assistant</Text>
        <Text style={[styles.headerSubtitle, { color: colors.muted }]}>Hands-free conversation</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.textContainer}>
          {transcript ? (
            <View style={styles.transcriptBox}>
              <Text style={[styles.transcriptLabel, { color: colors.primary }]}>YOU SAID</Text>
              <Text style={[styles.transcriptText, { color: colors.text }]}>{transcript}</Text>
            </View>
          ) : null}

          {assistantText ? (
            <View style={styles.assistantBox}>
              <Text style={[styles.assistantLabel, { color: colors.primary }]}>AI RESPONSE</Text>
              <Text style={[styles.assistantText, { color: colors.text }]}>{assistantText}</Text>
            </View>
          ) : null}
          
          {!transcript && !assistantText && state === 'idle' && (
            <View style={styles.welcomeBox}>
                <Ionicons name="mic-circle" size={80} color={`${colors.primary}40`} />
                <Text style={[styles.welcomeText, { color: colors.muted }]}>Tap the mic and start talking</Text>
            </View>
          )}
        </View>

        <View style={styles.controls}>
          <View style={styles.statusIndicator}>
            <Text style={[styles.stateText, { color: colors.primary }]}>
                {state.toUpperCase()}
            </Text>
          </View>
          
          <TouchableOpacity 
            onPress={toggleMic}
            disabled={state === 'processing'}
            activeOpacity={0.7}
          >
            <Animated.View style={[
              styles.micButton, 
              { 
                backgroundColor: state === 'listening' ? colors.error : (state === 'speaking' ? colors.warning : colors.primary),
                transform: [{ scale: pulseAnim }],
                opacity: state === 'processing' ? 0.5 : 1
              }
            ]}>
              <Ionicons 
                name={state === 'listening' || state === 'speaking' ? 'stop' : 'mic'} 
                size={40} 
                color="white" 
              />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  textContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  transcriptBox: {
    marginBottom: 32,
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  transcriptText: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  assistantBox: {
    marginTop: 16,
  },
  assistantLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  assistantText: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 32,
  },
  welcomeBox: {
      alignItems: 'center',
      opacity: 0.6,
  },
  welcomeText: {
      fontSize: 18,
      fontWeight: '600',
      marginTop: 16,
      textAlign: 'center',
  },
  controls: {
    alignItems: 'center',
    gap: 20,
  },
  statusIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  stateText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  micButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default TalkScreen;
