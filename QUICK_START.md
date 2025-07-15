# 🚀 Quick Start Guide - Speech-to-Text React Native App

Get your speech-to-text app running in minutes!

## ⚡ Super Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the app:**
   ```bash
   npm start
   ```

3. **Choose your platform:**
   - Press `a` for Android
   - Press `i` for iOS  
   - Press `w` for Web

That's it! The app will start with a demo version that includes mock transcription.

## 🎯 What You Get

### Demo Version (Ready Now)
- ✅ Audio recording from microphone
- ✅ Permission handling
- ✅ Mock transcription with realistic delays
- ✅ Beautiful UI with loading states
- ✅ Transcription history
- ✅ Works immediately

### Full Whisper Version (Optional)
- ✅ Real offline speech recognition
- ✅ Whisper model integration
- ✅ Actual transcription
- ✅ Enhanced error handling

## 📱 Features

- **Cross-Platform**: Android, iOS, Web
- **Offline**: No internet required for transcription
- **Modern UI**: Clean, responsive design
- **Permission Handling**: Automatic microphone access
- **Error Recovery**: Comprehensive error handling
- **History**: Save and view transcriptions

## 🔧 Current Setup

The app is **ready to run** with the demo version. You'll see:

1. **Loading Screen**: Simulated model loading
2. **Recording Button**: Tap to start/stop recording
3. **Transcription Display**: Shows mock results
4. **History**: Previous transcriptions
5. **Status Indicators**: Model and permission status

## 🚀 Adding Real Whisper

To enable actual speech recognition:

1. **Install whisper.rn:**
   ```bash
   npm install whisper.rn
   ```

2. **Update the component** in `app/(tabs)/index.tsx`:
   ```typescript
   // Change this line:
   import SpeechToText from '../../components/SpeechToText';
   
   // To this:
   import WhisperSpeechToText from '../../components/WhisperSpeechToText';
   
   // And change the component usage:
   <WhisperSpeechToText />
   ```

3. **Restart the app** - Whisper will download and initialize

## 🐛 Troubleshooting

### Permission Issues
- Grant microphone permission when prompted
- Check device settings if permission is denied
- Restart app after granting permissions

### Recording Problems
- Test on physical device (simulator has limited audio)
- Ensure microphone isn't used by other apps
- Check audio mode configuration

### Build Errors
```bash
# Clear cache
npm run cache:clear

# Reset project
npm run reset-project
```

## 📁 Project Structure

```
vocalo-ai/
├── app/(tabs)/index.tsx          # Main screen
├── components/
│   ├── SpeechToText.tsx          # Demo version (current)
│   └── WhisperSpeechToText.tsx   # Full Whisper version
├── android/                      # Android config
└── package.json                  # Dependencies
```

## 🎤 Usage

1. **Start the app** - `npm start`
2. **Grant microphone permission** when prompted
3. **Tap the microphone button** to start recording
4. **Tap again** to stop and transcribe
5. **View results** in the transcription area

## 📚 Next Steps

- **Demo Version**: Works immediately, great for testing
- **Whisper Version**: Install `whisper.rn` for real transcription
- **Customization**: Modify UI, add features, integrate with other services

## 🆘 Need Help?

- Check `README.md` for detailed documentation
- See `SPEECH_TO_TEXT_SETUP.md` for advanced setup
- Run `npm run setup` for automated setup check

---

**🎉 You're ready to start transcribing! Run `npm start` and begin recording!** 