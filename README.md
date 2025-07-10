# Language Learning Assistant with Phi-3 Mini AI

A comprehensive React Native language learning app powered by Microsoft's Phi-3 Mini AI model, featuring speech-to-text, text-to-speech, and real-time AI chat capabilities.

## 🚀 Features

- **Real AI Chat**: Powered by Phi-3 Mini (4K context) running locally on your device
- **Speech-to-Text**: Practice speaking in your target language
- **Text-to-Speech**: Listen to proper pronunciation
- **Language Learning Modes**: Conversation, Translation, Grammar, and Vocabulary
- **Offline Support**: AI runs completely offline after initial setup
- **Multi-language Support**: English, Spanish, French, German, Italian, and more

## 📱 AI Model Setup

### Your Phi-3 Mini Model
Your `Phi-3-mini-4k-instruct-q4.gguf` model is already configured and will auto-initialize on app startup.

**Model Details:**
- **Model**: Microsoft Phi-3 Mini 4K Instruct (Quantized)
- **Size**: ~2.4GB
- **Context**: 4K tokens
- **Quantization**: Q4 (optimized for mobile)
- **Languages**: Multilingual support including major European languages

## 🎯 Quick Start

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start the App:**
   ```bash
   # For iOS
   npm run ios

   # For Android  
   npm run android

   # For development
   npm start
   ```

3. **Check Model Status:**
   - Go to the **Home** tab to see real-time model status
   - Visit **Models** tab for detailed diagnostics
   - The Phi-3 model should auto-initialize on startup

4. **Start Chatting:**
   - Navigate to **AI Chat** tab
   - Choose your learning mode (Conversation, Translation, Grammar, Vocabulary)
   - Start chatting with the AI in your target language!

## 📋 App Structure

### Tabs Overview
- **Home**: App overview and model status
- **Speech to Text**: Practice speaking with real-time recognition
- **Text to Speech**: Listen to proper pronunciation
- **AI Chat**: Real conversations with Phi-3 Mini AI
- **Models**: Monitor and manage AI models

### AI Chat Modes
1. **Conversation**: Natural dialogue in your target language
2. **Translation**: Translate between languages with explanations
3. **Grammar**: Grammar analysis and corrections
4. **Vocabulary**: Learn new words and phrases

## 🔧 Technical Details

### Model Store
The app uses MobX for state management with persistent storage:
- **Model Path**: `model/Phi-3-mini-4k-instruct-q4.gguf`
- **Context Size**: 2048 tokens (configurable)
- **Temperature**: 0.7 (balanced creativity/accuracy)
- **Max Tokens**: 500 per response

### Libraries Used
- **@pocketpalai/llama.rn**: Local LLM inference
- **expo-router**: Navigation
- **mobx**: State management
- **react-native-tts**: Text-to-speech
- **expo-audio**: Audio recording

## 🛠️ Troubleshooting

### Model Not Loading
1. Check **Models** tab for detailed status
2. Verify model file exists at `model/Phi-3-mini-4k-instruct-q4.gguf`
3. Try the **Quick Setup** button in Models tab
4. Restart the app

### Common Issues
- **Permission Errors**: Grant microphone/storage permissions
- **Memory Issues**: Close other apps before loading the model
- **Performance**: Reduce context size in model settings if needed

### Debug Commands
```javascript
// Check model status
import { getModelStatus } from './utils/modelSetup';
console.log(getModelStatus());

// Manual setup
import { quickSetup } from './utils/modelSetup';
await quickSetup();
```
## 📚 Learning Tips

### Getting Started
1. **Set Your Level**: Configure your learning level in chat settings
2. **Choose Languages**: Set your native and target languages
3. **Start Simple**: Begin with conversation mode
4. **Practice Regularly**: Use all features for comprehensive learning

### Best Practices
- **Grammar Mode**: Paste text for detailed analysis
- **Vocabulary Mode**: Ask about specific words or phrases
- **Translation Mode**: Request explanations for complex translations
- **Conversation Mode**: Practice real-world scenarios

## 🔒 Privacy & Security

- **Fully Offline**: AI runs locally, no data sent to servers
- **No Telemetry**: Your conversations stay on your device
- **Open Source**: Transparent and auditable code
- **Secure**: No external API keys or cloud dependencies

## 📈 Performance

### System Requirements
- **RAM**: 4GB+ recommended (3GB minimum)
- **Storage**: 3GB free space
- **CPU**: ARM64 processor recommended
- **OS**: iOS 13+ or Android 8+

### Optimization Tips
- Close background apps when using AI chat
- Use conversation mode for best performance
- Reduce context size if experiencing slowdowns
- Release model when not actively using

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **Microsoft**: For the amazing Phi-3 Mini model
- **PocketPal AI**: For the React Native LLM integration
- **Expo Team**: For the excellent development platform

---

**Ready to start your language learning journey with AI? Launch the app and head to the AI Chat tab!** 🎉

