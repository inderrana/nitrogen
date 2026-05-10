const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const port = process.env.PORT || 3443;
const isVercel = process.env.VERCEL || process.env.NOW_REGION;
const isProd = process.env.NODE_ENV === 'production' || isVercel;

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.txt':  'text/plain; charset=utf-8',
    '.map':  'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8'
};

// Long cache for static assets, no-cache for HTML so updates are picked up immediately
const cacheControlFor = (ext) => {
    if (ext === '.html' || ext === '') return 'no-cache, must-revalidate';
    if (ext === '.json' || ext === '.map') return 'no-cache, must-revalidate';
    // Static assets: 1h fresh + 1d SWR (works well for an unhashed app)
    return 'public, max-age=3600, stale-while-revalidate=86400';
};

// CSP: no wildcard, no inline scripts. Inline styles still allowed for compatibility.
// Connect-src includes Open-Meteo (used by script.js) and OpenWeatherMap (used optionally).
const CSP = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "style-src-elem 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "script-src 'self'",
    "connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com https://api.openweathermap.org",
    "manifest-src 'self'"
].join('; ');

const setCommonSecurityHeaders = (res, isHttps) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(), camera=(), payment=(), usb=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', CSP);
    if (isHttps) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
};

// Resolve once for path-traversal checks
const APP_DIR = path.resolve(__dirname, 'app');

// Request handler function
const handleRequest = (req, res) => {
    const isHttps = !!(req.socket && req.socket.encrypted) || !!req.headers['x-forwarded-proto']?.includes('https');
    if (!isProd) console.log(`> ${req.method} ${req.url}`);

    setCommonSecurityHeaders(res, isHttps);

    // Reject anything that isn't a safe read method
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Allow': 'GET, HEAD' });
        res.end('Method Not Allowed');
        return;
    }

    // Parse + decode URL safely; strip query string and hash
    let urlPath;
    try {
        urlPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
    } catch {
        res.writeHead(400);
        res.end('Bad Request');
        return;
    }
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

    // Lightweight liveness probe (used by uptime checks; never reads disk)
    if (urlPath === '/healthz') {
        res.writeHead(204, { 'Cache-Control': 'no-store' });
        return res.end();
    }

    // Reject NUL bytes and Windows path separators
    if (urlPath.indexOf('\0') !== -1 || urlPath.indexOf('\\') !== -1) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
    }

    // Resolve final path and verify containment inside APP_DIR
    const filePath = path.resolve(APP_DIR, '.' + urlPath);
    if (filePath !== APP_DIR && !filePath.startsWith(APP_DIR + path.sep)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeType = mimeTypes[extname] || 'application/octet-stream';

    fs.stat(filePath, (statErr, stat) => {
        if (statErr || !stat.isFile()) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        // Build a weak ETag from size + mtime — enables 304s
        const etag = 'W/"' + crypto.createHash('sha1')
            .update(stat.size + '-' + stat.mtimeMs).digest('hex').slice(0, 16) + '"';

        if (req.headers['if-none-match'] === etag) {
            res.writeHead(304, {
                'ETag': etag,
                'Cache-Control': cacheControlFor(extname)
            });
            return res.end();
        }

        const headers = {
            'Content-Type': mimeType,
            'Content-Length': stat.size,
            'Cache-Control': cacheControlFor(extname),
            'ETag': etag,
            'Last-Modified': stat.mtime.toUTCString()
        };

        if (req.method === 'HEAD') {
            res.writeHead(200, headers);
            return res.end();
        }

        res.writeHead(200, headers);
        const stream = fs.createReadStream(filePath);
        stream.on('error', () => { try { res.destroy(); } catch {} });
        stream.pipe(res);
    });
};

// For Vercel serverless function
if (isVercel) {
    module.exports = handleRequest;
} else {
    // For local/Docker HTTPS server
    let server;
    
    // Check if SSL certificates exist
    const sslKeyPath = './ssl/key.pem';
    const sslCertPath = './ssl/cert.pem';
    
    if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
        // Use HTTPS if certificates are available
        const options = {
            key: fs.readFileSync(sslKeyPath),
            cert: fs.readFileSync(sslCertPath)
        };
        server = https.createServer(options, handleRequest);
        console.log('🔒 Starting HTTPS server...');
    } else {
        // Fallback to HTTP if no certificates
        server = http.createServer(handleRequest);
        console.log('⚠️  SSL certificates not found, starting HTTP server...');
    }
    
    server.listen(port, '0.0.0.0', () => {
        const protocol = server instanceof https.Server ? 'https' : 'http';
        console.log(`${protocol === 'https' ? '🔒' : '🌐'} Server Started Successfully!`);
        console.log(`📍 Local: ${protocol}://localhost:${port}/`);
        console.log(`🌐 Network: ${protocol}://YOUR_IP_ADDRESS:${port}/`);
        console.log('🛡️  Security headers enabled');
        if (protocol === 'https') {
            console.log('📋 Accept the certificate warning in your browser');
        }
        console.log('💡 To find your IP: run "ipconfig" and look for IPv4 Address');
        console.log('⏹️  Press Ctrl+C to stop server');
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🔴 Server stopped gracefully');
        server.close();
        process.exit();
    });

    // Error handling
    server.on('error', (err) => {
        if (err.code === 'ENOENT') {
            console.log('❌ SSL certificates not found in ssl/ folder!');
            console.log('💡 Please check that ssl/cert.pem and ssl/key.pem exist');
        } else if (err.code === 'EADDRINUSE') {
            console.log(`❌ Port ${port} is already in use!`);
            console.log('💡 Close other servers or change the port number');
        } else {
            console.error('❌ Server error:', err);
        }
    });
}