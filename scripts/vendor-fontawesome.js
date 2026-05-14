#!/usr/bin/env node
/**
 * vendor-fontawesome.js
 *
 * Copies Font Awesome free CSS + webfonts from node_modules into
 * app/vendor/fontawesome/ so the app can be served fully self-hosted
 * (no third-party CDN call to cdnjs.cloudflare.com).
 *
 * Runs automatically on `npm install` (postinstall) and on Vercel build.
 * Safe to re-run; existing files are overwritten.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'node_modules', '@fortawesome', 'fontawesome-free');
const DEST = path.join(ROOT, 'app', 'vendor', 'fontawesome');

function log(msg) { process.stdout.write('[vendor-fa] ' + msg + '\n'); }
function warn(msg) { process.stderr.write('[vendor-fa] ' + msg + '\n'); }

function copyDir(src, dest) {
    if (!fs.existsSync(src)) return false;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(s, d);
        } else if (entry.isFile()) {
            fs.copyFileSync(s, d);
        }
    }
    return true;
}

function main() {
    if (!fs.existsSync(SRC)) {
        warn('Font Awesome package not found at ' + SRC);
        warn('Run `npm install` first. Skipping vendor copy.');
        // Exit 0 so postinstall does not fail the install
        process.exit(0);
    }

    // Clean dest
    if (fs.existsSync(DEST)) {
        fs.rmSync(DEST, { recursive: true, force: true });
    }

    // Copy only what we actually use: css/all.min.css + webfonts/
    const cssOk = copyDir(path.join(SRC, 'css'), path.join(DEST, 'css'));
    const fontsOk = copyDir(path.join(SRC, 'webfonts'), path.join(DEST, 'webfonts'));

    if (!cssOk || !fontsOk) {
        warn('Could not copy css/ or webfonts/ from ' + SRC);
        process.exit(0);
    }

    // Read FA version for log
    let version = 'unknown';
    try {
        version = JSON.parse(
            fs.readFileSync(path.join(SRC, 'package.json'), 'utf8')
        ).version;
    } catch { /* noop */ }

    log('Font Awesome ' + version + ' vendored into app/vendor/fontawesome/');
}

try { main(); } catch (e) { warn('Failed: ' + e.message); process.exit(0); }
