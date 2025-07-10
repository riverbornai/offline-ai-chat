import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ChatSession } from '../stores/ChatSessionStore';
import { LanguageLearningPromptType } from '../utils/chat';

interface ChatHeaderProps {
  session?: ChatSession;
  onSettingsPress: () => void;
  onTypeChange: (type: LanguageLearningPromptType) => void;
  currentType: LanguageLearningPromptType;
  colors: any;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  session,
  onSettingsPress,
  onTypeChange,
  currentType,
  colors,
}) => {
  const getTypeDisplayName = (type: LanguageLearningPromptType) => {
    switch (type) {
      case 'conversation':
        return 'Conversation';
      case 'translation':
        return 'Translation';
      case 'grammar':
        return 'Grammar';
      case 'vocabulary':
        return 'Vocabulary';
      case 'pronunciation':
        return 'Pronunciation';
      case 'cultural':
        return 'Cultural';
      case 'roleplay':
        return 'Roleplay';
      default:
        return 'Chat';
    }
  };

  const getTypeIcon = (type: LanguageLearningPromptType) => {
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
        return '💬';
    }
  };

  const learningTypes: LanguageLearningPromptType[] = [
    'conversation',
    'translation',
    'grammar',
    'vocabulary',
    'pronunciation',
    'cultural',
    'roleplay',
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            {session?.title || 'New Chat'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {session ? `${session.targetLanguage} • ${session.nativeLanguage}` : 'Language Learning'}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.settingsButton, { backgroundColor: colors.background }]}
          onPress={onSettingsPress}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.typesContainer}>
        {learningTypes.map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.typeButton,
              {
                backgroundColor: currentType === type ? colors.primary : colors.background,
                borderColor: colors.border,
              },
            ]}
            onPress={() => onTypeChange(type)}
          >
            <Text style={styles.typeIcon}>{getTypeIcon(type)}</Text>
            <Text
              style={[
                styles.typeText,
                {
                  color: currentType === type ? colors.surface : colors.text,
                },
              ]}
            >
              {getTypeDisplayName(type)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 16,
  },
  typesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  typeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ChatHeader; 