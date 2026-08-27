import React, { createContext, useContext, useEffect } from 'react';
import 'react-native-get-random-values';

// Import stores after polyfill
import { chatSessionStore } from '../stores/ChatSessionStore';
import { modelStore } from '../stores/ModelStore';
import { quickSetup } from '../utils/modelSetup';

interface StoreContextType {
  chatSessionStore: typeof chatSessionStore;
  modelStore: typeof modelStore;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Show setup instructions when app starts
    const initializeApp = async () => {
      try {
        await quickSetup();
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };
    
    initializeApp();
  }, []);

  return (
    <StoreContext.Provider value={{ chatSessionStore, modelStore }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStores = (): StoreContextType => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStores must be used within a StoreProvider');
  }
  return context;
}; 