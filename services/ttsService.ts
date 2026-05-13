import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import { saveAudioToFile } from 'react-native-sherpa-onnx/tts';
import SherpaOnnx from 'react-native-sherpa-onnx/src/NativeSherpaOnnx';
import { Audio } from 'expo-av';
import { getPlatformPaths } from '../utils/platformPaths';

export interface TTSOptions {
  speakerId?: number;
  speed?: number;
  useSystemTTS?: boolean;
}

class TTSService {
  private isLoaded: boolean = false;
  private isLoading: boolean = false;
  private instanceId: string | null = null;
  private currentModelId: string | null = null;
  private sound: Audio.Sound | null = null;
  private useSystemTTS: boolean = false;

  constructor() {
    this.instanceId = `tts_${Date.now()}`;
  }

  async initialize(modelId: string = 'vits-piper-en_US-amy-low'): Promise<void> {
    if (this.isLoading) return;
    
    // If we've already decided to use system TTS, we're "loaded"
    if (this.useSystemTTS) {
      this.isLoaded = true;
      return;
    }

    console.log(`[TTSService] Initializing with model: ${modelId}`);
    this.isLoading = true;

    try {
      const paths = await getPlatformPaths();
      const modelDir = paths.modelDirectory;
      const amyDir = `${modelDir}vits-piper-en_US-amy-low/`;
      
      // 1. Ensure directory exists
      const amyDirInfo = await FileSystem.getInfoAsync(amyDir);
      if (!amyDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(amyDir, { intermediates: true });
      }

      // 2. Map existing files to required Sherpa-Onnx names
      const originalOnnx = `${modelDir}en_US-amy-low.onnx`;
      const originalTokens = `${modelDir}en_US-amy-low-tokens.txt`;
      const targetOnnx = `${amyDir}model.onnx`;
      const targetTokens = `${amyDir}tokens.txt`;

      // Check if original files exist
      const onnxExists = await FileSystem.getInfoAsync(originalOnnx);
      const tokensExists = await FileSystem.getInfoAsync(originalTokens);

      if (!onnxExists.exists) {
        console.warn('[TTSService] Amy ONNX file not found at:', originalOnnx);
        this.useSystemTTS = true;
      } else {
        // Copy files if they don't exist in the target directory yet
        if (!(await FileSystem.getInfoAsync(targetOnnx)).exists) {
          await FileSystem.copyAsync({ from: originalOnnx, to: targetOnnx });
        }
        if (tokensExists.exists && !(await FileSystem.getInfoAsync(targetTokens)).exists) {
          await FileSystem.copyAsync({ from: originalTokens, to: targetTokens });
        }

        const nativePath = amyDir.endsWith('/') ? amyDir.slice(0, -1) : amyDir;
        const finalNativePath = nativePath.replace('file://', '');
        
        console.log(`[TTSService] Initializing native SherpaOnnx at ${finalNativePath}`);
        
        const result = await SherpaOnnx.initializeTts(
          this.instanceId!,
          finalNativePath,
          'vits',
          1,            // numThreads
          false,        // debug
          Number.NaN,   // noiseScale
          Number.NaN,   // noiseScaleW
          Number.NaN,   // lengthScale
          '',           // ruleFsts
          '',           // ruleFars
          Number.NaN,   // maxNumSentences
          Number.NaN,   // silenceScale
          'cpu'         // provider
        );

        if (result.success) {
          this.isLoaded = true;
          this.currentModelId = modelId;
          this.useSystemTTS = false;
          console.log('[TTSService] SherpaOnnx initialized successfully');
        } else {
          throw new Error(result.error || 'Native init failed');
        }
      }
    } catch (error) {
      console.error('[TTSService] SherpaOnnx failed, falling back to System TTS:', error);
      this.useSystemTTS = true;
      this.isLoaded = true; // System TTS is always ready
    } finally {
      this.isLoading = false;
    }
  }

  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    // Determine engine to use
    const forceSystem = options.useSystemTTS || this.useSystemTTS;

    if (!this.isLoaded && !forceSystem) {
      await this.initialize();
    }

    try {
      if (forceSystem) {
        console.log('[TTSService] Using System TTS (expo-speech)');
        await Speech.speak(text, {
          rate: options.speed || 1.0,
          onStart: () => console.log('[TTSService] System playback started'),
          onError: (e) => console.error('[TTSService] System playback error:', e),
        });
      } else {
        console.log(`[TTSService] Generating Amy speech: ${text.substring(0, 30)}...`);
        
        const audio = await SherpaOnnx.generateTts(
          this.instanceId!,
          text,
          {
            sid: options.speakerId || 0,
            speed: options.speed || 1.0,
          }
        );

        const paths = await getPlatformPaths();
        const tempPath = `${paths.documentsDirectory}temp_tts.wav`;
        await saveAudioToFile(audio, tempPath.replace('file://', ''));

        if (this.sound) {
          try { await this.sound.unloadAsync(); } catch (e) {}
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: tempPath },
          { shouldPlay: true }
        );
        this.sound = sound;
      }
    } catch (error) {
      console.error('[TTSService] Speak failed:', error);
      // Fallback to system on failure if not already using it
      if (!forceSystem) {
        this.useSystemTTS = true;
        return this.speak(text, options);
      }
    }
  }

  async stop(): Promise<void> {
    if (this.useSystemTTS) {
      await Speech.stop();
    } else if (this.sound) {
      try { await this.sound.stopAsync(); } catch (e) {}
    }
  }

  async cleanup(): Promise<void> {
    if (this.instanceId) {
      try { await SherpaOnnx.unloadTts(this.instanceId); } catch (e) {}
    }
    if (this.sound) {
      try { await this.sound.unloadAsync(); } catch (e) {}
    }
    this.isLoaded = false;
    this.useSystemTTS = false;
    console.log('[TTSService] Cleaned up');
  }

  getIsLoaded(): boolean { return this.isLoaded; }
  getIsLoading(): boolean { return this.isLoading; }
}

export const ttsService = new TTSService();
