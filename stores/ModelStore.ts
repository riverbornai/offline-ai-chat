import { LlamaContext } from '@pocketpalai/llama.rn';
import { makeAutoObservable, runInAction, toJS } from 'mobx';
import { makePersistable } from 'mobx-persist-store';
import { Platform } from 'react-native';
import { ChatCompletionMessage } from '../utils/chat';
import {
    checkModelFileExists,
    deleteModelFile,
    ensureModelDirectories,
    formatBytes,
    getModelFileInfo,
    getModelFilePath
} from '../utils/platformPaths';
import { Storage } from '../utils/storage';

export interface AppModel {
  id: string;
  name: string;
  path: string;
  type: 'llm' | 'tts' | 'stt';
  isDownloaded: boolean;
  isLoading: boolean;
  size?: string;
  description?: string;
  languageSupport?: string[];
}

export interface CompletionParams {
  temperature: number;
  max_tokens: number;
  top_p: number;
  top_k: number;
  stop: string[];
}

// Explicit Jinja chat-template overrides, keyed by a substring of the model id.
//
// Why this exists: llama.rn will happily render *some* chat template for a
// model even when the GGUF has no embedded `tokenizer.chat_template` — it
// falls back to a generic default. For a model whose fine-tune expects a
// specific turn format (e.g. TinyLlama-1.1B-Chat-v1.0's Zephyr-style
// `<|system|>` / `<|user|>` / `<|assistant|>` markers), a mismatched
// fallback template produces exactly the symptoms of a badly-instructed
// tiny model: it echoes the system prompt back as if it were text to edit,
// rambles without ever hitting its real stop token, and gets truncated mid
// sentence at max_tokens instead of stopping naturally. Forcing the known
// correct template fixes that regardless of what the GGUF's metadata does
// or doesn't contain.
const CHAT_TEMPLATE_OVERRIDES: Record<string, string> = {
  tinyllama:
    "{% for message in messages %}" +
    "{% if message['role'] == 'user' %}" +
    "{{ '<|user|>\n' + message['content'] + eos_token }}" +
    "{% elif message['role'] == 'system' %}" +
    "{{ '<|system|>\n' + message['content'] + eos_token }}" +
    "{% elif message['role'] == 'assistant' %}" +
    "{{ '<|assistant|>\n' + message['content'] + eos_token }}" +
    "{% endif %}" +
    "{% if loop.last and add_generation_prompt %}" +
    "{{ '<|assistant|>\n' }}" +
    "{% endif %}" +
    "{% endfor %}",
};

// Models whose real chat template has no 'system' role at all. Gemma's
// official template literally does `{% if messages[0]['role'] == 'system' %}
// raise_exception('System role not supported') {% endif %}` (and, since a
// dropped/misaligned system turn desyncs the user/assistant loop.index
// parity check right after it, the error minja/llama.rn actually surfaces
// can instead read "Conversation roles must alternate user/assistant/...").
// Google's own guidance is to fold system instructions into the first user
// turn instead — see mergeSystemIntoFirstUserTurn below.
const NO_SYSTEM_ROLE_MODEL_SUBSTRINGS = ['gemma'];

function mergeSystemIntoFirstUserTurn(
  messages: ChatCompletionMessage[],
  activeModelId?: string
): ChatCompletionMessage[] {
  const modelId = (activeModelId || '').toLowerCase();
  const needsMerge = NO_SYSTEM_ROLE_MODEL_SUBSTRINGS.some(s => modelId.includes(s));
  if (!needsMerge) return messages;

  const sysIndex = messages.findIndex(m => m.role === 'system');
  if (sysIndex === -1) return messages;

  const systemContent = messages[sysIndex].content;
  const rest = messages.filter((_, i) => i !== sysIndex);
  const firstUserIndex = rest.findIndex(m => m.role === 'user');

  if (firstUserIndex === -1) {
    // No user turn to merge into (shouldn't normally happen) — just drop the
    // system message rather than send a role the template will reject.
    return rest;
  }

  rest[firstUserIndex] = {
    ...rest[firstUserIndex],
    content: `${systemContent}\n\n${rest[firstUserIndex].content}`,
  };
  return rest;
}

