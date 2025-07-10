import { ChatMessage } from '../stores/ChatSessionStore';

export type LanguageLearningPromptType = 
  | 'conversation'
  | 'translation'
  | 'grammar'
  | 'vocabulary'
  | 'pronunciation'
  | 'cultural'
  | 'roleplay';

export interface LanguageLearningContext {
  targetLanguage: string;
  nativeLanguage: string;
  learningLevel: 'beginner' | 'intermediate' | 'advanced';
  correctionPreference: 'always' | 'sometimes' | 'never';
  focusArea?: string;
  topic?: string;
}

export class LanguageLearningPromptBuilder {
  private context: LanguageLearningContext;

  constructor(context: LanguageLearningContext) {
    this.context = context;
  }

  buildPrompt(type: LanguageLearningPromptType, userInput: string, conversationHistory: ChatMessage[] = []): string {
    const baseContext = this.getBaseContext();
    
    switch (type) {
      case 'conversation':
        return this.buildConversationPrompt(userInput, baseContext, conversationHistory);
      
      case 'translation':
        return this.buildTranslationPrompt(userInput, baseContext);
      
      case 'grammar':
        return this.buildGrammarPrompt(userInput, baseContext);
      
      case 'vocabulary':
        return this.buildVocabularyPrompt(userInput, baseContext);
      
      case 'pronunciation':
        return this.buildPronunciationPrompt(userInput, baseContext);
      
      case 'cultural':
        return this.buildCulturalPrompt(userInput, baseContext);
      
      case 'roleplay':
        return this.buildRoleplayPrompt(userInput, baseContext, conversationHistory);
      
      default:
        return this.buildConversationPrompt(userInput, baseContext, conversationHistory);
    }
  }

  private getBaseContext(): string {
    const { targetLanguage, nativeLanguage, learningLevel, correctionPreference } = this.context;
    
    return `You are a helpful language learning assistant. The user is learning ${targetLanguage} and speaks ${nativeLanguage} natively. Their current level is ${learningLevel}.

${correctionPreference === 'always' ? 'Always provide gentle corrections and explanations for any mistakes.' : 
  correctionPreference === 'sometimes' ? 'Provide corrections when they would be helpful for learning, but prioritize natural conversation flow.' : 
  'Focus on understanding and communication rather than corrections unless specifically asked.'}`
  }

  private buildConversationPrompt(userInput: string, baseContext: string, conversationHistory: ChatMessage[] = []): string {
    const levelGuidance = this.getLevelGuidance();
    const topicContext = this.context.topic ? `The conversation topic is about: ${this.context.topic}.` : '';
    
    // Build conversation history context
    const historyContext = conversationHistory.length > 0 
      ? `\n\nPrevious conversation:\n${MessageFormatter.formatForContext(conversationHistory, 1500)}\n`
      : '';
    
    return `${baseContext}

Have a natural conversation with the user in ${this.context.targetLanguage}. ${levelGuidance} ${topicContext}

Keep your responses engaging and encourage the user to continue practicing. If they make mistakes, handle them according to the correction preference above.

IMPORTANT: 
- Keep responses VERY SHORT (1-2 sentences maximum)
- Provide only ONE brief response to the user's message, then stop and wait for their next input
- Do not continue the conversation or ask multiple questions in sequence
- Respond naturally without any formatting, tags, or metadata
- Do not use structured formats like "Solution:", "Answer:", or similar prefixes
- Be concise and conversational${historyContext}

User: ${userInput}`;
  }

  private buildTranslationPrompt(userInput: string, baseContext: string): string {
    return `${baseContext}

The user wants help with translation. Provide an accurate translation and explain key grammar points or vocabulary. Also suggest alternative translations if appropriate.

Text to translate: "${userInput}"

Please provide:
1. Translation from ${this.context.nativeLanguage} to ${this.context.targetLanguage}
2. Brief explanation of grammar/vocabulary used
3. Alternative ways to express the same idea (if applicable)

Translation:`;
  }

  private buildGrammarPrompt(userInput: string, baseContext: string): string {
    return `${baseContext}

The user needs help with grammar. Analyze their text and provide constructive feedback with explanations and examples.

Text to analyze: "${userInput}"

Please provide:
1. Grammar corrections (if needed)
2. Explanation of the grammar rules involved
3. Examples of correct usage
4. Practice suggestions

Grammar Analysis:`;
  }

  private buildVocabularyPrompt(userInput: string, baseContext: string): string {
    return `${baseContext}

The user wants to learn about vocabulary. Provide comprehensive information about the word/phrase they're asking about.

Word/Phrase: "${userInput}"

Please provide:
1. Definition in ${this.context.targetLanguage}
2. Translation to ${this.context.nativeLanguage}
3. Pronunciation guide
4. Example sentences
5. Related words or phrases
6. Usage context and tips

Vocabulary Explanation:`;
  }

