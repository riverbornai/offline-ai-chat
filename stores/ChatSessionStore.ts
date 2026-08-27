import { makeAutoObservable, runInAction } from 'mobx';
import { makePersistable } from 'mobx-persist-store';
import { Storage } from '../utils/storage';

// Simple UUID generator for React Native
const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export interface ChatMessage {
  id: string;
  text: string;
  author: 'user' | 'assistant';
  timestamp: number;
  type?: 'conversation' | 'transcription';
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  systemPrompt: string;
}

// Prior defaults, kept only so we can detect+migrate devices that already
// persisted one of them (mobx-persist-store rehydrates over the field
// initializer, so simply changing the string below has no effect for
// existing installs unless we explicitly upgrade matching persisted values).
const LEGACY_DEFAULT_SYSTEM_PROMPTS = [
  'You are a helpful and engaging AI assistant. Provide concise, natural, and helpful answers.',
  'You are a helpful, private, on-device AI assistant. Answer the user\'s question directly, ' +
  'in your own voice, as yourself. Do not roleplay as a customer support agent, do not write ' +
  'emails or letters, and never sign off with things like "Your Name" or "Your Company" — you ' +
  'have no company and are not representing a business unless the user explicitly says you are. ' +
  'Stay on the exact topic asked. Keep answers concise and natural.',
  'You are a helpful assistant. Reply to the user directly and briefly. ' +
  'Only answer the message you were just given. Do not invent example ' +
  'conversations, Q&A lists, or additional users and replies.',
];

// Kept intentionally short and plain. Small on-device models (1-2B params,
// like TinyLlama, Gemma 2B) don't reliably treat a long, descriptive system
// prompt as behavior rules — they tend to riff on it as *content* instead
// (e.g. seeing words like "offline" and "assistant" and generating a fake
// Q&A transcript about being an offline assistant, rather than actually
// being one). Short, direct, imperative sentences hold up much better at
// this model size.
//
// The "answer general knowledge questions directly" line was added because
// small instruct-tuned models (observed on Gemma 2B IT) over-generalize
// their "don't hallucinate current events" safety training into refusing
// ANY question phrased like "Do you know about X?" — including plain,
// static, non-current-events topics like "JavaScript" — with a canned "I
// don't have access to external sources" non-answer. This won't fully fix
// a small model's shaky knowledge recall, but it measurably cuts down on
// that specific reflexive-refusal pattern.
const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful assistant. Reply to the user directly and briefly. ' +
  'Answer general knowledge questions directly using what you already know. ' +
  'Do not say you lack access to external sources or the internet — just answer. ' +
  'Only answer the message you were just given. Do not invent example ' +
  'conversations, Q&A lists, or additional users and replies.';

class ChatSessionStore {
  sessions: ChatSession[] = [];
  activeSessionId: string | null = null;
  isGenerating: boolean = false;

  settings: AppSettings = {
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  };

  constructor() {
    makeAutoObservable(this);

    makePersistable(this, {
      name: 'ChatSessionStore',
      properties: [
        'sessions',
        'activeSessionId',
        'settings'
      ],
      storage: Storage,
    }).then(() => {
      // One-time migration: if this device already persisted the old default
      // prompt (untouched by the user), upgrade it to the new default so the
      // improved prompt actually takes effect instead of being masked by
      // rehydration.
      runInAction(() => {
        if (LEGACY_DEFAULT_SYSTEM_PROMPTS.includes(this.settings.systemPrompt)) {
          this.settings.systemPrompt = DEFAULT_SYSTEM_PROMPT;
        }
      });
    }).catch(console.error);
  }

  get activeSession(): ChatSession | undefined {
    return this.sessions.find(s => s.id === this.activeSessionId);
  }

  get currentMessages(): ChatMessage[] {
    return this.activeSession?.messages || [];
  }



  setActiveSession = (sessionId: string | null) => {
    runInAction(() => {
      this.activeSessionId = sessionId;
    });
  };

  createSession = (title: string): ChatSession => {
    const newSession: ChatSession = {
      id: generateId(),
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    runInAction(() => {
      this.sessions.push(newSession);
      this.activeSessionId = newSession.id;
    });

    return newSession;
  };

  deleteSession = (sessionId: string) => {
    runInAction(() => {
      this.sessions = this.sessions.filter(s => s.id !== sessionId);
      if (this.activeSessionId === sessionId) {
        this.activeSessionId = null;
      }
    });
  };

  clearAllSessions = () => {
    runInAction(() => {
      this.sessions = [];
      this.activeSessionId = null;
    });
  };

  addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    if (!this.activeSession) return;

    const newMessage: ChatMessage = {
      ...message,
      id: generateId(),
      timestamp: Date.now(),
    };

    runInAction(() => {
      this.activeSession!.messages.push(newMessage);
      this.activeSession!.updatedAt = Date.now();
    });

    return newMessage;
  };

