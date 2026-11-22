/**
 * ChopperLoader: Reusable Loading Animation Component
 * Official Chopper Mascot Loading Experience
 * 10+ Minute Continuous Dynamic Pipeline & Rotating Creator Insights
 */

export const PIPELINE_STAGES = [
  { sec: 0, title: 'Ingesting Stream Video & Container...', desc: 'Verifying video stream, demuxing container, and inspecting keyframe cadence...', pct: 6, step: 'Stream Ingest' },
  { sec: 7, title: 'Demuxing Video & Audio Streams...', desc: 'Extracting stereo audio tracks and mapping AAC streams for high-speed analysis...', pct: 10, step: 'Demuxing Audio' },
  { sec: 15, title: 'Acoustic Frequency & Decibel Scanning...', desc: 'Running Fast Fourier Transform (FFT) across stream audio to measure decibel loudness curves...', pct: 14, step: 'FFT Audio Analysis' },
  { sec: 24, title: 'Detecting High-Energy Reaction Spikes...', desc: 'Filtering shouting, screaming, sudden laughter, and streamer microphone peaks...', pct: 18, step: 'Reaction Peak Detection' },
  { sec: 34, title: 'Cross-Referencing Replay Heatmap...', desc: 'Correlating chat activity spikes and high-rewind clusters across the stream timeline...', pct: 23, step: 'Heatmap Clustering' },
  { sec: 45, title: 'Scoring Top Viral Highlight Candidates...', desc: 'Ranking clip candidates using acoustic energy density and pace transitions...', pct: 28, step: 'Candidate Scoring' },
  { sec: 57, title: 'Isolating Best 3 Highlight Windows...', desc: 'Selecting the 3 highest-impact clips with punchy intro hooks and natural payoff endings...', pct: 33, step: 'Window Selection' },
  { sec: 70, title: 'Initializing Computer Vision Engine...', desc: 'Loading OpenCV cascade & deep learning models to track gameplay and streamer regions...', pct: 38, step: 'Vision Initialization' },
  { sec: 84, title: 'Scanning Frames for Streamer Facecam...', desc: 'Detecting facial landmarks, eye contours, and streamer camera bounding box coordinates...', pct: 43, step: 'Facecam Detection' },
  { sec: 99, title: 'Locking Facecam & Framing Coordinates...', desc: 'Computing optimal facecam center coordinates and smoothing pan transitions...', pct: 47, step: 'Facecam Tracking' },
  { sec: 115, title: 'Detecting Gameplay Screen Region...', desc: 'Analyzing center gameplay action vectors and HUD elements to prevent UI cropping...', pct: 51, step: 'Gameplay Tracking' },
  { sec: 132, title: 'Computing 9:16 Vertical Crop Geometry...', desc: 'Building dual-zone composition layout: facecam at top and gameplay at bottom...', pct: 55, step: '9:16 Split Geometry' },
  { sec: 150, title: 'Resampling Audio for Speech Recognition...', desc: 'Normalizing audio stream to 16,000Hz mono WAV for neural transcription models...', pct: 59, step: 'Audio Resampling' },
  { sec: 169, title: 'Loading OpenAI Whisper Neural Engine...', desc: 'Warming acoustic tokenizers and sequence-to-sequence transformer speech model...', pct: 62, step: 'Whisper AI Engine' },
  { sec: 189, title: 'Transcribing Stream Audio (Pass 1)...', desc: 'Converting speech to text, recognizing slang, gaming terminology, and streamer banter...', pct: 65, step: 'Neural Speech-to-Text' },
  { sec: 210, title: 'Aligning Word-Level Microsecond Timestamps...', desc: 'Extracting exact start and end millisecond boundaries for every spoken word...', pct: 68, step: 'Acoustic Alignment' },
  { sec: 232, title: 'Filtering Speech Artifacts & Background Noise...', desc: 'Removing filler words, mic breathing, and game sound bleed from subtitle tracks...', pct: 71, step: 'Audio Cleanup' },
  { sec: 255, title: 'Synthesizing Kinetic Karaoke Typography...', desc: 'Generating dynamic animated subtitles with bold modern typography and high-contrast drop shadows...', pct: 74, step: 'Karaoke Engine' },
  { sec: 279, title: 'Highlighting High-Energy Punch Words...', desc: 'Coloring emphasis words in vibrant yellow & Chopper pink to maximize viewer hook retention...', pct: 77, step: 'Word Highlighting' },
  { sec: 304, title: 'Calculating Mobile UI Safe Zones...', desc: 'Adjusting subtitle positioning to stay clear of TikTok, Reels, and Shorts UI buttons...', pct: 80, step: 'Safe Zone Layout' },
  { sec: 330, title: 'Building Multi-Layer Video Render Graph...', desc: 'Assembling FFmpeg filter graph: split-screen scaling, ambient background blur, and border mask...', pct: 82, step: 'Filter Graph Assembly' },
  { sec: 357, title: 'Rendering Clip 01 · 1080x1920 60FPS...', desc: 'Multi-core hardware-accelerated H.264 rendering with high-profile YUV420p color precision...', pct: 84, step: 'Rendering Clip 01' },
  { sec: 385, title: 'Burn-in Karaoke Captions (Clip 01)...', desc: 'Rasterizing crisp vector font glyphs and applying word-by-word animation keyframes...', pct: 86, step: 'Subtitle Compositing' },
  { sec: 414, title: 'Mastering Clip 01 Audio Stream...', desc: 'Applying dynamic range compression and loudness normalization to -14 LUFS standard...', pct: 88, step: 'Audio Mastering' },
  { sec: 444, title: 'Rendering Clip 02 · 1080x1920 60FPS...', desc: 'Encoding high-bitrate vertical video frames and synchronizing streamer facecam crop...', pct: 90, step: 'Rendering Clip 02' },
  { sec: 475, title: 'Burn-in Karaoke Captions (Clip 02)...', desc: 'Synthesizing dynamic word pop effects and calibrating caption reading speed...', pct: 91, step: 'Subtitle Compositing' },
  { sec: 507, title: 'Mastering Clip 02 Audio Stream...', desc: 'Balancing voice clarity against in-game explosions and background music...', pct: 92, step: 'Audio Mastering' },
  { sec: 540, title: 'Rendering Clip 03 · 1080x1920 60FPS...', desc: 'Encoding final vertical video stream with buttery-smooth 60 frames per second...', pct: 93, step: 'Rendering Clip 03' },
  { sec: 574, title: 'Burn-in Karaoke Captions (Clip 03)...', desc: 'Rendering stylized text outlines and finalizing word highlighting...', pct: 94, step: 'Subtitle Compositing' },
  { sec: 609, title: 'Mastering Clip 03 Audio Stream...', desc: 'Applying final audio limiter to prevent distortion on mobile speakers...', pct: 95, step: 'Audio Mastering' },
  { sec: 645, title: 'Optimizing MP4 FastStart for Mobile...', desc: 'Moving MP4 moov atom to the front of files for instant playback without buffering...', pct: 96, step: 'FastStart Optimization' },
  { sec: 682, title: 'Verifying Bitrate & Stream Integrity...', desc: 'Validating video frame consistency, audio sync, and container headers...', pct: 97, step: 'Integrity Check' },
  { sec: 720, title: 'Packaging Ready-to-Download Batch...', desc: 'Finalizing 3 vertical clips in exports folder and generating interactive player cards...', pct: 98, step: 'Packaging Batch' }
];