class ModelStore {
  models: AppModel[] = [
    {
      id: 'phi3-mini-4k-instruct',
      name: 'Phi-3 Mini 4K Instruct',
      path: 'model/phi-3-mini-4k-instruct-q4.gguf',
      type: 'llm',
      isDownloaded: false,
      isLoading: false,
      size: '2.23GB',
      description: 'Phi-3 Mini 4K Instruct model for chat',
      languageSupport: ['English']
    },
    {
      id: 'tinyllama-1.1b-chat-v1.0-q4_k_m',
      name: 'TinyLlama-1.1B Chat v1.0 Q4_K_M',
      path: 'model/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
      type: 'llm',
      isDownloaded: false,
      isLoading: false,
      size: '638MB',
      description: 'TinyLlama-1.1B Chat v1.0 Q4_K_M quantized model for chat',
      languageSupport: ['English']
    },
    {
      id: 'gemma-4-e2b-it',
      name: 'Gemma 4 E2B (Small)',
      path: 'model/google_gemma-4-E2B-it-IQ2_M.gguf',
      type: 'llm',
      isDownloaded: false,
      isLoading: false,
      size: '2.62GB',
      description: 'Google Gemma 4 E2B Multimodal - Optimized Small version (2.6GB) for devices with limited memory. Supports text, image, and audio.',
      languageSupport: ['English', 'Spanish', 'French', 'German', 'Italian', 'Japanese', 'Korean', 'Chinese']
    },
    {
      id: 'gemma-4-e4b-it',
      name: 'Gemma 4 E4B IT',
      path: 'model/google_gemma-4-E4B-it-Q4_K_M.gguf',
      type: 'llm',
      isDownloaded: false,
      isLoading: false,
      size: '5.41GB',
      description: 'Google Gemma 4 E4B (Effective 4B) High-performance multimodal model',
      languageSupport: ['English', 'Spanish', 'French', 'German', 'Italian', 'Japanese', 'Korean', 'Chinese']
    },
    {
      id: 'phi-4-mini-instruct',
      name: 'Phi-4 Mini / Reasoning',
      path: 'model/Phi-4-mini-instruct-Q4_K_M.gguf',
      type: 'llm',
      isDownloaded: false,
      isLoading: false,
      size: '2.49GB',
      description: 'Microsoft Phi-4 Mini - Reasoning & Math specialist (94.6% MATH-500)',
      languageSupport: ['English']
    },
    {
      id: 'phi-4-mini-iq2_m',
      name: 'Phi-4 Mini (Light)',
      path: 'model/phi-4-mini-iq2_m.gguf',
      type: 'llm',
      isDownloaded: false,
      isLoading: false,
      size: '1.40GB',
      description: 'Ultra-compressed Microsoft Phi-4 Mini - Optimized for low-memory devices while maintaining high reasoning capabilities.',
      languageSupport: ['English']
    },
    {
      id: 'gemma-2b-it-q4_k_m',
      name: 'Gemma 2B IT Q4_K_M',
      path: 'model/gemma-2b-it.Q4_K_M.gguf',
      type: 'llm',
      isDownloaded: false,
      isLoading: false,
      size: '1.63GB',
      description: 'Google Gemma 2B instruction-tuned model - compact, fast general-purpose chat model.',
      languageSupport: ['English']
    },
    {
      id: 'vits-piper-en_US-amy-low',
      name: 'Amy (Piper TTS)',
      path: 'en_US-amy-low.onnx',
      type: 'tts',
      isDownloaded: false,
      isLoading: false,
      size: '28MB',
      description: 'Natural sounding Piper TTS model (Amy Low)',
      languageSupport: ['English']
    },
    {
      id: 'kokoro-en-v0_19',
      name: 'Kokoro English (11 Voices)',
      path: 'kokoro-en-v0_19.onnx',
      type: 'tts',
      isDownloaded: false,
      isLoading: false,
      size: '310MB',
      description: 'High-quality Kokoro TTS model with 11 studio voices (American & British male/female).',
      languageSupport: ['English']
    }
  ];

  activeKokoroSpeakerId: number = 0;

  activeModelId: string | undefined = undefined;
  context: LlamaContext | undefined = undefined;
  isContextLoading: boolean = false;
  isInferencing: boolean = false;
  isQuickSetupLoading: boolean = false;
  isOnboardingComplete: boolean = false;

  // Context settings - optimized for Android
  n_context: number = 1024;  // Reduced for better memory usage
  n_gpu_layers: number = 0;   // Disable GPU layers for Android compatibility
  n_threads: number = 2;      // Reduced for better stability
  n_batch: number = 256;      // Reduced for better memory usage

