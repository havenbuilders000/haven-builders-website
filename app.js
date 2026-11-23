/* ==========================================================================
   Enquiry storage (Supabase). The anon key is a public, browser-safe key:
   the database only allows it to INSERT new enquiries (row-level security).
   ========================================================================== */
const HB_SUPABASE_URL = 'https://xmjicsexoaxlfynljxcx.supabase.co';
const HB_SUPABASE_ANON_KEY = 'sb_publishable_4DTOl3GF52WDBNdug1Qyyg_y7KYNIag';
async function saveEnquiry(row) {
    try {
        const res = await fetch(`${HB_SUPABASE_URL}/rest/v1/enquiries`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: HB_SUPABASE_ANON_KEY,
                Prefer: 'return=minimal'
            },
            body: JSON.stringify(row)
        });
        return res.ok;
    } catch (e) {
        return false;
    }
}

/**
 * Haven Builders — Architectural & Construction Website Script
 * Interactive behaviors: Navigation, Modals, Portfolio Filters, Consultation Form & WhatsApp Integration
 */

// Official Haven Builders Contact Constants
const HAVEN_PHONE = '+91 9072729280';
const HAVEN_WHATSAPP_NUM = '919072729280';
const HAVEN_INSTAGRAM_URL = 'https://www.instagram.com/haven__builders/';

