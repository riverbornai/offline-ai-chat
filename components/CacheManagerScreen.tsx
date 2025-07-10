import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import {
    CacheInfo,
    clearAllCache,
    clearCache,
    getCacheInfo,
    smartCleanup
} from '../utils/cacheManager';
import { formatBytes } from '../utils/platformPaths';

interface CacheManagerScreenProps {
  onBack?: () => void;
}

export const CacheManagerScreen: React.FC<CacheManagerScreenProps> = ({ onBack }) => {
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadCacheInfo = async () => {
    try {
      setLoading(true);
      const info = await getCacheInfo();
      setCacheInfo(info);
    } catch (error) {
      console.error('Error loading cache info:', error);
      Alert.alert('Error', 'Failed to load cache information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCacheInfo();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadCacheInfo();
  };

  const handleClearOption = async (type: string, options: any) => {
    Alert.alert(
      `Clear ${type}`,
      `Are you sure you want to clear ${type.toLowerCase()}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setClearing(true);
              await clearCache(options);
              await loadCacheInfo();
              Alert.alert('Success', `${type} cleared successfully`);
            } catch (error) {
              console.error(`Error clearing ${type}:`, error);
              Alert.alert('Error', `Failed to clear ${type.toLowerCase()}`);
            } finally {
              setClearing(false);
            }
          }
        }
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Cache',
      'This will delete ALL models, chat history, downloads, and app cache. This action cannot be undone.\n\nYou will need to re-download models and lose all chat history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              setClearing(true);
              await clearAllCache();
              await loadCacheInfo();
              Alert.alert('Success', 'All cache cleared successfully');
            } catch (error) {
              console.error('Error clearing all cache:', error);
              Alert.alert('Error', 'Failed to clear cache');
            } finally {
              setClearing(false);
            }
          }
        }
      ]
    );
  };

  const handleSmartCleanup = async () => {
    try {
      setClearing(true);
      await smartCleanup();
      await loadCacheInfo();
      Alert.alert('Success', 'Smart cleanup completed');
    } catch (error) {
      console.error('Error during smart cleanup:', error);
      Alert.alert('Error', 'Smart cleanup failed');
    } finally {
      setClearing(false);
    }
  };

  if (loading && !cacheInfo) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Analyzing cache usage...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Cache Manager</Text>
        <Text style={styles.subtitle}>Free up disk space</Text>
      </View>

      {/* Cache Summary */}
      {cacheInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Storage Usage</Text>
          <View style={styles.summaryCard}>
            <View style={styles.totalSize}>
              <Text style={styles.totalSizeLabel}>Total Cache Size</Text>
              <Text style={styles.totalSizeValue}>
                {formatBytes(cacheInfo.totalSize)}
              </Text>
            </View>
            
            <View style={styles.breakdown}>
              <CacheItem
                label="AI Models"
                size={cacheInfo.modelSize}
                count={cacheInfo.details.models.length}
                color="#FF6B6B"
              />
              <CacheItem
                label="Chat History"
                size={cacheInfo.chatSize}
                count={cacheInfo.details.chatSessions}
                color="#4ECDC4"
              />
              <CacheItem
                label="Downloads"
                size={cacheInfo.downloadSize}
                count={cacheInfo.details.downloadFiles.length}
                color="#45B7D1"
              />
              <CacheItem
                label="App Cache"
                size={cacheInfo.appCacheSize}
                count={1}
                color="#96CEB4"
              />
            </View>
          </View>
        </View>
      )}

      {/* Model Details */}
      {cacheInfo && cacheInfo.details.models.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Downloaded Models</Text>
          {cacheInfo.details.models.map((model, index) => (
            <View key={index} style={styles.modelItem}>
              <View style={styles.modelInfo}>
                <Text style={styles.modelName}>{model.name}</Text>
                <Text style={styles.modelSize}>{model.size}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.recommendedAction]}
          onPress={handleSmartCleanup}
          disabled={clearing}
        >
          <Text style={styles.actionButtonText}>
            🧹 Smart Cleanup (Recommended)
          </Text>
          <Text style={styles.actionButtonSubtext}>
            Clear downloads & old chats safely
          </Text>
        </TouchableOpacity>
      </View>

      {/* Manual Options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual Options</Text>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleClearOption('Download Cache', { downloadCache: true })}
          disabled={clearing}
        >
          <Text style={styles.actionButtonText}>Clear Download Cache</Text>
          <Text style={styles.actionButtonSubtext}>
            {formatBytes(cacheInfo?.downloadSize || 0)} • Safe to clear
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleClearOption('Chat History', { chatHistory: true })}
          disabled={clearing}
        >
          <Text style={styles.actionButtonText}>Clear Chat History</Text>
          <Text style={styles.actionButtonSubtext}>
            {cacheInfo?.details.chatSessions || 0} sessions • Will lose all conversations
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleClearOption('AI Models', { models: true })}
          disabled={clearing}
        >
          <Text style={styles.actionButtonText}>Delete AI Models</Text>
          <Text style={styles.actionButtonSubtext}>
            {formatBytes(cacheInfo?.modelSize || 0)} • Will need to re-download
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.dangerAction]}
          onPress={handleClearAll}
          disabled={clearing}
        >
          <Text style={[styles.actionButtonText, styles.dangerText]}>
            Clear All Cache
          </Text>
          <Text style={styles.actionButtonSubtext}>
            Nuclear option • Clears everything
          </Text>
        </TouchableOpacity>
      </View>

      {clearing && (
        <View style={styles.clearingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.clearingText}>Clearing cache...</Text>
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

interface CacheItemProps {
  label: string;
  size: number;
  count: number;
  color: string;
}

const CacheItem: React.FC<CacheItemProps> = ({ label, size, count, color }) => (
  <View style={styles.cacheItem}>
    <View style={[styles.cacheColorBar, { backgroundColor: color }]} />
    <View style={styles.cacheItemContent}>
      <Text style={styles.cacheItemLabel}>{label}</Text>
      <Text style={styles.cacheItemSize}>{formatBytes(size)}</Text>
      <Text style={styles.cacheItemCount}>
        {count} {count === 1 ? 'item' : 'items'}
      </Text>
    </View>
  </View>
);

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#333',
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  totalSize: {
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  totalSizeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  totalSizeValue: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    color: '#333',
  },
  breakdown: {
    gap: 12,
  },
  cacheItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  cacheColorBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  cacheItemContent: {
    flex: 1,
  },
  cacheItemLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#333',
  },
  cacheItemSize: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  cacheItemCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 1,
  },
  modelItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  modelInfo: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  modelName: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#333',
    flex: 1,
  },
  modelSize: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600' as const,
  },
  actionButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  recommendedAction: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
  },
  dangerAction: {
    backgroundColor: '#ffeaea',
    borderColor: '#f44336',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#333',
    marginBottom: 4,
  },
  dangerText: {
    color: '#f44336',
  },
  actionButtonSubtext: {
    fontSize: 14,
    color: '#666',
  },
  clearingOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  clearingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
  },
  bottomSpacer: {
    height: 40,
  },
}; 