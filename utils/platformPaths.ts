import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
// @ts-ignore
import RNBackgroundDownloader, { BeginHandlerObject, DownloadTask, ErrorHandlerObject, ProgressHandlerObject } from '@kesha-antonov/react-native-background-downloader';

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
  'phi-3-mini-4k-instruct-q4.gguf': 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
  'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf': 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
  'ggml-tiny.en.bin': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
  'google_gemma-4-E2B-it-IQ2_M.gguf': 'https://huggingface.co/bartowski/google_gemma-4-E2B-it-GGUF/resolve/main/google_gemma-4-E2B-it-IQ2_M.gguf',
  'google_gemma-4-E4B-it-Q4_K_M.gguf': 'https://huggingface.co/bartowski/google_gemma-4-E4B-it-GGUF/resolve/main/google_gemma-4-E4B-it-Q4_K_M.gguf',
  'Phi-4-mini-instruct-Q4_K_M.gguf': 'https://huggingface.co/bartowski/microsoft_Phi-4-mini-instruct-GGUF/resolve/main/Phi-4-mini-instruct-Q4_K_M.gguf',
  'phi-4-mini-iq2_m.gguf': 'https://huggingface.co/Mungert/Phi-4-mini-instruct.gguf/resolve/main/phi-4-mini-iq2_m.gguf',
  'en_US-amy-low.onnx': 'https://huggingface.co/csukuangfj/vits-piper-en_US-amy-low/resolve/main/en_US-amy-low.onnx?download=true',
  'en_US-amy-low-tokens.txt': 'https://huggingface.co/csukuangfj/vits-piper-en_US-amy-low/resolve/main/tokens.txt?download=true',
  'espeak-ng-data.zip': 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/espeak-ng-data.tar.bz2',
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
 * Download model from URL to storage directory using react-native-background-downloader
 */
