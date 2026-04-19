import { useState, useEffect, useCallback } from "react";

const API = process.env.REACT_APP_API_URL || "";
const APP_URL = window.location.origin;

function getSession() { try { return JSON.parse(localStorage.getItem("tg_session") || "null"); } catch { return null; } }
function saveSession(s) { localStorage.setItem("tg_session", JSON.stringify(s)); }
function clearSession() { localStorage.removeItem("tg_session"); }

async function apiFetch(path, opts, session) {
  const headers = { "Content-Type": "application/json", ...(opts && opts.headers) };
  if (session) {
    headers["familyid"] = session.familyId;
    headers["password"] = session.password;
    headers["role"] = session.role;
  }
  const res = await fetch(API + path, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

async function adminFetch(path, opts, adminPassword) {
  const headers = { "Content-Type": "application/json", adminpassword: adminPassword, ...(opts && opts.headers) };
  const res = await fetch(API + path, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

const DAYS_HE = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function toDateStr(d) { return d.toISOString().slice(0, 10); }
function formatDate(iso) { return new Date(iso).toLocaleString("he-IL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }); }
function formatDateShort(iso) { return new Date(iso).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" }); }
function formatTime(iso) { return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }); }
function todayHeDate() {
  const d = new Date();
  return { day: DAYS_HE[d.getDay()], date: d.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" }) };
}

function getWeekNumber(d) {
  if (!d) d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function getScheduledOwner(date, schedule) {
  if (!schedule) return null;
  const dow = date.getDay();
  if (schedule.fixed.dad.includes(dow)) return "dad";
  if (schedule.fixed.mom.includes(dow)) return "mom";
  if (schedule.rotating.days.includes(dow)) {
    const wk = getWeekNumber(date);
    return (schedule.rotating.currentWeekDad ? wk % 2 === 0 : wk % 2 !== 0) ? "dad" : "mom";
  }
  return null;
}

function buildUpcomingDays(schedule) {
  const days = [];
  const today = new Date();
  const wk = getWeekNumber();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dow = d.getDay();
    const dateStr = toDateStr(d);
    let owner = null;
    if (schedule.fixed.dad.includes(dow)) owner = "dad";
    else if (schedule.fixed.mom.includes(dow)) owner = "mom";
    else if (schedule.rotating.days.includes(dow)) {
      const effectiveWk = wk + Math.floor(i / 7);
      owner = (schedule.rotating.currentWeekDad ? effectiveWk % 2 === 0 : effectiveWk % 2 !== 0) ? "dad" : "mom";
    }
    days.push({ date: dateStr, dow, label: DAYS_HE[dow] + " " + dateStr.slice(5).replace("-", "/"), owner, d });
  }
  return days;
}

const NOTIF_LABELS = {
  swap_request:    { icon: "🔄", title: "בקשת החלפת יום",   green: false, actionFor: "other" },
  swap_approved:   { icon: "✅", title: "ההחלפה אושרה",       green: true,  actionFor: null    },
  swap_rejected:   { icon: "❌", title: "ההחלפה נדחתה",       green: false, actionFor: null    },
  schedule_changed:{ icon: "📅", title: "הסדר הקבוע עודכן",   green: false, actionFor: null    },
  pickup_request:  { icon: "👶", title: "בקשת איסוף ילד/ים", green: false, actionFor: "other" },
  pickup_approved: { icon: "✅", title: "האיסוף אושר",         green: true,  actionFor: null    },
  pickup_rejected: { icon: "❌", title: "האיסוף נדחה",         green: false, actionFor: null    },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400&family=DM+Sans:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#f5f3ef;--surface:#fff;--surface2:#eeecea;
  --border:#e0dcd6;--border2:#ccc8c0;
  --text:#1a1814;--text2:#6b6560;--text3:#a09890;
  --dad:#2563a8;--dad-bg:#deeaf8;--dad-border:#b8d0ef;--dad-text:#1a4a80;
  --mom:#8b2d8b;--mom-bg:#f2e0f2;--mom-border:#dbb0db;--mom-text:#6a1a6a;
  --green:#3a7a20;--green-bg:#e4f2d8;--green-border:#b8dca0;
  --amber:#c07010;--amber-bg:#faf0d8;--amber-border:#e0c070;
  --red:#b02020;--red-bg:#fae8e8;--red-border:#e0b0b0;
  --admin:#4a3a8a;--admin-bg:#edeaf8;--admin-border:#c8c0e8;
}
html,body{height:100%;background:var(--bg);font-family:'DM Sans',sans-serif;color:var(--text);direction:rtl}
#root{height:100%}
.app{max-width:430px;margin:0 auto;min-height:100vh;background:var(--bg)}

.login-wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px}
.login-logo{font-size:52px;margin-bottom:10px}
.login-title{font-family:'Fraunces',serif;font-size:32px;font-weight:300;color:var(--text);margin-bottom:4px}
.login-sub{font-size:12px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:32px}
.login-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:22px;width:100%}
.login-card-title{font-family:'Fraunces',serif;font-size:17px;font-weight:300;color:var(--text);margin-bottom:16px}
.field{margin-bottom:13px}
.field label{display:block;font-size:12px;color:var(--text2);margin-bottom:5px}
.field input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:9px;color:var(--text);font-size:14px;padding:10px 12px;font-family:'DM Sans',sans-serif}
.field input:focus{outline:none;border-color:var(--dad)}
.login-btn{width:100%;background:var(--dad);border:none;color:#fff;border-radius:10px;padding:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;margin-top:4px}
.login-btn:disabled{background:var(--border2);cursor:default}
.login-err{background:var(--red-bg);border:1px solid var(--red-border);border-radius:8px;padding:9px 12px;font-size:12px;color:var(--red);margin-bottom:12px}
.admin-link{margin-top:18px;text-align:center;font-size:12px;color:var(--text3);cursor:pointer;text-decoration:underline}
.role-pick{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}
.role-pick-btn{padding:10px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text2);cursor:pointer;font-size:14px;font-family:'DM Sans',sans-serif;transition:all .2s}
.role-pick-btn.dad-active{background:var(--dad-bg);border-color:var(--dad);color:var(--dad-text)}
.role-pick-btn.mom-active{background:var(--mom-bg);border-color:var(--mom);color:var(--mom-text)}

.admin-wrap{min-height:100vh;background:var(--admin-bg)}
.admin-header{background:var(--admin);color:#fff;padding:15px 18px;display:flex;align-items:center;justify-content:space-between}
.admin-title{font-family:'Fraunces',serif;font-size:17px;font-weight:300}
.admin-logout{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:7px;padding:5px 11px;cursor:pointer;font-size:12px;font-family:'DM Sans',sans-serif}
.admin-body{padding:18px}
.admin-section-title{font-family:'Fraunces',serif;font-size:15px;font-weight:300;color:var(--admin);margin-bottom:12px}
.add-family-card{background:var(--surface);border:1px solid var(--admin-border);border-radius:13px;padding:16px;margin-bottom:18px}
.add-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:9px}
.add-btn{background:var(--admin);border:none;color:#fff;border-radius:9px;padding:9px 14px;cursor:pointer;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif}
.add-btn:disabled{background:var(--border2);cursor:default}
.families-list{display:flex;flex-direction:column;gap:8px}
.family-card{background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:13px 15px}
.family-top{display:flex;align-items:center;gap:10px}
.family-icon{font-size:22px}
.family-info{flex:1}
.family-name{font-size:13px;font-weight:500;color:var(--text)}
.family-meta{font-size:10px;color:var(--text3);margin-top:1px}
.family-actions{display:flex;gap:5px}
.fam-btn{background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:7px;padding:4px 9px;cursor:pointer;font-size:11px;font-family:'DM Sans',sans-serif}
.fam-btn.del{background:var(--red-bg);border-color:var(--red-border);color:var(--red)}
.pwd-box{background:var(--surface2);border-radius:8px;padding:10px 12px;margin-top:10px;display:flex;flex-direction:column;gap:8px}
.pwd-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pwd-badge{font-size:13px;font-weight:500;padding:5px 10px;border-radius:6px;border:1px solid}
.pwd-badge.dad{color:var(--dad-text);background:var(--dad-bg);border-color:var(--dad-border)}
.pwd-badge.mom{color:var(--mom-text);background:var(--mom-bg);border-color:var(--mom-border)}
.pwd-label{font-size:10px;color:var(--text3);margin-bottom:3px}
.pwd-edit-row{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.pwd-edit-input{font-size:12px;padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:'DM Sans',sans-serif;width:100%}
.empty-families{text-align:center;padding:28px;color:var(--text3);font-size:13px}

.date-bar{background:var(--surface);border-bottom:1px solid var(--border);padding:10px 16px;display:flex;align-items:center;justify-content:space-between}
.date-bar-text{font-size:13px;color:var(--text2)}
.date-bar-day{font-weight:500;color:var(--text)}
.notif-bell{position:relative;background:var(--surface2);border:1px solid var(--border);border-radius:10px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:17px;flex-shrink:0}
.notif-bell:hover{background:var(--border)}
.notif-badge{position:absolute;top:-5px;left:-5px;background:var(--red);color:#fff;border-radius:10px;font-size:10px;padding:1px 5px;font-weight:700;min-width:17px;text-align:center}

.notif-panel{position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;justify-content:flex-end}
.notif-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.3)}
.notif-sheet{position:relative;background:var(--surface);border-radius:20px 20px 0 0;max-height:80vh;overflow-y:auto;z-index:1}
.notif-sheet-header{padding:15px 17px 11px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--surface)}
.notif-sheet-title{font-family:'Fraunces',serif;font-size:16px;font-weight:300;color:var(--text)}
.notif-close{background:none;border:none;font-size:17px;cursor:pointer;color:var(--text3)}
.notif-list{padding:12px 15px;display:flex;flex-direction:column;gap:9px}
.notif-item{background:var(--surface2);border:1px solid var(--border);border-radius:11px;padding:12px 13px}
.notif-item.unseen{background:var(--dad-bg);border-color:var(--dad-border)}
.notif-item.unseen.green-notif{background:var(--green-bg);border-color:var(--green-border)}
.notif-item-top{display:flex;align-items:flex-start;gap:8px;margin-bottom:7px}
.notif-icon{font-size:17px;flex-shrink:0;margin-top:1px}
.notif-text{flex:1}
.notif-title{font-size:13px;font-weight:500;color:var(--text);margin-bottom:2px}
.notif-sub{font-size:11px;color:var(--text2);line-height:1.45}
.notif-time{font-size:10px;color:var(--text3);margin-top:3px}
.notif-seen-row{font-size:10px;color:var(--text3);margin-top:2px}
.notif-seen-row span{color:var(--green)}
.notif-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}
.notif-approve{background:var(--green);border:none;color:#fff;border-radius:8px;padding:8px;cursor:pointer;font-size:12px;font-weight:500;font-family:'DM Sans',sans-serif}
.notif-reject{background:var(--red-bg);border:1px solid var(--red-border);color:var(--red);border-radius:8px;padding:8px;cursor:pointer;font-size:12px;font-weight:500;font-family:'DM Sans',sans-serif}
.notif-dismiss{background:none;border:none;color:var(--text3);font-size:11px;cursor:pointer;margin-top:4px;font-family:'DM Sans',sans-serif;text-decoration:underline}
.notif-empty{text-align:center;padding:28px;color:var(--text3);font-size:13px}

.home{min-height:100vh;display:flex;flex-direction:column;padding:18px 22px 30px}
.home-header{text-align:center;margin-bottom:24px}
.home-icon{font-size:44px;display:block;margin-bottom:8px}
.home-title{font-family:'Fraunces',serif;font-size:26px;font-weight:300;color:var(--text)}
.home-family{font-size:12px;color:var(--text3);margin-top:4px}
.home-role{font-weight:500}
.home-role.dad{color:var(--dad)}
.home-role.mom{color:var(--mom)}

.today-card{background:var(--surface);border:1px solid var(--border);border-radius:13px;padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;gap:9px}
.today-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.today-dot.dad{background:var(--dad);box-shadow:0 0 0 3px var(--dad-bg)}
.today-dot.mom{background:var(--mom);box-shadow:0 0 0 3px var(--mom-bg)}
.today-dot.none{background:var(--border2)}
.today-text{font-size:13px;color:var(--text2);line-height:1.55}
.cp{font-weight:500}
.cp.dad{color:var(--dad)}
.cp.mom{color:var(--mom)}

.swap-alert{background:var(--green-bg);border:1px solid var(--green-border);border-radius:11px;padding:11px 14px;margin-bottom:12px;cursor:pointer}
.swap-alert.dad-alert{background:var(--dad-bg);border-color:var(--dad-border)}
.swap-alert-top{display:flex;align-items:center;gap:7px;margin-bottom:2px}
.swap-alert-dot{width:7px;height:7px;border-radius:50%;background:var(--green);flex-shrink:0;animation:blink 1.5s infinite}
.swap-alert-dot.dad-dot{background:var(--dad)}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
.swap-alert-title{font-size:12px;font-weight:500;color:var(--green)}
.swap-alert-title.dad-title{color:var(--dad)}
.swap-alert-sub{font-size:11px;color:#5a8a40}
.swap-alert-sub.dad-sub{color:var(--dad-text)}

.nav-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:auto}
.nav-btn{padding:14px 10px;border-radius:11px;background:var(--surface);border:1px solid var(--border);color:var(--text2);cursor:pointer;text-align:center;transition:all .15s;font-size:11px;font-family:'DM Sans',sans-serif;position:relative}
.nav-btn:hover{background:var(--surface2);border-color:var(--border2)}
.nav-btn .ni{font-size:20px;display:block;margin-bottom:5px}
.nav-btn.hl{background:var(--dad-bg);border-color:var(--dad-border);color:var(--dad-text)}
.nav-btn.swap-pending{background:var(--green-bg);border-color:var(--green-border);color:var(--green)}
.nav-badge{position:absolute;top:8px;left:8px;background:var(--red);color:#fff;border-radius:9px;font-size:9px;padding:1px 5px;font-weight:600}
.logout-btn{margin-top:10px;width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text3);border-radius:9px;padding:9px;cursor:pointer;font-size:12px;font-family:'DM Sans',sans-serif}

.view{min-height:100vh;display:flex;flex-direction:column;background:var(--bg)}
.vheader{padding:13px 17px 11px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;position:sticky;top:0;background:var(--surface);z-index:10}
.back-btn{background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:6px 11px;cursor:pointer;font-size:12px;font-family:'DM Sans',sans-serif}
.back-btn:hover{background:var(--border)}
.vtitle{font-family:'Fraunces',serif;font-size:17px;font-weight:300;color:var(--text)}
.vbody{padding:18px;flex:1}

.live-hero{text-align:center;padding:22px 0 26px}
.live-status-label{font-size:10px;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px}
.live-current{font-family:'Fraunces',serif;font-size:22px;font-weight:300;min-height:30px;margin-bottom:4px}
.live-current.dad{color:var(--dad)}
.live-current.mom{color:var(--mom)}
.mark-wrap{display:flex;justify-content:center;margin:18px 0 8px}
.mark-btn{width:150px;height:150px;border-radius:50%;border:2px solid var(--dad-border);cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;background:var(--dad-bg);color:var(--dad-text);box-shadow:0 0 0 6px var(--dad-bg),0 0 0 8px var(--dad-border);transition:transform .15s}
.mark-btn.mom-btn{background:var(--mom-bg);color:var(--mom-text);border-color:var(--mom-border);box-shadow:0 0 0 6px var(--mom-bg),0 0 0 8px var(--mom-border)}
.mark-btn.disabled{background:var(--surface2);color:var(--text3);border-color:var(--border);box-shadow:none;cursor:default}
.mark-btn .me{font-size:30px}
.mark-btn:not(.disabled):active{transform:scale(.93)}
.hint{text-align:center;font-size:12px;color:var(--text3);line-height:1.7}
.sync-badge{font-size:10px;color:var(--text3);text-align:center;padding:6px 0 0}

.loading-spinner{text-align:center;padding:50px 0;color:var(--text3);font-size:13px}
.error-msg{background:var(--red-bg);border:1px solid var(--red-border);border-radius:9px;padding:11px 13px;font-size:13px;color:var(--red);margin-bottom:13px}

.log-list{display:flex;flex-direction:column;gap:6px}
.log-entry{background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:11px 13px;display:flex;gap:9px;align-items:flex-start}
.log-dot{width:7px;height:7px;border-radius:50%;margin-top:4px;flex-shrink:0}
.log-dot.dad{background:var(--dad)}
.log-dot.mom{background:var(--mom)}
.log-dot.system{background:var(--green)}
.log-text{font-size:12px;color:var(--text2);line-height:1.5}
.log-time{font-size:10px;color:var(--text3);margin-top:2px}
.lw.dad{color:var(--dad);font-weight:500}
.lw.mom{color:var(--mom);font-weight:500}
.empty{text-align:center;padding:50px 18px;color:var(--text3);font-size:13px}
.empty .ei{font-size:36px;display:block;margin-bottom:10px}
.clear-btn{background:var(--red-bg);border:1px solid var(--red-border);color:var(--red);border-radius:8px;padding:9px 13px;cursor:pointer;font-size:12px;font-family:'DM Sans',sans-serif;margin-top:13px;width:100%}

.sched-section{margin-bottom:18px}
.sched-title{font-family:'Fraunces',serif;font-size:14px;font-weight:300;color:var(--text);margin-bottom:9px}
.week-view{background:var(--surface);border:1px solid var(--border);border-radius:11px;overflow:hidden;margin-bottom:8px}
.week-day{display:flex;align-items:center;gap:8px;padding:9px 13px;border-bottom:1px solid var(--border)}
.week-day:last-child{border-bottom:none}
.wdn{font-size:12px;color:var(--text2);min-width:54px}
.wdb{padding:2px 9px;border-radius:18px;font-size:11px;font-weight:500}
.wdb.dad{background:var(--dad-bg);color:var(--dad-text);border:1px solid var(--dad-border)}
.wdb.mom{background:var(--mom-bg);color:var(--mom-text);border:1px solid var(--mom-border)}
.wdb.rot{background:var(--amber-bg);color:var(--amber);border:1px solid var(--amber-border)}
.wdb.none{background:var(--surface2);color:var(--text3);border:1px solid var(--border)}
.wdn2{font-size:10px;color:var(--text3);margin-right:auto}
.legend{display:flex;gap:11px;flex-wrap:wrap;margin-bottom:14px}
.li{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text2)}
.ld{width:7px;height:7px;border-radius:50%}
.edit-btn{background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:9px;padding:10px 14px;cursor:pointer;font-size:12px;font-family:'DM Sans',sans-serif;width:100%;margin-top:9px}
.save-btn{background:var(--dad);border:none;color:#fff;border-radius:9px;padding:11px 14px;cursor:pointer;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;width:100%;margin-top:7px}
.cancel-btn{background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:9px;padding:9px 14px;cursor:pointer;font-size:12px;font-family:'DM Sans',sans-serif;width:100%;margin-top:7px}
.days-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:5px}
.dp{padding:7px 0;border-radius:6px;text-align:center;font-size:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text3);cursor:pointer;transition:all .15s;user-select:none}
.dp.dad{background:var(--dad-bg);border-color:var(--dad-border);color:var(--dad-text)}
.dp.mom{background:var(--mom-bg);border-color:var(--mom-border);color:var(--mom-text)}
.dp.rot{background:var(--amber-bg);border-color:var(--amber-border);color:var(--amber)}
.dp.disabled{opacity:.35;cursor:not-allowed}
.instr{font-size:11px;color:var(--text3);margin-bottom:8px;line-height:1.55}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:11px 13px;background:var(--surface);border:1px solid var(--border);border-radius:9px;margin-top:10px;font-size:12px;color:var(--text2)}
.toggle{width:42px;height:22px;background:var(--border2);border-radius:11px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
.toggle.on{background:var(--dad)}
.toggle::after{content:'';position:absolute;top:3px;right:3px;width:16px;height:16px;background:#fff;border-radius:50%;transition:transform .2s}
.toggle.on::after{transform:translateX(-20px)}
.settings-section{margin-top:18px;border-top:1px solid var(--border);padding-top:15px}

.cal-nav-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px}
.cal-month-title{font-family:'Fraunces',serif;font-size:18px;font-weight:300;color:var(--text)}
.cal-year-sub{font-size:11px;color:var(--text3);margin-top:2px}
.cal-arrow{background:var(--surface);border:1px solid var(--border);color:var(--text2);border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center}
.cal-arrow:hover{background:var(--surface2)}
.cal-legend{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.cal-leg{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text2)}
.cal-leg-dot{width:6px;height:6px;border-radius:50%}
.dow-row{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:3px}
.dow-cell{text-align:center;font-size:9px;color:var(--text3);padding:2px 0;font-weight:500}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
.dc{min-height:42px;border-radius:7px;padding:4px 2px 3px;cursor:pointer;display:flex;flex-direction:column;align-items:center;border:1px solid transparent;transition:all .1s;user-select:none}
.dc:hover:not(.dc-empty){background:var(--surface2)}
.dc-empty{cursor:default}
.dc-dad{background:var(--dad-bg);border-color:var(--dad-border)}
.dc-mom{background:var(--mom-bg);border-color:var(--mom-border)}
.dc-today{outline:2px solid var(--dad);outline-offset:-2px}
.dc-selected{outline:2px solid var(--text);outline-offset:-2px}
.dc-past{opacity:.45}
.dc-num{font-size:11px;font-weight:500;line-height:1;color:var(--text)}
.dc-dad .dc-num{color:var(--dad-text)}
.dc-mom .dc-num{color:var(--mom-text)}
.dc-empty .dc-num{color:var(--border2)}
.dc-indicators{display:flex;gap:2px;margin-top:3px;justify-content:center}
.dind{width:4px;height:4px;border-radius:50%}
.dind-actual-dad{background:var(--dad)}
.dind-actual-mom{background:var(--mom)}
.dind-swap{background:var(--green)}
.cal-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-top:12px}
.cal-stat{background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:9px 6px;text-align:center}
.cal-stat-num{font-family:'Fraunces',serif;font-size:18px;font-weight:300}
.cal-stat-num.dad{color:var(--dad)}
.cal-stat-num.mom{color:var(--mom)}
.cal-stat-num.swap{color:var(--green)}
.cal-stat-label{font-size:9px;color:var(--text3);margin-top:2px}
.day-detail{background:var(--surface);border:1px solid var(--border);border-radius:11px;margin-top:10px;overflow:hidden}
.day-detail-header{padding:11px 13px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.day-detail-title{font-family:'Fraunces',serif;font-size:14px;font-weight:300;color:var(--text)}
.day-detail-close{background:none;border:none;color:var(--text3);font-size:15px;cursor:pointer}
.day-detail-body{padding:11px 13px;display:flex;flex-direction:column;gap:7px}
.detail-row{display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)}
.detail-row:last-of-type{border-bottom:none}
.detail-label{color:var(--text2)}
.detail-val{font-weight:500;color:var(--text)}
.detail-val.dad{color:var(--dad)}
.detail-val.mom{color:var(--mom)}
.detail-val.swap{color:var(--green)}
.detail-val.none{color:var(--text3)}
.detail-note-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:12px;padding:7px 9px;font-family:'DM Sans',sans-serif;resize:none;margin-top:3px}
.detail-note-input:focus{outline:none;border-color:var(--dad)}
.detail-save-note{background:var(--dad);border:none;color:#fff;border-radius:7px;padding:7px 12px;font-size:11px;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:5px}
.detail-saved{font-size:10px;color:var(--green);margin-top:3px}

.swap-view{display:flex;flex-direction:column;gap:12px}
.swap-pending-card{background:var(--green-bg);border:1px solid var(--green-border);border-radius:13px;padding:16px}
.swap-pending-title{font-family:'Fraunces',serif;font-size:14px;font-weight:300;color:var(--green);margin-bottom:12px}
.swap-days-display{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-bottom:14px}
.swap-day-box{background:var(--surface);border:1px solid var(--green-border);border-radius:9px;padding:10px;text-align:center}
.sdb-who{font-size:10px;color:#5a8a40;margin-bottom:3px}
.sdb-day{font-size:12px;font-weight:500;color:var(--green);line-height:1.4}
.swap-arrow{font-size:18px;color:#5a8a40;text-align:center}
.swap-action-btns{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.swap-approve-btn{background:var(--green);border:none;color:#fff;border-radius:9px;padding:11px;cursor:pointer;font-size:12px;font-weight:500;font-family:'DM Sans',sans-serif}
.swap-reject-btn{background:var(--red-bg);border:1px solid var(--red-border);color:var(--red);border-radius:9px;padding:11px;cursor:pointer;font-size:12px;font-weight:500;font-family:'DM Sans',sans-serif}
.swap-cancel-btn{background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:9px;padding:9px;cursor:pointer;font-size:11px;font-family:'DM Sans',sans-serif;width:100%;margin-top:7px}
.swap-sent-card{background:var(--dad-bg);border:1px solid var(--dad-border);border-radius:13px;padding:16px}
.swap-sent-title{font-size:12px;color:var(--dad);margin-bottom:11px;display:flex;align-items:center;gap:7px}
.waiting-dots{display:inline-flex;gap:3px}
.waiting-dots span{width:4px;height:4px;border-radius:50%;background:var(--dad);animation:wd .9s infinite}
.waiting-dots span:nth-child(2){animation-delay:.2s}
.waiting-dots span:nth-child(3){animation-delay:.4s}
@keyframes wd{0%,100%{opacity:.2}50%{opacity:1}}
.new-swap-title{font-family:'Fraunces',serif;font-size:15px;font-weight:300;color:var(--text);margin-bottom:5px}
.new-swap-sub{font-size:11px;color:var(--text3);margin-bottom:14px;line-height:1.6}
.day-select-label{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin-bottom:7px;margin-top:12px}
.day-list{display:flex;flex-direction:column;gap:5px;max-height:200px;overflow-y:auto}
.day-item{display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:8px;background:var(--surface);border:1px solid var(--border);cursor:pointer;transition:all .15s}
.day-item:hover{background:var(--surface2)}
.day-item.selected-dad{border-color:var(--dad);background:var(--dad-bg)}
.day-item.selected-mom{border-color:var(--mom);background:var(--mom-bg)}
.di-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.di-dot.dad{background:var(--dad)}
.di-dot.mom{background:var(--mom)}
.di-label{font-size:12px;color:var(--text)}
.di-owner{font-size:10px;margin-right:auto}
.di-owner.dad{color:var(--dad)}
.di-owner.mom{color:var(--mom)}
.send-swap-btn{background:var(--dad);border:none;color:#fff;border-radius:9px;padding:12px;cursor:pointer;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;width:100%;margin-top:12px}
.send-swap-btn:disabled{background:var(--border2);color:var(--surface);cursor:default}
.whatsapp-btn{background:#25d366;border:none;color:#fff;border-radius:9px;padding:12px;cursor:pointer;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;width:100%;margin-top:7px;display:flex;align-items:center;justify-content:center;gap:7px}
.whatsapp-btn:disabled{background:var(--border2);cursor:default}
.swap-log-section{margin-top:20px}
.swap-log-title{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin-bottom:9px}
.swap-log-list{display:flex;flex-direction:column;gap:6px}
.swap-log-item{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px}
.sli-status{font-size:11px;font-weight:500;margin-bottom:3px}
.sli-status.approved{color:var(--green)}
.sli-status.rejected{color:var(--red)}
.sli-status.cancelled{color:var(--text3)}
.sli-text{font-size:11px;color:var(--text2);line-height:1.5}

.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:9px 20px;border-radius:22px;font-size:12px;z-index:9999;animation:fadeup .3s ease;white-space:nowrap}
.toast.dad{background:var(--dad-bg);border:1px solid var(--dad-border);color:var(--dad-text)}
.toast.mom{background:var(--mom-bg);border:1px solid var(--mom-border);color:var(--mom-text)}
.toast.ok{background:var(--green-bg);border:1px solid var(--green-border);color:var(--green)}
.toast.err{background:var(--red-bg);border:1px solid var(--red-border);color:var(--red)}
@keyframes fadeup{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
`;

// ── NotificationPanel ─────────────────────────────────────────────────────────
function NotificationPanel({ notifications, role, onSeen, onDismiss, onRespondSwap, onRespondPickup, onClose }) {
  useEffect(function() {
    (notifications || []).forEach(function(n) {
      if (n.seenBy && !n.seenBy[role]) onSeen(n.id);
    });
  }, []); // eslint-disable-line

  function fmt(iso) {
    return new Date(iso).toLocaleString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="notif-panel">
      <div className="notif-backdrop" onClick={onClose} />
      <div className="notif-sheet">
        <div className="notif-sheet-header">
          <div className="notif-sheet-title">🔔 התראות</div>
          <button className="notif-close" onClick={onClose}>✕</button>
        </div>
        <div className="notif-list">
          {(!notifications || notifications.length === 0) && (
            <div className="notif-empty">אין התראות</div>
          )}
          {(notifications || []).map(function(n) {
            var meta = NOTIF_LABELS[n.type] || { icon: "📢", title: n.type, green: false, actionFor: null };
            var isSeen = n.seenBy && !!n.seenBy[role];
            var otherRole = role === "dad" ? "mom" : "dad";
            var otherSeen = n.seenBy && !!n.seenBy[otherRole];
            var canAct = meta.actionFor === "other" && n.createdBy !== role;
            var bgClass = !isSeen ? (meta.green ? "unseen green-notif" : "unseen") : "";
            return (
              <div key={n.id} className={"notif-item " + bgClass}>
                <div className="notif-item-top">
                  <div className="notif-icon">{meta.icon}</div>
                  <div className="notif-text">
                    <div className="notif-title">{meta.title}</div>
                    {n.payload && n.payload.offerDay && (
                      <div className="notif-sub">{n.payload.offerDay.label} ↔ {n.payload.wantDay.label}</div>
                    )}
                    {n.type === "pickup_request" && (
                      <div className="notif-sub">{n.createdBy === "dad" ? "אבא" : "אמא"} מבקש/ת לסמן שהילד/ים אצלו/ה</div>
                    )}
                    {n.type === "schedule_changed" && (
                      <div className="notif-sub">{n.createdBy === "dad" ? "אבא" : "אמא"} עדכן/ה את הסדר הקבוע</div>
                    )}
                    <div className="notif-time">{fmt(n.createdAt)}</div>
                    <div className="notif-seen-row">
                      {role === "dad" ? "👨 אתה" : "👩 את"}: <span>ראית</span>
                      {" · "}
                      {otherRole === "dad" ? "👨" : "👩"}: {otherSeen ? <span>ראה/ראתה</span> : "טרם ראה/ראתה"}
                    </div>
                  </div>
                </div>
                {canAct && n.type === "swap_request" && (
                  <div className="notif-actions">
                    <button className="notif-approve" onClick={function() { onRespondSwap("approve"); onClose(); }}>✅ אשר החלפה</button>
                    <button className="notif-reject" onClick={function() { onRespondSwap("reject"); onClose(); }}>❌ דחה</button>
                  </div>
                )}
                {canAct && n.type === "pickup_request" && (
                  <div className="notif-actions">
                    <button className="notif-approve" onClick={function() { onRespondPickup(n.id, "approve"); onClose(); }}>✅ אשר איסוף</button>
                    <button className="notif-reject" onClick={function() { onRespondPickup(n.id, "reject"); onClose(); }}>❌ דחה</button>
                  </div>
                )}
                <button className="notif-dismiss" onClick={function() { onDismiss(n.id); }}>הסר התראה</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── AdminPanel ────────────────────────────────────────────────────────────────
function AdminPanel({ onLogout }) {
  var adminPwd = localStorage.getItem("tg_admin_pwd") || "";
  const [families, setFamilies] = useState([]);
  const [newName, setNewName] = useState("");
  const [newDadPwd, setNewDadPwd] = useState("");
  const [newMomPwd, setNewMomPwd] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPwds, setShowPwds] = useState({});
  const [editPwds, setEditPwds] = useState({});

  const load = useCallback(async function() {
    try { setFamilies(await adminFetch("/api/admin/families", {}, adminPwd)); }
    catch (e) { setError(e.message); }
  }, [adminPwd]);

  useEffect(function() { load(); }, [load]);

  async function addFamily() {
    if (!newName || !newDadPwd || !newMomPwd) return;
    setSaving(true); setError(null);
    try {
      await adminFetch("/api/admin/families", { method: "POST", body: JSON.stringify({ name: newName, dadPassword: newDadPwd, momPassword: newMomPwd }) }, adminPwd);
      setNewName(""); setNewDadPwd(""); setNewMomPwd(""); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function deleteFamily(id, name) {
    if (!window.confirm("למחוק את משפחת " + name + "?")) return;
    try { await adminFetch("/api/admin/families/" + id, { method: "DELETE" }, adminPwd); load(); }
    catch (e) { setError(e.message); }
  }

  async function savePwds(id) {
    var ep = editPwds[id] || {};
    if (!ep.dad && !ep.mom) return;
    try {
      await adminFetch("/api/admin/families/" + id + "/passwords", { method: "PUT", body: JSON.stringify({ dadPassword: ep.dad || undefined, momPassword: ep.mom || undefined }) }, adminPwd);
      setEditPwds(function(prev) { return Object.assign({}, prev, { [id]: {} }); });
      load();
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <div className="admin-title">🛡️ Togather — פנל ניהול</div>
        <button className="admin-logout" onClick={onLogout}>יציאה</button>
      </div>
      <div className="admin-body">
        {error && <div className="error-msg" style={{ marginBottom: 14 }}>{error}</div>}
        <div className="admin-section-title">הוסף משפחה חדשה</div>
        <div className="add-family-card">
          <div className="field" style={{ margin: "0 0 9px" }}>
            <label>שם משפחה</label>
            <input value={newName} onChange={function(e) { setNewName(e.target.value); }} placeholder="כהן" />
          </div>
          <div className="add-row">
            <div className="field" style={{ margin: 0 }}>
              <label>👨 סיסמת אבא</label>
              <input value={newDadPwd} onChange={function(e) { setNewDadPwd(e.target.value); }} placeholder="dad123" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>👩 סיסמת אמא</label>
              <input value={newMomPwd} onChange={function(e) { setNewMomPwd(e.target.value); }} placeholder="mom123" />
            </div>
          </div>
          <button className="add-btn" onClick={addFamily} disabled={saving || !newName || !newDadPwd || !newMomPwd}>
            {saving ? "שומר..." : "+ הוסף משפחה"}
          </button>
        </div>

        <div className="admin-section-title">משפחות רשומות ({families.length})</div>
        {families.length === 0 && <div className="empty-families">אין משפחות עדיין</div>}
        <div className="families-list">
          {families.map(function(f) {
            return (
              <div key={f.id} className="family-card">
                <div className="family-top">
                  <div className="family-icon">👨‍👩‍👧</div>
                  <div className="family-info">
                    <div className="family-name">משפחת {f.name}</div>
                    <div className="family-meta">
                      נוצר: {new Date(f.createdAt).toLocaleDateString("he-IL")}
                      {f.lastActive && " · פעיל: " + new Date(f.lastActive).toLocaleDateString("he-IL")}
                    </div>
                  </div>
                  <div className="family-actions">
                    <button className="fam-btn" onClick={function() { setShowPwds(function(prev) { return Object.assign({}, prev, { [f.id]: !prev[f.id] }); }); }}>
                      {showPwds[f.id] ? "🔒 הסתר" : "👁 סיסמאות"}
                    </button>
                    <button className="fam-btn del" onClick={function() { deleteFamily(f.id, f.name); }}>🗑️</button>
                  </div>
                </div>
                {showPwds[f.id] && (
                  <div className="pwd-box">
                    <div className="pwd-row">
                      <div>
                        <div className="pwd-label">👨 אבא</div>
                        <div className="pwd-badge dad">{f.dadPassword}</div>
                      </div>
                      <div>
                        <div className="pwd-label">👩 אמא</div>
                        <div className="pwd-badge mom">{f.momPassword}</div>
                      </div>
                    </div>
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                      <div className="pwd-label" style={{ marginBottom: 5 }}>שנה סיסמאות</div>
                      <div className="pwd-edit-row">
                        <input className="pwd-edit-input" placeholder="סיסמה חדשה לאבא"
                          value={(editPwds[f.id] && editPwds[f.id].dad) || ""}
                          onChange={function(e) { var v = e.target.value; setEditPwds(function(prev) { return Object.assign({}, prev, { [f.id]: Object.assign({}, prev[f.id], { dad: v }) }); }); }} />
                        <input className="pwd-edit-input" placeholder="סיסמה חדשה לאמא"
                          value={(editPwds[f.id] && editPwds[f.id].mom) || ""}
                          onChange={function(e) { var v = e.target.value; setEditPwds(function(prev) { return Object.assign({}, prev, { [f.id]: Object.assign({}, prev[f.id], { mom: v }) }); }); }} />
                      </div>
                      <button className="add-btn" style={{ marginTop: 6, fontSize: 12, padding: "6px 12px" }} onClick={function() { savePwds(f.id); }}>שמור</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── LoginScreen ───────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, onAdminLogin }) {
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPwd, setAdminPwd] = useState("");

  async function handleLogin() {
    if (!name || !password || !selectedRole) return;
    setLoading(true); setError(null);
    try {
      var res = await apiFetch("/api/family/login", { method: "POST", body: JSON.stringify({ name: name, password: password, role: selectedRole }) });
      onLogin({ familyId: res.familyId, familyName: res.familyName, password: password, role: res.role });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleAdminLogin() {
    setLoading(true); setError(null);
    try {
      await apiFetch("/api/admin/login", { method: "POST", body: JSON.stringify({ password: adminPwd }) });
      localStorage.setItem("tg_admin_pwd", adminPwd);
      onAdminLogin();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="login-wrap">
      <div className="login-logo">👨‍👩‍👧</div>
      <div className="login-title">Togather</div>
      <div className="login-sub">יומן הורות משותפת</div>
      {!showAdmin ? (
        <div className="login-card">
          <div className="login-card-title">כניסה למשפחה</div>
          {error && <div className="login-err">{error}</div>}
          <div className="field">
            <label>שם משפחה</label>
            <input value={name} onChange={function(e) { setName(e.target.value); }} placeholder="כהן" />
          </div>
          <div className="field">
            <label>אני</label>
            <div className="role-pick">
              <button className={"role-pick-btn" + (selectedRole === "dad" ? " dad-active" : "")} onClick={function() { setSelectedRole("dad"); }}>👨 אבא</button>
              <button className={"role-pick-btn" + (selectedRole === "mom" ? " mom-active" : "")} onClick={function() { setSelectedRole("mom"); }}>👩 אמא</button>
            </div>
          </div>
          <div className="field">
            <label>סיסמה</label>
            <input type="password" value={password} onChange={function(e) { setPassword(e.target.value); }} placeholder="••••••" onKeyDown={function(e) { if (e.key === "Enter") handleLogin(); }} />
          </div>
          <button className="login-btn" onClick={handleLogin} disabled={loading || !name || !password || !selectedRole}>
            {loading ? "מתחבר..." : "כניסה →"}
          </button>
          <div className="admin-link" onClick={function() { setShowAdmin(true); setError(null); }}>כניסת מנהל</div>
        </div>
      ) : (
        <div className="login-card">
          <div className="login-card-title">🛡️ כניסת מנהל</div>
          {error && <div className="login-err">{error}</div>}
          <div className="field">
            <label>סיסמת מנהל</label>
            <input type="password" value={adminPwd} onChange={function(e) { setAdminPwd(e.target.value); }} placeholder="••••••" onKeyDown={function(e) { if (e.key === "Enter") handleAdminLogin(); }} />
          </div>
          <button className="login-btn" onClick={handleAdminLogin} disabled={loading || !adminPwd}>
            {loading ? "מתחבר..." : "כניסה →"}
          </button>
          <div className="admin-link" onClick={function() { setShowAdmin(false); setError(null); }}>← חזרה</div>
        </div>
      )}
    </div>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function Calendar({ schedule, liveLog, swapLog }) {
  var today = new Date();
  const [curYear, setCurYear] = useState(today.getFullYear());
  const [curMonth, setCurMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [notes, setNotes] = useState(function() {
    try { return JSON.parse(localStorage.getItem("tg_notes") || "{}"); } catch { return {}; }
  });

  function changeMonth(dir) {
    var m = curMonth + dir, y = curYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCurMonth(m); setCurYear(y); setSelectedDay(null);
  }

  var logByDate = {};
  (liveLog || []).forEach(function(e) {
    if (e.parent !== "system") {
      var d = e.timestamp.slice(0, 10);
      if (!logByDate[d]) logByDate[d] = e;
    }
  });

  var swapByDate = {};
  (swapLog || []).filter(function(s) { return s.status === "approved"; }).forEach(function(s) {
    if (s.offerDay && s.offerDay.date) swapByDate[s.offerDay.date] = true;
    if (s.wantDay && s.wantDay.date) swapByDate[s.wantDay.date] = true;
  });

  var firstDow = new Date(curYear, curMonth, 1).getDay();
  var daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  var todayStr = toDateStr(today);
  var dadCount = 0, momCount = 0, swapCount = 0;
  var cells = [];
  for (var i = 0; i < firstDow; i++) cells.push(null);
  for (var d = 1; d <= daysInMonth; d++) {
    var dt = new Date(curYear, curMonth, d);
    var dateStr = toDateStr(dt);
    var owner = getScheduledOwner(dt, schedule);
    var actual = logByDate[dateStr];
    var swapped = swapByDate[dateStr];
    if (owner === "dad") dadCount++;
    if (owner === "mom") momCount++;
    if (swapped) swapCount++;
    cells.push({ d: d, dateStr: dateStr, owner: owner, actual: actual, swapped: swapped, dt: dt });
  }

  function saveNote() {
    var updated = Object.assign({}, notes, { [selectedDay.dateStr]: noteInput });
    setNotes(updated);
    localStorage.setItem("tg_notes", JSON.stringify(updated));
    setNoteSaved(true);
  }

  return (
    <div>
      <div className="cal-nav-row">
        <div>
          <div className="cal-month-title">{MONTHS_HE[curMonth]}</div>
          <div className="cal-year-sub">{curYear}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="cal-arrow" onClick={function() { changeMonth(-1); }}>›</button>
          <button className="cal-arrow" onClick={function() { changeMonth(1); }}>‹</button>
        </div>
      </div>
      <div className="cal-legend">
        <div className="cal-leg"><div className="cal-leg-dot" style={{ background: "var(--dad)" }} /> אבא</div>
        <div className="cal-leg"><div className="cal-leg-dot" style={{ background: "var(--mom)" }} /> אמא</div>
        <div className="cal-leg"><div className="cal-leg-dot" style={{ background: "var(--dad)", width: 13, height: 4, borderRadius: 2 }} /> בפועל</div>
        <div className="cal-leg"><div className="cal-leg-dot" style={{ background: "var(--green)" }} /> החלפה</div>
      </div>
      <div className="dow-row">
        {["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"].map(function(day) { return <div key={day} className="dow-cell">{day}</div>; })}
      </div>
      <div className="cal-grid">
        {cells.map(function(cell, idx) {
          if (!cell) return <div key={"e" + idx} className="dc dc-empty" />;
          var isPast = cell.dt < today && cell.dateStr !== todayStr;
          var isToday = cell.dateStr === todayStr;
          var isSelected = selectedDay && selectedDay.dateStr === cell.dateStr;
          var cls = "dc" +
            (cell.owner === "dad" ? " dc-dad" : cell.owner === "mom" ? " dc-mom" : "") +
            (isPast ? " dc-past" : "") +
            (isToday ? " dc-today" : "") +
            (isSelected ? " dc-selected" : "");
          return (
            <div key={cell.dateStr} className={cls} onClick={function() {
              if (isSelected) { setSelectedDay(null); return; }
              setSelectedDay(cell); setNoteInput(notes[cell.dateStr] || ""); setNoteSaved(false);
            }}>
              <div className="dc-num">{cell.d}</div>
              <div className="dc-indicators">
                {cell.actual && <div className={"dind dind-actual-" + cell.actual.parent} />}
                {cell.swapped && <div className="dind dind-swap" />}
              </div>
            </div>
          );
        })}
      </div>
      {selectedDay && (
        <div className="day-detail">
          <div className="day-detail-header">
            <div className="day-detail-title">{DAYS_HE[selectedDay.dt.getDay()]} {selectedDay.d} ב{MONTHS_HE[curMonth]}</div>
            <button className="day-detail-close" onClick={function() { setSelectedDay(null); }}>✕</button>
          </div>
          <div className="day-detail-body">
            <div className="detail-row">
              <span className="detail-label">לפי הסדר</span>
              <span className={"detail-val " + (selectedDay.owner || "none")}>
                {selectedDay.owner === "dad" ? "👨 אבא" : selectedDay.owner === "mom" ? "👩 אמא" : "לא מוגדר"}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">סימון בפועל</span>
              <span className={"detail-val " + (selectedDay.actual ? selectedDay.actual.parent : "none")}>
                {selectedDay.actual
                  ? (selectedDay.actual.parent === "dad" ? "👨 אבא" : "👩 אמא") + " · " + formatTime(selectedDay.actual.timestamp)
                  : "לא סומן"}
              </span>
            </div>
            {selectedDay.swapped && (
              <div className="detail-row">
                <span className="detail-label">החלפה</span>
                <span className="detail-val swap">✅ הוחלף</span>
              </div>
            )}
            <div>
              <div className="detail-label" style={{ fontSize: 11, marginBottom: 4 }}>הערה</div>
              <textarea className="detail-note-input" rows={2} placeholder="הוסף הערה ליום זה..."
                value={noteInput} onChange={function(e) { setNoteInput(e.target.value); setNoteSaved(false); }} />
              <button className="detail-save-note" onClick={saveNote}>שמור</button>
              {noteSaved && <div className="detail-saved">✓ נשמר</div>}
            </div>
          </div>
        </div>
      )}
      <div className="cal-stats">
        <div className="cal-stat"><div className={"cal-stat-num dad"}>{dadCount}</div><div className="cal-stat-label">ימי אבא</div></div>
        <div className="cal-stat"><div className={"cal-stat-num mom"}>{momCount}</div><div className="cal-stat-label">ימי אמא</div></div>
        <div className="cal-stat"><div className={"cal-stat-num swap"}>{swapCount}</div><div className="cal-stat-label">החלפות</div></div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(function() { return getSession(); });
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState("home");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [editSchedule, setEditSchedule] = useState(false);
  const [tmpFixed, setTmpFixed] = useState({ dad: [], mom: [] });
  const [tmpRot, setTmpRot] = useState([]);
  const [tmpRotDad, setTmpRotDad] = useState(true);
  const [swapStep, setSwapStep] = useState(1);
  const [offerDay, setOfferDay] = useState(null);
  const [wantDay, setWantDay] = useState(null);
  const [showNotifs, setShowNotifs] = useState(false);

  var role = session ? session.role : null;

  function handleLogin(s) { saveSession(s); setSession(s); setIsAdmin(false); }
  function handleAdminLogin() { setIsAdmin(true); setSession(null); }
  function handleLogout() { clearSession(); setSession(null); setIsAdmin(false); setData(null); setView("home"); }

  const loadData = useCallback(async function() {
    if (!session) return;
    try {
      setError(null);
      var d = await apiFetch("/api/family/data", {}, session);
      setData(d);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [session]);

  useEffect(function() { if (session) { setLoading(true); loadData(); } }, [session, loadData]);
  useEffect(function() {
    if (!session) return;
    var id = setInterval(loadData, 15000);
    return function() { clearInterval(id); };
  }, [session, loadData]);

  function showToast(msg, type) { setToast({ msg: msg, type: type || "ok" }); setTimeout(function() { setToast(null); }, 2800); }

  function todayScheduled() {
    if (!data || !data.schedule) return null;
    return getScheduledOwner(new Date(), data.schedule);
  }

  async function handleMark() {
    if (!session || saving) return;
    setSaving(true);
    try {
      var res = await apiFetch("/api/family/mark", { method: "POST", body: JSON.stringify({}) }, session);
      if (res.pending) {
        showToast("📨 בקשת האיסוף נשלחה לאישור", "ok");
        await loadData();
      } else {
        setData(function(prev) { return Object.assign({}, prev, { currentWith: res.currentWith, liveLog: [res.entry].concat(prev.liveLog) }); });
        showToast("✓ " + (session.role === "dad" ? "אבא" : "אמא") + " סימן/ה בהצלחה", session.role);
      }
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  function startEdit() {
    var s = data && data.schedule;
    setTmpFixed({ dad: (s && s.fixed && s.fixed.dad ? s.fixed.dad.slice() : []), mom: (s && s.fixed && s.fixed.mom ? s.fixed.mom.slice() : []) });
    setTmpRot(s && s.rotating && s.rotating.days ? s.rotating.days.slice() : []);
    setTmpRotDad(s && s.rotating ? s.rotating.currentWeekDad : true);
    setEditSchedule(true);
  }

  function toggleFixed(day, parent) {
    var other = parent === "dad" ? "mom" : "dad";
    setTmpFixed(function(prev) {
      if (prev[parent].indexOf(day) >= 0) return Object.assign({}, prev, { [parent]: prev[parent].filter(function(d) { return d !== day; }) });
      if (prev[other].indexOf(day) >= 0 || tmpRot.indexOf(day) >= 0) return prev;
      return Object.assign({}, prev, { [parent]: prev[parent].concat([day]) });
    });
  }

  function toggleRot(day) {
    if (tmpFixed.dad.indexOf(day) >= 0 || tmpFixed.mom.indexOf(day) >= 0) return;
    setTmpRot(function(prev) { return prev.indexOf(day) >= 0 ? prev.filter(function(d) { return d !== day; }) : prev.concat([day]); });
  }

  async function saveSchedule() {
    var schedule = { fixed: tmpFixed, rotating: { days: tmpRot, currentWeekDad: tmpRotDad } };
    setSaving(true);
    try {
      var res = await apiFetch("/api/family/schedule", { method: "PUT", body: JSON.stringify({ schedule: schedule }) }, session);
      setData(function(prev) { return Object.assign({}, prev, { schedule: res.schedule }); });
      setEditSchedule(false); showToast("✓ הסדר נשמר", "ok");
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function clearLog() {
    if (!window.confirm("למחוק את כל ההיסטוריה?")) return;
    await apiFetch("/api/family/log", { method: "DELETE" }, session);
    setData(function(prev) { return Object.assign({}, prev, { liveLog: [], currentWith: null }); });
  }

  async function sendSwap() {
    if (!offerDay || !wantDay || !role || saving) return;
    setSaving(true);
    try {
      var res = await apiFetch("/api/family/swap", { method: "POST", body: JSON.stringify({ offerDay: offerDay, wantDay: wantDay }) }, session);
      setData(function(prev) { return Object.assign({}, prev, { swapRequest: res.swapRequest }); });
      setOfferDay(null); setWantDay(null); setSwapStep(1);
      showToast("✓ בקשת החלפה נשלחה!", "ok");
    } catch (e) { showToast(e.message, "err"); }
    finally { setSaving(false); }
  }

  async function respondSwap(action) {
    if (!role || saving) return;
    setSaving(true);
    try {
      await apiFetch("/api/family/swap/respond", { method: "PUT", body: JSON.stringify({ action: action }) }, session);
      await loadData();
      showToast(action === "approve" ? "✓ אישרת את ההחלפה!" : "בקשה נדחתה", action === "approve" ? "ok" : "err");
    } catch (e) { showToast(e.message, "err"); }
    finally { setSaving(false); }
  }

  async function cancelSwap() {
    if (!role || saving) return;
    setSaving(true);
    try {
      await apiFetch("/api/family/swap", { method: "DELETE", body: JSON.stringify({ cancelledBy: role }) }, session);
      await loadData(); showToast("הבקשה בוטלה", "err");
    } catch (e) { showToast(e.message, "err"); }
    finally { setSaving(false); }
  }

  function sendWhatsApp(offer, want) {
    var selfName = role === "dad" ? "אבא" : "אמא";
    var msg = "שלום! " + selfName + " מבקש/ת החלפת יום 🔄\n\n📅 אני נותן/ת: *" + offer.label + "*\n📅 אני רוצה: *" + want.label + "*\n\nלאישור או דחייה:\n" + APP_URL;
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
  }

  async function markSeen(notificationId) {
    try { await apiFetch("/api/family/notifications/seen", { method: "POST", body: JSON.stringify({ notificationId: notificationId }) }, session); }
    catch (e) { /* silent */ }
  }

  async function dismissNotif(notificationId) {
    try {
      await apiFetch("/api/family/notifications/" + notificationId, { method: "DELETE" }, session);
      setData(function(prev) { return Object.assign({}, prev, { notifications: (prev.notifications || []).filter(function(n) { return n.id !== notificationId; }) }); });
    } catch (e) { /* silent */ }
  }

  async function respondPickup(notificationId, action) {
    try {
      await apiFetch("/api/family/pickup/respond", { method: "POST", body: JSON.stringify({ notificationId: notificationId, action: action }) }, session);
      await loadData();
      showToast(action === "approve" ? "✓ האיסוף אושר!" : "האיסוף נדחה", action === "approve" ? "ok" : "err");
    } catch (e) { showToast(e.message, "err"); }
  }

  async function updateSettings(key, value) {
    try {
      var res = await apiFetch("/api/family/settings", { method: "PUT", body: JSON.stringify({ [key]: value }) }, session);
      setData(function(prev) { return Object.assign({}, prev, { settings: res.settings }); });
    } catch (e) { showToast(e.message, "err"); }
  }

  var scheduled = todayScheduled();
  var sched = data && data.schedule;
  var upcomingDays = sched ? buildUpcomingDays(sched) : [];
  var myDays = upcomingDays.filter(function(d) { return d.owner === role; });
  var otherDays = upcomingDays.filter(function(d) { return d.owner && d.owner !== role; });
  var swap = data && data.swapRequest;
  var hasPendingSwap = swap && swap.status === "pending";
  var isSwapRequester = swap && swap.requestedBy === role;
  var canRespondToSwap = hasPendingSwap && !isSwapRequester;
  var notifications = (data && data.notifications) || [];
  var unreadCount = notifications.filter(function(n) { return n.seenBy && !n.seenBy[role]; }).length;

  function getDayLabel(dow) {
    if (!sched) return null;
    if (sched.fixed.dad.indexOf(dow) >= 0) return "dad";
    if (sched.fixed.mom.indexOf(dow) >= 0) return "mom";
    if (sched.rotating.days.indexOf(dow) >= 0) return "rotating";
    return null;
  }

  function getTmpLabel(dow) {
    if (tmpFixed.dad.indexOf(dow) >= 0) return "dad";
    if (tmpFixed.mom.indexOf(dow) >= 0) return "mom";
    if (tmpRot.indexOf(dow) >= 0) return "rot";
    return null;
  }

  var dateInfo = todayHeDate();

  if (isAdmin) {
    return (
      <div className="app">
        <style>{CSS}</style>
        <AdminPanel onLogout={handleLogout} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app">
        <style>{CSS}</style>
        <LoginScreen onLogin={handleLogin} onAdminLogin={handleAdminLogin} />
      </div>
    );
  }

  return (
    <div className="app">
      <style>{CSS}</style>
      {toast && <div className={"toast " + toast.type}>{toast.msg}</div>}
      {showNotifs && (
        <NotificationPanel
          notifications={notifications}
          role={role}
          onSeen={markSeen}
          onDismiss={dismissNotif}
          onRespondSwap={async function(action) { await respondSwap(action); setShowNotifs(false); }}
          onRespondPickup={async function(id, action) { await respondPickup(id, action); setShowNotifs(false); }}
          onClose={function() { setShowNotifs(false); loadData(); }}
        />
      )}

      {view === "home" && (
        <div className="home">
          <div className="date-bar">
            <div className="date-bar-text"><span className="date-bar-day">{dateInfo.day}</span> · {dateInfo.date}</div>
            <div className="notif-bell" onClick={function() { setShowNotifs(true); }}>
              🔔
              {unreadCount > 0 && <div className="notif-badge">{unreadCount}</div>}
            </div>
          </div>
          <div className="home-header" style={{ marginTop: 18 }}>
            <span className="home-icon">👨‍👩‍👧</span>
            <div className="home-title">Togather</div>
            <div className="home-family">
              משפחת {session.familyName} · <span className={"home-role " + role}>{role === "dad" ? "👨 אבא" : "👩 אמא"}</span>
            </div>
          </div>

          {data && (
            <div className="today-card">
              <div className={"today-dot " + (scheduled || "none")} />
              <div className="today-text">
                היום ({DAYS_HE[new Date().getDay()]}):{" "}
                {scheduled ? <span className={"cp " + scheduled}>{scheduled === "dad" ? "👨 אבא" : "👩 אמא"}</span> : <span style={{ color: "var(--text3)" }}>לא מוגדר</span>}
                {data.currentWith && <span> · בפועל: <span className={"cp " + data.currentWith}>{data.currentWith === "dad" ? "👨 אבא" : "👩 אמא"}</span></span>}
              </div>
            </div>
          )}

          {hasPendingSwap && canRespondToSwap && (
            <div className="swap-alert" onClick={function() { setView("swap"); }}>
              <div className="swap-alert-top"><div className="swap-alert-dot" /><div className="swap-alert-title">🔄 בקשת החלפה ממתינה לאישורך!</div></div>
              <div className="swap-alert-sub">{swap.offerDay.label} ↔ {swap.wantDay.label}</div>
            </div>
          )}
          {hasPendingSwap && isSwapRequester && (
            <div className="swap-alert dad-alert" onClick={function() { setView("swap"); }}>
              <div className="swap-alert-top"><div className="swap-alert-dot dad-dot" /><div className="swap-alert-title dad-title">⏳ הבקשה שלך ממתינה לאישור</div></div>
              <div className="swap-alert-sub dad-sub">{swap.offerDay.label} ↔ {swap.wantDay.label}</div>
            </div>
          )}

          <div className="nav-grid">
            <button className="nav-btn" onClick={function() { setView("live"); }}><span className="ni">📍</span>סימון מיקום</button>
            <button className="nav-btn" onClick={function() { setView("log"); }}><span className="ni">📋</span>יומן חי</button>
            <button className="nav-btn hl" onClick={function() { setView("calendar"); }}><span className="ni">📅</span>לוח שנה</button>
            <button className="nav-btn" onClick={function() { setEditSchedule(false); setView("schedule"); }}><span className="ni">⚙️</span>סדר קבוע</button>
            <button
              className={"nav-btn" + (canRespondToSwap ? " swap-pending" : "") + " "}
              style={{ gridColumn: "span 2", position: "relative" }}
              onClick={function() { setView("swap"); }}
            >
              {canRespondToSwap && <span className="nav-badge">!</span>}
              <span className="ni">🔄</span>
              {canRespondToSwap ? "בקשת החלפה — ממתינה לאישורך!" : hasPendingSwap && isSwapRequester ? "⏳ ממתינה לאישור" : "בקשת החלפת יום"}
            </button>
          </div>
          <button className="logout-btn" onClick={handleLogout}>יציאה מהחשבון</button>
        </div>
      )}

      {view === "live" && (
        <div className="view">
          <div className="vheader"><button className="back-btn" onClick={function() { setView("home"); }}>← חזרה</button><div className="vtitle">סימון מיקום</div></div>
          <div className="vbody">
            {error && <div className="error-msg">{error}</div>}
            <div className="live-hero">
              <div className="live-status-label">כרגע הילד/ים אצל:</div>
              <div className={"live-current " + (data && data.currentWith ? data.currentWith : "")}>
                {data && data.currentWith === "dad" ? "👨 אבא" : data && data.currentWith === "mom" ? "👩 אמא" : "—"}
              </div>
              <div className="mark-wrap">
                <button
                  className={"mark-btn" + (role === "mom" ? " mom-btn" : "") + (!role || saving ? " disabled" : "")}
                  onClick={handleMark}
                  disabled={!role || saving}
                >
                  <span className="me">{role === "dad" ? "👨" : role === "mom" ? "👩" : "❓"}</span>
                  {saving ? "שומר..." : role ? "הילד/ים אצלי!" : "בחר תפקיד"}
                </button>
              </div>
              <div className="hint">{!role ? "חזור ובחר תפקיד" : "לחץ/י כשהילד/ים מגיעים אלייך"}</div>
            </div>
            <div className="sync-badge">🔄 מתעדכן כל 15 שניות</div>
          </div>
        </div>
      )}

      {view === "log" && (
        <div className="view">
          <div className="vheader"><button className="back-btn" onClick={function() { setView("home"); }}>← חזרה</button><div className="vtitle">יומן משותף</div></div>
          <div className="vbody">
            {loading && <div className="loading-spinner">טוען...</div>}
            {error && <div className="error-msg">{error}</div>}
            {!loading && (!data || !data.liveLog || !data.liveLog.length) && <div className="empty"><span className="ei">📖</span>היומן ריק עדיין.</div>}
            {!loading && data && data.liveLog && data.liveLog.length > 0 && (
              <div>
                <div className="log-list">
                  {data.liveLog.map(function(entry) {
                    return (
                      <div key={entry.id} className="log-entry">
                        <div className={"log-dot " + entry.parent} />
                        <div>
                          <div className="log-text">
                            {entry.parent === "system"
                              ? <span style={{ color: "var(--green)" }}>{entry.note}</span>
                              : <span><span className={"lw " + entry.parent}>{entry.parent === "dad" ? "אבא" : "אמא"}</span> סימן/ה: הילד/ים אצלי</span>}
                          </div>
                          <div className="log-time">{formatDate(entry.timestamp)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button className="clear-btn" onClick={clearLog}>🗑️ מחק היסטוריה</button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === "calendar" && (
        <div className="view">
          <div className="vheader"><button className="back-btn" onClick={function() { setView("home"); }}>← חזרה</button><div className="vtitle">לוח שנה</div></div>
          <div className="vbody">
            {loading && <div className="loading-spinner">טוען...</div>}
            {!loading && sched && <Calendar schedule={sched} liveLog={(data && data.liveLog) || []} swapLog={(data && data.swapLog) || []} />}
          </div>
        </div>
      )}

      {view === "schedule" && (
        <div className="view">
          <div className="vheader"><button className="back-btn" onClick={function() { setView("home"); }}>← חזרה</button><div className="vtitle">סדר קבוע מראש</div></div>
          <div className="vbody">
            {error && <div className="error-msg">{error}</div>}
            {!editSchedule ? (
              <div>
                <div className="legend">
                  <div className="li"><div className="ld" style={{ background: "var(--dad)" }} /> אבא</div>
                  <div className="li"><div className="ld" style={{ background: "var(--mom)" }} /> אמא</div>
                  <div className="li"><div className="ld" style={{ background: "var(--amber)" }} /> מתחלף שבועי</div>
                </div>
                <div className="week-view">
                  {DAYS_HE.map(function(day, i) {
                    var label = getDayLabel(i);
                    var wk = getWeekNumber();
                    var who = label, note = "";
                    if (label === "rotating") {
                      var dadWk = sched.rotating.currentWeekDad ? wk % 2 === 0 : wk % 2 !== 0;
                      who = dadWk ? "dad" : "mom"; note = "שבועי מתחלף";
                    }
                    return (
                      <div className="week-day" key={i}>
                        <div className="wdn">{day}</div>
                        <div className={"wdb " + (label === "rotating" ? "rot" : who || "none")}>
                          {who === "dad" ? "👨 אבא" : who === "mom" ? "👩 אמא" : "לא מוגדר"}
                        </div>
                        {note && <div className="wdn2">{note}</div>}
                      </div>
                    );
                  })}
                </div>
                <button className="edit-btn" onClick={startEdit}>✏️ עריכת הסדר</button>
                <div className="settings-section">
                  <div className="sched-title">⚙️ הגדרות</div>
                  <div className="toggle-row">
                    <div>
                      <div style={{ fontSize: 13, color: "var(--text)" }}>👶 איסוף ילד דורש אישור</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>סימון ישלח התראה לאישור הצד השני</div>
                    </div>
                    <div
                      className={"toggle" + (data && data.settings && data.settings.requirePickupApproval ? " on" : "")}
                      onClick={function() { updateSettings("requirePickupApproval", !(data && data.settings && data.settings.requirePickupApproval)); }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="sched-section">
                  <div className="sched-title">ימים קבועים לאבא 👨</div>
                  <div className="instr">לחץ על יום להוספה/הסרה</div>
                  <div className="days-grid">
                    {DAYS_HE.map(function(d, i) {
                      var l = getTmpLabel(i);
                      return <div key={i} className={"dp" + (l === "dad" ? " dad" : "") + (l === "mom" || l === "rot" ? " disabled" : "")} onClick={function() { toggleFixed(i, "dad"); }}>{d.slice(0, 2)}</div>;
                    })}
                  </div>
                  <div className="sched-title" style={{ marginTop: 14 }}>ימים קבועים לאמא 👩</div>
                  <div className="days-grid">
                    {DAYS_HE.map(function(d, i) {
                      var l = getTmpLabel(i);
                      return <div key={i} className={"dp" + (l === "mom" ? " mom" : "") + (l === "dad" || l === "rot" ? " disabled" : "")} onClick={function() { toggleFixed(i, "mom"); }}>{d.slice(0, 2)}</div>;
                    })}
                  </div>
                  <div className="sched-title" style={{ marginTop: 14 }}>ימים מתחלפים 🔄</div>
                  <div className="days-grid">
                    {DAYS_HE.map(function(d, i) {
                      var l = getTmpLabel(i);
                      return <div key={i} className={"dp" + (l === "rot" ? " rot" : "") + (l === "dad" || l === "mom" ? " disabled" : "")} onClick={function() { toggleRot(i); }}>{d.slice(0, 2)}</div>;
                    })}
                  </div>
                  <div className="toggle-row">
                    <span>השבוע הנוכחי — ימים המתחלפים אצל אבא?</span>
                    <div className={"toggle" + (tmpRotDad ? " on" : "")} onClick={function() { setTmpRotDad(function(v) { return !v; }); }} />
                  </div>
                </div>
                <button className="save-btn" onClick={saveSchedule} disabled={saving}>{saving ? "שומר..." : "💾 שמור סדר"}</button>
                <button className="cancel-btn" onClick={function() { setEditSchedule(false); }}>ביטול</button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === "swap" && (
        <div className="view">
          <div className="vheader"><button className="back-btn" onClick={function() { setView("home"); }}>← חזרה</button><div className="vtitle">בקשת החלפת יום</div></div>
          <div className="vbody">
            {error && <div className="error-msg">{error}</div>}
            <div className="swap-view">
              {hasPendingSwap && canRespondToSwap && (
                <div className="swap-pending-card">
                  <div className="swap-pending-title">🔔 בקשת החלפה מ{swap.requestedBy === "dad" ? "אבא" : "אמא"}</div>
                  <div className="swap-days-display">
                    <div className="swap-day-box"><div className="sdb-who">{swap.requestedBy === "dad" ? "אבא נותן" : "אמא נותנת"}</div><div className="sdb-day">{swap.offerDay.label}</div></div>
                    <div className="swap-arrow">⇄</div>
                    <div className="swap-day-box"><div className="sdb-who">{swap.requestedBy === "dad" ? "אבא רוצה" : "אמא רוצה"}</div><div className="sdb-day">{swap.wantDay.label}</div></div>
                  </div>
                  <div className="swap-action-btns">
                    <button className="swap-approve-btn" onClick={function() { respondSwap("approve"); }} disabled={saving}>✅ אישור</button>
                    <button className="swap-reject-btn" onClick={function() { respondSwap("reject"); }} disabled={saving}>❌ דחייה</button>
                  </div>
                </div>
              )}
              {hasPendingSwap && isSwapRequester && (
                <div className="swap-sent-card">
                  <div className="swap-sent-title">⏳ הבקשה שלך ממתינה <span className="waiting-dots"><span /><span /><span /></span></div>
                  <div className="swap-days-display">
                    <div className="swap-day-box" style={{ borderColor: "var(--dad-border)" }}><div className="sdb-who" style={{ color: "var(--dad-text)" }}>אתה נותן</div><div className="sdb-day" style={{ color: "var(--dad)" }}>{swap.offerDay.label}</div></div>
                    <div className="swap-arrow" style={{ color: "var(--dad)" }}>⇄</div>
                    <div className="swap-day-box" style={{ borderColor: "var(--dad-border)" }}><div className="sdb-who" style={{ color: "var(--dad-text)" }}>אתה רוצה</div><div className="sdb-day" style={{ color: "var(--dad)" }}>{swap.wantDay.label}</div></div>
                  </div>
                  <button className="swap-cancel-btn" onClick={cancelSwap} disabled={saving}>ביטול הבקשה</button>
                  <button className="whatsapp-btn" style={{ marginTop: 7 }} onClick={function() { sendWhatsApp(swap.offerDay, swap.wantDay); }}>📲 שלח שוב ב-WhatsApp</button>
                </div>
              )}
              {!hasPendingSwap && (
                <div>
                  <div className="new-swap-title">📅 בקש החלפת יום</div>
                  <div className="new-swap-sub">
                    {swapStep === 1 ? "שלב 1: בחר יום שברצונך לתת" : "שלב 2: בחר את היום שאתה רוצה במקום"}
                  </div>
                  {swapStep === 1 && (
                    <div>
                      <div className="day-select-label">הימים שלך — 14 הימים הבאים</div>
                      <div className="day-list">
                        {myDays.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13 }}>אין ימים שלך ב-14 הימים הבאים</div>}
                        {myDays.map(function(d) {
                          var sel = offerDay && offerDay.date === d.date;
                          return (
                            <div key={d.date} className={"day-item" + (sel ? (role === "mom" ? " selected-mom" : " selected-dad") : "")} onClick={function() { setOfferDay({ date: d.date, dow: d.dow, label: d.label }); }}>
                              <div className={"di-dot " + role} />
                              <div className="di-label">{d.label}</div>
                              <div className={"di-owner " + role}>{role === "dad" ? "אבא" : "אמא"}</div>
                            </div>
                          );
                        })}
                      </div>
                      <button className="send-swap-btn" disabled={!offerDay} onClick={function() { if (offerDay) setSwapStep(2); }}>הבא →</button>
                    </div>
                  )}
                  {swapStep === 2 && (
                    <div>
                      <div style={{ fontSize: 13, color: "var(--green)", marginBottom: 9 }}>אתה מציע: <strong>{offerDay && offerDay.label}</strong></div>
                      <div className="day-select-label">ימי הצד השני</div>
                      <div className="day-list">
                        {otherDays.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13 }}>אין ימים של הצד השני</div>}
                        {otherDays.map(function(d) {
                          var other = role === "dad" ? "mom" : "dad";
                          var sel = wantDay && wantDay.date === d.date;
                          return (
                            <div key={d.date} className={"day-item" + (sel ? (other === "mom" ? " selected-mom" : " selected-dad") : "")} onClick={function() { setWantDay({ date: d.date, dow: d.dow, label: d.label }); }}>
                              <div className={"di-dot " + other} />
                              <div className="di-label">{d.label}</div>
                              <div className={"di-owner " + other}>{other === "dad" ? "👨 אבא" : "👩 אמא"}</div>
                            </div>
                          );
                        })}
                      </div>
                      <button className="send-swap-btn" disabled={!wantDay || saving} onClick={sendSwap}>{saving ? "שולח..." : "💾 שמור בקשה"}</button>
                      <button className="whatsapp-btn" disabled={!wantDay || saving} onClick={async function() {
                        if (!wantDay || !offerDay) return;
                        await sendSwap();
                        sendWhatsApp(offerDay, wantDay);
                      }}>📲 שלח בקשה ב-WhatsApp</button>
                      <button className="cancel-btn" onClick={function() { setSwapStep(1); setWantDay(null); }}>← חזור</button>
                    </div>
                  )}
                </div>
              )}
              {data && data.swapLog && data.swapLog.length > 0 && (
                <div className="swap-log-section">
                  <div className="swap-log-title">היסטוריית החלפות</div>
                  <div className="swap-log-list">
                    {data.swapLog.map(function(s) {
                      return (
                        <div key={s.id} className="swap-log-item">
                          <div className={"sli-status " + s.status}>{s.status === "approved" ? "✅ אושרה" : s.status === "rejected" ? "❌ נדחתה" : "🚫 בוטלה"}</div>
                          <div className="sli-text">{s.offerDay.label} ↔ {s.wantDay.label}<br />{s.requestedBy === "dad" ? "אבא" : "אמא"} ביקש · {formatDateShort(s.requestedAt)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