// Global Architectural SVG Fallback Generator (prevents broken image icons)
window.getSvgFallback = function(altText) {
    const title = altText || 'Haven Builders Construction';
    const cleanTitle = title.replace(/[<>&"]/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" fill="#0a0a0a"/><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#222222" stroke-width="1"/></pattern><rect width="800" height="500" fill="url(#grid)"/><g transform="translate(400, 210)"><path d="M-30 20 L0 -25 L30 20 Z" fill="none" stroke="#ffffff" stroke-width="2.5"/><rect x="-18" y="2" width="36" height="34" fill="#111111" stroke="#ffffff" stroke-width="2"/><line x1="-8" y1="12" x2="-8" y2="24" stroke="#ffffff" stroke-width="1.5"/><line x1="8" y1="12" x2="8" y2="24" stroke="#ffffff" stroke-width="1.5"/></g><text x="400" y="290" font-family="'Lato', sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="2">HAVEN BUILDERS</text><text x="400" y="325" font-family="'Lato', sans-serif" font-size="13" font-weight="500" fill="#8e8e93" text-anchor="middle">${cleanTitle}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};

// Global Image Error Handler (Capturing phase)
window.addEventListener('error', (e) => {
    if (e.target && e.target.tagName === 'IMG') {
        const img = e.target;
        if (!img.dataset.failed) {
            img.dataset.failed = 'true';
            if (img.classList.contains('brand-logo-img') || img.classList.contains('footer-logo-img') || img.classList.contains('mobile-drawer-logo-img') || img.classList.contains('about-exp-logo')) {
                if (!/logo\.jpg$/.test(img.src)) {
                    img.removeAttribute('srcset');
                    img.src = 'logo-nav.png' === img.getAttribute('src') ? 'logo.jpg' : 'logo-nav.png';
                }
            } else {
                img.removeAttribute('srcset');
                img.removeAttribute('sizes');
                img.src = window.getSvgFallback(img.alt);
            }
        }
    }
}, true);

/**
 * Opening intro: plays the logo reveal, then lifts away. Click/tap or any key skips it.
 * A hard timeout guarantees the site is never blocked.
 */
(function initSiteIntro() {
    const root = document.documentElement;
    if (!root.classList.contains('intro-active')) return;

    const HOLD_MS = 1150;    // logo is fully revealed by ~1.1s
    const EXIT_MS = 450;     // matches the CSS fade-out
    let leaving = false;

    function finish() {
        root.classList.remove('intro-exit');
        const el = document.getElementById('siteIntro');
        if (el) el.remove();
    }

    // The hero starts its entrance underneath while the intro fades out on top,
    // so the hand-off is one smooth crossfade (no pop-in after the black screen).
    function leave() {
        if (leaving) return;
        leaving = true;
        const el = document.getElementById('siteIntro');
        if (!el) { root.classList.remove('intro-active'); return; }
        root.classList.add('intro-exit');
        root.classList.remove('intro-active');
        setTimeout(finish, EXIT_MS + 50);
    }

    function start() {
        const el = document.getElementById('siteIntro');
        if (!el) { finish(); return; }
        el.addEventListener('click', leave);
        window.addEventListener('keydown', leave, { once: true });
        setTimeout(leave, HOLD_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
    setTimeout(leave, 6000);  // safety net
})();

document.addEventListener('DOMContentLoaded', () => {
    // 1. Current Year in Footer
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // 2. Fixed Navbar & Back-to-Top Button on Scroll
    const header = document.getElementById('header');
    const mobileDrawerEl = document.getElementById('mobileDrawer');
    const navbar = document.getElementById('navbar');
    const backToTopBtn = document.getElementById('backToTop');

    // Expose the live header height to CSS (hero HUD padding, anchor scroll offsets)
    function syncHeaderHeight() {
        if (header) {
            document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
        }
    }
    syncHeaderHeight();
    if (header && 'ResizeObserver' in window) {
        new ResizeObserver(syncHeaderHeight).observe(header);
    } else {
        window.addEventListener('resize', syncHeaderHeight, { passive: true });
    }

    // Throttled to one update per animation frame (avoids layout thrash during the hero timeline)
    let scrollTicking = false;

    // Scroll-direction navbar: hide on scroll down, reveal on scroll up.
    // A small direction threshold filters out trackpad/touch jitter (no flicker).
    const NAV_TOP_ZONE = 80;      // always visible near the top of the page
    const NAV_DELTA = 8;          // px of consistent movement before toggling
    let lastScrollY = Math.max(0, window.scrollY);
    let navHidden = false;

    function setNavHidden(hide) {
        if (!header || hide === navHidden) return;
        navHidden = hide;
        header.classList.toggle('nav-hidden', hide);
    }

    function updateNavVisibility(scrollY) {
        const drawerOpen = mobileDrawerEl && mobileDrawerEl.classList.contains('active');
        // Keep it visible while a keyboard user is tabbing through it (mouse clicks don't count)
        let navHasFocus = false;
        try {
            navHasFocus = !!(header && header.querySelector(':focus-visible'));
        } catch (_) { /* :focus-visible unsupported */ }

        if (scrollY <= NAV_TOP_ZONE || drawerOpen || navHasFocus) {
            setNavHidden(false);
            lastScrollY = scrollY;
            return;
        }

        const delta = scrollY - lastScrollY;
        if (Math.abs(delta) < NAV_DELTA) return;   // ignore tiny movements; keep reference point

        setNavHidden(delta > 0);
        lastScrollY = scrollY;
    }

    function onScrollFrame() {
        scrollTicking = false;
        const scrollY = Math.max(0, window.scrollY); // clamp iOS rubber-band overscroll

        if (navbar) navbar.classList.toggle('scrolled', scrollY > 60);
        updateNavVisibility(scrollY);
        if (backToTopBtn) backToTopBtn.classList.toggle('visible', scrollY > 500);

        updateActiveNavLink();
    }

    window.addEventListener('scroll', () => {
        if (!scrollTicking) {
            scrollTicking = true;
            requestAnimationFrame(onScrollFrame);
        }
    }, { passive: true });

    if (header) {
        header.addEventListener('focusin', (e) => {
            try {
                if (e.target.matches(':focus-visible')) setNavHidden(false);
            } catch (_) {
                setNavHidden(false);
            }
        });
    }

    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // 3. Mobile Navigation Drawer
    const mobileToggle = document.getElementById('mobileToggle');
    const mobileClose = document.getElementById('mobileClose');
    const mobileDrawer = document.getElementById('mobileDrawer');
    const drawerBackdrop = document.getElementById('drawerBackdrop');
    const mobileLinks = document.querySelectorAll('.mobile-link');

    function openMobileMenu() {
        if (!mobileDrawer) return;
        if (header) header.classList.remove('nav-hidden');
        mobileDrawer.classList.add('active');
        if (drawerBackdrop) drawerBackdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'true');
    }

    function closeMobileMenu() {
        if (!mobileDrawer) return;
        mobileDrawer.classList.remove('active');
        if (drawerBackdrop) drawerBackdrop.classList.remove('active');
        document.body.style.overflow = '';
        if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'false');
    }

    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            if (mobileDrawer && mobileDrawer.classList.contains('active')) {
                closeMobileMenu();
            } else {
                openMobileMenu();
            }
        });
    }
    if (mobileClose) mobileClose.addEventListener('click', closeMobileMenu);
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeMobileMenu);

    mobileLinks.forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMobileMenu();
        }
    });

    window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => {
        if (e.matches) closeMobileMenu();
    });

    // 4. Active Nav Link update on scroll
    const sections = document.querySelectorAll('section[id]');
    const desktopNavLinks = Array.from(document.querySelectorAll('.nav-menu .nav-link'));

    // Sliding highlight pill behind the hovered / active desktop link
    const navMenuEl = document.getElementById('navMenu');
    const navIndicator = navMenuEl ? navMenuEl.querySelector('.nav-indicator') : null;

    function moveIndicator(link) {
        if (!navIndicator || !navMenuEl) return;
        if (!link || link.offsetParent === null) {
            navIndicator.style.opacity = '0';
            return;
        }
        const menuRect = navMenuEl.getBoundingClientRect();
        const r = link.getBoundingClientRect();
        navIndicator.style.width = `${r.width}px`;
        navIndicator.style.transform = `translate3d(${r.left - menuRect.left}px, 0, 0)`;
        navIndicator.style.opacity = '1';
    }

    function activeNavLink() {
        return navMenuEl ? navMenuEl.querySelector('.nav-link.active') : null;
    }

    if (navMenuEl && navIndicator) {
        navMenuEl.querySelectorAll('.nav-link').forEach((link) => {
            link.addEventListener('mouseenter', () => moveIndicator(link));
            link.addEventListener('focus', () => moveIndicator(link));
        });
        navMenuEl.addEventListener('mouseleave', () => moveIndicator(activeNavLink()));
        navMenuEl.addEventListener('focusout', (e) => {
            if (!navMenuEl.contains(e.relatedTarget)) moveIndicator(activeNavLink());
        });
        const place = () => {
            navIndicator.classList.add('no-anim');
            moveIndicator(activeNavLink());
            requestAnimationFrame(() => navIndicator.classList.remove('no-anim'));
        };
        window.addEventListener('resize', place, { passive: true });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
        window.addEventListener('load', place);
        place();
    }

    let lastActiveId = '';
    function updateActiveNavLink() {
        const scrollPosition = window.scrollY + 140;
        let activeId = '';

        sections.forEach(section => {
            const top = section.getBoundingClientRect().top + window.scrollY;
            if (scrollPosition >= top && scrollPosition < top + section.offsetHeight) {
                activeId = section.id;
            }
        });

        if (!activeId || activeId === lastActiveId) return;
        // Only re-highlight when a nav link points at this section (keeps "Services" active on services.html)
        if (!desktopNavLinks.some(link => link.getAttribute('href') === `#${activeId}`)) return;
        lastActiveId = activeId;
        desktopNavLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${activeId}`);
        });
        if (navMenuEl && !navMenuEl.matches(':hover')) moveIndicator(activeNavLink());
    }
    updateActiveNavLink();

    // 5. Consultation Form Validation & Submission
    const consultationForm = document.getElementById('consultationForm');
    const formStatus = document.getElementById('formStatus');

    // Real-time error clearance
    if (consultationForm) {
        const formInputs = consultationForm.querySelectorAll('input, select, textarea');
        formInputs.forEach(input => {
            input.addEventListener('input', () => {
                input.classList.remove('input-error');
                const errSpan = input.closest('.form-group')?.querySelector('.field-error');
                if (errSpan) errSpan.textContent = '';
            });
            input.addEventListener('change', () => {
                input.classList.remove('input-error');
                const errSpan = input.closest('.form-group')?.querySelector('.field-error');
                if (errSpan) errSpan.textContent = '';
            });
        });

        consultationForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Clear previous errors
            clearFormErrors();

            const fieldVal = (id) => {
                const el = document.getElementById(id);
                return el ? el.value.trim() : '';
            };
            const name = fieldVal('clientName');
            const phone = fieldVal('clientPhone');
            const email = fieldVal('clientEmail');            // not in the simple form
            const projectType = fieldVal('projectType');
            const budget = fieldVal('estimatedBudget');       // not in the simple form
            const location = fieldVal('projectLocation');     // optional
            const message = fieldVal('projectMessage');       // optional

            let isValid = true;

            if (!name || name.length < 2) {
                showFieldError('clientName', 'nameError', 'Please enter your name.');
                isValid = false;
            }

            if (!phone || phone.replace(/\D/g, '').length < 7) {
                showFieldError('clientPhone', 'phoneError', 'Please enter a valid phone number.');
                isValid = false;
            }

            if (!projectType) {
                showFieldError('projectType', 'projectTypeError', 'Please choose a type of project.');
                isValid = false;
            }

            if (!isValid) {
                return;
            }

            // Submit process
            const submitBtn = document.getElementById('submitBtn');
            if (!submitBtn) return;
            const originalBtnHTML = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting Consultation Request...`;

            const refId = 'HB-' + Math.floor(100000 + Math.random() * 900000);

            // Save the enquiry to the Supabase database, then show the confirmation.
            saveEnquiry({ ref_id: refId, name, phone, project_type: projectType, location: location || null, message: message || null, page: window.location.pathname })
            .then((saved) => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHTML;
                
                // Construct prefilled WhatsApp link to the official Haven Builders number
                const waLines = [
                    '*Haven Builders Consultation Request*',
                    '',
                    `*Reference:* ${refId}`,
                    `*Name:* ${name}`,
                    `*Phone:* ${phone}`,
                    `*Project:* ${projectType}`
                ];
                if (location) waLines.push(`*Location:* ${location}`);
                if (message) waLines.push(`*Message:* ${message}`);
                const waMessage = encodeURIComponent(waLines.join('\n'));
                const waUrl = `https://wa.me/${HAVEN_WHATSAPP_NUM}?text=${waMessage}`;

                if (formStatus) {
                    formStatus.className = 'form-status success';
                    formStatus.style.display = 'block';
                    formStatus.innerHTML = `
                        <div style="margin-bottom: 8px;">
                            <strong>${saved ? '<i class="fa-solid fa-circle-check"></i> Consultation Request Received!' : '<i class="fa-solid fa-triangle-exclamation"></i> Almost there'}</strong>
                        </div>
                        <p style="margin-bottom: 12px; font-size: 0.88rem; line-height: 1.6;">
                            Thank you, <strong>${escapeHtml(name)}</strong>. Your enquiry for <strong>${escapeHtml(projectType)}</strong> ${saved ? `has been received under Reference ID <strong>#${refId}</strong>. Our construction team will contact you at <strong>${escapeHtml(phone)}</strong> shortly.` : `could not be sent just now. Please send it to us directly on WhatsApp using the button below.`}
                        </p>
                        <div style="margin-top: 12px; display: flex; gap: 10px; flex-wrap: wrap;">
                            <a href="${waUrl}" target="_blank" rel="noopener" class="btn btn-whatsapp btn-sm">
                                <i class="fa-brands fa-whatsapp"></i> Send Directly via WhatsApp
                            </a>
                            <a href="tel:${HAVEN_PHONE.replace(/\s+/g, '')}" class="btn btn-secondary btn-sm" style="color: #101216; background-color: #e2e8f0; border-color: #cbd5e1;">
                                <i class="fa-solid fa-phone"></i> Call Haven Builders Now
                            </a>
                        </div>
                    `;
                }

                // Reset form fields (keep them if saving failed, so nothing is lost)
                if (saved) consultationForm.reset();

                // Scroll status into view smoothly
                if (formStatus) formStatus.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        });
    }

    // Pre-select a service in the enquiry form when arriving from services.html (?service=...)
    try {
        const wanted = new URLSearchParams(window.location.search).get('service');
        const select = document.getElementById('projectType');
        if (wanted && select) {
            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].value === wanted) {
                    select.selectedIndex = i;
                    break;
                }
            }
        }
    } catch (_) { /* ignore */ }

    // Why Choose Us: staged entrance + cursor-following colour spotlight
    const whySection = document.getElementById('why-us');
    if (whySection) {
        if ('IntersectionObserver' in window && !window.matchMedia('(max-width: 0px)').matches) {
            whySection.classList.add('wy-anim');
            const wyObs = new IntersectionObserver((entries, obs) => {
                if (entries[0].isIntersecting) {
                    whySection.classList.add('wy-in');
                    obs.disconnect();
                }
            }, { threshold: 0.15 });
            wyObs.observe(whySection.querySelector('.why-grid') || whySection);
        }
        whySection.querySelectorAll('.why-card').forEach((card) => {
            card.addEventListener('pointermove', (e) => {
                const r = card.getBoundingClientRect();
                card.style.setProperty('--mx', `${e.clientX - r.left}px`);
                card.style.setProperty('--my', `${e.clientY - r.top}px`);
            });
        });
    }

    // Services showcase (list + image stage / mobile carousel)
    initServicesShowcase();

    // Video testimonials: continuous auto-scroll (pauses on hover/touch/focus), drag to scroll,
    // click a card to watch the Instagram reel in a popup.
    initVideoTestimonials();

    // 6. Initialize Premium Scroll Animations & Parallax
    initScrollAnimations();
});

/**
 * Premium Scroll Animations, Card Reveals & Parallax Engine
 */
function initScrollAnimations() {
    const prefersReducedMotion = window.matchMedia('(max-width: 0px)').matches;

    // 1. Hero Entrance Animations
    setTimeout(() => {
        const heroElements = document.querySelectorAll('.fade-in-up');
        heroElements.forEach(el => {
            el.classList.add('active');
            el.classList.add('is-revealed');
        });
    }, 120);

    if (prefersReducedMotion) {
        document.querySelectorAll('.reveal-on-scroll, .reveal-slide-left, .reveal-slide-right, .reveal-scale').forEach(el => {
            el.classList.add('is-revealed');
        });
        return;
    }

    // 2. IntersectionObserver for Natural Scroll-Triggered Reveals
    if ('IntersectionObserver' in window) {
        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -40px 0px',
            threshold: 0.12
        };

        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    // Unobserve to free resources and maintain peak performance
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        const targets = document.querySelectorAll('.reveal-on-scroll, .reveal-slide-left, .reveal-slide-right, .reveal-scale');
        targets.forEach(target => revealObserver.observe(target));
    } else {
        // Fallback for older browsers
        document.querySelectorAll('.reveal-on-scroll, .reveal-slide-left, .reveal-slide-right, .reveal-scale').forEach(el => {
            el.classList.add('is-revealed');
        });
    }

    // 3. Smooth scrolling for internal anchor links (replaces CSS smooth-scroll for performance)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (!targetId || targetId === '#') return;
            let target = null;
            try {
                target = document.querySelector(targetId);
            } catch (_) {
                return; // not a valid selector — let the browser handle it
            }
            if (!target) return;
            e.preventDefault();
            if (target.id === 'home') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // 4. About section: entrance reveal + scroll-linked parallax depth
    const aboutSection = document.getElementById('about');
    if (aboutSection) {
        aboutSection.classList.add('ab-anim');
        const abObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    aboutSection.classList.add('ab-in');
                    obs.disconnect();
                }
            });
        }, { threshold: 0.15 });
        abObserver.observe(aboutSection);

        const abVisuals = aboutSection.querySelector('.about-visuals');
        let abTicking = false;
        const abUpdate = () => {
            abTicking = false;
            if (!abVisuals) return;
            const r = abVisuals.getBoundingClientRect();
            const vh = window.innerHeight;
            if (r.bottom < -100 || r.top > vh + 100) return;
            // -1 when the images enter at the bottom, +1 when they leave at the top
            const p = Math.max(-1, Math.min(1, ((vh - r.top) / (vh + r.height)) * 2 - 1));
            aboutSection.style.setProperty('--abp', p.toFixed(4));
        };
        window.addEventListener('scroll', () => {
            if (!abTicking) {
                abTicking = true;
                requestAnimationFrame(abUpdate);
            }
        }, { passive: true });
        window.addEventListener('resize', abUpdate, { passive: true });
        abUpdate();
    }

    // Trust bar: staged entrance when it scrolls into view (plays once)
    const trustBar = document.getElementById('trustBar');
    if (trustBar && 'IntersectionObserver' in window) {
        trustBar.classList.add('tb-anim');
        const tbObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    trustBar.classList.add('tb-in');
                    obs.disconnect();
                }
            });
        }, { threshold: 0.25 });
        tbObserver.observe(trustBar);
    }

    // 5. CEO block: scroll-linked animation (scrubs forward/backward with scroll)
    const ceoFeature = document.getElementById('ceoFeature');
    if (ceoFeature) {
        initCeoScrollAnimation(ceoFeature);
    }

    // Safety fallback: Reveal all elements after 2.5s if not triggered
    setTimeout(() => {
        document.querySelectorAll('.reveal-on-scroll, .reveal-slide-left, .reveal-slide-right, .reveal-scale').forEach(el => {
            el.classList.add('is-revealed');
        });
    }, 2500);
}

/**
 * CEO block entrance animation: plays when the block scrolls into view and
 * resets once it has completely left the screen, so it plays again next time.
 */
function initCeoScrollAnimation(el) {
    if (!('IntersectionObserver' in window)) return;
    el.classList.add('ceo-anim');

    // Play once the block's top is 15% above the bottom of the screen
    // (works for any block height / screen size)
    const enter = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) el.classList.add('ceo-in');
        });
    }, { threshold: 0, rootMargin: '0px 0px -15% 0px' });

    // Reset only once it has fully left the screen, so it replays next time
    const leave = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) el.classList.remove('ceo-in');
        });
    }, { threshold: 0 });

    enter.observe(el);
    leave.observe(el);
}

function initVideoTestimonials() {
    const viewport = document.getElementById('vtViewport');
    const track = document.getElementById('vtTrack');
    if (!viewport || !track) return;

    const reduce = window.matchMedia('(max-width: 0px)').matches;
    const SPEED = 0.45;            // px per frame (~27px/s at 60fps)
    let paused = false;
    let visible = false;
    let raf = 0;
    let pos = 0;

    // half of the track = one full set of cards (the second set is a duplicate)
    const loopWidth = () => track.scrollWidth / 2;

    function step() {
        raf = 0;
        if (!paused && visible && !reduce) {
            pos += SPEED;
            const w = loopWidth();
            if (pos >= w) pos -= w;
            viewport.scrollLeft = pos;
        }
        if (visible) raf = requestAnimationFrame(step);
    }

    function start() {
        if (!raf) raf = requestAnimationFrame(step);
    }

    // run only while on screen
    if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
            visible = entries[0].isIntersecting;
            if (visible) { pos = viewport.scrollLeft; start(); }
        }).observe(viewport);
    } else {
        visible = true;
        start();
    }

    // pause while the visitor interacts
    const pause = () => { paused = true; };
    const resume = () => { paused = false; pos = viewport.scrollLeft; };
    viewport.addEventListener('mouseenter', pause);
    viewport.addEventListener('mouseleave', resume);
    viewport.addEventListener('focusin', pause);
    viewport.addEventListener('focusout', resume);
    viewport.addEventListener('touchstart', pause, { passive: true });
    viewport.addEventListener('touchend', () => setTimeout(resume, 1800), { passive: true });

    // keep manual scrolling inside the loop
    viewport.addEventListener('scroll', () => {
        const w = loopWidth();
        if (paused) {
            if (viewport.scrollLeft >= w) viewport.scrollLeft -= w;
            else if (viewport.scrollLeft <= 0) viewport.scrollLeft += w;
        }
    }, { passive: true });

    // mouse drag to scroll (desktop)
    let dragX = 0, dragStart = 0, dragged = false, down = false;
    viewport.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') return;
        down = true; dragged = false; dragX = e.clientX; dragStart = viewport.scrollLeft;
    });
    window.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - dragX;
        if (Math.abs(dx) > 5) { dragged = true; viewport.classList.add('is-dragging'); }
        if (dragged) viewport.scrollLeft = dragStart - dx;
    });
    window.addEventListener('pointerup', () => {
        if (!down) return;
        down = false;
        viewport.classList.remove('is-dragging');
        pos = viewport.scrollLeft;
    });

    // Each card shows Instagram's own player (original thumbnail), cropped to the
    // video only. Tapping it plays right there. Players load when the strip is near.
    let loaded = false;
    let watching = false;

    function loadPlayers() {
        if (loaded) return;
        loaded = true;
        track.querySelectorAll('.vt-card').forEach((card) => {
            const code = card.dataset.reel;
            const holder = document.createElement('span');
            holder.className = 'vt-player';
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.instagram.com/reel/${encodeURIComponent(code)}/embed/`;
            iframe.title = 'Haven Builders client video';
            iframe.loading = 'lazy';
            iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
            iframe.setAttribute('allowfullscreen', '');
            iframe.setAttribute('scrolling', 'no');
            if (card.getAttribute('aria-hidden') === 'true') iframe.tabIndex = -1;
            iframe.addEventListener('load', () => card.classList.add('is-loaded'));
            holder.appendChild(iframe);
            card.appendChild(holder);
        });
    }

    // Cards show the real reel covers (img/reel-*.webp); tapping one opens the popup player.
    void loadPlayers;

    // Click a thumbnail → play the video in a small popup window
    const modal = document.getElementById('vtModal');
    const frame = document.getElementById('vtFrame');
    let lastFocus = null;

    function openVideo(code) {
        if (!modal || !frame) return;
        lastFocus = document.activeElement;
        frame.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.instagram.com/reel/${encodeURIComponent(code)}/embed/`;
        iframe.title = 'Haven Builders client video';
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('scrolling', 'no');
        frame.appendChild(iframe);
        const igLink = document.getElementById('vtIgLink');
        if (igLink) igLink.href = `https://www.instagram.com/reel/${encodeURIComponent(code)}/`;
        modal.hidden = false;
        fitPlayer();
        document.documentElement.classList.add('vt-open');
        paused = true;
        const closeBtn = modal.querySelector('.vt-modal-close');
        if (closeBtn) closeBtn.focus();
    }

    // scale Instagram's fixed 326px player to the popup width, hiding its header
    function fitPlayer() { /* player is sized by CSS (no scaling, so taps reach Instagram's controls) */ }
    window.addEventListener('resize', () => { if (modal && !modal.hidden) fitPlayer(); }, { passive: true });

    function closeVideo() {
        if (!modal || modal.hidden) return;
        modal.classList.add('is-closing');
        setTimeout(() => {
            modal.hidden = true;
            modal.classList.remove('is-closing');
            frame.innerHTML = '';            // stops playback
            document.documentElement.classList.remove('vt-open');
            paused = viewport.matches(':hover');
            pos = viewport.scrollLeft;
            if (lastFocus && lastFocus.focus) lastFocus.focus();
        }, 220);
    }

    track.addEventListener('click', (e) => {
        if (dragged) { dragged = false; return; }
        const card = e.target.closest('.vt-card');
        if (!card) return;
        // Instagram doesn't allow some reels (e.g. ones with licensed music) to play on other
        // websites, so those open straight on Instagram (the app on phones).
        if (card.dataset.igOnly) {
            window.open(`https://www.instagram.com/reel/${encodeURIComponent(card.dataset.reel)}/`, '_blank', 'noopener');
            return;
        }
        openVideo(card.dataset.reel);
    });

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.closest('[data-vt-close]')) closeVideo();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeVideo();
    });
}

