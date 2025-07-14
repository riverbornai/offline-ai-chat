export const WHISPER_CONFIG = {
  modelName: 'ggml-tiny.en.bin',
  modelPath: 'assets/models/ggml-tiny.en.bin', // or file system path
  modelUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
  modelSize: 'tiny',
  language: 'en',
  quantization: null // no quantization for this model
};

export const AUDIO_CONFIG = {
  sampleRate: 16000,
  channels: 1,
  format: 'wav',
  duration: 30 // max recording duration in seconds
};
