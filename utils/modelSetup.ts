import RNBackgroundDownloader, { ErrorHandlerObject, ProgressHandlerObject } from '@kesha-antonov/react-native-background-downloader';
import { modelStore } from '../stores/ModelStore';
import {
    checkModelAvailableForDownload,
    checkModelFileExists,
    downloadModelToStorage,
    ensureModelDirectories,
    formatBytes,
    getModelFileInfo,
    getModelFilePath
} from './platformPaths';

// Configuration for available models
interface AvailableModelConfig {
  filename: string;
  additionalFiles?: string[];
  displayName: string;
  isLocal: boolean;
  expectedSize: number;
}
export const AVAILABLE_MODELS: { [key: string]: AvailableModelConfig } = {
  'phi3-mini-4k-instruct': {
    filename: 'phi-3-mini-4k-instruct-q4.gguf',
    displayName: 'Phi-3 Mini 4K Instruct (2.23GB)',
    isLocal: false,
    expectedSize: 2.23 * 1024 * 1024 * 1024 // 2.23GB in bytes (app download verified)
  },
  'tinyllama-1.1b-chat-v1.0-q4_k_m': {
    filename: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    displayName: 'TinyLlama-1.1B Chat v1.0 Q4_K_M (638MB)',
    isLocal: false,
    expectedSize: 638 * 1024 * 1024 // 638MB in bytes (browser verified)
  },
  'gemma-4-e2b-it': {
    filename: 'google_gemma-4-E2B-it-IQ2_M.gguf',
    displayName: 'Gemma 4 E2B (Small) (2.62GB)',
    isLocal: false,
    expectedSize: 2.62 * 1024 * 1024 * 1024
  },
  'gemma-4-e4b-it': {
    filename: 'google_gemma-4-E4B-it-Q4_K_M.gguf',
    displayName: 'Gemma 4 E4B IT (5.41GB)',
    isLocal: false,
    expectedSize: 5.41 * 1024 * 1024 * 1024
  },
  'phi-4-mini-instruct': {
    filename: 'Phi-4-mini-instruct-Q4_K_M.gguf',
    displayName: 'Phi-4 Mini / Reasoning (2.49GB)',
    isLocal: false,
    expectedSize: 2.49 * 1024 * 1024 * 1024
  },
  'kokoro-82m-v1.0': {
    filename: 'kokoro-82m-v1.0.onnx',
    additionalFiles: ['kokoro-voices.bin', 'kokoro-tokens.txt'],
    displayName: 'Kokoro-82M TTS (310MB)',
    isLocal: false,
    expectedSize: 310 * 1024 * 1024
  }
};

