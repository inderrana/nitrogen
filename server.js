const https = require('https');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3443;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon'
};

// SSL options - will use properly generated certificate
const options = {
    key: fs.readFileSync('./ssl/key.pem'),
    cert: fs.readFileSync('./ssl/cert.pem')
};

const server = https.createServer(options, (req, res) => {
    console.log(`➤ ${req.method} ${req.url}`);
    
    // CORS headers - allow credentials (cookies) to work
    const origin = req.headers.origin || `https://localhost:${port}`;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Allow Font Awesome from CDN and local resources
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' data: https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com;");;

    let filePath = req.url;
    if (filePath === '/') {
        filePath = '/index.html';
    }

    // Build safe path within app directory
    filePath = path.join(__dirname, 'app', filePath);
    
    // Ensure the path is within the app directory
    const appDir = path.join(__dirname, 'app');
    if (!filePath.startsWith(appDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                console.error(`❌ 404 Not Found: ${filePath}`);
                res.writeHead(404);
                res.end('File not found');
            } else {
                console.error(`❌ File read error (${req.url}): ${error.code}`);
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            console.log(`✓ GET ${req.url} (${mimeType}) - ${content.length} bytes`);
            res.writeHead(200, { 
                'Content-Type': mimeType,
                'Content-Length': content.length
            });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(port, '0.0.0.0', () => {
    console.log('🔒 HTTPS Server Started Successfully!');
    console.log(`📍 Local: https://localhost:${port}/`);
    console.log(`🌐 Network: https://YOUR_IP_ADDRESS:${port}/`);
    console.log('🛡️  Security headers enabled');
    console.log('📋 Accept the certificate warning in your browser');
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
        console.log('� Please check that ssl/cert.pem and ssl/key.pem exist');
    } else if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port 3443 is already in use!`);
        console.log('💡 Close other servers or change the port number');
    } else {
        console.error('❌ Server error:', err);
    }
});