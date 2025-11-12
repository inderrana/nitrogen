# Nitrogen - Smart Browser Homepage

A customizable browser start page with profile management, weather updates, and quick links.

## What is Nitrogen?

Nitrogen is a self-hosted browser start page that combines beauty with functionality. It features a customizable dashboard with real-time weather, quick links, reminders, and user profiles. Your data stays local and secure.

**Key Features:**
- 🎨 **Beautiful & Customizable** - Themes, links, weather, and more
- 🏠 **Self-hosted** - Run it on your own machine
- 📱 **Network accessible** - Use from any device on your network
- 🐳 **Docker-ready** - One command to run
- 🌤️ **Weather & Time** - Real-time updates with animations
- 🔗 **Quick Links** - Custom bookmarks and shortcuts

## Quick Start

### 1. Generate SSL Certificates

Run as **Administrator**:
```powershell
.\make-custom-cert.bat
```

This creates self-signed SSL certificates for HTTPS access.

### 2. Run with Docker

```powershell
.\docker-run.bat
```

This will:
- Build the Docker image
- Start the container
- Server runs automatically on boot (restart: unless-stopped)

### 3. Access the Application

Open your browser to:
- **Local:** `https://localhost:3443`
- **Network:** `https://YOUR-MACHINE-NAME:3443` (from other devices)

Accept the security warning (self-signed certificate).

## Docker Management

### Start Container
```powershell
.\docker-run.bat
# or
docker-compose up -d
```

### Stop Container
```powershell
.\docker-stop.bat
# or
docker-compose down
```

### View Logs
```powershell
docker logs nitrogen-server
docker logs -f nitrogen-server  # Follow logs
```

### Restart Container
```powershell
docker restart nitrogen-server
```

### Rebuild After Changes
```powershell
docker-compose up -d --build
```

## Import CA Certificate (Optional)

To remove browser security warnings:

**Firefox:**
1. Settings → Privacy & Security → Certificates → View Certificates
2. Authorities tab → Import
3. Select `ssl/ca/ca-cert.pem` from your Nitrogen folder
4. Check "Trust this CA to identify websites"

**Chrome/Edge:**
- Already trusted via Windows Certificate Store (if installed as Administrator)

## Network Access

The server listens on `0.0.0.0:3443`, making it accessible from:
- Same computer: `https://localhost:3443`
- Other devices on network: `https://YOUR-IP:3443` or `https://YOUR-MACHINE-NAME:3443`

To find your IP address:
```powershell
ipconfig
```

Look for "IPv4 Address" (e.g., `192.168.1.100`).

## File Structure

```
Nitrogen/
├── app/
│   ├── index.html           # Main application
│   ├── script.js            # Application logic
│   ├── style.css            # Styles
│   ├── user-profile.js      # Profile management
│   ├── crypto-utils.js      # Encryption utilities
│   └── favicon.svg          # Favicon
├── ssl/
│   ├── cert.pem             # Server certificate (not in git)
│   ├── key.pem              # Private key (not in git)
│   ├── server.cnf           # Server config
│   └── ca/
│       ├── ca-cert.pem      # Certificate Authority (not in git)
│       ├── ca-key.pem       # CA private key (not in git)
│       └── ca.cnf           # CA config
├── server.js                # HTTPS server
├── package.json             # Node.js package definition
├── Dockerfile               # Docker container definition
├── docker-compose.yml       # Docker orchestration
├── .dockerignore            # Docker build exclusions
├── .gitignore               # Git exclusions
├── make-custom-cert.bat     # Certificate generator
├── docker-run.bat           # Build & run container
├── docker-stop.bat          # Stop container
├── LINK-MANAGEMENT.md       # Link management guide
└── README.md                # This file
```

## Troubleshooting

### Common Issues
1. **Certificate Errors** - Run `.\make-custom-cert.bat` as Administrator
2. **Container Issues** - Check logs with `docker logs nitrogen-server`
3. **Port 3443 in Use** - Stop any conflicting services
4. **Access Issues** - Ensure you're using HTTPS and cookies are enabled

## Requirements

- **Docker Desktop** (for Windows)
- **OpenSSL** (via Git for Windows at `C:\Program Files\Git\usr\bin\openssl.exe`)
- **Windows** (tested on Windows 10/11)

## Support

For issues, check:
1. Browser console for errors
2. Docker logs with `docker logs nitrogen-server`

---

**Project:** Nitrogen  
**Version:** 1.0
