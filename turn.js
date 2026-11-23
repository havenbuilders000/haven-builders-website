/**
 * Haven Builders — 2026 "turning" motion layer
 * 1) 3D turn-in: headings, cards, panels and images rotate into place from a
 *    3D angle as they enter the screen (uses the CSS `rotate` property, so it
 *    stacks on top of each section's own entrance animation).
 * 2) Section flip: each section tilts back like a turning page as it leaves
 *    the top of the screen, and the next one tips up into place from below.
 * Content and layout are untouched. Respects prefers-reduced-motion.
 */
(function () {
    'use strict';
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const onReady = (fn) => (document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', fn) : fn());

    onReady(() => {
        const root = document.documentElement;
        root.classList.add('turn-js');
        const isMobile = () => window.matchMedia('(max-width: 860px)').matches;

        /* ---------- 1. 3D turn-in ---------- */
        const groups = [
            // [selector, direction]
            ['.section-header, .sv-process-head', 'up'],
            ['.about-content', 'right'],
            ['.pillar-item', 'up'],
            ['.fdr-body', 'right'],
            ['.fdr-portrait', 'left'],
            ['.services-all', 'up'],
            ['.sv4-stage', 'right'],
            ['.why-card', 'alt'],
            ['.testimonial-card', 'alt'],
            ['.vt-wrap', 'up'],
            ['.contact-info-panel', 'left'],
            ['.contact-form-panel', 'right'],
            ['.footer-col, .footer-bottom', 'up'],
            ['.sv-media', 'side'],
            ['.sv-content', 'side-r'],
            ['.sv-cta-inner', 'up'],
            ['.sv-steps > *', 'up']
        ];

        const targets = [];
        groups.forEach(([sel, dir]) => {
            document.querySelectorAll(sel).forEach((el, i) => {
                if (el.closest('#home') || el.classList.contains('tn')) return;
                let d = dir;
                if (dir === 'alt') d = i % 3 === 0 ? 'left' : (i % 3 === 2 ? 'right' : 'up');
                if (dir === 'side' || dir === 'side-r') {
                    const flip = !!el.closest('.sv-block--flip');
                    d = (dir === 'side') !== flip ? 'left' : 'right';
                }
                el.classList.add('tn', 'tn--' + d);
                el.style.setProperty('--tn-d', ((i % 4) * 0.09).toFixed(2) + 's');
                if (el.parentElement) el.parentElement.classList.add('tn-stage');
                targets.push(el);
            });
        });

        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        e.target.classList.add('tn-in');
                        io.unobserve(e.target);
                    }
                });
            }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
            targets.forEach((t) => io.observe(t));
        } else {
            targets.forEach((t) => t.classList.add('tn-in'));
        }

        /* ---------- 2. Section page-flip ---------- */
        const sections = Array.from(document.querySelectorAll('main > section'))
            .filter((s) => s.id !== 'home');
        const pageBg = getComputedStyle(document.body).backgroundColor;
        sections.forEach((s) => {
            s.classList.add('sf');
            // sections that were see-through get the page colour so the flip shows a clean edge
            const bg = getComputedStyle(s).backgroundColor;
            if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
                s.style.backgroundColor = (pageBg && pageBg !== 'rgba(0, 0, 0, 0)') ? pageBg : '#ffffff';
            }
        });

        let ticking = false;
        const clamp = (v) => Math.max(0, Math.min(1, v));
        const ease = (t) => t * t * (3 - 2 * t);

        const update = () => {
            ticking = false;
            const vh = window.innerHeight;
            const mob = isMobile();
            const EXIT_DEG = mob ? 7 : 13;
            const ENTER_DEG = mob ? 6 : 10;
            sections.forEach((s) => {
                const r = s.getBoundingClientRect();
                if (r.bottom < -50 || r.top > vh + 50) {
                    if (s.style.transform) { s.style.transform = ''; s.style.willChange = ''; }
                    return;
                }
                // entering: top edge travelling from the bottom of the screen up to 75% height
                const enter = ease(clamp((r.top - vh * 0.25) / (vh * 0.75)));
                // leaving: bottom edge travelling from 55% height up past the top
                const exit = ease(clamp((vh * 0.55 - r.bottom) / (vh * 0.55)));
                let t = '';
                if (enter > 0.001) {
                    s.style.transformOrigin = '50% 0%';
                    t = `perspective(1800px) rotateX(${(-enter * ENTER_DEG).toFixed(3)}deg) translateY(${(enter * 40).toFixed(1)}px) scale(${(1 - enter * 0.04).toFixed(4)})`;
                } else if (exit > 0.001) {
                    s.style.transformOrigin = '50% 100%';
                    t = `perspective(1800px) rotateX(${(exit * EXIT_DEG).toFixed(3)}deg) scale(${(1 - exit * 0.07).toFixed(4)})`;
                }
                s.style.transform = t;
                s.style.willChange = t ? 'transform' : '';
            });
        };

        const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
        window.addEventListener('scroll', request, { passive: true });
        window.addEventListener('resize', request, { passive: true });
        update();
    });
})();
