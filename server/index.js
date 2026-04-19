const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Config ────────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const FAMILIES_FILE = path.join(DATA_DIR, "families.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Helpers ───────────────────────────────────────────────────────────────────
function readFamilies() {
  try {
    if (!fs.existsSync(FAMILIES_FILE)) return {};
    return JSON.parse(fs.readFileSync(FAMILIES_FILE, "utf8"));
  } catch { return {}; }
}

function writeFamilies(data) {
  fs.writeFileSync(FAMILIES_FILE, JSON.stringify(data, null, 2), "utf8");
}

function getFamilyFile(familyId) {
  return path.join(DATA_DIR, `family_${familyId}.json`);
}

const DEFAULT_FAMILY_DATA = {
  currentWith: null,
  liveLog: [],
  schedule: {
    fixed: { dad: [0, 1, 2, 3], mom: [] },
    rotating: { days: [4, 5, 6], currentWeekDad: true }
  },
  swapRequest: null,
  swapLog: []
};

function readFamilyData(familyId) {
  try {
    const file = getFamilyFile(familyId);
    if (!fs.existsSync(file)) return { ...DEFAULT_FAMILY_DATA };
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!d.swapRequest) d.swapRequest = null;
    if (!d.swapLog) d.swapLog = [];
    return d;
  } catch { return { ...DEFAULT_FAMILY_DATA }; }
}

function writeFamilyData(familyId, data) {
  fs.writeFileSync(getFamilyFile(familyId), JSON.stringify(data, null, 2), "utf8");
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

const CLIENT_BUILD = path.join(__dirname, "..", "client", "build");
if (fs.existsSync(CLIENT_BUILD)) app.use(express.static(CLIENT_BUILD));

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireFamily(req, res, next) {
  const { familyId, password } = req.headers;
  if (!familyId || !password) return res.status(401).json({ error: "Unauthorized" });
  const families = readFamilies();
  const family = families[familyId];
  if (!family) return res.status(401).json({ error: "Family not found" });
  if (family.passwordHash !== hashPassword(password)) return res.status(401).json({ error: "Wrong password" });
  req.familyId = familyId;
  next();
}

function requireAdmin(req, res, next) {
  const { adminpassword } = req.headers;
  if (adminpassword !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/admin/login
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Wrong password" });
  res.json({ success: true });
});

// GET /api/admin/families
app.get("/api/admin/families", requireAdmin, (req, res) => {
  const families = readFamilies();
  // Return without password hashes
  const safe = Object.entries(families).map(([id, f]) => ({
    id, name: f.name, createdAt: f.createdAt,
    lastActive: f.lastActive || null
  }));
  res.json(safe);
});

// POST /api/admin/families — create family
app.post("/api/admin/families", requireAdmin, (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: "name and password required" });
  const families = readFamilies();
  // Check name not taken
  const exists = Object.values(families).find(f => f.name.toLowerCase() === name.toLowerCase());
  if (exists) return res.status(409).json({ error: "Family name already exists" });
  const id = Date.now().toString(36);
  families[id] = { name, passwordHash: hashPassword(password), createdAt: new Date().toISOString(), lastActive: null };
  writeFamilies(families);
  res.json({ success: true, id, name });
});

// DELETE /api/admin/families/:id
app.delete("/api/admin/families/:id", requireAdmin, (req, res) => {
  const families = readFamilies();
  if (!families[req.params.id]) return res.status(404).json({ error: "Not found" });
  delete families[req.params.id];
  writeFamilies(families);
  // Also delete family data file
  const file = getFamilyFile(req.params.id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ success: true });
});

// PUT /api/admin/families/:id/password — reset password
app.put("/api/admin/families/:id/password", requireAdmin, (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "password required" });
  const families = readFamilies();
  if (!families[req.params.id]) return res.status(404).json({ error: "Not found" });
  families[req.params.id].passwordHash = hashPassword(password);
  writeFamilies(families);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// FAMILY ROUTES (all require family auth)
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/family/login
app.post("/api/family/login", (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: "name and password required" });
  const families = readFamilies();
  const entry = Object.entries(families).find(([, f]) => f.name.toLowerCase() === name.toLowerCase());
  if (!entry) return res.status(401).json({ error: "Family not found" });
  const [id, family] = entry;
  if (family.passwordHash !== hashPassword(password)) return res.status(401).json({ error: "Wrong password" });
  // Update last active
  families[id].lastActive = new Date().toISOString();
  writeFamilies(families);
  res.json({ success: true, familyId: id, familyName: family.name });
});

// GET /api/family/data
app.get("/api/family/data", requireFamily, (req, res) => {
  res.json(readFamilyData(req.familyId));
});

