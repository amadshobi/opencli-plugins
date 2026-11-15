# opencli-plugin-telegram

OpenCLI plugin for **Telegram Web** (`web.telegram.org`).

Control Telegram Web directly from your terminal **purely without a bot token or phone login prompt**, driving your authenticated browser session to monitor channel feeds, automate Telegram bots with inline button clicks, and use Saved Messages as unlimited personal cloud storage.

---

## ⚡ Prerequisites

1. **Browser Bridge**: Edge or Google Chrome with the OpenCLI unpacked extension active.
2. **Authenticated Session**: Logged into [Telegram Web](https://web.telegram.org/a/) in your browser.
3. **OpenCLI Daemon**: Ensure daemon is active (`opencli doctor`).

---

## 🚀 Commands & Usage

### 🌐 Pillar 1: Channel & Group Intelligence

#### 1. `read` - Auto-Scroll Chat Reader & Exporter
Read message history from the currently active open chat, or specify any contact/group/channel. Automatically auto-scrolls up to backfill long chat histories and supports direct dumping to `.md` or `.json` files.

```sh
# Read last 20 messages from currently open chat in Telegram
opencli telegram read

# Read 50 messages from a specific contact or group with auto-scroll backfill
opencli telegram read "Tech & AI News" --limit 50

# Dump long chat history directly into a clean Markdown transcript file
opencli telegram read "Repo Maniac" --limit 100 --output "./repo_chat.md"

# Dump chat history into JSON
opencli telegram read "Tech & AI News" --limit 50 --output "./feed.json"
```

#### 2. `feed` - Stream & Dump Channel/Group Posts
Read and dump the latest posts from any channel, group, or chat into clean terminal output, Markdown, or JSON.

```sh
# Read recent posts as formatted table
opencli telegram feed "Tech & AI News" --limit 5

# Export channel feed as Markdown (great for LLM agents)
opencli telegram feed "Repo Maniac" --limit 10 --format md

# Export raw feed as JSON
opencli telegram feed "Tech & AI News" --format json
```

#### 2. `chats` - List Active Chats & Channels
List recent chats, channels, unread badges, and last messages from the sidebar.

```sh
opencli telegram chats --limit 15
```

#### 3. `search` - Global Telegram Search
Search globally for channels, groups, bots, or past messages.

```sh
opencli telegram search "deepseek"
opencli telegram search "agent" --limit 5
```

---

### 🤖 Pillar 2: Bot & Automation Runner

#### 1. `bot` - Send Commands to Telegram Bots
Drive any Telegram Bot directly from the CLI and automatically capture its response and any interactive Inline Keyboard buttons.

```sh
opencli telegram bot "fizatalkbot" "/start"
opencli telegram bot "BotFather" "/help"
```

#### 2. `bot-click` - Click Inline Keyboard Buttons
Click interactive inline buttons rendered in bot responses by matching button text.

```sh
opencli telegram bot-click "fizatalkbot" "Lanjut"
opencli telegram bot-click "fizatalkbot" "Confirm"
```

---

### ☁️ Pillar 3: Personal Cloud Depot (Saved Messages)

#### 1. `save` - Backup Code, Notes, or Files to Telegram Cloud
Quickly dump snippets, terminal logs, or local files directly into your Telegram Saved Messages (unlimited cloud depot).

```sh
# Save a quick note
opencli telegram save "Ingat: backup database jam 10 malam"

# Save code snippet with caption
opencli telegram save "const x = 42;" --caption "Snippet penting"

# Upload/save an entire local code file
opencli telegram save "./package.json" --caption "Backup package.json"
```

#### 2. `saved-list` - Inspect Recent Saved Messages
List recent notes and items from your Saved Messages cloud storage.

```sh
opencli telegram saved-list --limit 5
```

---

### 🛠️ Core / Utility Commands

#### `status` - Check Telegram Web Connection
Validate that your browser tab has an active Telegram Web session loaded.

```sh
opencli telegram status
```

---

## 📦 Installation & Updating

To link or reinstall this plugin into your local OpenCLI environment:

```sh
opencli plugin install "C:\Users\AHMAD SHOBI ULINNAFI\opencli-plugin-telegram"
```
