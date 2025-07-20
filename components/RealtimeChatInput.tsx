import { Audio } from 'expo-av';
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
import { RealtimeTranscriptionResult, whisperService } from '../services/whisperService';

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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const recording = useRef<boolean>(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const audioInterval = useRef<number | null>(null);

  // Setup audio recorder on mount
  React.useEffect(() => {
    const setupAudio = async () => {
      try {
        // Request audio recording permissions
        const { status } = await Audio.requestPermissionsAsync();
        const hasPermission = status === 'granted';
        setHasPermission(hasPermission);
        console.log('Audio permission status:', status);
        
        if (hasPermission) {
          // Configure audio mode for recording
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          console.log('Audio mode configured for recording');
        }
      } catch (error) {
        console.error('Error setting up audio recorder:', error);
        setHasPermission(false);
      }
    };
    setupAudio();
    return () => {
      if (recording.current && recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
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
      // Start real-time transcription (if available)
      try {
        await whisperService.startRealtimeTranscription({
          onTranscriptionUpdate: (result: RealtimeTranscriptionResult) => {
            setTranscription(result.text);
            if (result.isFinal && result.text.trim()) {
              // Auto-send when transcription is final and has content
              setTimeout(() => {
                onSendMessage(result.text.trim());
                setTranscription('');
              }, 1000); // Small delay to show final result
            }
          },
          onError: (error: Error) => {
            console.error('Realtime transcription error:', error);
            // Don't show alert, just log and continue with batch processing
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

      // Start audio recording with Expo AV
      try {
        console.log('Starting audio recording with Expo AV...');
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
        console.log('Audio recording started successfully');
      } catch (error) {
        console.error('Error starting audio recording:', error);
        throw error;
      }
      
      
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
      if (!recordingRef.current) {
        throw new Error('Audio recorder not initialized');
      }
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      
      if (!uri) {
        throw new Error('No audio file URI available');
      }
      
      const audioFile = uri;
      
      // Stop real-time transcription (if it was started)
      try {
        await whisperService.stopRealtimeTranscription();
      } catch (error) {
        console.log('Real-time transcription was not active:', error);
      }
      
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

export default RealtimeChatInput; 