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
import { whisperService } from '../services/whisperService';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  colors: any;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  colors,
  placeholder,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const recording = useRef<boolean>(false);
  const audioInterval = useRef<number | null>(null);

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
    
    try {
      // Start audio recording
      await AudioRecord.start();
      console.log('Recording started - will process after stop');
      
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
    
    try {
      // Stop audio recording
      const audioFile = await AudioRecord.stop();
      
      // Process the recorded audio file
      if (audioFile) {
        setIsTranscribing(true);
        try {
          const result = await whisperService.transcribe(audioFile);
          let text = result.text?.trim() || '';
          if (!text && Array.isArray(result.segments) && result.segments.length > 0) {
            text = result.segments.map(seg => seg.text).join(' ').trim();
          }
          if (text) {
            onSendMessage(text);
          } else {
            Alert.alert('No speech detected', 'Try speaking more clearly.');
          }
        } catch (err) {
          Alert.alert('Transcription Error', 'Failed to transcribe audio.');
        } finally {
          setIsTranscribing(false);
        }
      }
      
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
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isLoading || isTranscribing}
        >
          <Text style={styles.micIcon}>{isRecording ? '🛑' : '🎤'}</Text>
        </TouchableOpacity>
        {isRecording && (
          <Text style={[styles.statusText, { color: colors.error }]}>Recording...</Text>
        )}
        {isTranscribing && (
          <View style={styles.transcribingContainer}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={[styles.statusText, { color: colors.primary }]}>Transcribing...</Text>
          </View>
        )}
        {transcription ? (
          <Text style={[styles.transcriptionText, { color: colors.text }]}>{transcription}</Text>
        ) : null}
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
  transcriptionText: {
    fontSize: 16,
    marginLeft: 12,
    fontStyle: 'italic',
    maxWidth: 180,
  },
});

export default ChatInput; 