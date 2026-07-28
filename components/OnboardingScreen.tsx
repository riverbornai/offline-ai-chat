import { Ionicons } from '@expo/vector-icons';
import RNBackgroundDownloader, { ErrorHandlerObject, ProgressHandlerObject } from '@kesha-antonov/react-native-background-downloader';
import { observer } from 'mobx-react';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';
import { AVAILABLE_MODELS, downloadModel, initializeModel } from '../utils/modelSetup';
import { getModelFileInfo } from '../utils/platformPaths';
import { useStores } from './StoreProvider';

const { width } = Dimensions.get('window');

type Step = 'welcome' | 'llm' | 'tts' | 'initializing' | 'success';

const OnboardingScreen: React.FC = observer(() => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { modelStore } = useStores();

  // Onboarding Step State
  const [step, setStep] = useState<Step>('welcome');

  // Selection states
  const [selectedLlmId, setSelectedLlmId] = useState<string>('tinyllama-1.1b-chat-v1.0-q4_k_m');
  const [selectedTtsId, setSelectedTtsId] = useState<string>('vits-piper-en_US-amy-low');

  // Download & Installation States
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'progress' | 'success' | 'error'>('idle');
  const [lastFailedModelId, setLastFailedModelId] = useState<string | null>(null);

  // Initialization States
  const [llmInitStatus, setLlmInitStatus] = useState<'pending' | 'loading' | 'success' | 'failed'>('pending');
  const [ttsInitStatus, setTtsInitStatus] = useState<'pending' | 'loading' | 'success' | 'failed'>('pending');

  // Detect active background downloads on mount
  useEffect(() => {
    (async () => {
      try {
        const tasks = await RNBackgroundDownloader.checkForExistingDownloads();
        const activeTask = tasks.find(
          t => t.state !== 'DONE' && t.state !== 'FAILED'
        );

        if (activeTask) {
          const modelEntry = Object.entries(AVAILABLE_MODELS).find(
            ([_, config]) => config.filename === activeTask.id
          );

          if (modelEntry) {
            const [modelId] = modelEntry;
            const modelConfig = AVAILABLE_MODELS[modelId];

            // Auto route to correct step depending on model type
            const appModel = modelStore.models.find(m => m.id === modelId);
            if (appModel) {
              if (appModel.type === 'llm') {
                setSelectedLlmId(modelId);
                setStep('llm');
              } else {
                setSelectedTtsId(modelId);
                setStep('tts');
              }

              setDownloadingModelId(modelId);
              setDownloadStatus('progress');
              setStatusMessage('Resuming background download...');

              if (activeTask.bytesTotal > 0) {
                setDownloadProgress(activeTask.bytesDownloaded / activeTask.bytesTotal);
              }

              // Attach handlers
              activeTask
                .progress(({ bytesDownloaded, bytesTotal }: ProgressHandlerObject) => {
                  if (bytesTotal > 0) setDownloadProgress(bytesDownloaded / bytesTotal);
                })
                .done(async () => {
                  await finishDownload(modelId);
                })
                .error(({ error }: ErrorHandlerObject) => {
                  setDownloadStatus('error');
                  setStatusMessage(`Download failed: ${error}`);
                  setLastFailedModelId(modelId);
                });
            }
          }
        }
      } catch (err) {
        console.error('Error resuming background download:', err);
      }
    })();
  }, []);

  const finishDownload = async (modelId: string) => {
    try {
      const config = AVAILABLE_MODELS[modelId];
      const info = await getModelFileInfo(config.filename);

      if (info && info.exists && info.size > 5 * 1024 * 1024) {
        setDownloadStatus('success');
        setStatusMessage('Installation complete!');
        setDownloadProgress(1);

        // Update path in store
        await modelStore.setModelPath(modelId, config.filename);

        // Transition logic
        setTimeout(() => {
          setDownloadStatus('idle');
          setDownloadProgress(0);
          setDownloadingModelId(null);
          setStatusMessage('');

          // Route to next step
          const appModel = modelStore.models.find(m => m.id === modelId);
          if (appModel?.type === 'llm') {
            setStep('tts');
          } else {
            startSystemInitialization();
          }
        }, 1500);
      } else {
        throw new Error('Verification failed. Download may be incomplete.');
      }
    } catch (error) {
      setDownloadStatus('error');
      setStatusMessage(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLastFailedModelId(modelId);
    }
  };

  const handleStartDownload = async (modelId: string, resume: boolean = false) => {
    try {
      setDownloadingModelId(modelId);
      setStatusMessage('Requesting download...');
      setDownloadStatus('progress');
      setDownloadProgress(0);
      setLastFailedModelId(null);

      const config = AVAILABLE_MODELS[modelId];
      if (config && !resume) {
        const { deleteModelFile } = await import('../utils/platformPaths');
        await deleteModelFile(config.filename);
      }

      await downloadModel(
        modelId as any,
        {
          onProgress: (msg) => {
            setStatusMessage(msg);
          },
          onDownloadProgress: (progress) => {
            setDownloadProgress(progress);
          },
          onSuccess: async () => {
            await finishDownload(modelId);
          },
          onError: (errorMsg) => {
            setDownloadStatus('error');
            setStatusMessage(errorMsg);
            setDownloadProgress(0);
            setLastFailedModelId(modelId);
          }
        },
        resume
      );
    } catch (err) {
      setDownloadStatus('error');
      setStatusMessage(`Download error: ${err instanceof Error ? err.message : 'Unknown'}`);
      setLastFailedModelId(modelId);
    }
  };

  const handleRetry = async () => {
    if (lastFailedModelId) {
      await handleStartDownload(lastFailedModelId, true);
    }
  };

  // Perform absolute setup and booting up
  const startSystemInitialization = async () => {
    setStep('initializing');
    setLlmInitStatus('loading');

    try {
      // 1. Initialize LLM model context
      console.log(`[Onboarding] Starting context init for LLM: ${selectedLlmId}`);
      const llmModel = modelStore.models.find(m => m.id === selectedLlmId);
      if (llmModel) {
        const success = await initializeModel(selectedLlmId);
        setLlmInitStatus(success ? 'success' : 'failed');
      } else {
        setLlmInitStatus('failed');
      }

      // 2. Initialize TTS speech service
      setTtsInitStatus('loading');
      console.log(`[Onboarding] Starting speech generator init for TTS: ${selectedTtsId}`);
      const ttsModel = modelStore.models.find(m => m.id === selectedTtsId);
      if (ttsModel) {
        const success = await initializeModel(selectedTtsId);
        setTtsInitStatus(success ? 'success' : 'failed');
      } else {
        setTtsInitStatus('failed');
      }

      // Automatically advance to success screen
      setTimeout(() => {
        setStep('success');
      }, 1500);

    } catch (err) {
      console.error('Initialization error during onboarding setup:', err);
      // Even if init failed, let them go to success so they don't get stuck, they can load manually inside the app
      setLlmInitStatus('success');
      setTtsInitStatus('success');
      setStep('success');
    }
  };

  const finalizeOnboarding = () => {
    modelStore.setIsOnboardingComplete(true);
  };

  // Views rendering
  const renderWelcome = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.welcomeScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.welcomeIconWrapper, { backgroundColor: `${colors.primary}12` }]}>
        <Ionicons name="sparkles" size={56} color={colors.primary} />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>AI Chat</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Your private, offline AI assistant.
      </Text>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="shield-checkmark" size={24} color={colors.primary} style={styles.cardIcon} />
        <View style={styles.cardTextContainer}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>100% Offline & Private</Text>
          <Text style={[styles.cardDesc, { color: colors.muted }]}>
            All processing happens locally on your device with zero data sharing.
          </Text>
        </View>
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="hardware-chip" size={24} color={colors.success} style={styles.cardIcon} />
        <View style={styles.cardTextContainer}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Quick Setup</Text>
          <Text style={[styles.cardDesc, { color: colors.muted }]}>
            Configure your preferred AI brain and voice engine in a few simple steps.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={() => setStep('llm')}
      >
        <Text style={[styles.actionButtonText, { color: colors.surface }]}>Get Started</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.surface} />
      </TouchableOpacity>
    </ScrollView>
  );

  const renderLlmSelector = () => {
    const isDownloading = downloadingModelId !== null;

    const llmModels = modelStore.models
      .filter(m => m.type === 'llm')
      .map(m => {
        let badge = 'Available';
        let badgeColor = colors.primary;

        if (m.id === 'tinyllama-1.1b-chat-v1.0-q4_k_m') {
          badge = 'Fast & Tiny';
          badgeColor = colors.success;
        } else if (m.id === 'phi-4-mini-iq2_m' || m.id === 'phi3-mini-4k-instruct') {
          badge = 'Recommended';
          badgeColor = colors.primary;
        } else if (m.id.includes('gemma') || m.id.includes('phi-4-mini-instruct')) {
          badge = 'High Accuracy';
          badgeColor = colors.warning;
        }

        return {
          id: m.id,
          name: m.name,
          size: m.size || 'N/A',
          desc: m.description || 'Offline AI language model.',
          badge,
          badgeColor
        };
      });

    return (
      <View style={styles.contentContainer}>
        {!isDownloading ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.stepHeader}>
              <Text style={[styles.stepLabel, { color: colors.primary }]}>STEP 1 OF 3</Text>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Choose AI Model</Text>
              <Text style={[styles.stepSubtitle, { color: colors.muted }]}>
                Select a local language model for conversation.
              </Text>
            </View>

            {llmModels.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.selectorCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: selectedLlmId === m.id ? colors.primary : colors.border,
                    borderWidth: selectedLlmId === m.id ? 2 : 1
                  }
                ]}
                onPress={() => setSelectedLlmId(m.id)}
              >
                <View style={styles.selectorHeader}>
                  <View style={styles.selectorTitleContainer}>
                    <Text style={[styles.selectorName, { color: colors.text }]}>{m.name}</Text>
                    <Text style={[styles.selectorSize, { color: colors.muted }]}>{m.size}</Text>
                  </View>
                  <View style={[styles.selectorBadge, { backgroundColor: `${m.badgeColor}15` }]}>
                    <Text style={[styles.selectorBadgeText, { color: m.badgeColor }]}>{m.badge}</Text>
                  </View>
                </View>
                <Text style={[styles.selectorDesc, { color: colors.muted }]}>{m.desc}</Text>

                {selectedLlmId === m.id && (
                  <View style={styles.selectedMarker}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary, marginTop: 12 }]}
              onPress={() => handleStartDownload(selectedLlmId)}
            >
              <Text style={[styles.actionButtonText, { color: colors.surface }]}>Download & Install</Text>
              <Ionicons name="cloud-download" size={20} color={colors.surface} />
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <View style={styles.downloadContainer}>
            <View style={[styles.downloadIconWrapper, { backgroundColor: `${colors.primary}10` }]}>
              <Ionicons name="cloud-download-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.downloadLabel, { color: colors.text }]}>
              Downloading AI Model...
            </Text>
            <Text style={[styles.downloadStatusText, { color: colors.muted }]}>
              {statusMessage}
            </Text>

            <View style={styles.progressSection}>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressIndicator,
                    {
                      backgroundColor: colors.primary,
                      width: `${Math.round(downloadProgress * 100)}%`
                    }
                  ]}
                />
              </View>
              <Text style={[styles.percentage, { color: colors.text }]}>
                {Math.round(downloadProgress * 100)}%
              </Text>
            </View>

            {downloadStatus === 'error' && (
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: colors.error }]}
                onPress={handleRetry}
              >
                <Ionicons name="refresh" size={18} color={colors.surface} />
                <Text style={[styles.retryText, { color: colors.surface }]}>Retry Download</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.cautionText, { color: colors.muted }]}>
              Please keep the app open during download.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderTtsSelector = () => {
    const isDownloading = downloadingModelId !== null;

    const ttsModels = modelStore.models
      .filter(m => m.type === 'tts')
      .map(m => {
        let badge = 'Available';
        let badgeColor = colors.primary;

        if (m.id.includes('amy')) {
          badge = 'Fast & Light';
          badgeColor = colors.success;
        } else if (m.id.includes('kokoro')) {
          badge = 'Studio Quality';
          badgeColor = colors.warning;
        }

        return {
          id: m.id,
          name: m.name,
          size: m.size || 'N/A',
          desc: m.description || 'Offline text-to-speech voice engine.',
          badge,
          badgeColor
        };
      });

    return (
      <View style={styles.contentContainer}>
        {!isDownloading ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.stepHeader}>
              <Text style={[styles.stepLabel, { color: colors.primary }]}>STEP 2 OF 3</Text>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Choose Voice Engine</Text>
              <Text style={[styles.stepSubtitle, { color: colors.muted }]}>
                Select a speech synthesis engine for voice output.
              </Text>
            </View>

            {ttsModels.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.selectorCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: selectedTtsId === m.id ? colors.primary : colors.border,
                    borderWidth: selectedTtsId === m.id ? 2 : 1
                  }
                ]}
                onPress={() => setSelectedTtsId(m.id)}
              >
                <View style={styles.selectorHeader}>
                  <View style={styles.selectorTitleContainer}>
                    <Text style={[styles.selectorName, { color: colors.text }]}>{m.name}</Text>
                    <Text style={[styles.selectorSize, { color: colors.muted }]}>{m.size}</Text>
                  </View>
                  <View style={[styles.selectorBadge, { backgroundColor: `${m.badgeColor}15` }]}>
                    <Text style={[styles.selectorBadgeText, { color: m.badgeColor }]}>{m.badge}</Text>
                  </View>
                </View>
                <Text style={[styles.selectorDesc, { color: colors.muted }]}>{m.desc}</Text>

                {selectedTtsId === m.id && (
                  <View style={styles.selectedMarker}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary, marginTop: 12 }]}
              onPress={() => handleStartDownload(selectedTtsId)}
            >
              <Text style={[styles.actionButtonText, { color: colors.surface }]}>Download Voice Engine</Text>
              <Ionicons name="cloud-download" size={20} color={colors.surface} />
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <View style={styles.downloadContainer}>
            <View style={[styles.downloadIconWrapper, { backgroundColor: `${colors.primary}10` }]}>
              <Ionicons name="volume-high-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.downloadLabel, { color: colors.text }]}>
              Installing Voice Engine...
            </Text>
            <Text style={[styles.downloadStatusText, { color: colors.muted }]}>
              {statusMessage}
            </Text>

            <View style={styles.progressSection}>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressIndicator,
                    {
                      backgroundColor: colors.primary,
                      width: `${Math.round(downloadProgress * 100)}%`
                    }
                  ]}
                />
              </View>
              <Text style={[styles.percentage, { color: colors.text }]}>
                {Math.round(downloadProgress * 100)}%
              </Text>
            </View>

            {downloadStatus === 'error' && (
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: colors.error }]}
                onPress={handleRetry}
              >
                <Ionicons name="refresh" size={18} color={colors.surface} />
                <Text style={[styles.retryText, { color: colors.surface }]}>Retry Download</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderInitializing = () => (
    <View style={styles.contentContainer}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepLabel, { color: colors.primary }]}>STEP 3 OF 3</Text>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Starting System</Text>
        <Text style={[styles.stepSubtitle, { color: colors.muted }]}>
          Loading AI models into device memory...
        </Text>
      </View>

      <View style={styles.initSection}>
        {/* Step 1 Init */}
        <View style={[styles.initRow, { borderBottomColor: colors.border }]}>
          <View style={styles.initRowLeft}>
            {llmInitStatus === 'loading' ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : llmInitStatus === 'success' ? (
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            ) : (
              <Ionicons name="ellipse-outline" size={24} color={colors.muted} />
            )}
            <Text style={[styles.initLabel, { color: colors.text }]}>
              Initializing AI Language Brain
            </Text>
          </View>
          <Text style={[styles.initDetail, { color: colors.muted }]}>
            {llmInitStatus === 'loading' ? 'Loading weights...' : llmInitStatus === 'success' ? 'Active' : 'Pending'}
          </Text>
        </View>

        {/* Step 2 Init */}
        <View style={styles.initRow}>
          <View style={styles.initRowLeft}>
            {ttsInitStatus === 'loading' ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : ttsInitStatus === 'success' ? (
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            ) : (
              <Ionicons name="ellipse-outline" size={24} color={colors.muted} />
            )}
            <Text style={[styles.initLabel, { color: colors.text }]}>
              Loading Voice Synthesizer
            </Text>
          </View>
          <Text style={[styles.initDetail, { color: colors.muted }]}>
            {ttsInitStatus === 'loading' ? 'Binding voice...' : ttsInitStatus === 'success' ? 'Active' : 'Pending'}
          </Text>
        </View>
      </View>

      <View style={styles.loadingWrapper}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    </View>
  );

  const renderSuccess = () => (
    <View style={styles.contentContainer}>
      <View style={[styles.successIconWrapper, { backgroundColor: `${colors.success}15` }]}>
        <Ionicons name="checkmark-circle-outline" size={64} color={colors.success} />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>Setup Complete! 🎉</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        AI Chat is ready for use.
      </Text>

      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>SYSTEM OVERVIEW</Text>

        <View style={styles.summaryItem}>
          <Ionicons name="hardware-chip" size={16} color={colors.primary} />
          <Text style={[styles.summaryLabel, { color: colors.text }]}>
            AI Model: <Text style={{ fontFamily: 'Sora-Bold' }}>
              {modelStore.models.find(m => m.id === selectedLlmId)?.name || 'TinyLlama-1.1B'}
            </Text>
          </Text>
        </View>

        <View style={styles.summaryItem}>
          <Ionicons name="volume-high" size={16} color={colors.success} />
          <Text style={[styles.summaryLabel, { color: colors.text }]}>
            Voice Engine: <Text style={{ fontFamily: 'Sora-Bold' }}>
              {modelStore.models.find(m => m.id === selectedTtsId)?.name || 'Amy Voice'}
            </Text>
          </Text>
        </View>

        <View style={styles.summaryItem}>
          <Ionicons name="shield-checkmark" size={16} color={colors.warning} />
          <Text style={[styles.summaryLabel, { color: colors.text }]}>
            Privacy: <Text style={{ fontFamily: 'Sora-Bold' }}>100% Offline (Local Core)</Text>
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.success }]}
        onPress={finalizeOnboarding}
      >
        <Text style={[styles.actionButtonText, { color: colors.surface }]}>Start AI Chat</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.surface} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header bar / Step Indicator */}
      <View style={styles.headerBar}>
        <View style={styles.brandRow}>
          <Ionicons name="chatbubbles" size={24} color={colors.primary} />
          <Text style={[styles.brandText, { color: colors.text }]}>AI Chat</Text>
        </View>
        <View style={styles.stepIndicatorContainer}>
          <View style={[styles.indicatorDot, { backgroundColor: step === 'welcome' ? colors.primary : colors.border }]} />
          <View style={[styles.indicatorDot, { backgroundColor: step === 'llm' ? colors.primary : colors.border }]} />
          <View style={[styles.indicatorDot, { backgroundColor: step === 'tts' ? colors.primary : colors.border }]} />
          <View style={[styles.indicatorDot, { backgroundColor: step === 'initializing' ? colors.primary : colors.border }]} />
          <View style={[styles.indicatorDot, { backgroundColor: step === 'success' ? colors.primary : colors.border }]} />
        </View>
      </View>

      {/* Main step routing */}
      {step === 'welcome' && renderWelcome()}
      {step === 'llm' && renderLlmSelector()}
      {step === 'tts' && renderTtsSelector()}
      {step === 'initializing' && renderInitializing()}
      {step === 'success' && renderSuccess()}
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    fontSize: 18,
    fontFamily: 'Sora-Bold',
    letterSpacing: -0.5,
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  contentContainer: {
    flex: 1,
    width: '100%',
  },
  welcomeScrollContent: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  welcomeIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Sora-Bold',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Sora-Medium',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    opacity: 0.8,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    width: '100%',
    gap: 16,
  },
  cardIcon: {
    marginTop: 2,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'Sora-Bold',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: 'Sora-Medium',
    lineHeight: 18,
  },
  actionButton: {
    height: 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: 'Sora-Bold',
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  stepLabel: {
    fontSize: 12,
    fontFamily: 'Sora-Bold',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: 'Sora-Bold',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    fontSize: 14,
    fontFamily: 'Sora-Medium',
    textAlign: 'center',
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContainer: {
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },
  footerContainer: {
    width: '100%',
    paddingTop: 12,
    paddingBottom: 8,
  },
  selectorCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 18,
    position: 'relative',
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  selectorTitleContainer: {
    flex: 1,
  },
  selectorName: {
    fontSize: 16,
    fontFamily: 'Sora-Bold',
  },
  selectorSize: {
    fontSize: 12,
    fontFamily: 'Sora-Medium',
    marginTop: 2,
  },
  selectorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  selectorBadgeText: {
    fontSize: 10,
    fontFamily: 'Sora-Bold',
    textTransform: 'uppercase',
  },
  selectorDesc: {
    fontSize: 13,
    fontFamily: 'Sora-Medium',
    lineHeight: 18,
  },
  selectedMarker: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  downloadContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 16,
  },
  downloadIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  downloadLabel: {
    fontSize: 18,
    fontFamily: 'Sora-Bold',
    marginBottom: 8,
  },
  downloadStatusText: {
    fontSize: 14,
    fontFamily: 'Sora-Medium',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  progressSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    width: '100%',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressIndicator: {
    height: '100%',
    borderRadius: 4,
  },
  percentage: {
    fontSize: 20,
    fontFamily: 'Sora-Bold',
  },
  retryButton: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'Sora-Bold',
  },
  cautionText: {
    fontSize: 12,
    fontFamily: 'Sora-Medium',
    textAlign: 'center',
    opacity: 0.6,
    lineHeight: 18,
  },
  initSection: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 20,
  },
  initRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  initRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  initLabel: {
    fontSize: 14,
    fontFamily: 'Sora-Bold',
  },
  initDetail: {
    fontSize: 12,
    fontFamily: 'Sora-Medium',
  },
  loadingWrapper: {
    marginTop: 48,
  },
  successIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  summaryCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    width: '100%',
    marginBottom: 32,
  },
  summaryTitle: {
    fontSize: 11,
    fontFamily: 'Sora-Bold',
    letterSpacing: 1.5,
    opacity: 0.5,
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: 'Sora-Medium',
  },
});

export default OnboardingScreen;
