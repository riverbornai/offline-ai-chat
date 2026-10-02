import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { observer } from 'mobx-react';
import { ChatSession } from '../stores/ChatSessionStore';
import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 320);

interface ChatHistoryDrawerProps {
  isOpen: boolean;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
}

const formatDate = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const oneDay = 86400000;
  const oneWeek = oneDay * 7;

  if (diff < oneDay) return 'Today';
  if (diff < oneDay * 2) return 'Yesterday';
  if (diff < oneWeek) {
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface SessionItemProps {
  session: ChatSession;
  isActive: boolean;
  colors: typeof Colors['light'];
  onPress: () => void;
  onDelete: () => void;
}

const SessionItem: React.FC<SessionItemProps> = ({ session, isActive, colors, onPress, onDelete }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  };

  const msgCount = session.messages.filter(m => m.type !== 'transcription').length;
  const lastMsg = session.messages
    .filter(m => m.type !== 'transcription')
    .slice(-1)[0];

  const handleDelete = () => {
    Alert.alert(
      'Delete Chat',
      `Delete "${session.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={[
          styles.sessionItem,
          isActive && {
            backgroundColor: `${colors.primary}15`,
            borderColor: `${colors.primary}40`,
          },
          !isActive && {
            backgroundColor: 'transparent',
            borderColor: 'transparent',
          },
        ]}
      >
        {isActive && (
          <View style={[styles.activeBar, { backgroundColor: colors.primary }]} />
        )}

        <View style={styles.sessionIcon}>
          <Ionicons
            name="chatbubble-outline"
            size={15}
            color={isActive ? colors.primary : colors.muted}
          />
        </View>

        <View style={styles.sessionContent}>
          <Text
            style={[
              styles.sessionTitle,
              { color: isActive ? colors.primary : colors.text },
            ]}
            numberOfLines={1}
          >
            {session.title}
          </Text>
          <View style={styles.sessionMeta}>
            <Text style={[styles.sessionDate, { color: colors.muted }]}>
              {formatDate(session.updatedAt)}
            </Text>
            {msgCount > 0 && (
              <>
                <View style={[styles.metaDot, { backgroundColor: colors.muted }]} />
                <Text style={[styles.sessionMsgCount, { color: colors.muted }]}>
                  {msgCount} msg{msgCount !== 1 ? 's' : ''}
                </Text>
              </>
            )}
          </View>
          {lastMsg && (
            <Text
              style={[styles.sessionPreview, { color: colors.muted }]}
              numberOfLines={1}
            >
              {lastMsg.author === 'user' ? 'You: ' : 'AI: '}
              {lastMsg.text}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={handleDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.deleteBtn}
        >
          <Ionicons name="trash-outline" size={14} color={`${colors.muted}80`} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ChatHistoryDrawer: React.FC<ChatHistoryDrawerProps> = observer(({
  isOpen,
  sessions,
  activeSessionId,
  onClose,
  onSelectSession,
  onNewChat,
  onDeleteSession,
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
          mass: 0.8,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: -DRAWER_WIDTH,
          useNativeDriver: true,
          damping: 22,
          stiffness: 250,
          mass: 0.8,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  const renderItem = useCallback(({ item }: { item: ChatSession }) => (
    <SessionItem
      session={item}
      isActive={item.id === activeSessionId}
      colors={colors}
      onPress={() => {
        onSelectSession(item.id);
        onClose();
      }}
      onDelete={() => onDeleteSession(item.id)}
    />
  ), [activeSessionId, colors, onSelectSession, onClose, onDeleteSession]);

  const keyExtractor = useCallback((item: ChatSession) => item.id, []);

  return (
    <>
      <Animated.View
        style={[styles.overlay, { opacity: overlayOpacity }]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            backgroundColor: colors.surface,
            paddingTop: insets.top + 8,
            transform: [{ translateX }],
          },
        ]}
      >
        <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.drawerTitleRow}>
            <View style={[styles.drawerIconBox, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.drawerTitle, { color: colors.text }]}>Chat History</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.newChatBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            onNewChat();
            onClose();
          }}
          activeOpacity={0.82}
        >
          <Ionicons name="add" size={18} color={colors.background} />
          <Text style={[styles.newChatText, { color: colors.background }]}>New Chat</Text>
        </TouchableOpacity>

        {sortedSessions.length === 0 ? (
          <View style={styles.emptyDrawer}>
            <Ionicons name="chatbubbles-outline" size={40} color={`${colors.muted}50`} />
            <Text style={[styles.emptyDrawerText, { color: colors.muted }]}>
              No chats yet.{'\n'}Start a conversation!
            </Text>
          </View>
        ) : (
          <FlatList
            data={sortedSessions}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.sessionList}
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={{ height: insets.bottom + 8 }} />
      </Animated.View>
    </>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 100,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 101,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  drawerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerTitle: {
    fontSize: 16,
    fontFamily: 'Sora-Bold',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  newChatText: {
    fontSize: 14,
    fontFamily: 'Sora-Bold',
    letterSpacing: 0.2,
  },
  sessionList: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 2,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  sessionIcon: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  sessionContent: {
    flex: 1,
    overflow: 'hidden',
  },
  sessionTitle: {
    fontSize: 13,
    fontFamily: 'Sora-SemiBold',
    letterSpacing: -0.1,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  sessionDate: {
    fontSize: 11,
    fontFamily: 'Sora-Medium',
    opacity: 0.75,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.5,
  },
  sessionMsgCount: {
    fontSize: 11,
    fontFamily: 'Sora-Medium',
    opacity: 0.75,
  },
  sessionPreview: {
    fontSize: 11,
    fontFamily: 'Sora-Regular',
    marginTop: 2,
    opacity: 0.6,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: 4,
  },
  emptyDrawer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyDrawerText: {
    fontSize: 13,
    fontFamily: 'Sora-Medium',
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.65,
  },
});

export default ChatHistoryDrawer;
