# ⚕️ MED-TRACE Backend API

Backend REST API for the **MED-TRACE** Clinical Continuity Engine & Patient Journey platform.

## 🚀 Quick Start (Local)

1. Navigate to this directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
4. Run in development:
   ```bash
   npm start
   ```
5. Check health:
   ```bash
   curl http://localhost:5000/api/health
   ```

---

## ☁️ Deployment on Render

1. Log into [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** > **Web Service**.
3. Connect your repository: `MaitrixXD/MED-TRACE`.
4. Configure:
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: `Free`
5. Under **Environment Variables**:
   - `NODE_ENV`: `production`
   - `FRONTEND_URL`: Your Vercel frontend URL (e.g. `https://your-med-trace.vercel.app`)
6. Deploy!