  // Default completion parameters for language learning
  // stop: end-of-turn tokens across the model families this app ships
  // (Llama/TinyLlama, Phi-3/Phi-4, Llama-3-style, Gemma). These are a safety
  // net only — when a call passes `messages`, the model's own Jinja chat
  // template + jinja's built-in stop handling does the real work, so a
  // response ends when the model actually finishes, not when it exhausts
  // max_tokens.
  defaultCompletionParams: CompletionParams = {
    temperature: 0.7,
    // Lowered from 100 -> 60: decode time scales ~linearly with token count on
    // CPU-only mobile inference, so this is a direct, guaranteed cut to
    // worst-case latency (when a response doesn't hit its stop token early).
    max_tokens: 60,
    top_p: 0.9,
    top_k: 40,
    // <|im_start|>/<|im_end|> (ChatML) added as a safety net: when a GGUF has
    // no embedded chat_template, llama.rn's jinja fallback renders a generic
    // ChatML-style prompt. If the model was never trained on those markers
    // (e.g. a base, non-instruct model) it just imitates them as plain text
    // instead of treating them as turn boundaries, so generation never stops
    // naturally and runs to max_tokens while hallucinating extra turns.
    // Having them in `stop` at least cuts the runaway loop short.
    //
    // '<eos>' is Gemma's actual end-of-sequence token text (distinct from
    // '<end_of_turn>', which only marks turn boundaries inside multi-turn
    // chat) — without it in `stop`, the model emits the literal "<eos>" text
    // before generation halts, so every Gemma reply ends with a visible
    // "<eos>" tacked on.
    stop: ['</s>', '<|end|>', '<|eot_id|>', '<|end_of_text|>', '<end_of_turn>', '<|im_end|>', '<|im_start|>', '<eos>']
  };

  constructor() {
    makeAutoObservable(this);
    
    // Apply platform-specific optimizations (before rehydration as defaults)
    this.applyPlatformOptimizations();
    
    makePersistable(this, {
      name: 'ModelStore',
      // NOTE: n_threads, n_batch, n_context, n_gpu_layers are intentionally
      // NOT persisted — they are computed from the current platform at runtime.
      // Persisting them caused stale values (e.g. threads=2, batch=256) to
      // survive app updates and overwrite the correct platform values.
      properties: [
        'models',
        'activeModelId',
        'activeKokoroSpeakerId',
        'defaultCompletionParams',
        'isOnboardingComplete'
      ],
      storage: Storage,
    }).then(() => {
      // Re-apply platform optimizations AFTER rehydration so that any
      // previously-persisted stale values can never override them.
      runInAction(() => {
        this.applyPlatformOptimizations();
        this.syncModels();
      });
      this.initializeStore();
    }).catch(console.error);
  }

  applyPlatformOptimizations = () => {
    // navigator.hardwareConcurrency is unreliable in React Native (Hermes/JSC
    // may return undefined). Instead we use a fixed safe value of 4 threads:
    //   → matches the 2 performance + 2 efficiency core layout of typical
    //     octa-core SoCs (Helio G85/G200, SD 4-gen, Exynos 1xxx)
    //   → using all 8 threads hurts throughput on big.LITTLE because the OS
    //     scheduler competes with the app for the same cores
    //   → 4 is the empirically best value for on-device LLM inference
    if (Platform.OS === 'android') {
      this.n_context = 1024;
      this.n_gpu_layers = 0;
      this.n_threads = 4;   // Safe for all modern Android (2019+) octa-core SoCs
      this.n_batch = 512;   // Faster prefill; fine for models up to ~2 GB
    } else if (Platform.OS === 'ios') {
      this.n_context = 1536;
      this.n_gpu_layers = 0;
      this.n_threads = 4;
      this.n_batch = 512;
    } else {
      // Desktop / other platforms (typically higher CPU core count and more RAM)
      this.n_context = 2048;
      this.n_gpu_layers = 0;
      this.n_threads = 8;
      this.n_batch = 512;
    }
  };

