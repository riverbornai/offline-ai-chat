import * as FileSystem from 'expo-file-system';
import { WHISPER_CONFIG } from '../config/whisperConfig';

// Import whisper.rn - this will throw if not available
let initWhisper: any = null;
let isWhisperAvailable = false;

try {
  const whisperModule = require('whisper.rn');
  initWhisper = whisperModule.initWhisper;
  isWhisperAvailable = true;
  console.log('whisper.rn loaded successfully - version 0.4.3+');
  console.log('Available modules:', Object.keys(whisperModule));
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

export interface RealtimeTranscriptionResult {
  text: string;
  isFinal: boolean;
  language?: string;
}

export interface RealtimeTranscriptionCallbacks {
  onTranscriptionUpdate?: (result: RealtimeTranscriptionResult) => void;
  onError?: (error: Error) => void;
  onComplete?: (finalResult: WhisperResult) => void;
}

class WhisperService {
  private context: any = null;
  private realtimeTranscriber: any = null;
  private modelLoaded = false;
  private modelPath: string | null = null;
  private isRealtimeActive = false;

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
      // Only check documents directory for the model
      const documentsModelPath = `${FileSystem.documentDirectory}models/${WHISPER_CONFIG.modelName}`;
      const documentsInfo = await FileSystem.getInfoAsync(documentsModelPath);
      if (documentsInfo.exists) {
        this.modelPath = documentsModelPath;
        console.log('Model found in documents directory:', documentsModelPath);
        return true;
      }
      console.log('Model not found in documents directory');
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

  async startRealtimeTranscription(callbacks: RealtimeTranscriptionCallbacks): Promise<void> {
    if (!this.modelLoaded) {
      throw new Error('Whisper model not loaded');
    }

    if (!isWhisperAvailable || !this.context) {
      throw new Error('whisper.rn native module is not available');
    }

    if (this.isRealtimeActive) {
      throw new Error('Realtime transcription already active');
    }

    try {
      console.log('Starting realtime transcription...');
      
      // Use the transcribeRealtime method from the whisper context
      const { stop, subscribe } = await this.context.transcribeRealtime({
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

      // Store the stop function for later use
      this.realtimeTranscriber = { stop };

      // Subscribe to real-time events
      subscribe((evt: any) => {
        const { isCapturing, data, processTime, recordingTime } = evt;
        
        if (callbacks.onTranscriptionUpdate) {
          callbacks.onTranscriptionUpdate({
            text: data.result || '',
            isFinal: !isCapturing,
            language: WHISPER_CONFIG.language,
          });
        }

        if (!isCapturing && callbacks.onComplete) {
          callbacks.onComplete({
            text: data.result || '',
            language: WHISPER_CONFIG.language,
            segments: [],
          });
        }
      });

      this.isRealtimeActive = true;
      console.log('Realtime transcription started successfully');
      
    } catch (error) {
      console.error('Error starting realtime transcription:', error);
      // Reset the flag on error to prevent stuck state
      this.isRealtimeActive = false;
      this.realtimeTranscriber = null;
      throw error;
    }
  }

  async stopRealtimeTranscription(): Promise<void> {
    if (!this.isRealtimeActive || !this.realtimeTranscriber) {
      return;
    }

    try {
      console.log('Stopping realtime transcription...');
      await this.realtimeTranscriber.stop();
      this.realtimeTranscriber = null;
      this.isRealtimeActive = false;
      console.log('Realtime transcription stopped');
    } catch (error) {
      console.error('Error stopping realtime transcription:', error);
      throw error;
    }
  }

  // Note: feedAudioData is not needed with transcribeRealtime API
  // The API handles audio input automatically

  getRealtimeStatus(): boolean {
    return this.isRealtimeActive;
  }

  // Force reset realtime state if it gets stuck
  resetRealtimeState(): void {
    console.log('Resetting realtime transcription state');
    this.isRealtimeActive = false;
    this.realtimeTranscriber = null;
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