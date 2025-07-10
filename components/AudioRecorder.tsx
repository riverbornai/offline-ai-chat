import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SpeechService, TranscriptionResponse } from '../services/speechService';

type TabType = 'recorder' | 'upload';

export default function AudioRecorder() {
  const [recording, setRecording] = useState<Audio.Recording>();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptions, setTranscriptions] = useState<string[]>([]);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [activeTab, setActiveTab] = useState<TabType>('recorder');

  useEffect(() => {
    return () => {
      // Clean up recording if component unmounts while recording
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {
          // Ignore errors if recording is already unloaded
        });
      }
    };
  }, [recording]);

  async function startRecording() {
    try {
      if (permissionResponse?.status !== 'granted') {
        console.log('Requesting permission..');
        await requestPermission();
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording..');
      const { recording } = await Audio.Recording.createAsync({
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

      setRecording(recording);
      setIsRecording(true);
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording. Please check microphone permissions.');
    }
  }

  async function stopRecording() {
    console.log('Stopping recording..');
    if (!recording) return;

    setIsRecording(false);
    setIsTranscribing(true);

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();
      console.log('Recording stopped and stored at', uri);

      if (uri) {
        await transcribeAudio(uri, 'Recorded Audio');
      }
    } catch (error) {
      console.error('Error stopping recording or transcribing:', error);
      Alert.alert('Error', 'Failed to process recording');
    } finally {
      setRecording(undefined);
      setIsTranscribing(false);
    }
  }

  async function transcribeAudio(uri: string, filename: string = 'Audio File') {
    setIsTranscribing(true);
    try {
      const result: TranscriptionResponse = await SpeechService.transcribeAudio(uri);
      
      if (result.success && result.transcription) {
        setTranscriptions(prev => [...prev, result.transcription!]);
        Alert.alert(
          'Transcription Complete', 
          `File: ${filename}\n\nTranscription: "${result.transcription}"`
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to transcribe audio');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      Alert.alert('Error', 'Failed to transcribe audio');
    } finally {
      setIsTranscribing(false);
    }
  }

  async function pickAndUploadAudio() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const audioFile = result.assets[0];
        console.log('Selected audio file:', audioFile);
        
        await transcribeAudio(audioFile.uri, audioFile.name);
      }
    } catch (error) {
      console.error('Error picking audio file:', error);
      Alert.alert('Error', 'Failed to pick audio file');
    }
  }

  const handleRecordPress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const renderTabContent = () => {
    if (activeTab === 'recorder') {
      return (
        <>
          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording ? styles.recordingButton : styles.idleButton,
              (isTranscribing) && styles.disabledButton
            ]}
            onPress={handleRecordPress}
            disabled={isTranscribing}
          >
            {isTranscribing ? (
              <ActivityIndicator color="white" size="large" />
            ) : (
              <Text style={styles.recordButtonText}>
                {isRecording ? '🛑 Stop Recording' : '🎤 Start Recording'}
              </Text>
            )}
          </TouchableOpacity>

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <Text style={styles.recordingText}>🔴 Recording in progress...</Text>
            </View>
          )}
        </>
      );
    } else {
      return (
        <TouchableOpacity
          style={[styles.uploadButton, isTranscribing && styles.disabledButton]}
          onPress={pickAndUploadAudio}
          disabled={isTranscribing}
        >
          <Text style={styles.uploadButtonText}>
            📁 Upload Audio File
          </Text>
        </TouchableOpacity>
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Transcription</Text>
      
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
      <View style={styles.contentContainer}>
        {renderTabContent()}
      </View>

      {isTranscribing && (
        <View style={styles.transcribingIndicator}>
          <Text style={styles.transcribingText}>🔄 Processing audio...</Text>
        </View>
      )}

      {transcriptions.length > 0 && (
        <View style={styles.transcriptionsContainer}>
          <Text style={styles.transcriptionsTitle}>Recent Transcriptions:</Text>
          <ScrollView style={styles.scrollView}>
            {transcriptions.map((text, index) => (
              <View key={index} style={styles.transcriptionItem}>
                <Text style={styles.transcriptionText}>
                  {index + 1}. {text}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    margin: 16,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
    elevation: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 32,
    color: '#1a1a1a',
    letterSpacing: -0.5,
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
  contentContainer: {
    minHeight: 80,
    justifyContent: 'center',
  },
  recordButton: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 64,
    justifyContent: 'center',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
    elevation: 8,
    transform: [{ scale: 1 }],
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
  idleButton: {
    backgroundColor: '#3b82f6',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  recordingButton: {
    backgroundColor: '#ef4444',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    borderColor: 'rgba(156, 163, 175, 0.2)',
  },
  recordButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  recordingIndicator: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#fef2f2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  recordingText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  transcribingIndicator: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#eff6ff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  transcribingText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  transcriptionsContainer: {
    marginTop: 24,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  transcriptionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1e293b',
    letterSpacing: -0.2,
  },
  scrollView: {
    maxHeight: 240,
  },
  transcriptionItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  transcriptionText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    letterSpacing: 0.1,
  },
}); 