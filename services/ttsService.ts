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
  private useSystemTTS: boolean = false;
  private isSpeaking: boolean = false;
  private stopRequested: boolean = false;

  private splitTextIntoChunks(text: string): string[] {
    const cleaned = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/#+\s+/g, '')
      .trim();

    if (!cleaned) return [];

    const rawSentences = cleaned.split(/(?<=[.!?])\s+|\n+/);
    const chunks: string[] = [];

    for (const raw of rawSentences) {
      const sentence = raw.trim();
      if (!sentence) continue;

      if (sentence.length <= 150) {
        chunks.push(sentence);
      } else {
        const parts = sentence.split(/(?<=[,;:])\s+/);
        let current = '';
        for (const part of parts) {
          if ((current + ' ' + part).length > 150) {
            if (current.trim()) chunks.push(current.trim());
            current = part;
          } else {
            current = current ? `${current} ${part}` : part;
          }
        }
        if (current.trim()) chunks.push(current.trim());
      }
    }

    return chunks.length > 0 ? chunks : [cleaned];
  }

  async initialize(requestedModelId?: string): Promise<void> {
    let modelId = requestedModelId;

    if (!modelId) {
      const downloadedTts = modelStore.models.find(m => m.type === 'tts' && m.isDownloaded);
      modelId = downloadedTts ? downloadedTts.id : 'vits-piper-en_US-amy-low';
    }

    let model = modelStore.models.find((m) => m.id === modelId);
    if (!model || !model.isDownloaded) {
      const fallbackTts = modelStore.models.find(m => m.type === 'tts' && m.isDownloaded);
      if (fallbackTts) {
        console.log(`[TTSService] Requested ${modelId} not downloaded, falling back to ${fallbackTts.id}`);
        model = fallbackTts;
        modelId = fallbackTts.id;
      }
    }

    if (this.isLoaded && this.activeModelId === modelId && this.engine) return;
    
    if (this.initPromise) {
      console.log('[TTSService] Waiting for existing initialization...');
      try {
        await this.initPromise;
      } catch (e) {
        // Reset promise on previous failure
      }
      if (this.isLoaded && this.activeModelId === modelId && this.engine) return;
    }

    this.isLoading = true;
    this.initPromise = (async () => {
      try {
        console.log(`[TTSService] Initializing model: ${modelId}`);

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
        const paths = await getPlatformPaths();
        const modelTypeDir = modelId.includes('kokoro') ? 'kokoro' : 'piper';
        const isolatedDir = `${paths.modelDirectory}${modelTypeDir}/`;
        
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
        
        const ensureFile = async (source: string, target: string) => {
          const targetPath = `file://${target}`;
          const sourcePath = `file://${source}`;
          
          const targetInfo = await FileSystem.getInfoAsync(targetPath);
          if (targetInfo.exists) {
            const sourceInfo = await FileSystem.getInfoAsync(sourcePath);
            if (sourceInfo.exists && Math.abs(targetInfo.size - sourceInfo.size) < 1024) {
              return;
            }
            console.log(`[TTSService] Target file size mismatch or corrupted, replacing: ${target}`);
            await FileSystem.deleteAsync(targetPath);
          }
          
          console.log(`[TTSService] Copying ${source} to ${target}...`);
          await FileSystem.copyAsync({ from: sourcePath, to: targetPath });
        };

        await ensureFile(originalOnnx, targetOnnx);
        
        const tokensSourceInfo = await FileSystem.getInfoAsync(`file://${originalTokens}`);
        if (tokensSourceInfo.exists) {
          await ensureFile(originalTokens, targetTokens);
        }

        const voicesSourceInfo = await FileSystem.getInfoAsync(`file://${originalVoices}`);
        if (voicesSourceInfo.exists) {
          await ensureFile(originalVoices, targetVoices);
        }

        if (modelTypeDir === 'piper' || modelTypeDir === 'kokoro') {
          const targetLexicon = `${isolatedDir}lexicon.txt`.replace('file://', '');
          if (!(await FileSystem.getInfoAsync(`file://${targetLexicon}`)).exists) {
            await FileSystem.writeAsStringAsync(`file://${targetLexicon}`, '');
          }
        }

        const modelDir = isolatedDir.replace('file://', '').replace(/\/$/, '');
        console.log(`[TTSService] Initializing native engine at isolated path: ${modelDir}`);

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

        const detection = await detectTtsModel({ type: 'file', path: modelDir });
        console.log(`[TTSService] Detected model type: ${detection.modelType || 'auto'}`);

        const instanceId = 'main_tts_instance';
        
        if (!SherpaOnnxNative) {
          throw new Error('Native SherpaOnnx module not found. Please rebuild the app.');
        }

        const effectiveModelType = detection.modelType || (modelId.includes('kokoro') ? 'kokoro' : 'vits');
        const result = await SherpaOnnxNative.initializeTts(
          instanceId,
          modelDir,
          effectiveModelType,
          2,
          false,
          0.667,
          0.8,
          1.0,
          '',
          '',
          1,
          0.2,
          'cpu'
        );

        if (!result || !result.success) {
          throw new Error(result?.error || 'Native initialization failed');
        }

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

    await this.stop();
    this.stopRequested = false;
    this.isSpeaking = true;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      if (!this.engine) throw new Error('TTS engine missing');

      const chunks = this.splitTextIntoChunks(text);
      console.log(`[TTSService] Speaking text in ${chunks.length} sentence chunk(s)...`);

      const paths = await getPlatformPaths();
      const tempPath = `${paths.documentsDirectory}temp_tts.wav`.replace('file://', '');

      for (let i = 0; i < chunks.length; i++) {
        if (this.stopRequested) {
          console.log('[TTSService] Speech playback stopped by user');
          break;
        }

        const chunkText = chunks[i];
        console.log(`[TTSService] Chunk ${i + 1}/${chunks.length}: "${chunkText.substring(0, 35)}..."`);

        const startTime = Date.now();
        const activeSid = options.speakerId !== undefined 
          ? options.speakerId 
          : (modelStore.activeKokoroSpeakerId ?? 0);

        const audio = await this.engine.generateSpeech(chunkText, {
          sid: activeSid,
          speed: options.speed || 1.0,
        });

        if (this.stopRequested) break;

        const genTime = Date.now() - startTime;
        console.log(`[TTSService] Chunk ${i + 1} generated in ${genTime}ms. Samples: ${audio?.samples?.length || 0}`);

        if (!audio || !audio.samples || audio.samples.length === 0) {
          console.warn(`[TTSService] Chunk ${i + 1} empty audio generated, skipping`);
          continue;
        }

        await saveAudioToFile(audio, tempPath);

        if (this.stopRequested) break;

        if (this.sound) {
          try { await this.sound.unloadAsync(); } catch (e) {}
          this.sound = null;
        }

        await new Promise<void>(async (resolve) => {
          try {
            const { sound, status } = await Audio.Sound.createAsync(
              { uri: `file://${tempPath}` },
              { shouldPlay: true, volume: 1.0 }
            );
            this.sound = sound;

            if (!status.isLoaded) {
              resolve();
              return;
            }

            sound.setOnPlaybackStatusUpdate((playbackStatus) => {
              if (this.stopRequested) {
                try { sound.stopAsync(); } catch (e) {}
                resolve();
                return;
              }
              if (playbackStatus.isLoaded && playbackStatus.didJustFinish) {
                resolve();
              }
            });
          } catch (audioError) {
            console.error('[TTSService] Playback error on chunk:', audioError);
            resolve();
          }
        });
      }
    } catch (error) {
      console.error('[TTSService] Speak failed:', error);
    } finally {
      this.isSpeaking = false;
      this.stopRequested = false;
      if (this.sound) {
        try { await this.sound.unloadAsync(); } catch (e) {}
        this.sound = null;
      }
    }
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    if (this.sound) {
      try { await this.sound.stopAsync(); } catch (e) {}
      try { await this.sound.unloadAsync(); } catch (e) {}
      this.sound = null;
    }
  }

  async cleanup(): Promise<void> {
    await this.stop();
    if (this.engine) {
      try { await this.engine.destroy(); } catch (e) {}
      this.engine = null;
    }
    this.isLoaded = false;
    this.activeModelId = null;
    console.log('[TTSService] Cleaned up');
  }

  async previewVoice(speakerId: number, voiceName?: string): Promise<void> {
    const text = `Hello! I am ${voiceName || 'Kokoro'}, your text-to-speech voice.`;
    await this.speak(text, { speakerId });
  }

  getIsLoaded(): boolean { return this.isLoaded; }
  getIsLoading(): boolean { return this.isLoading; }
  getActiveModelId(): string | null { return this.activeModelId; }
}

export const ttsService = new TTSService();
