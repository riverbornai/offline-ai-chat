import { ChatMessage } from '../stores/ChatSessionStore';

export interface ConversationContext {
  targetLanguage: string;
  nativeLanguage: string;
  learningLevel: 'beginner' | 'intermediate' | 'advanced';
  correctionPreference: 'always' | 'sometimes' | 'never';
  topic?: string;
}

export class ConversationPromptBuilder {
  private context: ConversationContext;

  constructor(context: ConversationContext) {
    this.context = context;
  }

  buildPrompt(userInput: string, conversationHistory: ChatMessage[] = []): string {
    const baseContext = this.getBaseContext();
    return this.buildConversationPrompt(userInput, baseContext, conversationHistory);
  }

  private getBaseContext(): string {
    const { targetLanguage, nativeLanguage, learningLevel, correctionPreference } = this.context;
    return `You are a helpful language learning assistant. The user is learning ${targetLanguage} and speaks ${nativeLanguage} natively. Their current level is ${learningLevel}.

${correctionPreference === 'always' ? 'Always provide gentle corrections and explanations for any mistakes.' :
  correctionPreference === 'sometimes' ? 'Provide corrections when they would be helpful for learning, but prioritize natural conversation flow.' :
  'Focus on understanding and communication rather than corrections unless specifically asked.'}`;
  }

  private buildConversationPrompt(userInput: string, baseContext: string, conversationHistory: ChatMessage[] = []): string {
    const levelGuidance = this.getLevelGuidance();
    const topicContext = this.context.topic ? `The conversation topic is about: ${this.context.topic}.` : '';
    const historyContext = conversationHistory.length > 0
      ? `\n\nPrevious conversation:\n${MessageFormatter.formatForContext(conversationHistory, 1500)}\n`
      : '';
    return `${baseContext}

Have a natural conversation with the user in ${this.context.targetLanguage}. ${levelGuidance} ${topicContext}

Keep your responses engaging and encourage the user to continue practicing. If they make mistakes, handle them according to the correction preference above.

IMPORTANT: 
- Respond with ONLY ONE very short, natural sentence.
- Do NOT add extra greetings, explanations, or follow-up questions.
- Do NOT repeat yourself or elaborate.
- Do NOT use any formatting, tags, or metadata.
- Do NOT add any notes, explanations, or meta-comments. Only reply with a short, natural sentence.
- Wait for the user's next message before saying anything else${historyContext}

User: ${userInput}`;
  }

  private getLevelGuidance(): string {
    switch (this.context.learningLevel) {
      case 'beginner':
        return 'Use simple vocabulary and sentence structures. Speak clearly and slowly.';
      case 'intermediate':
        return 'Use moderately complex language with some idiomatic expressions. Introduce new vocabulary in context.';
      case 'advanced':
        return 'Use natural, fluent language with idioms and complex structures. Challenge the user appropriately.';
      default:
        return 'Adjust your language level based on the user\'s responses.';
    }
  }
}

// Message formatting utilities
export class MessageFormatter {
  static formatChatHistory(messages: ChatMessage[]): string {
    return messages.map(msg => {
      const role = msg.author === 'user' ? 'User' : 'Assistant';
      return `${role}: ${msg.text}`;
    }).join('\n');
  }

  static formatForContext(messages: ChatMessage[], maxLength: number = 2000): string {
    const formatted = this.formatChatHistory(messages);
    if (formatted.length <= maxLength) {
      return formatted;
    }
    // Truncate from the beginning, keeping the most recent messages
    const truncated = formatted.slice(-maxLength);
    const firstNewlineIndex = truncated.indexOf('\n');
    return firstNewlineIndex > 0 ? truncated.slice(firstNewlineIndex + 1) : truncated;
  }

  static extractKeywords(text: string): string[] {
    // Simple keyword extraction - in a real app, you might use NLP libraries
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'must']);
    return words
      .filter(word => word.length > 2 && !stopWords.has(word))
      .filter((word, index, array) => array.indexOf(word) === index) // Remove duplicates
      .slice(0, 10); // Limit to 10 keywords
  }
}

export const createConversationPromptBuilder = (context: ConversationContext) =>
  new ConversationPromptBuilder(context);

export const messageFormatter = MessageFormatter; 