/**
 * fa-fallback.js
 *
 * If the self-hosted Font Awesome stylesheet failed to load
 * (e.g. fresh clone without `npm install`), fall back to CDN —
 * UNLESS the user has explicitly disabled the third-party CDN
 * via Settings → Privacy → "Allow third-party CDN".
 *
 * Detection: probe a known FA glyph and check its computed font-family.
 * Runs once on DOMContentLoaded.
 */
(function () {
    'use strict';

    function cdnAllowed() {
        try {
            var v = localStorage.getItem('allowCdn');
            return v == null ? true : v === 'true';
        } catch (_) { return true; }
    }

    function localFaWorks() {
        var probe = document.createElement('i');
        probe.className = 'fas fa-link';
        probe.style.position = 'absolute';
        probe.style.left = '-9999px';
        probe.style.fontSize = '1px';
        probe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(probe);
        var family = '';
        try {
            family = window.getComputedStyle(probe, null).getPropertyValue('font-family') || '';
        } catch (_) { family = ''; }
        document.body.removeChild(probe);
        // FA sets font-family to "Font Awesome 6 Free" / "Font Awesome 6 Brands"
        return /Font ?Awesome/i.test(family);
    }

    function injectCdn() {
        if (document.getElementById('faStylesheetCdn')) return;
        var l = document.createElement('link');
        l.id = 'faStylesheetCdn';
        l.rel = 'stylesheet';
        l.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.1/css/all.min.css';
        l.integrity = 'sha512-5Hs3dF2AEPkpNAR7UiOHba+lRSJNeM2ECkwxUIxC1Q/FLycGTbNapWXB4tP889k5T5Ju8fs4b1P5z/iB4nMfSQ==';
        l.crossOrigin = 'anonymous';
        document.head.appendChild(l);
        console.warn('[FA] Local Font Awesome missing; loaded CDN fallback. Run `npm install` to self-host.');
    }

    function check() {
        if (localFaWorks()) return;
        if (!cdnAllowed()) {
            console.warn('[FA] Local Font Awesome missing AND CDN disabled by user. Icons may not render.');
            return;
        }
        injectCdn();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', check, { once: true });
    } else {
        check();
    }
})();
