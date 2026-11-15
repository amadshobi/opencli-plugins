# 📋 Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-11-15

### 🚀 Initial Public Release

Initial release of the **OpenCLI Plugins Collection**, bringing zero-setup browser automation to your terminal.

#### 🎬 Google AI Studio Plugin (`opencli-plugin-aistudio`)
- **Video Generation**: Added `video` command driving **Gemini Omni 1.2 Flash** directly from browser session with automatic in-memory blob streaming to disk.
- **Emotive Speech Synthesis**: Added `voice` command utilizing **Gemini 3.8 Flash TTS** with support for 2,000+ personas and emotional vocal tags (`<laugh>`, `<gasp>`, `<sigh>`, `<whisper>`).
- **Image Generation**: Added `image` command supporting **Nano Banana 2.1** with direct auto-save.
- **Playground Prompting**: Added `prompt` command to inject queries into live AI Studio chats.
- **Utilities**: Added `status` and `apikey` commands to inspect session state.
- **Zero API Key Requirement**: Full execution relies purely on your active browser cookie/session without hitting paid API quota tiers.

#### 📩 Telegram Web Plugin (`opencli-plugin-telegram`)
- **Chat History**: Added `read` command with auto-scroll backfill and direct Markdown/JSON export.
- **Channel Feeds**: Added `feed` command to stream public channel posts for LLM digestion.
- **Direct Messaging**: Added `send` command to send messages without bot tokens.
- **Unlimited Cloud Backup**: Added `save` command to pipe local files into personal *Saved Messages*.
- **Bot Automation**: Added `bot-click` to trigger inline bot buttons directly from CLI.

#### 💬 WhatsApp Web Plugin (`opencli-plugin-whatsapp`)
- **Direct Phone Messaging**: Added `send` command to message arbitrary phone numbers (`08...` / `+62...`) without unofficial bot libraries (zero ban risk).
- **Conversation Management**: Added `chats` command with unread badge inspection.
- **Media Ingestion**: Added `save-media` command to download incoming attachments.

#### 🛠️ Repository & Tooling
- Added official neon OpenCLI logo and polished responsive badges.
- Embedded high-framerate 20-second demo animation preview (`demo.gif`).
- Added GitHub community templates: `bug_report.md`, `feature_request.md`, and `pull_request_template.md`.
