/* Framework-free scene gallery and main-clock multi-view player. */
document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const config = window.ROBOASSIST_DEMOS;
  const grid = document.getElementById("demo-scene-grid");
  if (!config || !grid) return;

  const urlFor = (resource) => {
    if (!resource?.available || !resource.src) return null;
    try {
      const url = new URL(resource.src, document.baseURI);
      return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (text, className = "mv-button") => {
    const node = el("button", className, text);
    node.type = "button";
    return node;
  };
  const release = (video) => {
    video.pause();
    video.removeAttribute("src");
    video.removeAttribute("poster");
    video.load();
  };
  const clock = (seconds) => {
    const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
  };

  const dialog = el("dialog", "mv-dialog");
  dialog.setAttribute("aria-labelledby", "mv-title");
  dialog.setAttribute("aria-describedby", "mv-description");
  dialog.innerHTML = `
    <div class="mv-header"><div><p class="mv-eyebrow">Interactive Multi-View Robot Demonstrations</p><h2 id="mv-title"></h2></div><button class="mv-button mv-close" type="button" aria-label="Close demonstration">Close ×</button></div>
    <p class="mv-description" id="mv-description"></p>
    <div class="mv-surface">
      <div class="mv-stage">
        <div class="mv-main"><span class="mv-view-label">MAIN VIEW</span><video class="mv-main-video" muted playsinline preload="none" aria-label="Main experiment view"></video><button class="mv-overlay-play" type="button" aria-label="Play video" hidden disabled><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button><div class="mv-empty"><strong>Experimental video forthcoming</strong><p>This scene is ready for the verified experimental recording.</p></div></div>
        <div class="mv-aux-layer"></div>
      </div>
      <div class="mv-controls" role="group" aria-label="Shared playback controls">
        <button class="mv-button" data-mv="play" type="button">Play</button>
        <label class="mv-seek-label">Progress<input data-mv="seek" type="range" min="0" max="0" value="0" step="0.01" aria-label="Experiment progress"></label>
        <output class="mv-clock" data-mv="clock">0:00 / 0:00</output>
        <label class="mv-speed-label">Speed<select data-mv="speed" aria-label="Playback speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option><option value="3">3×</option></select></label>
        <button class="mv-button" data-mv="fullscreen" type="button">Fullscreen</button>
      </div>
      <div class="mv-viewbar" role="group" aria-label="Camera views"><span class="mv-main-chip">Main View</span><div class="mv-view-buttons"></div><button class="mv-button" data-mv="split" type="button" aria-pressed="false" disabled>Split View</button></div>
    </div>
    <p class="mv-hint">Open a camera to compare synchronized views. On small screens, one auxiliary view is shown at a time.</p>
    <div class="mv-timeline" hidden><h3>Event Timeline</h3><div class="mv-event-rail" role="group" aria-label="Event markers"></div><div class="mv-event-track" role="group" aria-label="Experiment events"></div></div>
    <div class="mv-buffer" hidden><div class="mv-buffer-copy"><span data-mv="buffer-label"></span><button class="mv-button" data-mv="play-now" type="button" hidden>Play now</button></div></div>
    <p class="mv-status" role="status" aria-live="polite"></p>`;
  document.body.append(dialog);
  const $ = (selector) => dialog.querySelector(selector);
  const control = (name) => $(`[data-mv="${name}"]`);
  const main = $(".mv-main-video");
  // Covers are already display-cropped. Keep them outside the raw video canvas
  // so video-specific crop sizing cannot stretch/crop the cover a second time.
  const mainPoster = el("img", "mv-main-poster");
  mainPoster.alt = "";
  mainPoster.hidden = true;
  main.after(mainPoster);
  mainPoster.addEventListener("error", () => { mainPoster.hidden = true; });
  // Web playback is intentionally silent; keep original media audio untouched.
  function silence(video) {
    const enforce = () => {
      if (!video.muted) video.muted = true;
      if (video.volume !== 0) video.volume = 0;
    };
    video.defaultMuted = true;
    enforce();
    video.addEventListener("volumechange", enforce);
  }
  silence(main);
  const overlayPlay = $(".mv-overlay-play");
  function loadingSpinner() {
    const spinner = el("span", "mv-loading-spinner");
    spinner.setAttribute("role", "status");
    spinner.setAttribute("aria-label", "Loading video");
    spinner.hidden = true;
    return spinner;
  }
  const mainSpinner = loadingSpinner();
  $(".mv-main").append(mainSpinner);
  const stage = $(".mv-stage");
  const layer = $(".mv-aux-layer");
  const surface = $(".mv-surface");
  const empty = $(".mv-empty");
  const viewButtons = $(".mv-view-buttons");
  const status = $(".mv-status");
  const hero = document.getElementById("hero-background-video");
  if (hero) silence(hero);
  const compact = window.matchMedia("(max-width: 640px)");
  const active = new Map();
  const availableViews = new Map();
  let scene = null;
  let opener = null;
  let ticker = null;
  let session = 0;
  let split = false;
  let stalled = false;
  let wasHeroPlaying = false;
  let previousOverflow = "";
  let eventButtons = [];
  let failedViews = new Set();
  let dragCancel = null;
  let scrubbing = false;
  let scrubTarget = 0;
  let scrubWasPlaying = false;
  let scrubPointer = null;
  let previewWarning = "";
  let playbackWanted = false;
  let buffering = false;
  let bufferTicker = null;
  let bufferStarted = 0;
  let startingPlayback = false;
  let lastBufferSeconds = 0;
  let lastBufferGrowth = 0;
  const bufferBox = $(".mv-buffer");
  surface.append(bufferBox); // Keep progress and the fallback reachable in fullscreen.

  function bufferState() {
    const videos = [{ video: main, time: main.currentTime, rate: main.playbackRate }];
    active.forEach(entry => {
      const mapped = mappedTime(entry.view, main.currentTime);
      if (entry.video && !entry.blocked && mapped && mapped.time >= 0 && mapped.time < entry.video.duration) {
        videos.push({ video: entry.video, time: mapped.time, rate: main.playbackRate * mapped.rate });
      } else if (entry.video && !entry.blocked && entry.video.readyState < 1) {
        videos.push({ video: entry.video, time: 0, rate: main.playbackRate });
      }
    });
    return videos.map(({ video, time, rate }) => {
      let ahead = 0;
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= time + 0.05 && video.buffered.end(i) > time) {
          ahead = video.buffered.end(i) - time;
          break;
        }
      }
      const remaining = Number.isFinite(video.duration) ? Math.max(0, video.duration - time) : Infinity;
      const target = Math.min(8 * rate, remaining);
      return { ahead, seconds: ahead / rate, target, ready: video.readyState >= 2 && !video.seeking,
        enough: video.readyState >= 2 && !video.seeking && ahead + 0.08 >= target,
        low: remaining > 0.15 && (video.readyState < 3 || ahead < Math.min(0.6 * rate, remaining - 0.05)) };
    });
  }
  function cancelBuffering() {
    playbackWanted = false;
    buffering = false;
    clearInterval(bufferTicker);
    bufferTicker = null;
    bufferBox.hidden = true;
    control("play-now").hidden = true;
    control("buffer-label").textContent = "Playback paused · select Play to buffer and resume";
  }
  function holdForBuffer() {
    if (!playbackWanted || buffering || scrubbing || main.ended) return;
    buffering = true;
    bufferStarted = performance.now();
    lastBufferSeconds = 0;
    lastBufferGrowth = bufferStarted;
    main.preload = "auto";
    active.forEach(entry => { if (entry.video) entry.video.preload = "auto"; });
    main.pause();
    syncAll(true);
    updateControls();
  }
  function resumeBufferedPlayback() {
    if (!playbackWanted || startingPlayback || !dialog.open || scrubbing) return;
    const token = session;
    buffering = false;
    stalled = false;
    startingPlayback = true;
    main.play().catch(error => {
      if (token !== session || !dialog.open || error.name === "AbortError") return;
      cancelBuffering();
      say("Playback could not start. Select Play to retry.");
    }).finally(() => { if (token === session) { startingPlayback = false; updateControls(); } });
  }
  function checkBuffer() {
    if (!dialog.open || !playbackWanted || scrubbing || main.seeking) return;
    if (main.ended) { cancelBuffering(); return; }
    const states = bufferState();
    if (!buffering && !main.paused && states.some(state => state.low)) holdForBuffer();
    const seconds = Math.min(...states.map(state => state.seconds));
    if (seconds > lastBufferSeconds + 0.1) { lastBufferSeconds = seconds; lastBufferGrowth = performance.now(); }
    bufferBox.hidden = !buffering;
    control("buffer-label").textContent = states.length > 1 ? "Buffering synchronized views…" : "Buffering…";
    control("play-now").hidden = !buffering || performance.now() - bufferStarted < 15000 || !states.every(state => state.ready);
    // Browsers may cap paused preloading. Avoid an unreachable eight-second
    // gate: use a smaller real buffer only after six seconds without growth.
    const preloadLimited = seconds >= 2 && performance.now() - lastBufferGrowth >= 6000 && states.every(state => state.ready);
    if (buffering && (states.every(state => state.enough) || preloadLimited)) resumeBufferedPlayback();
  }
  function requestBufferedPlayback() {
    if (main.ended) main.currentTime = 0;
    playbackWanted = true;
    holdForBuffer();
    if (!bufferTicker) bufferTicker = setInterval(checkBuffer, 250);
    checkBuffer();
  }
  control("play-now").addEventListener("click", () => {
    resumeBufferedPlayback();
    say("Playing with the available buffer. A slow connection may require another buffering pause.");
  });

  // Crop only a verified black-border rectangle; retain the complete original file.
  function frameVideo(video, resource) {
    let viewport = video.closest(".mv-video-viewport");
    if (!viewport) {
      viewport = el("div", "mv-video-viewport");
      const frame = el("div", "mv-video-frame");
      video.replaceWith(viewport);
      viewport.append(frame);
      frame.append(video);
    }
    const crop = resource?.displayCrop;
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) return;
    const valid = crop && crop.x >= 0 && crop.y >= 0 && crop.width > 0 && crop.height > 0
      && crop.x + crop.width <= sourceWidth && crop.y + crop.height <= sourceHeight;
    const rect = valid ? crop : { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
    const ratio = rect.width / rect.height;
    viewport.dataset.ratio = String(ratio);
    const width = Math.min(viewport.clientWidth, viewport.clientHeight * ratio);
    const frame = viewport.firstElementChild;
    frame.style.width = `${width}px`;
    frame.style.height = `${width / ratio}px`;
    video.style.width = `${sourceWidth / rect.width * 100}%`;
    video.style.height = `${sourceHeight / rect.height * 100}%`;
    video.style.left = `${-rect.x / rect.width * 100}%`;
    video.style.top = `${-rect.y / rect.height * 100}%`;
    video.classList.add("is-framed");
  }

  function say(message) { status.textContent = previewWarning || message; }
  async function checkLocalPreview(source, token) {
    const address = new URL(source);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(address.hostname)) return;
    try {
      const response = await fetch(source, { method: "HEAD", headers: { Range: "bytes=0-0" }, cache: "no-store" });
      if (token !== session || !dialog.open) return;
      if (response.status === 200) {
        previewWarning = "This preview server does not support video seeking. Restart with start-preview.cmd (or python tools/preview.py --port 8000), then refresh the page.";
        say(previewWarning);
      }
    } catch { /* Media loading reports connection errors separately. */ }
  }
  function setControls(enabled) {
    $(".mv-controls").querySelectorAll("button,input,select").forEach(node => { node.disabled = !enabled; });
    overlayPlay.disabled = !enabled;
    updateLoadingUI();
  }
  function updateLoadingUI() {
    const busy = dialog.open && !!main.getAttribute("src") && !main.error
      && (main.readyState < 2 || main.seeking || buffering || startingPlayback || (stalled && playbackWanted));
    mainSpinner.hidden = !busy;
    $(".mv-main").setAttribute("aria-busy", String(busy));
    overlayPlay.hidden = busy || overlayPlay.disabled || main.hidden || (!main.paused && !main.ended);
  }
  function updateControls() {
    const duration = Number.isFinite(main.duration) ? main.duration : 0;
    const seek = control("seek");
    seek.max = String(duration);
    if (!scrubbing) seek.value = String(main.currentTime || 0);
    const shownTime = scrubbing ? scrubTarget : main.currentTime;
    seek.setAttribute("aria-valuetext", `${clock(shownTime)} of ${clock(duration)}`);
    control("clock").textContent = `${clock(shownTime)} / ${clock(duration)}`;
    control("play").textContent = buffering && playbackWanted ? "Cancel" : main.paused || main.ended ? "Play" : "Pause";
    updateLoadingUI();
    let current = -1;
    eventButtons.forEach((event, index) => { if (event.time <= main.currentTime) current = index; });
    eventButtons.forEach((event, index) => {
      const selected = index === current;
      event.node.classList.toggle("is-current", selected);
      event.marker.classList.toggle("is-current", selected);
      if (selected) event.node.setAttribute("aria-current", "true");
      else event.node.removeAttribute("aria-current");
    });
  }

  // Piecewise affine mapping optionally handles independently edited clips.
  // Unmapped main-time ranges deliberately show a gap, never a misleading frozen view.
  function mappedTime(view, time) {
    if (Array.isArray(view.timeMap) && view.timeMap.length) {
      const segment = view.timeMap.find(part => time >= part.mainStart && time < part.mainEnd);
      if (!segment) return null;
      const rate = Number(segment.rate ?? 1);
      if (!Number.isFinite(rate) || rate <= 0) return null;
      return { time: segment.auxStart + (time - segment.mainStart) * rate, rate };
    }
    return { time: time + (Number(view.timeOffset) || 0), rate: 1 };
  }

  function cameraLoading(entry, loading) {
    if (entry.blocked) { entry.spinner.hidden = true; entry.body.setAttribute("aria-busy", "false"); return; }
    if (!loading) {
      clearTimeout(entry.loadingTimer);
      entry.loadingTimer = null;
      entry.notice.hidden = true;
      entry.spinner.hidden = true;
      entry.body.setAttribute("aria-busy", "false");
    } else if (!entry.loadingTimer) {
      // A short seek must not flash an opaque loading layer over live footage.
      entry.loadingTimer = setTimeout(() => {
        entry.loadingTimer = null;
        if (active.get(entry.view.id) !== entry || entry.blocked) return;
        if (entry.video.readyState < 2 || entry.video.seeking || entry.waiting) {
          entry.notice.hidden = true;
          entry.spinner.hidden = false;
          entry.body.setAttribute("aria-busy", "true");
        }
      }, 250);
    }
  }

  function syncEntry(entry, force = false) {
    if (active.get(entry.view.id) !== entry) return;
    if (entry.view.type === "state") {
      const rows = (entry.view.entries || []).filter(row => Number.isFinite(row.time) && row.time <= main.currentTime);
      const row = rows[rows.length - 1];
      entry.stateTitle.textContent = row?.title || "No verified state at this time";
      entry.stateBody.textContent = row?.text || "";
      return;
    }
    const video = entry.video;
    if (video.readyState < 1) { cameraLoading(entry, true); return; }
    const mapped = mappedTime(entry.view, main.currentTime);
    const inRange = mapped && mapped.time >= 0 && Number.isFinite(video.duration) && mapped.time < video.duration;
    if (!inRange) {
      video.pause();
      cameraLoading(entry, false);
      entry.notice.textContent = "No camera recording at this time";
      entry.notice.hidden = false;
      return;
    }
    if (!entry.blocked) entry.resume.hidden = true;
    // Wait for the main seek to finish before aligning cameras to its final time.
    if (main.seeking) { video.pause(); entry.needsAlign = true; return; }
    const now = performance.now();
    const drift = mapped.time - video.currentTime;
    const shouldPlay = !main.paused && !main.ended && !stalled;
    // Continuous playback uses gentle speed correction, not repeated seeks.
    // A new camera/user seek aligns once; large drift gets a bounded recovery.
    const align = entry.needsAlign || (force && !shouldPlay);
    if (!video.seeking && Math.abs(drift) > (align ? 0.08 : 2) &&
        (align || (video.readyState >= 3 && now - entry.lastSeek > 4000))) {
      video.currentTime = mapped.time;
      entry.lastSeek = now;
    }
    if (!video.seeking || align) entry.needsAlign = false;
    const correction = shouldPlay && !video.seeking && Math.abs(drift) > 0.12
      ? Math.max(-0.05, Math.min(0.05, drift * 0.05)) : 0;
    const rate = Math.min(16, Math.max(0.0625, main.playbackRate * mapped.rate * (1 + correction)));
    if (Math.abs(video.playbackRate - rate) > 0.005) video.playbackRate = rate;
    cameraLoading(entry, video.readyState < 2 || video.seeking || entry.waiting);
    if (!shouldPlay) video.pause();
    else if (video.paused && !entry.blocked && !entry.playPending) {
      entry.playPending = true;
      video.play().catch(error => {
        if (active.get(entry.view.id) !== entry || error.name === "AbortError") return;
        entry.blocked = true;
        cameraLoading(entry, false);
        entry.notice.textContent = "Select Resume to enable this synchronized view.";
        entry.notice.hidden = false;
        entry.resume.hidden = false;
      }).finally(() => { entry.playPending = false; });
    }
  }
  function syncAll(force = false) { active.forEach(entry => syncEntry(entry, force)); }
  function stopTicker() { clearInterval(ticker); ticker = null; }
  function startTicker() {
    stopTicker();
    ticker = setInterval(() => syncAll(), 300);
  }
  function layoutPanels() {
    if (dragCancel) dragCancel();
    const entries = [...active.values()];
    // Split view shows the main and one explicitly selected auxiliary view.
    // Opening another view in split mode replaces the previous auxiliary view.
    stage.classList.toggle("is-split", split && entries.length > 0);
    entries.forEach((entry, index) => {
      entry.panel.style.left = "";
      entry.panel.style.right = "";
      entry.panel.style.top = `${2 + index * 32}%`;
      entry.panel.classList.remove("is-dragged");
      const ratio = Number(entry.video?.closest(".mv-video-viewport")?.dataset.ratio) || 16 / 9;
      entry.body.style.aspectRatio = String(ratio);
      const slotHeight = stage.clientHeight * (compact.matches ? 0.65 : 0.30);
      const panelWidth = Math.min(stage.clientWidth * (compact.matches ? 0.44 : 0.28), Math.max(40, slotHeight - entry.panel.querySelector(".mv-panel-header").offsetHeight - 2) * ratio);
      entry.panel.style.width = split ? "" : `${panelWidth}px`;
      if (entry.video) frameVideo(entry.video, entry.view);
    });
    if (scene) frameVideo(main, scene.main);
    control("split").disabled = entries.length === 0;
    control("split").setAttribute("aria-pressed", String(split));
    control("split").textContent = split ? "Picture-in-Picture" : "Split View";
  }
  function hideView(id, focusButton = false) {
    const entry = active.get(id);
    if (!entry) return;
    clearTimeout(entry.loadingTimer);
    if (dragCancel) dragCancel();
    if (entry.video) release(entry.video);
    entry.panel.remove();
    active.delete(id);
    const toggle = availableViews.get(id)?.button;
    toggle?.setAttribute("aria-pressed", "false");
    if (focusButton && !toggle?.disabled) toggle?.focus();
    if (!active.size) split = false;
    layoutPanels();
  }
  function installDrag(entry, handle) {
    handle.addEventListener("pointerdown", event => {
      if (split || compact.matches || event.button !== 0 || event.target.closest("button")) return;
      event.preventDefault();
      const bounds = stage.getBoundingClientRect();
      const start = entry.panel.getBoundingClientRect();
      const originX = event.clientX;
      const originY = event.clientY;
      handle.setPointerCapture(event.pointerId);
      const move = next => {
        const x = Math.max(0, Math.min(bounds.width - start.width, start.left - bounds.left + next.clientX - originX));
        const y = Math.max(0, Math.min(bounds.height - start.height, start.top - bounds.top + next.clientY - originY));
        entry.panel.style.left = `${x}px`;
        entry.panel.style.right = "auto";
        entry.panel.style.top = `${y}px`;
        entry.panel.classList.add("is-dragged");
      };
      const finish = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", finish);
        handle.removeEventListener("pointercancel", finish);
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        dragCancel = null;
        const a = entry.panel.getBoundingClientRect();
        const overlaps = [...active.values()].some(other => {
          if (other === entry) return false;
          const b = other.panel.getBoundingClientRect();
          return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        });
        if (overlaps) layoutPanels();
      };
      dragCancel = finish;
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", finish);
      handle.addEventListener("pointercancel", finish);
    });
  }

  function showView(view) {
    if (!dialog.open || main.readyState < 1 || failedViews.has(view.id)) return;
    if (active.has(view.id)) { hideView(view.id); return; }
    const preserveSplit = split;
    if (compact.matches || split) [...active.keys()].forEach(id => hideView(id));
    split = preserveSplit;
    if (active.size >= 3) hideView(active.keys().next().value);
    const panel = el("section", "mv-panel");
    panel.id = `mv-panel-${view.id}`;
    panel.setAttribute("aria-label", view.label);
    const head = el("div", "mv-panel-header");
    head.append(el("h3", "", view.label));
    const close = button("×", "mv-panel-close");
    close.setAttribute("aria-label", `Close ${view.label}`);
    head.append(close);
    panel.append(head);
    const body = el("div", "mv-panel-body");
    const entry = { view, panel, body, lastSeek: -Infinity, needsAlign: true, loadingTimer: null, blocked: false, playPending: false };
    if (view.type === "state") {
      entry.stateTitle = el("strong", "mv-state-title");
      entry.stateBody = el("p", "mv-state-body");
      body.append(entry.stateTitle, entry.stateBody);
      body.classList.add("mv-state");
    } else {
      entry.video = el("video", "mv-aux-video");
      silence(entry.video);
      entry.video.playsInline = true;
      entry.video.preload = "auto";
      entry.video.setAttribute("aria-label", view.label);
      entry.notice = el("p", "mv-view-notice", "Loading synchronized view…");
      entry.notice.hidden = true;
      entry.spinner = loadingSpinner();
      entry.spinner.hidden = false;
      body.setAttribute("aria-busy", "true");
      entry.resume = button("Resume", "mv-button mv-resume");
      entry.resume.hidden = true;
      entry.resume.setAttribute("aria-label", `Resume ${view.label}`);
      body.append(entry.video, entry.notice, entry.resume, entry.spinner);
      entry.video.addEventListener("loadedmetadata", () => { frameVideo(entry.video, view); layoutPanels(); syncEntry(entry, true); });
      // Resume immediately once an asynchronous load/seek completes; don't rely
      // solely on the periodic main-clock drift check to restart a camera.
      ["canplay", "playing", "seeked"].forEach(name => entry.video.addEventListener(name, () => { entry.waiting = false; syncEntry(entry); }));
      entry.video.addEventListener("seeking", () => cameraLoading(entry, true));
      entry.video.addEventListener("waiting", () => {
        entry.waiting = true;
        cameraLoading(entry, true);
      });
      entry.video.addEventListener("error", () => {
        if (active.get(view.id) !== entry) return;
        failedViews.add(view.id);
        const toggle = availableViews.get(view.id).button;
        toggle.disabled = true;
        toggle.title = "Camera resource could not be loaded";
        hideView(view.id);
        say(`${view.label} is unavailable. The main view remains available.`);
      });
      entry.resume.addEventListener("click", () => {
        entry.blocked = false;
        entry.resume.hidden = true;
        syncEntry(entry, true);
      });
    }
    panel.append(body);
    active.set(view.id, entry);
    layer.append(panel);
    availableViews.get(view.id).button.setAttribute("aria-pressed", "true");
    close.addEventListener("click", () => hideView(view.id, true));
    installDrag(entry, head);
    layoutPanels();
    if (entry.video) entry.video.src = urlFor(view);
    syncEntry(entry, true);
  }

  function renderEvents() {
    eventButtons = [];
    const track = $(".mv-event-track");
    const rail = $(".mv-event-rail");
    track.replaceChildren();
    rail.replaceChildren();
    const duration = main.duration;
    const events = (scene?.events || []).filter(event => Number.isFinite(event.time) && event.time >= 0 && event.time <= duration).sort((a, b) => a.time - b.time);
    $(".mv-timeline").hidden = events.length === 0;
    events.forEach(event => {
      const node = button(`${event.label} · ${clock(event.time)}`, "mv-event");
      node.title = `${event.label} — ${clock(event.time)}`;
      const marker = button("", "mv-event-marker");
      marker.title = node.title;
      marker.setAttribute("aria-label", node.title);
      marker.style.left = `${duration ? event.time / duration * 100 : 0}%`;
      const jump = () => { main.currentTime = event.time; syncAll(true); updateControls(); };
      node.addEventListener("click", jump);
      marker.addEventListener("click", jump);
      track.append(node);
      rail.append(marker);
      eventButtons.push({ ...event, node, marker });
    });
    updateControls();
  }

  function resetPlayer() {
    cancelBuffering();
    bufferBox.hidden = true;
    startingPlayback = false;
    previewWarning = "";
    mainPoster.hidden = true;
    mainPoster.removeAttribute("src");
    scrubbing = false;
    scrubWasPlaying = false;
    const pointer = scrubPointer;
    scrubPointer = null;
    if (pointer !== null && control("seek").hasPointerCapture(pointer)) control("seek").releasePointerCapture(pointer);
    session++;
    stopTicker();
    [...active.keys()].forEach(id => hideView(id));
    release(main);
    main.hidden = true;
    split = false;
    stalled = false;
    failedViews = new Set();
    availableViews.clear();
    viewButtons.replaceChildren();
    $(".mv-timeline").hidden = true;
    eventButtons = [];
    empty.hidden = false;
    setControls(false);
    layoutPanels();
  }
  function openScene(nextScene, origin) {
    const firstOpen = !dialog.open;
    resetPlayer();
    scene = nextScene;
    opener = origin;
    $("#mv-title").textContent = scene.title;
    $("#mv-description").textContent = scene.description;
    empty.querySelector("strong").textContent = "Experimental video forthcoming";
    empty.querySelector("p").textContent = "This scene is ready for the verified experimental recording.";
    main.muted = true;
    main.volume = 0;
    main.playbackRate = 1;
    control("speed").value = "1";
    const source = urlFor(scene.main);
    (scene.views || []).forEach(view => {
      const supplied = view.type === "state" ? view.available && Array.isArray(view.entries) && view.entries.length > 0 : !!urlFor(view);
      if (!supplied) return;
      const toggle = button(view.label);
      toggle.setAttribute("aria-pressed", "false");
      toggle.setAttribute("aria-controls", `mv-panel-${view.id}`);
      toggle.disabled = true;
      toggle.title = supplied && source ? "Load the main recording first" : "Verified resource not yet available";
      toggle.addEventListener("click", () => showView(view));
      availableViews.set(view.id, { view, button: toggle, supplied });
      viewButtons.append(toggle);
    });
    $(".mv-viewbar").hidden = availableViews.size === 0;
    $(".mv-hint").hidden = availableViews.size === 0;
    if (firstOpen) {
      wasHeroPlaying = !!hero && !hero.paused;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      dialog.showModal();
    }
    hero?.pause();
    say(source ? "Loading main view. Select Play when ready; auxiliary cameras remain hidden until selected." : "Video materials have not been added. Camera controls will become available with verified recordings.");
    if (source) {
      const poster = urlFor(scene.poster);
      if (poster) {
        mainPoster.src = poster;
        mainPoster.hidden = false;
      }
      empty.querySelector("strong").textContent = "Loading main view…";
      empty.hidden = true;
      main.src = source;
      main.preload = "auto";
      main.load();
      checkLocalPreview(source, session);
    }
    updateControls();
    $(".mv-close").focus();
  }

  main.addEventListener("loadedmetadata", () => {
    if (!dialog.open || !main.getAttribute("src")) return;
    main.hidden = false;
    empty.hidden = true;
    frameVideo(main, scene.main);
    setControls(true);
    bufferBox.hidden = true;
    availableViews.forEach(item => { item.button.disabled = !item.supplied; item.button.title = item.supplied ? "Toggle synchronized view" : "Verified resource not yet available"; });
    say(availableViews.size
      ? "Select Play. Auxiliary cameras load only when opened."
      : "Select Play. Drag the progress bar to seek.");
    renderEvents();
  });
  main.addEventListener("error", () => {
    if (!dialog.open || !main.getAttribute("src")) return;
    cancelBuffering();
    stopTicker();
    main.pause();
    main.hidden = true;
    mainPoster.hidden = true;
    empty.hidden = false;
    empty.querySelector("strong").textContent = "Main video unavailable";
    empty.querySelector("p").textContent = "The recording could not be loaded. Close and reopen this scene to retry.";
    [...active.keys()].forEach(id => hideView(id));
    availableViews.forEach(item => { item.button.disabled = true; });
    setControls(false);
    say("Check the configured file path and browser-compatible video encoding.");
  });
  main.addEventListener("play", () => {
    hero?.pause();
    active.forEach(entry => { entry.blocked = false; });
    syncAll(true);
    startTicker();
    updateControls();
  });
  main.addEventListener("playing", () => { stalled = false; mainPoster.hidden = true; syncAll(true); updateControls(); });
  main.addEventListener("canplay", updateControls);
  main.addEventListener("waiting", () => { stalled = true; active.forEach(entry => entry.video?.pause()); if (playbackWanted && !main.seeking) holdForBuffer(); updateControls(); });
  ["pause", "ended"].forEach(name => main.addEventListener(name, () => { stopTicker(); syncAll(true); updateControls(); }));
  main.addEventListener("seeking", () => { mainPoster.hidden = true; active.forEach(entry => { entry.needsAlign = true; entry.video?.pause(); }); updateControls(); });
  main.addEventListener("seeked", () => { stalled = false; syncAll(true); updateControls(); });
  main.addEventListener("ratechange", () => syncAll(true));
  main.addEventListener("timeupdate", () => { updateControls(); active.forEach(entry => { if (entry.view.type === "state") syncEntry(entry); }); });
  control("play").addEventListener("click", () => {
    if (playbackWanted || !main.paused && !main.ended) { cancelBuffering(); main.pause(); updateControls(); }
    else {
      active.forEach(entry => { entry.blocked = false; });
      requestBufferedPlayback();
    }
  });
  overlayPlay.addEventListener("click", () => control("play").click());
  stage.addEventListener("click", event => {
    // The centered button already invokes the shared action. Do not toggle a
    // second time when its click bubbles, or react to loading/error placeholders.
    if (event.target.closest("button,a,input,select,.mv-empty") || overlayPlay.disabled || main.hidden) return;
    if (!event.target.closest(".mv-main,.mv-panel-body:not(.mv-state)")) return;
    control("play").click();
  });
  function beginScrub() {
    if (scrubbing || control("seek").disabled) return;
    scrubbing = true;
    scrubTarget = Number(control("seek").value);
    scrubWasPlaying = playbackWanted || !main.paused && !main.ended;
    cancelBuffering();
    main.pause();
  }
  function finishScrub(cancelled = false) {
    if (!scrubbing) return;
    const target = scrubTarget;
    const resume = scrubWasPlaying;
    scrubbing = false;
    scrubWasPlaying = false;
    if (!cancelled && Number.isFinite(main.duration)) {
      main.currentTime = Math.max(0, Math.min(main.duration, target));
      syncAll(true);
    }
    updateControls();
    if (resume) requestBufferedPlayback();
  }
  const seekControl = control("seek");
  function pointerSeek(event) {
    const bounds = seekControl.getBoundingClientRect();
    // Match the thumb's inset at each end of the track, clamping outside drags.
    const inset = Math.min(8, bounds.width / 2);
    const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left - inset) / Math.max(1, bounds.width - inset * 2)));
    scrubTarget = fraction * Number(seekControl.max);
    seekControl.value = String(scrubTarget);
    updateControls();
  }
  seekControl.addEventListener("pointerdown", event => {
    if (seekControl.disabled || scrubPointer !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
    // Own pointer dragging rather than depending on the browser's native range
    // drag behavior. Capture keeps release working outside the narrow track.
    event.preventDefault();
    seekControl.focus({ preventScroll: true });
    beginScrub();
    scrubPointer = event.pointerId;
    seekControl.setPointerCapture(event.pointerId);
    pointerSeek(event);
  });
  seekControl.addEventListener("pointermove", event => {
    if (event.pointerId !== scrubPointer) return;
    event.preventDefault();
    pointerSeek(event);
  });
  function releaseScrub(event, cancelled = false) {
    if (event.pointerId !== scrubPointer) return;
    if (!cancelled) pointerSeek(event);
    const pointer = scrubPointer;
    scrubPointer = null;
    finishScrub(cancelled);
    if (seekControl.hasPointerCapture(pointer)) seekControl.releasePointerCapture(pointer);
  }
  seekControl.addEventListener("pointerup", event => releaseScrub(event));
  seekControl.addEventListener("pointercancel", event => releaseScrub(event, true));
  seekControl.addEventListener("lostpointercapture", event => {
    if (event.pointerId !== scrubPointer) return;
    scrubPointer = null;
    finishScrub();
  });
  control("seek").addEventListener("input", event => { beginScrub(); scrubTarget = Number(event.target.value); updateControls(); });
  control("seek").addEventListener("change", () => { if (scrubPointer === null) finishScrub(); });
  control("seek").addEventListener("blur", () => { if (scrubPointer === null) finishScrub(); });
  control("speed").addEventListener("change", event => { main.playbackRate = Number(event.target.value); });
  control("split").addEventListener("click", () => {
    const next = !split;
    if (next && active.size > 1) {
      const keep = [...active.keys()].at(-1);
      [...active.keys()].filter(id => id !== keep).forEach(id => hideView(id));
    }
    split = next;
    layoutPanels();
  });
  control("fullscreen").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (surface.requestFullscreen) await surface.requestFullscreen();
      else if (main.webkitEnterFullscreen) main.webkitEnterFullscreen();
      else say("Fullscreen is unavailable in this browser.");
    } catch { say("Fullscreen could not be opened. Try expanding the browser window."); }
  });
  function closePlayer() {
    if (dialog.open) dialog.close();
    if (!scene) return;
    resetPlayer();
    scene = null;
    document.body.style.overflow = previousOverflow;
    if (document.fullscreenElement === surface) document.exitFullscreen().catch(() => {});
    if (wasHeroPlaying && hero && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) hero.play().catch(() => {});
    if (opener?.isConnected) opener.focus();
  }
  $(".mv-close").addEventListener("click", closePlayer);
  dialog.addEventListener("cancel", event => { event.preventDefault(); closePlayer(); });
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const scope = document.fullscreenElement === surface ? surface : dialog;
    const focusable = [...scope.querySelectorAll("button,input,select,a[href],[tabindex]")]
      .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !scope.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !scope.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closePlayer();
  });
  dialog.addEventListener("close", () => {
    if (!dialog.open) closePlayer();
  });
  hero?.addEventListener("play", () => { if (dialog.open) hero.pause(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && dialog.open) { cancelBuffering(); main.pause(); updateControls(); } });
  const resize = () => {
    if (compact.matches && active.size > 1) [...active.keys()].slice(0, -1).forEach(id => hideView(id));
    layoutPanels();
  };
  compact.addEventListener("change", resize);
  const observer = new ResizeObserver(() => { if (dialog.open) resize(); });
  observer.observe(stage);

  config.scenes.forEach(item => {
    const card = el("article", "demo-card");
    card.dataset.sceneId = item.id;
    const media = el("div", "demo-media");
    const cover = button("", "demo-cover");
    cover.setAttribute("aria-label", `Open ${item.title}`);
    cover.setAttribute("aria-haspopup", "dialog");
    const poster = urlFor(item.poster);
    if (poster) {
      const image = el("img");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.src = poster;
      image.addEventListener("error", () => image.remove());
      cover.append(image);
    }
    const content = el("span", "demo-cover__content");
    const icon = el("span", "demo-cover__icon", "▶");
    icon.setAttribute("aria-hidden", "true");
    content.append(icon, el("span", "", urlFor(item.main) ? "Explore demonstration" : "Preview scene · Video forthcoming"));
    cover.append(content);
    cover.addEventListener("click", () => openScene(item, cover));
    media.append(cover);
    const copy = el("div", "demo-card__copy");
    copy.append(el("h3", "", item.title), el("p", "", item.description));
    card.append(media, copy);
    grid.append(card);
  });
  const pageSize = 4;
  const cards = [...grid.children];
  const pageCount = Math.ceil(cards.length / pageSize);
  if (pageCount > 1) {
    let currentPage = 0;
    const pager = el("nav", "demo-pagination");
    pager.setAttribute("aria-label", "Demonstration pages");
    const summary = el("div", "demo-pagination__summary");
    summary.append(el("span", "demo-pagination__eyebrow", "Demonstration Library"));
    const count = el("span", "demo-pagination__announcement");
    count.setAttribute("role", "status");
    count.setAttribute("aria-live", "polite");
    count.setAttribute("aria-atomic", "true");
    // Announce page changes accessibly without visible range/count copy.
    summary.append(count);
    const controls = el("div", "demo-pagination__controls");
    const previous = button("", "demo-page-arrow");
    previous.setAttribute("aria-label", "Previous demonstrations page");
    previous.innerHTML = '<span aria-hidden="true">←</span><span class="demo-page-arrow__text">Previous</span>';
    const next = button("", "demo-page-arrow");
    next.setAttribute("aria-label", "Next demonstrations page");
    next.innerHTML = '<span class="demo-page-arrow__text">Next</span><span aria-hidden="true">→</span>';
    const numbers = el("div", "demo-pagination__numbers");
    const pageButtons = Array.from({ length: pageCount }, (_, index) => {
      const node = button(String(index + 1).padStart(2, "0"), "demo-page-number");
      node.setAttribute("aria-label", `Demonstrations page ${index + 1}`);
      node.setAttribute("aria-controls", grid.id);
      node.addEventListener("click", () => selectPage(index, true));
      numbers.append(node);
      return node;
    });
    function selectPage(index, scroll = false) {
      if (index < 0 || index >= pageCount) return;
      const changed = index !== currentPage;
      currentPage = index;
      cards.forEach((card, position) => { card.hidden = Math.floor(position / pageSize) !== index; });
      pageButtons.forEach((node, position) => {
        if (position === index) node.setAttribute("aria-current", "page");
        else node.removeAttribute("aria-current");
      });
      previous.disabled = index === 0;
      next.disabled = index === pageCount - 1;
      count.textContent = `Page ${index + 1} of ${pageCount}`;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (changed && !reduceMotion) grid.animate([{ opacity: 0.45, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 220, easing: "ease-out" });
      if (scroll && changed && grid.getBoundingClientRect().top < 0) grid.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "start" });
    }
    previous.addEventListener("click", () => selectPage(currentPage - 1, true));
    next.addEventListener("click", () => selectPage(currentPage + 1, true));
    controls.append(previous, numbers, next);
    pager.append(summary, controls);
    grid.after(pager);
    selectPage(0);
  }
  const supplementary = urlFor(config.supplementary);
  if (supplementary) {
    const link = document.querySelector("[data-supplementary-link]");
    link.href = supplementary;
    link.hidden = false;
    link.parentElement.hidden = false;
  }
  setControls(false);
});
