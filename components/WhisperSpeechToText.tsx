import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WHISPER_CONFIG } from '../config/whisperConfig';
import { WhisperResult, whisperService } from '../services/whisperService';

const WhisperSpeechToText: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [transcriptionHistory, setTranscriptionHistory] = useState<string[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelPath, setModelPath] = useState<string | null>(null);

  const recording = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    setupAudio();
    setupWhisper();
    return () => {
      if (recording.current) {
        recording.current.stopAndUnloadAsync();
      }
      whisperService.cleanup();
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
      setModelProgress(0);
      
      // Initialize custom Whisper service
      await whisperService.initialize();
      
      setModelLoaded(true);
      setModelProgress(100);
      setModelPath(whisperService.getModelPath());
      
    } catch (error) {
      console.error('Error initializing Whisper:', error);
      Alert.alert(
        'Whisper Initialization Error', 
        'Failed to initialize Whisper model. Please check your internet connection and try again.'
      );
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
          Alert.alert(
            'Permission Required', 
            'Microphone permission is required to record audio. Please grant permission in your device settings.'
          );
          return;
        }
      }

      if (!modelLoaded) {
        Alert.alert('Error', 'Whisper model not loaded. Please wait for initialization to complete.');
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
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
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
    if (!modelLoaded) {
      Alert.alert('Error', 'Whisper model not loaded');
      return;
    }

    try {
      setIsTranscribing(true);
      
      // Transcribe audio using custom Whisper service
      const result: WhisperResult = await whisperService.transcribe(audioPath);
      
      if (result && result.text) {
        const transcribedText = result.text.trim();
        setTranscription(transcribedText);
        setTranscriptionHistory(prev => [...prev, transcribedText]);
      } else {
        setTranscription('No speech detected');
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      Alert.alert(
        'Transcription Error', 
        'Failed to transcribe audio. Please try again with a clearer recording.'
      );
      setTranscription('Transcription failed');
    } finally {
      setIsTranscribing(false);
    }
  };

  const clearHistory = () => {
    setTranscriptionHistory([]);
    setTranscription('');
  };

  const retryModelLoad = () => {
    setupWhisper();
  };

  if (isModelLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading Custom Whisper Model...</Text>
          <Text style={styles.loadingSubtext}>
            Initializing {WHISPER_CONFIG.modelName}
          </Text>
          {modelProgress > 0 && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${modelProgress}%` }]} />
              <Text style={styles.progressText}>{modelProgress}%</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  if (!modelLoaded) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Model Loading Failed</Text>
          <Text style={styles.errorText}>
            Unable to load the Whisper model. This could be due to network issues or insufficient storage.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={retryModelLoad}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Speech to Text</Text>
        <Text style={styles.subtitle}>Custom Whisper Model</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Model: {WHISPER_CONFIG.modelName} ✓</Text>
        </View>
        {modelPath && (
          <Text style={styles.modelPathText}>Path: {modelPath}</Text>
        )}
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
            {isRecording ? '🛑 Stop Recording' : '🎤 Start Recording'}
          </Text>
        </TouchableOpacity>

        {isTranscribing && (
          <View style={styles.transcribingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.transcribingText}>Transcribing with custom model...</Text>
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
            <Text style={styles.transcriptionLabel}>Latest Transcription:</Text>
            <Text style={styles.transcriptionText}>{transcription}</Text>
          </View>
        )}

        {transcriptionHistory.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyLabel}>History:</Text>
            {transcriptionHistory.map((text, index) => (
              <View key={index} style={styles.historyItem}>
                <Text style={styles.historyNumber}>{index + 1}.</Text>
                <Text style={styles.historyText}>{text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Permission: {hasPermission ? 'Granted ✓' : 'Not Granted ✗'}
        </Text>
        <Text style={styles.footerText}>
          Platform: {Platform.OS}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    color: '#1e293b',
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  progressContainer: {
    width: '100%',
    marginTop: 20,
    alignItems: 'center',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#007AFF',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    color: '#64748b',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },
  modelPathText: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
  },
  controlsContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  recordButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 25,
    minWidth: 220,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordingButton: {
    backgroundColor: '#dc2626',
    shadowColor: '#dc2626',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0.1,
  },
  recordButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  transcribingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  transcribingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1e40af',
    fontWeight: '500',
  },
  clearButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f59e0b',
    borderRadius: 20,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  transcriptionContainer: {
    flex: 1,
    marginBottom: 20,
  },
  currentTranscription: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  transcriptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  transcriptionText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  historyContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  historyItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  historyNumber: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
    marginRight: 8,
    minWidth: 20,
  },
  historyText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerText: {
    fontSize: 12,
    color: '#64748b',
  },
});

export default WhisperSpeechToText; 