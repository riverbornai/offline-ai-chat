import { ChatMessage } from '../stores/ChatSessionStore';

export interface ConversationContext {
  targetLanguage?: string;
  nativeLanguage?: string;
  learningLevel?: 'beginner' | 'intermediate' | 'advanced';
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
    return `You are a helpful and engaging AI voice assistant. Provide concise, natural, and helpful answers to user questions. Maintain a friendly and conversational tone.`;
  }

  private buildConversationPrompt(
    userInput: string,
    baseContext: string,
    conversationHistory: ChatMessage[] = []
  ): string {

    const historyContext =
      conversationHistory.length > 0
        ? `\nConversation so far:\n${MessageFormatter.formatForContext(conversationHistory.slice(-3), 800)}\n`
        : '';

    return `${baseContext}

### Instructions:
- Be a natural and engaging conversation partner
- Keep responses concise and optimized for voice interaction
- Provide helpful information and answer questions accurately
- Maintain a consistent and friendly persona

${historyContext}

User: ${userInput}
Assistant:`;
  }
}

// Message formatting utilities
export class MessageFormatter {
  static formatChatHistory(messages: ChatMessage[]): string {
    return messages.map(msg => {
      const role = msg.author === 'user' ? 'User' : 'Assistant';
      const cleanText = msg.text.replace(/[{}"]/g, '').trim();
      return `${role}: ${cleanText}`;
    }).join('\n');
  }

  static formatForContext(messages: ChatMessage[], maxLength: number = 800): string {
    const cleanMessages = messages.filter(msg => {
      const text = msg.text || '';
      return !text.includes('"stop":') &&
             !text.includes('"temperature":') &&
             !text.includes('"max_tokens":');
    });

    const formattedMessages: string[] = [];
    let totalLength = 0;

    for (let i = cleanMessages.length - 1; i >= 0; i--) {
      const formatted = this.formatChatHistory([cleanMessages[i]]);
      if (totalLength + formatted.length > maxLength) break;
      formattedMessages.unshift(formatted);
      totalLength += formatted.length;
    }

    return formattedMessages.join('\n');
  }
}

export const createConversationPromptBuilder = (context: ConversationContext) =>
  new ConversationPromptBuilder(context);

export const messageFormatter = MessageFormatter;


