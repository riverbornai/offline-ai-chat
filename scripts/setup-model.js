#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🤖 Whisper Model Setup Script');
console.log('==============================\n');

const assetsModelsDir = path.join(__dirname, '..', 'assets', 'models');
const modelName = 'ggml-tiny.en-q5_1.bin';
const modelPath = path.join(assetsModelsDir, modelName);

console.log('📁 Checking model directory...');

// Create assets/models directory if it doesn't exist
if (!fs.existsSync(assetsModelsDir)) {
  fs.mkdirSync(assetsModelsDir, { recursive: true });
  console.log('✅ Created assets/models directory');
} else {
  console.log('✅ assets/models directory exists');
}

// Check if model file exists
if (fs.existsSync(modelPath)) {
  const stats = fs.statSync(modelPath);
  const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Model file found: ${modelName} (${fileSizeInMB} MB)`);
  console.log(`📍 Location: ${modelPath}`);
} else {
  console.log(`❌ Model file not found: ${modelName}`);
  console.log('\n📋 Instructions:');
  console.log('1. Download the model file from:');
  console.log('   https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin');
  console.log('2. Place the downloaded file in:');
  console.log(`   ${modelPath}`);
  console.log('3. Restart your development server');
  console.log('\n💡 Alternative: The app will automatically download the model if not found in assets.');
}

console.log('\n🔧 Configuration:');
console.log('- Model name: ggml-tiny.en-q5_1.bin');
console.log('- Model size: ~39 MB');
console.log('- Language: English');
console.log('- Quantization: Q5_1');

console.log('\n📱 Next steps:');
console.log('1. Install whisper.rn: npm install whisper.rn');
console.log('2. Place the model file in assets/models/');
console.log('3. Run: npm start');
console.log('4. Test the speech-to-text functionality');

console.log('\n✨ Setup complete!'); 