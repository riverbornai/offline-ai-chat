import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { chatSessionStore } from '../stores/ChatSessionStore';
import { modelStore } from '../stores/ModelStore';
import {
    formatBytes,
    getModelFileInfo,
    getPlatformPaths
} from './platformPaths';
import { Storage } from './storage';

export interface CacheInfo {
  totalSize: number;
  modelSize: number;
  chatSize: number;
  downloadSize: number;
  appCacheSize: number;
  details: {
    models: { name: string; size: string; path: string }[];
    chatSessions: number;
    downloadFiles: string[];
  };
}

export interface ClearOptions {
  models?: boolean;
  chatHistory?: boolean;
  downloadCache?: boolean;
  appCache?: boolean;
}

/**
 * Get detailed information about cache usage
 */
export const getCacheInfo = async (): Promise<CacheInfo> => {
  const isNativePlatform = Platform.OS === 'android' || Platform.OS === 'ios';
  
  let modelSize = 0;
  let downloadSize = 0;
  const modelDetails: { name: string; size: string; path: string }[] = [];
  const downloadFiles: string[] = [];

  if (isNativePlatform) {
    try {
      const paths = await getPlatformPaths();
      
      // Check model files
      for (const model of modelStore.models) {
        if (model.isDownloaded && model.path) {
          const filename = model.path.split('/').pop() || '';
          const info = await getModelFileInfo(filename);
          if (info) {
            modelSize += info.size;
            modelDetails.push({
              name: model.name,
              size: formatBytes(info.size),
              path: model.path
            });
          }
        }
      }

      // Check download directory
      try {
        const downloadDirInfo = await FileSystem.getInfoAsync(paths.downloadDirectory);
        if (downloadDirInfo.exists && downloadDirInfo.isDirectory) {
          const downloadFiles = await FileSystem.readDirectoryAsync(paths.downloadDirectory);
          for (const file of downloadFiles) {
            const filePath = `${paths.downloadDirectory}${file}`;
            const fileInfo = await FileSystem.getInfoAsync(filePath);
            if (fileInfo.exists && !fileInfo.isDirectory) {
              downloadSize += fileInfo.size || 0;
              downloadFiles.push(file);
            }
          }
        }
      } catch (error) {
        console.warn('Could not read download directory:', error);
      }
    } catch (error) {
      console.error('Error getting cache info:', error);
    }
  }

  // Estimate chat history size (rough calculation)
  const chatSessions = chatSessionStore.sessions.length;
  const totalMessages = chatSessionStore.sessions.reduce(
    (sum, session) => sum + session.messages.length, 0
  );
  const estimatedChatSize = totalMessages * 100; // ~100 bytes per message estimate

  // App cache size is harder to calculate precisely
  const appCacheSize = 1024 * 1024; // Estimate 1MB for settings/cache

  return {
    totalSize: modelSize + downloadSize + estimatedChatSize + appCacheSize,
    modelSize,
    chatSize: estimatedChatSize,
    downloadSize,
    appCacheSize,
    details: {
      models: modelDetails,
      chatSessions,
      downloadFiles
    }
  };
};

/**
 * Clear specific types of cache
 */
export const clearCache = async (options: ClearOptions = {}): Promise<void> => {
  const {
    models = false,
    chatHistory = false,
    downloadCache = false,
    appCache = false
  } = options;

  const results: string[] = [];

  try {
    // Clear models
    if (models) {
      let clearedModels = 0;
      for (const model of modelStore.models) {
        if (model.isDownloaded && model.path) {
          const filename = model.path.split('/').pop() || '';
          await modelStore.deleteModel(model.id);
          clearedModels++;
        }
      }
      results.push(`Deleted ${clearedModels} models`);
    }

    // Clear chat history
    if (chatHistory) {
      const sessionCount = chatSessionStore.sessions.length;
      chatSessionStore.clearAllSessions();
      results.push(`Cleared ${sessionCount} chat sessions`);
    }

    // Clear download cache
    if (downloadCache) {
      const isNativePlatform = Platform.OS === 'android' || Platform.OS === 'ios';
      if (isNativePlatform) {
        try {
          const paths = await getPlatformPaths();
          const downloadDirInfo = await FileSystem.getInfoAsync(paths.downloadDirectory);
          
          if (downloadDirInfo.exists && downloadDirInfo.isDirectory) {
            const files = await FileSystem.readDirectoryAsync(paths.downloadDirectory);
            for (const file of files) {
              const filePath = `${paths.downloadDirectory}${file}`;
              await FileSystem.deleteAsync(filePath);
            }
            results.push(`Cleared ${files.length} download files`);
          }
        } catch (error) {
          console.error('Error clearing download cache:', error);
          results.push('Download cache clearing failed');
        }
      }
    }

    // Clear app cache
    if (appCache) {
      try {
        await Storage.clear?.();
        results.push('Cleared app cache');
      } catch (error) {
        console.error('Error clearing app cache:', error);
        results.push('App cache clearing failed');
      }
    }

    console.log('Cache clearing completed:', results.join(', '));
  } catch (error) {
    console.error('Error during cache clearing:', error);
    throw error;
  }
};

/**
 * Clear all cache (nuclear option)
 */
export const clearAllCache = async (): Promise<void> => {
  await clearCache({
    models: true,
    chatHistory: true,
    downloadCache: true,
    appCache: true
  });
};

/**
 * Get formatted cache size summary
 */
export const getCacheSummary = async (): Promise<string> => {
  const cacheInfo = await getCacheInfo();
  
  return `
Cache Usage Summary:
• Total: ${formatBytes(cacheInfo.totalSize)}
• Models: ${formatBytes(cacheInfo.modelSize)} (${cacheInfo.details.models.length} files)
• Chat History: ${formatBytes(cacheInfo.chatSize)} (${cacheInfo.details.chatSessions} sessions)
• Downloads: ${formatBytes(cacheInfo.downloadSize)} (${cacheInfo.details.downloadFiles.length} files)
• App Cache: ${formatBytes(cacheInfo.appCacheSize)}

Model Details:
${cacheInfo.details.models.map(m => `• ${m.name}: ${m.size}`).join('\n')}
`.trim();
};

/**
 * Smart cache cleanup - removes only unnecessary files
 */
export const smartCleanup = async (): Promise<void> => {
  // Clear download cache (safe to remove)
  await clearCache({ downloadCache: true });
  
  // Clear old chat sessions (keep last 10)
  const sessions = chatSessionStore.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  if (sessions.length > 10) {
    const toDelete = sessions.slice(10);
    for (const session of toDelete) {
      chatSessionStore.deleteSession(session.id);
    }
  }
  
  console.log('Smart cleanup completed');
}; 