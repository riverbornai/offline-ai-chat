import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AudioRecord from 'react-native-audio-record';
import { WHISPER_CONFIG } from '../config/whisperConfig';
import { WhisperResult, whisperService } from '../services/whisperService';

type TabType = 'recorder' | 'upload';

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
  const [activeTab, setActiveTab] = useState<TabType>('recorder');

  const recording = useRef<boolean>(false);

  useEffect(() => {
    setupAudio();
    setupWhisper();
    return () => {
      if (recording.current) {
        AudioRecord.stop();
      }
      whisperService.cleanup();
    };
  }, []);

  const setupAudio = async () => {
    try {
      // Initialize AudioRecord with minimal settings for maximum compatibility
      const options = {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        wavFile: 'recording.wav',
      };
      
      console.log('Initializing AudioRecord with minimal options:', options);
      AudioRecord.init(options);
      
      // Request permissions
      await requestPermissions();
    } catch (error) {
      console.error('Error setting up audio:', error);
    }
  };

  const setupWhisper = async () => {
    try {
      setIsModelLoading(true);
      setModelProgress(0);
      
      // Initialize Whisper service
      await whisperService.initialize();
      
      setModelLoaded(true);
      setModelProgress(100);
      setModelPath(whisperService.getModelPath());
      
    } catch (error) {
      console.error('Error initializing Whisper:', error);
      Alert.alert(
        'Whisper Initialization Error', 
        'Failed to initialize Whisper. Please ensure whisper.rn is properly installed and configured.'
      );
    } finally {
      setIsModelLoading(false);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'This app needs access to your microphone to record audio.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.error('Error requesting microphone permission:', err);
        setHasPermission(false);
        return false;
      }
    } else {
      // iOS permissions are handled differently, usually through Info.plist
      setHasPermission(true);
      return true;
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

      console.log('Starting recording...');
      await AudioRecord.start();
      recording.current = true;
      setIsRecording(true);
      console.log('Recording started successfully');
      
      // Show a message to speak
      Alert.alert(
        'Recording Started', 
        'Please speak clearly into the microphone. Tap "Stop Recording" when done.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording.current) return;
      
      console.log('Stopping recording...');
      const audioFile = await AudioRecord.stop();
      recording.current = false;
      setIsRecording(false);

      if (audioFile) {
        console.log('Recording stopped. File saved at:', audioFile);
        console.log('File path type:', typeof audioFile);
        console.log('File path length:', audioFile.length);
        
        // Add a small delay to ensure file is fully written
        setTimeout(async () => {
          await transcribeAudio(audioFile);
        }, 1000);
      } else {
        console.error('No audio file path returned');
        Alert.alert('Recording Error', 'No audio file was created.');
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
    } finally {
      recording.current = false;
    }
  };

  const transcribeAudio = async (audioPath: string) => {
    if (!modelLoaded) {
      Alert.alert('Error', 'Whisper model not loaded');
      return;
    }

    try {
      setIsTranscribing(true);
      console.log('Starting transcription for:', audioPath);
      
      // Transcribe audio using Whisper service
      const result: WhisperResult = await whisperService.transcribe(audioPath);
      
      console.log('Transcription result:', result);
      
      let transcribedText = result.text && result.text.trim();
      if (!transcribedText && Array.isArray(result.segments) && result.segments.length > 0) {
        transcribedText = result.segments.map(seg => seg.text).join(' ').trim();
        console.log('Aggregated text from segments:', transcribedText);
      }
      if (transcribedText) {
        setTranscription(transcribedText);
        setTranscriptionHistory(prev => [...prev, transcribedText]);
      } else {
        console.log('No text in result, setting "No speech detected"');
        setTranscription('No speech detected');
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      Alert.alert(
        'Transcription Error', 
        `Failed to transcribe audio: ${errorMessage}`
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
          <ActivityIndicator size="large" color="#0d2b22" />
          <Text style={styles.loadingText}>Loading Whisper Model...</Text>
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
            Unable to load the Whisper model. Please ensure whisper.rn is properly installed and configured.
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
        <Text style={styles.subtitle}>Whisper Model</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Model: {WHISPER_CONFIG.modelName} ✓</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Status: Ready</Text>
        </View>
        {modelPath && (
          <Text style={styles.modelPathText}>Path: {modelPath}</Text>
        )}
      </View>

      {/* Controls - Only Recorder */}
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

        {isRecording && (
          <View style={styles.recordingIndicator}>
            <Text style={styles.recordingText}>🔴 Recording in progress...</Text>
          </View>
        )}

        {isTranscribing && (
          <View style={styles.transcribingContainer}>
            <ActivityIndicator size="small" color="#0d2b22" />
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
    backgroundColor: '#f2ffee', // Riverborn Frost
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
    fontFamily: 'Sora-Bold',
    marginTop: 20,
    color: '#0d2b22', // Riverborn Forest
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    fontFamily: 'Sora-Medium',
    color: '#265c48',
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
    backgroundColor: '#0d2b22', // Riverborn Forest
    borderRadius: 2,
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'Sora-Medium',
    color: '#265c48',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: 'Sora-Bold',
    color: '#ef4444',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Sora-Medium',
    color: '#546565',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#0d2b22',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Sora-Bold',
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
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#ebf5f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cce8df',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#0d2b22',
    fontFamily: 'Sora-Bold',
  },
  modelPathText: {
    fontSize: 10,
    fontFamily: 'Sora-Medium',
    color: '#6aa98c',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ebf5f1',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#0d2b22',
    elevation: 4,
  },
  inactiveTab: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontFamily: 'Sora-Bold',
    letterSpacing: 0.1,
  },
  activeTabText: {
    color: 'white',
  },
  inactiveTabText: {
    color: '#546565',
  },
  controlsContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  recordButton: {
    backgroundColor: '#0d2b22', // Riverborn Forest
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 25,
    minWidth: 220,
    alignItems: 'center',
    shadowColor: '#0d2b22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordingButton: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  disabledButton: {
    backgroundColor: '#9fcebe',
    shadowOpacity: 0.1,
  },
  recordButtonText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Sora-Bold',
  },
  recordingIndicator: {
    marginTop: 16,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingText: {
    fontSize: 14,
    color: '#ef4444',
    fontFamily: 'Sora-Medium',
  },
  uploadButton: {
    backgroundColor: '#8faa20',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    minHeight: 64,
    justifyContent: 'center',
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(13, 43, 34, 0.1)',
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Sora-Bold',
  },
  transcribingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#ebf5f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  transcribingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#0d2b22',
    fontFamily: 'Sora-Medium',
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
    fontFamily: 'Sora-Bold',
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
    shadowColor: '#0d2b22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(13, 43, 34, 0.12)',
  },
  transcriptionLabel: {
    fontSize: 16,
    fontFamily: 'Sora-Bold',
    color: '#0d2b22',
    marginBottom: 12,
  },
  transcriptionText: {
    fontSize: 16,
    fontFamily: 'Sora-Medium',
    color: '#1a4435',
    lineHeight: 24,
  },
  historyContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#0d2b22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(13, 43, 34, 0.12)',
  },
  historyLabel: {
    fontSize: 16,
    fontFamily: 'Sora-Bold',
    color: '#0d2b22',
    marginBottom: 16,
  },
  historyItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ebf5f1',
  },
  historyNumber: {
    fontSize: 14,
    color: '#6aa98c',
    fontFamily: 'Sora-Bold',
    marginRight: 8,
    minWidth: 20,
  },
  historyText: {
    fontSize: 14,
    color: '#1a4435',
    fontFamily: 'Sora-Medium',
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(13, 43, 34, 0.12)',
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Sora-Medium',
    color: '#546565',
  },
});

export default WhisperSpeechToText; 