  // Sync predefined models with persisted state
  syncModels = () => {
    const defaultModels: AppModel[] = [
      {
        id: 'phi3-mini-4k-instruct',
        name: 'Phi-3 Mini 4K Instruct',
        path: 'model/phi-3-mini-4k-instruct-q4.gguf',
        type: 'llm',
        isDownloaded: false,
        isLoading: false,
        size: '2.23GB',
        description: 'Phi-3 Mini 4K Instruct model for chat',
        languageSupport: ['English']
      },
      {
        id: 'tinyllama-1.1b-chat-v1.0-q4_k_m',
        name: 'TinyLlama-1.1B Chat v1.0 Q4_K_M',
        path: 'model/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
        type: 'llm',
        isDownloaded: false,
        isLoading: false,
        size: '638MB',
        description: 'TinyLlama-1.1B Chat v1.0 Q4_K_M quantized model for chat',
        languageSupport: ['English']
      },
      {
        id: 'gemma-4-e2b-it',
        name: 'Gemma 4 E2B (Small)',
        path: 'model/google_gemma-4-E2B-it-IQ2_M.gguf',
        type: 'llm',
        isDownloaded: false,
        isLoading: false,
        size: '2.62GB',
        description: 'Google Gemma 4 E2B Multimodal - Optimized Small version (2.6GB) for devices with limited memory. Supports text, image, and audio.',
        languageSupport: ['English', 'Spanish', 'French', 'German', 'Italian', 'Japanese', 'Korean', 'Chinese']
      },
      {
        id: 'gemma-4-e4b-it',
        name: 'Gemma 4 E4B IT',
        path: 'model/google_gemma-4-E4B-it-Q4_K_M.gguf',
        type: 'llm',
        isDownloaded: false,
        isLoading: false,
        size: '5.41GB',
        description: 'Google Gemma 4 E4B (Effective 4B) High-performance multimodal model',
        languageSupport: ['English', 'Spanish', 'French', 'German', 'Italian', 'Japanese', 'Korean', 'Chinese']
      },
      {
        id: 'phi-4-mini-instruct',
        name: 'Phi-4 Mini / Reasoning',
        path: 'model/Phi-4-mini-instruct-Q4_K_M.gguf',
        type: 'llm',
        isDownloaded: false,
        isLoading: false,
        size: '2.49GB',
        description: 'Microsoft Phi-4 Mini - Reasoning & Math specialist (94.6% MATH-500)',
        languageSupport: ['English']
      },
      {
        id: 'phi-4-mini-iq2_m',
        name: 'Phi-4 Mini (Light)',
        path: 'model/phi-4-mini-iq2_m.gguf',
        type: 'llm',
        isDownloaded: false,
        isLoading: false,
        size: '1.40GB',
        description: 'Ultra-compressed Microsoft Phi-4 Mini - Optimized for low-memory devices while maintaining high reasoning capabilities.',
        languageSupport: ['English']
      },
      {
        id: 'gemma-2b-it-q4_k_m',
        name: 'Gemma 2B IT Q4_K_M',
        path: 'model/gemma-2b-it.Q4_K_M.gguf',
        type: 'llm',
        isDownloaded: false,
        isLoading: false,
        size: '1.63GB',
        description: 'Google Gemma 2B instruction-tuned model - compact, fast general-purpose chat model.',
        languageSupport: ['English']
      },
      {
        id: 'vits-piper-en_US-amy-low',
        name: 'Amy (Piper TTS)',
        path: 'en_US-amy-low.onnx',
        type: 'tts',
        isDownloaded: false,
        isLoading: false,
        size: '28MB',
        description: 'Natural sounding Piper TTS model (Amy Low)',
        languageSupport: ['English']
      },
      {
        id: 'kokoro-en-v0_19',
        name: 'Kokoro English (11 Voices)',
        path: 'kokoro-en-v0_19.onnx',
        type: 'tts',
        isDownloaded: false,
        isLoading: false,
        size: '310MB',
        description: 'High-quality Kokoro TTS model with 11 studio voices (American & British male/female).',
        languageSupport: ['English']
      }
    ];

    runInAction(() => {
      defaultModels.forEach(defaultModel => {
        const index = this.models.findIndex(m => m.id === defaultModel.id);
        if (index === -1) {
          this.models.push(defaultModel);
        } else {
          // Update metadata but keep dynamic state
          const existing = this.models[index];
          existing.name = defaultModel.name;
          existing.type = defaultModel.type; // Added type sync
          existing.size = defaultModel.size;
          existing.description = defaultModel.description;
          existing.languageSupport = defaultModel.languageSupport;
          
          // Update path if not downloaded (to fix incorrect paths from previous versions)
          if (!existing.isDownloaded) {
            existing.path = defaultModel.path;
          }
          
          // Only update path if it's empty
          if (!existing.path) existing.path = defaultModel.path;
        }
      });
    });
  };

  initializeStore = async () => {
    try {
      // Sync models after persistence is loaded
      this.syncModels();

      // Ensure model directories exist
      await ensureModelDirectories();
      
      // Initialize LLM library
      const { initLlama } = await import('@pocketpalai/llama.rn');
      console.log('LLM library loaded successfully');
      
      // Check existing models and update their status
      await this.updateModelStatus();

      // Automatically complete onboarding if any LLM and TTS models are already downloaded
      const hasLlm = this.models.some(m => m.isDownloaded && m.type === 'llm');
      const hasTts = this.models.some(m => m.isDownloaded && m.type === 'tts');
      if (hasLlm && hasTts && !this.isOnboardingComplete) {
        runInAction(() => {
          this.isOnboardingComplete = true;
        });
        console.log('[ModelStore] Auto-completed onboarding since models are already downloaded');
      }
    } catch (error) {
      console.error('Failed to initialize LLM library:', error);
      console.log('📱 This usually means you need to rebuild the app with native libraries');
      console.log('💡 Run: npx expo run:android (or npx expo run:ios for iOS)');
      
      // Don't throw error - allow app to continue working
      // User can manually initialize from Models tab
    }
  };

