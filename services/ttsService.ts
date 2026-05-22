import * as FileSystem from 'expo-file-system';
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
}

class TTSService {
  private isLoaded: boolean = false;
  private isLoading: boolean = false;
  private engine: any = null;
  private activeModelId: string | null = null;
  private sound: Audio.Sound | null = null;
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

        // 2. Isolate model files into a dedicated directory based on type
        // SherpaOnnx works best when the model directory only contains relevant files.
        const paths = await getPlatformPaths();
        
        // Use a generic isolation directory based on model ID to avoid conflicts
        // but keep it simple enough for the native side.
        const modelTypeDir = modelId.includes('kokoro') ? 'kokoro' : 'piper';
        const isolatedDir = `${paths.modelDirectory}${modelTypeDir}/`;
        
        // Ensure isolation directory exists
        const dirInfo = await FileSystem.getInfoAsync(isolatedDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(isolatedDir, { intermediates: true });
        }

        const modelPath = model.path.startsWith('/') || model.path.startsWith('file://')
          ? model.path
          : await getModelFilePath(model.path);
        
        const basePath = modelPath.replace('file://', '').replace('.onnx', '');
        const originalOnnx = `${basePath}.onnx`;
        const originalTokens = `${basePath}-tokens.txt`;
        const originalVoices = `${basePath}-voices.bin`;
        
        const targetOnnx = `${isolatedDir}model.onnx`.replace('file://', '');
        const targetTokens = `${isolatedDir}tokens.txt`.replace('file://', '');
        const targetVoices = `${isolatedDir}voices.bin`.replace('file://', '');

        console.log(`[TTSService] Isolating ${modelTypeDir} files...`);
        
        // Helper to copy/move and verify
        const ensureFile = async (source: string, target: string, expectedSize?: number) => {
          const targetPath = `file://${target}`;
          const sourcePath = `file://${source}`;
          
          const targetInfo = await FileSystem.getInfoAsync(targetPath);
          if (targetInfo.exists) {
            // If it exists but is significantly smaller than source, it might be corrupted/incomplete
            const sourceInfo = await FileSystem.getInfoAsync(sourcePath);
            if (sourceInfo.exists && Math.abs(targetInfo.size - sourceInfo.size) < 1024) {
              return; // Already exists and size matches
            }
            console.log(`[TTSService] Target file size mismatch or corrupted, replacing: ${target}`);
            await FileSystem.deleteAsync(targetPath);
          }
          
          console.log(`[TTSService] Copying ${source} to ${target}...`);
          await FileSystem.copyAsync({ from: sourcePath, to: targetPath });
        };

        // Copy required files
        await ensureFile(originalOnnx, targetOnnx);
        
        const tokensSourceInfo = await FileSystem.getInfoAsync(`file://${originalTokens}`);
        if (tokensSourceInfo.exists) {
          await ensureFile(originalTokens, targetTokens);
        }

        const voicesSourceInfo = await FileSystem.getInfoAsync(`file://${originalVoices}`);
        if (voicesSourceInfo.exists) {
          await ensureFile(originalVoices, targetVoices);
        }

        // 2.5 Ensure lexicon.txt exists for VITS models
        if (modelTypeDir === 'piper') {
          const targetLexicon = `${isolatedDir}lexicon.txt`.replace('file://', '');
          if (!(await FileSystem.getInfoAsync(`file://${targetLexicon}`)).exists) {
            await FileSystem.writeAsStringAsync(`file://${targetLexicon}`, '');
          }
        }

        const modelDir = isolatedDir.replace('file://', '').replace(/\/$/, '');
        console.log(`[TTSService] Initializing native engine at isolated path: ${modelDir}`);

        // 2.7 Handle espeak-ng-data
        if (modelTypeDir === 'piper' || modelTypeDir === 'kokoro') {
          const sourceEspeak = `${paths.modelDirectory}espeak-ng-data`;
          const targetEspeak = `${isolatedDir}espeak-ng-data`;
          const espeakInfo = await FileSystem.getInfoAsync(sourceEspeak);
          if (espeakInfo.exists && espeakInfo.isDirectory) {
            const targetEspeakInfo = await FileSystem.getInfoAsync(targetEspeak);
            if (!targetEspeakInfo.exists) {
              console.log(`[TTSService] Copying espeak-ng-data to ${modelTypeDir} folder...`);
              try {
                await FileSystem.copyAsync({ from: sourceEspeak, to: targetEspeak });
              } catch (e) {
                console.warn('[TTSService] Failed to copy espeak-ng-data directory:', e);
              }
            }
          }
        }

        // 3. Verify model structure
        const detection = await detectTtsModel({ type: 'file', path: modelDir });
        console.log(`[TTSService] Detected model type: ${detection.modelType || 'auto'}`);

        const instanceId = 'main_tts_instance';
        
        if (!SherpaOnnxNative) {
          throw new Error('Native SherpaOnnx module not found. Please rebuild the app.');
        }

        // 4. Initialize native engine with safer parameters
        const effectiveModelType = detection.modelType || (modelId.includes('kokoro') ? 'kokoro' : 'vits');
        const result = await SherpaOnnxNative.initializeTts(
          instanceId,
          modelDir,
          effectiveModelType,
          2,           // numThreads: 2 for better performance/stability
          false,       // debug: disabled to reduce memory/logging overhead
          0.667,       // noiseScale
          0.8,         // noiseScaleW
          1.0,         // lengthScale
          '',          // ruleFsts
          '',          // ruleFars
          1,           // maxNumSentences
          0.2,         // silenceScale: 0.2 is default for sherpa-onnx
          'cpu'        // provider
        );

        if (!result || !result.success) {
          throw new Error(result?.error || 'Native initialization failed');
        }

        // 5. Create engine wrapper
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
        console.error('[TTSService] TTS initialization failed:', error);
        this.isLoaded = false;
        this.engine = null;
      } finally {
        this.isLoading = false;
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    if (!this.isLoaded) {
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

      if (!this.engine) throw new Error('TTS engine missing');

      console.log(`[TTSService] Generating speech: ${text.substring(0, 30)}...`);
      const startTime = Date.now();
      
      const audio = await this.engine.generateSpeech(text, {
        sid: options.speakerId !== undefined ? options.speakerId : 0,
        speed: options.speed || 1.0,
      });

      const genTime = Date.now() - startTime;
      console.log(`[TTSService] Audio generated in ${genTime}ms. Samples: ${audio?.samples?.length || 0}`);

      const durationSeconds = (audio?.samples?.length || 0) / (audio?.sampleRate || 22050);
      const isSuspiciouslyShort = durationSeconds < 0.3 && text.length > 5;

      if (!audio || !audio.samples || audio.samples.length === 0 || isSuspiciouslyShort) {
        console.warn(`[TTSService] Generated audio is ${isSuspiciouslyShort ? 'too short' : 'empty'}.`);
        return;
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
      }
    } catch (error) {
      console.error('[TTSService] Speak failed:', error);
    }
  }

  async stop(): Promise<void> {
    if (this.sound) {
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
    console.log('[TTSService] Cleaned up');
  }

  getIsLoaded(): boolean { return this.isLoaded; }
  getIsLoading(): boolean { return this.isLoading; }
  getActiveModelId(): string | null { return this.activeModelId; }
}

export const ttsService = new TTSService();
