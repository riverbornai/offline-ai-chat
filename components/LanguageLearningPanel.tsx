import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LanguageLearningSettings } from '../stores/ChatSessionStore';
import { languageLearningUtils } from '../utils/chat';

interface LanguageLearningPanelProps {
  settings: LanguageLearningSettings;
  onSettingsChange: (settings: Partial<LanguageLearningSettings>) => void;
  onClose: () => void;
  colors: any;
}

const LanguageLearningPanel: React.FC<LanguageLearningPanelProps> = ({
  settings,
  onSettingsChange,
  onClose,
  colors,
}) => {
  const supportedLanguages = languageLearningUtils.getSupportedLanguages();
  const levels = ['beginner', 'intermediate', 'advanced'] as const;
  const corrections = ['always', 'sometimes', 'never'] as const;
  const focusAreas = [
    'conversation',
    'grammar',
    'vocabulary',
    'pronunciation',
    'reading',
    'writing',
    'listening',
    'cultural understanding',
  ];

  const renderLanguageSelector = (
    title: string,
    value: string,
    onSelect: (language: string) => void
  ) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalScroll}
      >
        {supportedLanguages.map((language) => (
          <TouchableOpacity
            key={language}
            style={[
              styles.optionButton,
              {
                backgroundColor: value === language ? colors.primary : colors.background,
                borderColor: colors.border,
              },
            ]}
            onPress={() => onSelect(language)}
          >
            <Text
              style={[
                styles.optionText,
                {
                  color: value === language ? colors.surface : colors.text,
                },
              ]}
            >
              {language}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderLevelSelector = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Learning Level</Text>
      <View style={styles.optionsRow}>
        {levels.map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.optionButton,
              {
                backgroundColor: settings.learningLevel === level ? colors.primary : colors.background,
                borderColor: colors.border,
              },
            ]}
            onPress={() => onSettingsChange({ learningLevel: level })}
          >
            <Text
              style={[
                styles.optionText,
                {
                  color: settings.learningLevel === level ? colors.surface : colors.text,
                },
              ]}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.description, { color: colors.muted }]}>
        {languageLearningUtils.getDifficultyDescription(settings.learningLevel)}
      </Text>
    </View>
  );

  const renderCorrectionSelector = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Correction Preference</Text>
      <View style={styles.optionsRow}>
        {corrections.map((correction) => (
          <TouchableOpacity
            key={correction}
            style={[
              styles.optionButton,
              {
                backgroundColor: settings.correctionPreference === correction ? colors.primary : colors.background,
                borderColor: colors.border,
              },
            ]}
            onPress={() => onSettingsChange({ correctionPreference: correction })}
          >
            <Text
              style={[
                styles.optionText,
                {
                  color: settings.correctionPreference === correction ? colors.surface : colors.text,
                },
              ]}
            >
              {correction.charAt(0).toUpperCase() + correction.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderFocusAreas = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Focus Areas</Text>
      <View style={styles.focusAreasContainer}>
        {focusAreas.map((area) => (
          <TouchableOpacity
            key={area}
            style={[
              styles.focusAreaButton,
              {
                backgroundColor: settings.focusAreas.includes(area) ? colors.primary : colors.background,
                borderColor: colors.border,
              },
            ]}
            onPress={() => {
              const newFocusAreas = settings.focusAreas.includes(area)
                ? settings.focusAreas.filter(f => f !== area)
                : [...settings.focusAreas, area];
              onSettingsChange({ focusAreas: newFocusAreas });
            }}
          >
            <Text
              style={[
                styles.focusAreaText,
                {
                  color: settings.focusAreas.includes(area) ? colors.surface : colors.text,
                },
              ]}
            >
              {area}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Language Learning Settings</Text>
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: colors.background }]}
          onPress={onClose}
        >
          <Text style={[styles.closeButtonText, { color: colors.text }]}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderLanguageSelector(
          'Target Language (Learning)',
          settings.targetLanguage,
          (language) => onSettingsChange({ targetLanguage: language })
        )}

        {renderLanguageSelector(
          'Native Language',
          settings.nativeLanguage,
          (language) => onSettingsChange({ nativeLanguage: language })
        )}

        {renderLevelSelector()}
        {renderCorrectionSelector()}
        {renderFocusAreas()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxHeight: '70%',
    margin: 16,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  horizontalScroll: {
    marginHorizontal: -4,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  description: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  focusAreasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  focusAreaButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  focusAreaText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default LanguageLearningPanel; 