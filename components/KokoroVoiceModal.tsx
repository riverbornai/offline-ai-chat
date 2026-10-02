import { Ionicons } from '@expo/vector-icons';
import { observer } from 'mobx-react';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { KOKORO_VOICES, KokoroVoice, getKokoroVoiceDisplayName } from '../constants/kokoroVoices';
import { useColorScheme } from '../hooks/useColorScheme';
import { ttsService } from '../services/ttsService';
import { modelStore } from '../stores/ModelStore';

interface KokoroVoiceModalProps {
  visible: boolean;
  onClose: () => void;
}

export const KokoroVoiceModal = observer(({ visible, onClose }: KokoroVoiceModalProps) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [playingVoiceId, setPlayingVoiceId] = useState<number | null>(null);

  const activeVoiceId = modelStore.activeKokoroSpeakerId ?? 0;

  const handleSelectVoice = (voiceId: number) => {
    modelStore.setKokoroSpeakerId(voiceId);
  };

  const handlePreviewVoice = async (voice: KokoroVoice) => {
    try {
      if (playingVoiceId === voice.id) {
        await ttsService.stop();
        setPlayingVoiceId(null);
        return;
      }

      setPlayingVoiceId(voice.id);
      await ttsService.previewVoice(voice.id, voice.name);
    } catch (error) {
      console.warn('Voice preview error:', error);
    } finally {
      setPlayingVoiceId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconContainer, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="volume-high" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Kokoro Voice Models</Text>
                <Text style={[styles.headerSubtitle, { color: colors.muted }]}>Choose active speaker voice</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Voice List */}
          <ScrollView style={styles.voiceList} showsVerticalScrollIndicator={false}>
            {KOKORO_VOICES.map((voice) => {
              const isSelected = activeVoiceId === voice.id;
              const isPlaying = playingVoiceId === voice.id;

              return (
                <TouchableOpacity
                  key={voice.id}
                  style={[
                    styles.voiceItem,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? `${colors.primary}0D` : colors.surface,
                    },
                  ]}
                  onPress={() => handleSelectVoice(voice.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.voiceItemLeft}>
                    <View
                      style={[
                        styles.radioCircle,
                        {
                          borderColor: isSelected ? colors.primary : colors.muted,
                          backgroundColor: isSelected ? colors.primary : 'transparent',
                        },
                      ]}
                    >
                      {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
                    </View>
                    <View style={styles.voiceDetails}>
                      <Text style={[styles.voiceName, { color: colors.text, fontWeight: isSelected ? '700' : '500' }]}>
                        {getKokoroVoiceDisplayName(voice)}
                      </Text>
                      <View style={styles.badgeRow}>
                        <View style={[styles.badge, { backgroundColor: voice.gender === 'Female' ? '#EC489918' : '#3B82F618' }]}>
                          <Text style={[styles.badgeText, { color: voice.gender === 'Female' ? '#EC4899' : '#3B82F6' }]}>
                            {voice.gender === 'Female' ? '♀ Female' : '♂ Male'}
                          </Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: `${colors.primary}12` }]}>
                          <Text style={[styles.badgeText, { color: colors.primary }]}>
                            {voice.accent === 'American' ? '🇺🇸 American' : '🇬🇧 British'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.previewButton,
                      {
                        backgroundColor: isPlaying ? colors.warning : `${colors.primary}15`,
                      },
                    ]}
                    onPress={() => handlePreviewVoice(voice)}
                    activeOpacity={0.7}
                  >
                    {isPlaying ? (
                      <ActivityIndicator size="small" color={colors.surface} />
                    ) : (
                      <Ionicons name="volume-medium" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer Done Button */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.primary }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Sora-Bold',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Sora-Medium',
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
  },
  voiceList: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  voiceItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceDetails: {
    flex: 1,
  },
  voiceName: {
    fontSize: 15,
    fontFamily: 'Sora-Bold',
    marginBottom: 4,
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
    fontSize: 11,
    fontFamily: 'Sora-Medium',
  },
  previewButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  doneButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Sora-Bold',
  },
});
