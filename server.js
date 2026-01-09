const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3443;
const isVercel = process.env.VERCEL || process.env.NOW_REGION;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Request handler function
const handleRequest = (req, res) => {
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