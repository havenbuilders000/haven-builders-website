/* Haven Builders — Our Team page: hero entrance, scroll reveals, portrait tilt */
(function () {
    'use strict';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;

    const run = () => {
        if (!reduce && 'IntersectionObserver' in window) root.classList.add('tm-js');

        // hero
        requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('tm-loaded')));

        // stagger text items inside each member block
        document.querySelectorAll('.tm-text').forEach((box) => {
            box.querySelectorAll('.tm-anim').forEach((el, i) => el.style.setProperty('--d', (0.25 + i * 0.12).toFixed(2) + 's'));
        });

        const items = document.querySelectorAll('.tm-anim');
        if (root.classList.contains('tm-js')) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
                });
            }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
            items.forEach((el) => io.observe(el));
        } else {
            items.forEach((el) => el.classList.add('is-in'));
        }

        // pointer tilt on portraits (desktop)
        if (!reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            document.querySelectorAll('.tm-photo').forEach((box) => {
                let raf = 0, tx = 0, ty = 0;
                const apply = () => { raf = 0; box.style.setProperty('--tx', tx.toFixed(3)); box.style.setProperty('--ty', ty.toFixed(3)); };
                box.addEventListener('pointermove', (e) => {
                    const r = box.getBoundingClientRect();
                    tx = ((e.clientX - r.left) / r.width) * 2 - 1;
                    ty = ((e.clientY - r.top) / r.height) * 2 - 1;
                    if (!raf) raf = requestAnimationFrame(apply);
                });
                box.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(apply); });
            });
        }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();