function initServicesShowcase() {
    const root = document.getElementById('svx');
    if (!root) return;
    const list = document.getElementById('svxList');
    const items = Array.from(root.querySelectorAll('.svx-item'));
    const slides = Array.from(root.querySelectorAll('.svx-slide'));
    const dots = Array.from(root.querySelectorAll('.svx-dot'));
    const stageLink = document.getElementById('svxStageLink');
    const bar = document.getElementById('svxProgress');
    const reduce = window.matchMedia('(max-width: 0px)').matches;
    const mobile = window.matchMedia('(max-width: 1024px)');
    const CYCLE_MS = 4500;
    let current = 0;
    let timer = 0;
    let inView = false;
    let hovering = false;

    function setActive(i) {
        current = (i + items.length) % items.length;
        items.forEach((el, k) => el.classList.toggle('is-active', k === current));
        slides.forEach((el, k) => {
            const on = k === current;
            el.classList.toggle('is-active', on);
            el.setAttribute('aria-hidden', on ? 'false' : 'true');
        });
        dots.forEach((el, k) => el.classList.toggle('is-active', k === current));
        if (stageLink) {
            stageLink.href = items[current].getAttribute('href');
            stageLink.setAttribute('aria-label', 'View details: ' + items[current].querySelector('.svx-title').textContent);
        }
        restartBar();
    }

    function restartBar() {
        if (!bar) return;
        bar.classList.remove('is-running');
        void bar.offsetWidth;              // restart the CSS animation
        if (canCycle()) bar.classList.add('is-running');
    }

    function canCycle() {
        return inView && !hovering && !reduce && !mobile.matches;
    }

    function schedule() {
        clearTimeout(timer);
        root.classList.toggle('is-paused', !canCycle());
        if (canCycle()) timer = setTimeout(() => { setActive(current + 1); schedule(); }, CYCLE_MS);
    }

    root.style.setProperty('--svx-dur', CYCLE_MS + 'ms');

    // Desktop: hover / focus a row to show it
    items.forEach((el, k) => {
        el.addEventListener('mouseenter', () => { if (!mobile.matches) { setActive(k); } });
        el.addEventListener('focus', () => { if (!mobile.matches) { setActive(k); } });
    });
    root.addEventListener('mouseenter', () => { hovering = true; schedule(); restartBar(); });
    root.addEventListener('mouseleave', () => { hovering = false; schedule(); restartBar(); });

    // Mobile: the card snapped into view becomes active (drives dots + scale)
    let scrollRaf = 0;
    list.addEventListener('scroll', () => {
        if (!mobile.matches || scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
            scrollRaf = 0;
            const lr = list.getBoundingClientRect();
            let best = 0, bestD = Infinity;
            items.forEach((el, k) => {
                const d = Math.abs(el.getBoundingClientRect().left - lr.left - 16);
                if (d < bestD) { bestD = d; best = k; }
            });
            if (best !== current) setActive(best);
        });
    }, { passive: true });

    mobile.addEventListener('change', () => { setActive(0); list.scrollLeft = 0; schedule(); });

    // Entrance + run the auto-cycle only while visible
    if ('IntersectionObserver' in window) {
        if (!reduce) root.classList.add('svx-anim');
        new IntersectionObserver((entries) => {
            inView = entries[0].isIntersecting;
            if (inView) root.classList.add('svx-in');
            schedule();
            restartBar();
        }, { threshold: 0.25 }).observe(root);
    } else {
        inView = true;
    }

    setActive(0);
    schedule();
}

