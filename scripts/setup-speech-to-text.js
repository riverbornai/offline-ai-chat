#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🎤 Speech-to-Text React Native App Setup\n');

// Check if we're in the right directory
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ Error: package.json not found. Please run this script from the project root.');
  process.exit(1);
}

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

console.log('📋 Checking current setup...\n');

// Check if required dependencies are installed
const requiredDeps = [
  'expo-av',
  'expo-router',
  'react-native',
  'expo'
];

const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);

if (missingDeps.length > 0) {
  console.log('⚠️  Missing dependencies detected:');
  missingDeps.forEach(dep => console.log(`   - ${dep}`));
  console.log('\n📦 Installing missing dependencies...\n');
  
  try {
    execSync(`npm install ${missingDeps.join(' ')}`, { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully!\n');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
} else {
  console.log('✅ All required dependencies are installed!\n');
}

// Check if SpeechToText component exists
const speechToTextPath = path.join(process.cwd(), 'components', 'SpeechToText.tsx');
if (!fs.existsSync(speechToTextPath)) {
  console.error('❌ Error: SpeechToText component not found. Please ensure the component files are in place.');
  process.exit(1);
}

console.log('✅ SpeechToText component found!\n');

// Check Android permissions
const androidManifestPath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(androidManifestPath)) {
  const manifestContent = fs.readFileSync(androidManifestPath, 'utf8');
  if (manifestContent.includes('RECORD_AUDIO')) {
    console.log('✅ Android microphone permission configured!\n');
  } else {
    console.log('⚠️  Android microphone permission not found in AndroidManifest.xml');
    console.log('   Please ensure RECORD_AUDIO permission is added.\n');
  }
}

// Check if main screen is configured
const indexPath = path.join(process.cwd(), 'app', '(tabs)', 'index.tsx');
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  if (indexContent.includes('SpeechToText')) {
    console.log('✅ Main screen configured with SpeechToText component!\n');
  } else {
    console.log('⚠️  SpeechToText component not found in main screen');
    console.log('   Please ensure the component is imported and used in app/(tabs)/index.tsx\n');
  }
}

console.log('🚀 Setup complete! Here\'s what you can do next:\n');

console.log('1. Start the development server:');
console.log('   npm start\n');

console.log('2. Run on your preferred platform:');
console.log('   npm run android    # For Android');
console.log('   npm run ios        # For iOS');
console.log('   npm run web        # For Web\n');

console.log('3. For full Whisper integration:');
console.log('   npm install whisper.rn');
console.log('   # Then update app/(tabs)/index.tsx to use WhisperSpeechToText\n');

console.log('📚 For detailed instructions, see:');
console.log('   - README.md');
console.log('   - SPEECH_TO_TEXT_SETUP.md\n');

console.log('🎤 Happy transcribing!');

// Optional: Check for whisper.rn
const whisperInstalled = packageJson.dependencies['whisper.rn'];
if (!whisperInstalled) {
  console.log('\n💡 Tip: Install whisper.rn for real offline transcription:');
  console.log('   npm install whisper.rn');
} 