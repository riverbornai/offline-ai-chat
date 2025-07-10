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
        return '';
    }
  };

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <TouchableOpacity
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          {
            backgroundColor: isUser ? colors.primary : colors.surface,
          },
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={!onPress && !onLongPress}
        activeOpacity={0.8}
      >
        {!isUser && message.type && (
          <View style={styles.typeIndicator}>
            <Text style={styles.typeIcon}>{getTypeIcon(message.type)}</Text>
          </View>
        )}
        
        <Text
          style={[
            styles.messageText,
            {
              color: isUser ? colors.surface : colors.text,
            },
          ]}
        >
          {message.text}
        </Text>
        
        <Text
          style={[
            styles.timestamp,
            {
              color: isUser ? colors.surface : colors.muted,
            },
          ]}
        >
          {formatTime(message.timestamp)}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
  },
  typeIndicator: {
    position: 'absolute',
    top: -8,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeIcon: {
    fontSize: 12,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    alignSelf: 'flex-end',
    opacity: 0.7,
  },
});

export default MessageBubble; 