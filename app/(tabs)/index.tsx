import React from 'react';
import { StyleSheet } from 'react-native';
import ChatScreen from '../../components/ChatScreen';

export default function LLMChatScreen() {
  return (
    <ChatScreen 
      topic="general conversation"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 