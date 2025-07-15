# Speech-to-Text React Native App Setup Guide

This project implements offline speech-to-text functionality using React Native and Expo. Currently, it includes a demo version with mock transcription, ready to be extended with real whisper.rn integration.

## Features

- ✅ Microphone permissions for Android and iOS
- ✅ Audio recording from microphone using Expo AV
- ✅ Mock transcription with realistic delays
- ✅ Beautiful UI with loading states and error handling
- ✅ Transcription history
- ✅ Ready for whisper.rn integration

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

## Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Install Expo CLI globally (if not already installed):**
   ```bash
   npm install -g @expo/cli
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

## Running the App

### Android
```bash
npm run android
```

### iOS
```bash
npm run ios
```

### Web
```bash
npm run web
```

## Project Structure

```
vocalo-ai/
├── app/
│   └── (tabs)/
│       └── index.tsx          # Main screen with SpeechToText component
├── components/
│   └── SpeechToText.tsx       # Main speech-to-text component
├── android/                   # Android native configuration
├── ios/                      # iOS native configuration (if using bare workflow)
└── package.json              # Dependencies and scripts
```

## Current Implementation

The app currently includes:

1. **Audio Recording**: Uses Expo's `expo-av` for cross-platform audio recording
2. **Permissions**: Handles microphone permissions for both platforms
3. **Mock Transcription**: Simulates real transcription with random results
4. **UI Components**: 
   - Recording button with visual feedback
   - Loading states for model initialization
   - Transcription display with history
   - Error handling and user feedback

## Adding Real Whisper.rn Integration

To add real offline speech-to-text with whisper.rn:

1. **Install whisper.rn:**
   ```bash
   npm install whisper.rn
   ```

2. **Update the SpeechToText component:**
   Replace the mock transcription in `components/SpeechToText.tsx` with real whisper.rn calls:

   ```typescript
   import { WhisperContext } from 'whisper.rn';

   // In setupWhisper function:
   const context = await WhisperContext.init();
   setWhisperContext(context);

   // In transcribeAudio function:
   const result = await whisperContext.transcribe(audioPath);
   const transcribedText = result.text.trim();
   ```

3. **Configure native modules:**
   - For Android: Add necessary permissions and native module configuration
   - For iOS: Configure audio session and permissions

## Permissions

The app automatically requests microphone permissions when needed:

- **Android**: `RECORD_AUDIO` permission (already in AndroidManifest.xml)
- **iOS**: Audio recording permission (handled by Expo AV)

## Troubleshooting

### Common Issues

1. **Permission Denied:**
   - Ensure microphone permissions are granted in device settings
   - For Android, check that `RECORD_AUDIO` permission is in AndroidManifest.xml

2. **Recording Not Working:**
   - Check that audio mode is properly configured
   - Ensure device microphone is not being used by another app

3. **Build Errors:**
   - Clear cache: `npm run cache:clear`
   - Reset project: `npm run reset-project`

### Development Tips

- Use Expo DevTools for debugging
- Test on physical devices for best audio recording results
- Monitor console logs for detailed error information

## Next Steps

1. **Add Real Whisper Integration:**
   - Install and configure whisper.rn
   - Download and bundle Whisper models
   - Implement real transcription

2. **Enhance Features:**
   - Add language selection
   - Implement real-time transcription
   - Add audio playback
   - Export transcriptions

3. **Performance Optimization:**
   - Optimize model loading
   - Implement background processing
   - Add caching for transcriptions

## Dependencies

Key dependencies used:

- `expo-av`: Audio recording and playback
- `expo-router`: Navigation
- `react-native`: Core framework
- `expo`: Development platform

## License

This project is open source and available under the MIT License. 