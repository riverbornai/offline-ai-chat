import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChatMessage } from '../stores/ChatSessionStore';

interface MessageBubbleProps {
  message: ChatMessage;
  colors: any;
  isUser: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  colors,
  isUser,
  onPress,
  onLongPress,
}) => {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'conversation': return '💬';
      case 'translation': return '🔄';
      case 'grammar': return '📝';
      case 'vocabulary': return '📖';
      case 'pronunciation': return '🗣️';
      case 'cultural': return '🌍';
      case 'roleplay': return '🎭';
      case 'transcription': return '🎤';
      default: return '';
    }
  };

  const hasText = message.text.replace(/\[BLANK_AUDIO\]/gi, '').trim().length > 0;

  if (!hasText && message.type !== 'transcription') return null;

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <TouchableOpacity
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          {
            backgroundColor: isUser ? colors.primary : colors.surface,
            borderColor: isUser ? colors.primary : colors.border,
            borderWidth: isUser ? 0 : 1,
            shadowColor: isUser ? colors.primary : '#000',
          },
          message.type === 'transcription' && styles.transcriptionBubble
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={!onPress && !onLongPress}
        activeOpacity={0.8}
      >
        {message.type && (message.type === 'transcription' || !isUser) && (
          <View style={[styles.typeIndicator, { backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : `${colors.primary}10` }]}>
            <Text style={styles.typeIcon}>{getTypeIcon(message.type)}</Text>
          </View>
        )}
        
        <Text
          style={[
            styles.messageText,
            {
              color: isUser ? colors.surface : colors.text,
              fontStyle: message.type === 'transcription' ? 'italic' : 'normal',
              opacity: message.type === 'transcription' ? 0.7 : 1,
            },
          ]}
        >
          {message.text.replace(/\[BLANK_AUDIO\]/gi, '').trim()}
          {message.type === 'transcription' && '...'}
        </Text>
        
        <View style={styles.footer}>
          <Text
            style={[
              styles.timestamp,
              {
                color: isUser ? colors.surface : colors.muted,
                opacity: 0.6,
              },
            ]}
          >
            {formatTime(message.timestamp)}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    paddingHorizontal: 12,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
  },
  transcriptionBubble: {
    borderStyle: 'dashed',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  typeIndicator: {
    marginBottom: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typeIcon: {
    fontSize: 12,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

export default MessageBubble;
 