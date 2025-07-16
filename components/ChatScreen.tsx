import { observer } from 'mobx-react';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';
import { useStores } from './StoreProvider';

import Tts from 'react-native-tts';
import { whisperService } from '../services/whisperService';
import ChatHeader from './ChatHeader';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';

// Clean up LLM response by removing unwanted formatting and metadata
const cleanLLMResponse = (response: string): string => {
  return response
    // Remove solution prefixes like "Solution 1:", "Answer:", etc.
    .replace(/^(Solution \d+:|Answer:|Response:)\s*/i, '')
    // Remove assistant tags
    .replace(/<\|assistant\|>/g, '')
    .replace(/<\|user\|>/g, '')
    .replace(/<\|system\|>/g, '')
    .replace(/<\|endoftext\|>/g, '') // Remove endoftext tokens
    // Remove markdown-style separators
    .replace(/^---+$/gm, '')
    // Remove "Instruction" or similar metadata
    .replace(/^(Instruction|Inst)\s*$/gm, '')
    // Remove extra whitespace and newlines
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
};

interface ChatScreenProps {
  sessionId?: string;
  topic?: string;
}

const ChatScreen: React.FC<ChatScreenProps> = observer(({ sessionId, topic }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { chatSessionStore, modelStore } = useStores();
  
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [ttsBuffer, setTtsBuffer] = useState('');
  const ttsRef = useRef('');
  let ttsSpeaking = false;
  const [isWhisperLoading, setIsWhisperLoading] = useState(!whisperService.isModelLoaded());
  const [whisperError, setWhisperError] = useState<string | null>(null);

  // Only conversation session
  useEffect(() => {
    if (sessionId) {
      chatSessionStore.setActiveSession(sessionId);
    } else if (!chatSessionStore.activeSession) {
      chatSessionStore.createConversationSession(topic);
    }
  }, [sessionId, topic]);

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
    return () => { mounted = false; };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [chatSessionStore.currentMessages.length, chatSessionStore.currentMessages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    if (!modelStore.context) {
      const hasDownloadedModel = modelStore.availableModels.length > 0;
      const errorMessage = hasDownloadedModel 
        ? '❌ Model is downloaded but not loaded. Go to the Models tab and tap "Load Model" to start chatting.'
        : '❌ No model available. Please download and load a language model first. Go to the Models tab to set up a model.';
      chatSessionStore.addMessage({
        text: errorMessage,
        author: 'assistant',
        type: 'conversation',
      });
      return;
    }
    chatSessionStore.addMessage({
      text: text.trim(),
      author: 'user',
      type: 'conversation',
    });
    setIsLoading(true);
    chatSessionStore.setIsGenerating(true);
    let accumulatedResponse = '';
    let tokensReceived = 0;
    let isGenerationComplete = false;
    try {
      // Simple prompt for conversation
      const simplePrompt = `User: ${text}\nAssistant:`;
      const assistantMessage = chatSessionStore.addMessage({
        text: '',
        author: 'assistant',
        type: 'conversation',
      });
      Tts.stop();
      setTtsBuffer('');
      ttsRef.current = '';
      const completionPromise = modelStore.generateCompletion(
        simplePrompt,
        {
          temperature: 0.7,
          max_tokens: 100,
        },
        (token: string) => {
          if (isGenerationComplete) return;
          tokensReceived++;
          if (assistantMessage) {
            accumulatedResponse += token;
            const cleanedResponse = cleanLLMResponse(accumulatedResponse);
            chatSessionStore.updateMessage(assistantMessage.id, cleanedResponse);

            // TTS streaming logic
            ttsRef.current += token;
            // Only speak when you have a full sentence or a long enough chunk
            if (/[.!?]\s$/.test(ttsRef.current) || ttsRef.current.length > 30) {
              const toSpeak = ttsRef.current.trim();
              // Only speak if not just punctuation or whitespace
              if (toSpeak && !/^[\s.,!?;:]+$/.test(toSpeak) && !ttsSpeaking) {
                ttsSpeaking = true;
                Tts.speak(toSpeak);
                ttsRef.current = '';
                Tts.addEventListener('tts-finish', () => {
                  ttsSpeaking = false;
                });
              } else {
                ttsRef.current = '';
              }
            }
          }
        }
      );
      const result = await completionPromise as string;
      isGenerationComplete = true;
      if (assistantMessage) {
        const finalResponse = result || accumulatedResponse;
        if (finalResponse) {
          const finalCleanedResponse = cleanLLMResponse(finalResponse);
          chatSessionStore.updateMessage(assistantMessage.id, finalCleanedResponse);
        } else {
          chatSessionStore.updateMessage(assistantMessage.id, '❌ No response generated. Please try again.');
        }
      }
    } catch (error) {
      isGenerationComplete = true;
      chatSessionStore.addMessage({
        text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}. Tokens received: ${tokensReceived}. Try again.`,
        author: 'assistant',
        type: 'conversation',
      });
    } finally {
      setIsLoading(false);
      chatSessionStore.setIsGenerating(false);
    }
  };

  const renderWelcomeMessage = () => {
    const hasModel = modelStore.context !== undefined;
    const hasDownloadedModel = modelStore.availableModels.length > 0;
    if (!hasModel && !hasDownloadedModel) {
      return (
        <View style={[styles.welcomeContainer, { backgroundColor: colors.surface }]}> 
          <Text style={[styles.welcomeTitle, { color: colors.primary }]}>Welcome to AI Chat!</Text>
          <Text style={[styles.welcomeText, { color: colors.text }]}>To get started, you need to download and load a language model.</Text>
          <Text style={[styles.welcomeText, { color: colors.muted }]}>📱 Go to the "Models" tab to download the TinyLlama-1.1B-Chat model (~0.8GB)</Text>
          <Text style={[styles.welcomeText, { color: colors.muted }]}>⚡ Once downloaded, tap "Load Model" to start chatting!</Text>
        </View>
      );
    }
    if (!hasModel && hasDownloadedModel) {
      return (
        <View style={[styles.welcomeContainer, { backgroundColor: colors.surface }]}> 
          <Text style={[styles.welcomeTitle, { color: colors.primary }]}>Model Ready!</Text>
          <Text style={[styles.welcomeText, { color: colors.text }]}>Your model is downloaded but not loaded yet.</Text>
          <Text style={[styles.welcomeText, { color: colors.muted }]}>📱 Go to the "Models" tab and tap "Load Model" to start chatting!</Text>
        </View>
      );
    }
    return (
      <View style={[styles.welcomeContainer, { backgroundColor: colors.surface }]}> 
        <Text style={[styles.welcomeTitle, { color: colors.primary }]}>Welcome to AI Chat!</Text>
        <Text style={[styles.welcomeText, { color: colors.text }]}>Start chatting below!</Text>
      </View>
    );
  };

  const renderLoadingIndicator = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={colors.primary} size="small" />
      <Text style={[styles.loadingText, { color: colors.muted }]}>Generating response...</Text>
    </View>
  );

  if (isWhisperLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.muted }]}>Initializing Whisper Model...</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (whisperError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.error }]}>Whisper Error: {whisperError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ChatHeader
          session={chatSessionStore.activeSession}
          colors={colors}
        />
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {chatSessionStore.currentMessages.length === 0 && renderWelcomeMessage()}
          {chatSessionStore.currentMessages.map((message, index) => (
            <MessageBubble
              key={`${message.id}-${message.text.length}-${index}`}
              message={message}
              colors={colors}
              isUser={message.author === 'user'}
            />
          ))}
          {isLoading && renderLoadingIndicator()}
        </ScrollView>
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          colors={colors}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa', // lighter background for language app
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 0,
  },
  messagesContent: {
    paddingVertical: 12,
    gap: 10, // more vertical space between messages
  },
  welcomeContainer: {
    padding: 28,
    borderRadius: 24,
    marginBottom: 28,
    alignItems: 'center',
    backgroundColor: '#fff',
    elevation: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    borderWidth: 1,
    borderColor: '#e0e7ef',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#2563eb',
    letterSpacing: -0.5,
  },
  welcomeText: {
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 10,
    color: '#334155',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: '#f1f5fd',
    borderRadius: 16,
    margin: 8,
    elevation: 2,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#64748b',
  },
  // Add a gradient or color block at the top (for the header area)
  gradientBlock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: '#e0e7ff',
    zIndex: -1,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
});

export default ChatScreen; 