// Helper: Show input error
function showFieldError(inputId, errorId, message) {
    const inputEl = document.getElementById(inputId);
    const errorEl = document.getElementById(errorId);
    if (inputEl) inputEl.classList.add('input-error');
    if (errorEl) errorEl.textContent = message;
}

// Helper: Clear input errors
function clearFormErrors() {
    const inputs = document.querySelectorAll('.input-error');
    inputs.forEach(input => input.classList.remove('input-error'));

    const errorTexts = document.querySelectorAll('.field-error');
    errorTexts.forEach(el => el.textContent = '');

    const formStatus = document.getElementById('formStatus');
    if (formStatus) {
        formStatus.style.display = 'none';
        formStatus.innerHTML = '';
    }
}

// Global Service Selection & Auto-Fill from Service Cards
window.selectServiceForEnquiry = function(serviceName) {
    const projectTypeSelect = document.getElementById('projectType');
    if (projectTypeSelect) {
        // Select matching option
        for (let i = 0; i < projectTypeSelect.options.length; i++) {
            if (projectTypeSelect.options[i].value === serviceName) {
                projectTypeSelect.selectedIndex = i;
                break;
            }
        }

        // Highlight field visually
        projectTypeSelect.focus();
        projectTypeSelect.style.outline = '2px solid var(--black)';
        projectTypeSelect.style.borderColor = 'var(--black)';
        setTimeout(() => {
            projectTypeSelect.style.outline = '';
            projectTypeSelect.style.borderColor = '';
        }, 1800);
    }

    // Smooth scroll down to consultation form
    const contactSection = document.getElementById('contact');
    if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
    }
};

