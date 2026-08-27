export interface KokoroVoice {
  id: number;
  name: string;
  category: string; // e.g. "American Female"
  gender: 'Female' | 'Male';
  accent: 'American' | 'British';
  code: string; // technical identifier e.g. "af_bella"
}

export const KOKORO_VOICES: KokoroVoice[] = [
  { id: 0, name: 'Default', category: 'American Female', gender: 'Female', accent: 'American', code: 'af' },
  { id: 1, name: 'Bella', category: 'American Female', gender: 'Female', accent: 'American', code: 'af_bella' },
  { id: 2, name: 'Nicole', category: 'American Female', gender: 'Female', accent: 'American', code: 'af_nicole' },
  { id: 3, name: 'Sarah', category: 'American Female', gender: 'Female', accent: 'American', code: 'af_sarah' },
  { id: 4, name: 'Sky', category: 'American Female', gender: 'Female', accent: 'American', code: 'af_sky' },
  { id: 5, name: 'Adam', category: 'American Male', gender: 'Male', accent: 'American', code: 'am_adam' },
  { id: 6, name: 'Michael', category: 'American Male', gender: 'Male', accent: 'American', code: 'am_michael' },
  { id: 7, name: 'Emma', category: 'British Female', gender: 'Female', accent: 'British', code: 'bf_emma' },
  { id: 8, name: 'Isabella', category: 'British Female', gender: 'Female', accent: 'British', code: 'bf_isabella' },
  { id: 9, name: 'George', category: 'British Male', gender: 'Male', accent: 'British', code: 'bm_george' },
  { id: 10, name: 'Lewis', category: 'British Male', gender: 'Male', accent: 'British', code: 'bm_lewis' },
];

export const getKokoroVoiceById = (id: number): KokoroVoice => {
  return KOKORO_VOICES.find(v => v.id === id) || KOKORO_VOICES[0];
};

export const getKokoroVoiceDisplayName = (voice: KokoroVoice): string => {
  return `${voice.name} (${voice.category})`;
};
