import { makeAutoObservable, runInAction } from 'mobx';
import { makePersistable } from 'mobx-persist-store';
import { Storage } from '../utils/storage';

// Simple UUID generator for React Native
const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
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

class ChatSessionStore {
  sessions: ChatSession[] = [];
  activeSessionId: string | null = null;
  isGenerating: boolean = false;

  settings: AppSettings = {
    systemPrompt: 'You are a helpful and engaging AI assistant. Provide concise, natural, and helpful answers.',
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