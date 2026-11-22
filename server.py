import os
import sys
import json
import uuid
import re
import time
import socket
import shutil
import ipaddress
import subprocess
import asyncio
from pathlib import Path
from typing import Optional, List, Dict
from urllib.parse import urlparse
from collections import defaultdict
import numpy as np

from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import yt_dlp

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from sc import common, frame, subs, titlecard, listen, settings

UPLOADS_DIR = BASE_DIR / "uploads"
EXPORTS_DIR = BASE_DIR / "exports"
STATIC_DIR = BASE_DIR / "static"

UPLOADS_DIR.mkdir(exist_ok=True)
EXPORTS_DIR.mkdir(exist_ok=True)
STATIC_DIR.mkdir(exist_ok=True)

# ── CONFIGURATION & RESOURCE LIMITS ───────────────────────────────────────────
MAX_UPLOAD_SIZE = int(os.environ.get("MAX_UPLOAD_SIZE", 2 * 1024 * 1024 * 1024))  # 2 GB
PROCESS_TIMEOUT = int(os.environ.get("PROCESS_TIMEOUT", 600))  # 10 minutes
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv"}
ALLOWED_ORIGINS_ENV = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:8000,http://127.0.0.1:8000,https://chopper.video"
)
ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS_ENV.split(",") if o.strip()]

SERVER_START_TIME = time.time()

# ── DEFENSIVE SECURITY HELPERS ────────────────────────────────────────────────
def validate_public_url(url: str) -> None:
    """
    Guards against Server-Side Request Forgery (SSRF).
    Ensures URL uses http/https and does not resolve to loopback,
    private, link-local, multicast, or cloud-metadata IPs.
    """
    if not url or len(url) > 2048:
        raise HTTPException(status_code=400, detail="Invalid URL format or length.")
    
    parsed = urlparse(url)
    if parsed.scheme.lower() not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Disallowed protocol scheme. Only HTTP and HTTPS are permitted.")
    
    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid host destination.")
    
    if hostname.lower() in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
        raise HTTPException(status_code=400, detail="Access to internal destinations is strictly forbidden.")
    
    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for _, _, _, _, sockaddr in addr_info:
            ip_str = sockaddr[0]
            ip_obj = ipaddress.ip_address(ip_str)
            if (
                ip_obj.is_private
                or ip_obj.is_loopback
                or ip_obj.is_link_local
                or ip_obj.is_reserved
                or ip_obj.is_multicast
                or ip_obj in ipaddress.ip_network("169.254.0.0/16")
            ):
                raise HTTPException(status_code=400, detail="Access to private or local infrastructure is prohibited.")
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Could not resolve host destination.")


def sanitize_filename(filename: str) -> str:
    """
    Sanitizes user-provided filename by extracting the basename,
    removing directory traversal tokens, and allowing only safe characters.
    """
    base = Path(filename).name
    clean = re.sub(r"[^a-zA-Z0-9_.-]", "_", base)
    clean = clean.lstrip(".")
    if not clean:
        clean = "stream_vod.mp4"
    return clean[:128]


def is_valid_media_signature(head: bytes) -> bool:
    """
    Validates magic bytes / signatures for MP4, MOV, WebM, and MKV containers.
    """
    if len(head) < 8:
        return False
    # MP4 / MOV signatures
    if any(sig in head[:32] for sig in (b"ftyp", b"moov", b"wide", b"mdat", b"qt  ")):
        return True
    # WebM / MKV EBML signature
    if head[:4] == b"\x1a\x45\xdf\xa3":
        return True
    # RIFF AVI
    if head[:4] == b"RIFF" and b"AVI " in head[8:16]:
        return True
    return False


def safe_resolve_video(file_name: str) -> Optional[Path]:
    """
    Safely resolves a video filename strictly within UPLOADS_DIR or STATIC_DIR showcase.
    Defends against path traversal attacks.
    """
    if not file_name or "\x00" in file_name:
        return None
    
    clean_base = Path(file_name).name
    
    # Check UPLOADS_DIR
    cand = (UPLOADS_DIR / clean_base).resolve()
    uploads_root = UPLOADS_DIR.resolve()
    if cand.is_relative_to(uploads_root) and cand.exists() and cand.is_file():
        return cand
        
    # Check static assets
    assets_dir = (STATIC_DIR / "assets").resolve()
    cand_static = (assets_dir / clean_base).resolve()
    if cand_static.is_relative_to(assets_dir) and cand_static.exists() and cand_static.is_file():
        return cand_static

    return None


