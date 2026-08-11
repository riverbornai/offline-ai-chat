import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { observer } from 'mobx-react';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';
import { useStores } from './StoreProvider';

import { ttsService } from '../services/ttsService';
import { ConversationPromptBuilder } from '../utils/chat';
import ChatHeader from './ChatHeader';
import MessageBubble from './MessageBubble';
import RealtimeChatInput from './RealtimeChatInput';

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

interface ChatScreenProps {
  sessionId?: string;
  topic?: string;
}

const ChatScreen: React.FC<ChatScreenProps> = observer(({ sessionId, topic }) => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { chatSessionStore, modelStore } = useStores();

  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Streaming TTS refs (same pattern as TalkScreen)
  const ttsRef = useRef('');
  const ttsQueue = useRef<string[]>([]);
  const ttsSpeakingRef = useRef(false);
  const generationActiveRef = useRef(false);

  // Keep ref in sync with state
  const setIsSpeakingBoth = (val: boolean) => {
    isSpeakingRef.current = val;
    setIsSpeaking(val);
  };

  useEffect(() => {
    if (sessionId) {
      chatSessionStore.setActiveSession(sessionId);
    } else if (!chatSessionStore.activeSession) {
      chatSessionStore.createConversationSession(topic);
    }
  }, [sessionId, topic]);


  // Scroll when new messages are added
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [chatSessionStore.currentMessages.length]);

  // Scroll while AI is streaming tokens into the last message
  const lastMessageText = chatSessionStore.currentMessages.length > 0
    ? chatSessionStore.currentMessages[chatSessionStore.currentMessages.length - 1].text
    : '';
  useEffect(() => {
    if (isLoading && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: false });
    }
  }, [isLoading, lastMessageText]);

  // Speak sentences from the queue one by one (streaming TTS)
  const speakNextSentence = async () => {
    if (ttsQueue.current.length > 0 && !ttsSpeakingRef.current) {
      const sentence = ttsQueue.current.shift()!;
      ttsSpeakingRef.current = true;
      setIsSpeakingBoth(true);
      try {
        await ttsService.speak(sentence);
      } catch (err) {
        console.warn('[ChatScreen] TTS chunk error:', err);
      } finally {
        ttsSpeakingRef.current = false;
        if (ttsQueue.current.length > 0) {
          speakNextSentence();
        } else if (!generationActiveRef.current) {
          // Generation already finished and queue is now empty
          setIsSpeakingBoth(false);
        }
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    // Stop any in-progress TTS before new message
    if (isSpeakingRef.current || ttsSpeakingRef.current) {
      generationActiveRef.current = false;
      ttsQueue.current = [];
      ttsSpeakingRef.current = false;
      await ttsService.stop().catch(console.warn);
      setIsSpeakingBoth(false);
    }
    let cleaned = text.trim().replace(/\[BLANK_AUDIO\]/g, '').trim();
    if (!cleaned || isLoading) return;
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
    const lastMsg = chatSessionStore.currentMessages[chatSessionStore.currentMessages.length - 1];
    if (lastMsg && lastMsg.author === 'user' && lastMsg.text.trim() === cleaned && lastMsg.type === 'transcription') {
      chatSessionStore.updateMessageType(lastMsg.id, 'conversation');
    } else if (!lastMsg || lastMsg.author !== 'user' || lastMsg.text.trim() !== cleaned) {
      chatSessionStore.addMessage({
        text: cleaned,
        author: 'user',
        type: 'conversation',
      });
    }
    setIsLoading(true);
    chatSessionStore.setIsGenerating(true);

    // Reset streaming TTS state
    ttsRef.current = '';
    ttsQueue.current = [];
    ttsSpeakingRef.current = false;
    generationActiveRef.current = true;

    let accumulatedResponse = '';
    let tokensReceived = 0;
    try {
      const promptBuilder = new ConversationPromptBuilder(
        chatSessionStore.settings.systemPrompt
      );
      const messages = promptBuilder.buildMessages(cleaned, chatSessionStore.currentMessages);
      const assistantMessage = chatSessionStore.addMessage({
        text: '',
        author: 'assistant',
        type: 'conversation',
      });

      await modelStore.generateCompletion(
        messages,
        {
          temperature: 0.7,
          // 256 tokens is plenty for a chat reply and keeps on-device
          // latency reasonable; the model's own end-of-turn token (applied
          // via the chat template) is what actually stops generation early
          // for shorter answers.
          max_tokens: 256,
          stop: ['\nUser:', '\nAssistant:'],
        },
        (token: string) => {
          if (!generationActiveRef.current) return;
          tokensReceived++;
          if (assistantMessage) {
            accumulatedResponse += token;
            const cleanedResponse = cleanLLMResponse(accumulatedResponse);
            chatSessionStore.updateMessage(assistantMessage.id, cleanedResponse);
          }
          // ── Streaming TTS: extract complete sentences as tokens arrive ──
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

      // Flush any remaining text after generation finishes
      const remaining = ttsRef.current.trim();
      if (remaining && !/^[\s.,!?;:]+$/.test(remaining)) {
        ttsQueue.current.push(remaining);
      }
      ttsRef.current = '';

      // Finalize the message text
      if (assistantMessage) {
        let finalResponse = accumulatedResponse;
        const stopSequences = ['\nUser:', '\nAssistant:'];
        let minIdx = finalResponse.length;
        for (const stop of stopSequences) {
          const idx = finalResponse.indexOf(stop);
          if (idx !== -1 && idx < minIdx) minIdx = idx;
        }
        if (minIdx !== finalResponse.length) finalResponse = finalResponse.slice(0, minIdx);
        if (finalResponse) {
          chatSessionStore.updateMessage(assistantMessage.id, cleanLLMResponse(finalResponse));
        } else {
          chatSessionStore.updateMessage(assistantMessage.id, '❌ No response generated. Please try again.');
        }
      }

      // Kick off TTS for any remaining queued sentences
      generationActiveRef.current = false;
      if (ttsQueue.current.length > 0 && !ttsSpeakingRef.current) {
        speakNextSentence();
      } else if (!ttsSpeakingRef.current) {
        setIsSpeakingBoth(false);
      }
    } catch (error) {
      generationActiveRef.current = false;
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

    return (
      <View style={[styles.welcomeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.welcomeIconContainer, { backgroundColor: `${colors.primary}15` }]}>
          <Ionicons name="sparkles" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.welcomeTitle, { color: colors.text }]}>
          {!hasModel && !hasDownloadedModel ? 'Welcome to AI Chat!' : hasDownloadedModel && !hasModel ? 'Model Ready!' : 'Start Chatting!'}
        </Text>
        <Text style={[styles.welcomeText, { color: colors.text }]}>
          {!hasModel && !hasDownloadedModel
            ? 'Download a model to begin your AI companion experience.'
            : hasDownloadedModel && !hasModel
              ? 'Your model is ready to go. Just load it in the Models tab.'
              : 'I\'m ready to help! What would you like to talk about today?'}
        </Text>
        {!hasModel && (
          <TouchableOpacity
            style={styles.actionPrompt}
            onPress={() => router.push('/(tabs)/models')}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-forward-circle" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Go to Models Tab</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderLoadingIndicator = () => (
    <View style={[styles.loadingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ActivityIndicator color={colors.primary} size="small" />
      <Text style={[styles.loadingText, { color: colors.muted }]}>AI is composing...</Text>
    </View>
  );


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ChatHeader
          session={chatSessionStore.activeSession}
          colors={colors}
          modelReady={!!modelStore.context}
          isSpeaking={isSpeaking}
          onStopTTS={() => {
            ttsService.stop().catch(console.warn);
            setIsSpeakingBoth(false);
          }}
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
          {isLoading && chatSessionStore.currentMessages[chatSessionStore.currentMessages.length - 1]?.author !== 'assistant' && renderLoadingIndicator()}
        </ScrollView>
        <RealtimeChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          colors={colors}
          placeholder={modelStore.context ? "Say something..." : "Load a model first"}
          isModelLoaded={!!modelStore.context}
          onModelNotLoadedPress={() => router.push('/(tabs)/models')}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 0,
  },
  welcomeCard: {
    margin: 20,
    padding: 32,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  welcomeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontFamily: 'Sora-Bold',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  welcomeText: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Sora-Medium',
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 20,
  },
  actionPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 15,
    fontFamily: 'Sora-Bold',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: 12,
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Sora-Medium',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Sora-Medium',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default ChatScreen;