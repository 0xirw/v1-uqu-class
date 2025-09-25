# ColApp - Interactive Virtual Classroom Platform

## Deployment Instructions

### Option 1: Render.com (Recommended - Free Tier Available)

1. **Fork/Upload to GitHub**:
   - Create a new repository on GitHub
   - Upload all project files to the repository

2. **Deploy on Render**:
   - Go to https://render.com
   - Sign up/Login with GitHub
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Use these settings:
     - **Name**: colapp-platform
     - **Environment**: Node
     - **Build Command**: `npm install && npm run install-client && npm run build`
     - **Start Command**: `npm start`
     - **Auto-Deploy**: Yes

3. **Environment Variables** (if needed):
   - No additional environment variables required for basic setup

### Option 2: Railway.app

1. Go to https://railway.app
2. Sign up/Login with GitHub
3. Click "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect Node.js and deploy

### Option 3: Vercel (For Static + Serverless)

Note: Requires modification for serverless functions
- Better suited for static deployments

### Option 4: Heroku

1. Install Heroku CLI
2. Run commands:
```bash
heroku create colapp-platform
git add .
git commit -m "Initial commit"
git push heroku main
```

## Local Development

```bash
# Install dependencies
npm install

# Build client
npm run build

# Start server
npm start
```

The application will be available at the provided domain once deployed.

## Features
- Real-time classroom sessions
- 6-character room codes
- Chat functionality
- File sharing
- Screen sharing
- Responsive design

## Tech Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Real-time: Socket.IO
- Deployment: Cloud hosting platforms