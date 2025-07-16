# Speech-to-Text React Native App

A complete React Native application that implements offline speech-to-text functionality using Whisper. The app provides both a demo version with mock transcription and a full implementation ready for whisper.rn integration.

## 🚀 Features

- **Offline Speech Recognition**: Uses Whisper for accurate offline transcription
- **Cross-Platform**: Works on Android, iOS, and Web
- **Beautiful UI**: Modern, responsive design with loading states
- **Permission Handling**: Automatic microphone permission requests
- **Audio Recording**: High-quality audio recording with proper configuration
- **Transcription History**: Save and view previous transcriptions
- **Error Handling**: Comprehensive error handling and user feedback
- **Language Model**: Uses TinyLlama-1.1B-Chat Q4_K_M for chat (https://huggingface.co/cmp-nct/TinyLlama-1.1B-Chat-v1.0-GGUF)

## 📱 Screenshots

The app features a clean, modern interface with:
- Recording button with visual feedback
- Real-time transcription display
- History management
- Status indicators for model and permissions

## 🛠️ Installation & Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Quick Start

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm start
   ```

3. **Run on your preferred platform:**
   ```bash
   # Android
   npm run android
   
   # iOS
   npm run ios
   
   # Web
   npm run web
   ```

## 📁 Project Structure

```
vocalo-ai/
├── app/
│   └── (tabs)/
│       └── index.tsx              # Main screen with SpeechToText
├── components/
│   ├── SpeechToText.tsx           # Demo version (mock transcription)
│   └── WhisperSpeechToText.tsx    # Full whisper.rn implementation
├── android/                       # Android native configuration
├── ios/                          # iOS native configuration
├── package.json                   # Dependencies and scripts
└── SPEECH_TO_TEXT_SETUP.md       # Detailed setup guide
```

## 🔧 Current Implementation

### Demo Version (`SpeechToText.tsx`)
- ✅ Audio recording with Expo AV
- ✅ Microphone permissions
- ✅ Mock transcription with realistic delays
- ✅ Beautiful UI with loading states
- ✅ Transcription history
- ✅ Error handling

### Full Whisper Implementation (`WhisperSpeechToText.tsx`)
- ✅ Real Whisper model integration
- ✅ Model loading with progress indicators
- ✅ Actual speech-to-text transcription
- ✅ Enhanced error handling
- ✅ Retry mechanisms for model loading

## 🎯 Usage

1. **Grant Microphone Permission**: The app will request microphone access on first use
2. **Wait for Model Loading**: The Whisper model will download and initialize (first time only)
3. **Start Recording**: Tap the microphone button to begin recording
4. **Stop Recording**: Tap again to stop and transcribe
5. **View Results**: See your transcription and history

## 🔌 Adding Real Whisper Integration

To enable the full whisper.rn implementation:

1. **Install whisper.rn:**
   ```bash
   npm install whisper.rn
   ```

2. **Update the main screen:**
   Replace `SpeechToText` with `WhisperSpeechToText` in `app/(tabs)/index.tsx`:

   ```typescript
   import WhisperSpeechToText from '../../components/WhisperSpeechToText';
   
   // Replace the component usage
   <WhisperSpeechToText />
   ```

3. **Configure native modules** (if needed):
   - Android: Permissions are already configured
   - iOS: Audio session is handled by Expo AV

## 📋 Permissions

The app automatically handles:
- **Android**: `RECORD_AUDIO` permission (configured in AndroidManifest.xml)
- **iOS**: Audio recording permission (handled by Expo AV)

## 🐛 Troubleshooting

### Common Issues

1. **Permission Denied:**
   - Check device settings for microphone permissions
   - Restart the app after granting permissions

2. **Model Loading Fails:**
   - Check internet connection (required for first-time model download)
   - Ensure sufficient storage space
   - Use the retry button in the error screen

3. **Recording Issues:**
   - Ensure microphone isn't being used by another app
   - Check audio mode configuration
   - Test on physical device (simulator has limited audio support)

4. **Build Errors:**
   ```bash
   # Clear cache
   npm run cache:clear
   
   # Reset project
   npm run reset-project
   ```

### Development Tips

- Test on physical devices for best audio results
- Monitor console logs for detailed error information
- Use Expo DevTools for debugging
- The demo version works immediately without additional setup

## 🚀 Next Steps

1. **Enhanced Features:**
   - Language selection for transcription
   - Real-time transcription streaming
   - Audio playback of recordings
   - Export transcriptions to files

2. **Performance Optimization:**
   - Model caching and optimization
   - Background processing
   - Memory management for large audio files

3. **Advanced Features:**
   - Multiple language support
   - Custom vocabulary training
   - Integration with other AI services

## 📦 Dependencies

### Core Dependencies
- `expo-av`: Audio recording and playback
- `expo-router`: Navigation
- `react-native`: Core framework
- `expo`: Development platform

### For Full Whisper Integration
- `whisper.rn`: Offline speech recognition
- `react-native-audio-recorder-player`: Advanced audio handling
- `react-native-permissions`: Permission management

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the detailed setup guide in `SPEECH_TO_TEXT_SETUP.md`
3. Open an issue on the repository

---

**Ready to start transcribing? Run `npm start` and begin recording!** 🎤

