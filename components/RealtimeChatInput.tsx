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
              setTimeout(() => {
                onSendMessage(cleaned);
                setTranscription('');
                // Clear the transcription message from store
                chatSessionStore.clearTranscriptionMessage();
                // Mark that we've already sent a message to prevent duplicate
                recording.current = false;
              }, 1000); // Small delay to show final result
            }
          },
          onError: (error: Error) => {
            console.error('Realtime transcription error:', error);
            // Don't show alert, just log and continue with batch processing
            whisperService.resetRealtimeState && whisperService.resetRealtimeState();
            console.log('Falling back to batch processing');
          },
          onComplete: (finalResult) => {
            console.log('Realtime transcription completed:', finalResult);
          }
        });
      } catch (error) {
        console.log('Realtime transcription not available, using batch processing:', error);
        // Continue with recording - will process after stop
      }

      // Start audio recording with AudioRecord
      await AudioRecord.start();
      // Silence detection
      AudioRecord.on('data', data => {
        if (!recording.current) return;
        // Decode base64 to ArrayBuffer
        const raw = atob(data);
        const len = raw.length;
        let sum = 0;
        let samples = 0;
        for (let i = 0; i < len; i += 2) {
          // Little endian 16-bit PCM
          const lo = raw.charCodeAt(i);
          const hi = raw.charCodeAt(i + 1);
          let val = (hi << 8) | lo;
          if (val >= 0x8000) val = val - 0x10000; // signed
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
    
    // Clear the audio feeding interval
    if (audioInterval.current) {
      clearInterval(audioInterval.current);
      audioInterval.current = null;
    }
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
    
    try {
      // Stop audio recording
      const audioFile = await AudioRecord.stop();
      
      if (!audioFile) {
        throw new Error('No audio file URI available');
      }
      
      // Stop real-time transcription (if it was started)
      try {
        await whisperService.stopRealtimeTranscription();
        await new Promise(res => setTimeout(res, 200)); // Ensure context is released
      } catch (error) {
        console.log('Real-time transcription was not active:', error);
      }
      
      // Only process the recorded audio file if real-time transcription didn't already send a message
      // if (audioFile && !transcription.trim() && !messageSent.current) {
      //   setIsTranscribing(true);
      //   try {
      //     const result = await whisperService.transcribe(audioFile);
      //     let text = result.text?.trim() || '';
      //     if (!text && Array.isArray(result.segments) && result.segments.length > 0) {
      //       text = result.segments.map(seg => seg.text).join(' ').trim();
      //     }
      //     if (text) {
      //       messageSent.current = true;
      //       onSendMessage(text);
      //     } else {
      //       Alert.alert('No speech detected', 'Try speaking more clearly.');
      //     }
      //   } catch (err) {
      //     Alert.alert('Transcription Error', 'Failed to transcribe audio.');
      //   } finally {
      //     setIsTranscribing(false);
      //   }
      // }
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Recording Error', 'Failed to stop audio recording.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>  
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={[
            styles.micButton,
            isRecording ? styles.micButtonActive : {},
            { backgroundColor: isRecording ? colors.error : colors.primary },
          ]}
          onPress={isRecording ? undefined : startRecording}
          disabled={isLoading || isTranscribing || isRecording}
        >
          <Text style={styles.micIcon}>{'🎤'}</Text>
        </TouchableOpacity>
        {isRecording && (
          <View style={styles.pulseContainer}>
            <View style={styles.pulseDot} />
          </View>
        )}
        {isTranscribing && (
          <View style={styles.transcribingContainer}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={[styles.statusText, { color: colors.primary }]}>Transcribing...</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  micButtonActive: {
    backgroundColor: '#dc2626',
  },
  micIcon: {
    fontSize: 24,
    color: 'white',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  transcribingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  pulseContainer: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
  },
  pulseDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    opacity: 0.8,
    // Animation will be added below
  },

});

export default RealtimeChatInput; 