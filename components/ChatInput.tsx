import React, { useState } from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { LanguageLearningPromptType } from '../utils/chat';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  promptType: LanguageLearningPromptType;
  colors: any;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  promptType,
  colors,
  placeholder,
}) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim() && !isLoading) {
      onSendMessage(text);
      setText('');
    }
  };

  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    
    switch (promptType) {
      case 'conversation':
        return 'Start a conversation...';
      case 'translation':
        return 'Type text to translate...';
      case 'grammar':
        return 'Type text for grammar check...';
      case 'vocabulary':
        return 'Ask about a word or phrase...';
      case 'pronunciation':
        return 'Type a word to learn pronunciation...';
      case 'cultural':
        return 'Ask about cultural context...';
      case 'roleplay':
        return 'Continue the roleplay...';
      default:
        return 'Type your message...';
    }
  };

  const getTypeIcon = () => {
    switch (promptType) {
      case 'conversation':
        return '💬';
      case 'translation':
        return '🔄';
      case 'grammar':
        return '📝';
      case 'vocabulary':
        return '📖';
      case 'pronunciation':
        return '🗣️';
      case 'cultural':
        return '🌍';
      case 'roleplay':
        return '🎭';
      default:
        return '💬';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.inputContainer}>
        <View style={styles.typeIndicator}>
          <Text style={styles.typeIcon}>{getTypeIcon()}</Text>
        </View>
        
        <TextInput
          style={[
            styles.textInput,
            {
              color: colors.text,
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
          value={text}
          onChangeText={setText}
          placeholder={getPlaceholder()}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={1000}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          editable={!isLoading}
        />
        
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: text.trim() && !isLoading ? colors.primary : colors.disabled,
            },
          ]}
          onPress={handleSend}
          disabled={!text.trim() || isLoading}
        >
          <Text style={[styles.sendButtonText, { color: colors.surface }]}>
            {isLoading ? '•••' : '→'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  typeIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeIcon: {
    fontSize: 16,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ChatInput; 