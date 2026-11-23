/**
 * Haven Builders — Services page interactions
 * - Hero entrance + background parallax
 * - Scroll reveals (text, image mask wipes, feature cascades, process line)
 * - Image parallax per service block
 * - Sticky service menu: active state, auto-scroll, page progress bar
 */
(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    onReady(() => {
        const hero = document.querySelector('.sv-hero');
        const heroBg = document.querySelector('.sv-hero-bg');
        const subnav = document.querySelector('.sv-subnav');
        const subnavLinks = Array.from(document.querySelectorAll('.sv-subnav-link'));
        const blocks = Array.from(document.querySelectorAll('.sv-block'));
        const medias = Array.from(document.querySelectorAll('.sv-media'));

        // ---- Hero entrance
        if (hero) {
            requestAnimationFrame(() => hero.classList.add('is-loaded'));
        }

        // ---- Scroll reveals (only hide content once JS is running)
        if (!reduceMotion && 'IntersectionObserver' in window) {
            root.classList.add('sv-js');
            const revealTargets = document.querySelectorAll('.sv-reveal, .sv-reveal-list, .sv-steps');
            const revealer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-in');
                        revealer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
            revealTargets.forEach((el) => revealer.observe(el));
        } else {
            document.querySelectorAll('.sv-steps').forEach((el) => el.classList.add('is-in'));
        }

        // ---- Sticky menu: highlight the service in view
        function setActive(slug) {
            subnavLinks.forEach((link) => {
                const on = link.dataset.target === slug;
                link.classList.toggle('is-active', on);
                if (on) {
                    link.setAttribute('aria-current', 'true');
                    // keep the active pill visible in the horizontally scrolling menu
                    const bar = link.parentElement;
                    const target = link.offsetLeft - bar.clientWidth / 2 + link.clientWidth / 2;
                    bar.scrollTo({ left: target, behavior: reduceMotion ? 'auto' : 'smooth' });
                } else {
                    link.removeAttribute('aria-current');
                }
            });
        }

        if ('IntersectionObserver' in window && blocks.length) {
            const spy = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) setActive(entry.target.id);
                });
            }, { rootMargin: '-45% 0px -50% 0px' });
            blocks.forEach((b) => spy.observe(b));
        }

        // ---- Scroll-linked effects (one rAF per frame)
        let ticking = false;
        function update() {
            ticking = false;
            const vh = window.innerHeight;

            if (!reduceMotion) {
                if (hero && heroBg) {
                    const r = hero.getBoundingClientRect();
                    if (r.bottom > 0) {
                        const hp = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
                        hero.style.setProperty('--hp', hp.toFixed(4));
                    }
                }

                medias.forEach((m) => {
                    const r = m.getBoundingClientRect();
                    if (r.bottom < -80 || r.top > vh + 80) return;
                    const p = Math.max(-1, Math.min(1, ((vh - r.top) / (vh + r.height)) * 2 - 1));
                    m.style.setProperty('--p', p.toFixed(4));
                });
            }

            if (subnav) {
                const max = document.documentElement.scrollHeight - vh;
                const sp = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
                subnav.style.setProperty('--sp', sp.toFixed(4));
            }
        }

        function requestUpdate() {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(update);
            }
        }

        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate, { passive: true });
        update();
    });
})();
