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
    return `You are a helpful **English tutor** and language learning assistant. The user is learning ${targetLanguage} and speaks ${nativeLanguage} natively. Your role is to guide them like a private tutor and help them practice conversation naturally. Their current level is ${learningLevel}.


${correctionPreference === 'always' ? 'Always provide gentle corrections and explanations for any mistakes.' :
  correctionPreference === 'sometimes' ? 'Provide corrections when they would be helpful for learning, but prioritize natural conversation flow.' :
  'Focus on understanding and communication rather than corrections unless specifically asked.'}`;
  }

  private buildConversationPrompt(
    userInput: string,
    baseContext: string,
    conversationHistory: ChatMessage[] = []
  ): string {
    const levelGuidance = this.getLevelGuidance();
    const topicContext = this.context.topic
      ? `The conversation topic is: ${this.context.topic}. Keep the discussion relevant to this topic.`
      : 'No specific topic was provided, so you may introduce simple and engaging topics for practice.';
      
    const correctionInstruction =
      this.context.correctionPreference === 'always'
        ? 'Gently correct any mistakes the user makes and explain why. Focus on helping them learn.'
        : this.context.correctionPreference === 'sometimes'
        ? 'Correct mistakes only if they interfere with understanding, and prioritize a natural conversation flow.'
        : 'Do not correct mistakes unless the user specifically asks for corrections. Focus on communication.';
  
    const historyContext =
      conversationHistory.length > 0
        ? `\n\nHere is the previous conversation for context:\n${MessageFormatter.formatForContext(conversationHistory, 1500)}\n`
        : '';
  
    return `${baseContext}

You are a friendly, intelligent, and patient AI language tutor helping the user practice ${this.context.targetLanguage}. Respond conversationally, as if you are a real person chatting in real life. Use natural, engaging language, and feel free to use emojis if appropriate.

### Your Role:
- Encourage the user to practice their ${this.context.targetLanguage} and build confidence.
- ${correctionInstruction}
- ${levelGuidance}
- Ask follow-up questions to keep the conversation going and make it interactive.
- Share interesting facts, cultural notes, or idioms when relevant.
- Avoid simulating the user's responses. Only generate the Assistant's reply.
- Never generate the user's next message. Only generate the assistant's reply.
- Keep responses concise, friendly, and tailored to their level.

${topicContext}
${historyContext}

User: ${userInput}
Assistant:`;
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
      // Clean the text to remove any potential configuration artifacts
      const cleanText = msg.text.replace(/[{}"]/g, '').replace(/,\s*"stop":\s*\[.*?\]/g, '').trim();
      return `${role}: ${cleanText}`;
    }).join('\n');
  }

  static formatForContext(messages: ChatMessage[], maxLength: number = 2000): string {
    // Filter out any messages that might contain configuration artifacts
    const cleanMessages = messages.filter(msg => {
      const text = msg.text || '';
      // Skip messages that contain configuration-like content
      return !text.includes('"stop":') && 
             !text.includes('"temperature":') && 
             !text.includes('"max_tokens":') &&
             !text.includes('"top_p":') &&
             !text.includes('"top_k":');
    });
    
    const formatted = this.formatChatHistory(cleanMessages);
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