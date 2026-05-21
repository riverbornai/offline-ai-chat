import React from 'react';
import {
    StyleSheet,
    Text,
    View,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatSession } from '../stores/ChatSessionStore';

interface ChatHeaderProps {
  session?: ChatSession;
  colors: any;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  session,
  colors,
}) => {
  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.headerRow}>
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name="chatbubbles" size={20} color={colors.primary} />
          </View>
        </View>
        
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {session?.title || 'New Conversation'}
          </Text>
          {/* <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: `${colors.secondary}15` }]}>
              <Text style={[styles.badgeText, { color: colors.secondary }]}>
                {session?.targetLanguage || 'Learning'}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={10} color={colors.muted} />
            <View style={[styles.badge, { backgroundColor: `${colors.primary}15` }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                {session?.nativeLanguage || 'Native'}
              </Text>
            </View>
          </View> */}
        </View>

        <View style={[styles.statusIndicator, { backgroundColor: colors.success + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.statusText, { color: colors.success }]}>Online</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Sora-Bold',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Sora-Bold',
    textTransform: 'uppercase',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Sora-Bold',
  },
});

export default ChatHeader;
 