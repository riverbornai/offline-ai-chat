import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import WhisperSpeechToText from '../../components/WhisperSpeechToText';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Section */}
        <View style={[styles.headerCard, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            Speech-to-Text App
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Transform your voice into text with AI-powered transcription
          </Text>
        </View>

        
        {/* Speech to Text Section */}
        <WhisperSpeechToText />

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerCard: {
    borderRadius: 20,
    padding: 24,
    margin: 16,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
    elevation: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  featuresCard: {
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginTop: 8,
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
    elevation: 8,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  bottomSpacing: {
    height: 20,
  },
});
