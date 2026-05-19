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
import { ConversationPromptBuilder } from '../utils/chat';

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

  const speakNextSentence = useCallback(async () => {
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
            // Auto-resume listening after a short delay to avoid catching own echo
            setTimeout(() => {
                if (state !== 'listening') startListening();
            }, 500);
          }
        }
      }
    } else if (ttsQueue.current.length === 0 && !ttsSpeakingRef.current) {
        setState('idle');
    }
  }, [state]);

  const handleSTTResult = async (text: string) => {
    const cleaned = text.trim().replace(/\[BLANK_AUDIO\]/g, '').trim();
    if (!cleaned) {
        setState('idle');
        return;
    }
    
    setTranscript(cleaned);
    setState('processing');
    
    // Add user message to store
    chatSessionStore.addMessage({
      text: cleaned,
      author: 'user',
      type: 'conversation',
    });

    try {
      const conversationContext = {
        topic: chatSessionStore.activeSession?.topic || 'general conversation',
      };
      
      const promptBuilder = new ConversationPromptBuilder(conversationContext);
      const prompt = promptBuilder.buildPrompt(cleaned, chatSessionStore.currentMessages);
      
      const assistantMessage = chatSessionStore.addMessage({
        text: '',
        author: 'assistant',
        type: 'conversation',
      });

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
    }
  };

  const startListening = async () => {
    if (state !== 'idle') return;
    
    try {
      await ttsService.stop();
      setState('listening');
      setTranscript('');
      setAssistantText('');
      
      await whisperService.startRealtimeTranscription({
        onTranscriptionUpdate: (result) => {
          setTranscript(result.text);
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
    try {
      await whisperService.stopRealtimeTranscription();
      // State will be updated in onComplete or handleSTTResult
    } catch (err) {
      console.error('Failed to stop listening:', err);
      setState('idle');
    }
  };

  const toggleMic = () => {
    if (state === 'listening') {
      stopListening();
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
            disabled={state === 'processing' || state === 'speaking'}
            activeOpacity={0.7}
          >
            <Animated.View style={[
              styles.micButton, 
              { 
                backgroundColor: state === 'listening' ? colors.error : colors.primary,
                transform: [{ scale: pulseAnim }],
                opacity: (state === 'processing' || state === 'speaking') ? 0.5 : 1
              }
            ]}>
              <Ionicons 
                name={state === 'listening' ? 'stop' : 'mic'} 
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
