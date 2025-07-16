import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Tts from 'react-native-tts';
import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';

interface Voice {
  id: string;
  name: string;
  language: string;
  quality: number;
}

interface AudioItem {
  id: string;
  text: string;
  timestamp: Date;
  audioUrl?: string;
  audioBlob?: Blob;
  isPlaying: boolean;
  duration?: number;
}

export default function TextToSpeech() {
  const [text, setText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [rate, setRate] = useState(0.5);
  const [pitch, setPitch] = useState(1.0);
  const [audioList, setAudioList] = useState<AudioItem[]>([]);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
  const [liveStreaming, setLiveStreaming] = useState(false);
  const [debouncedText, setDebouncedText] = useState(text);
  const [lastSpokenText, setLastSpokenText] = useState('');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    initializeTts();
    return () => {
      // Stop all audio when component unmounts
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        // Clean up any playing audio
        audioList.forEach(item => {
          if (item.audioUrl && !item.audioUrl.startsWith('tts://')) {
            const audio = document.querySelector(`audio[src="${item.audioUrl}"]`) as HTMLAudioElement;
            if (audio) {
              audio.pause();
            }
          }
        });
      } else {
        Tts.stop();
      }
    };
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedText(text), 500);
    return () => clearTimeout(handler);
  }, [text]);

  const initializeTts = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web Speech API
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          // Get available voices
          const getVoices = () => {
            const webVoices = window.speechSynthesis.getVoices();
            const formattedVoices: Voice[] = webVoices.map((voice, index) => ({
              id: voice.voiceURI || voice.name || index.toString(),
              name: voice.name,
              language: voice.lang,
              quality: voice.localService ? 1 : 0.5,
            }));
            setVoices(formattedVoices);
            if (formattedVoices.length > 0) {
              setSelectedVoice(formattedVoices[0].id);
            }
          };

          // Voices might not be immediately available
          if (window.speechSynthesis.getVoices().length > 0) {
            getVoices();
          } else {
            window.speechSynthesis.addEventListener('voiceschanged', getVoices);
          }
        }
      } else {
        // Mobile TTS
        await Tts.setDefaultLanguage('en-US');
        await Tts.setDefaultRate(rate);
        await Tts.setDefaultPitch(pitch);

        const availableVoices = await Tts.voices();
        setVoices(availableVoices);
        
        if (availableVoices.length > 0) {
          setSelectedVoice(availableVoices[0].id);
        }
      }
    } catch (error) {
      console.error('TTS initialization error:', error);
      Alert.alert('Error', 'Failed to initialize Text-to-Speech');
    }
  };

  const generateAudio = async () => {
    if (!text.trim()) {
      Alert.alert('Error', 'Please enter some text to generate audio');
      return;
    }

    setIsGenerating(true);
    
    try {
      const audioId = Date.now().toString();
      const newAudioItem: AudioItem = {
        id: audioId,
        text: text.trim(),
        timestamp: new Date(),
        isPlaying: false,
      };

      if (Platform.OS === 'web') {
        // Generate audio using Web Speech API
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(text);
          
          // Find selected voice
          const webVoices = window.speechSynthesis.getVoices();
          const selectedWebVoice = webVoices.find(
            voice => (voice.voiceURI || voice.name) === selectedVoice
          );
          
          if (selectedWebVoice) {
            utterance.voice = selectedWebVoice;
          }
          
          utterance.rate = rate * 2; // Web API uses 0.1-10, our UI uses 0.1-2
          utterance.pitch = pitch;

          // Create audio blob (this is a simplified approach)
          // Note: Web Speech API doesn't directly provide audio data
          // This creates a placeholder - in a real app you'd use a TTS service that returns audio data
          const audioBlob = new Blob([''], { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(audioBlob);
          
          newAudioItem.audioUrl = audioUrl;
          newAudioItem.audioBlob = audioBlob;
        }
      } else {
        // Mobile implementation using react-native-tts
        await Tts.setDefaultLanguage('en-US');
        await Tts.setDefaultRate(rate);
        await Tts.setDefaultPitch(pitch);
        
        if (selectedVoice) {
          await Tts.setDefaultVoice(selectedVoice);
        }
        
        // For mobile, we store the text and use TTS directly for playback
        // Audio files aren't generated but played through TTS engine
        newAudioItem.audioUrl = `tts://${audioId}`;
      }

      setAudioList(prev => [newAudioItem, ...prev]);
      setText(''); // Clear text after generating
      Alert.alert('Success', 'Audio generated successfully!');
      
    } catch (error) {
      console.error('Audio generation error:', error);
      Alert.alert('Error', 'Failed to generate audio');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!liveStreaming) return;
    if (!debouncedText.trim()) {
      if (Platform.OS === 'web') {
        window.speechSynthesis.cancel();
      } else {
        Tts.stop();
      }
      setLastSpokenText('');
      return;
    }

    // Find the new part to speak
    let newPart = debouncedText;
    if (debouncedText.startsWith(lastSpokenText)) {
      newPart = debouncedText.slice(lastSpokenText.length);
    }

    if (!newPart.trim()) return; // nothing new to say

    if (Platform.OS === 'web') {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(newPart);
      const webVoices = window.speechSynthesis.getVoices();
      const selectedWebVoice = webVoices.find(
        voice => (voice.voiceURI || voice.name) === selectedVoice
      );
      if (selectedWebVoice) utterance.voice = selectedWebVoice;
      utterance.rate = rate * 2;
      utterance.pitch = pitch;
      utterance.onend = () => setLastSpokenText(debouncedText);
      utterance.onerror = () => setLastSpokenText(debouncedText);
      window.speechSynthesis.speak(utterance);
    } else {
      Tts.stop();
      Tts.setDefaultRate(rate);
      Tts.setDefaultPitch(pitch);
      if (selectedVoice) Tts.setDefaultVoice(selectedVoice);
      Tts.speak(newPart);
      setLastSpokenText(debouncedText);
    }
  }, [debouncedText, liveStreaming, selectedVoice, rate, pitch]);

  const toggleAudioPlayback = async (audioItem: AudioItem) => {
    if (Platform.OS === 'web') {
      if (audioItem.isPlaying) {
        window.speechSynthesis.cancel();
        setCurrentPlayingId(null);
        setCurrentWordIndex(null);
        setAudioList(prev => prev.map(item => 
          item.id === audioItem.id ? { ...item, isPlaying: false } : item
        ));
      } else {
        window.speechSynthesis.cancel();
        setAudioList(prev => prev.map(item => ({ ...item, isPlaying: false })));
        setCurrentWordIndex(null);
        const utterance = new SpeechSynthesisUtterance(audioItem.text);
        const webVoices = window.speechSynthesis.getVoices();
        const selectedWebVoice = webVoices.find(
          voice => (voice.voiceURI || voice.name) === selectedVoice
        );
        if (selectedWebVoice) {
          utterance.voice = selectedWebVoice;
        }
        utterance.rate = rate * 2;
        utterance.pitch = pitch;
        utterance.onstart = () => {
          setCurrentPlayingId(audioItem.id);
          setAudioList(prev => prev.map(item => 
            item.id === audioItem.id ? { ...item, isPlaying: true } : item
          ));
        };
        utterance.onend = () => {
          setCurrentPlayingId(null);
          setCurrentWordIndex(null);
          setAudioList(prev => prev.map(item => 
            item.id === audioItem.id ? { ...item, isPlaying: false } : item
          ));
        };
        utterance.onerror = () => {
          setCurrentPlayingId(null);
          setCurrentWordIndex(null);
          setAudioList(prev => prev.map(item => 
            item.id === audioItem.id ? { ...item, isPlaying: false } : item
          ));
        };
        utterance.onboundary = (event: any) => {
          if (event.name === 'word') {
            // Find word index by counting spaces before event.charIndex
            const textUpToChar = audioItem.text.slice(0, event.charIndex);
            const wordIndex = textUpToChar.trim().length === 0 ? 0 : textUpToChar.trim().split(/\s+/).length;
            setCurrentWordIndex(wordIndex);
          }
        };
        window.speechSynthesis.speak(utterance);
      }
    } else {
      // Mobile implementation using react-native-tts
      if (audioItem.isPlaying) {
        // Stop audio
        await Tts.stop();
        setCurrentPlayingId(null);
        setCurrentWordIndex(null);
        setAudioList(prev => prev.map(item => 
          item.id === audioItem.id ? { ...item, isPlaying: false } : item
        ));
      } else {
        // Stop any currently playing audio
        await Tts.stop();
        setAudioList(prev => prev.map(item => ({ ...item, isPlaying: false })));
        
        try {
          // Set up TTS parameters
          await Tts.setDefaultRate(rate);
          await Tts.setDefaultPitch(pitch);
          
          if (selectedVoice) {
            await Tts.setDefaultVoice(selectedVoice);
          }
          
          // Set up event listeners
          const onTtsStart = () => {
            setCurrentPlayingId(audioItem.id);
            setAudioList(prev => prev.map(item => 
              item.id === audioItem.id ? { ...item, isPlaying: true } : item
            ));
          };
          
          const onTtsFinish = () => {
            setCurrentPlayingId(null);
            setCurrentWordIndex(null);
            setAudioList(prev => prev.map(item => 
              item.id === audioItem.id ? { ...item, isPlaying: false } : item
            ));
            Tts.removeEventListener('tts-start', onTtsStart);
            Tts.removeEventListener('tts-finish', onTtsFinish);
            Tts.removeEventListener('tts-cancel', onTtsFinish);
          };
          
          Tts.addEventListener('tts-start', onTtsStart);
          Tts.addEventListener('tts-finish', onTtsFinish);
          Tts.addEventListener('tts-cancel', onTtsFinish);
          
          // Speak the text
          await Tts.speak(audioItem.text);
          
        } catch (error) {
          console.error('TTS playback error:', error);
          setCurrentPlayingId(null);
          setCurrentWordIndex(null);
          setAudioList(prev => prev.map(item => 
            item.id === audioItem.id ? { ...item, isPlaying: false } : item
          ));
        }
      }
    }
  };

  const deleteAudioItem = async (audioId: string) => {
    // Stop if currently playing
    if (currentPlayingId === audioId) {
      if (Platform.OS === 'web') {
        window.speechSynthesis.cancel();
      } else {
        await Tts.stop();
      }
      setCurrentPlayingId(null);
      setCurrentWordIndex(null);
    }
    
    // Remove from list
    setAudioList(prev => prev.filter(item => item.id !== audioId));
  };

  const renderVoiceItem = ({ item }: { item: Voice }) => (
    <TouchableOpacity
      style={[
        styles.voiceItem,
        { 
          backgroundColor: selectedVoice === item.id ? colors.primary : colors.surface,
          borderColor: colors.border 
        }
      ]}
      onPress={() => setSelectedVoice(item.id)}
    >
      <Text style={[
        styles.voiceName,
        { color: selectedVoice === item.id ? 'white' : colors.text }
      ]}>
        {item.name}
      </Text>
      <Text style={[
        styles.voiceLanguage,
        { color: selectedVoice === item.id ? 'rgba(255,255,255,0.8)' : colors.muted }
      ]}>
        {item.language}
      </Text>
    </TouchableOpacity>
  );

  const renderAudioItem = ({ item }: { item: AudioItem }) => {
    // For word streaming highlight
    let textContent: React.ReactNode = item.text;
    if (
      Platform.OS === 'web' &&
      item.isPlaying &&
      item.id === currentPlayingId &&
      currentWordIndex !== null
    ) {
      const words = item.text.split(/(\s+)/); // keep spaces
      textContent = words.map((word, idx) => {
        // Only highlight non-space words
        const wordIdx = words.slice(0, idx).filter(w => !/^\s+$/.test(w)).length;
        const isCurrent = wordIdx === currentWordIndex;
        return /^\s+$/.test(word) ? (
          word
        ) : (
          <Text
            key={idx}
            style={isCurrent ? [styles.audioText, { backgroundColor: '#ffe066', borderRadius: 4 }] : styles.audioText}
          >
            {word}
          </Text>
        );
      });
    }
    return (
      <View style={[styles.audioItem, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <View style={styles.audioItemHeader}>
          <Text style={[styles.audioTimestamp, { color: colors.muted }]}> 
            {item.timestamp.toLocaleTimeString()} 
          </Text>
          <TouchableOpacity
            onPress={() => deleteAudioItem(item.id)}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.audioText, { color: colors.text, flexWrap: 'wrap', flexDirection: 'row' }]} numberOfLines={2}>
          {textContent}
        </Text>
        <View style={styles.audioControls}>
          <TouchableOpacity
            style={[
              styles.playButton,
              { backgroundColor: item.isPlaying ? '#ff4444' : colors.primary }
            ]}
            onPress={() => toggleAudioPlayback(item)}
          >
            <Text style={styles.playButtonText}>
              {item.isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.headerCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            Text-to-Speech Generator
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Generate and manage your audio files
          </Text>
        </View>

        {/* Text Input */}
        <View style={[styles.inputCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>
            Enter text to generate audio:
          </Text>
          <TextInput
            style={[
              styles.textInput,
              { 
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border
              }
            ]}
            value={text}
            onChangeText={setText}
            placeholder="Type your text here..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Controls */}
        <View style={[styles.controlsCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Voice Controls
          </Text>
          
          {/* Rate Control */}
          <View style={styles.controlRow}>
            <Text style={[styles.controlLabel, { color: colors.text }]}>
              Speed: {rate.toFixed(1)}x
            </Text>
            <View style={styles.controlButtons}>
              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: colors.primary }]}
                onPress={() => setRate(Math.max(0.1, rate - 0.1))}
              >
                <Text style={styles.controlButtonText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: colors.primary }]}
                onPress={() => setRate(Math.min(2.0, rate + 0.1))}
              >
                <Text style={styles.controlButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Pitch Control */}
          <View style={styles.controlRow}>
            <Text style={[styles.controlLabel, { color: colors.text }]}>
              Pitch: {pitch.toFixed(1)}
            </Text>
            <View style={styles.controlButtons}>
              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: colors.primary }]}
                onPress={() => setPitch(Math.max(0.5, pitch - 0.1))}
              >
                <Text style={styles.controlButtonText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: colors.primary }]}
                onPress={() => setPitch(Math.min(2.0, pitch + 0.1))}
              >
                <Text style={styles.controlButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Live Streaming Toggle */}
          <View style={styles.controlRow}>
            <Text style={[styles.controlLabel, { color: colors.text }]}>
              Live Streaming
            </Text>
            <TouchableOpacity
              style={[
                styles.controlButton,
                { backgroundColor: liveStreaming ? colors.primary : colors.muted }
              ]}
              onPress={() => setLiveStreaming(v => !v)}
            >
              <Text style={styles.controlButtonText}>
                {liveStreaming ? 'On' : 'Off'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Voice Selection */}
        {voices.length > 0 && (
          <View style={[styles.voicesCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Select Voice
            </Text>
            <FlatList
              data={voices}
              renderItem={renderVoiceItem}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.voicesList}
            />
          </View>
        )}

        {/* Generate Button */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[
              styles.generateButton,
              { backgroundColor: isGenerating ? '#9ca3af' : colors.primary }
            ]}
            onPress={generateAudio}
            disabled={isGenerating}
          >
            <Text style={styles.generateButtonText}>
              {isGenerating ? '⏳ Generating...' : '🎵 Generate Audio'}
            </Text>
          </TouchableOpacity>

          {!!text.trim() && (
            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: colors.muted }]}
              onPress={() => setText('')}
            >
              <Text style={styles.clearButtonText}>Clear Text</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Audio List */}
        {audioList.length > 0 && (
          <View style={[styles.audioListCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Generated Audio Files ({audioList.length})
            </Text>
            <FlatList
              data={audioList}
              renderItem={renderAudioItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  headerCard: {
    borderRadius: 20,
    padding: 24,
    margin: 16,
    elevation: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  inputCard: {
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginTop: 8,
    elevation: 4,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    maxHeight: 200,
  },
  controlsCard: {
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginTop: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  voicesCard: {
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginTop: 8,
    elevation: 4,
  },
  voicesList: {
    marginTop: 8,
  },
  voiceItem: {
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 120,
    borderWidth: 1,
  },
  voiceName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  voiceLanguage: {
    fontSize: 12,
  },
  buttonsContainer: {
    margin: 16,
    gap: 12,
  },
  generateButton: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    elevation: 4,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  clearButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  audioListCard: {
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginTop: 8,
    elevation: 4,
  },
  audioItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  audioItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  audioTimestamp: {
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  audioText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  audioControls: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  playButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    elevation: 2,
  },
  playButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 20,
  },
}); 