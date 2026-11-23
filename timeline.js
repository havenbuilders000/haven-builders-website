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
    const SET = NEED_PX <= 1350 ? 'm' : 'd';
    // AVIF frames are ~45% lighter than WebP at the same look; browsers without AVIF get WebP.
    const AVIF_OK = (() => {
        try {
            const c = document.createElement('canvas');
            return c.toDataURL && c.toDataURL('image/avif').indexOf('data:image/avif') === 0;
        } catch (e) { return false; }
    })() || /Chrome\/(8[5-9]|9\d|1\d\d)|Firefox\/(9[3-9]|1\d\d)|Version\/(1[6-9]|2\d).*Safari/.test(navigator.userAgent);
    // (the largest 1920px set stays WebP; AVIF is used for the phone/laptop sets)
    const USE_AVIF = AVIF_OK;
    // Only the light WebP set is published as a fallback for the rare browser without AVIF.
    let IMAGE_FOLDER = USE_AVIF ? `frames/a${SET}/` : `frames/m/`;
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
    function paintable(idx) { return frames[idx]; }
    function refreshBitmaps() {}

    function drawCover(img, alpha, zoom, driftY) {
        const cw = canvasEl.width;
        const ch = canvasEl.height;
        const iw = img.naturalWidth || img.width || 1920;
        const ih = img.naturalHeight || img.height || 1080;
        const scale = Math.max(cw / iw, ch / ih) * zoom;   // object-fit: cover + camera zoom
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
        drawCover(paintable(lo), 1, zoom, driftY);
        if (hi && hi !== lo && t > 0.004) {
            drawCover(paintable(hi), t, zoom, driftY);
        }
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
        const h = viewportEl.clientHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let tw = Math.round(w * dpr);
        let th = Math.round(h * dpr);
        // Cap to what the frames can actually show (cover-fit + camera zoom); anything larger
        // just costs fill-rate on every frame without adding detail.
        const srcW = ({ m: 1280, d: 1600, h: 1920 })[SET] || 1920;
        const srcH = Math.round(srcW * 9 / 16);
        const need = Math.max(tw / srcW, th / srcH);       // how much the frame is upscaled
        if (need > 1.12) { const f = 1.12 / need; tw = Math.round(tw * f); th = Math.round(th * f); }
        if (canvasEl.width !== tw || canvasEl.height !== th) {
            canvasEl.width = tw;
            canvasEl.height = th;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'medium';
            lastDrawnImg = null;
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