// POST /api/family/mark
app.post("/api/family/mark", requireFamily, (req, res) => {
  const { parent } = req.body;
  if (!["dad", "mom"].includes(parent)) return res.status(400).json({ error: "Invalid parent" });
  const data = readFamilyData(req.familyId);
  const entry = { id: Date.now(), parent, timestamp: new Date().toISOString(), note: `${parent === "dad" ? "אבא" : "אמא"} סימן/ה: הילד/ים אצלי` };
  data.currentWith = parent;
  data.liveLog = [entry, ...data.liveLog].slice(0, 500);
  writeFamilyData(req.familyId, data);
  res.json({ success: true, entry, currentWith: data.currentWith });
});

// PUT /api/family/schedule
app.put("/api/family/schedule", requireFamily, (req, res) => {
  const { schedule } = req.body;
  if (!schedule?.fixed || !schedule?.rotating) return res.status(400).json({ error: "Invalid schedule" });
  const data = readFamilyData(req.familyId);
  data.schedule = schedule;
  writeFamilyData(req.familyId, data);
  res.json({ success: true, schedule: data.schedule });
});

// DELETE /api/family/log
app.delete("/api/family/log", requireFamily, (req, res) => {
  const data = readFamilyData(req.familyId);
  data.liveLog = [];
  data.currentWith = null;
  writeFamilyData(req.familyId, data);
  res.json({ success: true });
});

// POST /api/family/swap
app.post("/api/family/swap", requireFamily, (req, res) => {
  const { requestedBy, offerDay, wantDay } = req.body;
  if (!["dad", "mom"].includes(requestedBy)) return res.status(400).json({ error: "Invalid requestedBy" });
  if (!offerDay?.date || !wantDay?.date) return res.status(400).json({ error: "offerDay and wantDay required" });
  const data = readFamilyData(req.familyId);
  if (data.swapRequest?.status === "pending") return res.status(409).json({ error: "כבר קיימת בקשה פתוחה" });
  data.swapRequest = { id: Date.now(), requestedBy, requestedAt: new Date().toISOString(), offerDay, wantDay, status: "pending", respondedAt: null };
  writeFamilyData(req.familyId, data);
  res.json({ success: true, swapRequest: data.swapRequest });
});

// PUT /api/family/swap/respond
app.put("/api/family/swap/respond", requireFamily, (req, res) => {
  const { respondedBy, action } = req.body;
  if (!["dad", "mom"].includes(respondedBy)) return res.status(400).json({ error: "Invalid respondedBy" });
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "Invalid action" });
  const data = readFamilyData(req.familyId);
  if (!data.swapRequest || data.swapRequest.status !== "pending") return res.status(404).json({ error: "אין בקשה פתוחה" });
  if (data.swapRequest.requestedBy === respondedBy) return res.status(403).json({ error: "לא ניתן לאשר בקשה שלך" });
  data.swapRequest.status = action === "approve" ? "approved" : "rejected";
  data.swapRequest.respondedAt = new Date().toISOString();
  if (action === "approve") {
    const { offerDay, wantDay, requestedBy } = data.swapRequest;
    const self = requestedBy === "dad" ? "אבא" : "אמא";
    const other = requestedBy === "dad" ? "אמא" : "אבא";
    data.liveLog = [{ id: Date.now(), parent: "system", timestamp: new Date().toISOString(), note: `✅ החלפה אושרה: ${offerDay.label} (${self}) ↔ ${wantDay.label} (${other})` }, ...data.liveLog].slice(0, 500);
  }
  data.swapLog = [{ ...data.swapRequest }, ...data.swapLog].slice(0, 100);
  data.swapRequest = null;
  writeFamilyData(req.familyId, data);
  res.json({ success: true });
});

// DELETE /api/family/swap
app.delete("/api/family/swap", requireFamily, (req, res) => {
  const { cancelledBy } = req.body;
  const data = readFamilyData(req.familyId);
  if (!data.swapRequest || data.swapRequest.status !== "pending") return res.status(404).json({ error: "אין בקשה פתוחה" });
  if (data.swapRequest.requestedBy !== cancelledBy) return res.status(403).json({ error: "רק מי ששלח יכול לבטל" });
  data.swapRequest.status = "cancelled";
  data.swapLog = [{ ...data.swapRequest }, ...data.swapLog].slice(0, 100);
  data.swapRequest = null;
  writeFamilyData(req.familyId, data);
  res.json({ success: true });
});

// ── Fallback ──────────────────────────────────────────────────────────────────
app.get("*", (req, res) => {
  const idx = path.join(CLIENT_BUILD, "index.html");
  if (fs.existsSync(idx)) res.sendFile(idx);
  else res.json({ message: "Togather API running" });
});

app.listen(PORT, () => {
  console.log(`✅ Togather server on port ${PORT}`);
  console.log(`🔑 Admin password: ${ADMIN_PASSWORD}`);
});
