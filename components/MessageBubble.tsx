import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ttsService } from '../services/ttsService';
import { ChatMessage } from '../stores/ChatSessionStore';

// Animated audio wave dots for active voice messages
const VoiceWaveDot: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.3, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.4, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.4, duration: 300, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay]);

  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: color,
        transform: [{ scale }],
        opacity,
        marginHorizontal: 2,
      }}
    />
  );
};

const VoiceWaveDots: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', height: 16, marginHorizontal: 4 }}>
    <VoiceWaveDot delay={0} color={color} />
    <VoiceWaveDot delay={150} color={color} />
    <VoiceWaveDot delay={300} color={color} />
  </View>
);

interface MessageBubbleProps {
  message: ChatMessage;
  colors: any;
  isUser: boolean;
  isLoading?: boolean;
  isSpeaking?: boolean;
  onStopTTS?: () => void;
  onPress?: () => void;
  onLongPress?: () => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  colors,
  isUser,
  isLoading,
  isSpeaking: isStreamSpeaking = false,
  onStopTTS,
  onPress,
  onLongPress,
}) => {
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const activeSpeaking = isStreamSpeaking || isLocalSpeaking;

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
    if (type === 'transcription') return { icon: '🎤', label: 'Voice' };
    return null;
  };

  const cleanText = message.text
    .replace(/\[BLANK_AUDIO\]/gi, '')
    .replace(/\(BLANK_AUDIO\)/gi, '')
    .trim();

  const isTranscription = message.type === 'transcription';
  const typeInfo = getTypeLabel(message.type);

  // If text is empty, check if we should render loading state for assistant or voice listening state for user
  if (!cleanText) {
    if (!isUser && isLoading) {
      return (
        <View style={[styles.row, styles.rowAssistant]}>
          <View style={[styles.avatar, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30`, marginBottom: 0 }]}>
            <Ionicons name="sparkles" size={14} color={colors.primary} />
          </View>

          <View style={[styles.bubbleColumn, styles.bubbleColumnAssistant]}>
            <View
              style={[
                styles.bubble,
                styles.assistantBubble,
                {
                  backgroundColor: colors.surface,
                  borderColor: `${colors.primary}30`,
                  shadowColor: colors.shadow ?? '#000',
                },
              ]}
            >
              <View style={styles.loadingContainer}>
                <VoiceWaveDots color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.muted }]}>
                  AI is composing...
                </Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (isUser && isTranscription) {
      return (
        <View style={[styles.row, styles.rowUser]}>
          <View style={[styles.bubbleColumn, styles.bubbleColumnUser]}>
            <View
              style={[
                styles.typeBadge,
                styles.typeBadgeUser,
                { backgroundColor: `${colors.primary}25` },
              ]}
            >
              <Text style={styles.typeBadgeIcon}>🎤</Text>
              <Text style={[styles.typeBadgeLabel, { color: colors.primary }]}>Voice</Text>
            </View>

            <View
              style={[
                styles.bubble,
                styles.userBubble,
                {
                  backgroundColor: `${colors.primary}20`,
                  borderColor: `${colors.primary}60`,
                  borderWidth: 1.5,
                },
              ]}
            >
              <View style={styles.loadingContainer}>
                <VoiceWaveDots color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.primary, fontStyle: 'italic' }]}>
                  Listening…
                </Text>
              </View>
            </View>

            <View style={[styles.footer, styles.footerUser]}>
              <Text style={[styles.timestamp, { color: colors.muted }]}>
                {formatTime(message.timestamp)}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    return null;
  }

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
              { backgroundColor: isUser ? `${colors.primary}25` : `${colors.primary}14` },
            ]}
          >
            <Text style={styles.typeBadgeIcon}>{typeInfo.icon}</Text>
            <Text style={[styles.typeBadgeLabel, { color: isUser ? colors.primary : colors.primary }]}>
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
              backgroundColor: isTranscription
                ? (isUser ? `${colors.primary}22` : colors.surface)
                : (isUser ? colors.primary : colors.surface),
              borderColor: isTranscription
                ? `${colors.primary}60`
                : (isUser ? 'transparent' : colors.border),
              borderWidth: isTranscription ? 1.5 : 1,
              shadowColor: isUser ? colors.primary : (colors.shadow ?? '#000'),
            },
          ]}
          onPress={onPress}
          onLongPress={onLongPress}
          disabled={!onPress && !onLongPress}
          activeOpacity={0.82}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text
              style={[
                styles.messageText,
                {
                  color: isTranscription
                    ? (isUser ? colors.primary : colors.text)
                    : (isUser ? (colors.onPrimary ?? '#fff') : colors.text),
                  fontStyle: isTranscription ? 'italic' : 'normal',
                },
              ]}
            >
              {cleanText}
            </Text>
            {isTranscription && <VoiceWaveDots color={colors.primary} />}
          </View>
        </TouchableOpacity>

        {/* Footer: timestamp + speaker */}
        <View style={[styles.footer, isUser ? styles.footerUser : styles.footerAssistant]}>
          <Text style={[styles.timestamp, { color: colors.muted }]}>
            {formatTime(message.timestamp)}
          </Text>

          {!isUser && cleanText.length > 0 && !isTranscription && (
            <TouchableOpacity
              onPress={async () => {
                if (activeSpeaking) {
                  if (onStopTTS) {
                    onStopTTS();
                  } else {
                    await ttsService.stop().catch(console.warn);
                  }
                  setIsLocalSpeaking(false);
                } else {
                  setIsLocalSpeaking(true);
                  try {
                    await ttsService.speak(message.text);
                  } finally {
                    setIsLocalSpeaking(false);
                  }
                }
              }}
              style={[
                styles.speakerButton,
                {
                  backgroundColor: activeSpeaking ? `${colors.primary}22` : `${colors.primary}12`,
                  borderColor: activeSpeaking ? `${colors.primary}50` : `${colors.primary}20`,
                },
              ]}
              activeOpacity={0.7}
            >
              {activeSpeaking ? (
                <Ionicons name="volume-high" size={15} color={colors.primary} />
              ) : (
                <Ionicons name="volume-medium-outline" size={15} color={colors.primary} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 5,
    gap: 8,
  },
  rowUser: {
    justifyContent: 'flex-end',
    paddingLeft: 48,
    paddingRight: 14,
  },
  rowAssistant: {
    justifyContent: 'flex-start',
    paddingLeft: 14,
    paddingRight: 48,
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
});

export default MessageBubble;