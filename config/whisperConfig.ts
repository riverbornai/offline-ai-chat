// Note: This is a configuration file for Whisper settings
// The actual WhisperService implementation is in services/whisperService.ts

export const WHISPER_CONFIG = {
  modelName: 'ggml-tiny.en-q5_1.bin',
  modelPath: 'assets/models/ggml-tiny.en-q5_1.bin',
  modelUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin',
  modelSize: 'tiny',
  language: 'en',
  quantization: 'q5_1'
};

export const AUDIO_CONFIG = {
  sampleRate: 16000,
  channels: 1,
  format: 'wav',
  duration: 30, // max recording duration in seconds
};

 