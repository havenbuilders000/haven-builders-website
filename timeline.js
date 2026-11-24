/**
 * Haven Builders — Scroll-Pinned Construction Timeline (Hero)
 *
 * How it works
 * - The hero section (#home) is a tall "track". Inside it, .hero-sticky-viewport is
 *   position: sticky, so it stays pinned to the screen while the track scrolls past.
 * - Native scrolling drives everything (mouse wheel, trackpad, touch, keyboard,
 *   scrollbar). Nothing hijacks or blocks scrolling, so the user is never trapped.
 * - Scroll progress through the track is mapped to:
 *     0.00 → ANIM_END : frames 1 → 280 (the full construction story)
 *     ANIM_END → 1.00 : hold on frame 280 with the final stage text + completion cue
 *   Only after that hold does the track end and the next section scroll in.
 * - The active stage (card, pill, labels) is derived from the frame being shown,
 *   so images and text can never disagree.
 * - Rendering is on demand (one rAF per scroll/resize/frame-load), not a forever loop.
 */
(function () {
    'use strict';

    // ---------------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------------
    const TOTAL_FRAMES = 280;
    // Optimised WebP frames: 1600px for large screens, 960px for phones/tablets.
    // The original PNGs stay as a fallback if a WebP frame can't be loaded.
    // Pick the smallest frame set that still covers the screen at full sharpness.
    // The canvas is drawn "cover", so on tall/portrait screens the 16:9 frames are
    // scaled by height — measure the pixels actually needed, not just the width.
    const SMALL_SCREEN = window.matchMedia('(max-width: 900px)').matches;
    const NEED_PX = (() => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(window.innerWidth, document.documentElement.clientWidth || 0) * dpr;
        const h = Math.max(window.innerHeight, window.screen ? Math.min(window.screen.height, window.innerHeight * 1.25) : 0) * dpr;
        return Math.max(w, h * 16 / 9);
    })();
    // phones cap at the 1600px set to keep mobile data reasonable
    // live site: 1280px set for phones/small laptops, 1600px set for everything larger
    // Portrait phones/tablets only ever show the middle of the 16:9 film, so they get a
    // pre-cropped 750x900 WebP set: half the pixels to decode, which keeps scrolling smooth.
    const PORTRAIT = (window.innerWidth / Math.max(1, window.innerHeight)) < 0.85 && window.innerWidth <= 1024;
    // Portrait phones now see the WHOLE 16:9 scene, like desktop: the film is fitted to the
    // screen width and the space above/below is filled with a soft, blurred copy of the frame.
    const FIT_WIDTH = PORTRAIT;
    const FIT_FILL = 1.0;      // 1 = full scene width; >1 crops the sides a little
    const SCENE_Y = 0.47;      // vertical centre of the scene on portrait screens (fraction of height)
    const SET = PORTRAIT ? 'w' : (NEED_PX <= 1350 ? 'm' : 'd');
    // AVIF frames are ~45% lighter than WebP at the same look; browsers without AVIF get WebP.
    const AVIF_OK = (() => {
        try {
            const c = document.createElement('canvas');
            return c.toDataURL && c.toDataURL('image/avif').indexOf('data:image/avif') === 0;
        } catch (e) { return false; }
    })() || /Chrome\/(8[5-9]|9\d|1\d\d)|Firefox\/(9[3-9]|1\d\d)|Version\/(1[6-9]|2\d).*Safari/.test(navigator.userAgent);
    // (the largest 1920px set stays WebP; AVIF is used for the phone/laptop sets)
    const USE_AVIF = AVIF_OK && !PORTRAIT;
    // Only the light WebP set is published as a fallback for the rare browser without AVIF.
    let IMAGE_FOLDER = PORTRAIT ? 'frames/w/' : (USE_AVIF ? `frames/a${SET}/` : `frames/m/`);
    let IMAGE_EXT = USE_AVIF ? '.avif' : '.webp';
    const WEBP_URL = (i) => `frames/m/f-${String(i).padStart(3, '0')}.webp`;
    const IMAGE_PREFIX = 'f-';
    const FALLBACK_URL = (i) => `Hero%20section/Images/ezgif-frame-${String(i).padStart(3, '0')}.png`;

    // Portion of the pinned track that plays frames; the rest is a hold on the final frame.
    const ANIM_END = 0.9;
    // Smoothness & camera
    const REDUCED_MOTION = window.matchMedia('(max-width: 0px)').matches;
    const SMOOTHING_MS = 85;      // easing time constant for scroll-follow
    const CAMERA_ZOOM = REDUCED_MOTION ? 0 : 0.06;   // slow push-in over the timeline
    const CAMERA_DRIFT = REDUCED_MOTION ? 0 : 0.012; // slight upward drift (fraction of height)
    // Intro overlay fades out / HUD fades in over this early portion of the track.
    const INTRO_FADE_END = 0.05;
    const HUD_FADE_START = 0.02;
    const HUD_FADE_END = 0.06;

    const STAGES = [
        { stage: 1, phaseNumber: '01 / 06', startFrame: 1,   endFrame: 45,  label: 'Phase 1: Deep Substructure & Footings' },
        { stage: 2, phaseNumber: '02 / 06', startFrame: 46,  endFrame: 95,  label: 'Phase 2: Columns, Slabs & Monolithic Core' },
        { stage: 3, phaseNumber: '03 / 06', startFrame: 96,  endFrame: 140, label: 'Phase 3: Interlocking Blocks & Walls' },
        { stage: 4, phaseNumber: '04 / 06', startFrame: 141, endFrame: 185, label: 'Phase 4: Roof Deck & Water Barrier' },
        { stage: 5, phaseNumber: '05 / 06', startFrame: 186, endFrame: 235, label: 'Phase 5: Low-E Glass & Exterior Enclosure' },
        { stage: 6, phaseNumber: '06 / 06', startFrame: 236, endFrame: 280, label: 'Phase 6: Artisan Detailing & Handover' }
    ];

    // Lighter loading on small screens / data-saver connections.
    const conn = navigator.connection || {};
    const IS_CONSTRAINED = !!conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || '') ||
        window.matchMedia('(max-width: 768px)').matches;
    const MAX_CONCURRENT = IS_CONSTRAINED ? 4 : 6;
    // On constrained devices only every 2nd frame is fetched (the sequence contains many
    // near-duplicate pairs, so this is visually indistinguishable but halves the download).
    const FRAME_STRIDE = IS_CONSTRAINED ? 2 : 1;

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const pad3 = (n) => String(n).padStart(3, '0');
    const frameUrl = (i) => `${IMAGE_FOLDER}${IMAGE_PREFIX}${pad3(i)}${IMAGE_EXT}`;

    function frameFromProgress(progress) {
        const t = clamp(progress / ANIM_END, 0, 1);
        return clamp(Math.round(t * (TOTAL_FRAMES - 1)) + 1, 1, TOTAL_FRAMES);
    }

    function progressFromFrame(frame) {
        return ((clamp(frame, 1, TOTAL_FRAMES) - 1) / (TOTAL_FRAMES - 1)) * ANIM_END;
    }

    function stageForFrame(frame) {
        for (let i = 0; i < STAGES.length; i++) {
            if (frame <= STAGES[i].endFrame) return STAGES[i];
        }
        return STAGES[STAGES.length - 1];
    }

    // ---------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------
    const frames = new Array(TOTAL_FRAMES + 1);          // 1-indexed HTMLImageElements
    const status = new Int8Array(TOTAL_FRAMES + 1);      // 0 idle, 2 queued/loading, 1 ready, -1 error
    let readyCount = 0;
    let errorCount = 0;
    let requestedTotal = 0;

    let trackEl, viewportEl, canvasEl, ctx;
    let introOverlay, hudOverlay, milestoneCards = [], stagePills = [];
    let trackFill, trackThumb, frameLabel, stageCounterLabel, progressPctEl, stageInfoEl;
    let stickyViewportEl;
    let bufferIndicator, bufferLabel, bufferMiniFill, consoleTrack, completionCue, bottomConsole;

    // Cached layout metrics (refreshed on resize only — no layout reads during scroll)
    let trackTop = 0;
    let scrollRange = 1;

    let progress = 0;
    let currentFrame = 1;
    let currentStage = 0;
    let lastDrawnImg = null;
    let lastIntroState = '';
    let lastHudState = '';
    let lastCueState = null;
    let lastPct = -1;
    let lastTrackW = '';
    let lastLabelFrame = -1;
    let lastPinned = null;
    let rafPending = false;
    let isScrubbing = false;

    // ---------------------------------------------------------------------
    // Preloading (coarse-to-fine, with urgent lane for frames near the playhead)
    // ---------------------------------------------------------------------
    const backgroundQueue = [];
    const urgentQueue = [];
    let active = 0;

    let fineUnlocked = false;
    function unlockFine() {
        if (fineUnlocked) return;
        fineUnlocked = true;
        buildBackgroundQueue();
        pump();
    }
    function buildBackgroundQueue() {
        // Before the visitor engages, fetch only a light preview set (every 8th frame);
        // the full sequence streams in once they scroll / interact, or when the browser is idle.
        // Preview pass (every 16th frame) so any position can be shown roughly at once,
        // then every frame IN ORDER so the film fills in from the start, like a video buffer.
        const want = [];
        for (let i = 1; i <= TOTAL_FRAMES; i += Math.max(16, FRAME_STRIDE)) want.push(i);
        if (fineUnlocked) for (let i = 1; i <= TOTAL_FRAMES; i += FRAME_STRIDE) want.push(i);
        backgroundQueue.length = 0;
        for (const i of want) if (status[i] === 0 && backgroundQueue.indexOf(i) === -1) backgroundQueue.push(i);
        if (backgroundQueue.indexOf(TOTAL_FRAMES) === -1 && status[TOTAL_FRAMES] === 0) {
            backgroundQueue.splice(1, 0, TOTAL_FRAMES);
        }
        requestedTotal = backgroundQueue.length + (status[1] ? 1 : 0);
    }

    let contig = 0;          // every frame 1..contig (by stride) is ready
    function advanceContig() {
        const before = contig;
        let next = contig === 0 ? 1 : contig + FRAME_STRIDE;
        while (next <= TOTAL_FRAMES && status[next] !== 0 && status[next] !== 2) { contig = next; next += FRAME_STRIDE; }
        if (contig + FRAME_STRIDE > TOTAL_FRAMES) contig = TOTAL_FRAMES;   // stride grid may stop short of the last frame
        return contig !== before;
    }
    function filmReadyTo() { return contig; }

    let lastDir = 1;
    function prioritizeAround(frame) {
        const AHEAD = 24 * FRAME_STRIDE, BEHIND = 4 * FRAME_STRIDE;
        urgentQueue.length = 0;
        for (let d = 0; d <= AHEAD; d += FRAME_STRIDE) {
            const a = frame + d * lastDir;
            if (a >= 1 && a <= TOTAL_FRAMES && status[a] === 0) urgentQueue.push(a);
            if (d && d <= BEHIND) {
                const b = frame - d * lastDir;
                if (b >= 1 && b <= TOTAL_FRAMES && status[b] === 0) urgentQueue.push(b);
            }
        }
        pump();
        refreshBitmaps(frame);
    }

    function pump() {
        while (active < MAX_CONCURRENT) {
            let idx;
            while (urgentQueue.length && status[urgentQueue[0]] !== 0) urgentQueue.shift();
            if (urgentQueue.length) {
                idx = urgentQueue.shift();
            } else {
                while (backgroundQueue.length && status[backgroundQueue[0]] !== 0) backgroundQueue.shift();
                if (!backgroundQueue.length) return;
                idx = backgroundQueue.shift();
            }
            load(idx);
        }
    }

    function load(idx, onReady) {
        status[idx] = 2;
        active++;
        const img = new Image();
        img.decoding = 'async';
        img.src = frameUrl(idx);

        const done = (ok) => {
            active--;
            if (ok) {
                frames[idx] = img;
                status[idx] = 1;
                readyCount++;
                updateBuffer();
                if (BMP_OK) bmpPump();
                // Redraw if this frame is a better match for what should be on screen.
                if (advanceContig() || Math.abs(idx - currentFrame) <= 6 * FRAME_STRIDE) scheduleRender(true);
            } else {
                status[idx] = -1;
                errorCount++;
                updateBuffer();
            }
            if (onReady) onReady(ok);
            pump();
        };

        // Ready as soon as the image has loaded; decode() only warms it up and is never
        // waited on (some browsers leave decode() pending in throttled/background windows).
        let settled = false;
        const finish = (ok) => { if (settled) return; settled = true; done(ok); };
        const tryFallback = () => {
            if (IMAGE_EXT === '.avif' && !img.dataset.webp) {
                img.dataset.webp = '1';
                IMAGE_FOLDER = `frames/m/`; IMAGE_EXT = '.webp';   // AVIF not supported here: switch to WebP
                img.src = WEBP_URL(idx);
            } else if (!img.dataset.fallback) {
                img.dataset.fallback = '1';
                img.src = FALLBACK_URL(idx);
            } else finish(false);
        };
        img.onload = () => {
            if (img.naturalWidth > 0) {
                if (typeof img.decode === 'function') img.decode().catch(() => {});
                finish(true);
            } else tryFallback();
        };
        img.onerror = tryFallback;
        if (img.complete && img.naturalWidth > 0) img.onload();
    }

    function updateBuffer() {
        if (!bufferIndicator) return;
        const settled = readyCount + errorCount;
        const pct = Math.min(100, Math.round((settled / Math.max(1, requestedTotal)) * 100));
        if (bufferMiniFill) bufferMiniFill.style.width = `${pct}%`;
        if (bufferLabel) bufferLabel.textContent = `Frames Cached: ${pct}%`;
        if (pct >= 100) bufferIndicator.classList.add('buffer-complete');
    }


    // Nearest loaded frame (searches outward) so the canvas never goes blank.
    function bestFrameFor(target) {
        if (status[target] === 1) return frames[target];
        for (let d = 1; d < TOTAL_FRAMES; d++) {
            const lo = target - d;
            const hi = target + d;
            if (lo >= 1 && status[lo] === 1) return frames[lo];
            if (hi <= TOTAL_FRAMES && status[hi] === 1) return frames[hi];
        }
        return null;
    }

    // ---------------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------------
    // Nearest loaded frame at/below and at/above an index (bounded search)
    function loadedBelow(i) {
        for (let k = Math.min(i, TOTAL_FRAMES); k >= Math.max(1, i - 12); k--) if (status[k] === 1) return k;
        return 0;
    }
    function loadedAbove(i) {
        for (let k = Math.max(i, 1); k <= Math.min(TOTAL_FRAMES, i + 12); k++) if (status[k] === 1) return k;
        return 0;
    }

    // (decoded-bitmap cache removed: createImageBitmap from <img> decodes on the main
    //  thread in Chrome and caused dropped frames; img.decode() at load is enough)
    // Decoded-bitmap window: frames near the playhead are decoded OFF the main thread
    // (createImageBitmap from the file data) so scrubbing never stalls on image decoding.
    // Only a small window is kept in memory; everything else stays compressed.
    const BMP_OK = typeof createImageBitmap === 'function' && typeof fetch === 'function' && typeof Map === 'function';
    const LOW_MEM = (navigator.deviceMemory || 8) <= 3;
    const BMP_AHEAD = (LOW_MEM ? 22 : 36) * FRAME_STRIDE, BMP_BEHIND = 8 * FRAME_STRIDE;
    const BMP_PAR = (navigator.hardwareConcurrency || 4) >= 6 ? 3 : 2;
    const bitmaps = new Map();
    const bmpPending = new Set();
    let bmpActive = 0, bmpCenter = 1, bmpDir = 1, bmpGen = 0;
    function bmpWanted(i) {
        return bmpDir >= 0 ? (i >= bmpCenter - BMP_BEHIND && i <= bmpCenter + BMP_AHEAD)
                           : (i <= bmpCenter + BMP_BEHIND && i >= bmpCenter - BMP_AHEAD);
    }
    function refreshBitmaps(center) {
        if (!BMP_OK) return;
        if (center && center !== bmpCenter) { bmpDir = center > bmpCenter ? 1 : -1; bmpCenter = center; }
        for (const [i, b] of bitmaps) if (!bmpWanted(i)) { if (b.close) b.close(); bitmaps.delete(i); }
        bmpPump();
    }
    function clearBitmaps() {
        bmpGen++;
        for (const b of bitmaps.values()) if (b.close) b.close();
        bitmaps.clear();
    }
    function bmpPump() {
        while (bmpActive < BMP_PAR) {
            let pick = 0;
            for (let d = 0; d <= BMP_AHEAD && !pick; d++) {
                const cand = d === 0 ? [bmpCenter] : [bmpCenter + d * bmpDir, bmpCenter - d * bmpDir];
                for (const i of cand) {
                    if (i >= 1 && i <= TOTAL_FRAMES && status[i] === 1 && !bitmaps.has(i) && !bmpPending.has(i) && bmpWanted(i)) { pick = i; break; }
                }
            }
            if (!pick) return;
            decodeBitmap(pick);
        }
    }
    function decodeBitmap(i) {
        const img = frames[i];
        if (!img) return;
        bmpActive++; bmpPending.add(i);
        const gen = bmpGen;
        const tw = canvasEl ? canvasEl.width : 0, th = canvasEl ? canvasEl.height : 0;
        fetch(img.currentSrc || img.src)
            .then((r) => r.blob())
            .then((blob) => {
                const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
                const s = Math.min(1, fitScale(iw, ih, tw, th) * (1 + CAMERA_ZOOM));
                return (s < 0.95 && tw && th)
                    ? createImageBitmap(blob, { resizeWidth: Math.round(iw * s), resizeHeight: Math.round(ih * s), resizeQuality: 'medium' })
                    : createImageBitmap(blob);
            })
            .then((bmp) => {
                if (gen !== bmpGen || !bmpWanted(i)) { if (bmp.close) bmp.close(); return; }
                bitmaps.set(i, bmp);
                if (Math.abs(i - currentFrame) <= 6 * FRAME_STRIDE) scheduleRender(true);
            })
            .catch(() => {})
            .then(() => { bmpActive--; bmpPending.delete(i); bmpPump(); });
    }
    function paintable(idx) { return bitmaps.get(idx) || frames[idx]; }
    // nearest DECODED frames around a position (falls back to plain loaded frames when none yet)
    function decodedBelow(i) {
        for (let k = Math.min(i, TOTAL_FRAMES); k >= Math.max(1, i - 12 * FRAME_STRIDE); k--) if (bitmaps.has(k)) return k;
        return 0;
    }
    function decodedAbove(i) {
        for (let k = Math.max(i, 1); k <= Math.min(TOTAL_FRAMES, i + 12 * FRAME_STRIDE); k++) if (bitmaps.has(k)) return k;
        return 0;
    }

    // cover on landscape screens; full-width "contain" on portrait phones
    function fitScale(iw, ih, cw, ch) {
        return FIT_WIDTH ? (cw / iw) * FIT_FILL : Math.max(cw / iw, ch / ih);
    }

    // Portrait backdrop: a tiny (96x54) canvas behind the film, pre-blurred and darkened,
    // stretched to full screen by CSS. The GPU does the scaling, so it costs almost nothing.
    let bdCv = null, bdCx = null, bdLast = -99;
    function setupBackdrop() {
        const wrap = canvasEl.parentElement;
        if (!wrap) return;
        wrap.classList.add('hero-fitw');
        bdCv = document.createElement('canvas');
        bdCv.width = 96; bdCv.height = 54;
        bdCv.className = 'hero-backdrop';
        bdCv.setAttribute('aria-hidden', 'true');
        wrap.insertBefore(bdCv, canvasEl);
        bdCx = bdCv.getContext('2d', { alpha: false });
        if (bdCx) {
            bdCx.imageSmoothingEnabled = true;
            bdCx.imageSmoothingQuality = 'medium';
            if ('filter' in bdCx) bdCx.filter = 'blur(4px)';
        }
    }
    // Refreshed outside the paint frame (and at most ~6x a second): the blur hides small changes.
    let bdTimer = 0, bdWant = null, bdWantIdx = 0;
    function drawBackdrop(img, idx) {
        if (!bdCx || Math.abs(idx - bdLast) < 3 * FRAME_STRIDE) return;
        bdWant = img; bdWantIdx = idx;
        if (bdTimer) return;
        bdTimer = setTimeout(() => {
            bdTimer = 0;
            if (!bdWant) return;
            bdLast = bdWantIdx;
            bdCx.globalAlpha = 1;
            // the decoded bitmap may have been released meanwhile: use whatever is current
            const src = bitmaps.get(bdWantIdx) || frames[bdWantIdx];
            try { if (src) bdCx.drawImage(src, -8, -5, 112, 64); } catch (e) { bdLast = -99; }
            bdCx.fillStyle = 'rgba(12, 11, 10, 0.55)';
            bdCx.fillRect(0, 0, 96, 54);
            bdWant = null;
        }, bdLast < 0 ? 0 : 160);
    }
    // soft top/bottom edges so the film melts into the backdrop (two thin strips, cheap)
    let edgeTop = null, edgeBot = null, edgeH = 0;
    function drawSceneEdges() {
        const cw = canvasEl.width, ch = canvasEl.height;
        const f = Math.max(6, Math.round(ch * 0.08));
        if (f !== edgeH) {
            edgeH = f;
            edgeTop = ctx.createLinearGradient(0, 0, 0, f);
            edgeTop.addColorStop(0, 'rgba(12,11,10,0.7)'); edgeTop.addColorStop(1, 'rgba(12,11,10,0)');
            edgeBot = ctx.createLinearGradient(0, ch - f, 0, ch);
            edgeBot.addColorStop(0, 'rgba(12,11,10,0)'); edgeBot.addColorStop(1, 'rgba(12,11,10,0.7)');
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = edgeTop; ctx.fillRect(0, 0, cw, f);
        ctx.fillStyle = edgeBot; ctx.fillRect(0, ch - f, cw, f);
    }

    function drawCover(img, alpha, zoom, driftY) {
        const cw = canvasEl.width;
        const ch = canvasEl.height;
        const iw = img.naturalWidth || img.width || 1920;
        const ih = img.naturalHeight || img.height || 1080;
        const scale = fitScale(iw, ih, cw, ch) * zoom;   // fit + camera zoom
        const dw = iw * scale;
        const dh = ih * scale;
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2 + driftY, dw, dh);
    }

    /**
     * Optical-flow style rendering: the exact (fractional) frame position is drawn as a
     * blend of the two neighbouring frames, so motion flows continuously between the
     * source frames instead of stepping. A slow camera push-in adds depth.
     */
    let lastDrawKey = '';
    function drawFrame(force) {
        if (!ctx) return;
        const cw = canvasEl.width;
        const ch = canvasEl.height;
        if (!cw || !ch) return;

        const animT = clamp(progress / ANIM_END, 0, 1);
        let exact = 1 + animT * (TOTAL_FRAMES - 1);
        const fl = Math.floor(exact);
        if (contig && exact > contig && status[fl] !== 1) {
            // target region not downloaded yet — show the furthest continuous frame instead of skipping
            const lb = loadedBelow(fl), la = loadedAbove(Math.ceil(exact));
            if (!(lb && la && la - lb <= 2 * FRAME_STRIDE)) exact = contig;
        }
        const zoom = 1 + CAMERA_ZOOM * animT;
        const driftY = -CAMERA_DRIFT * animT * ch;

        let lo = loadedBelow(Math.floor(exact));
        let hi = loadedAbove(Math.ceil(exact));
        if (BMP_OK) {
            // Only ever paint frames that are already decoded, so drawing never blocks the page.
            // If the playhead is ahead of the decoder, keep the current picture for a moment
            // while it catches up (it is already working on this position).
            const dlo = decodedBelow(Math.floor(exact)), dhi = decodedAbove(Math.ceil(exact));
            if (dlo || dhi) { lo = dlo; hi = dhi; }
            else if (lastDrawnImg) { refreshBitmaps(Math.round(exact)); return; }
        }
        let t = 0;
        if (lo && hi && hi !== lo) {
            t = clamp((exact - lo) / (hi - lo), 0, 1);
        } else if (!lo && !hi) {
            const fallback = bestFrameFor(currentFrame);
            if (!fallback) return;
            lo = frames.indexOf(fallback);
        } else {
            lo = lo || hi;
        }

        const key = `${lo}|${hi}|${t.toFixed(3)}|${zoom.toFixed(4)}|${cw}x${ch}`;
        if (!force && key === lastDrawKey) return;
        lastDrawKey = key;

        window.__hbShown = lo;
        if (FIT_WIDTH) drawBackdrop(paintable(lo), lo);
        drawCover(paintable(lo), 1, zoom, driftY);
        if (hi && hi !== lo && t > 0.004) {
            drawCover(paintable(hi), t, zoom, driftY);
        }
        if (FIT_WIDTH) drawSceneEdges();
        ctx.globalAlpha = 1;
        lastDrawnImg = frames[t >= 0.5 && hi ? hi : lo];
    }

    function setOverlay(el, opacity, interactiveThreshold) {
        el.style.opacity = opacity.toFixed(3);
        el.style.visibility = opacity <= 0.001 ? 'hidden' : 'visible';
        el.style.pointerEvents = opacity >= interactiveThreshold ? 'auto' : 'none';
    }

    function updateHUD() {
        // Intro overlay: fully visible at top, fades & lifts away early in the track.
        if (introOverlay) {
            const o = 1 - clamp(progress / INTRO_FADE_END, 0, 1);
            const key = o.toFixed(3);
            if (key !== lastIntroState) {
                lastIntroState = key;
                setOverlay(introOverlay, o, 0.5);
                introOverlay.style.transform = `translate3d(0, ${(-(1 - o) * 40).toFixed(1)}px, 0)`;
            }
        }

        // HUD overlay fades in as the intro leaves.
        if (hudOverlay) {
            const o = clamp((progress - HUD_FADE_START) / (HUD_FADE_END - HUD_FADE_START), 0, 1);
            const key = o.toFixed(3);
            if (key !== lastHudState) {
                lastHudState = key;
                setOverlay(hudOverlay, o, 0.5);
                hudOverlay.setAttribute('aria-hidden', o < 0.5 ? 'true' : 'false');
            }
        }

        // Construction completion is frame-based: 100% exactly when frame 280 is shown.
        const animT = clamp(progress / ANIM_END, 0, 1);
        const pct = Math.round(animT * 100);
        if (pct !== lastPct) {
            lastPct = pct;
            if (progressPctEl) progressPctEl.textContent = `${pct}% COMPLETE`;
            if (consoleTrack) {
                consoleTrack.setAttribute('aria-valuenow', String(pct));
                consoleTrack.setAttribute('aria-valuetext', `${pct}% complete, ${stageForFrame(currentFrame).label}`);
            }
        }
        const w = `${(animT * 100).toFixed(1)}%`;
        if (w !== lastTrackW) {
            lastTrackW = w;
            if (trackFill) trackFill.style.width = w;
            if (trackThumb) trackThumb.style.left = w;
        }
        if (currentFrame !== lastLabelFrame) {
            lastLabelFrame = currentFrame;
            if (frameLabel) frameLabel.textContent = `FRAME ${pad3(currentFrame)} / ${TOTAL_FRAMES}`;
        }

        // Stage: derived from the frame on screen, so text and image always match.
        const stage = stageForFrame(currentFrame);
        if (stage.stage !== currentStage) {
            currentStage = stage.stage;
            for (const card of milestoneCards) {
                const on = Number(card.dataset.stage) === currentStage;
                card.classList.toggle('active', on);
                card.setAttribute('aria-hidden', on ? 'false' : 'true');
            }
            for (const pill of stagePills) {
                const on = Number(pill.dataset.stageTarget) === currentStage;
                pill.classList.toggle('active', on);
                pill.setAttribute('aria-current', on ? 'step' : 'false');
            }
            if (stageCounterLabel) stageCounterLabel.textContent = `STAGE ${stage.phaseNumber}`;
            if (stageInfoEl) stageInfoEl.textContent = stage.label;
        }

        // While the timeline is on screen, floating buttons would cover the console.
        const pinned = window.scrollY < trackTop + scrollRange;
        if (pinned !== lastPinned) {
            lastPinned = pinned;
            document.documentElement.classList.toggle('hero-pinned', pinned);
        }

        // Completion cue only once the final frame is on screen.
        const complete = currentFrame >= TOTAL_FRAMES && progress >= ANIM_END;
        if (complete !== lastCueState) {
            lastCueState = complete;
            if (completionCue) completionCue.classList.toggle('visible', complete);
            if (stickyViewportEl) stickyViewportEl.classList.toggle('hero-final-on', complete);
        }
    }

    // Eased progress: the picture glides toward the scroll position (critically damped),
    // which smooths out mouse-wheel steps while staying locked to the scrollbar.
    let lastTs = 0;
    let firstRender = true;
    function render(ts) {
        rafPending = false;
        const pending = forceDrawPending;
        forceDrawPending = false;

        const target = readProgress();
        const dt = lastTs ? Math.min(64, ts - lastTs) : 16;
        lastTs = ts;

        if (firstRender || REDUCED_MOTION || isScrubbing) {
            progress = target;
            firstRender = false;
        } else {
            const k = 1 - Math.exp(-dt / SMOOTHING_MS);
            progress += (target - progress) * k;
            if (Math.abs(target - progress) < 0.00002) progress = target;
        }

        const frame = frameFromProgress(progress);
        if (frame !== currentFrame) {
            lastDir = frame > currentFrame ? 1 : -1;
            currentFrame = frame;
            prioritizeAround(frame);
        }
        drawFrame(pending);
        updateHUD();

        // keep gliding until we've caught up with the scroll position
        if (progress !== target) {
            rafPending = true;
            requestAnimationFrame(render);
        } else {
            lastTs = 0;
        }
    }

    let forceDrawPending = false;
    function scheduleRender(forceDraw) {
        if (forceDraw) forceDrawPending = true;
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(render);
    }

    // ---------------------------------------------------------------------
    // Layout / scroll metrics
    // ---------------------------------------------------------------------
    function measure() {
        const rect = trackEl.getBoundingClientRect();
        trackTop = rect.top + window.scrollY;
        const vpH = viewportEl ? viewportEl.offsetHeight : window.innerHeight;
        scrollRange = Math.max(1, trackEl.offsetHeight - vpH);
    }

    function readProgress() {
        return clamp((window.scrollY - trackTop) / scrollRange, 0, 1);
    }

    function scrollToProgress(p, smooth) {
        const y = Math.round(trackTop + clamp(p, 0, 1) * scrollRange);
        if (smooth) {
            window.scrollTo({ top: y, behavior: 'smooth' });
        } else {
            window.scrollTo(0, y);
        }
    }

    function resizeCanvas() {
        const w = viewportEl.clientWidth;
        // portrait: the film canvas is only the 16:9 scene strip (CSS places it)
        const h = FIT_WIDTH ? Math.round(w * FIT_FILL * 9 / 16) : viewportEl.clientHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let tw = Math.round(w * dpr);
        let th = Math.round(h * dpr);
        // Cap to what the frames can actually show (cover-fit + camera zoom); anything larger
        // just costs fill-rate on every frame without adding detail.
        const srcW = ({ p: 750, w: 960, m: 1280, d: 1600, h: 1920 })[SET] || 1920;
        const srcH = SET === 'p' ? 900 : Math.round(srcW * 9 / 16);
        const need = FIT_WIDTH ? (tw * FIT_FILL / srcW) : Math.max(tw / srcW, th / srcH);       // how much the frame is upscaled
        if (need > 1.12) { const f = 1.12 / need; tw = Math.round(tw * f); th = Math.round(th * f); }
        if (canvasEl.width !== tw || canvasEl.height !== th) {
            const grew = tw > canvasEl.width * 1.05 || th > canvasEl.height * 1.05;
            canvasEl.width = tw;
            canvasEl.height = th;
            if (grew && BMP_OK) { clearBitmaps(); bmpPump(); }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'medium';
            lastDrawnImg = null;
            edgeH = 0;
        }
    }

    function updateConsoleVar() {
        if (bottomConsole && viewportEl) {
            viewportEl.style.setProperty('--hud-console-h', `${bottomConsole.offsetHeight}px`);
        }
    }

    let resizeRaf = 0;
    function onResize() {
        if (resizeRaf) return;
        resizeRaf = requestAnimationFrame(() => {
            resizeRaf = 0;
            measure();
            resizeCanvas();
            updateConsoleVar();
            scheduleRender(true);
        });
    }

    // ---------------------------------------------------------------------
    // Controls: stage pills, scrubber (pointer + keyboard)
    // ---------------------------------------------------------------------
    function goToStage(stageNum) {
        const s = STAGES.find((x) => x.stage === stageNum);
        if (!s) return;
        // Land a little inside the stage so its card is clearly active.
        const frame = s.startFrame + Math.round((s.endFrame - s.startFrame) * 0.15);
        let p = progressFromFrame(frame);
        if (stageNum === 1) p = Math.max(p, HUD_FADE_END + 0.01);
        prioritizeAround(frame);
        scrollToProgress(p, true);
    }

    function setupScrubber() {
        if (!consoleTrack) return;

        const seek = (clientX) => {
            const r = consoleTrack.getBoundingClientRect();
            const t = clamp((clientX - r.left) / r.width, 0, 1);
            const p = Math.max(t * ANIM_END, HUD_FADE_END);
            prioritizeAround(frameFromProgress(p));
            scrollToProgress(p, false);
        };

        consoleTrack.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            isScrubbing = true;
            try { consoleTrack.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
            seek(e.clientX);
            e.preventDefault();
        });
        consoleTrack.addEventListener('pointermove', (e) => { if (isScrubbing) seek(e.clientX); });
        const stop = (e) => {
            if (!isScrubbing) return;
            isScrubbing = false;
            try { consoleTrack.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
        };
        consoleTrack.addEventListener('pointerup', stop);
        consoleTrack.addEventListener('pointercancel', stop);
        consoleTrack.addEventListener('lostpointercapture', () => { isScrubbing = false; });

        consoleTrack.addEventListener('keydown', (e) => {
            const step = ANIM_END / 50;
            let p = null;
            switch (e.key) {
                case 'ArrowRight': case 'ArrowUp': p = progress + step; break;
                case 'ArrowLeft': case 'ArrowDown': p = progress - step; break;
                case 'PageUp': p = progress - step * 5; break;
                case 'PageDown': p = progress + step * 5; break;
                case 'Home': p = HUD_FADE_END; break;
                case 'End': p = ANIM_END; break;
                default: return;
            }
            e.preventDefault();
            scrollToProgress(clamp(p, HUD_FADE_END, ANIM_END), false);
        });
    }


    // ---------------------------------------------------------------------
    // Autoplay: one scroll gesture inside the hero plays the whole build film
    // to its final frame. Scrolling up, tapping or clicking pauses it; the page
    // is still driven by real scroll position, so nothing else has to change.
    // ---------------------------------------------------------------------
    const AUTOPLAY_MS = 11000;          // full film duration, start to finish
    const AUTOPLAY_END = ANIM_END + 0.04; // stop just inside the final-frame hold
    let autoOn = false, autoPos = 0, autoLast = 0, autoRaf = 0;

    function autoEndY() { return trackTop + AUTOPLAY_END * scrollRange; }
    function inHeroPlayable() {
        return window.scrollY >= trackTop - 2 && window.scrollY < autoEndY() - 4;
    }
    function stopAutoplay() {
        if (!autoOn) return;
        autoOn = false;
        cancelAnimationFrame(autoRaf);
        document.documentElement.classList.remove('hero-autoplay');
    }
    function autoStep(ts) {
        if (!autoOn) return;
        const dt = autoLast ? Math.min(50, ts - autoLast) : 16;
        autoLast = ts;
        // resync if something else moved the page (momentum, anchor jump)
        if (Math.abs(window.scrollY - autoPos) > 40) autoPos = window.scrollY;
        const speed = (AUTOPLAY_END * scrollRange) / AUTOPLAY_MS; // px per ms
        const end = autoEndY();
        let limit = end;
        if (filmReadyTo() < TOTAL_FRAMES) {
            limit = Math.min(end, trackTop + progressFromFrame(filmReadyTo()) * scrollRange);
        }
        // advance, but not past the buffered part of the film; never move backwards
        autoPos = Math.max(window.scrollY, Math.min(limit, autoPos + speed * dt));
        window.scrollTo({ top: autoPos, left: 0, behavior: 'instant' });
        if (autoPos >= end - 0.5) { stopAutoplay(); return; }
        autoRaf = requestAnimationFrame(autoStep);
    }
    function startAutoplay() {
        if (autoOn || REDUCED_MOTION || !inHeroPlayable()) return false;
        autoOn = true;
        autoPos = window.scrollY;
        autoLast = 0;
        document.documentElement.classList.add('hero-autoplay');
        autoRaf = requestAnimationFrame(autoStep);
        return true;
    }
    function setupAutoplay() {
        if (REDUCED_MOTION) return;
        window.addEventListener('wheel', (e) => {
            if (e.ctrlKey) return;
            if (autoOn) {
                if (e.deltaY < 0) stopAutoplay();   // scrolling back = take over
                else e.preventDefault();            // already playing forward
                return;
            }
            if (e.deltaY > 0 && inHeroPlayable()) {
                if (startAutoplay()) e.preventDefault();
            }
        }, { passive: false });

        window.addEventListener('keydown', (e) => {
            const t = e.target;
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            const fwd = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
            const back = e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home' || e.key === 'Escape' || (e.key === ' ' && e.shiftKey);
            if (autoOn) {
                if (back) stopAutoplay();
                else if (fwd) e.preventDefault();
                return;
            }
            if (fwd && inHeroPlayable() && startAutoplay()) e.preventDefault();
        });

        // Touch: a swipe up inside the hero starts the film; a new touch pauses it.
        let ty = null;
        window.addEventListener('touchstart', (e) => {
            stopAutoplay();
            ty = e.touches.length === 1 ? e.touches[0].clientY : null;
        }, { passive: true });
        window.addEventListener('touchend', (e) => {
            if (ty === null) return;
            const endY = e.changedTouches[0].clientY;
            const dy = ty - endY;
            ty = null;
            if (dy > 24 && inHeroPlayable()) startAutoplay();
        }, { passive: true });

        // Any click/press (Skip, stage pills, scrubber, links) hands control back.
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch') stopAutoplay();
        }, { passive: true });
        document.addEventListener('visibilitychange', () => { if (document.hidden) stopAutoplay(); });
    }

    // ---------------------------------------------------------------------
    // Init
    // ---------------------------------------------------------------------
    function init() {
        trackEl = document.getElementById('home');
        viewportEl = document.getElementById('heroStickyViewport');
        canvasEl = document.getElementById('heroSequenceCanvas');
        if (!trackEl || !viewportEl || !canvasEl) return;

        ctx = canvasEl.getContext('2d', { alpha: false });
        if (!ctx) return;
        if (FIT_WIDTH) setupBackdrop();

        introOverlay = document.getElementById('heroIntroOverlay');
        hudOverlay = document.getElementById('timelineHudOverlay');
        milestoneCards = Array.from(document.querySelectorAll('.milestone-card'));
        stagePills = Array.from(document.querySelectorAll('.stage-nav-pill'));
        trackFill = document.getElementById('timelineTrackFill');
        trackThumb = document.getElementById('timelineTrackThumb');
        frameLabel = document.getElementById('hudFrameLabel');
        stageCounterLabel = document.getElementById('hudStageCounter');
        progressPctEl = document.getElementById('metaProgressPct');
        stageInfoEl = document.getElementById('metaStageInfo');
        bufferIndicator = document.getElementById('hudBufferIndicator');
        bufferLabel = document.getElementById('bufferLabel');
        bufferMiniFill = document.getElementById('bufferMiniFill');
        consoleTrack = document.getElementById('timelineConsoleTrack');
        completionCue = document.getElementById('hudCompletionCue');
        stickyViewportEl = document.getElementById('heroStickyViewport');
        bottomConsole = document.querySelector('.timeline-bottom-console');

        document.documentElement.classList.add('timeline-ready');

        measure();
        resizeCanvas();
        updateConsoleVar();

        window.addEventListener('scroll', () => scheduleRender(false), { passive: true });
        window.addEventListener('resize', onResize, { passive: true });
        window.addEventListener('orientationchange', onResize, { passive: true });
        window.addEventListener('load', onResize);
        if ('ResizeObserver' in window) {
            const ro = new ResizeObserver(onResize);
            ro.observe(viewportEl);
            ro.observe(trackEl);
            if (bottomConsole) ro.observe(bottomConsole);
        }
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);

        stagePills.forEach((pill) => {
            pill.addEventListener('click', (e) => {
                e.preventDefault();
                goToStage(Number(pill.dataset.stageTarget));
            });
        });
        setupScrubber();

        setupAutoplay();

        // Initial state (handles reloads mid-page / restored scroll position)
        progress = readProgress();
        currentFrame = frameFromProgress(progress);
        currentStage = 0;
        updateHUD();

        // Load the frame on screen first, then everything else coarse-to-fine.
        const first = currentFrame === 1 ? 1 : currentFrame;
        load(first, () => {
            scheduleRender(true);
            if (first !== 1 && status[1] === 0) load(1);
            buildBackgroundQueue();
            prioritizeAround(currentFrame);
            if (currentFrame > 1) unlockFine();
            const go = () => unlockFine();
            ['wheel', 'touchstart', 'keydown', 'pointerdown', 'scroll'].forEach((ev) =>
                window.addEventListener(ev, go, { once: true, passive: true }));
            // otherwise, start quietly once the page has settled
            const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
            const soon = () => go();
            if (document.readyState === 'complete') soon();
            else window.addEventListener('load', soon, { once: true });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
