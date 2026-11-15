# 📋 Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-11-16

### 🛡️ Automation-Grade Failure Semantics (`opencli-plugin-aistudio`)

Post-mortem release: a forensic review of a failed overnight pipeline run exposed that every failure path reported exit code 0 and that rate limits were only discovered at timeout. All media commands now fail loudly and verify every artifact.

#### 🎬 `video` — Verified Extraction
- **Fail-Fast Rate Limits**: A rate-limit / quota banner in the AI Studio UI now aborts the command in seconds with a non-zero exit code and a parseable `Rate limit` message, instead of spinning until the `900s` timeout.
- **Typed Errors**: Every failure path (model setup, prompt submission, timeout) throws `CommandExecutionError` — the CLI exit code is now trustworthy for automation. No more `Status: 'Failed: ...'` rows with exit 0.
- **Fresh-Video Marker**: Every existing `<video>` on the page is marked before submission, so a persistent multi-turn chat can never re-capture a previous generation's clip.
- **Byte-Exact Verification**: The extracted file must match the in-page source length exactly; writes go through a `.part` file (a pre-existing good output is never destroyed on failure) and are renamed only after verification.
- **Timeout Arg**: `--timeout` is now a declared argument (default `900`s).

#### 🎙️ `voice` — Verified Audio
- **Fail-Fast Rate Limits**: Same typed, immediate error semantics for TTS runs.
- **Persona Guard**: The applied speaker is read back from the UI; if the requested voice was not applied, the command refuses to synthesize instead of silently producing the wrong persona.
- **`.crdownload` Guard**: Only finished `.wav` files are eligible for capture — half-written Chrome temp files can no longer pass the size-stability check.
- **Format Gate**: Captured audio must carry real `RIFF`/`WAVE` magic bytes; an MP3 in disguise fails loudly instead of being reported as verified.
- **Downloads Snapshot**: Only files created by *this* run are captured; pre-existing downloads are never captured, modified, or deleted. The captured source is removed only after the verified copy exists.

### 🎬 New Plugin: `opencli-plugin-gemini`

Video generation for the Gemini App (`gemini.google.com`) — `opencli gemini video "..."` — previously a loose, unversioned local command; now a first-class plugin with the same automation-grade failure semantics:

- **Fail-Fast Limits**: Gemini App limit / refusal banners abort immediately with a parseable message (the bucket is 4 clips × 10s per account — rotate `--profile` when it fires).
- **Fresh-Button Marker**: Download buttons are marked before submission; only a button appended by *this* generation is clicked.
- **Download Race Protection**: The `Downloads` folder is snapshotted before the run; only a *new* `gemini_generated_video_*.mp4` with a size-stable reading (two equal consecutive samples) is accepted.
- **Verify-Then-Delete**: The source download is removed only after the copy is byte-for-byte verified; pre-existing downloads are never touched.
- **Honest Timeouts**: `--timeout` default `900`s (real renders take 2–10 minutes) and `--downloadWait` default `120`s.

#### 🧪 Testing
- Added vitest suites to both plugins (24 tests): fail-fast behavior, snapshot filtering, size-stability, partial-write cleanup, format gates, and regression tests for the exact bugs above. Run with `npm test` in each plugin folder.

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
