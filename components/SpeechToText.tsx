import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const SpeechToText: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [transcriptionHistory, setTranscriptionHistory] = useState<string[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  const recording = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    setupAudio();
    setupWhisper();
    return () => {
      if (recording.current) {
        recording.current.stopAndUnloadAsync();
      }
    };
  }, []);

  const setupAudio = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Error setting up audio:', error);
    }
  };

  const setupWhisper = async () => {
    try {
      setIsModelLoading(true);
      // Simulate model loading
      await new Promise(resolve => setTimeout(resolve, 2000));
      setModelLoaded(true);
    } catch (error) {
      console.error('Error initializing Whisper:', error);
      Alert.alert('Error', 'Failed to initialize Whisper model');
    } finally {
      setIsModelLoading(false);
    }
  };

  const requestPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  };

  const startRecording = async () => {
    try {
      if (!hasPermission) {
        const granted = await requestPermissions();
        if (!granted) {
          Alert.alert('Permission Required', 'Microphone permission is required to record audio');
          return;
        }
      }

      if (!modelLoaded) {
        Alert.alert('Error', 'Whisper model not loaded');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

             const { recording: newRecording } = await Audio.Recording.createAsync({
         android: {
           extension: '.m4a',
           outputFormat: Audio.AndroidOutputFormat.MPEG_4,
           audioEncoder: Audio.AndroidAudioEncoder.AAC,
           sampleRate: 16000,
           numberOfChannels: 1,
           bitRate: 128000,
         },
         ios: {
           extension: '.m4a',
           outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
           audioQuality: Audio.IOSAudioQuality.HIGH,
           sampleRate: 16000,
           numberOfChannels: 1,
           bitRate: 128000,
           linearPCMBitDepth: 16,
           linearPCMIsBigEndian: false,
           linearPCMIsFloat: false,
         },
         web: {
           mimeType: 'audio/webm',
           bitsPerSecond: 128000,
         },
       });

      recording.current = newRecording;
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording.current) return;

      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();
      setIsRecording(false);

      if (uri) {
        await transcribeAudio(uri);
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
    } finally {
      recording.current = null;
    }
  };

  const transcribeAudio = async (audioPath: string) => {
    try {
      setIsTranscribing(true);
      
      // Simulate transcription delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Mock transcription result - in real implementation, this would use whisper.rn
      const mockTranscriptions = [
        "Hello, this is a test transcription.",
        "The weather is beautiful today.",
        "I'm testing the speech to text functionality.",
        "This is a demonstration of the app.",
        "Thank you for using our speech recognition app."
      ];
      
      const randomTranscription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
      setTranscription(randomTranscription);
      setTranscriptionHistory(prev => [...prev, randomTranscription]);
      
    } catch (error) {
      console.error('Error transcribing audio:', error);
      Alert.alert('Error', 'Failed to transcribe audio');
      setTranscription('Transcription failed');
    } finally {
      setIsTranscribing(false);
    }
  };

  const clearHistory = () => {
    setTranscriptionHistory([]);
    setTranscription('');
  };

  if (isModelLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading Whisper model...</Text>
          <Text style={styles.loadingSubtext}>This may take a few moments</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Speech to Text</Text>
        <Text style={styles.subtitle}>Offline transcription with Whisper</Text>
        <Text style={styles.note}>Note: This is a demo with mock transcription</Text>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordingButton,
            isTranscribing && styles.disabledButton,
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing}
        >
          <Text style={styles.recordButtonText}>
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </Text>
        </TouchableOpacity>

        {isTranscribing && (
          <View style={styles.transcribingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.transcribingText}>Transcribing...</Text>
          </View>
        )}

        {transcriptionHistory.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearHistory}>
            <Text style={styles.clearButtonText}>Clear History</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.transcriptionContainer} showsVerticalScrollIndicator={false}>
        {transcription && (
          <View style={styles.currentTranscription}>
            <Text style={styles.transcriptionLabel}>Latest:</Text>
            <Text style={styles.transcriptionText}>{transcription}</Text>
          </View>
        )}

        {transcriptionHistory.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyLabel}>History:</Text>
            {transcriptionHistory.map((text, index) => (
              <View key={index} style={styles.historyItem}>
                <Text style={styles.historyText}>{text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Model: {modelLoaded ? 'Loaded' : 'Not Loaded'}
        </Text>
        <Text style={styles.statusText}>
          Permission: {hasPermission ? 'Granted' : 'Not Granted'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2ffee', // Riverborn Frost
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontFamily: 'Sora-Bold',
    marginTop: 20,
    color: '#0d2b22', // Riverborn Forest
  },
  loadingSubtext: {
    fontSize: 14,
    fontFamily: 'Sora-Medium',
    color: '#265c48',
    marginTop: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Sora-Bold',
    color: '#0d2b22',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Sora-Medium',
    color: '#265c48',
    marginBottom: 8,
  },
  note: {
    fontSize: 12,
    fontFamily: 'Sora-Medium',
    color: '#546565',
    fontStyle: 'italic',
  },
  controlsContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  recordButton: {
    backgroundColor: '#0d2b22', // Riverborn Forest
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#0d2b22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  recordingButton: {
    backgroundColor: '#ef4444',
  },
  disabledButton: {
    backgroundColor: '#9fcebe',
  },
  recordButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Sora-Bold',
  },
  transcribingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
  },
  transcribingText: {
    marginLeft: 10,
    fontSize: 16,
    fontFamily: 'Sora-Medium',
    color: '#265c48',
  },
  clearButton: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f59e0b',
    borderRadius: 20,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Sora-Bold',
  },
  transcriptionContainer: {
    flex: 1,
    marginBottom: 20,
  },
  currentTranscription: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#0d2b22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transcriptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  transcriptionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  historyContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  historyItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  statusText: {
    fontSize: 12,
    color: '#999',
  },
});

export default SpeechToText; 