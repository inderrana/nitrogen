/**
 * pet-companion.js
 *
 * SVG-based pet companion with body-part animation.
 * Pure vanilla JS, no external deps. CSP-safe (no inline handlers).
 *
 * Pets: cat, turtle, unicorn, dragon (or 'none' to disable).
 * Each pet is a layered SVG with classed parts so CSS can animate
 * legs, tail, head, eyes, wings independently.
 *
 * Public API:
 *   window.petCompanion.setPet('cat' | 'turtle' | 'unicorn' | 'dragon' | 'none')
 *   window.petCompanion.summon()
 *   window.petCompanion.hide()
 */
(function () {
    'use strict';

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs, parent) => {
        const node = document.createElementNS(SVG_NS, tag);
        if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(node);
        return node;
    };
    const wrap = (children) => {
        const svg = el('svg', { viewBox: '0 0 100 80', xmlns: SVG_NS, class: 'pet-svg' });
        children(svg);
        return svg;
    };

    // ------------------------------------------------------------
    // SVG sprite builders. viewBox 100x80, ground at y=72.
    // Pets face right by default; CSS .pet-sprite.flip mirrors.
    // ------------------------------------------------------------
    const PET_BUILDERS = {
        cat(color = '#f5a623', accent = '#fff5e6') {
            return wrap((svg) => {
                el('path', {
                    class: 'pet-part pet-tail',
                    d: 'M 28 60 Q 12 50 16 30',
                    fill: 'none', stroke: color, 'stroke-width': '6', 'stroke-linecap': 'round',
                    style: 'transform-origin: 28px 60px;'
                }, svg);
                el('rect', { class: 'pet-part pet-leg pet-leg-bl', x: '38', y: '60', width: '8', height: '14', rx: '3', fill: color }, svg);
                el('rect', { class: 'pet-part pet-leg pet-leg-br', x: '52', y: '60', width: '8', height: '14', rx: '3', fill: color }, svg);
                el('ellipse', { class: 'pet-part pet-body', cx: '50', cy: '54', rx: '24', ry: '14', fill: color }, svg);
                el('ellipse', { cx: '50', cy: '60', rx: '14', ry: '7', fill: accent, opacity: '0.7' }, svg);
                el('rect', { class: 'pet-part pet-leg pet-leg-fl', x: '40', y: '60', width: '7', height: '14', rx: '3', fill: color }, svg);
                el('rect', { class: 'pet-part pet-leg pet-leg-fr', x: '54', y: '60', width: '7', height: '14', rx: '3', fill: color }, svg);
                const head = el('g', { class: 'pet-part pet-head', style: 'transform-origin: 72px 50px;' }, svg);
                el('circle', { cx: '72', cy: '44', r: '13', fill: color }, head);
                el('polygon', { points: '63,32 67,40 60,40', fill: color }, head);
                el('polygon', { points: '81,32 84,40 77,40', fill: color }, head);
                el('polygon', { points: '64,34 66,38 62,38', fill: '#ff9eb5' }, head);
                el('polygon', { points: '80,34 82,38 78,38', fill: '#ff9eb5' }, head);
                el('ellipse', { class: 'pet-part pet-eye pet-eye-l', cx: '68', cy: '44', rx: '1.7', ry: '2.6', fill: '#1a1a1a' }, head);
                el('ellipse', { class: 'pet-part pet-eye pet-eye-r', cx: '76', cy: '44', rx: '1.7', ry: '2.6', fill: '#1a1a1a' }, head);
                el('circle', { cx: '68.4', cy: '43.2', r: '0.5', fill: '#fff' }, head);
                el('circle', { cx: '76.4', cy: '43.2', r: '0.5', fill: '#fff' }, head);
                el('polygon', { points: '72,48 70,50 74,50', fill: '#ff8aab' }, head);
                el('path', { d: 'M 72 50 Q 70 53 68 52 M 72 50 Q 74 53 76 52', stroke: '#1a1a1a', 'stroke-width': '0.8', fill: 'none', 'stroke-linecap': 'round' }, head);
                el('path', { d: 'M 64 49 L 58 48 M 64 51 L 58 52 M 80 49 L 86 48 M 80 51 L 86 52', stroke: '#1a1a1a', 'stroke-width': '0.5', 'stroke-linecap': 'round' }, head);
            });
        },

        turtle(color = '#5cb85c', shellColor = '#7a4a25') {
            return wrap((svg) => {
                el('ellipse', { class: 'pet-part pet-leg pet-leg-bl', cx: '32', cy: '70', rx: '6', ry: '5', fill: color }, svg);
                el('ellipse', { class: 'pet-part pet-leg pet-leg-br', cx: '68', cy: '70', rx: '6', ry: '5', fill: color }, svg);
                el('ellipse', { class: 'pet-part pet-body', cx: '50', cy: '62', rx: '28', ry: '8', fill: color }, svg);
                el('ellipse', { class: 'pet-part pet-leg pet-leg-fl', cx: '38', cy: '70', rx: '5.5', ry: '4.5', fill: color }, svg);
                el('ellipse', { class: 'pet-part pet-leg pet-leg-fr', cx: '62', cy: '70', rx: '5.5', ry: '4.5', fill: color }, svg);
                el('polygon', { class: 'pet-part pet-tail', points: '24,62 18,60 24,58', fill: color, style: 'transform-origin: 24px 60px;' }, svg);
                el('ellipse', { cx: '50', cy: '50', rx: '26', ry: '18', fill: shellColor }, svg);
                el('path', { d: 'M 50 32 L 50 68 M 30 50 L 70 50 M 38 38 L 62 62 M 62 38 L 38 62', stroke: '#5a3618', 'stroke-width': '1.2', fill: 'none', opacity: '0.5' }, svg);
                el('ellipse', { cx: '50', cy: '50', rx: '24', ry: '16', fill: 'none', stroke: '#5a3618', 'stroke-width': '1.5' }, svg);
                const head = el('g', { class: 'pet-part pet-head', style: 'transform-origin: 78px 60px;' }, svg);
                el('ellipse', { cx: '78', cy: '54', rx: '8', ry: '7', fill: color }, head);
                el('circle', { class: 'pet-part pet-eye pet-eye-r', cx: '82', cy: '52', r: '1.4', fill: '#1a1a1a' }, head);
                el('circle', { class: 'pet-part pet-eye pet-eye-l', cx: '76', cy: '52', r: '1.4', fill: '#1a1a1a' }, head);
                el('circle', { cx: '82.4', cy: '51.5', r: '0.4', fill: '#fff' }, head);
                el('circle', { cx: '76.4', cy: '51.5', r: '0.4', fill: '#fff' }, head);
                el('path', { d: 'M 78 56 Q 80 58 82 57', stroke: '#1a1a1a', 'stroke-width': '0.6', fill: 'none', 'stroke-linecap': 'round' }, head);
            });
        },

        unicorn(color = '#ffffff', mane = '#ff79c6') {
            return wrap((svg) => {
                const tail = el('g', { class: 'pet-part pet-tail', style: 'transform-origin: 22px 50px;' }, svg);
                ['#ff5470', '#ffb84d', '#ffe066', '#73d572', '#62a4ff', '#b87cf6'].forEach((c, i) => {
                    el('path', {
                        d: `M 22 ${48 + i} Q 10 ${50 + i * 2} 8 ${36 + i * 2}`,
                        fill: 'none', stroke: c, 'stroke-width': '2', 'stroke-linecap': 'round'
                    }, tail);
                });
                el('rect', { class: 'pet-part pet-leg pet-leg-bl', x: '36', y: '60', width: '7', height: '15', rx: '2', fill: color }, svg);
                el('rect', { class: 'pet-part pet-leg pet-leg-br', x: '50', y: '60', width: '7', height: '15', rx: '2', fill: color }, svg);
                el('ellipse', { class: 'pet-part pet-body', cx: '48', cy: '52', rx: '24', ry: '13', fill: color, stroke: '#e8d8e8', 'stroke-width': '0.5' }, svg);
                el('ellipse', { cx: '48', cy: '58', rx: '14', ry: '6', fill: '#fff5fa', opacity: '0.7' }, svg);
                el('rect', { class: 'pet-part pet-leg pet-leg-fl', x: '40', y: '60', width: '6', height: '15', rx: '2', fill: color }, svg);
                el('rect', { class: 'pet-part pet-leg pet-leg-fr', x: '54', y: '60', width: '6', height: '15', rx: '2', fill: color }, svg);
                const head = el('g', { class: 'pet-part pet-head', style: 'transform-origin: 72px 50px;' }, svg);
                el('ellipse', { cx: '74', cy: '42', rx: '11', ry: '10', fill: color, stroke: '#e8d8e8', 'stroke-width': '0.5' }, head);
                el('ellipse', { cx: '80', cy: '50', rx: '5', ry: '6', fill: color }, head);
                el('path', { d: 'M 64 32 Q 60 38 64 44 Q 58 46 62 52 Q 56 56 60 60', stroke: mane, 'stroke-width': '4', fill: 'none', 'stroke-linecap': 'round' }, head);
                el('path', { d: 'M 67 30 Q 65 36 68 42', stroke: '#b87cf6', 'stroke-width': '3', fill: 'none', 'stroke-linecap': 'round' }, head);
                el('polygon', { class: 'pet-part pet-horn', points: '70,28 73,18 76,28', fill: '#ffd700', stroke: '#e6b800', 'stroke-width': '0.5' }, head);
                el('line', { x1: '71', y1: '26', x2: '75', y2: '24', stroke: '#e6b800', 'stroke-width': '0.6' }, head);
                el('line', { x1: '71', y1: '23', x2: '75', y2: '22', stroke: '#e6b800', 'stroke-width': '0.6' }, head);
                el('polygon', { points: '66,30 70,36 64,38', fill: color }, head);
                el('polygon', { points: '67,32 69,35 65,36', fill: '#ffc0e0' }, head);
                el('ellipse', { class: 'pet-part pet-eye pet-eye-r', cx: '78', cy: '42', rx: '1.6', ry: '2.6', fill: '#1a1a1a' }, head);
                el('circle', { cx: '78.5', cy: '41.4', r: '0.6', fill: '#fff' }, head);
                el('circle', { cx: '83', cy: '50', r: '0.6', fill: '#1a1a1a' }, head);
                el('path', { d: 'M 80 53 Q 82 54 84 53', stroke: '#1a1a1a', 'stroke-width': '0.5', fill: 'none' }, head);
            });
        },

        dragon(color = '#7ed957', belly = '#ffe066', wing = '#5fb33d') {
            return wrap((svg) => {
                const tail = el('g', { class: 'pet-part pet-tail', style: 'transform-origin: 28px 56px;' }, svg);
                el('path', { d: 'M 28 56 Q 14 56 10 42', stroke: color, 'stroke-width': '7', fill: 'none', 'stroke-linecap': 'round' }, tail);
                el('polygon', { points: '8,42 14,40 12,46', fill: color }, tail);
                el('polygon', { points: '20,52 22,48 24,52', fill: color, opacity: '0.7' }, tail);
                el('ellipse', { class: 'pet-part pet-leg pet-leg-bl', cx: '40', cy: '70', rx: '5', ry: '5', fill: color }, svg);
                el('ellipse', { class: 'pet-part pet-leg pet-leg-br', cx: '56', cy: '70', rx: '5', ry: '5', fill: color }, svg);
                el('ellipse', { class: 'pet-part pet-body', cx: '50', cy: '56', rx: '22', ry: '14', fill: color }, svg);
                el('ellipse', { cx: '50', cy: '60', rx: '12', ry: '7', fill: belly, opacity: '0.85' }, svg);
                el('path', { d: 'M 44 56 L 47 58 L 44 60 M 50 56 L 53 58 L 50 60 M 56 56 L 53 60', stroke: '#ffba33', 'stroke-width': '0.4', fill: 'none', opacity: '0.5' }, svg);
                const wingG = el('g', { class: 'pet-part pet-wing', style: 'transform-origin: 50px 48px;' }, svg);
                el('path', { d: 'M 48 48 Q 36 30 28 36 Q 32 44 42 50 Z', fill: wing, stroke: '#3d8a25', 'stroke-width': '0.8' }, wingG);
                el('path', { d: 'M 36 38 L 38 46 M 32 40 L 36 47', stroke: '#3d8a25', 'stroke-width': '0.5', fill: 'none', opacity: '0.6' }, wingG);
                el('ellipse', { class: 'pet-part pet-leg pet-leg-fl', cx: '44', cy: '70', rx: '4.5', ry: '4', fill: color }, svg);
                el('ellipse', { class: 'pet-part pet-leg pet-leg-fr', cx: '58', cy: '70', rx: '4.5', ry: '4', fill: color }, svg);
                el('polygon', { points: '40,42 42,38 44,42', fill: color }, svg);
                el('polygon', { points: '50,40 52,36 54,40', fill: color }, svg);
                el('polygon', { points: '60,42 62,38 64,42', fill: color }, svg);
                const head = el('g', { class: 'pet-part pet-head', style: 'transform-origin: 72px 52px;' }, svg);
                el('circle', { cx: '74', cy: '46', r: '12', fill: color }, head);
                el('ellipse', { cx: '82', cy: '50', rx: '6', ry: '4', fill: color }, head);
                el('ellipse', { cx: '76', cy: '52', rx: '5', ry: '2', fill: belly, opacity: '0.85' }, head);
                el('polygon', { points: '67,36 69,28 71,36', fill: '#5fb33d' }, head);
                el('polygon', { points: '76,36 78,28 80,36', fill: '#5fb33d' }, head);
                el('ellipse', { class: 'pet-part pet-eye pet-eye-r', cx: '78', cy: '44', rx: '2.5', ry: '3', fill: '#1a1a1a' }, head);
                el('circle', { cx: '79', cy: '43', r: '0.8', fill: '#fff' }, head);
                el('circle', { cx: '85', cy: '49', r: '0.5', fill: '#1a1a1a' }, head);
                el('polygon', { points: '79,52 80,55 81,52', fill: '#fff' }, head);
            });
        }
    };

    const PETS = {
        cat:     { name: 'Cat',         speed: 75,  bobAmp: 3, sounds: ['meow~', 'purr...', 'mrrrp?', 'nyaa~', '*stretches*'] },
        turtle:  { name: 'Turtle',      speed: 25,  bobAmp: 1, sounds: ['...slow...', 'hello!', '*munches*', 'zzz', 'wisdom.'] },
        unicorn: { name: 'Unicorn',     speed: 95,  bobAmp: 4, sounds: ['✨', 'hi friend!', 'magic time!', 'whee~', 'sparkle!'] },
        dragon:  { name: 'Baby Dragon', speed: 65,  bobAmp: 3, sounds: ['rawr!', '*tiny flame*', 'snrrk', 'graaa~', 'fly!'] }
    };

    const MIN_INTERVAL = 90 * 1000;
    const MAX_INTERVAL = 5 * 60 * 1000;
    const VISIT_DURATION_MIN = 14 * 1000;
    const VISIT_DURATION_MAX = 32 * 1000;

    const TRICKS = ['spin', 'jump', 'wiggle', 'pop', 'flipTrick', 'sit', 'dance'];
    const PARTICLES = ['💖', '✨', '⭐', '🎉', '💕', '🌟'];
    const FIRE_PARTICLES = ['🔥', '💥', '✨'];
    const SLEEP_PARTICLES = ['💤', 'z', 'Z'];

    // Sleep mode: after 30 minutes of no user activity, the pet
    // wanders over to the weather widget and naps behind it until
    // the user interacts with the page again.
    const IDLE_SLEEP_MS = 30 * 60 * 1000;
    const IDLE_CHECK_INTERVAL = 30 * 1000;
    // Cat only: small chance during a visit to jump on top of a
    // random widget and nap there.
    const CAT_NAP_CHANCE = 0.22;

    class PetCompanion {
        constructor() {
            this.container = null;
            this.sprite = null;
            this.svg = null;
            this.bubble = null;
            this.activePet = this.getStoredPet();
            this.visitTimer = null;
            this.dismissTimer = null;
            this.wanderTimer = null;
            this.blinkTimer = null;
            this.busy = false;
            this.flipped = false;
            this.clickCount = 0;
            this.clickResetTimer = null;
            this.lastActivityAt = Date.now();
            this.idleCheckTimer = null;
            this.isSleeping = false;
            this.napParticleTimer = null;
            this._activityHandler = null;
        }

        getStoredPet() {
            try { return localStorage.getItem('petCompanion') || 'none'; } catch { return 'none'; }
        }
        setPet(pet) {
            if (!PETS[pet] && pet !== 'none') return;
            this.activePet = pet;
            try { localStorage.setItem('petCompanion', pet); } catch {}
            this.hide();
            this.scheduleNext();
            if (pet !== 'none') {
                clearTimeout(this.visitTimer);
                this.visitTimer = setTimeout(() => this.summon(), 600);
            }
        }

        init() {
            this.container = document.getElementById('petContainer');
            if (!this.container) return;
            this.installActivityWatcher();
            this.scheduleNext();
        }

        installActivityWatcher() {
            if (this._activityHandler) return;
            // Track real user activity so we know how long the page has been
            // idle. We do NOT auto-wake the pet on every mouse move — the pet
            // only wakes when the user clicks it (handled in onClick).
            const mark = () => { this.lastActivityAt = Date.now(); };
            this._activityHandler = mark;
            ['mousedown', 'keydown', 'touchstart', 'wheel'].forEach(ev => {
                document.addEventListener(ev, mark, { passive: true });
            });
            clearInterval(this.idleCheckTimer);
            this.idleCheckTimer = setInterval(() => this.checkIdle(), IDLE_CHECK_INTERVAL);
        }

        checkIdle() {
            if (this.activePet === 'none') return;
            if (this.isSleeping) return;
            if (Date.now() - this.lastActivityAt < IDLE_SLEEP_MS) return;
            // User has been idle for 30+ minutes — nap behind the weather widget.
            this.goToSleepBehindWeather();
        }

        scheduleNext() {
            clearTimeout(this.visitTimer);
            if (this.activePet === 'none' || !PETS[this.activePet]) return;
            const wait = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
            this.visitTimer = setTimeout(() => this.summon(), wait);
        }

        summon() {
            if (this.busy) return;
            const meta = PETS[this.activePet];
            const builder = PET_BUILDERS[this.activePet];
            if (!meta || !builder) return;
            this.busy = true;
            this.flipped = false;

            const sprite = document.createElement('div');
            sprite.className = 'pet-sprite walking pet-' + this.activePet;
            sprite.setAttribute('role', 'button');
            sprite.setAttribute('tabindex', '0');
            sprite.setAttribute('aria-label', meta.name + ' friend. Click for a trick.');
            sprite.title = meta.name + ' (click me!)';
            sprite.style.setProperty('--bob-amp', meta.bobAmp + 'px');

            const svg = builder();
            sprite.appendChild(svg);

            const bubble = document.createElement('div');
            bubble.className = 'pet-bubble';
            sprite.appendChild(bubble);

            this.sprite = sprite;
            this.svg = svg;
            this.bubble = bubble;
            this.container.appendChild(sprite);

            const enterFromLeft = Math.random() > 0.5;
            const vw = window.innerWidth;
            const startX = enterFromLeft ? -100 : vw + 20;
            const targetX = 80 + Math.random() * Math.max(120, vw - 200);
            sprite.style.left = startX + 'px';
            this.face(!enterFromLeft);

            this.walkTo(targetX, () => {
                this.startIdle();
                this.maybeGreet();
            });

            sprite.addEventListener('click', () => this.onClick());
            sprite.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.onClick();
                }
            });

            this.startBlinking();

            const visitMs = VISIT_DURATION_MIN + Math.random() * (VISIT_DURATION_MAX - VISIT_DURATION_MIN);
            this.dismissTimer = setTimeout(() => this.leave(), visitMs);
        }

        face(flip) {
            this.flipped = flip;
            if (this.sprite) this.sprite.classList.toggle('flip', flip);
        }

        walkTo(targetX, done) {
            if (!this.sprite) return;
            const startX = parseFloat(this.sprite.style.left || '0');
            const dist = targetX - startX;
            this.face(dist < 0);
            this.setMode('walking');

            const speedPxPerSec = PETS[this.activePet].speed;
            const durationMs = Math.max(400, Math.abs(dist) / speedPxPerSec * 1000);
            this.sprite.style.transition = `left ${durationMs}ms linear`;
            void this.sprite.offsetWidth;
            this.sprite.style.left = targetX + 'px';
            setTimeout(() => {
                if (!this.sprite) return;
                this.sprite.style.transition = '';
                if (typeof done === 'function') done();
            }, durationMs + 30);
        }

        setMode(mode) {
            if (!this.sprite) return;
            this.sprite.classList.remove('walking', 'idle', 'sitting');
            this.sprite.classList.add(mode);
        }

        startIdle() {
            if (!this.sprite) return;
            this.setMode('idle');
            clearInterval(this.wanderTimer);
            // Cat occasionally jumps up onto a random widget to nap.
            if (this.activePet === 'cat' && !this.isSleeping && Math.random() < CAT_NAP_CHANCE) {
                setTimeout(() => { if (this.sprite && !this.isSleeping) this.napOnRandomWidget(); }, 1200);
                return;
            }
            this.wanderTimer = setInterval(() => {
                if (!this.sprite || this.busy === false) return;
                if (this.isSleeping) return;
                if (Math.random() < 0.45) {
                    const vw = window.innerWidth;
                    const cur = parseFloat(this.sprite.style.left || '0');
                    const next = Math.max(20, Math.min(vw - 100, cur + (Math.random() * 240 - 120)));
                    this.walkTo(next, () => this.startIdle());
                }
            }, 4500);
        }

        startBlinking() {
            clearTimeout(this.blinkTimer);
            const next = 2500 + Math.random() * 4500;
            this.blinkTimer = setTimeout(() => {
                if (!this.sprite) return;
                this.sprite.classList.add('blink');
                setTimeout(() => {
                    if (this.sprite) this.sprite.classList.remove('blink');
                    this.startBlinking();
                }, 160);
            }, next);
        }

        leave() {
            if (!this.sprite) { this.busy = false; this.scheduleNext(); return; }
            clearInterval(this.wanderTimer);
            const vw = window.innerWidth;
            const cur = parseFloat(this.sprite.style.left || '0');
            const exitLeft = cur < vw / 2;
            const targetX = exitLeft ? -100 : vw + 100;
            this.walkTo(targetX, () => this.cleanup());
        }

        cleanup() {
            if (this.sprite && this.sprite.parentNode) this.sprite.parentNode.removeChild(this.sprite);
            this.sprite = null;
            this.svg = null;
            this.bubble = null;
            this.busy = false;
            this.isSleeping = false;
            clearTimeout(this.dismissTimer);
            clearInterval(this.wanderTimer);
            clearTimeout(this.blinkTimer);
            clearInterval(this.napParticleTimer);
            this.scheduleNext();
        }

        hide() { this.cleanup(); }

        maybeGreet() {
            if (Math.random() < 0.5) {
                const meta = PETS[this.activePet];
                if (meta) this.say(meta.sounds[0]);
            }
        }

        onClick() {
            if (!this.sprite) return;
            const meta = PETS[this.activePet];
            if (!meta) return;

            // Sleeping pet wakes on click instead of doing a trick.
            if (this.isSleeping) {
                this.wake();
                return;
            }

            this.clickCount++;
            clearTimeout(this.clickResetTimer);
            this.clickResetTimer = setTimeout(() => { this.clickCount = 0; }, 4000);

            // Pet-specific reactions
            if (this.activePet === 'dragon' && Math.random() < 0.4) {
                this.breatheFire();
                this.say(meta.sounds[Math.floor(Math.random() * meta.sounds.length)]);
                this.extendVisit();
                if (this.clickCount >= 5) { this.megaCelebrate(); this.clickCount = 0; }
                return;
            }
            if (this.activePet === 'unicorn' && Math.random() < 0.4) {
                this.rainbowTrail();
            }

            const trick = TRICKS[Math.floor(Math.random() * TRICKS.length)];
            this.playAnimation(trick);
            this.spawnParticles();
            this.say(meta.sounds[Math.floor(Math.random() * meta.sounds.length)]);

            if (this.clickCount >= 5) { this.megaCelebrate(); this.clickCount = 0; }
            this.extendVisit();
        }

        extendVisit() {
            clearTimeout(this.dismissTimer);
            this.dismissTimer = setTimeout(() => this.leave(), 18000);
        }

        playAnimation(name) {
            if (!this.sprite) return;
            TRICKS.forEach(t => this.sprite.classList.remove(t));
            this.sprite.classList.remove('idle');
            void this.sprite.offsetWidth;
            this.sprite.classList.add(name);
            const onEnd = () => {
                if (!this.sprite) return;
                this.sprite.classList.remove(name);
                this.startIdle();
                this.sprite.removeEventListener('animationend', onEnd);
            };
            this.sprite.addEventListener('animationend', onEnd);
        }

        spawnParticles(count = 6, pool = PARTICLES) {
            if (!this.sprite) return;
            for (let i = 0; i < count; i++) {
                const p = document.createElement('span');
                p.className = 'pet-particle';
                p.textContent = pool[Math.floor(Math.random() * pool.length)];
                p.style.left = (20 + Math.random() * 50) + 'px';
                p.style.top = (-10 + Math.random() * 10) + 'px';
                p.style.setProperty('--dx', (Math.random() * 100 - 50) + 'px');
                p.style.setProperty('--dy', -(40 + Math.random() * 70) + 'px');
                this.sprite.appendChild(p);
                setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, 1300);
            }
        }

        breatheFire() {
            if (!this.sprite) return;
            this.playAnimation('breathe');
            const dir = this.flipped ? -1 : 1;
            for (let i = 0; i < 14; i++) {
                setTimeout(() => {
                    if (!this.sprite) return;
                    const p = document.createElement('span');
                    p.className = 'pet-particle pet-fire';
                    p.textContent = FIRE_PARTICLES[Math.floor(Math.random() * FIRE_PARTICLES.length)];
                    p.style.left = (this.flipped ? 5 : 70) + 'px';
                    p.style.top = '15px';
                    p.style.setProperty('--dx', (dir * (40 + i * 8)) + 'px');
                    p.style.setProperty('--dy', (Math.random() * 20 - 10) + 'px');
                    this.sprite.appendChild(p);
                    setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, 1200);
                }, i * 50);
            }
        }

        rainbowTrail() {
            if (!this.sprite) return;
            const colors = ['🔴','🟠','🟡','🟢','🔵','🟣'];
            for (let i = 0; i < 12; i++) {
                setTimeout(() => {
                    if (!this.sprite) return;
                    const p = document.createElement('span');
                    p.className = 'pet-particle';
                    p.textContent = colors[i % colors.length];
                    p.style.fontSize = '12px';
                    p.style.left = (30 + Math.random() * 40) + 'px';
                    p.style.top = '0px';
                    p.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
                    p.style.setProperty('--dy', -(20 + Math.random() * 50) + 'px');
                    this.sprite.appendChild(p);
                    setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, 1500);
                }, i * 60);
            }
        }

        say(text) {
            if (!this.bubble) return;
            this.bubble.textContent = text;
            this.bubble.classList.add('show');
            clearTimeout(this._bubbleTimer);
            this._bubbleTimer = setTimeout(() => {
                if (this.bubble) this.bubble.classList.remove('show');
            }, 2200);
        }

        megaCelebrate() {
            this.spawnParticles(24);
            this.say('🎉 woooo!');
            this.playAnimation('flipTrick');
        }

        // ----------------------------------------------------------
        // Sleep behind the weather widget after long user idle.
        // ----------------------------------------------------------
        goToSleepBehindWeather() {
            const weather = document.querySelector('.weather-widget');
            if (!weather) return;
            this.isSleeping = true;
            // Cancel pending visit/dismiss timers; sleep is open-ended.
            clearTimeout(this.visitTimer);
            clearTimeout(this.dismissTimer);
            clearInterval(this.wanderTimer);

            // Build the sprite if it isn't out yet.
            if (!this.sprite) {
                const meta = PETS[this.activePet];
                const builder = PET_BUILDERS[this.activePet];
                if (!meta || !builder) { this.isSleeping = false; return; }
                this.busy = true;
                this.flipped = false;
                const sprite = document.createElement('div');
                sprite.className = 'pet-sprite walking pet-' + this.activePet;
                sprite.setAttribute('role', 'button');
                sprite.setAttribute('tabindex', '0');
                sprite.setAttribute('aria-label', meta.name + ' friend is sleeping. Click to wake.');
                sprite.title = meta.name + ' friend (sleeping… click to wake)';
                sprite.style.setProperty('--bob-amp', meta.bobAmp + 'px');
                sprite.appendChild(builder());
                const bubble = document.createElement('div');
                bubble.className = 'pet-bubble';
                sprite.appendChild(bubble);
                sprite.addEventListener('click', () => this.onClick());
                sprite.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onClick(); }
                });
                this.sprite = sprite;
                this.svg = sprite.querySelector('svg');
                this.bubble = bubble;
                this.container.appendChild(sprite);
                // Start off-screen on whichever side weather is closer to.
                const wRect = weather.getBoundingClientRect();
                const enterFromLeft = wRect.left > window.innerWidth / 2;
                sprite.style.left = (enterFromLeft ? -100 : window.innerWidth + 20) + 'px';
                this.face(!enterFromLeft);
            }

            // Walk to a spot just behind the right edge of the weather widget,
            // so the pet peeks out only slightly. Pet container is z:50,
            // weather widget is z:100 — pet naturally renders behind it.
            const wRect = weather.getBoundingClientRect();
            const spriteWidth = 110;
            const peekX = Math.max(20, Math.round(wRect.right - spriteWidth * 0.45));
            this.walkTo(peekX, () => this.enterSleepMode());
        }

        enterSleepMode() {
            if (!this.sprite) return;
            if (!this.isSleeping) return; // user woke us during the walk
            this.setMode('idle');
            this.sprite.classList.add('sleeping', 'behind-widget');
            this.startSleepParticles();
            this.say('zzz…');
        }

        startSleepParticles() {
            clearInterval(this.napParticleTimer);
            const tick = () => {
                if (!this.sprite || !this.isSleeping) return;
                const p = document.createElement('span');
                p.className = 'pet-particle pet-sleep';
                p.textContent = SLEEP_PARTICLES[Math.floor(Math.random() * SLEEP_PARTICLES.length)];
                p.style.left = (40 + Math.random() * 30) + 'px';
                p.style.top = '0px';
                p.style.fontSize = (12 + Math.random() * 6) + 'px';
                p.style.setProperty('--dx', (Math.random() * 30 - 15) + 'px');
                p.style.setProperty('--dy', '-50px');
                this.sprite.appendChild(p);
                setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, 2400);
            };
            this.napParticleTimer = setInterval(tick, 1800);
            tick();
        }

        wake() {
            if (!this.isSleeping) return;
            this.isSleeping = false;
            clearInterval(this.napParticleTimer);
            this.lastActivityAt = Date.now();
            if (this.sprite) {
                this.sprite.classList.remove('sleeping', 'behind-widget', 'on-widget');
                this.sprite.style.zIndex = '';
                this.sprite.style.bottom = '';
                this.say('*yawn*');
                // Wander a bit then exit normally.
                this.startIdle();
                clearTimeout(this.dismissTimer);
                this.dismissTimer = setTimeout(() => this.leave(), 8000);
            } else {
                this.scheduleNext();
            }
        }

        // ----------------------------------------------------------
        // Cat nap on a random widget (cat only).
        // ----------------------------------------------------------
        napOnRandomWidget() {
            if (!this.sprite || this.activePet !== 'cat') return;
            const widgets = Array.from(document.querySelectorAll('.draggable-widget'))
                .filter(w => {
                    if (w.style.display === 'none') return false;
                    const r = w.getBoundingClientRect();
                    return r.width > 60 && r.height > 30 && r.top > 40 && r.bottom < window.innerHeight - 20;
                });
            if (!widgets.length) return;
            const target = widgets[Math.floor(Math.random() * widgets.length)];
            const rect = target.getBoundingClientRect();
            const spriteWidth = 110;
            const spriteHeight = 88;
            // Walk to under the widget first.
            const groundX = Math.max(10, Math.min(window.innerWidth - spriteWidth - 10,
                rect.left + rect.width / 2 - spriteWidth / 2));
            clearInterval(this.wanderTimer);
            clearTimeout(this.dismissTimer);
            this.busy = true;
            this.walkTo(groundX, () => {
                if (!this.sprite) return;
                // Hop up onto the widget: switch to absolute positioning
                // anchored from the bottom of the viewport so it sits on top.
                const targetBottom = window.innerHeight - rect.top - spriteHeight + 14;
                this.sprite.style.transition = 'bottom 0.5s cubic-bezier(.2,1.4,.4,1), left 0.4s ease';
                this.sprite.style.zIndex = '200'; // above widgets (which are 100)
                this.sprite.classList.add('on-widget');
                this.playAnimation('jump');
                requestAnimationFrame(() => {
                    if (!this.sprite) return;
                    this.sprite.style.bottom = targetBottom + 'px';
                });
                setTimeout(() => {
                    if (!this.sprite) return;
                    this.sprite.style.transition = '';
                    this.setMode('idle');
                    this.sprite.classList.add('sleeping');
                    this.startSleepParticles();
                    this.isSleeping = true;
                    this.say('purr… zzz');
                }, 700);
            });
        }
    }

    function boot() {
        const pc = new PetCompanion();
        window.petCompanion = pc;
        pc.init();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
