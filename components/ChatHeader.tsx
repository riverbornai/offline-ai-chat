import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Platform,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatSession } from '../stores/ChatSessionStore';

interface ChatHeaderProps {
  session?: ChatSession;
  colors: any;
  modelReady?: boolean;
  isSpeaking?: boolean;
  onStopTTS?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  session,
  colors,
  modelReady = false,
  isSpeaking = false,
  onStopTTS,
}) => {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;

    const checkConnectivity = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        await fetch('https://1.1.1.1', { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        if (mounted) setIsOnline(true);
      } catch {
        if (mounted) setIsOnline(false);
      }
    };

    checkConnectivity();
    const interval = setInterval(checkConnectivity, 8000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // Pulse animation for offline dot
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    if (isOnline === false) {
      pulse.start();
    } else {
      pulse.stop();
      pulseAnim.setValue(1);
    }
    return () => pulse.stop();
  }, [isOnline]);

  // Status config
  let statusColor: string;
  let statusLabel: string;
  let statusIconName: any;

  if (isOnline === false) {
    statusColor = '#ef4444';
    statusLabel = 'Offline';
    statusIconName = 'cloud-offline-outline';
  } else if (!modelReady) {
    statusColor = '#f59e0b';
    statusLabel = 'Load Model';
    statusIconName = 'warning-outline';
  } else {
    statusColor = '#10b981';
    statusLabel = 'Online';
    statusIconName = 'wifi';
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.headerRow}>
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
          <Animated.View
            style={[styles.statusDot, { backgroundColor: statusColor, opacity: isOnline === false ? pulseAnim : 1 }]}
          />
          <Ionicons name={statusIconName} size={12} color={statusColor} />
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 14,
    paddingBottom: 14,
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
    gap: 12,
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
