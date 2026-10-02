// Storage adapter that works in both SSR and client environments
import { Platform } from 'react-native';

interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear?(): Promise<void>;
  getAllKeys?(): Promise<string[]>;
}

// Web storage implementation
class WebStorage implements StorageAdapter {
  private isClient(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  async getItem(key: string): Promise<string | null> {
    if (!this.isClient()) {
      return null;
    }
    return window.localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!this.isClient()) {
      return;
    }
    window.localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (!this.isClient()) {
      return;
    }
    window.localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    if (!this.isClient()) {
      return;
    }
    window.localStorage.clear();
  }

  async getAllKeys(): Promise<string[]> {
    if (!this.isClient()) {
      return [];
    }
    return Object.keys(window.localStorage);
  }
}

// No-op storage for SSR
class NoOpStorage implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return null;
  }

  async setItem(key: string, value: string): Promise<void> {
    // No-op
  }

  async removeItem(key: string): Promise<void> {
    // No-op
  }

  async clear(): Promise<void> {
    // No-op
  }

  async getAllKeys(): Promise<string[]> {
    return [];
  }
}

// Export appropriate storage based on platform
export const Storage: StorageAdapter = (() => {
  if (Platform.OS === 'web') {
    return new WebStorage();
  } else {
    // For native platforms, use AsyncStorage
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return AsyncStorage;
    } catch (error) {
      console.warn('AsyncStorage not available, using NoOpStorage');
      return new NoOpStorage();
    }
  }
})(); 