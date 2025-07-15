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

  // Setup audio recorder on mount
  React.useEffect(() => {
    const setupAudio = async () => {
      const options = {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        wavFile: 'recording.wav',
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
        } catch (err) {
          setHasPermission(false);
        }
      } else {
        setHasPermission(true);
      }
    };
    setupAudio();
    return () => {
      if (recording.current) AudioRecord.stop();
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
    await AudioRecord.start();
  };

  const stopRecording = async () => {
    if (!recording.current) return;
    setIsRecording(false);
    recording.current = false;
    const audioFile = await AudioRecord.stop();
    if (audioFile) {
      setIsTranscribing(true);
      try {
        const result = await whisperService.transcribe(audioFile);
        let text = result.text?.trim() || '';
        if (!text && Array.isArray(result.segments) && result.segments.length > 0) {
          text = result.segments.map(seg => seg.text).join(' ').trim();
        }
        setTranscription(text);
        if (text) {
          setTimeout(() => {
            onSendMessage(text);
            setTranscription('');
          }, 800); // show briefly
        } else {
          Alert.alert('No speech detected', 'Try speaking more clearly.');
        }
      } catch (err) {
        Alert.alert('Transcription Error', 'Failed to transcribe audio.');
      } finally {
        setIsTranscribing(false);
      }
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