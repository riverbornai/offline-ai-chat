import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ttsService } from '../services/ttsService';
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
  const [isSpeaking, setIsSpeaking] = useState(false);

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTypeLabel = (type?: string): { icon: string; label: string } | null => {
    // Only show a badge for voice-transcribed messages
    if (type === 'transcription') return { icon: '🎤', label: 'Voice' };
    return null;
  };

  const cleanText = message.text
    .replace(/\[BLANK_AUDIO\]/gi, '')
    .replace(/\(BLANK_AUDIO\)/gi, '')
    .trim();

  if (!cleanText) return null;

  const typeInfo = getTypeLabel(message.type);
  const isTranscription = message.type === 'transcription';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {/* AI avatar */}
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30` }]}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
        </View>
      )}

      <View style={[styles.bubbleColumn, isUser ? styles.bubbleColumnUser : styles.bubbleColumnAssistant]}>
        {/* Type badge — shown for special types */}
        {typeInfo && (
          <View
            style={[
              styles.typeBadge,
              isUser ? styles.typeBadgeUser : styles.typeBadgeAssistant,
              { backgroundColor: isUser ? 'rgba(255,255,255,0.22)' : `${colors.primary}14` },
            ]}
          >
            <Text style={styles.typeBadgeIcon}>{typeInfo.icon}</Text>
            <Text style={[styles.typeBadgeLabel, { color: isUser ? (colors.onPrimary ?? '#fff') : colors.primary }]}>
              {typeInfo.label}
            </Text>
          </View>
        )}

        {/* Bubble */}
        <TouchableOpacity
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.assistantBubble,
            {
              backgroundColor: isUser ? colors.primary : colors.surface,
              borderColor: isUser ? 'transparent' : colors.border,
              shadowColor: isUser ? colors.primary : (colors.shadow ?? '#000'),
            },
            isTranscription && [styles.transcriptionBubble, { borderColor: colors.muted }],
          ]}
          onPress={onPress}
          onLongPress={onLongPress}
          disabled={!onPress && !onLongPress}
          activeOpacity={0.82}
        >
          <Text
            style={[
              styles.messageText,
              {
                color: isUser ? (colors.onPrimary ?? '#fff') : colors.text,
                fontStyle: isTranscription ? 'italic' : 'normal',
                opacity: isTranscription ? 0.75 : 1,
              },
            ]}
          >
            {cleanText}
            {isTranscription ? '…' : ''}
          </Text>
        </TouchableOpacity>

        {/* Footer: timestamp + speaker */}
        <View style={[styles.footer, isUser ? styles.footerUser : styles.footerAssistant]}>
          <Text style={[styles.timestamp, { color: colors.muted }]}>
            {formatTime(message.timestamp)}
          </Text>

          {!isUser && cleanText.length > 0 && !isTranscription && (
            <TouchableOpacity
              onPress={async () => {
                setIsSpeaking(true);
                try {
                  await ttsService.speak(message.text);
                } finally {
                  setIsSpeaking(false);
                }
              }}
              style={[styles.speakerButton, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}20` }]}
              activeOpacity={0.7}
            >
              {isSpeaking ? (
                <ActivityIndicator size="small" color={colors.primary} style={styles.speakerSpinner} />
              ) : (
                <Ionicons name="volume-medium-outline" size={15} color={colors.primary} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* User avatar spacer (keeps layout symmetric) */}
      {isUser && <View style={styles.avatarSpacer} />}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 5,
    paddingHorizontal: 14,
    gap: 8,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },

  // Avatar
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20, // aligns with footer
    flexShrink: 0,
  },
  avatarSpacer: {
    width: 32,
    flexShrink: 0,
  },

  // Column holding badge + bubble + footer
  bubbleColumn: {
    maxWidth: '78%',
    gap: 4,
  },
  bubbleColumnUser: {
    alignItems: 'flex-end',
  },
  bubbleColumnAssistant: {
    alignItems: 'flex-start',
  },

  // Type badge
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  typeBadgeUser: {
    alignSelf: 'flex-end',
  },
  typeBadgeAssistant: {
    alignSelf: 'flex-start',
  },
  typeBadgeIcon: {
    fontSize: 13,
  },
  typeBadgeLabel: {
    fontSize: 11,
    fontFamily: 'Sora-SemiBold',
    letterSpacing: 0.3,
  },

  // Bubble
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  userBubble: {
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    borderBottomLeftRadius: 6,
  },
  transcriptionBubble: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },

  // Text
  messageText: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: 'Sora-Medium',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    paddingHorizontal: 2,
  },
  footerUser: {
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  footerAssistant: {
    justifyContent: 'flex-start',
  },
  timestamp: {
    fontSize: 10,
    fontFamily: 'Sora-Regular',
    letterSpacing: 0.2,
    opacity: 0.7,
  },

  // Speaker button
  speakerButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speakerSpinner: {
    transform: [{ scale: 0.7 }],
  },
});

export default MessageBubble;