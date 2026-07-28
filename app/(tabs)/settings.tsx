import React from 'react';
import { StyleSheet, Text, View, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { modelStore } from '../../stores/ModelStore';
import { observer } from 'mobx-react';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { ttsService } from '../../services/ttsService';

const SettingsScreen = observer(() => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const isFocused = useIsFocused();

  // State to track loaded TTS engine (since ttsService state is not a MobX store)
  const [activeTtsId, setActiveTtsId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isFocused) return;
    const sync = () => {
      setActiveTtsId(ttsService.getIsLoaded() ? ttsService.getActiveModelId() : null);
    };
    sync();
    const interval = setInterval(sync, 1000);
    return () => clearInterval(interval);
  }, [isFocused]);

  // Read human-friendly names for active engines
  const activeLlm = modelStore.activeModel?.name || 'Tap to select';
  const activeTtsModel = modelStore.models.find(m => m.id === activeTtsId && m.type === 'tts');
  const activeTtsName = activeTtsModel ? activeTtsModel.name : 'Tap to select';

  const SettingItem = ({ 
    icon, 
    label, 
    value, 
    onPress 
  }: { 
    icon: string; 
    label: string; 
    value: string; 
    onPress?: () => void; 
  }) => {
    const Container = onPress ? TouchableOpacity : View;
    return (
      <Container 
        onPress={onPress} 
        style={[styles.item, { borderBottomColor: colors.border }]}
        activeOpacity={0.7}
      >
        <View style={styles.itemLeft}>
          <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name={icon as any} size={20} color={colors.primary} />
          </View>
          <Text style={[styles.itemLabel, { color: colors.text }]}>{label}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.itemValue, { color: colors.muted }]}>{value}</Text>
          {onPress && <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
        </View>
      </Container>
    );
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      'Reset Onboarding',
      'Are you sure you want to rerun the setup onboarding? This will allow you to download and load new models.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Release active context
              await modelStore.releaseContext();
              // Clean up voice engine
              await ttsService.cleanup();
              // Reset flag
              modelStore.setIsOnboardingComplete(false);
            } catch (err) {
              console.error('Failed to reset models:', err);
              modelStore.setIsOnboardingComplete(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>PREFERENCES</Text>
          <SettingItem icon="language" label="Target Language" value="English" />
          <SettingItem icon="person" label="Native Language" value="Spanish" />
          <SettingItem icon="trending-up" label="Learning Level" value="Intermediate" />
          <SettingItem icon="checkmark-circle" label="Corrections" value="Direct" />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>LOCAL AI & SPEECH</Text>
          <SettingItem 
            icon="chatbubbles" 
            label="AI Chat Model" 
            value={activeLlm} 
            onPress={() => router.push({ pathname: '/models', params: { initialTab: 'llm' } })}
          />
          <SettingItem 
            icon="volume-high" 
            label="Voice Engine (TTS)" 
            value={activeTtsName} 
            onPress={() => router.push({ pathname: '/models', params: { initialTab: 'tts' } })}
          />
          <SettingItem icon="mic" label="STT Engine" value="Whisper (Local)" />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>SYSTEM SETUP</Text>
          <TouchableOpacity onPress={handleResetOnboarding}>
            <SettingItem icon="refresh-circle" label="Reset & Rerun Onboarding" value="Reset" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.muted }]}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
});

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Sora-Bold',
    letterSpacing: -1,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Sora-Bold',
    letterSpacing: 1.5,
    marginBottom: 16,
    opacity: 0.8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemLabel: {
    fontSize: 16,
    fontFamily: 'Sora-Bold',
  },
  itemValue: {
    fontSize: 14,
    fontFamily: 'Sora-Medium',
  },
  footer: {
      padding: 40,
      alignItems: 'center',
  },
  footerText: {
      fontSize: 12,
      fontFamily: 'Sora-Medium',
  }
});
