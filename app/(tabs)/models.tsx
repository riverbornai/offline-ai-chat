import { observer } from 'mobx-react';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import RNBackgroundDownloader, { ErrorHandlerObject, ProgressHandlerObject } from '@kesha-antonov/react-native-background-downloader';
import { useStores } from '../../components/StoreProvider';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';
import { AVAILABLE_MODELS, downloadModel, quickSetup } from '../../utils/modelSetup';
import { formatBytes, getModelFileInfo } from '../../utils/platformPaths';
import { ttsService } from '../../services/ttsService';
import { KokoroVoiceModal } from '../../components/KokoroVoiceModal';
import { getKokoroVoiceById, getKokoroVoiceDisplayName } from '../../constants/kokoroVoices';

const ModelsScreen: React.FC = observer(() => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { modelStore } = useStores();
  const router = useRouter();

  // Retrieve initial tab from query params (e.g. from Settings screen)
  const { initialTab } = useLocalSearchParams<{ initialTab?: 'llm' | 'tts' }>();
  const [activeTab, setActiveTab] = useState<'llm' | 'tts'>(initialTab === 'tts' ? 'tts' : 'llm');

  // Synchronize active tab when initialTab param changes
  React.useEffect(() => {
    if (initialTab === 'llm' || initialTab === 'tts') {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // State for setup feedback
  const [setupMessage, setSetupMessage] = useState<string>('');
  const [setupStatus, setSetupStatus] = useState<'idle' | 'progress' | 'success' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [lastFailedModelId, setLastFailedModelId] = useState<string | null>(null);
  const [partialDownloadInfo, setPartialDownloadInfo] = useState<{ [modelId: string]: number }>({});
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only — setModelPath mutations must NOT retrigger this

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

      if (model.type === 'tts') {
        await ttsService.initialize(model.id);
        Alert.alert('Success', `TTS Model ${model.name} loaded successfully!`);
      } else {
        await modelStore.initContext(model);
        Alert.alert('Success', `${model.name} loaded successfully!`);
      }
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
            
            // Automatically initialize the model after successful download
            console.log(`Download successful for ${modelId}, auto-initializing...`);
            handleLoadModel(modelId);
            
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

const ModelCard: React.FC<{
  model: any;
  colors: any;
  downloadingModelId: string | null;
  downloadProgress: number;
  handleDownload: (id: string) => void;
  handleLoadModel: (id: string) => void;
  handleQuickSetup: () => void;
  onOpenVoiceModal?: () => void;
}> = observer(({
  model,
  colors,
  downloadingModelId,
  downloadProgress,
  handleDownload,
  handleLoadModel,
  handleQuickSetup,
  onOpenVoiceModal,
}) => {
  const { modelStore } = useStores();
  const isActive = modelStore.activeModelId === model.id;
  const isLoading = model.isLoading || (modelStore.isContextLoading && modelStore.activeModelId === model.id);
  const isQuickSetupLoading = modelStore.isQuickSetupLoading;
  const config = AVAILABLE_MODELS[model.id];
  const expectedSize = config?.expectedSize || 0;
  const [fileExists, setFileExists] = React.useState(false);
  const [fullyDownloaded, setFullyDownloaded] = React.useState(false);
  // Local reactive state for TTS service (ttsService is not a MobX store)
  const [ttsLoaded, setTtsLoaded] = React.useState(false);
  const [ttsLoading, setTtsLoading] = React.useState(false);

  // Helper to refresh file info
  const refreshFileInfo = async () => {
    // Check main file
    const info = await getModelFileInfo(String(config.filename));
    let exists = !!info && info.exists;
    
    // For models with multiple files (like Kokoro), check all of them
    if (exists && config.additionalFiles && config.additionalFiles.length > 0) {
      for (const file of config.additionalFiles) {
        const extraInfo = await getModelFileInfo(file);
        if (!extraInfo || !extraInfo.exists) {
          // Special case for Kokoro/Piper: if espeak-ng-data folder exists but archive is gone, that's fine
          if (file.endsWith('.zip') || file.endsWith('.tar.bz2')) {
            const folderPath = file.replace('.zip', '').replace('.tar.bz2', '');
            const folderInfo = await getModelFileInfo(folderPath);
            if (folderInfo && folderInfo.exists) continue;
          }
          exists = false;
          break;
        }
      }
    }

    const TOLERANCE = 50 * 1024 * 1024; // 50MB tolerance for large models
    const isComplete = exists && (info ? info.size >= (expectedSize - TOLERANCE) : false);

    setFileExists(exists);
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

  // Sync TTS service state into local state so the card re-renders correctly
  React.useEffect(() => {
    if (model.type !== 'tts') return;
    const sync = () => {
      const isLoaded = ttsService.getIsLoaded();
      const activeId = ttsService.getActiveModelId();
      // Only mark as loaded if THIS specific model is the active one
      setTtsLoaded(isLoaded && activeId === model.id);
      setTtsLoading(ttsService.getIsLoading());
    };
    sync();
    const interval = setInterval(sync, 500);
    return () => clearInterval(interval);
  }, [model.type]);

  const getStatusInfo = () => {
    if (downloadingModelId === model.id) return { label: 'Downloading...', color: colors.primary, icon: 'cloud-download' as const };
    if (isQuickSetupLoading) return { label: 'Setting up...', color: colors.warning, icon: 'construct' as const };
    
    const isLoaded = model.type === 'tts'
      ? ttsLoaded
      : (modelStore.activeModelId === model.id && !modelStore.isContextLoading);
    
    if (isLoaded) return { label: 'Active', color: colors.success, icon: 'checkmark-circle' as const };
    if (model.isDownloaded) return { label: 'Downloaded', color: colors.secondary, icon: 'save' as const };
    return { label: 'Available', color: colors.muted, icon: 'cloud-outline' as const };
  };

  const status = getStatusInfo();

  return (
    <View
      key={model.id}
      style={[
        styles.modelCard,
        {
          backgroundColor: colors.surface,
          borderColor: isActive ? colors.primary : colors.border,
        },
      ]}
    >
      <View style={styles.modelHeader}>
        <Text style={[styles.modelName, { color: colors.text }]}>
          {model.name}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: `${status.color}15` }]}>
          <Ionicons name={status.icon} size={14} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>

      <Text style={[styles.modelDescription, { color: colors.text }]}>
        {model.description}
      </Text>

      <View style={styles.metaInfoRow}>
        <View style={styles.metaItem}>
          <Ionicons name="resize" size={16} color={colors.muted} />
          <Text style={[styles.metaText, { color: colors.text }]}>{model.size}</Text>
        </View>
        {model.languageSupport && (
          <View style={styles.metaItem}>
            <Ionicons name="language" size={16} color={colors.muted} />
            <Text style={[styles.metaText, { color: colors.text }]}>
              {model.languageSupport.length} Languages
            </Text>
          </View>
        )}
      </View>

      {model.languageSupport && (
        <View style={styles.languagesContainer}>
          <Text style={[styles.languagesLabel, { color: colors.text }]}>
            SUPPORTED LANGUAGES
          </Text>
          <View style={styles.languagesList}>
            {model.languageSupport.slice(0, 4).map((lang: string) => (
              <View
                key={lang}
                style={[styles.languageTag, { backgroundColor: colors.background }]}
              >
                <Text style={[styles.languageText, { color: colors.text }]}>
                  {lang}
                </Text>
              </View>
            ))}
            {model.languageSupport.length > 4 && (
              <Text style={[styles.moreLanguages, { color: colors.text }]}>
                +{model.languageSupport.length - 4} more
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Download Progress Bar */}
      {(downloadingModelId === model.id && downloadProgress > 0) ? (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.text }]}>Downloading Model...</Text>
            <Text style={[styles.progressPercentage, { color: colors.primary }]}>
              {`${Math.round(downloadProgress * 100)}%`}
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
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
        </View>
      ) : null}

      <View style={styles.actionButtons}>
        {!fileExists ? (
          <TouchableOpacity
            style={[styles.setupButton, { backgroundColor: colors.primary }]}
            onPress={() => handleDownload(model.id)}
            disabled={isLoading || isQuickSetupLoading || downloadingModelId === model.id}
          >
            {isLoading || isQuickSetupLoading || downloadingModelId === model.id ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <>
                <Ionicons name="cloud-download" size={20} color={colors.surface} />
                <Text style={[styles.buttonText, { color: colors.surface }]}>
                  Download Model
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (!fullyDownloaded ? (
          <TouchableOpacity
            style={[styles.setupButton, { backgroundColor: colors.error }]}
            onPress={() => handleDownload(model.id)}
            disabled={isLoading || isQuickSetupLoading || downloadingModelId === model.id}
          >
            <Ionicons name="refresh" size={20} color={colors.surface} />
            <Text style={[styles.buttonText, { color: colors.surface }]}>Retry Download</Text>
          </TouchableOpacity>
        ) : (!ttsLoaded && !isActive ? (
          // "Initialize" button — calls handleLoadModel which routes to ttsService.initialize() for TTS
          // and modelStore.initContext() for LLMs
          <TouchableOpacity
            style={[styles.setupButton, { backgroundColor: colors.warning }]}
            onPress={() => handleLoadModel(model.id)}
            disabled={isLoading || isQuickSetupLoading || ttsLoading || (model.type === 'tts' ? ttsLoaded : isActive)}
          >
            {isLoading || isQuickSetupLoading || ttsLoading ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <>
                <Ionicons name="flash" size={20} color={colors.surface} />
                <Text style={[styles.buttonText, { color: colors.surface }]}>Initialize Model</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.downloadedActions}>
            <TouchableOpacity
              style={[
                styles.loadButton,
                {
                  backgroundColor: (model.type === 'tts' ? ttsLoaded : isActive) ? colors.success : colors.primary,
                },
              ]}
              onPress={() => handleLoadModel(model.id)}
              disabled={isLoading || ttsLoading || (model.type === 'tts' ? ttsLoaded : isActive)}
            >
              {isLoading || ttsLoading ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <>
                  <Ionicons name={(model.type === 'tts' ? ttsLoaded : isActive) ? "radio-button-on" : "play"} size={20} color={colors.surface} />
                  <Text style={[styles.buttonText, { color: colors.surface }]}>
                    {(model.type === 'tts' ? ttsLoaded : isActive) ? 'Currently Active' : `Load ${model.type === 'tts' ? 'TTS' : 'Model'}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {((model.type === 'tts' && ttsLoaded) || (model.type !== 'tts' && isActive)) && (
              <TouchableOpacity
                style={styles.releaseButton}
                onPress={() => {
                  if (model.type === 'tts') {
                    ttsService.cleanup().then(() => {
                      setTtsLoaded(false);
                      setTtsLoading(false);
                    });
                  } else {
                    modelStore.releaseContext();
                  }
                }}
              >
                <Ionicons name="power" size={24} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        )))}
      </View>

      {/* Kokoro Voice Model Selector Button */}
      {model.type === 'tts' && model.id.includes('kokoro') && (
        <TouchableOpacity
          style={{
            marginTop: 12,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 16,
            backgroundColor: `${colors.primary}12`,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: `${colors.primary}25`,
          }}
          onPress={onOpenVoiceModal}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: `${colors.primary}20`,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="mic" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 11, fontFamily: 'Sora-Bold', color: colors.primary, letterSpacing: 0.5 }}>
                KOKORO VOICE MODEL
              </Text>
              <Text style={{ fontSize: 14, fontFamily: 'Sora-Bold', color: colors.text, marginTop: 2 }}>
                {getKokoroVoiceDisplayName(getKokoroVoiceById(modelStore.activeKokoroSpeakerId ?? 0))}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${colors.primary}18`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Sora-Bold', color: colors.primary }}>
              Change
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
});


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <View style={styles.headerTopBar}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={[styles.backButton, { backgroundColor: `${colors.primary}10` }]}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Ionicons name="hardware-chip-outline" size={24} color={colors.primary} />
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Local Models</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>High-performance offline AI</Text>
            </View>
          </View>
        </View>

        <View style={[styles.tabBar, { backgroundColor: `${colors.primary}10` }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'llm' && { backgroundColor: colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }]}
            onPress={() => setActiveTab('llm')}
          >
            <Ionicons name="chatbubbles" size={18} color={activeTab === 'llm' ? colors.primary : colors.muted} />
            <Text style={[styles.tabText, { color: activeTab === 'llm' ? colors.text : colors.muted }]}>
              AI Models
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'tts' && { backgroundColor: colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }]}
            onPress={() => setActiveTab('tts')}
          >
            <Ionicons name="volume-high" size={18} color={activeTab === 'tts' ? colors.primary : colors.muted} />
            <Text style={[styles.tabText, { color: activeTab === 'tts' ? colors.text : colors.muted }]}>
              TTS Models
            </Text>
          </TouchableOpacity>
        </View>
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
                setupStatus === 'success' ? `${colors.success}20` :
                  setupStatus === 'error' ? `${colors.error}20` :
                    `${colors.primary}20`
            }
          ]}>
            <Ionicons 
              name={setupStatus === 'success' ? 'checkmark-circle' : setupStatus === 'error' ? 'alert-circle' : 'information-circle'} 
              size={24} 
              color={setupStatus === 'success' ? colors.success : setupStatus === 'error' ? colors.error : colors.primary} 
            />
            <Text style={[styles.setupMessageText, { color: colors.text }]}>
              {setupMessage}
            </Text>
            {/* Retry button for error */}
            {setupStatus === 'error' && lastFailedModelId && (
              <TouchableOpacity
                style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.primary, borderRadius: 8 }}
                onPress={() => handleRetryDownload(lastFailedModelId)}
              >
                <Text style={{ color: colors.surface, fontWeight: 'bold', fontSize: 12 }}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Original Progress Banner (kept for compatibility) */}
        {modelStore.isQuickSetupLoading && setupStatus === 'idle' && (
          <View style={[styles.progressBanner, { backgroundColor: `${colors.primary}15` }]}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={[styles.progressText, { color: colors.text, fontWeight: '600' }]}>
              Setting up your AI model...
            </Text>
          </View>
        )}

        {modelStore.models
          .filter(model => model.type === activeTab)
          .map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              colors={colors}
              downloadingModelId={downloadingModelId}
              downloadProgress={downloadProgress}
              handleDownload={handleDownload}
              handleLoadModel={handleLoadModel}
              handleQuickSetup={handleQuickSetup}
              onOpenVoiceModal={() => setVoiceModalVisible(true)}
            />
          ))}

        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <View style={styles.infoTitleRow}>
            <Ionicons name="bulb" size={24} color={colors.warning} />
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              Getting Started
            </Text>
          </View>
          
          {[
            { 
              id: 1, 
              text: activeTab === 'llm' 
                ? 'Download a model (Gemma 4 E2B or Phi-4 Mini recommended)' 
                : 'Download the Kokoro-82M Voice model for offline speech' 
            },
            { 
              id: 2, 
              text: activeTab === 'llm'
                ? 'Initialize the model once the download completes'
                : 'Load the Voice engine to enable premium audio'
            },
            { 
              id: 3, 
              text: activeTab === 'llm'
                ? 'Go to the Chat tab to start your conversation'
                : 'Start a chat to hear the natural high-quality voice'
            },
            { 
              id: 4, 
              text: 'Release the model when done to free up memory' 
            }
          ].map((item) => (
            <View key={item.id} style={styles.infoItem}>
              <View style={[styles.infoStepNumber, { backgroundColor: `${colors.primary}15` }]}>
                <Text style={[styles.infoStepText, { color: colors.primary }]}>{item.id}</Text>
              </View>
              <Text style={[styles.infoText, { color: colors.text }]}>{item.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <KokoroVoiceModal
        visible={voiceModalVisible}
        onClose={() => setVoiceModalVisible(false)}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  headerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Sora-Bold',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Sora-Medium',
    opacity: 0.6,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    marginTop: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Sora-Bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  setupMessageBanner: {
    padding: 16,
    marginBottom: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  setupMessageText: {
    fontSize: 14,
    fontFamily: 'Sora-Bold',
    flex: 1,
    marginLeft: 12,
  },
  modelCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modelName: {
    fontSize: 20,
    fontFamily: 'Sora-Bold',
    flex: 1,
    marginRight: 12,
    letterSpacing: -0.3,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Sora-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modelDescription: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Sora-Medium',
    marginBottom: 16,
    opacity: 0.8,
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontFamily: 'Sora-Medium',
    opacity: 0.6,
  },
  languagesContainer: {
    marginBottom: 20,
  },
  languagesLabel: {
    fontSize: 13,
    fontFamily: 'Sora-Bold',
    marginBottom: 10,
    opacity: 0.5,
  },
  languagesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  languageTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  languageText: {
    fontSize: 12,
    fontFamily: 'Sora-Bold',
  },
  moreLanguages: {
    fontSize: 12,
    fontFamily: 'Sora-Medium',
    opacity: 0.5,
    fontStyle: 'italic',
  },
  progressContainer: {
    marginBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: 16,
    borderRadius: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: 'Sora-Bold',
    opacity: 0.6,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 14,
    fontFamily: 'Sora-Bold',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  setupButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  downloadedActions: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  loadButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  releaseButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  buttonText: {
    fontSize: 15,
    fontFamily: 'Sora-Bold',
  },
  infoCard: {
    borderRadius: 24,
    padding: 24,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  infoTitle: {
    fontSize: 18,
    fontFamily: 'Sora-Bold',
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  infoStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoStepText: {
    fontSize: 11,
    fontFamily: 'Sora-Bold',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Sora-Medium',
    flex: 1,
    opacity: 0.8,
  },
  progressBanner: {
    padding: 16,
    marginBottom: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressText: {
    fontSize: 14,
    fontFamily: 'Sora-Bold',
    marginLeft: 12,
    flex: 1,
  },
});

export default ModelsScreen; 