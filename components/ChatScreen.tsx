import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { observer } from 'mobx-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';
import { useStores } from './StoreProvider';

import { ttsService } from '../services/ttsService';
import { ConversationPromptBuilder } from '../utils/chat';
import ChatHeader from './ChatHeader';
import ChatHistoryDrawer from './ChatHistoryDrawer';
import MessageBubble from './MessageBubble';
import RealtimeChatInput from './RealtimeChatInput';

// Custom animated 3-dot typing indicator for AI response generation
const TypingDot: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.25, duration: 320, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.4, duration: 320, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.4, duration: 320, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay]);

  return (
    <Animated.View
      style={{
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: color,
        transform: [{ scale }],
        opacity,
        marginHorizontal: 2.5,
      }}
    />
  );
};

const TypingIndicator: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', height: 18, paddingHorizontal: 2 }}>
    <TypingDot delay={0} color={color} />
    <TypingDot delay={180} color={color} />
    <TypingDot delay={360} color={color} />
  </View>
);

const cleanLLMResponse = (response: string): string => {
  return response
    .replace(/^(Solution \d+:|Answer:|Response:)\s*/i, '')
    .replace(/<\|assistant\|>/g, '')
    .replace(/<\|user\|>/g, '')
    .replace(/<\|system\|>/g, '')
    .replace(/<\|endoftext\|>/g, '')
    // Safety net for Gemma's <eos> / <end_of_turn> special tokens: `stop` in
    // ModelStore should catch these mid-stream, but strip them here too in
    // case a token straddles a stream chunk boundary and slips through.
    .replace(/<eos>/g, '')
    .replace(/<end_of_turn>/g, '')
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isSpeakingRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const generationActiveRef = useRef(false);

  // Keep ref in sync with state
  const setIsSpeakingBoth = (val: boolean) => {
    isSpeakingRef.current = val;
    setIsSpeaking(val);
  };

  // ── New Chat handler ──────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    generationActiveRef.current = false;
    ttsService.stop().catch(console.warn);
    setIsSpeakingBoth(false);
    setIsLoading(false);
    chatSessionStore.createConversationSession('New Chat');
  }, [chatSessionStore]);

  // ── Switch session ─────────────────────────────────────────────────────
  const handleSelectSession = useCallback((id: string) => {
    generationActiveRef.current = false;
    ttsService.stop().catch(console.warn);
    setIsSpeakingBoth(false);
    setIsLoading(false);
    chatSessionStore.setActiveSession(id);
  }, [chatSessionStore]);

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

  // When keyboard opens, scroll to bottom so latest message stays visible
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    return () => sub.remove();
  }, []);


  const handleSendMessage = async (text: string) => {
    let cleaned = text.trim().replace(/\[BLANK_AUDIO\]/g, '').trim();
    if (!cleaned || isLoading) return;

    // If all sessions were deleted, create a new one so addMessage/updateMessage
    // don't silently return (they bail out when activeSession is null).
    if (!chatSessionStore.activeSession) {
      chatSessionStore.createConversationSession('New Chat');
    }

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
    const historyBeforeThisTurn = chatSessionStore.currentMessages.slice();
    const lastMsg = historyBeforeThisTurn[historyBeforeThisTurn.length - 1];
    // True whenever the store's last message already IS this turn's user text
    // (either a live transcription bubble being finalized, or a resend the
    // dedup guard below intentionally skips re-adding).
    const currentTurnAlreadyInHistory =
      !!lastMsg && lastMsg.author === 'user' && lastMsg.text.trim() === cleaned;
    if (currentTurnAlreadyInHistory && lastMsg.type === 'transcription') {
      chatSessionStore.updateMessageType(lastMsg.id, 'conversation');
    } else if (!currentTurnAlreadyInHistory) {
      chatSessionStore.addMessage({
        text: cleaned,
        author: 'user',
        type: 'conversation',
      });
    }
    setIsLoading(true);
    chatSessionStore.setIsGenerating(true);

    generationActiveRef.current = true;

    let accumulatedResponse = '';
    let tokensReceived = 0;
    try {
      const promptBuilder = new ConversationPromptBuilder(
        chatSessionStore.settings.systemPrompt
      );
      // buildMessages() appends `cleaned` itself as the final user turn, so the
      // history passed in here must NOT already end with that same message —
      // otherwise the prompt gets two consecutive 'user' turns (once from
      // history, once from buildMessages). That silently degrades quality on
      // templates that tolerate back-to-back user turns, and hard-fails
      // ("Conversation roles must alternate...") on templates that enforce
      // strict user/assistant alternation, like Gemma's.
      const promptHistory = currentTurnAlreadyInHistory
        ? historyBeforeThisTurn.slice(0, -1)
        : historyBeforeThisTurn;
      const messages = promptBuilder.buildMessages(cleaned, promptHistory);
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

        }
      );



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

      generationActiveRef.current = false;
      setIsSpeakingBoth(false);
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
    <View style={styles.loadingRow}>
      <View style={[styles.avatar, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30` }]}>
        <Ionicons name="sparkles" size={14} color={colors.primary} />
      </View>
      <View style={styles.bubbleColumn}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: colors.surface,
              borderColor: `${colors.primary}30`,
              shadowColor: colors.primary ?? '#000',
            },
          ]}
        >
          <View style={styles.loadingContainer}>
            <TypingIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.muted }]}>AI is composing...</Text>
          </View>
        </View>
      </View>
    </View>
  );


  return (
    <View style={{ flex: 1 }}>
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
          isContextLoading={modelStore.isContextLoading}
          isSpeaking={isSpeaking}
          onStopTTS={() => {
            ttsService.stop().catch(console.warn);
            setIsSpeakingBoth(false);
          }}
          onOpenDrawer={() => setIsDrawerOpen(true)}
        />
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {chatSessionStore.currentMessages.length === 0 && renderWelcomeMessage()}
          {chatSessionStore.currentMessages.map((message, index) => {
            const isLastAssistantMessage =
              message.author === 'assistant' &&
              index === chatSessionStore.currentMessages.length - 1;
            return (
              <MessageBubble
                key={`${message.id}-${message.text.length}-${index}`}
                message={message}
                colors={colors}
                isUser={message.author === 'user'}
                isLoading={isLoading && index === chatSessionStore.currentMessages.length - 1}
                isSpeaking={isSpeaking && isLastAssistantMessage}
                onStopTTS={() => {
                  ttsService.stop().catch(console.warn);
                  setIsSpeakingBoth(false);
                }}
              />
            );
          })}
          {isLoading &&
            (chatSessionStore.currentMessages.length === 0 ||
              chatSessionStore.currentMessages[chatSessionStore.currentMessages.length - 1]?.author === 'user') &&
            renderLoadingIndicator()}
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

    {/* Chat History Drawer - overlays full screen */}
    <ChatHistoryDrawer
      isOpen={isDrawerOpen}
      sessions={chatSessionStore.sessions.slice()}
      activeSessionId={chatSessionStore.activeSessionId}
      onClose={() => setIsDrawerOpen(false)}
      onSelectSession={handleSelectSession}
      onNewChat={handleNewChat}
      onDeleteSession={(id) => chatSessionStore.deleteSession(id)}
    />
    </View>
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 14,
    paddingRight: 48,
    marginVertical: 5,
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bubbleColumn: {
    maxWidth: '78%',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
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