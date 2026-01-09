# Vercel Deployment Guide

This application is now compatible with Vercel deployment. Here's how to deploy:

## Quick Deployment

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy from the project directory:
   ```bash
   vercel
   ```

4. For production deployment:
   ```bash
   vercel --prod
   ```

### Option 2: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your Git repository (GitHub, GitLab, or Bitbucket)
4. Vercel will automatically detect the configuration from `vercel.json`
5. Click "Deploy"

## Project Structure for Vercel

```
N2/
├── api/                 # Serverless API functions
│   └── index.js        # API endpoint
├── public/             # Static files (HTML, CSS, JS)
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── ...
├── app/                # Original app files (kept for local development)
├── vercel.json         # Vercel configuration
├── package.json        # Node.js dependencies
└── server.js           # Local development server (not used on Vercel)
```

## Key Changes Made

1. **vercel.json**: Configuration file that tells Vercel how to build and route the application
2. **api/index.js**: Serverless function for API endpoints (currently a health check)
3. **public/**: Directory containing static files that Vercel will serve
4. **package.json**: Updated with Vercel-compatible scripts and Node.js version

## Local Development vs. Production

### Local Development (HTTPS with SSL)
```bash
npm start
```
- Runs `server.js` with HTTPS on port 3443
- Uses SSL certificates from `ssl/` directory
- Good for testing locally with security features

### Vercel Production
- Automatically serves static files from `public/`
- Provides HTTPS automatically (no SSL certificates needed)
- Serverless functions in `api/` directory
- Global CDN distribution

## Important Notes

- **SSL Certificates**: Not needed on Vercel (handled automatically)
- **Environment Variables**: Set in Vercel dashboard under Project Settings
- **Custom Domain**: Can be configured in Vercel dashboard
- **Security Headers**: Configured in `vercel.json` and API functions

## Security Features

All security headers from the original app are preserved:
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Strict-Transport-Security
- Content-Security-Policy

## Troubleshooting

If deployment fails:
1. Check that `vercel.json` is in the root directory
2. Ensure `public/` directory contains all static files
3. Verify Node.js version in `package.json` matches Vercel requirements
4. Check Vercel deployment logs for specific errors

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [Serverless Functions](https://vercel.com/docs/functions)
