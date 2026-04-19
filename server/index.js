const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3001;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const FAMILIES_FILE = path.join(DATA_DIR, "families.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readFamilies() {
  try {
    if (!fs.existsSync(FAMILIES_FILE)) return {};
    return JSON.parse(fs.readFileSync(FAMILIES_FILE, "utf8"));
  } catch { return {}; }
}
function writeFamilies(data) {
  fs.writeFileSync(FAMILIES_FILE, JSON.stringify(data, null, 2), "utf8");
}
function getFamilyFile(id) { return path.join(DATA_DIR, `family_${id}.json`); }

const DEFAULT_DATA = {
  currentWith: null, liveLog: [],
  schedule: { fixed: { dad: [0,1,2,3], mom: [] }, rotating: { days: [4,5,6], currentWeekDad: true } },
  swapRequest: null, swapLog: [],
  notifications: [],
  settings: { requirePickupApproval: false }
  // notification types: "swap_request"|"swap_approved"|"swap_rejected"|"pickup_request"|"pickup_approved"|"pickup_rejected"
  // notification shape: { id, type, createdAt, createdBy, payload, seenBy:{dad,mom}, requiresAction:bool }
};

function addNotification(data, type, createdBy, payload) {
  const notif = {
    id: Date.now(),
    type, createdBy, payload,
    createdAt: new Date().toISOString(),
    seenBy: { dad: null, mom: null }
  };
  if (!data.notifications) data.notifications = [];
  data.notifications = [notif, ...data.notifications].slice(0, 50);
  return notif;
}

function readFamilyData(id) {
  try {
    const file = getFamilyFile(id);
    if (!fs.existsSync(file)) return { ...DEFAULT_DATA };
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!d.swapRequest) d.swapRequest = null;
    if (!d.swapLog) d.swapLog = [];
    if (!d.notifications) d.notifications = [];
    if (!d.settings) d.settings = { requirePickupApproval: false };
    return d;
  } catch { return { ...DEFAULT_DATA }; }
}
function writeFamilyData(id, data) {
  fs.writeFileSync(getFamilyFile(id), JSON.stringify(data, null, 2), "utf8");
}
function hashPassword(p) { return crypto.createHash("sha256").update(p).digest("hex"); }

