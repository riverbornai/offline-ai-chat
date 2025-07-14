import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
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
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT, // or try .WAV if available
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
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
        const info = await FileSystem.getInfoAsync(uri);
        console.log('Recorded file info:', info);

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
      
      // Transcribe audio using Whisper service
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

  const pickAndUploadAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const audioFile = result.assets[0];
        console.log('Selected audio file:', audioFile);
        
        await transcribeAudio(audioFile.uri);
      }
    } catch (error) {
      console.error('Error picking audio file:', error);
      Alert.alert('Error', 'Failed to pick audio file');
    }
  };

  if (isModelLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
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

      {/* Tab Buttons */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'recorder' ? styles.activeTab : styles.inactiveTab
          ]}
          onPress={() => setActiveTab('recorder')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'recorder' ? styles.activeTabText : styles.inactiveTabText
          ]}>
            🎤 Recorder
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'upload' ? styles.activeTab : styles.inactiveTab
          ]}
          onPress={() => setActiveTab('upload')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'upload' ? styles.activeTabText : styles.inactiveTabText
          ]}>
            📁 Upload
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.controlsContainer}>
        {activeTab === 'recorder' ? (
          <>
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
          </>
        ) : (
          <TouchableOpacity
            style={[styles.uploadButton, isTranscribing && styles.disabledButton]}
            onPress={pickAndUploadAudio}
            disabled={isTranscribing}
          >
            <Text style={styles.uploadButtonText}>
              📁 Upload Audio File
            </Text>
          </TouchableOpacity>
        )}

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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
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
    backgroundColor: '#3b82f6',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
    elevation: 4,
  },
  inactiveTab: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  activeTabText: {
    color: 'white',
  },
  inactiveTabText: {
    color: '#64748b',
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
  recordingIndicator: {
    marginTop: 16,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '500',
  },
  uploadButton: {
    backgroundColor: '#10b981',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    minHeight: 64,
    justifyContent: 'center',
    boxShadow: '0 4px 24px rgba(16, 185, 129, 0.25)',
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  uploadButtonText: {
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