export const downloadModelToStorage = async (
  filename: string,
  onProgress?: (progress: number) => void,
  onStatusUpdate?: (message: string) => void,
  expectedSize?: number
): Promise<string> => {
  const isNativePlatform = Platform.OS === 'android' || Platform.OS === 'ios';
  if (!isNativePlatform) throw new Error('Model download is only supported on native platforms');

  const modelPath = await getModelFilePath(filename);
  const downloadUrl = getModelDownloadUrl(filename);
  if (!downloadUrl) throw new Error(`No download URL found for ${filename}`);

  await ensureModelDirectories();

  // Check if file already exists and is complete
  const fileInfo = await FileSystem.getInfoAsync(modelPath);
  const minRequiredSize = expectedSize ? expectedSize * 0.9 : 1024; // 90% of expected size or 1KB for deps

  if (fileInfo.exists && fileInfo.size && fileInfo.size > minRequiredSize) {
    onStatusUpdate?.('Model already exists in storage');
    onProgress?.(1);
    return modelPath;
  }

  // Helper to start or resume download
  const startDownload = async () => {
    // For very small files (less than 5MB or dependencies without expectedSize), 
    // use standard FileSystem.downloadAsync to avoid background downloader overhead/flakiness
    const isSmallFile = expectedSize ? expectedSize < 5 * 1024 * 1024 : true;

    if (isSmallFile) {
      onStatusUpdate?.(`Downloading ${filename}...`);
      try {
        const result = await FileSystem.downloadAsync(downloadUrl, modelPath);
        if (result.status === 200) {
          onStatusUpdate?.(`File downloaded successfully: ${filename}`);
          onProgress?.(1);
          return modelPath;
        } else {
          throw new Error(`Download failed with status ${result.status}`);
        }
      } catch (error) {
        console.error(`Small file download failed for ${filename}:`, error);
        // Fallback to background downloader if standard download fails
      }
    }

    return new Promise<string>((resolve, reject) => {
      const sanitizedId = filename.replace(/\//g, '_');
      let task = RNBackgroundDownloader.download({
        id: sanitizedId,
        url: downloadUrl,
        destination: modelPath.replace('file://', ''),
      })
        .begin(({ expectedBytes }: BeginHandlerObject) => {
          onStatusUpdate?.(`Download started - Expected size: ${formatBytes(expectedBytes)}`);
        })
        .progress(({ bytesDownloaded, bytesTotal }: ProgressHandlerObject) => {
          if (bytesTotal > 0) {
            const progress = bytesDownloaded / bytesTotal;
            onProgress?.(progress);
            onStatusUpdate?.(`Downloaded: ${formatBytes(bytesDownloaded)} / ${formatBytes(bytesTotal)} (${Math.round(progress * 100)}%)`);
          }
        })
        .done(async () => {
          try {
            // Verify the file exists and has reasonable size
            const finalFileInfo = await FileSystem.getInfoAsync(modelPath);
            const verificationSize = expectedSize ? expectedSize * 0.8 : 100; // 80% or 100 bytes for tokens

            if (finalFileInfo.exists && finalFileInfo.size && finalFileInfo.size > verificationSize) {
              onStatusUpdate?.(`Model downloaded successfully - Final size: ${formatBytes(finalFileInfo.size)}`);
              onProgress?.(1);
              resolve(modelPath);
            } else {
              throw new Error(`Downloaded file is incomplete or corrupted (Size: ${finalFileInfo.size || 0} bytes)`);
            }
          } catch (error) {
            reject(new Error(`Download verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        })
        .error(({ error, errorCode }: ErrorHandlerObject) => {
          onStatusUpdate?.('Download failed, will try to resume...');
          const sanitizedId = filename.replace(/\//g, '_');
          RNBackgroundDownloader.checkForExistingDownloads().then((existingTasks: DownloadTask[]) => {
            let existing = existingTasks.find((t: DownloadTask) => t.id === sanitizedId);
            if (existing) {
              existing
                .progress(({ bytesDownloaded, bytesTotal }: ProgressHandlerObject) => {
                  if (bytesTotal > 0) {
                    const progress = bytesDownloaded / bytesTotal;
                    onProgress?.(progress);
                    onStatusUpdate?.(`Resuming: ${formatBytes(bytesDownloaded)} / ${formatBytes(bytesTotal)} (${Math.round(progress * 100)}%)`);
                  }
                })
                .done(async () => {
                  try {
                    // Verify the resumed download
                    const finalFileInfo = await FileSystem.getInfoAsync(modelPath);
                    const verificationSize = expectedSize ? expectedSize * 0.8 : 100;

                    if (finalFileInfo.exists && finalFileInfo.size && finalFileInfo.size > verificationSize) {
                      onStatusUpdate?.(`Model downloaded successfully (resumed) - Final size: ${formatBytes(finalFileInfo.size)}`);
                      onProgress?.(1);
                      resolve(modelPath);
                    } else {
                      throw new Error(`Resumed download is incomplete or corrupted (Size: ${finalFileInfo.size || 0} bytes)`);
                    }
                  } catch (error) {
                    reject(new Error(`Resume verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
                  }
                })
                .error(({ error, errorCode }: ErrorHandlerObject) => {
                  reject(new Error(`Resume failed: ${error}`));
                });
            } else {
              reject(new Error(`Initial download failed: ${error}`));
            }
          }).catch(() => {
            reject(new Error(`Initial download failed: ${error}`));
          });
        });
    });
  };

  return startDownload();
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

    // Create kokoro directory if it doesn't exist
    const kokoroDir = `${paths.modelDirectory}kokoro/`;
    const kokoroDirInfo = await FileSystem.getInfoAsync(kokoroDir);
    if (!kokoroDirInfo.exists) {
      await FileSystem.makeDirectoryAsync(kokoroDir, { intermediates: true });
      console.log(`Created kokoro directory: ${kokoroDir}`);
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

/**
 * Map of filenames to their bundled asset requirements
 * IMPORTANT: This must be updated whenever a new bundled asset is added
 */
const BUNDLED_ASSETS: { [key: string]: any } = {
  // @ts-ignore - The file might not exist yet, but Metro will need it eventually
  'espeak-ng-data.zip': require('../assets/espeak-ng-data.zip'),
};

let isBootstrapping = false;

/**
 * Bootstrap bundled assets by copying them from the app package to the document directory
 * if they don't already exist.
 */
export const bootstrapBundledAssets = async (onProgress?: (message: string) => void): Promise<void> => {
  if (isBootstrapping) {
    console.log('[Bootstrap] Already bootstrapping, skipping...');
    return;
  }
  isBootstrapping = true;

  try {
    const isNativePlatform = Platform.OS === 'android' || Platform.OS === 'ios';
    if (!isNativePlatform) return;

    await ensureModelDirectories();
    const paths = await getPlatformPaths();

    for (const [filename, assetModule] of Object.entries(BUNDLED_ASSETS)) {
      try {
        const targetPath = await getModelFilePath(filename);
        const targetDir = targetPath.replace('.zip', '');
        
        // Check if the extracted folder already exists
        const folderInfo = await FileSystem.getInfoAsync(targetDir);
        if (folderInfo.exists) {
          console.log(`[Bootstrap] ${filename} already extracted at ${targetDir}`);
          continue;
        }

        // Check if the zip file exists
        const fileInfo = await FileSystem.getInfoAsync(targetPath);
        if (fileInfo.exists) {
          console.log(`[Bootstrap] ${filename} already exists at ${targetPath}`);
          continue;
        }

        onProgress?.(`Copying bundled ${filename}...`);
        console.log(`[Bootstrap] Loading bundled asset for ${filename}`);
        
        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();
        
        if (!asset.localUri) {
          throw new Error(`Failed to get local URI for asset ${filename}`);
        }

        console.log(`[Bootstrap] Copying ${asset.localUri} to ${targetPath}`);
        await FileSystem.copyAsync({
          from: asset.localUri,
          to: targetPath,
        });

        // If it's a zip file, we'll let modelSetup handle the extraction 
        // or we can do it here. Let's do it here for espeak-ng-data to be ready.
        if (filename.endsWith('.zip')) {
          onProgress?.(`Extracting ${filename}...`);
          
          // IMPORTANT: Unzip into the PARENT directory if the zip contains a top-level folder
          // For espeak-ng-data.zip, it usually contains a folder named 'espeak-ng-data'
          const unzipTargetDir = paths.modelDirectory; 
          
          console.log(`[Bootstrap] Extracting ${targetPath} to ${unzipTargetDir}`);
          try {
            const { unzip } = await import('react-native-zip-archive');
            await unzip(targetPath.replace('file://', ''), unzipTargetDir.replace('file://', ''));
            console.log(`[Bootstrap] Successfully extracted ${filename}`);
            
            // Optionally delete the zip after extraction to save space
            await FileSystem.deleteAsync(targetPath);
          } catch (unzipError) {
            console.error(`[Bootstrap] Failed to unzip ${filename}:`, unzipError);
          }
        }
      } catch (error) {
        console.warn(`[Bootstrap] Failed to bootstrap ${filename}:`, error);
        // Continue with other assets even if one fails
      }
    }
  } catch (error) {
    console.error(`[Bootstrap] Fatal error in bootstrap:`, error);
  } finally {
    isBootstrapping = false;
  }
};