app.use(cors());
app.use(express.json());
const CLIENT_BUILD = path.join(__dirname, "..", "client", "build");
if (fs.existsSync(CLIENT_BUILD)) app.use(express.static(CLIENT_BUILD));

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireFamily(req, res, next) {
  const familyId = req.headers["familyid"];
  const password = req.headers["password"];
  const role = req.headers["role"]; // "dad" | "mom"
  if (!familyId || !password || !role) return res.status(401).json({ error: "Unauthorized" });
  const families = readFamilies();
  const family = families[familyId];
  if (!family) return res.status(401).json({ error: "Family not found" });
  const pwdHash = hashPassword(password);
  if (role === "dad" && family.dadPasswordHash !== pwdHash) return res.status(401).json({ error: "Wrong password" });
  if (role === "mom" && family.momPasswordHash !== pwdHash) return res.status(401).json({ error: "Wrong password" });
  req.familyId = familyId;
  req.role = role;
  next();
}
function requireAdmin(req, res, next) {
  if (req.headers["adminpassword"] !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.post("/api/admin/login", (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Wrong password" });
  res.json({ success: true });
});

// GET all families — includes plain-text passwords for admin display
app.get("/api/admin/families", requireAdmin, (req, res) => {
  const families = readFamilies();
  const list = Object.entries(families).map(([id, f]) => ({
    id, name: f.name, createdAt: f.createdAt, lastActive: f.lastActive || null,
    dadPassword: f.dadPassword, momPassword: f.momPassword
  }));
  res.json(list);
});

// POST create family — separate dad/mom passwords
app.post("/api/admin/families", requireAdmin, (req, res) => {
  const { name, dadPassword, momPassword } = req.body;
  if (!name || !dadPassword || !momPassword) return res.status(400).json({ error: "name, dadPassword and momPassword required" });
  const families = readFamilies();
  const exists = Object.values(families).find(f => f.name.toLowerCase() === name.toLowerCase());
  if (exists) return res.status(409).json({ error: "Family name already exists" });
  const id = Date.now().toString(36);
  families[id] = {
    name, createdAt: new Date().toISOString(), lastActive: null,
    dadPassword, dadPasswordHash: hashPassword(dadPassword),
    momPassword, momPasswordHash: hashPassword(momPassword)
  };
  writeFamilies(families);
  res.json({ success: true, id, name });
});

// PUT reset passwords
app.put("/api/admin/families/:id/passwords", requireAdmin, (req, res) => {
  const { dadPassword, momPassword } = req.body;
  const families = readFamilies();
  if (!families[req.params.id]) return res.status(404).json({ error: "Not found" });
  if (dadPassword) {
    families[req.params.id].dadPassword = dadPassword;
    families[req.params.id].dadPasswordHash = hashPassword(dadPassword);
  }
  if (momPassword) {
    families[req.params.id].momPassword = momPassword;
    families[req.params.id].momPasswordHash = hashPassword(momPassword);
  }
  writeFamilies(families);
  res.json({ success: true });
});

// DELETE family
app.delete("/api/admin/families/:id", requireAdmin, (req, res) => {
  const families = readFamilies();
  if (!families[req.params.id]) return res.status(404).json({ error: "Not found" });
  delete families[req.params.id];
  writeFamilies(families);
  const file = getFamilyFile(req.params.id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// FAMILY LOGIN
// ══════════════════════════════════════════════════════════════════════════════
app.post("/api/family/login", (req, res) => {
  const { name, password, role } = req.body;
  if (!name || !password || !role) return res.status(400).json({ error: "name, password and role required" });
  const families = readFamilies();
  const entry = Object.entries(families).find(([, f]) => f.name.toLowerCase() === name.toLowerCase());
  if (!entry) return res.status(401).json({ error: "משפחה לא נמצאה" });
  const [id, family] = entry;
  const pwdHash = hashPassword(password);
  if (role === "dad" && family.dadPasswordHash !== pwdHash) return res.status(401).json({ error: "סיסמה שגויה" });
  if (role === "mom" && family.momPasswordHash !== pwdHash) return res.status(401).json({ error: "סיסמה שגויה" });
  families[id].lastActive = new Date().toISOString();
  writeFamilies(families);
  res.json({ success: true, familyId: id, familyName: family.name, role });
});

// ══════════════════════════════════════════════════════════════════════════════
// FAMILY DATA ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/family/data", requireFamily, (req, res) => res.json(readFamilyData(req.familyId)));

app.post("/api/family/mark", requireFamily, (req, res) => {
  const parent = req.role;
  const data = readFamilyData(req.familyId);

  if (data.settings?.requirePickupApproval) {
    // In approval mode — create a pickup_request notification instead of marking directly
    addNotification(data, "pickup_request", parent, { requestedBy: parent, requestedAt: new Date().toISOString() });
    writeFamilyData(req.familyId, data);
    return res.json({ success: true, pending: true, message: "בקשת האיסוף נשלחה לאישור" });
  }

  // Normal mode — mark directly
  const entry = { id: Date.now(), parent, timestamp: new Date().toISOString(), note: `${parent === "dad" ? "אבא" : "אמא"} סימן/ה: הילד/ים אצלי` };
  data.currentWith = parent;
  data.liveLog = [entry, ...data.liveLog].slice(0, 500);
  writeFamilyData(req.familyId, data);
  res.json({ success: true, pending: false, entry, currentWith: data.currentWith });
});

// PUT /api/family/settings
app.put("/api/family/settings", requireFamily, (req, res) => {
  const { requirePickupApproval } = req.body;
  const data = readFamilyData(req.familyId);
  data.settings = { ...data.settings, requirePickupApproval: !!requirePickupApproval };
  writeFamilyData(req.familyId, data);
  res.json({ success: true, settings: data.settings });
});

// POST /api/family/pickup/respond — approve or reject pickup request
app.post("/api/family/pickup/respond", requireFamily, (req, res) => {
  const { notificationId, action } = req.body;
  const respondedBy = req.role;
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "Invalid action" });
  const data = readFamilyData(req.familyId);
  const notif = (data.notifications || []).find(n => n.id === notificationId && n.type === "pickup_request");
  if (!notif) return res.status(404).json({ error: "Notification not found" });
  if (notif.createdBy === respondedBy) return res.status(403).json({ error: "לא ניתן לאשר בקשה שלך" });

  // Remove the original request notif
  data.notifications = data.notifications.filter(n => n.id !== notificationId);

  if (action === "approve") {
    const parent = notif.payload.requestedBy;
    const entry = { id: Date.now(), parent, timestamp: new Date().toISOString(), note: `${parent === "dad" ? "אבא" : "אמא"} סימן/ה: הילד/ים אצלי (אושר)` };
    data.currentWith = parent;
    data.liveLog = [entry, ...data.liveLog].slice(0, 500);
    addNotification(data, "pickup_approved", respondedBy, { approvedFor: parent });
  } else {
    addNotification(data, "pickup_rejected", respondedBy, { rejectedFor: notif.payload.requestedBy });
  }

  writeFamilyData(req.familyId, data);
  res.json({ success: true, action });
});

app.delete("/api/family/log", requireFamily, (req, res) => {
  const data = readFamilyData(req.familyId);
  data.liveLog = []; data.currentWith = null;
  writeFamilyData(req.familyId, data);
  res.json({ success: true });
});

app.post("/api/family/swap", requireFamily, (req, res) => {
  const { offerDay, wantDay } = req.body;
  const requestedBy = req.role;
  if (!offerDay?.date || !wantDay?.date) return res.status(400).json({ error: "offerDay and wantDay required" });
  const data = readFamilyData(req.familyId);
  if (data.swapRequest?.status === "pending") return res.status(409).json({ error: "כבר קיימת בקשה פתוחה" });
  data.swapRequest = { id: Date.now(), requestedBy, requestedAt: new Date().toISOString(), offerDay, wantDay, status: "pending", respondedAt: null };
  addNotification(data, "swap_request", requestedBy, { offerDay, wantDay });
  writeFamilyData(req.familyId, data);
  res.json({ success: true, swapRequest: data.swapRequest });
});

app.put("/api/family/swap/respond", requireFamily, (req, res) => {
  const { action } = req.body;
  const respondedBy = req.role;
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "Invalid action" });
  const data = readFamilyData(req.familyId);
  if (!data.swapRequest || data.swapRequest.status !== "pending") return res.status(404).json({ error: "אין בקשה פתוחה" });
  if (data.swapRequest.requestedBy === respondedBy) return res.status(403).json({ error: "לא ניתן לאשר בקשה שלך" });
  const { offerDay, wantDay, requestedBy } = data.swapRequest;
  data.swapRequest.status = action === "approve" ? "approved" : "rejected";
  data.swapRequest.respondedAt = new Date().toISOString();
  if (action === "approve") {
    const self = requestedBy === "dad" ? "אבא" : "אמא", other = requestedBy === "dad" ? "אמא" : "אבא";
    data.liveLog = [{ id: Date.now(), parent: "system", timestamp: new Date().toISOString(), note: `✅ החלפה אושרה: ${offerDay.label} (${self}) ↔ ${wantDay.label} (${other})` }, ...data.liveLog].slice(0, 500);
  }
  data.swapLog = [{ ...data.swapRequest }, ...data.swapLog].slice(0, 100);
  addNotification(data, action === "approve" ? "swap_approved" : "swap_rejected", respondedBy, { offerDay, wantDay });
  data.swapRequest = null;
  writeFamilyData(req.familyId, data);
  res.json({ success: true });
});

app.delete("/api/family/swap", requireFamily, (req, res) => {
  const cancelledBy = req.role;
  const data = readFamilyData(req.familyId);
  if (!data.swapRequest || data.swapRequest.status !== "pending") return res.status(404).json({ error: "אין בקשה פתוחה" });
  if (data.swapRequest.requestedBy !== cancelledBy) return res.status(403).json({ error: "רק מי ששלח יכול לבטל" });
  data.swapRequest.status = "cancelled";
  data.swapLog = [{ ...data.swapRequest }, ...data.swapLog].slice(0, 100);
  data.swapRequest = null;
  writeFamilyData(req.familyId, data);
  res.json({ success: true });
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

// POST /api/family/notifications/seen — mark notification as seen
app.post("/api/family/notifications/seen", requireFamily, (req, res) => {
  const { notificationId } = req.body;
  const role = req.role;
  const data = readFamilyData(req.familyId);
  const notif = (data.notifications || []).find(n => n.id === notificationId);
  if (notif && !notif.seenBy[role]) {
    notif.seenBy[role] = new Date().toISOString();
    writeFamilyData(req.familyId, data);
  }
  res.json({ success: true });
});

// DELETE /api/family/notifications/:id — dismiss a notification
app.delete("/api/family/notifications/:id", requireFamily, (req, res) => {
  const data = readFamilyData(req.familyId);
  data.notifications = (data.notifications || []).filter(n => n.id !== parseInt(req.params.id));
  writeFamilyData(req.familyId, data);
  res.json({ success: true });
});

app.get("*", (req, res) => {
  const idx = path.join(CLIENT_BUILD, "index.html");
  if (fs.existsSync(idx)) res.sendFile(idx);
  else res.json({ message: "Togather API running" });
});

app.listen(PORT, () => console.log(`✅ Togather on port ${PORT}`));