  updateMessage = (messageId: string, text: string) => {
    if (!this.activeSession) return;

    console.log('ChatSessionStore.updateMessage called with:', messageId, text);
    const messageIndex = this.activeSession.messages.findIndex(m => m.id === messageId);
    console.log('Message index found:', messageIndex);

    if (messageIndex >= 0) {
      runInAction(() => {
        console.log('Updating message text from:', this.activeSession!.messages[messageIndex].text, 'to:', text);
        this.activeSession!.messages[messageIndex].text = text;
        this.activeSession!.updatedAt = Date.now();
      });
    } else {
      console.log('Message not found with ID:', messageId);
    }
  };

  updateMessageType = (messageId: string, type: 'conversation' | 'transcription') => {
    if (!this.activeSession) return;
    const idx = this.activeSession.messages.findIndex(m => m.id === messageId);
    if (idx >= 0) {
      runInAction(() => {
        this.activeSession!.messages[idx].type = type;
        this.activeSession!.updatedAt = Date.now();
      });
    }
  };

  // Add real-time transcription message handling
  updateTranscriptionMessage = (text: string, isFinal: boolean = false) => {
    if (!this.activeSession) return;

    const cleaned = text.replace(/\[BLANK_AUDIO\]/gi, '').replace(/\(BLANK_AUDIO\)/gi, '').trim();
    if (!cleaned) {
      this.clearTranscriptionMessage();
      return;
    }

    // Find existing transcription message (temporary message)
    const transcriptionMessageIndex = this.activeSession.messages.findIndex(
      m => m.author === 'user' && m.type === 'transcription'
    );

    if (transcriptionMessageIndex >= 0) {
      // Update existing transcription message
      runInAction(() => {
        this.activeSession!.messages[transcriptionMessageIndex].text = cleaned;
        this.activeSession!.messages[transcriptionMessageIndex].timestamp = Date.now();
        // Do NOT convert to 'conversation' type
        this.activeSession!.updatedAt = Date.now();
      });
    } else {
      // Create new transcription message
      const newMessage: ChatMessage = {
        id: generateId(),
        text: cleaned,
        author: 'user',
        timestamp: Date.now(),
        type: 'transcription', // always 'transcription'
      };

      runInAction(() => {
        this.activeSession!.messages.push(newMessage);
        this.activeSession!.updatedAt = Date.now();
      });
    }
  };

  // Clear transcription message when recording stops
  clearTranscriptionMessage = () => {
    if (!this.activeSession) return;

    runInAction(() => {
      this.activeSession!.messages = this.activeSession!.messages.filter(
        m => !(m.author === 'user' && m.type === 'transcription')
      );
      this.activeSession!.updatedAt = Date.now();
    });
  };

  deleteMessage = (messageId: string) => {
    if (!this.activeSession) return;

    runInAction(() => {
      this.activeSession!.messages = this.activeSession!.messages.filter(m => m.id !== messageId);
      this.activeSession!.updatedAt = Date.now();
    });
  };

  updateSessionTitle = (sessionId: string, title: string) => {
    const session = this.sessions.find(s => s.id === sessionId);
    if (session) {
      runInAction(() => {
        session.title = title;
        session.updatedAt = Date.now();
      });
    }
  };

  setIsGenerating = (isGenerating: boolean) => {
    runInAction(() => {
      this.isGenerating = isGenerating;
    });
  };

  updateSettings = (settings: Partial<AppSettings>) => {
    runInAction(() => {
      this.settings = { ...this.settings, ...settings };
    });
  };

  // Clean corrupted messages from the active session
  cleanCorruptedMessages = () => {
    if (!this.activeSession) return;

    runInAction(() => {
      if (this.activeSession) {
        this.activeSession.messages = this.activeSession.messages.filter(msg => {
          const text = msg.text || '';
          return !text.includes('"stop":') &&
            !text.includes('"temperature":') &&
            !text.includes('"max_tokens":') &&
            !text.includes('"top_p":') &&
            !text.includes('"top_k":');
        });
      }
    });
  };

  createConversationSession = (topic?: string) => {
    const title = topic ? `Chat: ${topic}` : 'New Chat';
    return this.createSession(title);
  };

  // Helper methods for message formatting
  formatMessageForContext = (messages: ChatMessage[]): string => {
    return messages.map(msg => {
      const role = msg.author === 'user' ? 'User' : 'Assistant';
      return `${role}: ${msg.text}`;
    }).join('\n');
  };

  getRecentMessages = (limit: number = 10): ChatMessage[] => {
    if (!this.activeSession) return [];
    return this.activeSession.messages.slice(-limit);
  };

  // Statistics
  getSessionStats = () => {
    const totalSessions = this.sessions.length;
    const totalMessages = this.sessions.reduce((sum, session) => sum + session.messages.length, 0);

    return {
      totalSessions,
      totalMessages,
      mostRecentSession: this.sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0]
    };
  };
}

export const chatSessionStore = new ChatSessionStore(); 