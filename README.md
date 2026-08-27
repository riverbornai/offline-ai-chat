# 🤖 Offline General AI Chat

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-android%20%7C%20ios-lightgrey.svg)](https://github.com/riverbornai/offline-ai-chat)
[![React Native](https://img.shields.io/badge/React%20Native-0.79-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-53-black.svg)](https://expo.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A fully **offline**, privacy-first AI chat mobile application built with **React Native (Expo)**. Run large language models directly on your device — no internet connection, no cloud, no data collection.

---

## 🎬 Demo

[![Watch Demo Video]<img width="2100" height="3000" alt="download (1)" src="https://github.com/user-attachments/assets/7cff770c-34c9-4a68-ab62-89b22500a22e" />

---

## 📱 Features

| Feature | Description |
|---|---|
| 💬 Chat | Real-time AI conversations with streaming responses |
| 🔊 Voice | Text-to-Speech output using Piper TTS / Kokoro |
| 🎙️ STT | Speech-to-text input via Whisper.rn & Sherpa-ONNX |
| 🧠 Models | Download & switch between multiple LLM models |
| 📦 Offline | 100% on-device inference — no internet required |
| 🌙 Dark Mode | Automatic light/dark theme support |

---

## 🗂️ Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Available AI Models](#available-ai-models)
4. [Prerequisites](#prerequisites)
5. [Installation](#installation)
6. [Running the App](#running-the-app)
7. [First Launch & Onboarding](#first-launch--onboarding)
8. [App Structure](#app-structure)
9. [How It Works — Full Process](#how-it-works--full-process)
10. [State Management](#state-management)
11. [Services](#services)
12. [Configuration](#configuration)
13. [Cache & Storage Management](#cache--storage-management)
14. [Build for Production](#build-for-production)
15. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   React Native (Expo)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐   │
│  │  Chat UI │  │ Models   │  │ Settings │  │  Talk │   │
│  │ (index)  │  │  Tab     │  │   Tab    │  │  Tab  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬───┘   │
│       │              │              │             │       │
│  ┌────▼──────────────▼──────────────▼─────────────▼───┐ │
│  │               MobX Stores (State)                   │ │
│  │   ModelStore (LLM + TTS)  │  ChatSessionStore       │ │
│  └────────────────────────────────────────────────────┘ │
│                         │                               │
│  ┌──────────────────────▼──────────────────────────┐   │
│  │               Native Libraries                   │   │
│  │  @pocketpalai/llama.rn  │  whisper.rn            │   │
│  │  react-native-sherpa-onnx (TTS + STT)            │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo (~53) |
| Language | TypeScript |
| Navigation | Expo Router (file-based) |
| State | MobX + mobx-persist-store |
| LLM Engine | `@pocketpalai/llama.rn` (llama.cpp bindings) |
| Speech-to-Text | `whisper.rn` + `react-native-sherpa-onnx` |
| Text-to-Speech | `react-native-sherpa-onnx` (Piper VITS / Kokoro) |
| Background Downloads | `@kesha-antonov/react-native-background-downloader` |
| Storage | `@react-native-async-storage/async-storage` |
| File System | `expo-file-system` + `@dr.pogodin/react-native-fs` |

---

## Available AI Models

### Language Models (LLM)

| Model | Size | Description |
|---|---|---|
| **TinyLlama 1.1B Chat Q4_K_M** | 638 MB | Lightweight, great for low-memory devices |
| **Phi-3 Mini 4K Instruct** | 2.23 GB | Microsoft's compact reasoning model |
| **Phi-4 Mini (Light) IQ2_M** | 1.40 GB | Ultra-compressed Phi-4 for tight memory budgets |
| **Phi-4 Mini Instruct Q4_K_M** | 2.49 GB | Full Phi-4 Mini — math & reasoning specialist |
| **Gemma 4 E2B (Small) IQ2_M** | 2.62 GB | Google Gemma multimodal, optimized small variant |
| **Gemma 4 E4B IT Q4_K_M** | 5.41 GB | High-performance Google Gemma multimodal |
| **Gemma 2B IT Q4_K_M** | 1.63 GB | Google Gemma 2B instruction-tuned, compact general-purpose chat model |

### Text-to-Speech Models (TTS)

| Model | Size | Languages |
|---|---|---|
| **Amy Low (Piper TTS)** | 63 MB | English |
| **Kokoro v1.1 Multi-lang** | 344 MB | EN, ZH, FR, DE, IT, JA, KO, PT, ES |

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.x
- **Yarn** (recommended) or npm
- **Expo CLI** — `npm install -g expo-cli`
- **Android Studio** (for Android builds) with:
  - Android SDK Platform 34+
  - Android NDK (for native library compilation)
  - Emulator or physical device (API >= 24 / Android 7+)
- **Xcode** >= 15 (for iOS builds) with Command Line Tools
- **CocoaPods** (iOS only) — `sudo gem install cocoapods`

---

## Installation

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd offline-ai-chat
```

### 2. Install Dependencies

```bash
yarn install
# or
npm install
```

> Patch-package runs automatically via the `postinstall` hook to apply any necessary native library patches.

### 3. Set Up Speech Assets (Optional)

If you want to use the bundled speech-to-text setup:

```bash
yarn setup
```

To pre-configure a specific model:

```bash
yarn setup-model
```

---

## Running the App

> **Important:** This app requires native modules (llama.cpp, whisper.rn, sherpa-onnx). You CANNOT use Expo Go. You must use a custom native build.

### Android

```bash
yarn android
# or
npx expo run:android
```

### iOS

```bash
cd ios && pod install && cd ..
yarn ios
# or
npx expo run:ios
```

### Start Metro Bundler Only

```bash
yarn start
```

---

## First Launch & Onboarding

When you first open the app, an **onboarding wizard** guides you through:

```
Step 1: Welcome Screen
   |
   v
Step 2: Choose LLM Model
   - Pick from available LLM models (TinyLlama, Phi-3, Phi-4, Gemma 4)
   - App shows size, description, and language support
   - Tap "Download" -> background download starts
   |
   v
Step 3: Choose TTS Model
   - Pick a Text-to-Speech model (Amy Piper or Kokoro)
   - Amy Low (28 MB) is bundled/fast; Kokoro requires download
   |
   v
Step 4: Initializing
   - LLM context is initialized (llama.cpp loaded into memory)
   - TTS engine is initialized (Sherpa-ONNX loaded)
   |
   v
Step 5: Success -> Main Chat UI
```

Once complete, `isOnboardingComplete` is persisted and the wizard is skipped on future launches.

---

## App Structure

```
offline-ai-chat/
├── app/
│   ├── _layout.tsx              # Root layout, StoreProvider, fonts, splash
│   └── (tabs)/
│       ├── _layout.tsx          # Tab bar configuration
│       ├── index.tsx            # Chat screen entry
│       ├── models.tsx           # Model management tab
│       ├── settings.tsx         # App settings tab
│       ├── talk.tsx             # Voice conversation tab
│       └── storage.tsx          # Cache/storage info tab
│
├── components/
│   ├── OnboardingScreen.tsx     # First-run onboarding wizard
│   ├── ChatScreen.tsx           # Main chat interface
│   ├── ChatHeader.tsx           # Chat top bar with controls
│   ├── MessageBubble.tsx        # Individual message display
│   ├── RealtimeChatInput.tsx    # Text + voice input bar
│   ├── SpeechToText.tsx         # STT component (Sherpa-ONNX)
│   ├── WhisperSpeechToText.tsx  # STT component (Whisper.rn)
│   ├── CacheManagerScreen.tsx   # Cache inspection & clearing
│   └── StoreProvider.tsx        # MobX context provider
│
├── stores/
│   ├── ModelStore.ts            # LLM + TTS model state & inference
│   ├── ChatSessionStore.ts      # Chat sessions & message history
│   └── index.ts                 # Store exports
│
├── services/
│   ├── ttsService.ts            # Sherpa-ONNX TTS engine
│   └── whisperService.ts        # Whisper.rn STT engine
│
├── utils/
│   ├── modelSetup.ts            # Model download & initialization logic
│   ├── platformPaths.ts         # Platform-specific file paths
│   ├── cacheManager.ts          # Cache stats & cleanup utilities
│   ├── chat.ts                  # Chat formatting helpers
│   └── storage.ts               # AsyncStorage adapter
│
├── config/
│   ├── speechConfig.ts          # Speech engine config
│   └── whisperConfig.ts         # Whisper model config
│
├── screens/
│   └── TalkScreen.tsx           # Full voice conversation screen
│
├── constants/
│   └── Colors.ts                # Theme color tokens
│
├── hooks/
│   ├── useColorScheme.ts        # System dark/light mode
│   └── useThemeColor.ts         # Themed color resolver
│
└── scripts/
    ├── cache-cli.js             # CLI for cache management
    ├── setup-model.js           # Model pre-setup script
    └── setup-speech-to-text.js  # STT asset setup script
```

---

## How It Works — Full Process

### 1. App Startup

```
App Launch
  -> _layout.tsx loads
  -> Fonts loaded (expo-font)
  -> Splash screen shown
  -> StoreProvider wraps the app
    -> ModelStore initializes
      -> makePersistable restores saved state from AsyncStorage
      -> syncModels() merges default models with persisted data
      -> initializeStore() runs:
          -> ensureModelDirectories() creates device storage folders
          -> initLlama() loads the llama.rn native library
          -> updateModelStatus() checks which model files exist on disk
          -> If LLM + TTS already downloaded -> auto-complete onboarding
    -> ChatSessionStore initializes
      -> makePersistable restores all previous chat sessions
  -> Expo Router decides:
      isOnboardingComplete == false  -> Show OnboardingScreen
      isOnboardingComplete == true   -> Show Main Tab UI
```

### 2. Model Download Flow

```
User selects a model in Onboarding or Models tab
  -> modelSetup.ts: downloadModel(modelId, progressCallbacks)
  -> platformPaths.ts: downloadModelToStorage(filename, remoteUrl)
  -> RNBackgroundDownloader creates a background task
      -> Progress callbacks (0% to 100%) update UI in real-time
      -> Download continues even if app goes to background
      -> On app re-open: checkForExistingDownloads() resumes tracking
  -> On download complete:
      -> File saved to device internal storage
      -> ModelStore.models[id].isDownloaded = true
      -> File path updated in store
      -> For TTS models with extra files (tokens.txt, voices.bin, espeak-ng-data.zip):
          -> Additional files downloaded sequentially
          -> ZIP files extracted automatically
```

### 3. LLM Context Initialization

```
User taps "Load Model" or onboarding auto-initializes
  -> ModelStore.initContext(model: AppModel)
  -> Validates:
      - model.isDownloaded must be true
      - model.type must be 'llm' (not tts/stt)
  -> Releases any previously loaded LlamaContext
  -> Platform-specific inference settings applied:
      Android : n_ctx=1024, threads=2, batch=256, mlock=false
      iOS     : n_ctx=1536, threads=3, batch=384
      Default : n_ctx=2048, threads=4, batch=512
  -> Large model override (Gemma-4, Phi-4):
      n_ctx capped to min(setting, 512)
      n_batch capped to min(setting, 128)
      mlock disabled to prevent OOM crashes
  -> initLlama({
       model: absoluteFilePath,
       n_ctx, n_gpu_layers, n_threads, n_batch,
       use_mlock, use_mmap: true
     })
  -> Returns LlamaContext stored in ModelStore.context
  -> activeModelId set to model.id
```

### 4. Chat Message Flow (Streaming)

```
User types a message and taps Send
  -> ChatScreen captures input text
  -> ChatSessionStore.addMessage({ author: 'user', text: inputText })
  -> Empty assistant placeholder message created
  -> ModelStore.generateCompletion(prompt, params, onToken)
      -> Prompt built from:
           systemPrompt (from settings)
           + last N conversation messages (formatMessageForContext)
           + current user message
      -> context.completion(completionOptions, tokenCallback)
           completionOptions = {
             prompt, n_predict, temperature, top_p, top_k, stop
           }
           -> Each token received in tokenCallback:
               fullResponse += token
               onToken(token) called
               -> ChatSessionStore.updateMessage(msgId, fullResponse)
               -> MobX triggers UI re-render (streaming effect)
      -> On completion:
           isInferencing = false
           Final response stored in session
  -> If TTS enabled:
       ttsService.speak(fullResponse)
```

### 5. Voice Input — Speech-to-Text Flow

```
User taps the microphone button in RealtimeChatInput
  -> App checks which STT engine is active

  Path A — Whisper.rn (WhisperSpeechToText component):
    -> whisperService.initialize()
        -> Downloads whisper model if not present
        -> initWhisper({ filePath: whisperModelPath })
        -> Stores WhisperContext
    -> context.startRealtimeTranscribe({ language, maxLen })
        -> Audio captured by device microphone
        -> Chunks processed by Whisper ONNX model
        -> onTranscriptionUpdate(result) called with partial text
        -> ChatSessionStore.updateTranscriptionMessage(text, isFinal)
            -> Shows live transcription in chat as 'transcription' type bubble
    -> User taps Stop:
        -> context.stopRealtimeTranscribe()
        -> Final transcription text sent as user message (type: 'conversation')
        -> Transcription bubble replaced with real message

  Path B — Sherpa-ONNX (SpeechToText component):
    -> react-native-sherpa-onnx STT engine initialized
    -> Real-time audio streaming via react-native-audio-record
    -> Streaming transcription results update chat
    -> Final text committed as user message on stop
```

### 6. Text-to-Speech (TTS) Flow

```
AI response generated or user taps speaker icon
  -> ttsService.speak(responseText)
  -> TTSService.splitTextIntoChunks(text):
      -> Strips markdown (bold, italic, code, headers)
      -> Splits at sentence boundaries (.!?) and newlines
      -> Each chunk <= 150 characters for smooth playback
  -> For each chunk (sequential):
      -> SherpaOnnxNative.generateTts(chunkText, speakerId, speed)
          -> ONNX TTS model synthesizes audio
          -> Returns PCM audio data
      -> Audio saved to temporary WAV file (expo-file-system)
      -> expo-av Audio.Sound loaded and played
      -> Next chunk queued after current finishes
  -> On stop() called:
      -> stopRequested flag set
      -> Current audio.Sound.stopAsync() + unloadAsync()
      -> All pending chunks cancelled
      -> Temporary audio files cleaned up
```

### 7. Context Recovery (Fault Tolerance)

```
Mid-conversation: LlamaContext becomes invalid
  -> completion() throws "Context not found" error
  -> ModelStore.generateCompletion catches the error
  -> Calls ModelStore.recoverContext():
       -> Stores activeModelId reference
       -> Clears this.context (frees memory reference)
       -> Calls initContext(activeModel) to reload from disk
       -> New LlamaContext created and stored
  -> Throws: "Context was recovered. Please retry your message."
  -> User re-sends the message with fresh context
```

---

## State Management

### ModelStore

Manages all AI model state and inference:

| Property | Type | Description |
|---|---|---|
| `models` | `AppModel[]` | All available LLM and TTS models |
| `activeModelId` | `string` | Currently loaded LLM model ID |
| `context` | `LlamaContext` | Active llama.rn inference context |
| `isContextLoading` | `boolean` | Context initialization in progress |
| `isInferencing` | `boolean` | Token generation in progress |
| `isOnboardingComplete` | `boolean` | Persisted first-run completion flag |
| `n_context` | `number` | Context window size in tokens |
| `n_threads` | `number` | CPU threads for inference |
| `n_gpu_layers` | `number` | GPU acceleration layers (0 = CPU only) |
| `n_batch` | `number` | Batch size for inference |
| `defaultCompletionParams` | `CompletionParams` | Temperature, top_p, top_k, max_tokens |

**Key Methods:**

| Method | Description |
|---|---|
| `initContext(model)` | Load LLM model into memory |
| `releaseContext()` | Free LLM context from memory |
| `generateCompletion(prompt, params, onToken)` | Stream AI response |
| `downloadModel(modelId)` | Start background model download |
| `updateModelStatus()` | Re-check which model files exist on disk |
| `recoverContext()` | Reload context after crash/loss |

### ChatSessionStore

Manages conversation history:

| Property | Type | Description |
|---|---|---|
| `sessions` | `ChatSession[]` | All chat sessions |
| `activeSessionId` | `string` | Current session ID |
| `isGenerating` | `boolean` | Response generation flag |
| `settings.systemPrompt` | `string` | AI system instruction prompt |

**Key Methods:**

| Method | Description |
|---|---|
| `createSession(title)` | Start a new chat session |
| `addMessage(message)` | Add user or assistant message |
| `updateMessage(id, text)` | Update streaming response text |
| `updateTranscriptionMessage(text)` | Show live STT transcription |
| `clearTranscriptionMessage()` | Remove temporary STT bubble |
| `deleteSession(id)` | Delete a chat session |
| `getRecentMessages(limit)` | Get last N messages for context |

Both stores use **`makePersistable`** with AsyncStorage, so all data survives app restarts.

---

## Services

### `ttsService.ts` — Text-to-Speech

```typescript
import { ttsService } from './services/ttsService';

await ttsService.initialize();          // Load TTS model into ONNX engine
await ttsService.speak("Hello!");       // Synthesize and play audio
ttsService.stop();                      // Stop current playback immediately
```

### `whisperService.ts` — Speech-to-Text

```typescript
import { whisperService } from './services/whisperService';

await whisperService.initialize();      // Load Whisper model
await whisperService.startRealtime({   // Start live transcription
  onTranscriptionUpdate: (result) => {
    console.log(result.text, result.isFinal);
  },
  onComplete: (final) => console.log(final.text),
  onError: (err) => console.error(err),
});
await whisperService.stopRealtime();   // Stop and get final result
```

---

## Configuration

### Context Settings (Advanced)

In the **Settings** tab or programmatically:

```typescript
modelStore.setContextSettings({
  n_context: 1024,     // Token context window (lower = less memory)
  n_threads: 2,        // CPU threads (2-4 recommended for mobile)
  n_batch: 256,        // Inference batch size
  n_gpu_layers: 0,     // GPU acceleration layers (0 = CPU only)
});
```

### Completion Parameters

```typescript
modelStore.updateCompletionParams({
  temperature: 0.7,    // Creativity: 0.0 (deterministic) to 1.0 (creative)
  max_tokens: 100,     // Maximum tokens in response
  top_p: 0.9,          // Nucleus sampling probability threshold
  top_k: 40,           // Top-k token candidates
});
```

### System Prompt

```typescript
chatSessionStore.updateSettings({
  systemPrompt: 'You are a helpful and engaging AI assistant. Provide concise, natural, and helpful answers.',
});
```

---

## Cache & Storage Management

### CLI Scripts

```bash
# View cache info: sizes, model locations, download state
yarn cache:info

# Clear all cached files (models + downloads)
yarn cache:clear

# Clear only downloaded LLM/TTS model files
yarn cache:clear-models

# Clear only incomplete/temporary download files
yarn cache:clear-downloads
```

### In-App Cache Manager

Navigate to the **Storage** tab in the app for:
- Visual storage usage breakdown
- Per-model file management
- One-tap cache clearing options

---

## Build for Production

### EAS Build (Expo Application Services)

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo account
eas login

# Build for Android
eas build --platform android --profile production

# Build for iOS
eas build --platform ios --profile production
```

EAS configuration lives in [`eas.json`](./eas.json).

### Local Native Build

```bash
# Android release APK
npx expo run:android --variant release

# iOS release build
npx expo run:ios --configuration Release
```

---

## Troubleshooting

### "Cannot use Expo Go" / Native module not found

This app requires a custom native build:
```bash
npx expo run:android   # or npx expo run:ios
```

### Model won't load / "Context not found"

1. Go to the **Models** tab
2. Delete the model
3. Re-download the model
4. Tap **Load Model**

Or reduce memory usage in Settings:
```
n_context: 512
n_batch: 128
```

### Out of Memory (OOM) on Android

- Use smaller models: **TinyLlama (638 MB)** or **Phi-4 Mini Light (1.4 GB)**
- Reduce `n_context` to `512` and `n_batch` to `128` in Settings
- Close other background apps
- `largeHeap: true` is already enabled in `app.json`

### TTS not working

1. Check the **Models** tab — ensure a TTS model is downloaded
2. Restart the app after downloading a new TTS model
3. Check device volume and confirm silent mode is off

### Speech-to-Text not working

1. Grant **Microphone** permission when prompted
2. If using Whisper: ensure the whisper model is downloaded
3. Try the Sherpa-ONNX STT engine as an alternative in settings

### Android build fails with Gradle error

```bash
cd android
./gradlew clean
cd ..
npx expo run:android
```

### iOS build fails / pod install issues

```bash
cd ios
pod deintegrate
pod install
cd ..
npx expo run:ios
```

---

## Permissions Required

| Permission | Platform | Purpose |
|---|---|---|
| `RECORD_AUDIO` | Android | Microphone access for STT |
| `MODIFY_AUDIO_SETTINGS` | Android | Audio routing configuration |
| `NSMicrophoneUsageDescription` | iOS | Microphone access for STT |

---

## Acknowledgements

- [llama.cpp](https://github.com/ggerganov/llama.cpp) — Core LLM inference engine
- [@pocketpalai/llama.rn](https://github.com/a16z-infra/llama.rn) — React Native llama.cpp bindings
- [whisper.rn](https://github.com/mybigday/whisper.rn) — Whisper STT for React Native
- [Sherpa-ONNX](https://github.com/k2-fsa/sherpa-onnx) — Offline STT/TTS ONNX runtime
- [Piper TTS](https://github.com/rhasspy/piper) — Fast local neural TTS
- [Kokoro TTS](https://huggingface.co/hexgrad/Kokoro-82M) — Multi-language TTS model
- [Expo](https://expo.dev) — React Native development platform

---

*Built with love — 100% offline, 100% private.*
