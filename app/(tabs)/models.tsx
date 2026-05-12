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

import RNBackgroundDownloader, { ErrorHandlerObject, ProgressHandlerObject } from '@kesha-antonov/react-native-background-downloader';
import { useStores } from '../../components/StoreProvider';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';
import { AVAILABLE_MODELS, downloadModel, isModelReady, quickSetup } from '../../utils/modelSetup';
import { formatBytes, getModelFileInfo } from '../../utils/platformPaths';

const ModelsScreen: React.FC = observer(() => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { modelStore } = useStores();

  // State for setup feedback
  const [setupMessage, setSetupMessage] = useState<string>('');
  const [setupStatus, setSetupStatus] = useState<'idle' | 'progress' | 'success' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [lastFailedModelId, setLastFailedModelId] = useState<string | null>(null);
  const [partialDownloadInfo, setPartialDownloadInfo] = useState<{ [modelId: string]: number }>({});

  React.useEffect(() => {
    // On mount, check for in-progress downloads and attach handlers
    (async () => {
      try {
        const tasks = await RNBackgroundDownloader.checkForExistingDownloads();
        const inProgressTask = tasks.find(
          t => t.state !== 'DONE' && t.state !== 'FAILED'
        );

        if (inProgressTask) {
          // Map task id (filename) to model id
          const modelEntry = Object.entries(AVAILABLE_MODELS).find(
            ([modelId, config]) => config.filename === inProgressTask.id
          );
          if (modelEntry) {
            const [modelId] = modelEntry;
            setDownloadingModelId(modelId); // Use modelId, not filename!
            // Show current progress immediately
            if (inProgressTask.bytesTotal > 0) {
              setDownloadProgress(inProgressTask.bytesDownloaded / inProgressTask.bytesTotal);
            }
            setSetupStatus('progress');
            setSetupMessage('Resuming background download...');
            // Attach handlers
            inProgressTask
              .progress(({ bytesDownloaded, bytesTotal }: ProgressHandlerObject) => {
                if (bytesTotal > 0) setDownloadProgress(bytesDownloaded / bytesTotal);
              })
              .done(async () => {
                try {
                  // Verify download completion
                  const config = AVAILABLE_MODELS[modelId];
                  const info = await getModelFileInfo(config.filename);
                  if (info && info.exists && info.size > 50 * 1024 * 1024) {
                    setSetupStatus('success');
                    setSetupMessage(`Model downloaded successfully! Final size: ${formatBytes(info.size)}`);
                    setDownloadProgress(1);
                    // Update MobX model state so UI shows the initialize button
                    if (modelStore && typeof modelStore.setModelPath === 'function') {
                      modelStore.setModelPath(modelId, AVAILABLE_MODELS[modelId].filename);
                    }
                  } else {
                    throw new Error('Downloaded file verification failed');
                  }
                } catch (error) {
                  setSetupStatus('error');
                  setSetupMessage(`Download verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  setLastFailedModelId(modelId);
                }
                setTimeout(() => {
                  setSetupStatus('idle');
                  setSetupMessage('');
                  setDownloadProgress(0);
                  setDownloadingModelId(null);
                }, 3000);
              })
              .error(({ error }: ErrorHandlerObject) => {
                setSetupStatus('error');
                setSetupMessage(`Download failed: ${error}`);
                setDownloadProgress(0);
                setLastFailedModelId(modelId);
              });
          }
        }

        // Also check for completed downloads that might not be recognized by the UI
        for (const [modelId, config] of Object.entries(AVAILABLE_MODELS)) {
          const info = await getModelFileInfo(config.filename);
          if (info && info.exists && info.size > 50 * 1024 * 1024) {
            const TOLERANCE = 50 * 1024 * 1024;
            if (info.size >= (config.expectedSize - TOLERANCE)) {
              // File exists and is complete, update model store
              if (modelStore && typeof modelStore.setModelPath === 'function') {
                modelStore.setModelPath(modelId, config.filename);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking existing downloads:', error);
      }
    })();
  }, [modelStore.models.length]);

  // Helper to check if model is fully downloaded
  const isFullyDownloaded = async (model: typeof modelStore.models[1]) => {
    const config = AVAILABLE_MODELS[model.id];
    if (!config) return false;
    const info = await getModelFileInfo(String(config.filename));
    const TOLERANCE = 50 * 1024 * 1024; // 50MB tolerance for large models
    return !!info && info.exists && info.size >= (config.expectedSize - TOLERANCE);
  };

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

  const handleDownload = async (modelId: string, resume: boolean = false) => {
    try {
      setDownloadingModelId(modelId);
      setSetupMessage('');
      setSetupStatus('progress');
      setDownloadProgress(0);
      setLastFailedModelId(null);
      const config = AVAILABLE_MODELS[modelId];
      if (config && !resume) {
        const { deleteModelFile } = await import('../../utils/platformPaths');
        await deleteModelFile(config.filename);
      }
      await downloadModel(
        modelId as any,
        {
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
              setDownloadingModelId(null);
            }, 3000);
          },
          onError: (message) => {
            setSetupMessage(message);
            setSetupStatus('error');
            setDownloadProgress(0);
            setLastFailedModelId(modelId);
          }
        },
        resume
      );
    } catch (error) {
      setSetupMessage(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSetupStatus('error');
      setDownloadProgress(0);
      setLastFailedModelId(modelId);
    }
  };

  const handleRetryDownload = async (modelId: string) => {
    await handleDownload(modelId, true);
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

  const renderModelCard = (model: typeof modelStore.models[1]) => {
    const isActive = modelStore.activeModelId === model.id;
    const isLoading = model.isLoading || (modelStore.isContextLoading && modelStore.activeModelId === model.id);
    const isQuickSetupLoading = modelStore.isQuickSetupLoading;
    const ready = isModelReady();
    const config = AVAILABLE_MODELS[model.id];
    const expectedSize = config?.expectedSize || 0;
    const [fileExists, setFileExists] = React.useState(false);
    const [fullyDownloaded, setFullyDownloaded] = React.useState(false);

    // Helper to refresh file info
    const refreshFileInfo = async () => {
      const info = await getModelFileInfo(String(config.filename));
      const fileExists = !!info && info.exists;
      const TOLERANCE = 50 * 1024 * 1024; // 50MB tolerance for large models
      const isComplete = fileExists && info.size >= (expectedSize - TOLERANCE);

      setFileExists(fileExists);
      setFullyDownloaded(isComplete);

      // Update model store if file is complete but not marked as downloaded
      if (isComplete && !model.isDownloaded) {
        if (modelStore && typeof modelStore.setModelPath === 'function') {
          modelStore.setModelPath(model.id, config.filename);
        }
      }
    };

    React.useEffect(() => {
      refreshFileInfo();
    }, [model.id, model.isDownloaded]);

    // Patch handleDownload to accept a callback for after success
    const handleDownloadWithRefresh = async (modelId: string, afterSuccess?: () => void) => {
      try {
        setDownloadingModelId(modelId);
        setSetupMessage('');
        setSetupStatus('progress');
        setDownloadProgress(0);
        setLastFailedModelId(null);
        // Delete any partial file before starting download
        const config = AVAILABLE_MODELS[modelId];
        if (config) {
          const { deleteModelFile } = await import('../../utils/platformPaths');
          await deleteModelFile(config.filename);
        }
        await downloadModel(
          modelId as any,
          {
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
              if (afterSuccess) afterSuccess();
              setTimeout(() => {
                setSetupStatus('idle');
                setSetupMessage('');
                setDownloadProgress(0);
                setDownloadingModelId(null);
              }, 3000);
            },
            onError: (message) => {
              setSetupMessage(message);
              setSetupStatus('error');
              setDownloadProgress(0);
              setLastFailedModelId(modelId); // Track which model failed
              // No timeout here, let user retry
            }
          }
        );
      } catch (error) {
        setSetupMessage(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setSetupStatus('error');
        setDownloadProgress(0);
        setLastFailedModelId(modelId);
        // No timeout here, let user retry
      }
    };

    // Use the patched download handler in the UI
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
              {downloadingModelId === model.id ? 'Downloading...' : isQuickSetupLoading ? 'Setting up...' : ready ? 'Ready' : (model.isDownloaded ? 'Downloaded' : 'Available')}
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
        {(downloadingModelId === model.id && downloadProgress > 0) ? (
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
              {`${Math.round(downloadProgress * 100)}%`}
            </Text>
          </View>
        ) : null}

        <View style={styles.actionButtons}>
          {/* Download/Retry/Initialize/Load logic */}
          {!fileExists ? (
            <TouchableOpacity
              style={[styles.setupButton, { backgroundColor: colors.primary }]}
              onPress={() => handleDownloadWithRefresh(model.id, refreshFileInfo)}
              disabled={isLoading || isQuickSetupLoading || downloadingModelId === model.id}
            >
              {isLoading || isQuickSetupLoading || downloadingModelId === model.id ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Text style={[styles.buttonText, { color: colors.surface }]}>
                  📥 Download Model
                </Text>
              )}
            </TouchableOpacity>
          ) : (!fullyDownloaded ? (
            <TouchableOpacity
              style={[styles.setupButton, { backgroundColor: colors.error }]}
              onPress={() => handleDownloadWithRefresh(model.id, refreshFileInfo)}
              disabled={isLoading || isQuickSetupLoading || downloadingModelId === model.id}
            >
              <Text style={[styles.buttonText, { color: colors.surface }]}>🔄 Download Again</Text>
            </TouchableOpacity>
          ) : (!ready ? (
            <TouchableOpacity
              style={[styles.setupButton, { backgroundColor: colors.warning }]}
              onPress={handleQuickSetup}
              disabled={isLoading || isQuickSetupLoading}
            >
              {isLoading || isQuickSetupLoading ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Text style={[styles.buttonText, { color: colors.surface }]}>🔧 Initialize Model</Text>
              )}
            </TouchableOpacity>
          ) : (
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
                  <Text style={[styles.buttonText, { color: colors.surface }]}> {isActive ? 'Active' : 'Load'} </Text>
                )}
              </TouchableOpacity>

              {isActive && (
                <TouchableOpacity
                  style={[styles.releaseButton, { backgroundColor: colors.error }]}
                  onPress={() => modelStore.releaseContext()}
                >
                  <Text style={[styles.buttonText, { color: colors.surface }]}>Release</Text>
                </TouchableOpacity>
              )}
            </View>
          )))}
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
            {/* Retry button for error */}
            {setupStatus === 'error' && lastFailedModelId && (
              <TouchableOpacity
                style={{ marginLeft: 12, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.primary, borderRadius: 8 }}
                onPress={() => handleRetryDownload(lastFailedModelId)}
              >
                <Text style={{ color: colors.surface, fontWeight: 'bold' }}>Retry</Text>
              </TouchableOpacity>
            )}
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
            {`1. Download a model (Gemma 4 E2B (Small) or Phi-4 Mini are recommended for this device)\n2. Initialize the model after download\n3. Once ready, start chatting in the Chat tab\n4. Release the model when not in use to save memory and battery`}
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