import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import { saveAudioToFile, detectTtsModel } from 'react-native-sherpa-onnx/tts';
import { Audio } from 'expo-av';
import { getPlatformPaths, getModelFilePath } from '../utils/platformPaths';
import { modelStore } from '../stores/ModelStore';

// Import the native bridge directly to bypass high-level API bugs and ensure type safety
// @ts-ignore
import SherpaOnnxNative from 'react-native-sherpa-onnx/src/NativeSherpaOnnx';

export interface TTSOptions {
  speakerId?: number;
  speed?: number;
  useSystemTTS?: boolean;
}

class TTSService {
  private isLoaded: boolean = false;
  private isLoading: boolean = false;
  private engine: any = null;
  private activeModelId: string | null = null;
  private sound: Audio.Sound | null = null;
  private useSystemTTS: boolean = false;
  private initPromise: Promise<void> | null = null;

  async initialize(modelId: string = 'vits-piper-en_US-amy-low'): Promise<void> {
    if (this.isLoaded && this.activeModelId === modelId && this.engine) return;
    
    if (this.initPromise) {
      console.log('[TTSService] Waiting for existing initialization...');
      return this.initPromise;
    }

    this.isLoading = true;
    this.initPromise = (async () => {
      try {
        console.log(`[TTSService] Initializing model: ${modelId}`);

        const model = modelStore.models.find((m) => m.id === modelId);
        if (!model || !model.isDownloaded) {
          throw new Error(`Model ${modelId} not found or not downloaded`);
        }

        // 1. Cleanup existing engine
        if (this.engine) {
          try {
            await this.engine.destroy();
          } catch (e) {
            console.warn('[TTSService] Error destroying previous engine:', e);
          }
          this.engine = null;
        }

        // 2. Isolate Piper model files into a dedicated directory
        // SherpaOnnx works best when the model directory only contains the relevant model files.
        const paths = await getPlatformPaths();
        const piperDir = `${paths.modelDirectory}piper/`;
        
        // Ensure piper directory exists
        const piperDirInfo = await FileSystem.getInfoAsync(piperDir);
        if (!piperDirInfo.exists) {
          await FileSystem.makeDirectoryAsync(piperDir, { intermediates: true });
        }

        const modelPath = model.path.startsWith('/') || model.path.startsWith('file://')
          ? model.path
          : await getModelFilePath(model.path);
        
        const originalOnnx = modelPath.replace('file://', '');
        const originalTokens = originalOnnx.replace('.onnx', '-tokens.txt');
        const targetOnnx = `${piperDir}model.onnx`.replace('file://', '');
        const targetTokens = `${piperDir}tokens.txt`.replace('file://', '');

        console.log('[TTSService] Isolating Piper files...');
        
        // Copy files to dedicated directory if they don't exist there yet
        if (!(await FileSystem.getInfoAsync(`file://${targetOnnx}`)).exists) {
          await FileSystem.copyAsync({ from: `file://${originalOnnx}`, to: `file://${targetOnnx}` });
        }
        
        const tokensSourceInfo = await FileSystem.getInfoAsync(`file://${originalTokens}`);
        if (tokensSourceInfo.exists && !(await FileSystem.getInfoAsync(`file://${targetTokens}`)).exists) {
          await FileSystem.copyAsync({ from: `file://${originalTokens}`, to: `file://${targetTokens}` });
        }

        // 2.5 Ensure lexicon.txt exists (even if empty) to prevent native crashes in some VITS models
        const targetLexicon = `${piperDir}lexicon.txt`.replace('file://', '');
        if (!(await FileSystem.getInfoAsync(`file://${targetLexicon}`)).exists) {
          await FileSystem.writeAsStringAsync(`file://${targetLexicon}`, '');
        }

        const modelDir = piperDir.replace('file://', '').replace(/\/$/, '');
        console.log(`[TTSService] Initializing native engine at isolated path: ${modelDir}`);

        // 2.7 Ensure espeak-ng-data exists in the isolated folder
        const sourceEspeak = `${paths.modelDirectory}espeak-ng-data`;
        const targetEspeak = `${piperDir}espeak-ng-data`;
        const espeakInfo = await FileSystem.getInfoAsync(sourceEspeak);
        if (espeakInfo.exists && espeakInfo.isDirectory) {
          const targetEspeakInfo = await FileSystem.getInfoAsync(targetEspeak);
          if (!targetEspeakInfo.exists) {
            console.log('[TTSService] Copying espeak-ng-data to isolated folder...');
            // Unfortunately expo-file-system copyAsync doesn't support recursive directory copy easily on all versions
            // but we can try. If it fails, we'll log it.
            try {
              await FileSystem.copyAsync({ from: sourceEspeak, to: targetEspeak });
            } catch (e) {
              console.warn('[TTSService] Failed to copy espeak-ng-data directory:', e);
            }
          }
        } else {
          console.log('[TTSService] espeak-ng-data NOT found in main models directory. Piper might produce silence.');
        }

        // 3. Verify model structure with detectTtsModel before initializing
        console.log(`[TTSService] Detecting model structure at: ${modelDir}`);
        const detection = await detectTtsModel({ type: 'file', path: modelDir });
        
        if (!detection.success) {
          console.warn(`[TTSService] Model detection failed: ${detection.error || 'Unknown structure'}`);
          // We will still try to initialize but with a warning
        } else {
          console.log(`[TTSService] Detected model type: ${detection.modelType}`);
        }

        // Use a consistent instance ID to ensure the native helper releases the previous engine
        const instanceId = 'main_tts_instance';
        
        if (!SherpaOnnxNative) {
          throw new Error('Native SherpaOnnx module not found. Please rebuild the app.');
        }

        // Hint GC to free memory before heavy allocation
        console.log('[TTSService] Requesting GC before native init...');
        
        // Pass EXPLICIT non-null defaults for all parameters to prevent JNI crashes
        // We use detection.modelType if available, otherwise fallback to 'vits'
        const effectiveModelType = detection.modelType || 'vits';
        const result = await SherpaOnnxNative.initializeTts(
          instanceId,
          modelDir,
          effectiveModelType,
          1,           // numThreads: 1 for low-memory stability
          true,        // debug: enabled to see native logs
          0.667,       // noiseScale
          0.8,         // noiseScaleW
          1.0,         // lengthScale
          '',          // ruleFsts
          '',          // ruleFars
          1,           // maxNumSentences: must be integer
          1.0,         // silenceScale
          'cpu'        // provider
        );

        if (!result || !result.success) {
          throw new Error(result?.error || 'Native initialization failed');
        }

        // 4. Create engine wrapper
        this.engine = {
          instanceId,
          generateSpeech: async (text: string, options?: any) => {
            return SherpaOnnxNative.generateTts(instanceId, text, options || {});
          },
          destroy: async () => {
            return SherpaOnnxNative.unloadTts(instanceId);
          }
        };

        this.isLoaded = true;
        this.activeModelId = modelId;
        this.useSystemTTS = false;
        
        // Get model info for debugging
        try {
          const sampleRate = await SherpaOnnxNative.getTtsSampleRate(instanceId);
          const numSpeakers = await SherpaOnnxNative.getTtsNumSpeakers(instanceId);
          console.log(`[TTSService] TTS Info: SampleRate=${sampleRate}, Speakers=${numSpeakers}`);
        } catch (e) {
          console.warn('[TTSService] Could not get TTS model info:', e);
        }

        console.log(`[TTSService] TTS engine initialized successfully for ${modelId}`);
      } catch (error) {
        console.error('[TTSService] TTS initialization failed, falling back to System TTS:', error);
        this.isLoaded = true; // Mark as loaded so it doesn't try again immediately
        this.useSystemTTS = true;
        this.engine = null;
      } finally {
        this.isLoading = false;
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    const forceSystem = options.useSystemTTS || this.useSystemTTS;

    if (!this.isLoaded && !forceSystem) {
      await this.initialize();
    }

    try {
      // Ensure audio mode is set for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      if (forceSystem) {
        console.log('[TTSService] Using System TTS (expo-speech)');
        await Speech.speak(text, {
          rate: options.speed || 1.0,
        });
      } else {
        if (!this.engine) throw new Error('TTS engine missing');

        console.log(`[TTSService] Generating speech: ${text.substring(0, 30)}...`);
        const startTime = Date.now();
        
        const audio = await this.engine.generateSpeech(text, {
          sid: options.speakerId !== undefined ? options.speakerId : 0,
          speed: options.speed || 1.0,
        });

        const genTime = Date.now() - startTime;
        console.log(`[TTSService] Audio generated in ${genTime}ms. Samples: ${audio?.samples?.length || 0}`);

        // DETECT TRUNCATED AUDIO: If audio is too short (e.g. only padding/silence), fallback to system
        // 2304 samples at 22kHz is ~100ms. A sentence should be much longer.
        const durationSeconds = (audio?.samples?.length || 0) / (audio?.sampleRate || 22050);
        const isSuspiciouslyShort = durationSeconds < 0.3 && text.length > 5;

        if (!audio || !audio.samples || audio.samples.length === 0 || isSuspiciouslyShort) {
          console.warn(`[TTSService] Generated audio is ${isSuspiciouslyShort ? 'too short' : 'empty'}. Falling back to System TTS.`);
          this.useSystemTTS = true;
          return this.speak(text, options);
        }

        const paths = await getPlatformPaths();
        const tempPath = `${paths.documentsDirectory}temp_tts.wav`.replace('file://', '');
        
        console.log(`[TTSService] Saving audio to: ${tempPath}`);
        const saveStart = Date.now();
        await saveAudioToFile(audio, tempPath);
        console.log(`[TTSService] Audio saved in ${Date.now() - saveStart}ms`);

        if (this.sound) {
          try { await this.sound.unloadAsync(); } catch (e) {}
        }
        
        console.log(`[TTSService] Loading audio with expo-av: file://${tempPath}`);
        try {
          const { sound, status } = await Audio.Sound.createAsync(
            { uri: `file://${tempPath}` },
            { shouldPlay: true, volume: 1.0 }
          );
          this.sound = sound;
          
          if (status.isLoaded) {
            console.log(`[TTSService] Playback started. Duration: ${status.durationMillis}ms`);
          } else {
            console.warn('[TTSService] Sound loaded but not playing immediately');
          }
        } catch (audioError) {
          console.error('[TTSService] expo-av playback failed:', audioError);
          // Fallback to system TTS if playback fails
          this.useSystemTTS = true;
          return this.speak(text, options);
        }
      }
    } catch (error) {
      console.error('[TTSService] Speak failed:', error);
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
    if (this.engine) {
      try { await this.engine.destroy(); } catch (e) {}
      this.engine = null;
    }
    if (this.sound) {
      try { await this.sound.unloadAsync(); } catch (e) {}
      this.sound = null;
    }
    this.isLoaded = false;
    this.activeModelId = null;
    this.useSystemTTS = false;
    console.log('[TTSService] Cleaned up');
  }

  getIsLoaded(): boolean { return this.isLoaded; }
  getIsLoading(): boolean { return this.isLoading; }
}

export const ttsService = new TTSService();
