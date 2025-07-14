import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { WHISPER_CONFIG } from '../config/whisperConfig';

// Import whisper.rn - this will throw if not available
let initWhisper: any = null;
let WhisperContext: any = null;
let isWhisperAvailable = false;

try {
  const whisperModule = require('whisper.rn');
  initWhisper = whisperModule.initWhisper;
  WhisperContext = whisperModule.WhisperContext;
  isWhisperAvailable = true;
  console.log('whisper.rn loaded successfully');
} catch (error) {
  console.error('whisper.rn not available:', error);
  isWhisperAvailable = false;
}

export interface WhisperResult {
  text: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  language?: string;
}

class WhisperService {
  private context: any = null;
  private modelLoaded = false;
  private modelPath: string | null = null;

  async initialize(): Promise<void> {
    try {
      console.log('Initializing Whisper service...');
      
      if (!isWhisperAvailable || !initWhisper) {
        throw new Error('whisper.rn native module is not available. Please install whisper.rn for real transcription.');
      }
      
      // Check if model exists in assets first, then in documents directory
      const modelExists = await this.checkModelExists();
      
      if (!modelExists) {
        console.log('Model not found, downloading...');
        await this.downloadModel();
      }
      
      // Initialize Whisper context
      await this.loadModel();
      
      this.modelLoaded = true;
      console.log('Whisper service initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Whisper service:', error);
      throw error;
    }
  }

  private async checkModelExists(): Promise<boolean> {
    try {
      // First check if model exists in assets
      console.log('Checking for model in assets...');
      
      try {
        // Try to load the asset using Asset.fromModule
        // This will work if the model is properly bundled in the assets folder
        const assetModule = require('../assets/models/ggml-tiny.en-q5_1.bin');
        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();
        
        if (asset.localUri) {
          this.modelPath = asset.localUri;
          console.log('Model found in assets:', asset.localUri);
          return true;
        }
      } catch (assetError) {
        console.log('Model not found in assets, checking documents directory...');
      }
      
      // Check documents directory as fallback
      const documentsModelPath = `${FileSystem.documentDirectory}models/${WHISPER_CONFIG.modelName}`;
      const documentsInfo = await FileSystem.getInfoAsync(documentsModelPath);
      if (documentsInfo.exists) {
        this.modelPath = documentsModelPath;
        console.log('Model found in documents directory:', documentsModelPath);
        return true;
      }
      
      console.log('Model not found in either location');
      return false;
    } catch (error) {
      console.error('Error checking model existence:', error);
      return false;
    }
  }

  private async downloadModel(): Promise<void> {
    try {
      console.log('Downloading model from:', WHISPER_CONFIG.modelUrl);
      
      // Create models directory in documents
      const modelsDir = `${FileSystem.documentDirectory}models/`;
      await FileSystem.makeDirectoryAsync(modelsDir, { intermediates: true });
      
      // Download model
      const downloadResumable = FileSystem.createDownloadResumable(
        WHISPER_CONFIG.modelUrl,
        `${modelsDir}${WHISPER_CONFIG.modelName}`,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          console.log(`Download progress: ${(progress * 100).toFixed(1)}%`);
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result?.status === 200) {
        this.modelPath = result.uri;
        console.log('Model downloaded successfully to:', result.uri);
      } else {
        throw new Error('Failed to download model');
      }
      
    } catch (error) {
      console.error('Error downloading model:', error);
      throw error;
    }
  }

  private async loadModel(): Promise<void> {
    try {
      console.log('Loading Whisper model from:', this.modelPath);
      
      if (!isWhisperAvailable || !initWhisper) {
        throw new Error('whisper.rn native module is not available');
      }

      if (!this.modelPath) {
        throw new Error('Model path not set');
      }

      // Initialize WhisperContext using the correct initWhisper function
      this.context = await initWhisper({
        filePath: this.modelPath,
        isBundleAsset: false, // Set to true if using bundled assets
      });

      console.log('Whisper context created successfully');
      
    } catch (error) {
      console.error('Error loading Whisper model:', error);
      throw error;
    }
  }

  async transcribe(audioPath: string): Promise<WhisperResult> {
    if (!this.modelLoaded) {
      throw new Error('Whisper model not loaded');
    }

    if (!isWhisperAvailable || !this.context) {
      throw new Error('whisper.rn native module is not available');
    }

    try {
      console.log('Transcribing with real Whisper:', audioPath);
      
      // Use the real WhisperContext to transcribe
      const transcribeResult = this.context.transcribe(audioPath, {
        language: WHISPER_CONFIG.language,
        temperature: 0.0,
        bestOf: 1,
        beamSize: 5,
        patience: 1.0,
        lengthPenalty: 1.0,
        suppressTokens: [-1],
        suppressBlank: true,
        temperatureInc: 0.2,
        entropyThreshold: 2.4,
        logprobThreshold: -1.0,
        noSpeechThreshold: 0.6,
      });

      // Wait for the transcription to complete
      const result = await transcribeResult.promise;

      console.log('Transcription result:', result);
      
      return {
        text: result.text || '',
        language: result.language || WHISPER_CONFIG.language,
        segments: result.segments || [],
      };
    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw error;
    }
  }

  isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  isWhisperAvailable(): boolean {
    return isWhisperAvailable;
  }

  getModelPath(): string | null {
    return this.modelPath;
  }

  async cleanup(): Promise<void> {
    try {
      if (this.context && this.context.release) {
        await this.context.release();
      }
      this.context = null;
      this.modelLoaded = false;
      console.log('Whisper context cleaned up');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export const whisperService = new WhisperService(); 