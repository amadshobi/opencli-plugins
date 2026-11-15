<p align="center">
  <img src="./docs/assets/logo.png" alt="Logo OpenCLI" width="100" />
</p>

<h1 align="center">Koleksi Plugin OpenCLI</h1>

<p align="center">
  Kumpulan plugin OpenCLI untuk menjalankan otomatisasi web langsung dari terminal. Plugin ini memanfaatkan sesi peramban yang aktif. Anda dapat langsung menggunakannya tanpa memerlukan kunci API tambahan.
</p>

<p align="center">
  <a href="./README.md"><b>English (US)</b></a> •
  <a href="./README.ind.md"><b>Bahasa Indonesia</b></a>
</p>

<p align="center">
  <a href="#-daftar-plugin"><img src="https://img.shields.io/badge/plugin-3%20tersedia-0F766E?style=flat-square" alt="Plugins"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/lisensi-MIT-blue.svg?style=flat-square" alt="Lisensi"></a>
  <a href="https://github.com/jackwener/opencli"><img src="https://img.shields.io/badge/opencli-%3E%3D2.0.3-cyan?style=flat-square" alt="OpenCLI"></a>
</p>

<p align="center">
  <img src="./docs/assets/demo.gif" alt="Demo OpenCLI AI Studio" width="100%" />
</p>

---

## 📦 Daftar Plugin

| Plugin | Layanan Sasaran | Fitur Utama |
| :--- | :--- | :--- |
| **[`opencli-plugin-aistudio`](./opencli-plugin-aistudio)** | **Google AI Studio** | 🎬 Pembuatan video **Gemini Omni 1.2 Flash**<br>🎙️ Sintesis suara **Gemini 3.8 Flash TTS** (2.000+ persona suara)<br>🎨 Pembuatan gambar **Nano Banana 2.1**<br>💬 Eksekusi prompt Playground langsung<br>✨ Tanpa kunci API, memanfaatkan sesi peramban aktif |
| **[`opencli-plugin-telegram`](./opencli-plugin-telegram)** | **Telegram Web** | 📩 Baca dan kirim pesan, pantau umpan saluran, otomatisasi tombol bot, serta pencadangan berkas ke *Saved Messages*. |
| **[`opencli-plugin-whatsapp`](./opencli-plugin-whatsapp)** | **WhatsApp Web** | 💬 Kirim pesan langsung ke nomor tujuan tanpa pustaka bot tak resmi, pantau percakapan, dan unduh media. |

---

## ⚡ Prasyarat

1. Pasang paket **[OpenCLI](https://github.com/jackwener/opencli)** pada komputer Anda:
   ```bash
   npm install -g @jackwener/opencli
   ```
2. Pasang ekstensi **OpenCLI Browser Bridge** pada peramban Chromium pilihan Anda, seperti Chrome, Edge, atau Brave.
3. Pastikan daemon OpenCLI sudah berjalan sebelum Anda mulai:
   ```bash
   opencli daemon restart
   ```

---

## 🛠️ Panduan Pemasangan

Klon repositori ini terlebih dahulu ke komputer Anda:
```bash
git clone https://github.com/amadshobi/opencli-plugins.git
cd opencli-plugins
```

Pasang plugin yang Anda perlukan ke lingkungan OpenCLI:

```bash
# Pasang plugin Google AI Studio
opencli plugin install ./opencli-plugin-aistudio

# Pasang plugin Telegram
opencli plugin install ./opencli-plugin-telegram

# Pasang plugin WhatsApp
opencli plugin install ./opencli-plugin-whatsapp
```

Periksa kembali daftar plugin yang sudah terpasang:
```bash
opencli plugin list
```

---

## 🌟 Sorotan: `opencli aistudio` (Generasi Media Tanpa Kuota API)

Anda dapat membuat video, rekaman suara alami, maupun gambar langsung dari baris perintah. Seluruh proses ini berjalan tanpa memerlukan kuota API berbayar:

```bash
# 🎬 Buat klip video dengan Gemini Omni 1.2 Flash
opencli aistudio video "Cinematic drone view over neon cyberpunk city" --output "./renders/cyberpunk.mp4"

# 🎙️ Buat rekaman suara emotif dengan Gemini 3.8 Flash TTS
opencli aistudio voice "Wait... <gasp> did you really build this without an API key? <laugh> Amazing!" --voice Enya --output "./suara.wav"

# 🎨 Buat gambar dengan Nano Banana 2.1
opencli aistudio image "Retro anime girl reading book in train during rain" --output "./gambar.png"
```

---

## ❓ Pertanyaan Umum (FAQ)

### *Q: Apakah plugin ini menjalankan Playwright atau Puppeteer tanpa kepala (headless)?*
**A:** Sama sekali tidak. Plugin ini menggunakan OpenCLI Extension Bridge yang tersambung ke profil peramban harian Anda. Beban memori tetap ringan karena memanfaatkan jendela peramban yang sudah ada. Cara ini juga terhindar dari tantangan verifikasi anti-bot maupun CAPTCHA.

### *Q: Apakah saya harus memiliki paket langganan API berbayar di Google AI Studio?*
**A:** Tidak perlu. Anda cukup memastikan akun Google Anda sudah masuk ke [aistudio.google.com](https://aistudio.google.com) pada peramban. Plugin ini akan mengarahkan antarmuka web untuk memproses keluaran. Setelah selesai, berkas hasil unduhan akan tersimpan langsung ke komputer Anda.

---

## 📄 Lisensi dan Panduan Proyek

- **Lisensi**: Proyek ini dilisensikan di bawah [MIT](LICENSE) © [Ahmad Shobi](https://github.com/amadshobi).
- **Catatan Rilis**: Buka berkas [CHANGELOG.md](CHANGELOG.md) untuk melihat riwayat versi.
- **Pedoman Kontribusi**: Buka berkas [CONTRIBUTING.md](CONTRIBUTING.md) untuk panduan pengembangan dan pengujian lokal.
- **Kebijakan Keamanan**: Buka berkas [SECURITY.md](SECURITY.md) untuk tata cara pelaporan celah keamanan.
