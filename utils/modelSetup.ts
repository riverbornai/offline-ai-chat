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
const AVAILABLE_MODELS = {
  'phi2-q4km': {
    filename: 'phi-2.Q4_K_M.gguf',
    displayName: 'Phi-2 Q4_K_M (1.3GB)',
    isLocal: false // This model needs to be downloaded
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
    progress?.onProgress?.('Setting up Phi-2 Q4_K_M model...');
    
    // Ensure model directories exist
    await ensureModelDirectories();
    
    // Set up Phi-3 Mini model - check if it exists or needs to be downloaded
    const phi3Config = AVAILABLE_MODELS['phi2-q4km'];
    await setupDownloadableModel('phi2-q4km', phi3Config.filename, progress);
    
    progress?.onProgress?.('Checking existing models...');
    
    // Check if models exist and update status
    await checkExistingModels(progress);
    
    // Try to auto-initialize if Phi-3 is available
    const phi2Ready = await checkModelFileExists(phi3Config.filename, progress?.onProgress);
    if (phi2Ready) {
      progress?.onProgress?.('Initializing Phi-2 Q4_K_M model...');
      const initialized = await initializePhi3Model(progress);
      if (!initialized) {
        progress?.onProgress?.('Model file exists but initialization failed. You can try loading it manually from the Models tab.');
      }
    } else {
      progress?.onProgress?.('Phi-2 Q4_K_M model not found. Please download it first using the Models tab.');
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

// Download and set up model
export const downloadAndSetupModel = async (modelId: keyof typeof AVAILABLE_MODELS, progress?: SetupProgress) => {
  const config = AVAILABLE_MODELS[modelId];
  if (!config) {
    throw new Error(`Model ${modelId} not found`);
  }

  try {
    progress?.onProgress?.(`Starting download of ${config.displayName}...`);
    
    // Download the model
    const modelPath = await downloadModelToStorage(
      config.filename,
      progress?.onDownloadProgress,
      progress?.onProgress
    );

    // Update model store
    await modelStore.setModelPath(modelId, config.filename);
    
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
export const initializePhi3Model = async (progress?: SetupProgress) => {
  try {
    const phi3Model = modelStore.models.find(m => m.id === 'phi2-q4km');
    
    if (!phi3Model) {
      throw new Error('Phi-2 Q4_K_M model not found in model store');
    }
    
    // Check if the model file exists
    const exists = await modelStore.checkModelFileExists('phi2-q4km', progress?.onProgress);
    if (!exists) {
      throw new Error('Phi-2 Q4_K_M model file not found. Please download it first.');
    }
    
    progress?.onProgress?.('Initializing Phi-2 Q4_K_M model context...');
    await modelStore.initContext(phi3Model);
    progress?.onSuccess?.('Phi-2 Q4_K_M model initialized and ready for chat!');
    
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    progress?.onError?.(`Error initializing Phi-2 Q4_K_M model: ${errorMessage}`);
    console.error('Failed to initialize Phi-2 Q4_K_M model:', error);
    
    // Don't throw error during app startup - let user handle it manually
    return false;
  }
};

// Quick setup function - call this from your app startup
export const quickSetup = async (progress?: SetupProgress) => {
  // Set loading state
  modelStore.setQuickSetupLoading(true);
  
  try {
    progress?.onProgress?.('Starting Phi-2 Q4_K_M Setup...');
    
    await setupModels(progress);
    
    // Check if the model is ready
    const phi3Model = modelStore.models.find(m => m.id === 'phi2-q4km');
    if (phi3Model?.isDownloaded) {
      progress?.onSuccess?.(`Setup complete! ${phi3Model.name} is ready. You can now start chatting with local AI!`);
    } else {
      // Model needs to be downloaded - don't fail, just inform user
      progress?.onProgress?.('Model needs to be downloaded. Please use the Models tab to download it.');
      console.log('📱 Model not found - user needs to download it from the Models tab');
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
  const phi3Model = modelStore.models.find(m => m.id === 'phi2-q4km');
  return !!(phi3Model?.isDownloaded && modelStore.context && !modelStore.isContextLoading);
};

// Get model status for debugging
export const getModelStatus = async () => {
  const phi3Model = modelStore.models.find(m => m.id === 'phi2-q4km');
  
  return {
    modelFound: !!phi3Model,
    isDownloaded: phi3Model?.isDownloaded || false,
    hasContext: !!modelStore.context,
    isLoading: modelStore.isContextLoading,
    isReady: isModelReady(),
    modelPath: phi3Model?.path || 'Not set',
    platformPath: phi3Model ? await getModelFilePath(AVAILABLE_MODELS['phi2-q4km'].filename) : 'N/A'
  };
};

// Download model function
export const downloadModel = async (modelId: keyof typeof AVAILABLE_MODELS, progress?: SetupProgress) => {
  return await downloadAndSetupModel(modelId, progress);
};

// Get available models for download
export const getAvailableModels = () => {
  return Object.entries(AVAILABLE_MODELS).map(([id, config]) => ({
    id,
    ...config,
    isDownloaded: modelStore.models.find(m => m.id === id)?.isDownloaded || false
  }));
};

// Set up model that needs to be downloaded
export const setupBundledModel = async (modelId: keyof typeof AVAILABLE_MODELS, progress?: SetupProgress) => {
  // This is now just an alias for downloadAndSetupModel
  return await downloadAndSetupModel(modelId, progress);
}; 