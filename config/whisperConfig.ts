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

export const TRANSCRIPTION_CONFIG = {
  language: 'en',
  task: 'transcribe',
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
}; 