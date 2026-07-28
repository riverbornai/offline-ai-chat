import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
    Platform,
    StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';
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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
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
      'This will delete ALL models, chat history, downloads, and app cache. This action cannot be undone.',
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
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Analyzing storage usage...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
            <Text style={[styles.backButtonText, { color: colors.primary }]}>Back</Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.title, { color: colors.text }]}>Storage</Text>
        <Text style={[styles.subtitle, { color: colors.text, opacity: 0.7 }]}>Manage your app's disk space usage</Text>
      </View>

      {cacheInfo && (
        <View style={styles.section}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.totalSizeContainer}>
              <Text style={[styles.totalSizeLabel, { color: colors.text }]}>Total Storage Used</Text>
              <Text style={[styles.totalSizeValue, { color: colors.text }]}>
                {formatBytes(cacheInfo.totalSize)}
              </Text>
            </View>
            
            <View style={styles.breakdown}>
              <CacheItem
                label="AI Models"
                size={cacheInfo.modelSize}
                count={cacheInfo.details.models.length}
                color={colors.error}
                icon="cube-outline"
                colors={colors}
              />
              <CacheItem
                label="Chat History"
                size={cacheInfo.chatSize}
                count={cacheInfo.details.chatSessions}
                color={colors.primary}
                icon="chatbubbles-outline"
                colors={colors}
              />
              <CacheItem
                label="Temp Files"
                size={cacheInfo.downloadSize}
                count={cacheInfo.details.downloadFiles.length}
                color={colors.warning}
                icon="cloud-download-outline"
                colors={colors}
              />
            </View>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Maintenance</Text>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: `${colors.success}10`, borderColor: colors.success }]}
          onPress={handleSmartCleanup}
          disabled={clearing}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: colors.success }]}>
            <Ionicons name="sparkles" size={24} color={colors.surface} />
          </View>
          <View style={styles.actionContent}>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Smart Cleanup</Text>
            <Text style={[styles.actionSubtitle, { color: colors.text }]}>Automatically remove redundant temp files and cache safely.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.success} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Manual Control</Text>
        
        <ManualActionItem
          title="Clear Temporary Downloads"
          subtitle={`${formatBytes(cacheInfo?.downloadSize || 0)} cached files`}
          onPress={() => handleClearOption('Download Cache', { downloadCache: true })}
          disabled={clearing}
          colors={colors}
          icon="download-outline"
        />

        <ManualActionItem
          title="Clear Conversation History"
          subtitle={`${cacheInfo?.details.chatSessions || 0} local chat sessions`}
          onPress={() => handleClearOption('Chat History', { chatHistory: true })}
          disabled={clearing}
          colors={colors}
          icon="trash-outline"
        />

        <ManualActionItem
          title="Delete AI Models"
          subtitle={`${formatBytes(cacheInfo?.modelSize || 0)} across ${cacheInfo?.details.models.length || 0} models`}
          onPress={() => handleClearOption('AI Models', { models: true })}
          disabled={clearing}
          colors={colors}
          icon="cube-outline"
        />

        <TouchableOpacity
          style={[styles.dangerCard, { borderColor: colors.error + '40' }]}
          onPress={handleClearAll}
          disabled={clearing}
        >
          <Ionicons name="nuclear-outline" size={20} color={colors.error} />
          <Text style={[styles.dangerText, { color: colors.error }]}>Reset All Data & Storage</Text>
        </TouchableOpacity>
      </View>

      {clearing && (
        <View style={styles.clearingOverlay}>
          <ActivityIndicator size="large" color={colors.surface} />
          <Text style={[styles.clearingText, { color: colors.surface }]}>Optimizing storage...</Text>
        </View>
      )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const CacheItem: React.FC<{ label: string; size: number; count: number; color: string; icon: any; colors: any }> = ({ label, size, count, color, icon, colors }) => (
  <View style={styles.cacheItem}>
    <View style={[styles.cacheIconWrapper, { backgroundColor: `${color}15` }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <View style={styles.cacheItemContent}>
      <Text style={[styles.cacheItemLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.cacheItemSub, { color: colors.text }]}>
        {formatBytes(size)} • {count} {count === 1 ? 'item' : 'items'}
      </Text>
    </View>
  </View>
);

const ManualActionItem: React.FC<{ title: string; subtitle: string; onPress: () => void; disabled: boolean; colors: any; icon: any }> = ({ title, subtitle, onPress, disabled, colors, icon }) => (
  <TouchableOpacity
    style={[styles.manualCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    onPress={onPress}
    disabled={disabled}
  >
    <View style={[styles.manualIconContainer, { backgroundColor: `${colors.primary}10` }]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
    </View>
    <View style={styles.manualContent}>
      <Text style={[styles.manualTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.manualSubtitle, { color: colors.text }]}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    fontFamily: 'Sora-Bold',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 20 : 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: 'Sora-Bold',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Sora-Bold',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Sora-Medium',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Sora-Bold',
    marginBottom: 16,
    paddingLeft: 4,
  },
  summaryCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  totalSizeContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  totalSizeLabel: {
    fontSize: 14,
    fontFamily: 'Sora-Bold',
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  totalSizeValue: {
    fontSize: 40,
    fontFamily: 'Sora-Bold',
    letterSpacing: -1,
  },
  breakdown: {
    gap: 16,
  },
  cacheItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cacheIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cacheItemContent: {
    flex: 1,
  },
  cacheItemLabel: {
    fontSize: 16,
    fontFamily: 'Sora-Bold',
    marginBottom: 2,
  },
  cacheItemSub: {
    fontSize: 13,
    fontFamily: 'Sora-Medium',
    opacity: 0.5,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 16,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    fontFamily: 'Sora-Bold',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.7,
    fontFamily: 'Sora-Medium',
  },
  manualCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    gap: 16,
  },
  manualIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualContent: {
    flex: 1,
  },
  manualTitle: {
    fontSize: 15,
    fontFamily: 'Sora-Bold',
    marginBottom: 2,
  },
  manualSubtitle: {
    fontSize: 12,
    opacity: 0.5,
    fontFamily: 'Sora-Medium',
  },
  dangerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
    gap: 10,
  },
  dangerText: {
    fontSize: 15,
    fontFamily: 'Sora-Bold',
  },
  clearingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  clearingText: {
    marginTop: 20,
    fontSize: 16,
    fontFamily: 'Sora-Bold',
  },
  bottomSpacer: {
    height: 60,
  },
});