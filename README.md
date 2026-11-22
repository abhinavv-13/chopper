# Chopper

Chopper is an on-device stream clipping platform that transforms long livestreams into viral 9:16 vertical shorts for TikTok, YouTube Shorts, and Instagram Reels. Everything runs locally on your machine with automated facecam framing, acoustic peak detection, and Whisper AI subtitles.

## Requirements

- Python 3.10 or higher
- FFmpeg installed and available on PATH
- Modern web browser (Chrome, Edge, Firefox, Safari)

## Quick Start

1. Install Python dependencies:

```bash
pip install -r requirements.txt
```

2. Start the local server:

```bash
python server.py
```

3. Open your browser and navigate to:

```text
http://127.0.0.1:8000
```

## Features

* 100% On-Device Processing: Raw footage and audio never touch external cloud servers.
* Automated Facecam Framing: Isolates streamer camera and places it above 1080p gameplay.
* Acoustic and Heatmap Analysis: Pinpoints laughter bursts, shouting, and high-energy chat moments.
* Whisper Speech-to-Text: Word-accurate animated karaoke captions.
* Zero Cloud Subscription Fees: Unlimited exports on your own CPU and GPU.

## Project Structure

```text
chopper/
├── sc/                     # Python video engine and AI pipeline
│   ├── common.py           # FFmpeg utilities, loudness normalization, filters
│   ├── frame.py            # Neural facecam detection and 9:16 layout composition
│   ├── highlights.py       # Audio volume spike and energy detection
│   ├── listen.py           # Whisper speech-to-text and subtitle timing
│   ├── pipeline.py         # End-to-end multi-stage clipping workflow
│   └── produce.py          # 1080p vertical video rendering
├── static/                 # Production web frontend
│   ├── assets/             # Branding logos, mascot videos, favicons, showcase clips
│   ├── index.html          # Single-page application landing page
│   ├── 404.html            # 404 error page
│   ├── privacy.html        # Privacy policy
│   ├── terms.html          # Terms of service
│   ├── chopper-loader.js   # Interactive Chopper HUD web component
│   └── sonner.css          # Toast notification styles
├── uploads/                # Local stream storage
├── exports/                # Generated 1080p vertical clips
├── server.py               # FastAPI backend and REST API endpoints
├── apply_kawaii_theme.py   # Frontend template and theme compiler
├── requirements.txt        # Python dependency specifications
└── package.json            # Vendor asset declarations (GSAP, Lucide, Sonner)
```
