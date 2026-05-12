import * as FileSystem from 'expo-file-system';
import { createTTS } from 'react-native-sherpa-onnx';
import { getModelFilePath } from '../utils/platformPaths';

export interface TTSOptions {
  speakerId?: number;
  speed?: number;
}

class TTSService {
  private ttsInstance: any = null;
  private isLoaded = false;
  private isLoading = false;

  async initialize(modelId: string = 'kokoro-82m-v1.0'): Promise<void> {
    if (this.isLoading) return;
    
    try {
      this.isLoading = true;
      console.log(`Initializing TTS Service with model: ${modelId}`);

      // Required files for Kokoro
      const modelPath = await getModelFilePath('kokoro-82m-v1.0.onnx');
      const voicesPath = await getModelFilePath('kokoro-voices.bin');
      const tokensPath = await getModelFilePath('kokoro-tokens.txt');

      // Check if files exist
      const modelExists = await FileSystem.getInfoAsync(modelPath);
      const voicesExists = await FileSystem.getInfoAsync(voicesPath);
      const tokensExists = await FileSystem.getInfoAsync(tokensPath);

      if (!modelExists.exists || !voicesExists.exists || !tokensExists.exists) {
        throw new Error('TTS Model files missing. Please download them first.');
      }

      // Cleanup existing instance
      if (this.ttsInstance) {
        await this.ttsInstance.release();
      }

      // Initialize Sherpa-ONNX TTS
      // The path in Sherpa-ONNX needs to be the actual file path without 'file://'
      const cleanPath = (p: string) => p.replace('file://', '');

      this.ttsInstance = await createTTS({
        modelType: 'kokoro',
        kokoro: {
          model: cleanPath(modelPath),
          voices: cleanPath(voicesPath),
          tokens: cleanPath(tokensPath),
        },
        // Hardware acceleration
        numThreads: 2,
      });

      this.isLoaded = true;
      this.isLoading = false;
      console.log('TTS Service initialized successfully');
    } catch (error) {
      this.isLoading = false;
      console.error('Failed to initialize TTS Service:', error);
      throw error;
    }
  }

  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    if (!this.isLoaded || !this.ttsInstance) {
      console.warn('TTS Service not loaded. Initializing now...');
      await this.initialize();
    }

    try {
      const { speakerId = 0, speed = 1.0 } = options;
      
      console.log(`Speaking: "${text.substring(0, 50)}..." with speaker ${speakerId}`);
      
      // Use the play method if available, or generate and use expo-audio
      // react-native-sherpa-onnx usually provides a .play() method
      await this.ttsInstance.play(text, {
        sid: speakerId,
        speed: speed,
      });
    } catch (error) {
      console.error('TTS Playback failed:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.ttsInstance) {
      try {
        await this.ttsInstance.stop();
      } catch (error) {
        console.error('Failed to stop TTS:', error);
      }
    }
  }

  getIsLoaded(): boolean {
    return this.isLoaded;
  }

  getIsLoading(): boolean {
    return this.isLoading;
  }

  async cleanup(): Promise<void> {
    if (this.ttsInstance) {
      try {
        await this.ttsInstance.release();
        this.ttsInstance = null;
        this.isLoaded = false;
      } catch (error) {
        console.error('Error during TTS cleanup:', error);
      }
    }
  }
}

export const ttsService = new TTSService();
