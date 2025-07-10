import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// Fallback paths for development/web environments
const getFallbackPaths = () => {
  return {
    modelDirectory: '/tmp/models',
    downloadDirectory: '/tmp/downloads',
    documentsDirectory: '/tmp/documents',
  };
};

export interface PlatformPaths {
  modelDirectory: string;
  downloadDirectory: string;
  documentsDirectory: string;
}

// Model download URLs - replace with actual download URLs
const MODEL_DOWNLOAD_URLS: { [key: string]: string } = {
  'Phi-3-mini-4k-instruct-q4.gguf': 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
};

/**
 * Get platform-specific directories for model storage
 */
export const getPlatformPaths = async (): Promise<PlatformPaths> => {
  const isAndroid = Platform.OS === 'android';
  const isIOS = Platform.OS === 'ios';
  
  // For development/web environments, use fallback paths
  if (!isAndroid && !isIOS) {
    return getFallbackPaths();
  }

  // Use Expo FileSystem directories
  const documentsDirectory = FileSystem.documentDirectory!;
  
  if (isAndroid) {
    return {
      modelDirectory: `${documentsDirectory}models/`,
      downloadDirectory: `${documentsDirectory}downloads/`,
      documentsDirectory: documentsDirectory,
    };
  } else if (isIOS) {
    return {
      modelDirectory: `${documentsDirectory}models/`,
      downloadDirectory: `${documentsDirectory}downloads/`,
      documentsDirectory: documentsDirectory,
    };
  }

  return getFallbackPaths();
};

/**
 * Get the full path for a model file
 */
export const getModelFilePath = async (filename: string): Promise<string> => {
  const paths = await getPlatformPaths();
  return `${paths.modelDirectory}${filename}`;
};

/**
 * Get the download path for a model file
 */
export const getModelDownloadPath = async (filename: string): Promise<string> => {
  const paths = await getPlatformPaths();
  return `${paths.downloadDirectory}${filename}`;
};

/**
 * Get the download URL for a model file
 */
export const getModelDownloadUrl = (filename: string): string => {
  return MODEL_DOWNLOAD_URLS[filename] || '';
};

/**
 * Check if a model is available for download
 */
export const checkModelAvailableForDownload = async (filename: string): Promise<boolean> => {
  return filename in MODEL_DOWNLOAD_URLS;
};

/**
 * Download model from URL to storage directory
 */
