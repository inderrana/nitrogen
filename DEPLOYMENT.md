# Deployment Guide

This application can be deployed in two ways:

## 🐳 Docker Deployment

### Build and Run with Docker Compose:
```bash
docker-compose up -d
```

### Or use the Windows batch files:
```bash
# Start the server
docker-run.bat

# Stop the server
docker-stop.bat
```

The server will be available at `https://localhost:3443`

**Requirements:**
- Docker Desktop installed
- SSL certificates generated in `ssl/` folder (run `make-custom-cert.bat`)

---

## ▲ Vercel Deployment

### Deploy to Vercel:

1. **Install Vercel CLI** (if not already installed):
```bash
npm install -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Deploy**:
```bash
vercel
```

For production:
```bash
vercel --prod
```

### Or deploy via Git:
1. Push your code to GitHub
2. Connect your repository to Vercel at [vercel.com](https://vercel.com)
3. Vercel will automatically deploy on every push

**Notes:**
- Vercel uses HTTP (serverless functions don't support HTTPS configuration)
- SSL/TLS is handled by Vercel's edge network
- The app directory is served as static files
- No SSL certificates needed for Vercel deployment

---

## 🔑 Key Differences

| Feature | Docker | Vercel |
|---------|--------|--------|
| Protocol | HTTPS (self-signed cert) | HTTPS (Vercel managed) |
| Port | 3443 | 80/443 (automatic) |
| SSL Setup | Manual (make-custom-cert.bat) | Automatic |
| Scaling | Single container | Serverless (auto-scale) |
| Best For | Local development, private networks | Public production deployment |

---

## 🛠 Local Development

Run locally without Docker:
```bash
npm start
```

Server will start on `https://localhost:3443` (or HTTP if no SSL certificates found)
