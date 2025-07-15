import React, { useEffect, useState } from 'react';
import {
    Alert,
    PermissionsAndroid,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import AudioRecord from 'react-native-audio-record';

const AudioRecorder: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingPath, setRecordingPath] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    setupAudioRecorder();
    requestMicrophonePermission();
    
    return () => {
      // Cleanup on unmount
      if (isRecording) {
        AudioRecord.stop();
      }
    };
  }, []);

  const setupAudioRecorder = () => {
    const options = {
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      wavFile: 'recording.wav',
    };

    AudioRecord.init(options);
  };

  const requestMicrophonePermission = async () => {
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
        
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Permission Required',
            'Microphone permission is required to record audio.'
          );
        }
      } catch (err) {
        console.error('Error requesting microphone permission:', err);
        setHasPermission(false);
      }
    } else {
      // iOS permissions are handled differently, usually through Info.plist
      setHasPermission(true);
    }
  };

  const startRecording = async () => {
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Please grant microphone permission to record audio.'
      );
      return;
    }

    try {
      await AudioRecord.start();
      setIsRecording(true);
      setRecordingPath(null);
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      const audioFile = await AudioRecord.stop();
      setIsRecording(false);
      setRecordingPath(audioFile);
      console.log('Recording stopped. File saved at:', audioFile);
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
      Alert.alert('Recording Error', 'Failed to stop recording.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Audio Recorder</Text>
        <Text style={styles.subtitle}>React Native Audio Record</Text>
      </View>

      <View style={styles.statusContainer}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            Permission: {hasPermission ? 'Granted ✓' : 'Not Granted ✗'}
          </Text>
        </View>
        
        <View style={[styles.statusBadge, isRecording && styles.recordingBadge]}>
          <Text style={[styles.statusText, isRecording && styles.recordingText]}>
            Status: {isRecording ? 'Recording 🔴' : 'Ready'}
          </Text>
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.stopButton,
          ]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Text style={styles.recordButtonText}>
            {isRecording ? '🛑 Stop Recording' : '🎤 Start Recording'}
          </Text>
        </TouchableOpacity>
      </View>

      {recordingPath && (
        <View style={styles.fileInfoContainer}>
          <Text style={styles.fileInfoLabel}>Recording saved to:</Text>
          <Text style={styles.filePathText}>{recordingPath}</Text>
          <View style={styles.specsContainer}>
            <Text style={styles.specsText}>Sample Rate: 16kHz</Text>
            <Text style={styles.specsText}>Channels: Mono</Text>
            <Text style={styles.specsText}>Format: 16-bit PCM WAV</Text>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Platform: {Platform.OS}
        </Text>
        <Text style={styles.footerText}>
          Library: react-native-audio-record
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
  statusContainer: {
    alignItems: 'center',
    marginBottom: 30,
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
  recordingBadge: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  statusText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },
  recordingText: {
    color: '#dc2626',
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
  stopButton: {
    backgroundColor: '#dc2626',
    shadowColor: '#dc2626',
  },
  recordButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  fileInfoContainer: {
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
  fileInfoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  filePathText: {
    fontSize: 14,
    color: '#374151',
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 16,
  },
  specsContainer: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
  },
  specsText: {
    fontSize: 12,
    color: '#1e40af',
    marginBottom: 4,
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

export default AudioRecorder; 