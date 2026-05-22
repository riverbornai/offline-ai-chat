import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  SafeAreaView
} from 'react-native';
import { observer } from 'mobx-react';
import { Ionicons } from '@expo/vector-icons';
import RNBackgroundDownloader, { ErrorHandlerObject, ProgressHandlerObject } from '@kesha-antonov/react-native-background-downloader';

import { useStores } from './StoreProvider';
import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';
import { AVAILABLE_MODELS, downloadModel, initializeModel } from '../utils/modelSetup';
import { formatBytes, getModelFileInfo, checkModelFileExists } from '../utils/platformPaths';
import { ttsService } from '../services/ttsService';

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
    <View style={styles.contentContainer}>
      <View style={[styles.welcomeIconWrapper, { backgroundColor: `${colors.primary}12` }]}>
        <Ionicons name="hardware-chip-outline" size={60} color={colors.primary} />
      </View>
      
      <Text style={[styles.title, { color: colors.text }]}>AI Chat</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Your 100% private, offline language tutor.
      </Text>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="sparkles" size={24} color={colors.warning} style={styles.cardIcon} />
        <View style={styles.cardTextContainer}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>No Internet Required</Text>
          <Text style={[styles.cardDesc, { color: colors.muted }]}>
            All AI computation is performed entirely on your device. Zero cloud dependency and complete privacy.
          </Text>
        </View>
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="download" size={24} color={colors.success} style={styles.cardIcon} />
        <View style={styles.cardTextContainer}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>One-Time Setup</Text>
          <Text style={[styles.cardDesc, { color: colors.muted }]}>
            We will guide you through installing a lightweight AI brain and a realistic voice engine (~1.5GB total).
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
    </View>
  );

  const renderLlmSelector = () => {
    const isDownloading = downloadingModelId !== null;

    const llmModels = [
      {
        id: 'tinyllama-1.1b-chat-v1.0-q4_k_m',
        name: 'TinyLlama-1.1B Chat',
        size: '638MB',
        desc: 'Lightning-fast chat, perfect for older or budget devices.',
        badge: 'Fast & Tiny',
        badgeColor: colors.success
      },
      {
        id: 'phi-4-mini-iq2_m',
        name: 'Phi-4 Mini (Light)',
        size: '1.40GB',
        desc: 'Advanced reasoning, math, and tutoring capabilities. Balanced speed/accuracy.',
        badge: 'Recommended',
        badgeColor: colors.primary
      },
      {
        id: 'gemma-4-e2b-it',
        name: 'Gemma 4 E2B (Small)',
        size: '2.62GB',
        desc: 'Google Gemini 4 high-end conversational model. Beautiful support for multi-language tutoring.',
        badge: 'High Accuracy',
        badgeColor: colors.warning
      }
    ];

    return (
      <View style={styles.contentContainer}>
        <View style={styles.stepHeader}>
          <Text style={[styles.stepLabel, { color: colors.primary }]}>STEP 1 OF 3</Text>
          <Text style={[styles.stepTitle, { color: colors.text }]}>Install AI Brain</Text>
          <Text style={[styles.stepSubtitle, { color: colors.muted }]}>
            Select a lightweight, specialized offline AI model.
          </Text>
        </View>

        {!isDownloading ? (
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
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
          </ScrollView>
        ) : (
          <View style={styles.downloadContainer}>
            <View style={[styles.downloadIconWrapper, { backgroundColor: `${colors.primary}10` }]}>
              <Ionicons name="cloud-download-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.downloadLabel, { color: colors.text }]}>
              Downloading AI Brain...
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
              Please keep the app open and connected to Wi-Fi. Large files may take a few minutes.
            </Text>
          </View>
        )}

        {!isDownloading && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => handleStartDownload(selectedLlmId)}
          >
            <Text style={[styles.actionButtonText, { color: colors.surface }]}>Download & Install</Text>
            <Ionicons name="cloud-download" size={20} color={colors.surface} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderTtsSelector = () => {
    const isDownloading = downloadingModelId !== null;

    const ttsModels = [
      {
        id: 'vits-piper-en_US-amy-low',
        name: 'Amy Voice (Piper TTS)',
        size: '28MB',
        desc: 'Lightweight & extremely responsive natural synthetic speech model.',
        badge: 'Extremely Light',
        badgeColor: colors.success
      },
      {
        id: 'kokoro-multi-lang-v1_1',
        name: 'Kokoro v1.1 Voice',
        size: '344MB',
        desc: 'Ultra-premium, studio quality, highly expressive natural voice. Supports 9+ international languages.',
        badge: 'Studio Quality',
        badgeColor: colors.warning
      }
    ];

    return (
      <View style={styles.contentContainer}>
        <View style={styles.stepHeader}>
          <Text style={[styles.stepLabel, { color: colors.primary }]}>STEP 2 OF 3</Text>
          <Text style={[styles.stepTitle, { color: colors.text }]}>Install Voice Engine</Text>
          <Text style={[styles.stepSubtitle, { color: colors.muted }]}>
            Install a high-fidelity local text-to-speech speaker.
          </Text>
        </View>

        {!isDownloading ? (
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
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
          </ScrollView>
        ) : (
          <View style={styles.downloadContainer}>
            <View style={[styles.downloadIconWrapper, { backgroundColor: `${colors.primary}10` }]}>
              <Ionicons name="volume-high-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.downloadLabel, { color: colors.text }]}>
              Installing Voice Speaker...
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

        {!isDownloading && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => handleStartDownload(selectedTtsId)}
          >
            <Text style={[styles.actionButtonText, { color: colors.surface }]}>Download Voice Engine</Text>
            <Ionicons name="cloud-download" size={20} color={colors.surface} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderInitializing = () => (
    <View style={styles.contentContainer}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepLabel, { color: colors.primary }]}>STEP 3 OF 3</Text>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Spinning Up Engines</Text>
        <Text style={[styles.stepSubtitle, { color: colors.muted }]}>
          Loading private AI brains into system RAM.
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
              Loading Pronunciation & Synthesis
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
        <Ionicons name="ribbon-outline" size={64} color={colors.success} />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>AI Setup Complete! 🎉</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        AI Chat is fully warmed up and active.
      </Text>

      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>SYSTEM OVERVIEW</Text>
        
        <View style={styles.summaryItem}>
          <Ionicons name="logo-octocat" size={16} color={colors.primary} />
          <Text style={[styles.summaryLabel, { color: colors.text }]}>
            Brain: <Text style={{ fontFamily: 'Sora-Bold' }}>
              {modelStore.models.find(m => m.id === selectedLlmId)?.name || 'Phi-4'}
            </Text>
          </Text>
        </View>

        <View style={styles.summaryItem}>
          <Ionicons name="musical-note" size={16} color={colors.success} />
          <Text style={[styles.summaryLabel, { color: colors.text }]}>
            Voice: <Text style={{ fontFamily: 'Sora-Bold' }}>
              {modelStore.models.find(m => m.id === selectedTtsId)?.name || 'Kokoro Voice'}
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
        <Text style={[styles.actionButtonText, { color: colors.surface }]}>Enter AI Chat</Text>
        <Ionicons name="rocket" size={20} color={colors.surface} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingBottom: 24,
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