// Utility to escape HTML to prevent XSS
function escapeHtml(string) {
    if (!string) return '';
    return String(string)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* About visuals (av2): pointer-driven 3D tilt with layered depth */
(function () {
    const run = () => {
        const box = document.getElementById('aboutVisuals');
        if (!box) return;
        if (window.matchMedia('(max-width: 0px)').matches) return;
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        let raf = 0, tx = 0, ty = 0;
        const apply = () => {
            raf = 0;
            box.style.setProperty('--tx', tx.toFixed(3));
            box.style.setProperty('--ty', ty.toFixed(3));
        };
        box.addEventListener('pointermove', (e) => {
            const r = box.getBoundingClientRect();
            tx = ((e.clientX - r.left) / r.width) * 2 - 1;
            ty = ((e.clientY - r.top) / r.height) * 2 - 1;
            if (!raf) raf = requestAnimationFrame(apply);
        });
        box.addEventListener('pointerleave', () => {
            tx = 0; ty = 0;
            if (!raf) raf = requestAnimationFrame(apply);
        });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();

/* Founder portrait: pointer-driven 3D tilt */
(function () {
    const run = () => {
        const box = document.getElementById('fdrPortrait');
        if (!box) return;
        if (window.matchMedia('(max-width: 0px)').matches) return;
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        let raf = 0, tx = 0, ty = 0;
        const apply = () => {
            raf = 0;
            box.style.setProperty('--tx', tx.toFixed(3));
            box.style.setProperty('--ty', ty.toFixed(3));
        };
        box.addEventListener('pointermove', (e) => {
            const r = box.getBoundingClientRect();
            tx = ((e.clientX - r.left) / r.width) * 2 - 1;
            ty = ((e.clientY - r.top) / r.height) * 2 - 1;
            if (!raf) raf = requestAnimationFrame(apply);
        });
        box.addEventListener('pointerleave', () => {
            tx = 0; ty = 0;
            if (!raf) raf = requestAnimationFrame(apply);
        });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();


/* Hero storm sound: rain + thunder, synthesised with Web Audio (no audio files to download).
   Plays only while the rain scene is on screen. Browsers allow sound only after the visitor
   taps/clicks/presses a key once; the speaker button turns it on/off and the choice is remembered. */
window.HBStorm = (function () {
    const AC = window.AudioContext || window.webkitAudioContext;
    const btn = document.getElementById('heroSound');
    if (!AC) { if (btn) btn.hidden = true; return { setActive() {}, thunder() {} }; }
    let ctx = null, master = null, rainGain = null, started = false;
    let active = false;
    let enabled = (() => { try { return localStorage.getItem('hbStormSound') !== 'off'; } catch (e) { return true; } })();
    let unlocked = false;

    function noiseBuffer(seconds, brown) {
        const len = Math.floor(ctx.sampleRate * seconds);
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch); let last = 0;
            for (let i = 0; i < len; i++) {
                const white = Math.random() * 2 - 1;
                if (brown) { last = (last + 0.02 * white) / 1.02; d[i] = last * 3.5; } else d[i] = white;
            }
        }
        return buf;
    }
    function build() {
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
        rainGain = ctx.createGain(); rainGain.gain.value = 0; rainGain.connect(master);
        // hiss of the rain
        const hiss = ctx.createBufferSource(); hiss.buffer = noiseBuffer(3, false); hiss.loop = true;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7500;
        const hissG = ctx.createGain(); hissG.gain.value = 0.16;
        hiss.connect(hp); hp.connect(lp); lp.connect(hissG); hissG.connect(rainGain);
        // body / roof patter
        const body = ctx.createBufferSource(); body.buffer = noiseBuffer(4, true); body.loop = true;
        const blp = ctx.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = 650;
        const bodyG = ctx.createGain(); bodyG.gain.value = 0.32;
        body.connect(blp); blp.connect(bodyG); bodyG.connect(rainGain);
        // slow gusts
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
        const lfoG = ctx.createGain(); lfoG.gain.value = 0.05; lfo.connect(lfoG); lfoG.connect(hissG.gain);
        hiss.start(); body.start(); lfo.start();
        started = true;
    }
    function apply() {
        const on = active && enabled && unlocked;
        if (btn) {
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            btn.setAttribute('aria-label', on ? 'Turn storm sound off' : 'Turn storm sound on');
            btn.classList.toggle('is-on', enabled && unlocked);
            const i = btn.querySelector('i'); if (i) i.className = 'fa-solid ' + (enabled && unlocked ? 'fa-volume-high' : 'fa-volume-xmark');
            const t = btn.querySelector('.hero-sound__txt'); if (t) t.textContent = !unlocked ? 'Tap for sound' : (enabled ? 'Sound on' : 'Sound off');
        }
        if (!ctx) return;
        const now = ctx.currentTime;
        rainGain.gain.cancelScheduledValues(now);
        rainGain.gain.setValueAtTime(rainGain.gain.value, now);
        rainGain.gain.linearRampToValueAtTime(on ? 1 : 0, now + (on ? 1.6 : 0.9));
        if (on && ctx.state === 'suspended') ctx.resume();
    }
    function unlock() {
        if (unlocked) return;
        unlocked = true;
        if (!ctx) build();
        if (ctx.state === 'suspended') ctx.resume();
        apply();
    }
    ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, (e) => { if (enabled && !(btn && btn.contains(e.target))) unlock(); }, { passive: true }));
    if (btn) btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!unlocked) { enabled = true; unlock(); }
        else enabled = !enabled;
        try { localStorage.setItem('hbStormSound', enabled ? 'on' : 'off'); } catch (err) {}
        apply();
    });
    document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        if (document.hidden) ctx.suspend(); else if (active && enabled && unlocked) ctx.resume();
    });

    function thunder(xFrac) {
        if (!(active && enabled && unlocked && ctx && started)) return;
        const t0 = ctx.currentTime + 0.25 + Math.random() * 0.9;   // sound arrives just after the flash
        const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (pan) pan.pan.value = Math.max(-0.8, Math.min(0.8, (xFrac - 0.5) * 1.6));
        const out = ctx.createGain(); out.gain.value = 1;
        if (pan) { out.connect(pan); pan.connect(master); } else out.connect(master);
        // sharp crack
        const crack = ctx.createBufferSource(); crack.buffer = noiseBuffer(0.6, false);
        const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 1800; cf.Q.value = 0.7;
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0, t0); cg.gain.linearRampToValueAtTime(0.55, t0 + 0.01); cg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
        crack.connect(cf); cf.connect(cg); cg.connect(out); crack.start(t0); crack.stop(t0 + 0.6);
        // long rolling rumble
        const dur = 3.5 + Math.random() * 2.5;
        const rum = ctx.createBufferSource(); rum.buffer = noiseBuffer(dur + 0.5, true);
        const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.setValueAtTime(420, t0); rf.frequency.exponentialRampToValueAtTime(90, t0 + dur);
        const rg = ctx.createGain();
        rg.gain.setValueAtTime(0, t0);
        rg.gain.linearRampToValueAtTime(1.1, t0 + 0.08);
        let t = t0 + 0.08, v = 1.1;
        while (t < t0 + dur - 0.4) {                     // uneven rolls
            t += 0.25 + Math.random() * 0.5; v *= 0.62 + Math.random() * 0.45;
            rg.gain.linearRampToValueAtTime(Math.max(0.05, v), t);
        }
        rg.gain.linearRampToValueAtTime(0.0001, t0 + dur);
        rum.connect(rf); rf.connect(rg); rg.connect(out); rum.start(t0); rum.stop(t0 + dur + 0.2);
    }

    apply();
    return {
        setActive(on) { active = on; if (btn) btn.classList.toggle('is-visible', on); apply(); },
        thunder
    };
})();