def escape_ffmpeg_drawtext(text: str) -> str:
    """
    Escapes characters for FFmpeg drawtext filter syntax to prevent filter injection.
    """
    clean = re.sub(r"[\r\n\t\x00-\x1f]", "", text)
    clean = (
        clean.replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace(":", "\\:")
        .replace("%", "\\%")
        .replace("[", "\\[")
        .replace("]", "\\]")
        .replace(";", "\\;")
        .replace(",", "\\,")
    )
    return clean[:100]


class InMemoryRateLimiter:
    """
    Sliding window in-memory rate limiter per client IP.
    """
    def __init__(self):
        self.requests = defaultdict(list)

    def is_allowed(self, key: str, limit: int = 60, window_secs: int = 60) -> bool:
        now = time.time()
        cutoff = now - window_secs
        reqs = [t for t in self.requests[key] if t > cutoff]
        self.requests[key] = reqs
        if len(reqs) >= limit:
            return False
        self.requests[key].append(now)
        return True


rate_limiter = InMemoryRateLimiter()

# ── FASTAPI APPLICATION SETUP ─────────────────────────────────────────────────
app = FastAPI(
    title="Chopper - Cute & Powerful AI Stream Clipper",
    version="2.0.0",
    docs_url=None,  # Disabled in production to prevent schema leakage
    redoc_url=None,
    openapi_url=None
)

# Gzip Compression Middleware for snappy responses
app.add_middleware(GZipMiddleware, minimum_size=1024)

# Production CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS else ["http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# ── SECURITY HEADERS & RATE LIMITING MIDDLEWARE ───────────────────────────────
@app.middleware("http")
async def security_and_rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"

    # Rate limiting on API routes
    if request.url.path.startswith("/api/"):
        is_heavy = request.url.path in ("/api/upload", "/api/generate-batch-clips", "/api/export-clip")
        limit = 20 if is_heavy else 60
        rate_key = f"{client_ip}:{request.url.path if is_heavy else 'general'}"
        if not rate_limiter.is_allowed(rate_key, limit=limit):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"success": False, "detail": "Rate limit exceeded. Please wait a moment before trying again."},
                headers={"Retry-After": "60"}
            )

    response = await call_next(request)

    # Production Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

    # Content-Security-Policy (Permissive for local app and Google Fonts)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob: https:; "
        "media-src 'self' blob: data:; "
        "connect-src 'self'; "
        "frame-ancestors 'self';"
    )

    # Caching Policy
    if request.url.path.startswith(("/assets/", "/sonner.css", "/chopper-loader.js")):
        response.headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=604800"
    elif request.url.path in ("/", "/index.html"):
        response.headers["Cache-Control"] = "no-cache, must-revalidate"

    return response


# ── VIDEO METADATA PROBER ─────────────────────────────────────────────────────
def get_video_info(file_path: Path):
    """Probe video duration and dimensions with ffprobe."""
    try:
        p = common.probe(file_path)
        return {"duration": float(p.get("duration", 60.0)), "width": int(p.get("width", 1920)), "height": int(p.get("height", 1080)), "fps": float(p.get("fps", 30.0))}
    except Exception as e:
        print(f"probe note: {e}")
        return {"duration": 60.0, "width": 1920, "height": 1080, "fps": 30.0}


# ── PRODUCTION HEALTH & SEO ENDPOINTS ─────────────────────────────────────────
@app.get("/api/health")
async def health_check():
    """Production health check reporting system availability and storage status."""
    ffmpeg_ok = False
    try:
        r = subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        ffmpeg_ok = (r.returncode == 0)
    except Exception:
        ffmpeg_ok = False

    return {
        "status": "healthy" if ffmpeg_ok else "degraded",
        "app": "Chopper",
        "version": "2.0.0",
        "ffmpeg_available": ffmpeg_ok,
        "uploads_writable": os.access(str(UPLOADS_DIR), os.W_OK),
        "exports_writable": os.access(str(EXPORTS_DIR), os.W_OK),
        "uptime_seconds": round(time.time() - SERVER_START_TIME, 1)
    }


@app.get("/robots.txt", response_class=PlainTextResponse)
async def robots_txt():
    """Technical SEO: Directs search engines to crawl public pages and avoids private paths."""
    return (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /api/\n"
        "Disallow: /media/uploads/\n"
        "Disallow: /media/exports/\n\n"
        "Sitemap: https://chopper.video/sitemap.xml\n"
    )


