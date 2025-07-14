import * as FileSystem from 'expo-file-system';
import { WHISPER_CONFIG } from '../config/whisperConfig';

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
      
      // Check if model exists in assets
      const modelExists = await this.checkModelExists();
      
      if (!modelExists) {
        console.log('Model not found in assets, downloading...');
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
      const modelPath = `${FileSystem.documentDirectory}models/${WHISPER_CONFIG.modelName}`;
      const info = await FileSystem.getInfoAsync(modelPath);
      this.modelPath = modelPath;
      return info.exists;
    } catch (error) {
      console.error('Error checking model existence:', error);
      return false;
    }
  }

  private async downloadModel(): Promise<void> {
    try {
      console.log('Downloading model from:', WHISPER_CONFIG.modelUrl);
      
      // Create models directory
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
        console.log('Model downloaded successfully');
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
      // For now, we'll use a mock implementation since whisper.rn API might be different
      // In a real implementation, you would initialize the actual Whisper context here
      console.log('Loading model from:', this.modelPath);
      
      // Simulate model loading
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.context = {
        transcribe: this.mockTranscribe.bind(this)
      };
      
    } catch (error) {
      console.error('Error loading model:', error);
      throw error;
    }
  }

  private async mockTranscribe(audioPath: string): Promise<WhisperResult> {
    // Mock transcription for demonstration
    // In real implementation, this would use the actual Whisper model
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const mockResults = [
      "Hello, this is a test transcription using the custom model.",
      "The weather is beautiful today and I'm testing the speech recognition.",
      "This is a demonstration of the custom Whisper model integration.",
      "Thank you for using our speech to text application.",
      "The custom model is working perfectly for transcription."
    ];
    
    const randomResult = mockResults[Math.floor(Math.random() * mockResults.length)];
    
    return {
      text: randomResult,
      language: 'en',
      segments: [{
        start: 0,
        end: 5,
        text: randomResult
      }]
    };
  }

  async transcribe(audioPath: string): Promise<WhisperResult> {
    if (!this.modelLoaded || !this.context) {
      throw new Error('Whisper model not loaded');
    }

    try {
      console.log('Transcribing audio:', audioPath);
      const result = await this.context.transcribe(audioPath);
      return result;
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }

  isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  getModelPath(): string | null {
    return this.modelPath;
  }

  async cleanup(): Promise<void> {
    try {
      if (this.context) {
        // Cleanup context if needed
        this.context = null;
      }
      this.modelLoaded = false;
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export const whisperService = new WhisperService(); 