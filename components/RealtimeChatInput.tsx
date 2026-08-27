import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AudioRecord from 'react-native-audio-record';
import { Ionicons } from '@expo/vector-icons';
import { RealtimeTranscriptionResult, whisperService } from '../services/whisperService';
import { ttsService } from '../services/ttsService';
import { useStores } from './StoreProvider';
import { cleanTranscript } from '../utils/chat';

// Single animated bar for speech waveform visualizer
const VoiceWaveBar: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 320 + delay, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.25, duration: 320 + delay, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay]);

  return (
    <Animated.View
      style={{
        width: 3.5,
        height: 16,
        borderRadius: 2,
        backgroundColor: color,
        transform: [{ scaleY: anim }],
        marginHorizontal: 1.5,
      }}
    />
  );
};

// Waveform equalizer bars group
const VoiceWaveEqualizer: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', height: 20, paddingHorizontal: 2 }}>
    <VoiceWaveBar delay={0} color={color} />
    <VoiceWaveBar delay={120} color={color} />
    <VoiceWaveBar delay={240} color={color} />
    <VoiceWaveBar delay={80} color={color} />
    <VoiceWaveBar delay={180} color={color} />
  </View>
);

// Pulsing ring around the recording button
const PulseMicRing: React.FC<{ color: string }> = ({ color }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.7, duration: 1100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
};

interface RealtimeChatInputProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  colors: any;
  placeholder?: string;
  isModelLoaded?: boolean;
  onModelNotLoadedPress?: () => void;
}

