import { ChatMessage } from '../stores/ChatSessionStore';

export type ChatRole = 'system' | 'user' | 'assistant';

/**
 * Cleans Whisper STT output by removing audio artifact tokens (e.g. [BLANK_AUDIO])
 * and deduplicating repetitive hallucinated sentences, lines, or phrases.
 */
export const cleanTranscript = (text: string): string => {
  if (!text) return '';

  let cleaned = text
    .replace(/\[BLANK_AUDIO\]/gi, '')
    .replace(/\(BLANK_AUDIO\)/gi, '')
    .trim();

  if (!cleaned) return '';

  // 1. Deduplicate consecutive duplicate lines
  const lines = cleaned.split(/\r?\n+/);
  const uniqueLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const norm = trimmed.toLowerCase().replace(/[^a-z0-9]/gi, '');
    const lastNorm = uniqueLines.length > 0
      ? uniqueLines[uniqueLines.length - 1].toLowerCase().replace(/[^a-z0-9]/gi, '')
      : null;
    if (norm !== lastNorm) {
      uniqueLines.push(trimmed);
    }
  }
  cleaned = uniqueLines.join(' ');

  // 2. Deduplicate consecutive duplicate sentences split by . ! ?
  const sentences = cleaned.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [cleaned];
  const uniqueSentences: string[] = [];
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    const norm = trimmed.toLowerCase().replace(/[^a-z0-9]/gi, '');
    const lastNorm = uniqueSentences.length > 0
      ? uniqueSentences[uniqueSentences.length - 1].toLowerCase().replace(/[^a-z0-9]/gi, '')
      : null;
    if (norm !== lastNorm) {
      uniqueSentences.push(trimmed);
    }
  }
  cleaned = uniqueSentences.join(' ');

  // 3. Deduplicate repeating word/phrase sequences (e.g., "Hello how are you Hello how are you")
  let prev = '';
  let iterations = 0;
  while (prev !== cleaned && iterations < 5) {
    prev = cleaned;
    iterations++;
    cleaned = cleaned.replace(/\b([a-z0-9]+(?:[\s,]+[a-z0-9]+)*?)(?:[\s,]+\1)+(?=\b|[.!?]|$)/gi, '$1');
  }

  return cleaned.replace(/\s+/g, ' ').trim();
};


export interface ChatCompletionMessage {
  role: ChatRole;
  content: string;
}

// Kept short and imperative on purpose — see the matching note in
// ChatSessionStore.ts. This is only a fallback for when no systemPrompt is
// supplied at all; in the app it's normally overridden by
// ChatSessionStore.settings.systemPrompt.
const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful assistant. Reply to the user directly and briefly. ' +
  'Only answer the message you were just given. Do not invent example ' +
  'conversations, Q&A lists, or additional users and replies.';

// How much prior conversation to feed back to the model. Kept small on purpose:
// this app runs quantized models on-device (2-4 CPU threads), so every extra
// token of context directly adds to time-to-first-token and total latency.
const MAX_HISTORY_MESSAGES = 3;
const MAX_HISTORY_CHARS = 800;

export class ConversationPromptBuilder {
  private systemPrompt: string;

  constructor(systemPrompt?: string) {
    this.systemPrompt = systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
  }

  /**
   * Preferred entry point. Produces an OpenAI-compatible messages array
   * (system / user / assistant turns) instead of a flattened text blob.
   *
   * Why this matters: llama.rn can apply each model's own chat template
   * (embedded in the GGUF, e.g. Phi-3's `<|user|>...<|end|>`, Gemma's
   * `<start_of_turn>...`, Llama 3's `<|eot_id|>`) to this array via Jinja.
   * A single hand-rolled "User: ... Assistant:" string is a format none of
   * these models were actually fine-tuned on, which hurts response quality
   * AND latency — without the model's real end-of-turn token in play, the
   * only thing that stops generation is a generic string match, so runs
   * routinely burn through the full max_tokens budget instead of stopping
   * once the answer is actually finished.
   */
  buildMessages(userInput: string, conversationHistory: ChatMessage[] = []): ChatCompletionMessage[] {
    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: this.systemPrompt },
      ...MessageFormatter.toChatMessages(conversationHistory, MAX_HISTORY_MESSAGES, MAX_HISTORY_CHARS),
      { role: 'user', content: userInput.trim() },
    ];

    return messages;
  }

  /**
   * Legacy flattened-string prompt. Kept only as a fallback for any code
   * path that can't yet pass structured messages through to the model
   * runtime — prefer buildMessages() for anything new.
   */
  buildPrompt(userInput: string, conversationHistory: ChatMessage[] = []): string {
    return this.buildConversationPrompt(userInput, conversationHistory);
  }

  private buildConversationPrompt(
    userInput: string,
    conversationHistory: ChatMessage[] = []
  ): string {
    const historyContext =
      conversationHistory.length > 0
        ? `\nConversation so far:\n${MessageFormatter.formatForContext(conversationHistory.slice(-MAX_HISTORY_MESSAGES), MAX_HISTORY_CHARS)}\n`
        : '';

    return `${this.systemPrompt}

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
    const cleanMessages = this.filterNoise(messages);

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

  /**
   * Same recency/length-budgeted trimming as formatForContext, but returns
   * proper role-tagged messages for use with a model's native chat template
   * instead of a single flattened string.
   */
  static toChatMessages(
    messages: ChatMessage[],
    maxMessages: number = 3,
    maxLength: number = 800
  ): ChatCompletionMessage[] {
    const cleanMessages = this.filterNoise(messages).slice(-maxMessages);

    const result: ChatCompletionMessage[] = [];
    let totalLength = 0;

    for (let i = cleanMessages.length - 1; i >= 0; i--) {
      const msg = cleanMessages[i];
      const content = msg.text.replace(/[{}"]/g, '').trim();
      if (!content) continue;
      if (totalLength + content.length > maxLength) break;
      result.unshift({
        role: msg.author === 'user' ? 'user' : 'assistant',
        content,
      });
      totalLength += content.length;
    }

    return result;
  }

  private static filterNoise(messages: ChatMessage[]): ChatMessage[] {
    return messages.filter(msg => {
      const text = msg.text || '';
      return !text.includes('"stop":') &&
             !text.includes('"temperature":') &&
             !text.includes('"max_tokens":');
    });
  }
}

export const messageFormatter = MessageFormatter;