// Interface for setup progress callbacks
interface SetupProgress {
  onProgress?: (message: string) => void;
  onDownloadProgress?: (progress: number) => void;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

// Helper function to set up your models with correct platform paths
export const setupModels = async (progress?: SetupProgress) => {
  try {
    progress?.onProgress?.('Setting up Language Learning models (Phi-3, TinyLlama, and Gemma 4)...');
    
    // Ensure model directories exist
    await ensureModelDirectories();
    
    // Set up Phi-3 Mini model - check if it exists or needs to be downloaded
    for (const modelId of Object.keys(AVAILABLE_MODELS)) {
      const config = AVAILABLE_MODELS[modelId];
      await setupDownloadableModel(modelId, config.filename, progress);
    }
    
    progress?.onProgress?.('Checking existing models...');
    
    // Check if models exist and update status
    await checkExistingModels(progress);
    
    // Try to auto-initialize if Phi-3 is available
    for (const modelId of Object.keys(AVAILABLE_MODELS)) {
      const config = AVAILABLE_MODELS[modelId];
      const ready = await checkModelFileExists(config.filename, progress?.onProgress);
      const fullyDownloaded = await isModelFullyDownloaded(config.filename, config.expectedSize);
      if (ready && fullyDownloaded) {
        progress?.onProgress?.(`Initializing ${config.displayName} model...`);
        await initializeModel(modelId, progress);
      } else if (ready && !fullyDownloaded) {
        progress?.onError?.(`${config.displayName} is not fully downloaded. Please resume download.`);
      } else {
        progress?.onProgress?.(`${config.displayName} model not found. Please download it first using the Models tab.`);
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    progress?.onError?.(`Error setting up model: ${errorMessage}`);
    throw error;
  }
};

// Set up downloadable model
const setupDownloadableModel = async (modelId: string, filename: string, progress?: SetupProgress) => {
  try {
    progress?.onProgress?.(`Setting up ${filename}...`);
    
    // Check if the model already exists
    const modelExists = await checkModelFileExists(filename, progress?.onProgress);
    
    if (modelExists) {
      // Model already exists, just update the store
      await modelStore.setModelPath(modelId, filename);
      progress?.onProgress?.(`Model ${filename} already available`);
      return;
    }

    // Check if model is available for download
    const canDownload = await checkModelAvailableForDownload(filename);
    if (!canDownload) {
      throw new Error(`Model ${filename} is not available for download`);
    }

    // Model doesn't exist, user needs to download it
    progress?.onProgress?.(`Model ${filename} needs to be downloaded`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    progress?.onError?.(`Error setting up model ${filename}: ${errorMessage}`);
    throw error;
  }
};

// Add this helper
const isModelFullyDownloaded = async (filename: string, expectedSize: number): Promise<boolean> => {
  const info = await getModelFileInfo(filename);
  const TOLERANCE = 50 * 1024 * 1024; // 50MB tolerance for large models
  return !!info && info.exists && info.size >= (expectedSize - TOLERANCE);
};

// Download and set up model
export const downloadAndSetupModel = async (modelId: keyof typeof AVAILABLE_MODELS, progress?: SetupProgress, resume: boolean = false) => {
  const config = AVAILABLE_MODELS[modelId];
  if (!config) {
    throw new Error(`Model ${modelId} not found`);
  }

  try {
    progress?.onProgress?.(`Starting download of ${config.displayName}...`);

    if (resume) {
      // Try to resume existing download
      const existingTasks = await RNBackgroundDownloader.checkForExistingDownloads();
      const task = existingTasks.find(t => t.id === config.filename);
      if (task && task.state !== 'DONE' && task.state !== 'FAILED') {
        // Attach handlers to existing task
        task
          .progress(({ bytesDownloaded, bytesTotal }: ProgressHandlerObject) => {
            if (bytesTotal > 0) progress?.onDownloadProgress?.(bytesDownloaded / bytesTotal);
          })
          .done(() => {
            progress?.onSuccess?.(`${config.displayName} downloaded and ready!`);
          })
          .error(({ error }: ErrorHandlerObject) => {
            progress?.onError?.(`Failed to download ${config.displayName}: ${error}`);
          });
        // Show current progress immediately
        if (task.bytesTotal > 0) progress?.onDownloadProgress?.(task.bytesDownloaded / task.bytesTotal);
        progress?.onProgress?.('Resuming background download...');
        return;
      } else {
        progress?.onError?.('No resumable download found. Please start a new download.');
        throw new Error('No resumable download found.');
      }
    }

    // Download the main model
    const modelPath = await downloadModelToStorage(
      config.filename,
      (p) => {
        // If there are additional files, we need to adjust progress
        const factor = config.additionalFiles ? 1 / (1 + config.additionalFiles.length) : 1;
        progress?.onDownloadProgress?.(p * factor);
      },
      progress?.onProgress
    );

    // Download additional files if any
    if (config.additionalFiles) {
      for (let i = 0; i < config.additionalFiles.length; i++) {
        const extraFile = config.additionalFiles[i];
        const factor = 1 / (1 + config.additionalFiles.length);
        const baseProgress = (i + 1) * factor;
        
        await downloadModelToStorage(
          extraFile,
          (p) => progress?.onDownloadProgress?.(baseProgress + (p * factor)),
          (msg) => progress?.onProgress?.(`Downloading dependency: ${extraFile}...`)
        );
      }
    }

    // Update model store
    await modelStore.setModelPath(String(modelId), String(config.filename));

    progress?.onSuccess?.(`${config.displayName} downloaded and ready!`);

    return modelPath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    progress?.onError?.(`Failed to download ${config.displayName}: ${errorMessage}`);
    throw error;
  }
};

// Check existing models and update their status
const checkExistingModels = async (progress?: SetupProgress) => {
  progress?.onProgress?.('Checking for existing models...');
  
  for (const [modelId, config] of Object.entries(AVAILABLE_MODELS)) {
    try {
      const exists = await checkModelFileExists(config.filename, progress?.onProgress);
      if (exists) {
        const info = await getModelFileInfo(config.filename);
        progress?.onProgress?.(`Found ${config.displayName} ${info ? `(${formatBytes(info.size)})` : '(unknown size)'}`);
        await modelStore.setModelPath(modelId, config.filename);
      } else {
        progress?.onProgress?.(`${config.displayName} not found - needs to be downloaded`);
      }
    } catch (error) {
      progress?.onError?.(`Error checking ${config.displayName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};

// Initialize Phi-3 model context
export const initializeModel = async (modelId: string, progress?: SetupProgress) => {
  try {
    const model = modelStore.models.find(m => m.id === modelId);
    
    if (!model) {
      throw new Error(`${modelId} model not found in model store`);
    }
    
    // Check if the model file exists
    const exists = await modelStore.checkModelFileExists(modelId, progress?.onProgress);
    if (!exists) {
      throw new Error(`${modelId} model file not found. Please download it first.`);
    }
    
    progress?.onProgress?.(`Initializing ${model.name} model context...`);
    await modelStore.initContext(model);
    progress?.onSuccess?.(`${model.name} model initialized and ready for chat!`);
    
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    progress?.onError?.(`Error initializing model: ${errorMessage}`);
    console.error('Failed to initialize model:', error);
    
    // Don't throw error during app startup - let user handle it manually
    return false;
  }
};

// Quick setup function - call this from your app startup
export const quickSetup = async (progress?: SetupProgress) => {
  // Set loading state
  modelStore.setQuickSetupLoading(true);
  
  try {
    progress?.onProgress?.('Starting Model Setup...');
    
    await setupModels(progress);
    
    // Check if the model is ready
    let anyReady = false;
    for (const modelId of Object.keys(AVAILABLE_MODELS)) {
      const model = modelStore.models.find(m => m.id === modelId);
      if (model?.isDownloaded) {
        progress?.onSuccess?.(`Setup complete! ${model.name} is ready. You can now start chatting with local AI!`);
        anyReady = true;
      }
    }
    if (!anyReady) {
      progress?.onProgress?.('No models found - please use the Models tab to download them.');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    progress?.onError?.(`Model setup failed: ${errorMessage}`);
    console.error('Model setup failed:', error);
    
    // Don't throw error - allow app to continue working
    // The user can manually set up the model from the Models tab
  } finally {
    // Clear loading state
    modelStore.setQuickSetupLoading(false);
  }
};

// Check if model is ready for use
export const isModelReady = (): boolean => {
  return Object.keys(AVAILABLE_MODELS).some(modelId => {
    const model = modelStore.models.find(m => m.id === modelId);
    return !!(model?.isDownloaded && modelStore.context && !modelStore.isContextLoading);
  });
};

// Get model status for debugging
export const getModelStatus = async () => {
  const phi3Model = modelStore.models.find(m => m.id === 'phi3-mini-4k-instruct');
  
  return {
    modelFound: !!phi3Model,
    isDownloaded: phi3Model?.isDownloaded || false,
    hasContext: !!modelStore.context,
    isLoading: modelStore.isContextLoading,
    isReady: isModelReady(),
    modelPath: phi3Model?.path || 'Not set',
    platformPath: phi3Model ? await getModelFilePath(AVAILABLE_MODELS['phi3-mini-4k-instruct'].filename) : 'N/A'
  };
};

// Download model function
export const downloadModel = async (modelId: keyof typeof AVAILABLE_MODELS, progress?: SetupProgress, resume: boolean = false) => {
  return await downloadAndSetupModel(modelId, progress, resume);
};

// Get available models for download
export const getAvailableModels = () => {
  return Object.entries(AVAILABLE_MODELS).map(([id, config]) => ({
    id: String(id),
    ...config,
    isDownloaded: modelStore.models.find(m => m.id === String(id))?.isDownloaded || false
  }));
};

// Set up model that needs to be downloaded
export const setupBundledModel = async (modelId: keyof typeof AVAILABLE_MODELS, progress?: SetupProgress) => {
  // This is now just an alias for downloadAndSetupModel
  return await downloadAndSetupModel(modelId, progress);
}; 