/* Hero final frame: rain + thunderstorm (runs only while the finished villa is shown) */
(function () {
    const run = () => {
        const canvas = document.getElementById('heroRain');
        const flash = document.getElementById('heroLightning');
        const stage = document.getElementById('heroStickyViewport');
        if (!canvas || !stage) return;
        if (window.matchMedia('(max-width: 0px)').matches) return;

        const ctx = canvas.getContext('2d');
        let w = 0, h = 0, dpr = 1, drops = [], splashes = [], bolt = null;
        let raf = 0, active = false, last = 0, nextStrike = 0;

        const resize = () => {
            dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            w = canvas.clientWidth; h = canvas.clientHeight;
            canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const count = Math.round(Math.min(420, (w * h) / 4200));
            drops = Array.from({ length: count }, () => makeDrop(true));
        };

        const makeDrop = (anyY) => {
            const z = Math.random();               // depth: 0 far … 1 near
            return {
                x: Math.random() * (w + 200) - 100,
                y: anyY ? Math.random() * h : -20 - Math.random() * 100,
                len: 10 + z * 22,
                speed: 700 + z * 900,              // px per second
                alpha: 0.15 + z * 0.35,
                width: 0.6 + z * 0.9,
                z
            };
        };

        // Branching lightning bolt from the sky
        const makeBolt = () => {
            const segs = [];
            const grow = (x, y, angle, len, depth) => {
                let cx = x, cy = y;
                const steps = 10 + Math.floor(Math.random() * 8);
                for (let i = 0; i < steps && cy < h * 0.62; i++) {
                    const nx = cx + Math.sin(angle) * len + (Math.random() - 0.5) * len * 0.9;
                    const ny = cy + Math.cos(angle) * len;
                    segs.push([cx, cy, nx, ny, depth]);
                    if (depth < 2 && Math.random() < 0.18) grow(nx, ny, angle + (Math.random() - 0.5) * 1.4, len * 0.7, depth + 1);
                    cx = nx; cy = ny;
                }
            };
            const sx = w * (0.35 + Math.random() * 0.55);
            grow(sx, -10, (Math.random() - 0.5) * 0.5, h * 0.045, 0);
            return { segs, born: performance.now(), x: sx };
        };

        const strike = (now) => {
            bolt = makeBolt();
            if (flash) {
                flash.style.setProperty('--lx', ((bolt.x / w) * 100).toFixed(1) + '%');
                flash.classList.remove('is-flash');
                void flash.offsetWidth;
                flash.classList.add('is-flash');
            }
            nextStrike = now + 3500 + Math.random() * 5500;
            if (window.HBStorm) window.HBStorm.thunder(bolt.x / Math.max(1, w));
        };

        const frame = (now) => {
            raf = 0;
            if (!active) { ctx.clearRect(0, 0, w, h); return; }
            const dt = Math.min(0.05, (now - (last || now)) / 1000);
            last = now;
            ctx.clearRect(0, 0, w, h);

            // rain streaks (slanted)
            const slant = 0.18;
            ctx.lineCap = 'round';
            for (const d of drops) {
                d.y += d.speed * dt;
                d.x += d.speed * dt * slant;
                if (d.y > h) {
                    if (d.z > 0.55 && Math.random() < 0.5) splashes.push({ x: d.x, y: h - 4 - Math.random() * h * 0.25, t: 0 });
                    Object.assign(d, makeDrop(false));
                }
                ctx.strokeStyle = `rgba(210, 225, 245, ${d.alpha})`;
                ctx.lineWidth = d.width;
                ctx.beginPath();
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(d.x - d.len * slant, d.y - d.len);
                ctx.stroke();
            }

            // splashes
            for (let i = splashes.length - 1; i >= 0; i--) {
                const s = splashes[i];
                s.t += dt;
                if (s.t > 0.35) { splashes.splice(i, 1); continue; }
                const k = s.t / 0.35;
                ctx.strokeStyle = `rgba(220, 232, 250, ${0.45 * (1 - k)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.ellipse(s.x, s.y, 2 + k * 9, 0.8 + k * 2.2, 0, Math.PI, 2 * Math.PI);
                ctx.stroke();
            }

            // lightning bolt
            if (now >= nextStrike) strike(now);
            if (bolt) {
                const age = now - bolt.born;
                const life = 420;
                if (age > life) bolt = null;
                else {
                    const flick = age < 70 || (age > 120 && age < 190) ? 1 : 0.35;
                    const a = (1 - age / life) * flick;
                    ctx.save();
                    ctx.shadowColor = 'rgba(190, 210, 255, 0.95)';
                    ctx.shadowBlur = 18;
                    for (const [x1, y1, x2, y2, depth] of bolt.segs) {
                        ctx.strokeStyle = `rgba(245, 248, 255, ${a * (depth ? 0.55 : 1)})`;
                        ctx.lineWidth = depth ? 1.1 : 2.4;
                        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
                    }
                    ctx.restore();
                }
            }

            raf = requestAnimationFrame(frame);
        };

        const sync = () => {
            const on = stage.classList.contains('hero-final-on');
            if (on === active) return;
            active = on;
            if (window.HBStorm) window.HBStorm.setActive(on);
            if (active) {
                if (!w) resize();
                last = 0;
                nextStrike = performance.now() + 900;   // first strike soon after the villa appears
                if (!raf) raf = requestAnimationFrame(frame);
            }
        };

        new MutationObserver(sync).observe(stage, { attributes: true, attributeFilter: ['class'] });
        window.addEventListener('resize', () => { if (active) resize(); else w = 0; }, { passive: true });
        document.addEventListener('visibilitychange', () => { if (document.hidden) { active = false; } else sync(); });
        sync();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();

/* Services v3: expanding panels — hover/focus/tap to open, auto-advance while visible */
(function () {
    const run = () => {
        const root = document.getElementById('sxp');
        if (!root) return;
        const panels = Array.from(root.querySelectorAll('.sxp-panel'));
        const reduce = window.matchMedia('(max-width: 0px)').matches;
        const mobile = () => window.matchMedia('(max-width: 860px)').matches;
        const DUR = 5000;
        let active = 0, timer = 0, inView = false, hovering = false, userTouched = false;
        root.style.setProperty('--sxp-dur', DUR + 'ms');

        const setActive = (i) => {
            active = (i + panels.length) % panels.length;
            panels.forEach((p, k) => {
                p.classList.toggle('is-active', k === active);
                p.setAttribute('aria-expanded', k === active ? 'true' : 'false');
            });
            restartBar();
        };

        const restartBar = () => {
            const bar = panels[active].querySelector('.sxp-bar');
            if (!bar) return;
            bar.style.animation = 'none';
            void bar.offsetWidth;
            bar.style.animation = '';
        };

        const canPlay = () => inView && !hovering && !userTouched && !reduce && !mobile();
        const schedule = () => {
            clearTimeout(timer);
            root.classList.toggle('is-playing', canPlay());
            if (canPlay()) timer = setTimeout(() => { setActive(active + 1); schedule(); }, DUR);
        };

        panels.forEach((p, i) => {
            p.addEventListener('mouseenter', () => { if (!mobile()) { hovering = true; setActive(i); schedule(); } });
            let wasActive = false;
            p.addEventListener('pointerdown', () => { wasActive = p.classList.contains('is-active'); });
            p.addEventListener('focus', () => { if (!mobile()) setActive(i); });
            // Mobile: first tap opens the panel, a second tap follows the link
            p.addEventListener('click', (e) => {
                if (mobile() && !wasActive) {
                    e.preventDefault();
                    userTouched = true;
                    setActive(i);
                    schedule();
                }
            });
        });
        root.addEventListener('mouseleave', () => { hovering = false; schedule(); });

        if ('IntersectionObserver' in window) {
            if (!reduce) root.classList.add('sxp-anim');
            new IntersectionObserver((entries) => {
                entries.forEach((en) => {
                    inView = en.isIntersecting;
                    if (inView) root.classList.add('sxp-in');
                    schedule();
                });
            }, { threshold: 0.12 }).observe(root);
        } else {
            inView = true;
            schedule();
        }

        window.addEventListener('resize', schedule, { passive: true });
        setActive(0);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();

/* Contact v2: draw the blueprint when the section comes into view */
(function () {
    const run = () => {
        const sec = document.querySelector('.contact-section.ct-v2');
        if (!sec) return;
        if (!('IntersectionObserver' in window)) { sec.classList.add('ct-in'); return; }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) { sec.classList.add('ct-in'); io.disconnect(); } });
        }, { threshold: 0.2 });
        io.observe(sec);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();

/* Services v4 showcase: hover / focus / tap a service to show its photo; gentle auto-advance on desktop */
(function () {
    const run = () => {
        const root = document.getElementById('sv4');
        if (!root) return;
        const rows = Array.from(root.querySelectorAll('.sv4-row'));
        const shots = Array.from(root.querySelectorAll('.sv4-shot'));
        const cur = root.querySelector('.sv4-cur');
        const desktop = () => window.matchMedia('(min-width: 901px)').matches;
        const reduce = window.matchMedia('(max-width: 0px)').matches;
        let active = 0, timer = 0, inView = false, hovering = false, touched = false;

        const set = (i) => {
            active = (i + rows.length) % rows.length;
            rows.forEach((r, k) => r.classList.toggle('is-active', k === active));
            shots.forEach((s, k) => s.classList.toggle('is-active', k === active));
            if (cur) cur.textContent = String(active + 1).padStart(2, '0');
            // warm up the next photo so it is ready before it is needed
            const next = shots[(active + 1) % shots.length];
            const img = next && next.querySelector('img');
            if (img && img.loading === 'lazy') img.loading = 'eager';
        };
        const schedule = () => {
            clearTimeout(timer);
            if (inView && !hovering && !touched && !reduce && desktop()) {
                timer = setTimeout(() => { set(active + 1); schedule(); }, 4500);
            }
        };

        rows.forEach((r, i) => {
            r.addEventListener('mouseenter', () => { if (desktop()) { set(i); } });
            r.addEventListener('focusin', () => { if (desktop()) { set(i); touched = true; schedule(); } });
        });
        root.addEventListener('mouseenter', () => { hovering = true; schedule(); });
        root.addEventListener('mouseleave', () => { hovering = false; schedule(); });

        if ('IntersectionObserver' in window) {
            new IntersectionObserver((es) => {
                es.forEach((e) => { inView = e.isIntersecting; schedule(); });
            }, { threshold: 0.3 }).observe(root);
        }
        window.addEventListener('resize', schedule, { passive: true });
        set(0);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();

/* Reviews fade loop: start only once the cards have finished appearing, and only while on screen */
(function () {
    const run = () => {
        const grid = document.querySelector('.testimonials-grid');
        if (!grid || !('IntersectionObserver' in window)) return;
        let started = false;
        new IntersectionObserver((es) => {
            es.forEach((e) => {
                if (e.isIntersecting && !started) {
                    started = true;
                    setTimeout(() => grid.classList.add('rv-loop'), 1400); // after the entrance animation
                }
                grid.style.setProperty('--rv-state', e.isIntersecting ? 'running' : 'paused');
                grid.querySelectorAll('.testimonial-card').forEach((c) => {
                    c.style.animationPlayState = e.isIntersecting ? '' : 'paused';
                });
            });
        }, { threshold: 0.25 }).observe(grid);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();
