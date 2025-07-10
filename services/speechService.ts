import { SPEECH_CONFIG } from '../config/speechConfig';

export interface TranscriptionResponse {
  success: boolean;
  transcription?: string;
  originalFilename?: string;
  fileSize?: number;
  message?: string;
  error?: string;
}

export interface SpeechStatusResponse {
  success: boolean;
  service: string;
  modelLoaded: boolean;
  modelPath: string;
}

export class SpeechService {
  static async transcribeAudio(audioUri: string): Promise<TranscriptionResponse> {
    try {
      const formData = new FormData();
      
      // Handle data URI (base64 encoded audio)
      if (audioUri.startsWith('data:')) {
        // Extract mime type and base64 data
        const [mimeInfo, base64Data] = audioUri.split(',');
        const mimeType = mimeInfo.match(/:(.*?);/)?.[1] || 'audio/mpeg';
        
        // Convert base64 to blob
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        
        // Create file from blob
        const file = new File([blob], 'audio.mp3', { type: mimeType });
        formData.append('audio', file);
      } else if (audioUri.startsWith('blob:')) {
        // Handle blob URL (web recordings)
        const response = await fetch(audioUri);
        const blob = await response.blob();
        
        // Create file from blob with appropriate extension based on blob type
        const mimeType = blob.type || 'audio/webm';
        const extension = mimeType.includes('webm') ? '.webm' : mimeType.includes('mp4') ? '.mp4' : '.m4a';
        const file = new File([blob], `recording${extension}`, { type: mimeType });
        formData.append('audio', file);
      } else {
        // Handle regular file URI (fallback for React Native)
        const audioFile = {
          uri: audioUri,
          type: 'audio/m4a',
          name: 'recording.m4a',
        } as any;
        formData.append('audio', audioFile);
      }

      const response = await fetch(`${SPEECH_CONFIG.API_BASE_URL}/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: TranscriptionResponse = await response.json();
      return result;
    } catch (error) {
      console.error('Transcription error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  static async checkStatus(): Promise<SpeechStatusResponse> {
    try {
      const response = await fetch(`${SPEECH_CONFIG.API_BASE_URL}/status`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: SpeechStatusResponse = await response.json();
      return result;
    } catch (error) {
      console.error('Status check error:', error);
      return {
        success: false,
        service: 'Speech-to-Text',
        modelLoaded: false,
        modelPath: '',
      };
    }
  }
} 