  private buildPronunciationPrompt(userInput: string, baseContext: string): string {
    return `${baseContext}

The user wants help with pronunciation. Provide guidance on how to pronounce the word/phrase correctly.

Word/Phrase: "${userInput}"

Please provide:
1. Phonetic transcription
2. Pronunciation tips
3. Similar sounds in ${this.context.nativeLanguage} (if applicable)
4. Common pronunciation mistakes to avoid
5. Practice exercises

Pronunciation Guide:`;
  }

  private buildCulturalPrompt(userInput: string, baseContext: string): string {
    return `${baseContext}

The user wants to understand cultural aspects related to the language. Provide insights about cultural context, customs, or usage.

Topic: "${userInput}"

Please provide:
1. Cultural explanation
2. How this relates to language usage
3. Social context and appropriate situations
4. Cultural do's and don'ts
5. Examples of cultural expressions

Cultural Insights:`;
  }

  private buildRoleplayPrompt(userInput: string, baseContext: string, conversationHistory: ChatMessage[] = []): string {
    const scenario = this.context.topic || 'general conversation';
    
    // Build conversation history context for roleplay
    const historyContext = conversationHistory.length > 0 
      ? `\n\nPrevious roleplay conversation:\n${MessageFormatter.formatForContext(conversationHistory, 1500)}\n`
      : '';
    
    return `${baseContext}

Let's do a roleplay exercise. You will play a role in a ${scenario} scenario. Respond naturally in ${this.context.targetLanguage} as if you were in this real-life situation.

Scenario: ${scenario}${historyContext}
User's action/dialogue: ${userInput}

Respond as your character would, keeping the language appropriate for a ${this.context.learningLevel} learner.

Response:`;
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

// Language learning specific utilities
export class LanguageLearningUtils {
  static getLanguageCode(language: string): string {
    const languageCodes: Record<string, string> = {
      'English': 'en',
      'Spanish': 'es',
      'French': 'fr',
      'German': 'de',
      'Italian': 'it',
      'Portuguese': 'pt',
      'Russian': 'ru',
      'Chinese': 'zh',
      'Japanese': 'ja',
      'Korean': 'ko',
      'Arabic': 'ar',
      'Hindi': 'hi',
      'Dutch': 'nl',
      'Swedish': 'sv',
      'Norwegian': 'no',
      'Danish': 'da',
      'Finnish': 'fi',
      'Polish': 'pl',
      'Czech': 'cs',
      'Hungarian': 'hu',
      'Greek': 'el',
      'Turkish': 'tr',
      'Hebrew': 'he',
      'Thai': 'th',
      'Vietnamese': 'vi',
    };
    
    return languageCodes[language] || 'en';
  }

  static getLanguageName(code: string): string {
    const codeToLanguage: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'nl': 'Dutch',
      'sv': 'Swedish',
      'no': 'Norwegian',
      'da': 'Danish',
      'fi': 'Finnish',
      'pl': 'Polish',
      'cs': 'Czech',
      'hu': 'Hungarian',
      'el': 'Greek',
      'tr': 'Turkish',
      'he': 'Hebrew',
      'th': 'Thai',
      'vi': 'Vietnamese',
    };
    
    return codeToLanguage[code] || 'English';
  }

  static getSupportedLanguages(): string[] {
    return [
        'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
        'Russian', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi',
        'Dutch', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Polish',
        'Czech', 'Hungarian', 'Greek', 'Turkish', 'Hebrew', 'Thai', 'Vietnamese'
      ];
  }

  static getCommonTopics(): string[] {
    return [
      'Greetings and Introductions',
      'Family and Relationships',
      'Food and Cooking',
      'Travel and Transportation',
      'Work and Career',
      'Hobbies and Leisure',
      'Shopping and Money',
      'Health and Medical',
      'Weather and Seasons',
      'Education and Learning',
      'Technology and Internet',
      'Culture and Traditions',
      'Sports and Fitness',
      'Home and Living',
      'Entertainment and Media',
      'Environment and Nature',
      'Business and Economics',
      'Politics and Current Events',
      'History and Geography',
      'Science and Innovation'
    ];
  }

  static getDifficultyDescription(level: 'beginner' | 'intermediate' | 'advanced'): string {
    const descriptions = {
      beginner: 'Basic vocabulary and simple sentence structures. Focus on essential communication.',
      intermediate: 'More complex grammar and vocabulary. Can handle most everyday situations.',
      advanced: 'Sophisticated language use with idioms and nuanced expressions. Near-native fluency.'
    };
    
    return descriptions[level];
  }
}

// Export instances for easy use
export const createPromptBuilder = (context: LanguageLearningContext) => 
  new LanguageLearningPromptBuilder(context);

export const messageFormatter = MessageFormatter;
export const languageLearningUtils = LanguageLearningUtils; 