export const CREATOR_TIPS = [
  "The first 3 seconds decide 70% of viral retention. Chopper hooks the viewer right from frame 1.",
  "Subtitled vertical shorts increase audience retention by over 55% on mobile devices.",
  "Over 75% of mobile viewers browse with sound off initially. Crisp karaoke subtitles keep them engaged.",
  "Split-screen facecam + gameplay layout is proven to boost viewer emotional connection by 2.4x.",
  "YouTube Shorts algorithm prioritizes videos with high average percentage viewed (APV > 80%).",
  "Adding colored emphasis to punch words helps guide the viewer's eyes and speeds up reading cadence.",
  "1080x1920 at 60FPS gives smooth gameplay motion that stands out against low-bitrate competitor clips.",
  "All clips are rendered 100% locally on your machine with zero cloud compression and complete privacy.",
  "Keep your short titles under 50 characters with a strong curiosity gap for highest click-through rate.",
  "Posting 2-3 vertical shorts per day on TikTok and Reels is the sweet spot for rapid channel growth.",
  "Replay heatmaps pinpoint where thousands of viewers rewound or shared during the live stream.",
  "Audio normalization to -14 LUFS prevents your video from sounding quiet next to trending TikTok sounds.",
  "High energy spikes in voice decibels correlate directly with genuine streamer reactions.",
  "Word-by-word karaoke animation creates a rhythmic visual pulse that prevents swipe-aways.",
  "Centering facecam in the upper half leaves the bottom half free for subtitles and gameplay action.",
  "Clips between 30 and 45 seconds have the highest completion rate across both Instagram Reels and Shorts.",
  "Consistent branding and color cues make viewers recognize your clips instantly on their feed.",
  "Chopper extracts non-destructive cuts directly from source frames for maximum visual sharpness.",
  "Keep subtitles in the middle third of the vertical screen to avoid platform UI button overlays.",
  "Strong emotional payoff at the end of a clip leads to 3x more comments and shares.",
  "Shorts with fast pacing and zero dead air have 40% higher replay rates.",
  "Chopper's AI Whisper engine automatically handles gaming slang, shouting, and fast banter.",
  "Facecam detection locks onto the streamer even when they move or lean back during intense moments.",
  "Using full HD 1080p source prevents blurry compression artifacts on high-resolution smartphone screens.",
  "Batch clipping lets you turn a single 2-hour gaming stream into a week's worth of viral daily content.",
  "Ending your clip right after the punchline or climax encourages viewers to loop it a second time.",
  "Contrast is king: high-contrast text outlines ensure readability over both dark and bright game scenes.",
  "Chopper organizes all finished MP4 files cleanly in your local exports directory with instant zero-loss downloads."
];

