import { Ionicons } from '@expo/vector-icons';
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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { chatSessionStore, modelStore } = useStores();

  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (sessionId) {
      chatSessionStore.setActiveSession(sessionId);
    } else if (!chatSessionStore.activeSession) {
      chatSessionStore.createConversationSession(topic);
    }
  }, [sessionId, topic]);


  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [chatSessionStore.currentMessages.length, chatSessionStore.currentMessages]);

  const handleSendMessage = async (text: string) => {
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
      lastMsg.type = 'conversation';
    } else if (!lastMsg || lastMsg.author !== 'user' || lastMsg.text.trim() !== cleaned) {
      chatSessionStore.addMessage({
        text: cleaned,
        author: 'user',
        type: 'conversation',
      });
    }
    setIsLoading(true);
    chatSessionStore.setIsGenerating(true);
    let accumulatedResponse = '';
    let tokensReceived = 0;
    try {
      const conversationContext = {
        topic: topic || '',
      };
      const promptBuilder = new ConversationPromptBuilder(conversationContext);
      const prompt = promptBuilder.buildPrompt(cleaned, chatSessionStore.currentMessages);
      const assistantMessage = chatSessionStore.addMessage({
        text: '',
        author: 'assistant',
        type: 'conversation',
      });

      const completionPromise = modelStore.generateCompletion(
        prompt,
        {
          temperature: 0.7,
          max_tokens: 512,
          stop: ['\nUser:', '\nAssistant:'],
        },
        (token: string) => {
          tokensReceived++;
          if (assistantMessage) {
            accumulatedResponse += token;
            const cleanedResponse = cleanLLMResponse(accumulatedResponse);
            chatSessionStore.updateMessage(assistantMessage.id, cleanedResponse);
          }
        }
      );
      const result = await completionPromise as string;
      if (assistantMessage) {
        let finalResponse = result || accumulatedResponse;
        const stopSequences = ['\nUser:', '\nAssistant:'];
        let minIdx = finalResponse.length;
        for (const stop of stopSequences) {
          const idx = finalResponse.indexOf(stop);
          if (idx !== -1 && idx < minIdx) minIdx = idx;
        }
        if (minIdx !== finalResponse.length) {
          finalResponse = finalResponse.slice(0, minIdx);
        }
        if (finalResponse) {
          const finalCleanedResponse = cleanLLMResponse(finalResponse);
          chatSessionStore.updateMessage(assistantMessage.id, finalCleanedResponse);
        } else {
          chatSessionStore.updateMessage(assistantMessage.id, '❌ No response generated. Please try again.');
        }
      }
    } catch (error) {
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
          <View style={styles.actionPrompt}>
            <Ionicons name="arrow-forward-circle" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Go to Models Tab</Text>
          </View>
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
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
        <RealtimeChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          colors={colors}
          placeholder={modelStore.context ? "Say something..." : "Load a model first"}
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
    paddingVertical: 20,
    paddingHorizontal: 4,
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