# opencli-plugin-whatsapp

OpenCLI plugin for **WhatsApp Web** (`web.whatsapp.com`).

Control WhatsApp Web directly from your terminal **purely without unofficial bot libraries (no Baileys/Puppeteer bans)**, driving your authenticated browser session to send direct phone messages, read conversation transcripts, and act as a **bridge** to download media and pipe directly into **Telegram Unlimited Cloud** (`opencli telegram save`).

---

## ⚡ Prerequisites

1. **Browser Bridge**: Edge or Google Chrome with the OpenCLI unpacked extension active.
2. **Authenticated Session**: Logged into [WhatsApp Web](https://web.whatsapp.com/) in your browser.
3. **OpenCLI Daemon**: Ensure daemon is active (`opencli doctor`).

---

## 🚀 Commands & Usage

### 1. `status` - Check WhatsApp Web Session
Validate that WhatsApp Web is authenticated and check currently open chat.

```sh
opencli whatsapp status
```

---

### 2. `chats` - List Conversations & Unread Badges
List recent conversations, contact names, and unread counters.

```sh
opencli whatsapp chats --limit 15
```

---

### 3. `send` - Direct Phone & Contact Messaging
Send a text message directly to any phone number (even if not in your contacts), contact name, group, or yourself (`me`).

```sh
# Send directly to phone number (auto formats 08... to 628...)
opencli whatsapp send "08123456789" "Halo! Ini pesan dikirim via OpenCLI terminal."

# Send to international phone number
opencli whatsapp send "+62812345678" "Pengingat meeting jam 2 siang."

# Send to contact or group
opencli whatsapp send "mom❤️" "Halo Mah, lagi apa?"

# Send to yourself (Message Yourself)
opencli whatsapp send "me" "Catatan penting untuk hari ini"
```

---

### 4. `read` - Read Transcripts & Export to File
Read recent messages from the currently active chat or any targeted contact/group. Supports auto-exporting to Markdown or JSON.

```sh
# Read messages from currently open chat in WhatsApp Web
opencli whatsapp read --limit 20

# Read messages from specific contact
opencli whatsapp read "mom❤️" --limit 10

# Export conversation to Markdown file
opencli whatsapp read "mom❤️" --limit 30 --output "./wa_chat.md"
```

---

### 5. `save-media` - Extract Media Directly to Disk
Extract and save the latest photo or media attachment from a WhatsApp chat directly into a local file without dealing with browser download locks.

```sh
# Save latest media from currently active chat
opencli whatsapp save-media --output "./downloaded.jpg"

# Save latest media from specific contact
opencli whatsapp save-media "mom❤️" --output "./foto_keluarga.jpg"
```

---

## 🌉 The WhatsApp ➔ Telegram Cloud Bridge Pipeline

Combine `opencli whatsapp` with `opencli telegram` to create an automatic cloud backup bridge:

```sh
# 1. Download attachment/photo from WhatsApp
opencli whatsapp save-media "mom❤️" --output "./foto.jpg"

# 2. Pipe directly to Telegram Unlimited Cloud Storage!
opencli telegram save "./foto.jpg" --caption "Backup Foto dari WA"
```

---

## 📦 Installation & Updating

To link or reinstall this plugin into your local OpenCLI environment:

```sh
opencli plugin install ./opencli-plugin-whatsapp
```