  // Update model status based on actual file existence
  updateModelStatus = async () => {
    for (const model of this.models) {
      if (model.path) {
        try {
          const relativePath = model.path.includes('models/') 
            ? model.path.split('models/').pop() || ''
            : model.path;
          const exists = await checkModelFileExists(relativePath);
          const info = await getModelFileInfo(relativePath);
          
          runInAction(() => {
            model.isDownloaded = exists;
            if (info) {
              model.size = formatBytes(info.size);
            }
          });
        } catch (error) {
          console.error(`Error checking model ${model.name}:`, error);
          // Set as not downloaded if there's an error
          runInAction(() => {
            model.isDownloaded = false;
          });
        }
      }
    }
  };

  get activeModel(): AppModel | undefined {
    return this.models.find(m => m.id === this.activeModelId);
  }

  get availableModels(): AppModel[] {
    return this.models.filter(m => m.isDownloaded && m.type === 'llm');
  }

  get availableTtsModels(): AppModel[] {
    return this.models.filter(m => m.isDownloaded && m.type === 'tts');
  }

  // Validate if a language is supported by the active model
  isLanguageSupported = (language: string): boolean => {
    const model = this.activeModel;
    if (!model || !model.languageSupport) {
      return false;
    }
    return model.languageSupport.includes(language);
  };

  // Get supported languages for the active model
  getSupportedLanguages = (): string[] => {
    const model = this.activeModel;
    return model?.languageSupport || [];
  };

  setActiveModel = (modelId: string) => {
    runInAction(() => {
      this.activeModelId = modelId;
    });
  };

  setKokoroSpeakerId = (speakerId: number) => {
    runInAction(() => {
      this.activeKokoroSpeakerId = speakerId;
    });
  };

  setQuickSetupLoading = (loading: boolean) => {
    runInAction(() => {
      this.isQuickSetupLoading = loading;
    });
  };

  setIsOnboardingComplete = (complete: boolean) => {
    runInAction(() => {
      this.isOnboardingComplete = complete;
    });
  };

  initContext = async (model: AppModel) => {
    console.log(`[ModelStore] Initializing context for model: ${model.id} (${model.type})`);
    
    if (!model.isDownloaded || !model.path) {
      throw new Error('Model is not downloaded or path is not set');
    }

    if (model.type !== 'llm') {
      console.error(`[ModelStore] Attempted to initContext for non-LLM model: ${model.id} (type: ${model.type})`);
      throw new Error('Only LLM models can be initialized as LLM context');
    }

    runInAction(() => {
      this.isContextLoading = true;
    });

    try {
      // Release existing context if any
      if (this.context) {
        await this.releaseContext();
      }

      // Validate model file exists
      const relativePath = model.path.includes('models/') 
        ? model.path.split('models/').pop() || ''
        : model.path;
      
      const modelPath = await getModelFilePath(relativePath);
      const modelExists = await checkModelFileExists(relativePath);
      
      if (!modelExists) {
        throw new Error(`Model file not found at path: ${modelPath}`);
      }

      // Initialize the actual LLM context
      const { initLlama } = await import('@pocketpalai/llama.rn');
      
      console.log(`Initializing model context with path: ${modelPath}`);
      
      // Use safer settings for larger/newer models on mid-range devices.
      // Note: phi-4-mini-iq2_m is a heavily quantized 1.4GB model — exclude it
      // from the "large model" path so it gets a full-sized batch (256) instead
      // of 128. A batch of 128 causes the prefill phase to take 20+ seconds on
      // every message even though the model itself is tiny.
      const isLightQuantized = model.id.includes('iq2') || model.id.includes('iq3');
      const isLargeModel = (model.id.includes('gemma-4') || model.id.includes('phi-4')) && !isLightQuantized;
      // TinyLlama (1.1B) is cheap enough that a bigger context barely costs
      // anything, so it keeps the full platform n_context. Every other
      // non-"large" model here is a ~3.8B model (Phi-3 Mini, Phi-4 Mini
      // Light/IQ2) where prefill+decode cost is dominated by context size on
      // an 8GB-RAM phone, so cap it to 768 to cut latency without touching
      // the already-tuned 512 cap on the true large models (Gemma-4/Phi-4 full).
      const isTinyModel = model.id.includes('tinyllama');
      const finalCtx = isLargeModel
        ? Math.min(this.n_context, 512)
        : isTinyModel
          ? this.n_context
          : Math.min(this.n_context, 768);
      const finalBatch = isLargeModel ? Math.min(this.n_batch, 128) : this.n_batch;
      const useMlock = Platform.OS === 'android' ? false : (isLargeModel ? false : true); // Disable mlock for all models on Android and large models on other platforms to prevent OOM
      
      console.log(`Model settings: ctx=${finalCtx}, gpu_layers=${this.n_gpu_layers}, threads=${this.n_threads}, batch=${finalBatch}, mlock=${useMlock}`);
      
      const newContext = await initLlama({
        model: modelPath,
        n_ctx: finalCtx,
        n_gpu_layers: this.n_gpu_layers,
        n_threads: this.n_threads,
        n_batch: finalBatch,
        use_mlock: useMlock,
        use_mmap: true,
      });

      runInAction(() => {
        this.context = newContext;
        this.activeModelId = model.id;
        this.isContextLoading = false;
      });

      console.log(`Context initialized successfully for model: ${model.name}`);
    } catch (error) {
      runInAction(() => {
        this.isContextLoading = false;
      });
      console.error('Failed to initialize context:', error);
      
      // Provide more helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('Language is not supported')) {
          throw new Error('The selected language is not supported by this model. Please check the model\'s language support or select a different language.');
        } else if (error.message.includes('Model file not found')) {
          throw new Error('Model file not found. Please download the model first from the Models tab.');
        } else if (error.message.includes('field sizes are different')) {
          throw new Error('Model initialization failed due to native library issues. Please restart the app or try reducing the context size.');
        }
      }
      
