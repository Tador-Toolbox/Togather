const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "journal.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Default data shape ────────────────────────────────────────────────────────
const DEFAULT_DATA = {
  currentWith: null,
  liveLog: [],
  schedule: {
    fixed: { dad: [0, 1, 2, 3], mom: [] },
    rotating: { days: [4, 5, 6], currentWeekDad: true }
  },
  swapRequest: null,   // one active request at a time
  swapLog: []          // history of completed/rejected requests
};

// swapRequest shape:
// { id, requestedBy, requestedAt,
//   offerDay: { date:"YYYY-MM-DD", dow:0-6, label:"" },
//   wantDay:  { date:"YYYY-MM-DD", dow:0-6, label:"" },
//   status: "pending"|"approved"|"rejected"|"cancelled",
//   respondedAt: null|ISO }

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { ...DEFAULT_DATA };
    const d = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    // back-fill new fields
    if (!d.swapRequest) d.swapRequest = null;
    if (!d.swapLog) d.swapLog = [];
    return d;
  } catch { return { ...DEFAULT_DATA }; }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

const CLIENT_BUILD = path.join(__dirname, "..", "client", "build");
if (fs.existsSync(CLIENT_BUILD)) app.use(express.static(CLIENT_BUILD));

// ══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET all data
app.get("/api/data", (req, res) => res.json(readData()));

// POST mark child with parent
app.post("/api/mark", (req, res) => {
  const { parent } = req.body;
  if (!["dad", "mom"].includes(parent))
    return res.status(400).json({ error: "parent must be 'dad' or 'mom'" });

  const data = readData();
  const entry = {
    id: Date.now(), parent,
    timestamp: new Date().toISOString(),
    note: `${parent === "dad" ? "אבא" : "אמא"} סימן/ה: הילד/ים אצלי`
  };
  data.currentWith = parent;
  data.liveLog = [entry, ...data.liveLog].slice(0, 500);
  writeData(data);
  res.json({ success: true, entry, currentWith: data.currentWith });
});

// PUT update schedule
app.put("/api/schedule", (req, res) => {
  const { schedule } = req.body;
  if (!schedule || !schedule.fixed || !schedule.rotating)
    return res.status(400).json({ error: "Invalid schedule format" });

  const data = readData();
  data.schedule = schedule;
  writeData(data);
  res.json({ success: true, schedule: data.schedule });
});

// DELETE clear live log
app.delete("/api/log", (req, res) => {
  const data = readData();
  data.liveLog = [];
  data.currentWith = null;
  writeData(data);
  res.json({ success: true });
});

// ── SWAP ROUTES ───────────────────────────────────────────────────────────────

// POST create swap request
// body: { requestedBy, offerDay:{date,dow,label}, wantDay:{date,dow,label} }
app.post("/api/swap", (req, res) => {
  const { requestedBy, offerDay, wantDay } = req.body;
  if (!["dad", "mom"].includes(requestedBy))
    return res.status(400).json({ error: "Invalid requestedBy" });
  if (!offerDay?.date || !wantDay?.date)
    return res.status(400).json({ error: "offerDay and wantDay required" });

  const data = readData();
  if (data.swapRequest && data.swapRequest.status === "pending")
    return res.status(409).json({ error: "כבר קיימת בקשת החלפה פתוחה" });

  const swapReq = {
    id: Date.now(), requestedBy,
    requestedAt: new Date().toISOString(),
    offerDay, wantDay,
    status: "pending",
    respondedAt: null
  };
  data.swapRequest = swapReq;
  writeData(data);
  res.json({ success: true, swapRequest: data.swapRequest });
});

// PUT respond: approve or reject
// body: { respondedBy, action:"approve"|"reject" }
app.put("/api/swap/respond", (req, res) => {
  const { respondedBy, action } = req.body;
  if (!["dad", "mom"].includes(respondedBy))
    return res.status(400).json({ error: "Invalid respondedBy" });
  if (!["approve", "reject"].includes(action))
    return res.status(400).json({ error: "action must be approve or reject" });

  const data = readData();
  if (!data.swapRequest || data.swapRequest.status !== "pending")
    return res.status(404).json({ error: "אין בקשה פתוחה" });
  if (data.swapRequest.requestedBy === respondedBy)
    return res.status(403).json({ error: "לא ניתן לאשר את הבקשה שלך עצמך" });

  data.swapRequest.status = action === "approve" ? "approved" : "rejected";
  data.swapRequest.respondedAt = new Date().toISOString();

  if (action === "approve") {
    const { offerDay, wantDay, requestedBy } = data.swapRequest;
    const other = requestedBy === "dad" ? "אמא" : "אבא";
    const self  = requestedBy === "dad" ? "אבא" : "אמא";
    const logEntry = {
      id: Date.now(), parent: "system",
      timestamp: new Date().toISOString(),
      note: `✅ החלפה אושרה: ${offerDay.label} (${self}) ↔ ${wantDay.label} (${other})`
    };
    data.liveLog = [logEntry, ...data.liveLog].slice(0, 500);
  }

  data.swapLog = [{ ...data.swapRequest }, ...data.swapLog].slice(0, 100);
  data.swapRequest = null;
  writeData(data);
  res.json({ success: true, result: data.swapLog[0] });
});

// DELETE cancel swap (by requester)
// body: { cancelledBy }
app.delete("/api/swap", (req, res) => {
  const { cancelledBy } = req.body;
  const data = readData();
  if (!data.swapRequest || data.swapRequest.status !== "pending")
    return res.status(404).json({ error: "אין בקשה פתוחה" });
  if (data.swapRequest.requestedBy !== cancelledBy)
    return res.status(403).json({ error: "רק מי ששלח יכול לבטל" });

  data.swapRequest.status = "cancelled";
  data.swapLog = [{ ...data.swapRequest }, ...data.swapLog].slice(0, 100);
  data.swapRequest = null;
  writeData(data);
  res.json({ success: true });
});

// ── Fallback ──────────────────────────────────────────────────────────────────
app.get("*", (req, res) => {
  const idx = path.join(CLIENT_BUILD, "index.html");
  if (fs.existsSync(idx)) res.sendFile(idx);
  else res.json({ message: "Co-Parenting Journal API running" });
});

app.listen(PORT, () => {
  console.log(`✅ Server on port ${PORT}`);
  console.log(`📂 Data: ${DATA_FILE}`);
});
