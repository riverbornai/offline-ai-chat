import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

interface RealtimeChatInputProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  colors: any;
  placeholder?: string;
}

const RealtimeChatInput: React.FC<RealtimeChatInputProps> = ({
  onSendMessage,
  isLoading,
  colors,
  placeholder,
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
            setTranscription(result.text);
            chatSessionStore.updateTranscriptionMessage(result.text, result.isFinal);
            let cleaned = result.text.replace(/\[BLANK_AUDIO\]/gi, '').trim();
            if (result.isFinal && cleaned && !messageSent.current) {
              messageSent.current = true;
              chatSessionStore.clearTranscriptionMessage();
              onSendMessage(cleaned);
              setTranscription('');
              recording.current = false;
            }
          },
          onError: (error: Error) => {
            console.error('Realtime transcription error:', error);
            whisperService.resetRealtimeState && whisperService.resetRealtimeState();
          },
          onComplete: (finalResult) => {
            console.log('Realtime transcription completed:', finalResult);
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
      recording.current = false;
    }
  };

  const stopRecording = async () => {
    if (!recording.current) return;
    setIsRecording(false);
    recording.current = false;
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
        await new Promise((res) => setTimeout(res, 200));
      } catch (error) {
        console.log('Real-time transcription was not active:', error);
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Recording Error', 'Failed to stop audio recording.');
    }
  };

  const isBusy = isLoading || isTranscribing;
  const hasText = textInput.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {(isRecording || isTranscribing || isLoading) && (
        <View style={styles.statusRow}>
          {isRecording ? (
            <View style={styles.statusInner}>
              <View style={[styles.pulseDot, { backgroundColor: colors.error }]} />
              <Text style={[styles.statusText, { color: colors.error }]}>Listening...</Text>
            </View>
          ) : isTranscribing ? (
            <View style={styles.statusInner}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[styles.statusText, { color: colors.primary }]}>Processing voice...</Text>
            </View>
          ) : (
            <View style={styles.statusInner}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[styles.statusText, { color: colors.primary }]}>AI is thinking...</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.inputRow}>
        <View
          style={[
            styles.textInputWrapper,
            { backgroundColor: colors.background ?? '#f8faf7', borderColor: colors.border },
          ]}
        >
          <TextInput
            ref={textInputRef}
            style={[styles.textInput, { color: colors.text }]}
            placeholder={isRecording ? 'Listening...' : (placeholder ?? 'Type a message...')}
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

        {hasText && !isRecording && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
            onPress={handleSendText}
            disabled={isBusy}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={22} color={'#fff'} />
          </TouchableOpacity>
        )}

        {(!hasText || isRecording) && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: isRecording ? colors.error : colors.primary,
                shadowColor: isRecording ? colors.error : colors.primary,
              },
              isBusy && !isRecording && styles.disabledButton,
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isBusy && !isRecording}
            activeOpacity={0.8}
          >
            <Ionicons name={isRecording ? 'stop' : 'mic'} size={24} color={'#fff'} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  statusRow: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  statusInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontFamily: 'Sora-Bold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  textInputWrapper: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 15,
    fontFamily: 'Sora-Medium',
    lineHeight: 22,
    maxHeight: 100,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default RealtimeChatInput;
