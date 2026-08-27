#!/usr/bin/env node

/**
 * Cache CLI - Command line interface for managing app cache
 * Usage: node scripts/cache-cli.js [command] [options]
 */

const fs = require('fs');
const path = require('path');

// Simple cache info checker for non-native environment
function getCacheInfoSync() {
  const results = {
    totalSize: 0,
    modelSize: 0,
    chatSize: 0,
    downloadSize: 0,
    appCacheSize: 0,
    details: {
      models: [],
      chatSessions: 0,
      downloadFiles: []
    }
  };

  try {
    // Check for model files (look for .gguf files)
    const possibleModelDirs = [
      'models',
      'assets/models',
      'android/app/src/main/assets/models'
    ];

    for (const dir of possibleModelDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.gguf')) {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            results.modelSize += stats.size;
            results.details.models.push({
              name: file,
              size: formatBytes(stats.size),
              path: filePath
            });
          }
        }
      }
    }

    // Check AsyncStorage data (rough estimate)
    const asyncStorageEstimate = 1024 * 1024; // 1MB estimate
    results.appCacheSize = asyncStorageEstimate;

    // Check download directories
    const downloadDirs = ['downloads', 'tmp'];
    for (const dir of downloadDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          if (fs.statSync(filePath).isFile()) {
            const stats = fs.statSync(filePath);
            results.downloadSize += stats.size;
            results.details.downloadFiles.push(file);
          }
        }
      }
    }

    results.totalSize = results.modelSize + results.chatSize + results.downloadSize + results.appCacheSize;
  } catch (error) {
    console.error('Error getting cache info:', error.message);
  }

  return results;
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function clearModels() {
  const possibleModelDirs = [
    'models',
    'assets/models',
    'android/app/src/main/assets/models'
  ];

  let clearedCount = 0;
  for (const dir of possibleModelDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith('.gguf')) {
          const filePath = path.join(dir, file);
          fs.unlinkSync(filePath);
          console.log(`Deleted: ${filePath}`);
          clearedCount++;
        }
      }
    }
  }
  return clearedCount;
}

function clearDownloads() {
  const downloadDirs = ['downloads', 'tmp'];
  let clearedCount = 0;
  
  for (const dir of downloadDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          console.log(`Deleted: ${filePath}`);
          clearedCount++;
        }
      }
    }
  }
  return clearedCount;
}

function showUsage() {
  console.log(`
Cache CLI - Language Learning App Cache Manager

Usage:
  node scripts/cache-cli.js [command]

Commands:
  info        Show cache usage information
  clear-all   Clear all cache (models, downloads)
  clear-models    Clear only AI models
  clear-downloads Clear only download cache
  help        Show this help message

Examples:
  node scripts/cache-cli.js info
  node scripts/cache-cli.js clear-downloads
  node scripts/cache-cli.js clear-all
`);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'info':
    case 'i':
      const cacheInfo = getCacheInfoSync();
      console.log('\n📊 Cache Usage Summary');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Total Cache Size: ${formatBytes(cacheInfo.totalSize)}`);
      console.log(`┣ AI Models: ${formatBytes(cacheInfo.modelSize)} (${cacheInfo.details.models.length} files)`);
      console.log(`┣ Downloads: ${formatBytes(cacheInfo.downloadSize)} (${cacheInfo.details.downloadFiles.length} files)`);
      console.log(`┗ App Cache: ${formatBytes(cacheInfo.appCacheSize)}`);
      
      if (cacheInfo.details.models.length > 0) {
        console.log('\n🤖 Downloaded Models:');
        cacheInfo.details.models.forEach(model => {
          console.log(`  • ${model.name}: ${model.size}`);
        });
      }
      
      if (cacheInfo.details.downloadFiles.length > 0) {
        console.log('\n📥 Download Files:');
        cacheInfo.details.downloadFiles.forEach(file => {
          console.log(`  • ${file}`);
        });
      }
      
      console.log('\n💡 To clear cache, run: node scripts/cache-cli.js clear-all');
      break;

    case 'clear-all':
      console.log('🧹 Clearing all cache...');
      const modelsCleared = clearModels();
      const downloadsCleared = clearDownloads();
      console.log(`\n✅ Cache cleared successfully!`);
      console.log(`   • Deleted ${modelsCleared} model files`);
      console.log(`   • Deleted ${downloadsCleared} download files`);
      break;

    case 'clear-models':
      console.log('🤖 Clearing AI models...');
      const modelCount = clearModels();
      console.log(`\n✅ Deleted ${modelCount} model files`);
      break;

    case 'clear-downloads':
      console.log('📥 Clearing download cache...');
      const downloadCount = clearDownloads();
      console.log(`\n✅ Deleted ${downloadCount} download files`);
      break;

    case 'help':
    case 'h':
    case '--help':
    case '-h':
      showUsage();
      break;

    default:
      if (command) {
        console.error(`\n❌ Unknown command: ${command}`);
      }
      showUsage();
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { getCacheInfoSync, formatBytes, clearModels, clearDownloads }; 