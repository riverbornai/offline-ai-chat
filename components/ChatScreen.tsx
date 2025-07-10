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
import { LanguageLearningSettings } from '../stores/ChatSessionStore';
import { createPromptBuilder, LanguageLearningPromptType } from '../utils/chat';
import { useStores } from './StoreProvider';

import ChatHeader from './ChatHeader';
import ChatInput from './ChatInput';
import LanguageLearningPanel from './LanguageLearningPanel';
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
  initialType?: LanguageLearningPromptType;
  topic?: string;
}

const ChatScreen: React.FC<ChatScreenProps> = observer(({ sessionId, initialType = 'conversation', topic }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { chatSessionStore, modelStore } = useStores();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showLanguagePanel, setShowLanguagePanel] = useState(false);
  const [currentPromptType, setCurrentPromptType] = useState<LanguageLearningPromptType>(initialType);
  
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Initialize session if needed
  useEffect(() => {
    if (sessionId) {
      chatSessionStore.setActiveSession(sessionId);
    } else if (!chatSessionStore.activeSession) {
      // Create new session based on type
      switch (initialType) {
        case 'conversation':
          chatSessionStore.createConversationSession(topic);
          break;
        case 'translation':
          chatSessionStore.createTranslationSession();
          break;
        case 'grammar':
          chatSessionStore.createGrammarSession();
          break;
        case 'vocabulary':
          chatSessionStore.createVocabularySession(topic);
          break;
        default:
          chatSessionStore.createConversationSession();
      }
    }
  }, [sessionId, initialType, topic]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    console.log('Messages changed, count:', chatSessionStore.currentMessages.length);
    console.log('Current messages:', chatSessionStore.currentMessages.map(m => ({ id: m.id, text: m.text.substring(0, 50) })));
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [chatSessionStore.currentMessages.length, chatSessionStore.currentMessages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    
    // Check if model is available
    if (!modelStore.context) {
      console.error('No model context available');
      
      const hasDownloadedModel = modelStore.availableModels.length > 0;
      const errorMessage = hasDownloadedModel 
        ? '❌ Model is downloaded but not loaded. Go to the Models tab and tap "Load Model" to start chatting.'
        : '❌ No model available. Please download and load a language model first. Go to the Models tab to set up a model.';
      
      // Add error message to chat instead of alert
      chatSessionStore.addMessage({
        text: errorMessage,
        author: 'assistant',
        type: currentPromptType,
      });
      return;
    }

    // Debug: Check model status
    console.log('Model context available:', !!modelStore.context);
    console.log('Model isInferencing:', modelStore.isInferencing);
    console.log('Active model:', modelStore.activeModel?.name);

    // Validate language support
    const { targetLanguage } = chatSessionStore.settings;
    if (!modelStore.isLanguageSupported(targetLanguage)) {
      const supportedLanguages = modelStore.getSupportedLanguages();
      chatSessionStore.addMessage({
        text: `❌ Language "${targetLanguage}" is not supported by the current model. Supported languages: ${supportedLanguages.join(', ')}. Please change your target language in the settings.`,
        author: 'assistant',
        type: currentPromptType,
      });
      return;
    }

    // Add user message
    chatSessionStore.addMessage({
      text: text.trim(),
      author: 'user',
      type: currentPromptType,
    });

    setIsLoading(true);
    chatSessionStore.setIsGenerating(true);

    // Track accumulated response for streaming
    let accumulatedResponse = '';
    let tokensReceived = 0;
    let isGenerationComplete = false;

    try {
      // Build prompt based on current type
      const promptSettings = {
        targetLanguage: chatSessionStore.settings.targetLanguage,
        nativeLanguage: chatSessionStore.settings.nativeLanguage,
        learningLevel: chatSessionStore.settings.learningLevel,
        correctionPreference: chatSessionStore.settings.correctionPreference,
        topic: topic || chatSessionStore.activeSession?.type,
      };
      
      console.log('Prompt settings:', promptSettings);
      const promptBuilder = createPromptBuilder(promptSettings);

      // Get recent conversation history (excluding the current user message)
      const allMessages = chatSessionStore.getRecentMessages(10);
      // Remove the last message (current user input) to avoid duplication
      const conversationHistory = allMessages.slice(0, -1);
      
      // Try a simple prompt first to test if model works
      const simplePrompt = `User: ${text}\nAssistant:`;
      console.log('Using simple prompt for testing:', simplePrompt);
      
      // const prompt = promptBuilder.buildPrompt(currentPromptType, text, conversationHistory);
      // console.log('Final prompt length:', prompt.length);
      // console.log('Conversation history count:', conversationHistory.length);
      
      // Add assistant message placeholder
      const assistantMessage = chatSessionStore.addMessage({
        text: '',
        author: 'assistant',
        type: currentPromptType,
      });

      // Variables declared above for scope access

      // Generate response with streaming and timeout
      console.log('Starting completion generation with simple prompt...');
      
      // Add timeout to prevent hanging
      const completionPromise = modelStore.generateCompletion(
        simplePrompt,
        {
          temperature: 0.7,
          max_tokens: 100,
        },
        (token: string) => {
          // Stop processing if generation is marked complete
          if (isGenerationComplete) {
            console.log('Ignoring token after completion:', token);
            return;
          }
          
          // Update assistant message in real-time
          tokensReceived++;
          if (assistantMessage) {
            accumulatedResponse += token;
            console.log(`Token ${tokensReceived}:`, token, 'Accumulated length:', accumulatedResponse.length);
            
            // Clean up the response by removing unwanted formatting
            const cleanedResponse = cleanLLMResponse(accumulatedResponse);
            chatSessionStore.updateMessage(assistantMessage.id, cleanedResponse);
          }
        }
      );
      
      // Let the model take as much time as it needs (no timeout)
      // Mobile AI models can be slow to warm up, especially on first use
      const result = await completionPromise as string;
      
      // Mark generation as complete to stop processing any more tokens
      isGenerationComplete = true;
      
      console.log('Completion finished, final result length:', result?.length || 0, 'Tokens received:', tokensReceived);
      
      // Ensure the final message is updated with the complete response
      if (assistantMessage) {
        const finalResponse = result || accumulatedResponse;
        if (finalResponse) {
          const finalCleanedResponse = cleanLLMResponse(finalResponse);
          chatSessionStore.updateMessage(assistantMessage.id, finalCleanedResponse);
        } else {
          // If no response, show error
          chatSessionStore.updateMessage(assistantMessage.id, '❌ No response generated. Please try again.');
        }
      }

    } catch (error) {
      // Mark generation as complete to stop processing any more tokens
      isGenerationComplete = true;
      
      console.error('Error generating response:', error);
      console.log('Tokens received before error:', tokensReceived);
      console.log('Accumulated response before error:', accumulatedResponse);
      
      // Add error message to chat instead of alert
      chatSessionStore.addMessage({
        text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}. Tokens received: ${tokensReceived}. Try again.`,
        author: 'assistant',
        type: currentPromptType,
      });
    } finally {
      setIsLoading(false);
      chatSessionStore.setIsGenerating(false);
    }
  };

  const handlePromptTypeChange = (type: LanguageLearningPromptType) => {
    setCurrentPromptType(type);
    setShowLanguagePanel(false);
  };

  const handleSettingsChange = (settings: Partial<LanguageLearningSettings>) => {
    chatSessionStore.updateSettings(settings);
  };

  const renderWelcomeMessage = () => {
    const { targetLanguage, learningLevel } = chatSessionStore.settings;
    const hasModel = modelStore.context !== undefined;
    const hasDownloadedModel = modelStore.availableModels.length > 0;
    
    if (!hasModel && !hasDownloadedModel) {
      return (
        <View style={[styles.welcomeContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.welcomeTitle, { color: colors.primary }]}>
            Welcome to Language Learning Chat!
          </Text>
          <Text style={[styles.welcomeText, { color: colors.text }]}>
            To get started, you need to download and load a language model.
          </Text>
          <Text style={[styles.welcomeText, { color: colors.muted }]}>
            📱 Go to the "Models" tab to download the Phi-3 Mini model (~2.4GB)
          </Text>
          <Text style={[styles.welcomeText, { color: colors.muted }]}>
            ⚡ Once downloaded, tap "Load Model" to start chatting!
          </Text>
        </View>
      );
    }
    
    if (!hasModel && hasDownloadedModel) {
      return (
        <View style={[styles.welcomeContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.welcomeTitle, { color: colors.primary }]}>
            Model Ready!
          </Text>
          <Text style={[styles.welcomeText, { color: colors.text }]}>
            Your model is downloaded but not loaded yet.
          </Text>
          <Text style={[styles.welcomeText, { color: colors.muted }]}>
            📱 Go to the "Models" tab and tap "Load Model" to start chatting!
          </Text>
        </View>
      );
    }
    
    return (
      <View style={[styles.welcomeContainer, { backgroundColor: colors.surface }]}>
        <Text style={[styles.welcomeTitle, { color: colors.primary }]}>
          Welcome to Language Learning Chat!
        </Text>
        <Text style={[styles.welcomeText, { color: colors.text }]}>
          {`I am here to help you learn ${targetLanguage}. Your current level is ${learningLevel}.`}
        </Text>
        <Text style={[styles.welcomeText, { color: colors.muted }]}>
          Choose a learning mode or just start chatting!
        </Text>
      </View>
    );
  };

  const renderLoadingIndicator = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={colors.primary} size="small" />
      <Text style={[styles.loadingText, { color: colors.muted }]}>
        Generating response...
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ChatHeader
          session={chatSessionStore.activeSession}
          onSettingsPress={() => setShowLanguagePanel(!showLanguagePanel)}
          onTypeChange={handlePromptTypeChange}
          currentType={currentPromptType}
          colors={colors}
        />
        
        {showLanguagePanel && (
          <LanguageLearningPanel
            settings={chatSessionStore.settings}
            onSettingsChange={handleSettingsChange}
            onClose={() => setShowLanguagePanel(false)}
            colors={colors}
          />
        )}

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
          promptType={currentPromptType}
          colors={colors}
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
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  welcomeContainer: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
  },
});

export default ChatScreen; 