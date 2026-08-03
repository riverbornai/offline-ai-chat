# LinkedIn Video Script — Offline AI Chat App

Format: your face stays on screen the entire video, no cutaways. The editor overlays screen recordings/screenshots (PiP, inset box, or split-screen) at the points marked **[OVERLAY: ...]**, per the timestamps.

Total length target: 75–90 sec. Extended a bit so the "download once, then fully offline" point has room. It's the most important claim in the video and shouldn't feel rushed.

Editor note: shoot the face-camera part as a single, unbroken take (deliver the whole script in one go). During editing, insert the screen recordings/screenshots as a small box (corner inset or split-screen) at the timestamps below. Keep the face visible the whole time.

---

## Hook (0:00–0:06) — Face (full screen, no overlay)

> "I built an AI chat app that works without internet. No cloud, no data collection."

*(While saying this, pick up the phone and turn on airplane mode on camera — this is part of the face shot itself, no overlay needed here)*

---

## Problem (0:06–0:18) — Face (full screen, no overlay)

> "Most AI apps — ChatGPT, Gemini — are all cloud-based. That means every conversation you have goes to a company's server. I thought: what if an LLM could run entirely inside the phone, with nothing ever sent out?"

---

## Solution + Demo 1: Downloading the model (0:18–0:35) — Face continues, overlay in corner

> "So I built this app — fully on-device AI. You pick the model based on your phone: TinyLlama if you want something light and fast, Phi-4 or Gemma if you want stronger reasoning. All of them download straight to the phone and run locally, no server involved."

**[OVERLAY: Models tab — select a model (e.g. Phi-4 Mini), show download progress, then tap "Load Model" — small box/inset, face stays in the main frame]**

---

## The important clarification (0:35–0:50) — Face (full screen, no overlay — this point needs to land clearly)

> "You do need internet once, the first time, to download the model file. It has to come from somewhere. But once it's on your phone, that's it — no internet again. Everything after that runs 100% offline."

*(Slow down and speak clearly here. This nuance is what makes the offline claim honest, so give it room instead of rushing past it.)*

---

## Demo 2 — Chat, proven offline (0:50–1:05) — Face continues, overlay in corner

> "Watch — phone's still in airplane mode from earlier. I type a message, and the response streams back straight from the phone's own processor. No internet call, no cloud round-trip."

**[OVERLAY: Chat tab (airplane mode indicator visible in status bar if possible) — typing a message and sending it, streaming response appearing]**

---

## Demo 3 — Voice (1:05–1:18) — Face continues, overlay in corner

> "You can talk to it with voice too — speech-to-text and text-to-speech, both fully offline as well. For voice output, there's Piper if you just want English, or Kokoro if you need multiple languages."

**[OVERLAY: Talk tab — tap the mic → live transcription → AI voice reply]**

---

## Close / CTA (1:18–1:28) — Face (full screen, no overlay)

> "One-time download, then 100% offline and 100% private for good. Building this was fun, and I learned a ton along the way. Drop a comment and let me know what you think."

---

## Shot list for editor (checklist)

- [ ] Full face video — one continuous take, delivering the whole script (including the airplane mode toggle) — this is the base layer
- [ ] Screen recording: Models tab → select + download + load model (overlay 0:18–0:35)
- [ ] Screen recording: Chat tab, ideally with airplane mode icon visible in status bar → typed message + streaming response (overlay 0:50–1:05)
- [ ] Screen recording: Talk tab → mic tap → live transcription → voice reply (overlay 1:05–1:18)
- [ ] Editing: 0:00–0:18, 0:35–0:50, and 1:18–1:28 — face only, no overlay. These are the beats that carry the message, so don't compete with them.
- [ ] Editing: 0:18–0:35 and 0:50–1:18 — screen recording overlay (corner PiP or split-screen), face visible the entire time

## Caption draft (LinkedIn post text)

> You can talk to AI without internet. That's what I set out to test by building this app.
>
> Every cloud AI app sends your conversation to a server. I wanted something fully on-device, so here's what's actually running on the phone:
>
> Chat: TinyLlama (fastest, lowest memory), Phi-3 / Phi-4 Mini (better reasoning), or Gemma 4 (strongest, needs more RAM) — pick based on your device, all via llama.cpp.
> Voice in: Whisper.rn or Sherpa-ONNX for speech-to-text.
> Voice out: Piper (fast, English only) or Kokoro (multilingual) for text-to-speech.
>
> The first model download needs internet, once. After that, everything — chat, voice, all of it — runs 100% offline. No data leaves the device.
>
> Built with React Native + Expo. Full demo below.
>
> #AI #OfflineAI #Privacy #ReactNative #BuildInPublic #OnDeviceAI

---

## Notes for filming

- Good lighting on your face (window light or a ring light). Your face is visible the entire video, so keep lighting and framing consistent.
- Shoot the face video in one continuous take (a single recording of the full script); it's fine to pause mid-way, the editor will sync it up.
- Record the screen clips separately using the phone's native screen recorder (Settings > Screen Recording). The editor will place these as PiP/inset over the face video later.
- Overlay boxes look best kept small, in a bottom or side corner. The face should stay the main focus.
- Keep each screen recording overlay to around 10–15 seconds now that the video is a bit longer.
- Don't rush the 0:35–0:50 clarification beat. It's the line that makes the offline claim credible instead of misleading. Let it stand alone with just your face, no overlay competing for attention.