const RealtimeChatInput: React.FC<RealtimeChatInputProps> = ({
  onSendMessage,
  isLoading,
  colors,
  placeholder,
  isModelLoaded = true,
  onModelNotLoadedPress,
}) => {
  const { chatSessionStore } = useStores();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [textInput, setTextInput] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const recording = useRef<boolean>(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const audioInterval = useRef<number | null>(null);
  const silenceThreshold = 0.01;
  const silenceDuration = 1000;
  const silenceTimer = useRef<any>(null);
  const messageSent = useRef(false);
  const textInputRef = useRef<TextInput>(null);

  React.useEffect(() => {
    const setupAudio = async () => {
      const options = {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        wavFile: `${FileSystem.documentDirectory}recording.wav`,
      };
      AudioRecord.init(options);
      if (Platform.OS === 'android') {
        try {
          const granted = await (require('react-native').PermissionsAndroid).request(
            require('react-native').PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: 'Microphone Permission',
              message: 'This app needs access to your microphone to record audio.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
          setHasPermission(granted === require('react-native').PermissionsAndroid.RESULTS.GRANTED);
          if (granted === require('react-native').PermissionsAndroid.RESULTS.GRANTED) {
            AudioRecord.init(options);
          }
        } catch (err) {
          setHasPermission(false);
        }
      } else {
        setHasPermission(true);
        AudioRecord.init(options);
      }
    };
    setupAudio();
    return () => {
      if (recording.current) AudioRecord.stop();
      if (audioInterval.current) clearInterval(audioInterval.current);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, []);

  React.useEffect(() => {
    if (!isLoading) {
      setIsTranscribing(false);
    }
  }, [isLoading]);

  // Safety fallback to prevent isTranscribing from ever getting stuck permanently
  React.useEffect(() => {
    if (isTranscribing) {
      const timer = setTimeout(() => {
        setIsTranscribing(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isTranscribing]);

  React.useEffect(() => {
    const initWhisper = async () => {
      try {
        if (whisperService.isWhisperAvailable() && !whisperService.isModelLoaded()) {
          await whisperService.initialize();
        }
      } catch (error) {
        console.error('RealtimeChatInput: Failed to initialize Whisper:', error);
      }
    };
    initWhisper();
  }, []);

  const handleSendText = () => {
    const trimmed = textInput.trim();
    if (!trimmed || isLoading) return;
    setTextInput('');
    onSendMessage(trimmed);
  };

  const startRecording = async () => {
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please grant microphone permission to record audio.');
      return;
    }
    textInputRef.current?.blur();
    setTextInput('');
    setIsRecording(true);
    setIsTranscribing(false);
    setTranscription('');
    recording.current = true;
    messageSent.current = false;

    try {
      // Stop TTS first to release the Android audio session before Whisper claims it
      try {
        await ttsService.stop();
        // Give the audio system 300ms to fully release before Whisper takes over
        await new Promise((res) => setTimeout(res, 300));
      } catch (e) {
        console.warn('RealtimeChatInput: Could not stop TTS before recording:', e);
      }
      try {
        await whisperService.stopRealtimeTranscription();
      } catch (e) {
        whisperService.resetRealtimeState && whisperService.resetRealtimeState();
      }
      try {
        await whisperService.startRealtimeTranscription({
          onTranscriptionUpdate: (result: RealtimeTranscriptionResult) => {
            const cleaned = cleanTranscript(result.text);
            if (cleaned) {
              setTranscription(cleaned);
              chatSessionStore.updateTranscriptionMessage(cleaned, result.isFinal);
            } else {
              setTranscription('');
              chatSessionStore.clearTranscriptionMessage();
            }
            if (result.isFinal && cleaned && !messageSent.current) {
              messageSent.current = true;
              chatSessionStore.clearTranscriptionMessage();
              recording.current = false;
              setIsRecording(false);
              setIsTranscribing(false);
              setTranscription('');
              onSendMessage(cleaned);
            }
          },
          onError: (error: Error) => {
            console.error('Realtime transcription error:', error);
            whisperService.resetRealtimeState && whisperService.resetRealtimeState();
            setIsTranscribing(false);
          },
          onComplete: (finalResult) => {
            console.log('Realtime transcription completed:', finalResult);
            setIsTranscribing(false);
          },
        });
      } catch (error) {
        console.log('Realtime transcription not available, using batch processing:', error);
      }

      await AudioRecord.start();
      AudioRecord.on('data', (data) => {
        if (!recording.current) return;
        const raw = atob(data);
        const len = raw.length;
        let sum = 0;
        let samples = 0;
        for (let i = 0; i < len; i += 2) {
          const lo = raw.charCodeAt(i);
          const hi = raw.charCodeAt(i + 1);
          let val = (hi << 8) | lo;
          if (val >= 0x8000) val = val - 0x10000;
          const norm = val / 32768;
          sum += norm * norm;
          samples++;
        }
        const rms = samples > 0 ? Math.sqrt(sum / samples) : 0;
        if (rms < silenceThreshold) {
          if (!silenceTimer.current) {
            silenceTimer.current = setTimeout(() => {
              if (recording.current) stopRecording();
            }, silenceDuration);
          }
        } else {
          if (silenceTimer.current) {
            clearTimeout(silenceTimer.current);
            silenceTimer.current = null;
          }
        }
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Recording Error', 'Failed to start audio recording.');
      setIsRecording(false);
      setIsTranscribing(false);
      recording.current = false;
    }
  };

  const stopRecording = async () => {
    if (!recording.current) return;
    setIsRecording(false);
    recording.current = false;
    setIsTranscribing(true);
    if (audioInterval.current) {
      clearInterval(audioInterval.current);
      audioInterval.current = null;
    }
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
    try {
      const audioFile = await AudioRecord.stop();
      if (!audioFile) throw new Error('No audio file URI available');
      try {
        await whisperService.stopRealtimeTranscription();
        await new Promise((res) => setTimeout(res, 150));
      } catch (error) {
        console.log('Real-time transcription was not active:', error);
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Recording Error', 'Failed to stop audio recording.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const isBusy = isLoading || isTranscribing;
  const hasText = textInput.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Top divider line */}
      <View style={[styles.topDivider, { backgroundColor: colors.border }]} />

      {/* Status banner for voice recording and transcription */}
      {(isRecording || isTranscribing) && (
        <View
          style={[
            styles.statusRow,
            {
              backgroundColor: isRecording ? `${colors.error}14` : `${colors.primary}12`,
              borderColor: isRecording ? `${colors.error}35` : `${colors.primary}30`,
              borderWidth: 1,
            },
          ]}
        >
          {isRecording ? (
            <View style={styles.statusInner}>
              <VoiceWaveEqualizer color={colors.error} />
              <Text style={[styles.statusText, { color: colors.error }]}>Listening… speak clearly or tap ■</Text>
            </View>
          ) : (
            <View style={styles.statusInner}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[styles.statusText, { color: colors.primary }]}>Processing voice input…</Text>
            </View>
          )}
        </View>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        {/* Pill-shaped text box */}
        {!isModelLoaded ? (
          <TouchableOpacity
            style={[
              styles.textInputWrapper,
              {
                backgroundColor: colors.surfaceMuted ?? colors.background ?? '#f4f7f4',
                borderColor: colors.border,
                shadowColor: colors.shadow ?? '#000',
              },
            ]}
            onPress={onModelNotLoadedPress}
            activeOpacity={0.7}
          >
            <Text style={[styles.textInput, { color: colors.muted }]}>
              {placeholder ?? 'Load a model first'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.textInputWrapper,
              {
                backgroundColor: isRecording ? `${colors.error}08` : (colors.surfaceMuted ?? colors.background ?? '#f4f7f4'),
                borderColor: isRecording ? colors.error : isTranscribing ? colors.primary : colors.border,
                shadowColor: isRecording ? colors.error : (colors.shadow ?? '#000'),
              },
            ]}
          >
            <TextInput
              ref={textInputRef}
              style={[styles.textInput, { color: colors.text }]}
              placeholder={isRecording ? 'Listening…' : (placeholder ?? 'Type a message…')}
              placeholderTextColor={colors.muted}
              value={isRecording ? transcription : textInput}
              onChangeText={isRecording ? undefined : setTextInput}
              editable={!isRecording && !isBusy}
              multiline
              maxLength={1000}
              returnKeyType="default"
              blurOnSubmit={false}
            />
          </View>
        )}

        {/* Send button (visible when text typed) */}
        {hasText && !isRecording && isModelLoaded && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.sendButton,
              { backgroundColor: colors.primary, shadowColor: colors.primary },
              isBusy && styles.disabledButton,
            ]}
            onPress={handleSendText}
            disabled={isBusy}
            activeOpacity={0.75}
          >
            <Ionicons name="arrow-up" size={22} color={colors.onPrimary ?? '#fff'} />
          </TouchableOpacity>
        )}

        {/* Mic / Stop button */}
        {(!hasText || isRecording || !isModelLoaded) && (
          <View style={{ justifyContent: 'center', alignItems: 'center' }}>
            {isRecording && <PulseMicRing color={colors.error} />}
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.micButton,
                {
                  backgroundColor: isRecording ? colors.error : colors.primary,
                  shadowColor: isRecording ? colors.error : colors.primary,
                },
                isBusy && !isRecording && isModelLoaded && styles.disabledButton,
              ]}
              onPress={!isModelLoaded ? onModelNotLoadedPress : isRecording ? stopRecording : startRecording}
              disabled={isBusy && !isRecording && isModelLoaded}
              activeOpacity={0.75}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={isRecording ? 20 : 22}
                color={isRecording ? '#fff' : (colors.onPrimary ?? '#fff')}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 0,
    paddingBottom: Platform.OS === 'ios' ? 6 : 12,
    // Elevation handled by shadow on wrapper
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 12,
  },
  topDivider: {
    height: 1,
    marginBottom: 10,
    opacity: 0.6,
  },
  statusRow: {
    marginHorizontal: 2,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  statusInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Sora-SemiBold',
    letterSpacing: 0.2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingBottom: 2,
  },
  textInputWrapper: {
    flex: 1,
    minHeight: 52,
    maxHeight: 124,
    borderRadius: 26,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === 'ios' ? 13 : 9,
    justifyContent: 'center',
    // Inner glow / depth
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  textInput: {
    fontSize: 15,
    fontFamily: 'Sora-Medium',
    lineHeight: 22,
    maxHeight: 100,
    paddingTop: 0,
    paddingBottom: 0,
    textAlignVertical: 'center',
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  micButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  disabledButton: {
    opacity: 0.45,
  },
});

export default RealtimeChatInput;