export const downloadModelToStorage = async (
  filename: string, 
  onProgress?: (progress: number) => void,
  onStatusUpdate?: (message: string) => void
): Promise<string> => {
  const isNativePlatform = Platform.OS === 'android' || Platform.OS === 'ios';
  
  if (!isNativePlatform) {
    throw new Error('Model download is only supported on native platforms');
  }

  const modelPath = await getModelFilePath(filename);
  const downloadUrl = getModelDownloadUrl(filename);
  
  if (!downloadUrl) {
    throw new Error(`No download URL found for ${filename}`);
  }

  try {
    // Ensure model directory exists
    await ensureModelDirectories();

    // Check if file already exists in storage
    const fileInfo = await FileSystem.getInfoAsync(modelPath);
    if (fileInfo.exists) {
      onStatusUpdate?.(`Model already exists in storage`);
      return modelPath;
    }

    onStatusUpdate?.(`Downloading ${filename}...`);
    
    // Download the model file
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      modelPath,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        onProgress?.(progress);
      }
    );

    const result = await downloadResumable.downloadAsync();
    
    if (result && result.status === 200) {
      onStatusUpdate?.(`Model downloaded successfully`);
      return modelPath;
    } else {
      throw new Error(`Failed to download model: ${result?.status || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error downloading model:', error);
    throw error;
  }
};

/**
 * Ensure model directories exist
 */
export const ensureModelDirectories = async (): Promise<void> => {
  const isNativePlatform = Platform.OS === 'android' || Platform.OS === 'ios';
  
  if (!isNativePlatform) {
    console.log('Skipping directory creation on non-native platform');
    return;
  }

  const paths = await getPlatformPaths();
  
  try {
    // Create model directory if it doesn't exist
    const modelDirInfo = await FileSystem.getInfoAsync(paths.modelDirectory);
    if (!modelDirInfo.exists) {
      await FileSystem.makeDirectoryAsync(paths.modelDirectory, { intermediates: true });
      console.log(`Created model directory: ${paths.modelDirectory}`);
    }

    // Create download directory if it doesn't exist
    const downloadDirInfo = await FileSystem.getInfoAsync(paths.downloadDirectory);
    if (!downloadDirInfo.exists) {
      await FileSystem.makeDirectoryAsync(paths.downloadDirectory, { intermediates: true });
      console.log(`Created download directory: ${paths.downloadDirectory}`);
    }
  } catch (error) {
    console.error('Error creating model directories:', error);
    throw error;
  }
};

/**
 * Check if a model file exists in storage
 */
export const checkModelFileExists = async (filename: string, onProgress?: (message: string) => void): Promise<boolean> => {
  const isNativePlatform = Platform.OS === 'android' || Platform.OS === 'ios';
  
  if (!isNativePlatform) {
    // For development, return false to indicate model needs to be downloaded
    return false;
  }

  // Check if the model exists in storage
  const modelPath = await getModelFilePath(filename);
  try {
    const fileInfo = await FileSystem.getInfoAsync(modelPath);
    return fileInfo.exists;
  } catch (error) {
    console.error('Error checking model file in storage:', error);
    return false;
  }
};

/**
 * Move a model file from download location to model directory
 */
export const moveModelToStorage = async (filename: string): Promise<string> => {
  const isNativePlatform = Platform.OS === 'android' || Platform.OS === 'ios';
  
  if (!isNativePlatform) {
    throw new Error('Move operation not supported on non-native platforms');
  }

  const downloadPath = await getModelDownloadPath(filename);
  const modelPath = await getModelFilePath(filename);

  try {
    // Ensure model directory exists
    await ensureModelDirectories();

    // Check if file exists in download location
    const downloadInfo = await FileSystem.getInfoAsync(downloadPath);
    if (!downloadInfo.exists) {
      throw new Error(`Model file not found at download path: ${downloadPath}`);
    }

    // Move file to model directory
    await FileSystem.moveAsync({
      from: downloadPath,
      to: modelPath
    });
    console.log(`Moved model from ${downloadPath} to ${modelPath}`);
    
    return modelPath;
  } catch (error) {
    console.error('Error moving model file:', error);
    throw error;
  }
};

/**
 * Get model file info (size, etc.)
 */
export const getModelFileInfo = async (filename: string): Promise<any | null> => {
  const isNativePlatform = Platform.OS === 'android' || Platform.OS === 'ios';
  
  if (!isNativePlatform) {
    console.log('Skipping file info on non-native platform');
    return null;
  }

  const modelPath = await getModelFilePath(filename);
  try {
    const fileInfo = await FileSystem.getInfoAsync(modelPath);
    if (!fileInfo.exists) return null;
    
    return fileInfo;
  } catch (error) {
    console.error('Error getting model file info:', error);
    return null;
  }
};

/**
 * Format bytes to human readable format
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Delete a model file
 */
export const deleteModelFile = async (filename: string): Promise<void> => {
  const isNativePlatform = Platform.OS === 'android' || Platform.OS === 'ios';
  
  if (!isNativePlatform) {
    console.log('Skipping file deletion on non-native platform');
    return;
  }

  const modelPath = await getModelFilePath(filename);
  try {
    const fileInfo = await FileSystem.getInfoAsync(modelPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(modelPath);
      console.log(`Deleted model file: ${modelPath}`);
    }
  } catch (error) {
    console.error('Error deleting model file:', error);
    throw error;
  }
}; 