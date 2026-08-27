import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatSession } from '../stores/ChatSessionStore';

interface ChatHeaderProps {
  session?: ChatSession;
  colors: any;
  modelReady?: boolean;
  isContextLoading?: boolean;
  isSpeaking?: boolean;
  onStopTTS?: () => void;
  onOpenDrawer?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  session,
  colors,
  modelReady = false,
  isContextLoading = false,
  isSpeaking = false,
  onStopTTS,
  onOpenDrawer,
}) => {

  // Status based on model loading/readiness — no network check needed
  // (this is an offline-first app; the model running locally is what matters)
  let statusColor: string;
  let statusLabel: string;
  let statusIcon: any;

  if (isContextLoading) {
    statusColor = '#9fcebe';  // riverMist — neutral
    statusLabel = 'Loading...';
    statusIcon  = 'hourglass-outline';
  } else if (modelReady) {
    statusColor = '#10b981';
    statusLabel = 'Ready';
    statusIcon  = 'checkmark-circle';
  } else {
    statusColor = '#f59e0b';
    statusLabel = 'No Model';
    statusIcon  = 'warning-outline';
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.headerRow}>

        {/* Hamburger — open history drawer */}
        <TouchableOpacity
          onPress={onOpenDrawer}
          style={[styles.sideBtn, { backgroundColor: `${colors.primary}12` }]}
          activeOpacity={0.75}
        >
          <Ionicons name="menu" size={20} color={colors.primary} />
        </TouchableOpacity>

        {/* Avatar icon */}
        <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}18` }]}>
          <Ionicons name="chatbubbles" size={20} color={colors.primary} />
        </View>

        {/* Title + subtitle */}
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {session?.title || 'AI Chat'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            On-device · Private
          </Text>
        </View>

        {/* Status badge */}
        <View style={[
          styles.statusBadge,
          { backgroundColor: `${statusColor}15`, borderColor: `${statusColor}40` }
        ]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Ionicons name={statusIcon} size={12} color={statusColor} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 10 : 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sideBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Sora-Bold',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Sora-Medium',
    opacity: 0.65,
    letterSpacing: 0.2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
    fontFamily: 'Sora-Bold',
    letterSpacing: 0.3,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  stopLabel: {
    fontSize: 11,
    fontFamily: 'Sora-Bold',
    letterSpacing: 0.3,
  },
});

export default ChatHeader;
