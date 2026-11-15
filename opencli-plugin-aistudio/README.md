<p align="center">
  <img src="../docs/assets/logo.png" alt="OpenCLI Logo" width="80" />
</p>

# opencli-plugin-aistudio

OpenCLI plugin for **Google AI Studio** (`aistudio.google.com`).

Control Google AI Studio directly from your terminal **purely without an API key**, driving your authenticated web session to generate videos (**Gemini Omni 1.2 Flash**), speech/voice (**Gemini 3.8 Flash TTS**), and images (**Nano Banana 2.1**) with **automatic saving directly to disk**.

---

## ⚡ Prerequisites

1. **Browser Bridge**: Edge or Google Chrome with the OpenCLI unpacked extension loaded (`.opencli/opencli-source-code/extension`).
2. **Authenticated Session**: Logged in to [Google AI Studio](https://aistudio.google.com) in your browser.
3. **OpenCLI Daemon**: Ensure daemon is active (`opencli daemon status`).

---

## 🎬 Commands & Usage

### 1. `video` - Generate Video with Gemini Omni 1.2 Flash
Generates native AI video clips with sound using **Gemini Omni 1.2 Flash** in AI Studio and automatically extracts and saves the `.mp4` file directly to disk.

```sh
# Generate video with default output (./output.mp4)
opencli aistudio video "A cinematic cute robotic cat playing in the neon garden"

# Specify custom output path
opencli aistudio video "Drone shot flying through futuristic cyberpunk canyon" --output "./renders/cyber_canyon.mp4"
```

* **Default Output**: `./output.mp4`
* **Under the Hood**: Uses `Gemini Omni 1.2 Flash`. Marks every `<video>` already on the page before submitting, so only the clip from *this* generation is captured, then streams the blob from page memory in verified chunks — the on-disk file must match the source byte-for-byte (written to `.part`, then renamed) or the command fails loudly.
* **Fail-Fast**: A rate-limit / quota banner in the UI aborts the command immediately with a non-zero exit code and a parseable `Rate limit` message (with the render's `--timeout`, default `900`s), instead of waiting the full timeout.

---

### 2. `voice` - Synthesize Voice with Gemini 3.8 Flash TTS
Directly drives Google AI Studio's Speech Studio (`/generate-speech?model=gemini-3.8-flash-tts`) to produce natural, emotive audio with vocal persona selection and custom emotional cues.

```sh
# Synthesize voice with default persona (Fola)
opencli aistudio voice "Good morning! Traffic is clear today and your coffee is ready."

# Choose persona (e.g., Bodi, Enya, Lumi, Sola, etc.)
opencli aistudio voice "Halo BOSS, ini suara Bodi dengan nada santai." --voice Bodi

# Use emotive vocal tags (<laugh>, <sigh>, <gasp>, <chuckles>, <whisper>)
opencli aistudio voice "Wait... <gasp> you actually built this without an API key? <laugh> Amazing!" --voice Enya

# Specify custom output file
opencli aistudio voice "Selamat datang di terminal OpenCLI." --voice Lumi --output "./audio/intro.wav"
```

* **Default Output**: `./speech.wav`
* **Voice Personas**: Search and select any of the 2,000+ voices available in AI Studio (`Fola`, `Enya`, `Bodi`, `Lumi`, `Sola`, etc.).
* **Vocal Tags**: Direct support for inline markup tags (`<laugh>`, `<sigh>`, `<gasp>`, `<chuckles>`, `<whisper>`).
* **Persona Guard**: The applied speaker is read back from the UI — if the requested persona was not selected, the command fails loudly instead of synthesizing with the wrong voice.
* **Downloads Note**: The rendered WAV lands in your browser's `Downloads` folder first; the command captures only *new* files, verifies size and RIFF/WAVE format, moves the result to `--output`, and then removes the captured source. Pre-existing downloads are never touched.

---

### 3. `image` - Generate Images with Nano Banana 2.1
Triggers image generation via **Nano Banana 2.1** (`gemini-nano-banana-2.1`) in AI Studio and auto-saves the image to disk.

```sh
# Generate image with default output (./output.png)
opencli aistudio image "A futuristic floating island with waterfalls and neon crystals"

# Custom output destination
opencli aistudio image "Retro anime style girl reading book on rainy train" --output "./wallpapers/anime_rain.png"
```

* **Default Output**: `./output.png`

---

### 4. `prompt` - Direct Web Playground Prompting
Injects any text prompt into the active Google AI Studio Playground chat and triggers execution.

```sh
opencli aistudio prompt "Write an optimized quicksort implementation in Rust"
```

---

### 5. `status` & `apikey` - Utility Commands
```sh
# Check AI Studio session & environment status
opencli aistudio status

# Inspect or validate API keys (if using raw API key mode)
opencli aistudio apikey
```

---

## 💾 Auto-Save Mechanism

All media generations (`video`, `voice`, `image`) fail loudly instead of reporting false success:

1. Polling for model execution completion via live DOM state.
2. Detecting rate-limit / quota / error banners **new since this run** and aborting immediately with a non-zero exit code.
3. Capturing only artifacts created by *this* run (`data-opencli-seen` markers for page elements, name snapshots for `Downloads`).
4. Verifying every artifact before it is reported: byte-for-byte parity for video, size + RIFF/WAVE magic for voice — written to a `.part` file first and renamed only after verification.
5. Cleaning up temporary downloads only after the verified copy exists.
