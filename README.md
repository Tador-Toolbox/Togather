# Co-Parenting Journal — Deployment Guide

A shared co-parenting journal for two parents to track when the child is with each parent,
with a real-time shared log and a configurable fixed weekly schedule.

---

## Project Structure

```
coparenting/
├── package.json          ← root (build + start scripts for Render)
├── .gitignore
├── server/
│   ├── package.json
│   ├── index.js          ← Express API server
│   └── data/
│       └── journal.json  ← auto-created at runtime
└── client/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        └── App.js        ← full React UI
```

---

## Local Development

### 1. Install dependencies

```bash
# From the project root:
npm run install-all
```

### 2. Run the server

```bash
cd server
npm run dev        # uses nodemon for auto-reload
# Server starts on http://localhost:3001
```

### 3. Run the React client

```bash
cd client
npm start          # starts on http://localhost:3000
# Proxy to server is already configured in client/package.json
```

Open http://localhost:3000 in your browser.

---

## Deploy to Render (Free Tier)

### Step 1 — Push to GitHub

```bash
cd coparenting
git init
git add .
git commit -m "initial commit"
# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2 — Create a new Web Service on Render

1. Go to https://render.com → **New** → **Web Service**
2. Connect your GitHub repo
3. Fill in the settings:

| Setting | Value |
|---|---|
| **Name** | coparenting-journal |
| **Root Directory** | *(leave empty)* |
| **Runtime** | Node |
| **Build Command** | `npm run install-all && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free |

4. Click **Create Web Service**

### Step 3 — (Optional) Persistent Disk for data

By default on Render's free tier, the filesystem is ephemeral — data resets on each deploy.

To persist the journal data across deploys:
1. In Render dashboard → your service → **Disks** → **Add Disk**
2. Set **Mount Path**: `/data`
3. Add environment variable:
   - Key: `DATA_DIR`
   - Value: `/data`

This keeps `journal.json` safe across deploys.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/data` | Returns all data (log, schedule, currentWith) |
| POST | `/api/mark` | Mark child as with parent. Body: `{ "parent": "dad" \| "mom" }` |
| PUT | `/api/schedule` | Update the fixed schedule |
| DELETE | `/api/log` | Clear all log entries |

---

## Features

- **Live Marking**: Each parent taps a button when the child arrives — logged with timestamp
- **Shared Log**: Both parents see the same history, auto-refreshed every 15 seconds
- **Fixed Schedule**: Set which days of the week belong to dad, mom, or rotate weekly
- **Rotating Days**: Configurable weekly alternation (e.g. Thu–Sat swap each week)
- **Role persistence**: Each device remembers if it's "dad" or "mom" (localStorage)
- **Hebrew RTL UI** with dark aesthetic design