      throw error;
    }
  };

  releaseContext = async () => {
    if (!this.context) {
      runInAction(() => {
        this.activeModelId = undefined;
      });
      return;
    }

    console.log(`[ModelStore] Releasing context for model: ${this.activeModelId}`);
    
    // Store context reference and clear state immediately to unblock UI and prevent race conditions
    const ctxToRelease = this.context;
    runInAction(() => {
      this.context = undefined;
      this.activeModelId = undefined;
      this.isInferencing = false;
    });

    try {
      // Attempt to release the specific context
      // NOTE: Some versions of @pocketpalai/llama.rn on Android (Old Arch) 
      // have a bug where releaseContext is not exported to JS.
      if (ctxToRelease && typeof ctxToRelease.release === 'function') {
        await ctxToRelease.release();
        console.log('[ModelStore] Context released successfully');
      }
    } catch (error) {
      // Check if it's the known missing native function error
      const errorStr = String(error);
      const isKnownBug = errorStr.includes('releaseContext is not a function') || 
                        errorStr.includes('undefined is not a function');
      
      if (isKnownBug) {
        console.warn('[ModelStore] Native releaseContext is missing (known library bug). Trying fallback...');
      } else {
        console.error('[ModelStore] Failed to release specific context:', error);
      }
      
      // Fallback: Try to release all contexts if specific release fails
      try {
        const { releaseAllLlama } = await import('@pocketpalai/llama.rn');
        if (typeof releaseAllLlama === 'function') {
          await releaseAllLlama();
          console.log('[ModelStore] All contexts released as fallback');
        }
      } catch (fallbackError) {
        // Only log fallback error if it's not the same missing function issue
        if (!String(fallbackError).includes('is not a function')) {
          console.error('[ModelStore] Fallback release also failed:', fallbackError);
        }
      }
    } finally {
      console.log('[ModelStore] Store state cleanup complete');
    }
  };

  // Test method to verify completion is working
  // testCompletion = async (): Promise<string> => {
  //   if (!this.context) {
  //     throw new Error('No model context available');
  //   }

  //   console.log('Testing completion with simple prompt...');
    
  //   try {
  //     const result = await this.generateCompletion('Hello', { max_tokens: 10 });
  //     console.log('Test completion result:', result);
  //     return result;
  //   } catch (error) {
  //     console.error('Test completion failed:', error);
  //     throw error;
  //   }
  // };

  generateCompletion = async (
    input: string | ChatCompletionMessage[],
    params: Partial<CompletionParams> = {},
    onToken?: (token: string) => void
  ): Promise<string> => {
    if (!this.context) {
      throw new Error('No model context available. Please download and load a model first.');
    }

    // Convert MobX observables to plain objects
    const completionParams = toJS({ ...this.defaultCompletionParams, ...params });

    // IMPORTANT: stop sequences are merged, never overwritten. Each model's
    // real end-of-turn token (</s>, <|end|>, <|eot_id|>, ...) lives in
    // defaultCompletionParams.stop. If a caller-supplied `stop` (e.g. turn
    // markers like "\nUser:") simply replaced that array via object spread,
    // the model's actual EOS token would drop out of the stop list for that
    // call, and generation would run all the way to max_tokens every single
    // time instead of stopping once the answer is done — a major, easy-to-miss
    // source of latency on-device.
    const mergedStop = Array.from(new Set([
      ...toJS(this.defaultCompletionParams.stop || []),
      ...(params.stop || []),
    ]));

    runInAction(() => {
      this.isInferencing = true;
    });

    let isStreamingComplete = false;

    try {
      let fullResponse = '';
      const usingChatMessages = Array.isArray(input);
      const templateOverride = this.activeModelId
        ? Object.entries(CHAT_TEMPLATE_OVERRIDES).find(([key]) =>
            this.activeModelId!.toLowerCase().includes(key)
          )?.[1]
        : undefined;

      const chatMessages = usingChatMessages
        ? mergeSystemIntoFirstUserTurn(input as ChatCompletionMessage[], this.activeModelId)
        : undefined;

      // Ensure all parameters are plain objects, not MobX observables
      const completionOptions = {
        ...(usingChatMessages
          ? {
              messages: chatMessages!,
              jinja: true,
              ...(templateOverride ? { chat_template: templateOverride } : {}),
            }
          : { prompt: input as string }),
        n_predict: completionParams.max_tokens,
        temperature: completionParams.temperature,
        top_p: completionParams.top_p,
        top_k: completionParams.top_k,
        stop: mergedStop,
      };

      console.log('Starting completion with options:', completionOptions);

      try {
        // Try the streaming approach first
        const result = await this.context.completion(
          completionOptions,
          (data: any) => {
            // Stop processing if streaming is marked complete
            if (isStreamingComplete) {
              console.log('ModelStore: Ignoring token after streaming complete:', data);
              return;
            }
            
            console.log('Received token data:', data);
            if (data && typeof data === 'object') {
              const token = data.token || data.content || data.text || '';
              if (token) {
                fullResponse += token;
                if (onToken) {
                  onToken(token);
                }
              }
            } else if (typeof data === 'string') {
              fullResponse += data;
              if (onToken) {
                onToken(data);
              }
            }
          }
        );
        
        // Mark streaming as complete
        isStreamingComplete = true;
        
        console.log('Completion result:', result);
        
        // If result is a string, use it as the response
        if (typeof result === 'string') {
          fullResponse = result;
          if (onToken) {
            onToken(result);
          }
        }
        
        return fullResponse;
        
      } catch (streamError) {
        // Mark streaming as complete to stop any further token processing
        isStreamingComplete = true;
        
        console.warn('Streaming completion failed, trying simple completion:', streamError);
        
        // Check if this is a context not found error and try to recover
        if (streamError && (streamError.toString().includes('Context not found') || 
            (streamError instanceof Error && streamError.message.includes('Context not found')))) {
          console.log('Context lost, attempting to recover...');
          await this.recoverContext();
          
          // Retry the completion after recovery
          const result = await this.context!.completion(completionOptions);
          
          if (typeof result === 'string') {
            fullResponse = result;
            if (onToken) {
              onToken(result);
            }
          } else if (result && typeof result === 'object') {
            const responseText = (result as any).text || (result as any).content || (result as any).response || '';
            fullResponse = responseText;
            if (onToken) {
              onToken(responseText);
            }
          }
          
          return fullResponse;
        }
        
        // Fallback to simple completion without streaming
        const result = await this.context.completion(completionOptions);
        
        console.log('Simple completion result:', result);
        
        if (typeof result === 'string') {
          fullResponse = result;
          if (onToken) {
            onToken(result);
          }
        } else if (result && typeof result === 'object') {
          // Handle object response
          const responseText = (result as any).text || (result as any).content || (result as any).response || '';
          fullResponse = responseText;
          if (onToken) {
            onToken(responseText);
          }
        }
        
        return fullResponse;
      }

    } catch (error) {
      // Mark streaming as complete to stop any further token processing
      isStreamingComplete = true;
      
      console.error('Error during completion:', error);
      
      // Check if this is a context not found error and try to recover
      if (error && (error.toString().includes('Context not found') || 
          (error instanceof Error && error.message.includes('Context not found')))) {
        console.log('Context lost during completion, attempting to recover...');
        try {
          await this.recoverContext();
          throw new Error('Context was lost but has been recovered. Please try your message again.');
        } catch (recoveryError) {
          console.error('Failed to recover context:', recoveryError);
          throw new Error('Context not found. Please go to the Models tab and reload the model.');
        }
      }
      
      throw error;
    } finally {
      runInAction(() => {
        this.isInferencing = false;
      });
    }
  };

  // Helper method to recover lost context
  recoverContext = async (): Promise<void> => {
    if (!this.activeModelId) {
      throw new Error('No active model to recover context for');
    }

    const activeModel = this.models.find(m => m.id === this.activeModelId);
    if (!activeModel) {
      throw new Error('Active model not found');
    }

    console.log('Attempting to recover context for model:', activeModel.name);
    
    // Clear the current context
    runInAction(() => {
      this.context = undefined;
    });

    // Reinitialize the context
    await this.initContext(activeModel);
    
    console.log('Context recovery completed');
  };

  updateCompletionParams = (params: Partial<CompletionParams>) => {
    runInAction(() => {
      this.defaultCompletionParams = { ...this.defaultCompletionParams, ...params };
    });
  };

  setContextSettings = (settings: {
    n_context?: number;
    n_gpu_layers?: number;
    n_threads?: number;
    n_batch?: number;
  }) => {
    runInAction(() => {
      if (settings.n_context !== undefined) this.n_context = settings.n_context;
      if (settings.n_gpu_layers !== undefined) this.n_gpu_layers = settings.n_gpu_layers;
      if (settings.n_threads !== undefined) this.n_threads = settings.n_threads;
      if (settings.n_batch !== undefined) this.n_batch = settings.n_batch;
    });
  };

  // Helper function to set model path with platform-specific handling
  setModelPath = async (modelId: string, filename: string) => {
    const model = this.models.find(m => m.id === modelId);
    if (!model) {
      console.error(`Model ${modelId} not found`);
      return;
    }

    try {
      // Get platform-specific path
      const platformPath = await getModelFilePath(filename);

      runInAction(() => {
        model.path = platformPath;
        model.isLoading = false;
      });
      
      console.log(`Set ${model.name} path to: ${platformPath}`);
      
      // Check if file actually exists
      await this.checkModelFileExists(modelId);
    } catch (error) {
      console.error('Error setting model path:', error);
    }
  };

  // Helper function to check if model file exists
  checkModelFileExists = async (modelId: string, onProgress?: (message: string) => void): Promise<boolean> => {
    const model = this.models.find(m => m.id === modelId);
    if (!model || !model.path) return false;

    try {
      const relativePath = model.path.includes('models/') 
        ? model.path.split('models/').pop() || ''
        : model.path;
      const exists = await checkModelFileExists(relativePath, onProgress);
      
      runInAction(() => {
        model.isDownloaded = exists;
      });
      
      return exists;
    } catch (error) {
      console.error('Error checking model file:', error);
      return false;
    }
  };

  // Download model with proper platform handling
  downloadModel = async (modelId: string, downloadUrl?: string) => {
    const model = this.models.find(m => m.id === modelId);
    if (!model) return;

    runInAction(() => {
      model.isLoading = true;
    });

    try {
      // Ensure directories exist
      await ensureModelDirectories();

      if (downloadUrl) {
        // TODO: Implement actual download from URL
        // For now, this is a placeholder for the download functionality
        const filename = `${modelId}.gguf`;
        
        // Simulate download process
        console.log(`Downloading model ${model.name} from ${downloadUrl}...`);
        
        // In a real implementation, you would:
        // 1. Download the file to temporary location
        // 2. Move it to the model directory
        // 3. Update the model path
        
        // For now, set the path assuming the file will be downloaded
        const platformPath = await getModelFilePath(filename);
        
        runInAction(() => {
          model.path = platformPath;
          model.isDownloaded = true;
          model.isLoading = false;
        });
        
        console.log(`Model ${modelId} download simulated successfully`);
      } else {
        throw new Error('No download URL provided');
      }
    } catch (error) {
      runInAction(() => {
        model.isLoading = false;
      });
      console.error('Failed to download model:', error);
      throw error;
    }
  };

  // Delete model file
  deleteModel = async (modelId: string) => {
    const model = this.models.find(m => m.id === modelId);
    if (!model || !model.path) return;

    try {
      const filename = model.path.split('/').pop() || '';
      await deleteModelFile(filename);
      
      runInAction(() => {
        model.isDownloaded = false;
        model.path = '';
      });
      
      console.log(`Model ${model.name} deleted successfully`);
    } catch (error) {
      console.error('Error deleting model:', error);
      throw error;
    }
  };

  // Get model file information
  getModelInfo = async (modelId: string) => {
    const model = this.models.find(m => m.id === modelId);
    if (!model || !model.path) return null;

    try {
      const filename = model.path.split('/').pop() || '';
      const info = await getModelFileInfo(filename);
      
      if (info) {
        return {
          ...info,
          sizeFormatted: formatBytes(info.size),
          path: model.path
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting model info:', error);
      return null;
    }
  };
}

export const modelStore = new ModelStore();