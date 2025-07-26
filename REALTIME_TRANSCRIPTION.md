# Real-time Audio Streaming Transcription

This guide explains how to use the real-time audio streaming transcription feature with Whisper.rn in your React Native app.

## Overview

The app now supports real-time audio streaming transcription using Whisper's RealtimeTranscriber. This allows for live transcription as you speak, providing immediate feedback and a more responsive user experience.

## Features

- 🎤 **Real-time Audio Recording**: Continuous audio capture during recording
- 🔄 **Live Transcription**: Text appears as you speak
- ⚡ **Immediate Feedback**: See transcription results in real-time
- 🛑 **Auto-send**: Automatically sends final transcription when complete
- 📱 **Cross-platform**: Works on iOS and Android

## Components

### 1. WhisperService (`services/whisperService.ts`)

The service provides two main transcription modes:

#### Batch Transcription (Original)
```typescript
const result = await whisperService.transcribe(audioFilePath);
console.log(result.text);
```

#### Real-time Transcription (New)
```typescript
await whisperService.startRealtimeTranscription({
  onTranscriptionUpdate: (result) => {
    console.log('Live text:', result.text);
    console.log('Is final:', result.isFinal);
  },
  onError: (error) => {
    console.error('Transcription error:', error);
  },
  onComplete: (finalResult) => {
    console.log('Final result:', finalResult.text);
  }
});
```

### 2. RealtimeChatInput (`components/RealtimeChatInput.tsx`)

A new chat input component that uses real-time transcription:

- Uses `react-native-audio-recorder-player` for audio recording
- Integrates with Whisper's RealtimeTranscriber
- Provides live transcription feedback
- Auto-sends messages when transcription is final

## Usage

### Basic Implementation

```typescript
import { whisperService } from '../services/whisperService';

// Start real-time transcription
await whisperService.startRealtimeTranscription({
  onTranscriptionUpdate: (result) => {
    // Update UI with live transcription
    setTranscription(result.text);
    
    // Auto-send when final
    if (result.isFinal && result.text.trim()) {
      onSendMessage(result.text.trim());
    }
  },
  onError: (error) => {
    Alert.alert('Error', error.message);
  }
});

// Stop transcription
await whisperService.stopRealtimeTranscription();
```

### In ChatScreen

The main chat screen now uses `RealtimeChatInput` instead of the regular `ChatInput`:

```typescript
import RealtimeChatInput from './RealtimeChatInput';

// In your render method
<RealtimeChatInput
  onSendMessage={handleSendMessage}
  isLoading={isLoading}
  colors={colors}
/>
```

## Configuration

### Whisper Configuration (`config/whisperConfig.ts`)

```typescript
export const WHISPER_CONFIG = {
  modelName: 'ggml-tiny.en.bin',
  modelUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
  modelSize: 'tiny',
  language: 'en',
  quantization: null
};
```

### Audio Configuration

The real-time transcription uses these audio settings:
- Sample Rate: 16kHz
- Channels: 1 (Mono)
- Format: WAV (Android) / M4A (iOS)

## Technical Details

### How It Works

1. **Audio Recording**: Uses `react-native-audio-recorder-player` to capture audio
2. **Real-time Processing**: Whisper's RealtimeTranscriber processes audio chunks
3. **Live Updates**: Transcription results are streamed back via callbacks
4. **Auto-completion**: Final transcriptions are automatically sent

### Fallback Mode

If RealtimeTranscriber is not available, the system falls back to batch processing:
- Records the full audio
- Processes it after recording stops
- Provides the same user experience with slight delay

### Error Handling

The system includes comprehensive error handling:
- Permission errors
- Model loading errors
- Transcription errors
- Network errors (if applicable)

## Troubleshooting

### Common Issues

1. **"RealtimeTranscriber not available"**
   - Ensure whisper.rn is properly installed
   - Check that the native module is linked correctly

2. **"Failed to start recording"**
   - Verify microphone permissions
   - Check device audio settings

3. **"No transcription detected"**
   - Speak more clearly
   - Check microphone input levels
   - Ensure quiet environment

### Performance Tips

1. **Model Size**: Use smaller models (tiny, base) for faster real-time processing
2. **Audio Quality**: Ensure good microphone input for better accuracy
3. **Background Noise**: Minimize background noise for better results

## Future Enhancements

- **Audio Buffer Streaming**: Direct audio buffer access for true real-time
- **Multiple Language Support**: Dynamic language switching
- **Custom Models**: Support for custom Whisper models
- **Offline Processing**: Enhanced offline capabilities

## Dependencies

- `whisper.rn`: Core transcription engine
- `react-native-audio-recorder-player`: Audio recording
- `expo-file-system`: File management
- `react-native-tts`: Text-to-speech (for responses)

## API Reference

### WhisperService Methods

```typescript
// Initialize the service
await whisperService.initialize();

// Start real-time transcription
await whisperService.startRealtimeTranscription(callbacks);

// Stop real-time transcription
await whisperService.stopRealtimeTranscription();

// Feed audio data (for advanced usage)
await whisperService.feedAudioData(audioBuffer);

// Check status
const isActive = whisperService.getRealtimeStatus();
const isLoaded = whisperService.isModelLoaded();
```

### Callback Interfaces

```typescript
interface RealtimeTranscriptionCallbacks {
  onTranscriptionUpdate?: (result: RealtimeTranscriptionResult) => void;
  onError?: (error: Error) => void;
  onComplete?: (finalResult: WhisperResult) => void;
}

interface RealtimeTranscriptionResult {
  text: string;
  isFinal: boolean;
  language?: string;
}
``` 