export class ChopperLoaderComponent extends HTMLElement {
  static get observedAttributes() {
    return ['title', 'desc', 'progress', 'active'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.timerInterval = null;
    this.tipInterval = null;
    this.elapsedSeconds = 0;
    this.tipIndex = 0;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this.clearTimers();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    this.update();
  }

  render() {
    const title = this.getAttribute('title') || PIPELINE_STAGES[0].title;
    const desc = this.getAttribute('desc') || PIPELINE_STAGES[0].desc;
    const progress = this.getAttribute('progress') || '8';
    const active = this.hasAttribute('active');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: ${active ? 'flex' : 'none'};
          position: fixed;
          inset: 0;
          background: rgba(41, 35, 38, 0.72);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 9999;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        }
        .hud-box {
          background: #FFFEFA;
          border: 2px solid #F1DFE3;
          border-radius: 20px;
          padding: 24px 24px 22px;
          max-width: 480px;
          width: 100%;
          text-align: center;
          box-shadow: 0 24px 64px rgba(41, 35, 38, 0.28), 0 4px 16px rgba(175, 19, 74, 0.12);
        }
        .frame {
          width: 100%;
          max-width: 432px;
          aspect-ratio: 16 / 9;
          margin: 0 auto 16px;
          border-radius: 14px;
          overflow: hidden;
          background: #FFF9F0;
          position: relative;
        }
        video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          background: #FFF9F0;
        }
        .poster {
          display: none;
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #FFF9F0;
        }
        @media (prefers-reduced-motion: reduce) {
          video { display: none !important; }
          .poster { display: block !important; }
        }
        .badge {
          position: absolute;
          top: 10px;
          left: 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 254, 250, 0.94);
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
          color: #AF134A;
          border: 1px solid #F1DFE3;
          pointer-events: none;
        }
        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #AF134A;
          display: inline-block;
        }
        .title {
          font-size: 19px;
          font-weight: 800;
          color: #292326;
          margin-bottom: 6px;
          letter-spacing: -0.2px;
          min-height: 26px;
          transition: color 0.25s ease;
        }
        .desc {
          font-size: 13px;
          color: #75452C;
          line-height: 1.45;
          margin-bottom: 16px;
          min-height: 38px;
          transition: color 0.25s ease;
        }
        .progress-section {
          margin: 12px 0 16px;
        }
        .progress-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .timer-tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #75452C;
        }
        .percent-tag {
          color: #AF134A;
          font-size: 13px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }
        .track {
          width: 100%;
          height: 8px;
          background: #FFE1EB;
          border-radius: 9999px;
          overflow: hidden;
          position: relative;
        }
        .bar {
          height: 100%;
          width: ${progress}%;
          background: linear-gradient(90deg, #FF5B8A, #AF134A);
          border-radius: 9999px;
          transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .tip-box {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: #FFF9F0;
          border: 1px solid #F1DFE3;
          border-radius: 14px;
          padding: 12px 14px;
          text-align: left;
        }
        .tip-icon {
          font-size: 18px;
          line-height: 1.2;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .tip-body {
          flex: 1;
          min-width: 0;
        }
        .tip-header {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #AF134A;
          margin-bottom: 2px;
        }
        .tip-text {
          font-size: 12px;
          color: #292326;
          line-height: 1.45;
          transition: opacity 0.2s ease;
        }
      </style>
      <div class="hud-box" role="dialog" aria-modal="true">
        <div class="frame">
          <video 
            playsinline 
            autoplay 
            muted 
            loop 
            preload="auto" 
            poster="/assets/chopper-loader-poster.jpg">
            <source src="/assets/chopper-loader.mp4" type="video/mp4">
          </video>
          <img class="poster" src="/assets/chopper-loader-poster.jpg" alt="Chopper loading">
          <div class="badge">
            <span class="dot"></span>
            <span>Chopper is working</span>
          </div>
        </div>

        <div class="title">${title}</div>
        <div class="desc">${desc}</div>

        <div class="tip-box">
          <div class="tip-icon">
            <svg class="lucide lucide-lightbulb" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#AF134A;flex-shrink:0;"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
          </div>
          <div class="tip-body">
            <div class="tip-header">CHOPPER CREATOR INSIGHT</div>
            <div class="tip-text">${CREATOR_TIPS[0]}</div>
          </div>
        </div>
      </div>
    `;

    const vid = this.shadowRoot.querySelector('video');
    if (vid && active) {
      vid.currentTime = 0;
      vid.play().catch(() => {});
    }
  }

  update() {
    const active = this.hasAttribute('active');
    this.style.display = active ? 'flex' : 'none';
    const titleEl = this.shadowRoot.querySelector('.title');
    const descEl = this.shadowRoot.querySelector('.desc');
    const barEl = this.shadowRoot.querySelector('.bar');
    const pctEl = this.shadowRoot.querySelector('.percent-tag');
    const vid = this.shadowRoot.querySelector('video');

    if (titleEl) titleEl.textContent = this.getAttribute('title') || PIPELINE_STAGES[0].title;
    if (descEl) descEl.textContent = this.getAttribute('desc') || PIPELINE_STAGES[0].desc;
    const p = this.getAttribute('progress') || '8';
    if (barEl) barEl.style.width = `${p}%`;
    if (pctEl) pctEl.textContent = `${p}%`;

    if (vid) {
      if (active) {
        vid.currentTime = 0;
        vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    }
  }

  show(initialTitle, initialDesc) {
    this.clearTimers();
    this.elapsedSeconds = 0;
    this.tipIndex = 0;

    this.setAttribute('title', initialTitle || PIPELINE_STAGES[0].title);
    this.setAttribute('desc', initialDesc || PIPELINE_STAGES[0].desc);
    this.setAttribute('progress', '8');
    this.setAttribute('active', '');

    const timerCountEl = this.shadowRoot.querySelector('.timer-count');
    const stepCountEl = this.shadowRoot.querySelector('.step-count');
    const tipTextEl = this.shadowRoot.querySelector('.tip-text');

    if (timerCountEl) timerCountEl.textContent = '00:00';
    if (stepCountEl) stepCountEl.textContent = PIPELINE_STAGES[0].step;
    if (tipTextEl) tipTextEl.textContent = CREATOR_TIPS[0];

    // Precision 1-Second Timer & Stage Progression (10+ Minutes)
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++;
      const mins = Math.floor(this.elapsedSeconds / 60).toString().padStart(2, '0');
      const secs = (this.elapsedSeconds % 60).toString().padStart(2, '0');
      if (timerCountEl) timerCountEl.textContent = `${mins}:${secs}`;

      let activeStage = PIPELINE_STAGES[0];
      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        if (this.elapsedSeconds >= PIPELINE_STAGES[i].sec) {
          activeStage = PIPELINE_STAGES[i];
        } else {
          break;
        }
      }

      if (this.elapsedSeconds <= 720) {
        if (!initialTitle || this.elapsedSeconds > 5) this.setAttribute('title', activeStage.title);
        if (!initialDesc || this.elapsedSeconds > 5) this.setAttribute('desc', activeStage.desc);
        this.setAttribute('progress', activeStage.pct);
        if (stepCountEl) stepCountEl.textContent = activeStage.step;
      } else {
        const extraPass = Math.floor((this.elapsedSeconds - 720) / 20) + 1;
        const extraPct = Math.min(99, 98 + (((this.elapsedSeconds - 720) % 20) / 20)).toFixed(0);
        this.setAttribute('title', `Polishing Video Stream (Pass ${extraPass})...`);
        this.setAttribute('desc', 'Validating multi-channel audio tracks, keyframe indices, and final package buffers...');
        this.setAttribute('progress', extraPct);
        if (stepCountEl) stepCountEl.textContent = `Pass ${extraPass} Finalizing`;
      }
    }, 1000);

    // Dynamic Creator Insights (Every 7.5 Seconds)
    this.tipInterval = setInterval(() => {
      this.tipIndex = (this.tipIndex + 1) % CREATOR_TIPS.length;
      if (tipTextEl) {
        tipTextEl.style.opacity = '0.2';
        setTimeout(() => {
          tipTextEl.textContent = CREATOR_TIPS[this.tipIndex];
          tipTextEl.style.opacity = '1';
        }, 180);
      }
    }, 7500);
  }

  hide() {
    this.clearTimers();
    this.removeAttribute('active');
  }

  clearTimers() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.tipInterval) {
      clearInterval(this.tipInterval);
      this.tipInterval = null;
    }
  }
}

if (!customElements.get('chopper-loader')) {
  customElements.define('chopper-loader', ChopperLoaderComponent);
}
