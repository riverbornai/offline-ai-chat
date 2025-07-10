// Speech API Configuration
export const SPEECH_CONFIG = {
  // Update this URL to match your backend server
  API_BASE_URL: 'http://localhost:3001/api/v1',
  
  // For production, use your actual server URL:
  // API_BASE_URL: 'https://your-backend-domain.com/api',
  
  // For development on device/emulator, use your local IP:
  // API_BASE_URL: 'http://192.168.1.100:3001/api', // Replace with your IP
  
  // Audio recording settings
  AUDIO_SETTINGS: {
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  
  // File upload settings
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  SUPPORTED_FORMATS: ['audio/wav', 'audio/m4a', 'audio/mp3', 'audio/ogg'],
}; 