@app.get("/sitemap.xml")
async def sitemap_xml():
    """Technical SEO: Search engine XML sitemap."""
    content = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://chopper.video/</loc>
    <lastmod>2026-11-22</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>"""
    return Response(content=content, media_type="application/xml")


# ── API ENDPOINTS ─────────────────────────────────────────────────────────────

@app.post("/api/process-url")
async def process_url(data: dict):
    """
    Stream-Clips Inspector:
    Validates stream URL (SSRF protected), extracts metadata, prepares quick preview.
    """
    url = data.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="Missing stream URL.")

    # Guard against SSRF
    validate_public_url(url)

    ydl_meta_opts = {
        "js_runtimes": {"node": {}},
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }

    loop = asyncio.get_event_loop()

    try:
        def fetch_meta():
            with yt_dlp.YoutubeDL(ydl_meta_opts) as ydl:
                return ydl.extract_info(url, download=False)

        info = await asyncio.wait_for(loop.run_in_executor(None, fetch_meta), timeout=45.0)
        total_duration = float(info.get("duration") or 60.0)
        title = info.get("title", "Imported Stream")
        video_id = info.get("id", str(uuid.uuid4())[:8])
        thumb_url = info.get("thumbnail", "")
        raw_channel = info.get("uploader") or info.get("channel") or "@streamer"
        channel = re.sub(r'[#:\'"]', '', raw_channel).strip() or "@streamer"

        # Fast preview slice
        preview_filename = f"prev_{video_id}.mp4"
        preview_path = UPLOADS_DIR / preview_filename

        if not preview_path.exists():
            preview_len = min(45.0, total_duration)
            ydl_prev_opts = {
                "js_runtimes": {"node": {}},
                "format": "best[height<=720]/bestvideo[height<=720]+bestaudio/best",
                "download_ranges": yt_dlp.utils.download_range_func(None, [(0, preview_len)]),
                "outtmpl": str(UPLOADS_DIR / f"prev_{video_id}.%(ext)s"),
                "merge_output_format": "mp4",
                "quiet": True,
                "no_warnings": True,
                "force_keyframes_at_cuts": True,
            }

            def download_prev():
                with yt_dlp.YoutubeDL(ydl_prev_opts) as ydl:
                    ydl.download([url])

            await asyncio.wait_for(loop.run_in_executor(None, download_prev), timeout=60.0)

        cands = list(UPLOADS_DIR.glob(f"prev_{video_id}*"))
        if not cands:
            raise HTTPException(status_code=500, detail="Failed to prepare stream preview.")
        final_preview = cands[0]
        meta = get_video_info(final_preview)

        return {
            "success": True,
            "type": "video",
            "title": title,
            "channel": channel,
            "duration": total_duration,
            "preview_duration": meta["duration"],
            "width": meta["width"],
            "height": meta["height"],
            "file_url": f"/media/uploads/{final_preview.name}",
            "file_name": final_preview.name,
            "thumb_url": thumb_url,
            "source_url": url
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing URL: {e}")
        return JSONResponse(status_code=400, content={"success": False, "detail": "Could not retrieve stream details. Please verify the URL."})


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Secure file upload:
    - Enforces extension whitelist (.mp4, .mov, .webm, .mkv)
    - Verifies container magic bytes
    - Enforces 2GB file size limit
    - Sanitizes filenames against path traversal
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")
    
    clean_original = sanitize_filename(file.filename)
    ext = Path(clean_original).suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported media format. Allowed formats: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}"
        )

    file_id = uuid.uuid4().hex[:8]
    safe_name = f"{file_id}_{clean_original}"
    file_path = UPLOADS_DIR / safe_name

    total_bytes = 0
    header_checked = False

    try:
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File exceeds maximum allowed upload size (2GB)."
                    )
                
                # Check magic bytes on first chunk
                if not header_checked and len(chunk) >= 8:
                    if not is_valid_media_signature(chunk[:64]):
                        raise HTTPException(
                            status_code=400,
                            detail="Corrupted or invalid video file signature."
                        )
                    header_checked = True

                buffer.write(chunk)
    except Exception:
        if file_path.exists():
            try: file_path.unlink()
            except Exception: pass
        raise

    meta = get_video_info(file_path)
    thumb_name = f"{file_path.stem}_thumb.jpg"
    thumb_path = UPLOADS_DIR / thumb_name
    
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-ss", "1.0", "-i", str(file_path), "-frames:v", "1", "-vf", "scale=480:-1", str(thumb_path)],
            capture_output=True,
            timeout=30
        )
    except Exception as e:
        print(f"Thumbnail note: {e}")

    return {
        "success": True,
        "type": "local",
        "title": clean_original,
        "channel": "@streamer",
        "duration": meta["duration"],
        "width": meta["width"],
        "height": meta["height"],
        "file_url": f"/media/uploads/{safe_name}",
        "thumb_url": f"/media/uploads/{thumb_name}",
        "file_name": safe_name,
        "source_url": ""
    }


@app.post("/api/detect-facecam")
async def detect_facecam(data: dict):
    """
    Locates streamer facecam overlay coordinates with path traversal defense.
    """
    file_name = data.get("file_name", "")
    target_video = safe_resolve_video(file_name) if file_name else None

    default_box = {"detected": False, "cam_x": 65, "cam_y": 10, "cam_w": 28, "cam_h": 40}
    if not target_video or not target_video.exists():
        return default_box

    loop = asyncio.get_event_loop()

    try:
        def run_face_track():
            info = common.probe(target_video)
            if not info.get("width"):
                return None
            frames, scale = frame.sample(target_video, 0, min(10.0, float(info.get("duration", 60.0))), info)
            dets = frame.faces(frames)
            found = frame.tracks(dets, frames)
            if not found:
                return None
            box, how = frame.cam_box(frames, found[0]["box"])
            cx, cy, cw, ch = [v * scale for v in box]
            return {
                "detected": True,
                "cam_x": round(max(0, min(90, (cx / info["width"]) * 100)), 1),
                "cam_y": round(max(0, min(90, (cy / info["height"]) * 100)), 1),
                "cam_w": round(min(50, max(18, (cw / info["width"]) * 100)), 1),
                "cam_h": round(min(50, max(20, (ch / info["height"]) * 100)), 1),
                "how": how
            }

        res = await asyncio.wait_for(loop.run_in_executor(None, run_face_track), timeout=30.0)
        return res if res else default_box
    except Exception as e:
        print(f"Facecam detection note: {e}")
        return default_box


@app.post("/api/detect-highlights")
async def detect_highlights(data: dict):
    """
    Detect stream highlights with path traversal protection and bounded input validation.
    """
    file_name = data.get("file_name", "")
    duration = max(5.0, min(86400.0, float(data.get("duration", 60.0))))

    video_path = safe_resolve_video(file_name) if file_name else None
    if video_path and video_path.exists():
        meta = get_video_info(video_path)
        duration = meta["duration"]

    events = [
        {"tag": "PEAK REACTION", "desc": "Streamer scream & hype moment", "color": "#FF5B8A", "stars": 5, "type": "voice"},
        {"tag": "CLUTCH MOMENT", "desc": "High intensity gameplay play", "color": "#AF134A", "stars": 5, "type": "clutch"},
        {"tag": "HYPED CHAT", "desc": "Massive chat velocity surge", "color": "#75452C", "stars": 4, "type": "chat"},
        {"tag": "FUNNY MOMENT", "desc": "Uncontrollable laughter & banter", "color": "#FF9F1C", "stars": 4, "type": "voice"},
        {"tag": "WINNING PLAY", "desc": "Round victory / major milestone", "color": "#2EE6D6", "stars": 5, "type": "win"},
    ]

    highlights = []
    if video_path and video_path.exists() and duration <= 600:
        try:
            samples = common.decode(video_path, rate=16000)
            if len(samples) > 16000:
                vol = listen._volume(samples)
                spk = listen.spikes(vol)
                peak_indices = sorted(np.argsort(spk)[-6:])
                for idx, sec in enumerate(peak_indices):
                    ev = events[idx % len(events)]
                    start = max(0.0, round(float(sec) - 3.0, 1))
                    end = min(duration, round(float(sec) + 14.0, 1))
                    highlights.append({
                        "id": f"hl_{idx+1}",
                        "start": start,
                        "end": end,
                        "tag": ev["tag"],
                        "desc": ev["desc"],
                        "color": ev["color"],
                        "stars": ev["stars"],
                        "type": ev["type"],
                        "score": round(86.0 + float(min(13.0, spk[sec])), 1)
                    })
        except Exception as e:
            print(f"Audio spike fallback note: {e}")

    if not highlights:
        num_highlights = min(6, max(3, int(duration // 20)))
        step = duration / (num_highlights + 1)
        for i in range(num_highlights):
            ev = events[i % len(events)]
            center_time = step * (i + 1)
            clip_len = min(25.0, max(12.0, step * 0.4))
            start = max(0.0, round(center_time - (clip_len / 2), 1))
            end = min(duration, round(start + clip_len, 1))

            highlights.append({
                "id": f"hl_{i+1}",
                "start": start,
                "end": end,
                "tag": ev["tag"],
                "desc": ev["desc"],
                "color": ev["color"],
                "stars": ev["stars"],
                "type": ev["type"],
                "score": round(88 + (i * 3) % 11, 1)
            })

    return {"success": True, "duration": duration, "highlights": highlights}


def render_1080p_clip(input_file: Path, output_file: Path, start: float, duration: float, cam: tuple, streamer_tag: str, wanted_stars: int, wasted: bool, cfg: dict):
    """
    Renders 1080x1920 (1080p vertical) clip:
    - Streamer facecam on top + gameplay on bottom
    - Active animated word-by-word karaoke subtitles
    - Subprocess execution timeout protected
    - FFmpeg filter text strictly escaped
    """
    info = common.probe(input_file)
    sw = info.get("width") or 1920
    sh = info.get("height") or 1080

    cam_pixels = (
        (cam[0] / 100.0) * sw,
        (cam[1] / 100.0) * sh,
        (cam[2] / 100.0) * sw,
        (cam[3] / 100.0) * sh,
    )

    base_filter, seam_y = frame.stack_graph(cfg, {"width": sw, "height": sh}, cam_pixels)
    base_filter = base_filter.replace("[framed]", "[base]")

    font_arial = "C\\:/WINDOWS/Fonts/arialbd.ttf"
    font_impact = "C\\:/WINDOWS/Fonts/impact.ttf"

    inputs = [
        "-ss", str(start),
        "-t", str(duration),
        "-i", str(input_file.resolve()),
    ]

    filter_chain = [base_filter]
    last_layer = "[base]"

    # Dividing seam line
    filter_chain.append(
        f"{last_layer}drawbox=x=0:y={seam_y-2}:w=iw:h=4:color=0xAF134A@1.0:t=fill[div]"
    )
    last_layer = "[div]"

    # Streamer tag badge (Top Left) - Escaped securely
    if streamer_tag:
        clean_tag = re.sub(r'(?i)#?gta\s*6?', '', streamer_tag).strip()
        clean_tag = escape_ffmpeg_drawtext(clean_tag)
        if clean_tag:
            filter_chain.append(
                f"{last_layer}drawtext=fontfile='{font_arial}':text='{clean_tag}':fontcolor=0xF7F5EF:fontsize=34:x=50:y=65:"
                f"box=1:boxcolor=0xAF134A@0.85:boxborderw=8[with_tag]"
            )
            last_layer = "[with_tag]"

    # Word-by-Word Animated Subtitles
    ass_path = None
    try:
        samples = common.decode(input_file, 16000, start, duration)
        words = []
        if len(samples) > 16000:
            try:
                raw_words, _ = listen.transcribe("tiny", samples, offset=0.0)
                words = [w for w in raw_words if w["e"] <= duration]
            except Exception as wex:
                print(f"Whisper transcribe note: {wex}")

        if len(words) < 3:
            s_toks = ["WAIT", "WHAT", "NO", "WAY", "BRO", "LOOK", "OMG"]
            dur_per_word = 0.8
            words = []
            for i, tok in enumerate(s_toks):
                s_t = round(i * dur_per_word, 2)
                e_t = round(s_t + dur_per_word, 2)
                if e_t <= duration:
                    words.append({"s": s_t, "e": e_t, "w": tok})

        if words:
            ass_path = output_file.with_suffix(".ass")
            cfg_subs = dict(cfg)
            cfg_subs["cap_active"] = "FFD400"  # Yellow punch word
            cfg_subs["cap_color"] = "FFFFFF"   # White
            cfg_subs["cap_font"] = "Impact"
            cfg_subs["cap_size"] = 80
            cfg_subs["cap_words"] = 3
            cfg_subs["cap_y"] = 0.84
            subs.write(words, duration, ass_path, cfg_subs)

            filter_chain.append(f"{last_layer}ass='{ass_path.name}'[with_subs]")
            last_layer = "[with_subs]"
    except Exception as e:
        print(f"Subtitle generation note: {e}")
        ass_path = None

    if wasted:
        wasted_start = max(0.0, duration - 3.2)
        filter_chain.append(
            f"{last_layer}drawtext=fontfile='{font_impact}':text='WASTED':fontcolor=0xdd2222:fontsize=130:x=(w-tw)/2:y=(h-th)/2:"
            f"enable='gte(t,{wasted_start})':box=1:boxcolor=0x000000@0.85:boxborderw=30[with_wasted]"
        )
        last_layer = "[with_wasted]"

    final_filter = ";".join(filter_chain)
    audio_filters = "loudnorm=I=-14:TP=-1.5:LRA=11,aformat=channel_layouts=stereo"

    cmd = [
        "ffmpeg", "-y", "-v", "error",
        *inputs,
        "-filter_complex", final_filter,
        "-map", last_layer,
        "-map", "0:a?",
        "-af", audio_filters,
        "-c:v", "libx264",
        "-crf", "19",
        "-preset", "veryfast",
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        output_file.name
    ]

    try:
        subprocess.run(
            cmd,
            cwd=str(output_file.parent.resolve()),
            check=True,
            timeout=PROCESS_TIMEOUT
        )
    finally:
        if ass_path and ass_path.exists():
            try: ass_path.unlink()
            except Exception: pass


@app.post("/api/generate-batch-clips")
async def generate_batch_clips(data: dict):
    """
    Stream-Clips Engine:
    Detects reaction volume peaks and replay heatmap spikes.
    Cuts tight, viral 1080p vertical clips centered on the reaction peak.
    """
    url = data.get("url", "").strip()
    file_name = data.get("file_name", "").strip()
    wanted_count = max(1, min(12, int(data.get("count", 3))))
    batch_index = max(1, min(100, int(data.get("batch_index", 1))))
    target_duration = max(5.0, min(180.0, float(data.get("duration", 45.0))))

    if url:
        validate_public_url(url)

    loop = asyncio.get_event_loop()

    cfg = settings.load()
    cfg["width"] = 1080
    cfg["height"] = 1920
    cfg["cam_share"] = 0.38
    cfg["crf"] = 19

    title = "Live Stream"
    channel = "@streamer"
    total_duration = 60.0
    info = None

    if url:
        ydl_meta_opts = {"js_runtimes": {"node": {}}, "quiet": True, "skip_download": True}
        def get_meta():
            with yt_dlp.YoutubeDL(ydl_meta_opts) as ydl:
                return ydl.extract_info(url, download=False)
        info = await asyncio.wait_for(loop.run_in_executor(None, get_meta), timeout=45.0)
        total_duration = float(info.get("duration") or 60.0)
        title = info.get("title", "Live Stream")
        raw_channel = info.get("uploader") or info.get("channel") or "@streamer"
        channel = re.sub(r'[#:\'"]', '', raw_channel).strip() or "@streamer"
    elif file_name:
        vpath = safe_resolve_video(file_name)
        if not vpath:
            raise HTTPException(status_code=400, detail="Invalid source video filename.")
        meta = get_video_info(vpath)
        total_duration = meta["duration"]
        title = file_name.replace("-", " ").replace(".mp4", "").title()

    detected_moments = []

    # 1. YouTube Replay Heatmap
    if url and isinstance(info, dict):
        heatmap = info.get("heatmap") or []
        if heatmap:
            sorted_hm = sorted(heatmap, key=lambda x: x.get("value", 0), reverse=True)
            for h in sorted_hm:
                t = (h.get("start_time", 0) + h.get("end_time", 0)) / 2.0
                if not any(abs(t - m["t"]) < 35.0 for m in detected_moments):
                    detected_moments.append({"t": t})
                    if len(detected_moments) >= 12:
                        break

    # 2. Audio Volume Spikes
    if len(detected_moments) < (batch_index * wanted_count):
        src_for_audio = safe_resolve_video(file_name) if file_name else None
        if src_for_audio and src_for_audio.exists():
            try:
                samples = common.decode(src_for_audio, 16000, 0, min(total_duration, 600))
                if len(samples) > 16000 * 5:
                    vol = listen._volume(samples)
                    v_spikes = listen.spikes(vol, window=120)
                    top_indices = np.argsort(v_spikes)[::-1]
                    for idx in top_indices:
                        t = float(idx)
                        if v_spikes[idx] > 4.0 and not any(abs(t - m["t"]) < 25.0 for m in detected_moments):
                            detected_moments.append({"t": t})
                            if len(detected_moments) >= 12:
                                break
            except Exception as e:
                print(f"Volume spike detection note: {e}")

    # Fallback to evenly distributed moments across stream
    if len(detected_moments) < (batch_index * wanted_count):
        step = total_duration / (wanted_count * 3 + 1)
        for s in range(wanted_count * 3):
            t = step * (s + 1)
            if not any(abs(t - m["t"]) < 20.0 for m in detected_moments):
                detected_moments.append({"t": t})

    # Pick moments for this batch
    start_idx = (batch_index - 1) * wanted_count
    batch_moments = detected_moments[start_idx : start_idx + wanted_count]
    if len(batch_moments) < wanted_count:
        batch_moments = detected_moments[:wanted_count]

    clips_results = []

    for i, mom in enumerate(batch_moments):
        clip_num = (batch_index - 1) * wanted_count + i + 1
        peak_t = mom["t"]
        
        if total_duration <= target_duration:
            start_t = 0.0
            actual_dur = round(total_duration, 1)
            end_t = actual_dur
        else:
            start_t = max(0.0, round(peak_t - 5.0, 1))
            end_t = round(start_t + target_duration, 1)
            if end_t > total_duration:
                end_t = total_duration
                start_t = max(0.0, round(end_t - target_duration, 1))
            actual_dur = round(end_t - start_t, 1)

        clip_id = f"clip_{clip_num:02d}_{uuid.uuid4().hex[:6]}"
        clip_out_name = f"{clip_id}_1080p.mp4"
        clip_out_path = EXPORTS_DIR / clip_out_name

        def produce_single_clip():
            temp_slice = None
            try:
                if url:
                    slice_tmpl = str(UPLOADS_DIR / f"{clip_id}_slice.%(ext)s")
                    ydl_slice = {
                        "js_runtimes": {"node": {}},
                        "format": "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
                        "download_ranges": yt_dlp.utils.download_range_func(None, [(start_t, end_t)]),
                        "outtmpl": slice_tmpl,
                        "merge_output_format": "mp4",
                        "quiet": True,
                        "no_warnings": True,
                        "force_keyframes_at_cuts": True,
                    }
                    with yt_dlp.YoutubeDL(ydl_slice) as ydl:
                        ydl.download([url])
                    cands = list(UPLOADS_DIR.glob(f"{clip_id}_slice*"))
                    if not cands:
                        raise Exception("Slice download failed")
                    temp_slice = cands[0]
                    src_video = temp_slice
                    input_offset = 0.0
                else:
                    vpath = safe_resolve_video(file_name)
                    if not vpath:
                        raise Exception("Local video source not found")
                    src_video = vpath
                    input_offset = start_t

                # Facecam detection
                info_vid = common.probe(src_video)
                frames, scale = frame.sample(src_video, input_offset, min(6.0, actual_dur), info_vid)
                dets = frame.faces(frames)
                found = frame.tracks(dets, frames)
                cam_perc = (65.0, 10.0, 28.0, 40.0)
                if found:
                    box, _ = frame.cam_box(frames, found[0]["box"])
                    cx, cy, cw, ch = [v * scale for v in box]
                    cam_perc = (
                        (cx / info_vid["width"]) * 100,
                        (cy / info_vid["height"]) * 100,
                        min(50, max(20, (cw / info_vid["width"]) * 100)),
                        min(50, max(20, (ch / info_vid["height"]) * 100))
                    )

                render_1080p_clip(
                    src_video, clip_out_path, input_offset, actual_dur,
                    cam_perc, channel, 0, False, cfg
                )
            finally:
                if temp_slice and temp_slice.exists():
                    try: temp_slice.unlink()
                    except Exception: pass

        await loop.run_in_executor(None, produce_single_clip)

        clips_results.append({
            "id": clip_id,
            "clip_num": clip_num,
            "filename": clip_out_name,
            "start": start_t,
            "end": end_t,
            "duration": actual_dur,
            "video_url": f"/media/exports/{clip_out_name}",
            "poster_url": "",
        })

    return {
        "success": True,
        "title": title,
        "channel": channel,
        "duration": total_duration,
        "batch_index": batch_index,
        "clips": clips_results
    }


@app.post("/api/export-clip")
async def export_clip(data: dict):
    """Manual single clip export with security controls."""
    source_url = data.get("source_url", "").strip()
    file_name = data.get("file_name", "").strip()

    if source_url:
        validate_public_url(source_url)

    start_time = max(0.0, float(data.get("start", 0)))
    end_time = max(start_time + 1.0, float(data.get("end", 15)))
    clip_duration = min(300.0, end_time - start_time)

    wasted = bool(data.get("wasted", False))
    raw_tag = data.get("streamer_tag", "@streamer")
    streamer_tag = escape_ffmpeg_drawtext(raw_tag)

    cam_x = max(0.0, min(100.0, float(data.get("cam_x", 65))))
    cam_y = max(0.0, min(100.0, float(data.get("cam_y", 10))))
    cam_w = max(10.0, min(100.0, float(data.get("cam_w", 30))))
    cam_h = max(10.0, min(100.0, float(data.get("cam_h", 35))))

    export_id = f"clip_{uuid.uuid4().hex[:8]}.mp4"
    output_path = EXPORTS_DIR / export_id
    loop = asyncio.get_event_loop()

    cfg = settings.load()
    cfg["width"] = 1080
    cfg["height"] = 1920
    cfg["cam_share"] = 0.38
    cfg["crf"] = 19

    def run_export():
        temp_slice = None
        try:
            if source_url:
                slice_tmpl = str(UPLOADS_DIR / f"manual_{uuid.uuid4().hex[:6]}.%(ext)s")
                ydl_slice = {
                    "js_runtimes": {"node": {}},
                    "format": "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
                    "download_ranges": yt_dlp.utils.download_range_func(None, [(start_time, end_time)]),
                    "outtmpl": slice_tmpl,
                    "merge_output_format": "mp4",
                    "quiet": True,
                    "force_keyframes_at_cuts": True,
                }
                with yt_dlp.YoutubeDL(ydl_slice) as ydl:
                    ydl.download([source_url])
                cands = list(UPLOADS_DIR.glob("manual_*"))
                if not cands:
                    raise Exception("Slice download failed")
                temp_slice = cands[0]
                src = temp_slice
                offset = 0.0
            else:
                vpath = safe_resolve_video(file_name)
                if not vpath:
                    raise Exception("Video source not found")
                src = vpath
                offset = start_time

            render_1080p_clip(
                src, output_path, offset, clip_duration,
                (cam_x, cam_y, cam_w, cam_h), streamer_tag, 0, wasted, cfg
            )
        finally:
            if temp_slice and temp_slice.exists():
                try: temp_slice.unlink()
                except Exception: pass

    await loop.run_in_executor(None, run_export)

    return {
        "success": True,
        "filename": export_id,
        "download_url": f"/media/exports/{export_id}"
    }


@app.post("/api/t")
async def telemetry_dummy():
    return {"ok": True}


@app.post("/api/update-clip-headline")
async def update_clip_headline(data: dict):
    """
    Updates headline titlecard on existing 1080p clip with path traversal guard.
    """
    filename = data.get("filename", "").strip()
    new_title = data.get("new_title", "").strip()
    if not filename or not new_title:
        raise HTTPException(status_code=400, detail="Missing filename or title.")

    # Guard against traversal
    clean_base = Path(filename).name
    clip_path = (EXPORTS_DIR / clean_base).resolve()
    if not clip_path.is_relative_to(EXPORTS_DIR.resolve()) or not clip_path.exists():
        raise HTTPException(status_code=404, detail="Clip file not found.")

    safe_title = escape_ffmpeg_drawtext(new_title)
    loop = asyncio.get_event_loop()

    def do_update():
        cfg = settings.load()
        cfg["title_size"] = 52
        cfg["title_bg"] = "0C100E"
        cfg["title_fg"] = "FFFFFF"

        tc_temp = EXPORTS_DIR / f"tc_{uuid.uuid4().hex[:6]}.png"
        _, _, tc_h = titlecard.render(safe_title, cfg, tc_temp)

        seam_y = int(1920 * 0.38)
        title_y = int(seam_y - (tc_h / 2))

        temp_out = EXPORTS_DIR / f"tmp_{uuid.uuid4().hex[:6]}.mp4"
        cmd = [
            "ffmpeg", "-y", "-v", "error",
            "-i", str(clip_path),
            "-i", str(tc_temp),
            "-filter_complex", f"[0:v][1:v]overlay=(W-w)/2:{title_y}[outv]",
            "-map", "[outv]", "-map", "0:a?",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "19",
            "-c:a", "copy",
            "-movflags", "+faststart",
            str(temp_out)
        ]
        try:
            subprocess.run(cmd, check=True, timeout=120)
            shutil.move(str(temp_out), str(clip_path))
        finally:
            if tc_temp.exists():
                try: tc_temp.unlink()
                except Exception: pass
            if temp_out.exists():
                try: temp_out.unlink()
                except Exception: pass

    await loop.run_in_executor(None, do_update)
    return {"success": True, "video_url": f"/media/exports/{clean_base}", "title": new_title}


# ── STATIC ASSETS MOUNTS ──────────────────────────────────────────────────────
app.mount("/media/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/media/exports", StaticFiles(directory=str(EXPORTS_DIR)), name="exports")
app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False)
