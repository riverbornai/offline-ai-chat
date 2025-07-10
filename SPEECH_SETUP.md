# Speech-to-Text Integration Setup

Your React Native app now includes speech-to-text functionality using your existing backend!

## Features Added

- 🎤 **Audio Recording**: Tap to record voice notes
- 🔄 **Real-time Transcription**: Audio is sent to your backend for processing
- ✅ **Auto-add Todos**: Transcribed text automatically becomes a todo item
- 📱 **Cross-platform**: Works on iOS, Android, and web

## Setup Instructions

### 1. Backend Server
Make sure your speech-to-text backend is running:
```bash
cd speech-to-text-backend
npm start
```
Your backend should be accessible at `http://localhost:3001`

### 2. Configuration
Update the API URL in `/config/speechConfig.ts`:

**For development on device/emulator:**
```typescript
API_BASE_URL: 'http://YOUR_LOCAL_IP:3001/api'
```
Replace `YOUR_LOCAL_IP` with your computer's local IP address (e.g., `192.168.1.100`)

**For production:**
```typescript
API_BASE_URL: 'https://your-backend-domain.com/api'
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Permissions
The app now requests microphone permissions automatically. Make sure to:
- Allow microphone access when prompted
- Check device settings if recording doesn't work

## How to Use

1. **Open the app** - you'll see the "Voice Transcription" section at the top
2. **Tap "🎤 Start Recording"** - begin speaking
3. **Tap "🛑 Stop Recording"** - stop and process the audio
4. **Wait for transcription** - the audio is sent to your backend
5. **See results** - transcribed text appears in your todo list

## Troubleshooting

### Common Issues:

**"Failed to transcribe audio"**
- Check if your backend server is running
- Verify the API URL in `speechConfig.ts`
- Check network connectivity

**"Failed to start recording"**
- Grant microphone permissions
- Check device audio settings
- Restart the app

**Network errors on device/emulator**
- Use your local IP address instead of `localhost`
- Ensure your computer and device are on the same network
- Check firewall settings

### Finding Your Local IP Address:

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter

**Mac/Linux:**
```bash
ifconfig
```
Look for your network interface (usually `en0` or `wlan0`)

## Backend API Endpoints

Your app uses these endpoints:
- `POST /api/speech/v1/transcribe` - Upload and transcribe audio
- `GET /api/speech/v1/status` - Check service status

## Audio Formats Supported

The backend supports:
- WAV, MP3, M4A, OGG, WebM
- Automatic conversion to required format
- 50MB file size limit 