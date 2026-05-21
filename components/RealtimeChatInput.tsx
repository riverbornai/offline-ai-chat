import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AudioRecord from 'react-native-audio-record';
import { Ionicons } from '@expo/vector-icons';
import { RealtimeTranscriptionResult, whisperService } from '../services/whisperService';
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
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const recording = useRef<boolean>(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const audioInterval = useRef<number | null>(null);
  const silenceThreshold = 0.01; // Adjust as needed
  const silenceDuration = 1000; // ms
  const silenceTimer = useRef<any>(null);
  const messageSent = useRef(false); // Prevent duplicate message sending

  // Setup audio recorder on mount
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
      if (audioInterval.current) {
        clearInterval(audioInterval.current);
      }
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, []);

  const startRecording = async () => {
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please grant microphone permission to record audio.');
      return;
    }
    
    setIsRecording(true);
    setTranscription('');
    recording.current = true;
    messageSent.current = false; // Reset flag at start
    
    try {
      // Always try to stop any previous real-time transcription before starting a new one
      try {
        await whisperService.stopRealtimeTranscription();
      } catch (e) {
        whisperService.resetRealtimeState && whisperService.resetRealtimeState();
      }
      // Start real-time transcription (if available)
      try {
        await whisperService.startRealtimeTranscription({
          onTranscriptionUpdate: (result: RealtimeTranscriptionResult) => {
            setTranscription(result.text);
            // Update transcription in chat session store
            chatSessionStore.updateTranscriptionMessage(result.text, result.isFinal);
            
            let cleaned = result.text.replace(/\[BLANK_AUDIO\]/gi, '').trim();
            if (
              result.isFinal &&
              cleaned &&
              !messageSent.current
            ) {
              messageSent.current = true;
              // Clear the transcription message BEFORE sending the final message
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
          }
        });
      } catch (error) {
        console.log('Realtime transcription not available, using batch processing:', error);
      }

      await AudioRecord.start();
      AudioRecord.on('data', data => {
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
      if (!audioFile) {
        throw new Error('No audio file URI available');
      }
      try {
        await whisperService.stopRealtimeTranscription();
        await new Promise(res => setTimeout(res, 200)); 
      } catch (error) {
        console.log('Real-time transcription was not active:', error);
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Recording Error', 'Failed to stop audio recording.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>  
      <View style={styles.inputWrapper}>
        <View style={styles.statusSection}>
          {isRecording ? (
            <View style={styles.recordingIndicator}>
              <View style={[styles.pulseDot, { backgroundColor: colors.error }]} />
              <Text style={[styles.statusText, { color: colors.error }]}>Listening...</Text>
            </View>
          ) : isTranscribing ? (
            <View style={styles.transcribingIndicator}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[styles.statusText, { color: colors.primary }]}>Processing...</Text>
            </View>
          ) : isLoading ? (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[styles.statusText, { color: colors.primary }]}>AI is thinking...</Text>
            </View>
          ) : (
            <Text style={[styles.placeholderText, { color: colors.muted }]}>
              {placeholder || 'Tap to speak...'}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.micButton,
            { 
              backgroundColor: isRecording ? colors.error : colors.primary,
              shadowColor: isRecording ? colors.error : colors.primary,
            },
            (isLoading || isTranscribing) && styles.disabledButton
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isLoading || isTranscribing}
          activeOpacity={0.8}
        >
          <Ionicons 
            name={isRecording ? 'stop' : 'mic'} 
            size={28} 
            color={colors.surface} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  statusSection: {
    flex: 1,
    height: 56,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 28,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transcribingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 15,
    fontFamily: 'Sora-Bold',
  },
  placeholderText: {
    fontSize: 15,
    fontFamily: 'Sora-Medium',
    opacity: 0.6,
  },
  micButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default RealtimeChatInput;