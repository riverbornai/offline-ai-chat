import { observer } from 'mobx-react';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStores } from '../../components/StoreProvider';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';
import { downloadModel, isModelReady, quickSetup } from '../../utils/modelSetup';

const ModelsScreen: React.FC = observer(() => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { modelStore } = useStores();
  
  // State for setup feedback
  const [setupMessage, setSetupMessage] = useState<string>('');
  const [setupStatus, setSetupStatus] = useState<'idle' | 'progress' | 'success' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const handleLoadModel = async (modelId: string) => {
    const model = modelStore.models.find(m => m.id === modelId);
    if (!model || !model.isDownloaded) {
      Alert.alert('Error', 'Model is not downloaded');
      return;
    }

    try {
      // Check if modelStore is properly initialized
      if (!modelStore || typeof modelStore.initContext !== 'function') {
        Alert.alert('Error', 'Model store is not initialized. Please restart the app.');
        return;
      }
      
      await modelStore.initContext(model);
      Alert.alert('Success', `${model.name} loaded successfully!`);
    } catch (error) {
      console.error('Failed to load model:', error);
      Alert.alert('Error', `Failed to load model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDownload = async (modelId: string) => {
    try {
      setIsDownloading(true);
      setSetupMessage('');
      setSetupStatus('progress');
      setDownloadProgress(0);
      
      await downloadModel(modelId as any, {
        onProgress: (message) => {
          setSetupMessage(message);
          setSetupStatus('progress');
        },
        onDownloadProgress: (progress) => {
          setDownloadProgress(progress);
        },
        onSuccess: (message) => {
          setSetupMessage(message);
          setSetupStatus('success');
          setDownloadProgress(1);
          setTimeout(() => {
            setSetupStatus('idle');
            setSetupMessage('');
            setDownloadProgress(0);
            setIsDownloading(false);
          }, 3000);
        },
        onError: (message) => {
          setSetupMessage(message);
          setSetupStatus('error');
          setDownloadProgress(0);
          setTimeout(() => {
            setSetupStatus('idle');
            setSetupMessage('');
            setIsDownloading(false);
          }, 5000);
        }
      });
    } catch (error) {
      setSetupMessage(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSetupStatus('error');
      setDownloadProgress(0);
      setTimeout(() => {
        setSetupStatus('idle');
        setSetupMessage('');
        setIsDownloading(false);
      }, 5000);
    }
  };

  const handleQuickSetup = async () => {
    try {
      setSetupMessage('');
      setSetupStatus('progress');
      setDownloadProgress(0);
      
      await quickSetup({
        onProgress: (message) => {
          setSetupMessage(message);
          setSetupStatus('progress');
        },
        onDownloadProgress: (progress) => {
          setDownloadProgress(progress);
        },
        onSuccess: (message) => {
          setSetupMessage(message);
          setSetupStatus('success');
          setTimeout(() => {
            setSetupStatus('idle');
            setSetupMessage('');
            setDownloadProgress(0);
          }, 3000);
        },
        onError: (message) => {
          setSetupMessage(message);
          setSetupStatus('error');
          setTimeout(() => {
            setSetupStatus('idle');
            setSetupMessage('');
            setDownloadProgress(0);
          }, 5000);
        }
      });
    } catch (error) {
      setSetupMessage(`Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSetupStatus('error');
      setTimeout(() => {
        setSetupStatus('idle');
        setSetupMessage('');
        setDownloadProgress(0);
      }, 5000);
    }
  };

  const renderModelCard = (model: typeof modelStore.models[0]) => {
    const isActive = modelStore.activeModelId === model.id;
    const isLoading = model.isLoading || (modelStore.isContextLoading && modelStore.activeModelId === model.id);
    const isQuickSetupLoading = modelStore.isQuickSetupLoading;
    const ready = isModelReady();

    return (
      <View
        key={model.id}
        style={[
          styles.modelCard,
          {
            backgroundColor: colors.surface,
            borderColor: isActive ? colors.primary : colors.border,
            borderWidth: isActive ? 2 : 1,
          },
        ]}
      >
        <View style={styles.modelHeader}>
          <Text style={[styles.modelName, { color: colors.text }]}>
            {model.name}
          </Text>
          <View style={[styles.statusBadge, { 
            backgroundColor: ready ? colors.success : (model.isDownloaded ? colors.warning : colors.muted)
          }]}>
            <Text style={[styles.statusText, { color: colors.surface }]}>
              {isDownloading ? 'Downloading...' : isQuickSetupLoading ? 'Setting up...' : ready ? 'Ready' : (model.isDownloaded ? 'Downloaded' : 'Available')}
            </Text>
          </View>
        </View>

        <Text style={[styles.modelDescription, { color: colors.muted }]}>
          {model.description}
        </Text>

        <Text style={[styles.modelSize, { color: colors.muted }]}>
          Size: {model.size}
        </Text>

        {model.languageSupport && (
          <View style={styles.languagesContainer}>
            <Text style={[styles.languagesLabel, { color: colors.muted }]}>
              Languages:
            </Text>
            <View style={styles.languagesList}>
              {model.languageSupport.slice(0, 3).map((lang) => (
                <View
                  key={lang}
                  style={[styles.languageTag, { backgroundColor: colors.background }]}
                >
                  <Text style={[styles.languageText, { color: colors.text }]}>
                    {lang}
                  </Text>
                </View>
              ))}
              {model.languageSupport.length > 3 && (
                <Text style={[styles.moreLanguages, { color: colors.muted }]}>
                  +{model.languageSupport.length - 3} more
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Download Progress Bar */}
        {isDownloading && downloadProgress > 0 && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.background }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: colors.primary,
                    width: `${Math.round(downloadProgress * 100)}%`
                  }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: colors.muted }]}>
              {Math.round(downloadProgress * 100)}%
            </Text>
          </View>
        )}

        <View style={styles.actionButtons}>
          {!model.isDownloaded && (
            <TouchableOpacity
              style={[styles.setupButton, { backgroundColor: colors.primary }]}
              onPress={() => handleDownload(model.id)}
              disabled={isLoading || isQuickSetupLoading || isDownloading}
            >
              {isLoading || isQuickSetupLoading || isDownloading ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Text style={[styles.buttonText, { color: colors.surface }]}>
                  📥 Download Model
                </Text>
              )}
            </TouchableOpacity>
          )}

          {model.isDownloaded && !ready && (
            <TouchableOpacity
              style={[styles.setupButton, { backgroundColor: colors.warning }]}
              onPress={handleQuickSetup}
              disabled={isLoading || isQuickSetupLoading}
            >
              {isLoading || isQuickSetupLoading ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Text style={[styles.buttonText, { color: colors.surface }]}>
                  🔧 Initialize Model
                </Text>
              )}
            </TouchableOpacity>
          )}
          
          {ready && (
            <View style={styles.downloadedActions}>
              <TouchableOpacity
                style={[
                  styles.loadButton,
                  {
                    backgroundColor: isActive ? colors.success : colors.primary,
                  },
                ]}
                onPress={() => handleLoadModel(model.id)}
                disabled={isLoading || isActive}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.surface} size="small" />
                ) : (
                  <Text style={[styles.buttonText, { color: colors.surface }]}>
                    {isActive ? 'Active' : 'Load'}
                  </Text>
                )}
              </TouchableOpacity>

              {isActive && (
                <TouchableOpacity
                  style={[styles.releaseButton, { backgroundColor: colors.error }]}
                  onPress={() => modelStore.releaseContext()}
                >
                  <Text style={[styles.buttonText, { color: colors.surface }]}>
                    Release
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          Language Models
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Download and manage AI models for language learning
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Setup Progress Message */}
        {setupStatus !== 'idle' && setupMessage && (
          <View style={[
            styles.setupMessageBanner,
            {
              backgroundColor: 
                setupStatus === 'success' ? colors.success :
                setupStatus === 'error' ? colors.error :
                colors.primary
            }
          ]}>
            {setupStatus === 'progress' && (
              <ActivityIndicator color={colors.surface} size="small" />
            )}
            <Text style={[styles.setupMessageText, { color: colors.surface }]}>
              {setupStatus === 'success' ? '✅ ' : setupStatus === 'error' ? '❌ ' : ''}
              {setupMessage}
            </Text>
          </View>
        )}

        {/* Original Progress Banner (kept for compatibility) */}
        {modelStore.isQuickSetupLoading && setupStatus === 'idle' && (
          <View style={[styles.progressBanner, { backgroundColor: colors.primary }]}>
            <ActivityIndicator color={colors.surface} size="small" />
            <Text style={[styles.progressText, { color: colors.surface }]}>
              Setting up your AI model... This may take a moment.
            </Text>
          </View>
        )}
        
        {modelStore.models.map(renderModelCard)}

        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.infoTitle, { color: colors.primary }]}>
            ℹ️ Getting Started
          </Text>
          <Text style={[styles.infoText, { color: colors.text }]}>
            {`1. Download the Phi-3 model (2.4GB) - requires internet connection\n2. Initialize the model after download\n3. Once ready, start chatting in the AI Chat tab\n4. Release the model when not in use to save memory`}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  setupMessageBanner: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setupMessageText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  modelCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  modelName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modelDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  modelSize: {
    fontSize: 12,
    marginBottom: 12,
  },
  languagesContainer: {
    marginBottom: 16,
  },
  languagesLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  languagesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  languageTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  languageText: {
    fontSize: 11,
    fontWeight: '500',
  },
  moreLanguages: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  setupButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  downloadedActions: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  loadButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  releaseButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  progressBanner: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default ModelsScreen; 