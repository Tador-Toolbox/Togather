import { useState, useEffect, useCallback } from "react";

const API = process.env.REACT_APP_API_URL || "";
// ← שנה את הכתובת הזו לכתובת שלך ב-Render אחרי העלאה
const APP_URL = process.env.REACT_APP_PUBLIC_URL || window.location.origin;

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const ROLE_KEY = "cp_role";

const formatDate = (iso) =>
  new Date(iso).toLocaleString("he-IL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const formatDateShort = (iso) =>
  new Date(iso).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" });
const toDateStr = (d) => d.toISOString().slice(0, 10);

const getWeekNumber = (d = new Date()) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
};

function getScheduledOwner(date, schedule) {
  if (!schedule) return null;
  const dow = date.getDay();
  if (schedule.fixed.dad.includes(dow)) return "dad";
  if (schedule.fixed.mom.includes(dow)) return "mom";
  if (schedule.rotating.days.includes(dow)) {
    const wk = getWeekNumber(date);
    const dadWk = schedule.rotating.currentWeekDad ? wk % 2 === 0 : wk % 2 !== 0;
    return dadWk ? "dad" : "mom";
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
      const dadWk = schedule.rotating.currentWeekDad ? effectiveWk % 2 === 0 : effectiveWk % 2 !== 0;
      owner = dadWk ? "dad" : "mom";
    }
    days.push({ date: dateStr, dow, label: DAYS_HE[dow] + " " + dateStr.slice(5).replace("-", "/"), owner, d });
  }
  return days;
}

// ── CSS — Light Theme ─────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}

:root{
  --bg:#f5f3ef;
  --surface:#ffffff;
  --surface2:#eeecea;
  --border:#e0dcd6;
  --border2:#ccc8c0;
  --text:#1a1814;
  --text2:#6b6560;
  --text3:#a09890;
  --dad:#2563a8;
  --dad-bg:#deeaf8;
  --dad-border:#b8d0ef;
  --dad-text:#1a4a80;
  --mom:#8b2d8b;
  --mom-bg:#f2e0f2;
  --mom-border:#dbb0db;
  --mom-text:#6a1a6a;
  --green:#3a7a20;
  --green-bg:#e4f2d8;
  --green-border:#b8dca0;
  --amber:#c07010;
  --amber-bg:#faf0d8;
  --amber-border:#e0c070;
  --red:#b02020;
  --red-bg:#fae8e8;
  --red-border:#e0b0b0;
}

html,body{height:100%;background:var(--bg);font-family:'DM Sans',sans-serif;color:var(--text);direction:rtl}
#root{height:100%}
.app{max-width:430px;margin:0 auto;min-height:100vh;background:var(--bg);position:relative}

/* ── HOME ── */
.home{min-height:100vh;display:flex;flex-direction:column;padding:44px 24px 32px}
.home-header{text-align:center;margin-bottom:32px}
.home-icon{font-size:50px;display:block;margin-bottom:10px}
.home-title{font-family:'Fraunces',serif;font-size:28px;font-weight:300;line-height:1.25;letter-spacing:-.5px;color:var(--text)}
.home-sub{font-size:11px;color:var(--text3);margin-top:6px;letter-spacing:1px;text-transform:uppercase}

.section-label{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--text3);margin-bottom:9px}
.role-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}
.role-btn{padding:18px 12px;border-radius:14px;border:1.5px solid var(--border);cursor:pointer;text-align:center;transition:all .2s;font-family:'Fraunces',serif;font-size:16px;font-weight:300;background:var(--surface);color:var(--text2)}
.role-btn .re{font-size:26px;display:block;margin-bottom:5px}
.role-btn .rn{font-size:12px;font-family:'DM Sans',sans-serif;opacity:.8}
.role-btn.dad.active{background:var(--dad-bg);border-color:var(--dad);color:var(--dad-text)}
.role-btn.mom.active{background:var(--mom-bg);border-color:var(--mom);color:var(--mom-text)}

.today-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px}
.today-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.today-dot.dad{background:var(--dad);box-shadow:0 0 0 3px var(--dad-bg)}
.today-dot.mom{background:var(--mom);box-shadow:0 0 0 3px var(--mom-bg)}
.today-dot.none{background:var(--border2)}
.today-text{font-size:13px;color:var(--text2);line-height:1.55}
.cp.dad{color:var(--dad);font-weight:500}
.cp.mom{color:var(--mom);font-weight:500}

.swap-alert{background:var(--green-bg);border:1px solid var(--green-border);border-radius:12px;padding:12px 15px;margin-bottom:16px;cursor:pointer;transition:all .2s}
.swap-alert:hover{filter:brightness(.97)}
.swap-alert-top{display:flex;align-items:center;gap:8px;margin-bottom:3px}
.swap-alert-dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:blink 1.5s infinite;flex-shrink:0}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
.swap-alert-title{font-size:13px;font-weight:500;color:var(--green)}
.swap-alert-sub{font-size:12px;color:#5a8a40}

.nav-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:auto}
.nav-btn{padding:16px 12px;border-radius:12px;background:var(--surface);border:1px solid var(--border);color:var(--text2);cursor:pointer;text-align:center;transition:all .15s;font-size:12px;font-family:'DM Sans',sans-serif;position:relative}
.nav-btn:hover{background:var(--surface2);border-color:var(--border2);transform:translateY(-1px)}
.nav-btn .ni{font-size:22px;display:block;margin-bottom:5px}
.nav-btn.hl{background:var(--dad-bg);border-color:var(--dad-border);color:var(--dad-text)}
.nav-badge{position:absolute;top:9px;left:9px;background:var(--red);color:#fff;border-radius:10px;font-size:10px;padding:1px 6px;font-weight:600}

/* ── VIEW SHELL ── */
.view{min-height:100vh;display:flex;flex-direction:column;background:var(--bg)}
.vheader{padding:15px 20px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;position:sticky;top:0;background:var(--surface);z-index:10;box-shadow:0 1px 0 var(--border)}
.back-btn{background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;transition:all .15s}
.back-btn:hover{background:var(--border);color:var(--text)}
.vtitle{font-family:'Fraunces',serif;font-size:18px;font-weight:300;color:var(--text)}
.vbody{padding:20px;flex:1}

/* ── LIVE ── */
.live-hero{text-align:center;padding:24px 0 28px}
.live-status-label{font-size:11px;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px}
.live-current{font-family:'Fraunces',serif;font-size:24px;font-weight:300;min-height:32px;margin-bottom:4px}
.live-current.dad{color:var(--dad)}
.live-current.mom{color:var(--mom)}
.mark-wrap{display:flex;justify-content:center;margin:20px 0 8px}
.mark-btn{width:160px;height:160px;border-radius:50%;border:2px solid var(--dad-border);cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;background:var(--dad-bg);color:var(--dad-text);box-shadow:0 0 0 6px var(--dad-bg),0 0 0 8px var(--dad-border);transition:transform .15s}
.mark-btn.mom-btn{background:var(--mom-bg);color:var(--mom-text);border-color:var(--mom-border);box-shadow:0 0 0 6px var(--mom-bg),0 0 0 8px var(--mom-border)}
.mark-btn.disabled{background:var(--surface2);color:var(--text3);border-color:var(--border);box-shadow:none;cursor:default}
.mark-btn .me{font-size:34px}
.mark-btn:not(.disabled):active{transform:scale(.94)}
.hint{text-align:center;font-size:12px;color:var(--text3);line-height:1.7}
.sync-badge{font-size:11px;color:var(--text3);text-align:center;padding:6px 0 0;letter-spacing:.5px}

.loading-spinner{text-align:center;padding:60px 0;color:var(--text3);font-size:13px}
.error-msg{background:var(--red-bg);border:1px solid var(--red-border);border-radius:10px;padding:12px 15px;font-size:13px;color:var(--red);margin-bottom:14px}

/* ── LOG ── */
.log-list{display:flex;flex-direction:column;gap:7px}
.log-entry{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;gap:10px;align-items:flex-start}
.log-dot{width:8px;height:8px;border-radius:50%;margin-top:4px;flex-shrink:0}
.log-dot.dad{background:var(--dad)}
.log-dot.mom{background:var(--mom)}
.log-dot.system{background:var(--green)}
.log-text{font-size:13px;color:var(--text2);line-height:1.5}
.log-time{font-size:11px;color:var(--text3);margin-top:2px}
.lw.dad{color:var(--dad);font-weight:500}
.lw.mom{color:var(--mom);font-weight:500}
.empty{text-align:center;padding:60px 20px;color:var(--text3);font-size:13px}
.empty .ei{font-size:40px;display:block;margin-bottom:12px}
.clear-btn{background:var(--red-bg);border:1px solid var(--red-border);color:var(--red);border-radius:9px;padding:10px 14px;cursor:pointer;font-size:12px;font-family:'DM Sans',sans-serif;margin-top:14px;width:100%}

/* ── SCHEDULE ── */
.sched-section{margin-bottom:20px}
.sched-title{font-family:'Fraunces',serif;font-size:15px;font-weight:300;color:var(--text);margin-bottom:10px}
.week-view{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:8px}
.week-day{display:flex;align-items:center;gap:9px;padding:10px 14px;border-bottom:1px solid var(--border)}
.week-day:last-child{border-bottom:none}
.wdn{font-size:13px;color:var(--text2);min-width:56px}
.wdb{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500}
.wdb.dad{background:var(--dad-bg);color:var(--dad-text);border:1px solid var(--dad-border)}
.wdb.mom{background:var(--mom-bg);color:var(--mom-text);border:1px solid var(--mom-border)}
.wdb.rot{background:var(--amber-bg);color:var(--amber);border:1px solid var(--amber-border)}
.wdb.none{background:var(--surface2);color:var(--text3);border:1px solid var(--border)}
.wdn2{font-size:10px;color:var(--text3);margin-right:auto}
.legend{display:flex;gap:13px;flex-wrap:wrap;margin-bottom:16px}
.li{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text2)}
.ld{width:8px;height:8px;border-radius:50%}
.edit-btn{background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:10px;padding:11px 16px;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;width:100%;margin-top:10px;transition:all .2s}
.edit-btn:hover{background:var(--border)}
.save-btn{background:var(--dad);border:none;color:#fff;border-radius:10px;padding:12px 16px;cursor:pointer;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;width:100%;margin-top:8px}
.save-btn:hover{background:var(--dad-text)}
.cancel-btn{background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:10px;padding:10px 16px;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;width:100%;margin-top:8px}
.days-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px}
.dp{padding:8px 0;border-radius:7px;text-align:center;font-size:11px;border:1px solid var(--border);background:var(--surface2);color:var(--text3);cursor:pointer;transition:all .15s;user-select:none}
.dp:hover{border-color:var(--border2);color:var(--text2)}
.dp.dad{background:var(--dad-bg);border-color:var(--dad-border);color:var(--dad-text)}
.dp.mom{background:var(--mom-bg);border-color:var(--mom-border);color:var(--mom-text)}
.dp.rot{background:var(--amber-bg);border-color:var(--amber-border);color:var(--amber)}
.dp.disabled{opacity:.35;cursor:not-allowed}
.instr{font-size:12px;color:var(--text3);margin-bottom:9px;line-height:1.6}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:12px 15px;background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-top:11px;font-size:13px;color:var(--text2)}
.toggle{width:44px;height:24px;background:var(--border2);border-radius:12px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
.toggle.on{background:var(--dad)}
.toggle::after{content:'';position:absolute;top:3px;right:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:transform .2s}
.toggle.on::after{transform:translateX(-20px)}

/* ── CALENDAR ── */
.cal-container{}
.cal-nav-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.cal-month-title{font-family:'Fraunces',serif;font-size:20px;font-weight:300;color:var(--text)}
.cal-year-sub{font-size:12px;color:var(--text3);margin-top:2px}
.cal-arrow{background:var(--surface);border:1px solid var(--border);color:var(--text2);border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center}
.cal-arrow:hover{background:var(--surface2)}
.cal-legend{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.cal-leg{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text2)}
.cal-leg-dot{width:7px;height:7px;border-radius:50%}
.dow-row{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px}
.dow-cell{text-align:center;font-size:10px;color:var(--text3);padding:3px 0;font-weight:500}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
.dc{min-height:44px;border-radius:8px;padding:5px 3px 4px;cursor:pointer;position:relative;display:flex;flex-direction:column;align-items:center;border:1px solid transparent;transition:all .12s;user-select:none;background:transparent}
.dc:hover:not(.dc-empty){background:var(--surface2)}
.dc-empty{cursor:default}
.dc-dad{background:var(--dad-bg);border-color:var(--dad-border)}
.dc-mom{background:var(--mom-bg);border-color:var(--mom-border)}
.dc-today{outline:2px solid var(--dad);outline-offset:-2px}
.dc-selected{outline:2px solid var(--text);outline-offset:-2px}
.dc-past{opacity:.45}
.dc-num{font-size:12px;font-weight:500;line-height:1;color:var(--text)}
.dc-dad .dc-num{color:var(--dad-text)}
.dc-mom .dc-num{color:var(--mom-text)}
.dc-empty .dc-num{color:var(--border2)}
.dc-indicators{display:flex;gap:2px;margin-top:3px;justify-content:center;flex-wrap:wrap}
.dind{width:5px;height:5px;border-radius:50%}
.dind-actual-dad{background:var(--dad)}
.dind-actual-mom{background:var(--mom)}
.dind-swap{background:var(--green)}

.cal-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:14px}
.cal-stat{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center}
.cal-stat-num{font-family:'Fraunces',serif;font-size:20px;font-weight:300}
.cal-stat-num.dad{color:var(--dad)}
.cal-stat-num.mom{color:var(--mom)}
.cal-stat-num.swap{color:var(--green)}
.cal-stat-label{font-size:10px;color:var(--text3);margin-top:2px}

.day-detail{background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-top:12px;overflow:hidden}
.day-detail-header{padding:12px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.day-detail-title{font-family:'Fraunces',serif;font-size:15px;font-weight:300;color:var(--text)}
.day-detail-close{background:none;border:none;color:var(--text3);font-size:16px;cursor:pointer;padding:0 4px}
.day-detail-body{padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.detail-row{display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:5px 0;border-bottom:1px solid var(--border)}
.detail-row:last-of-type{border-bottom:none}
.detail-label{color:var(--text2)}
.detail-val{font-weight:500;color:var(--text)}
.detail-val.dad{color:var(--dad)}
.detail-val.mom{color:var(--mom)}
.detail-val.swap{color:var(--green)}
.detail-val.none{color:var(--text3)}
.detail-note-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;padding:8px 10px;font-family:'DM Sans',sans-serif;resize:none;margin-top:4px}
.detail-note-input:focus{outline:none;border-color:var(--dad)}
.detail-save-note{background:var(--dad);border:none;color:#fff;border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:6px}
.detail-saved{font-size:11px;color:var(--green);margin-top:4px}

/* ── SWAP ── */
.swap-view{display:flex;flex-direction:column;gap:14px}
.swap-pending-card{background:var(--green-bg);border:1px solid var(--green-border);border-radius:14px;padding:18px}
.swap-pending-title{font-family:'Fraunces',serif;font-size:15px;font-weight:300;color:var(--green);margin-bottom:14px;display:flex;align-items:center;gap:8px}
.swap-days-display{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin-bottom:16px}
.swap-day-box{background:var(--surface);border:1px solid var(--green-border);border-radius:10px;padding:12px;text-align:center}
.swap-day-box .sdb-who{font-size:11px;color:#5a8a40;margin-bottom:4px}
.swap-day-box .sdb-day{font-size:13px;font-weight:500;color:var(--green);line-height:1.4}
.swap-arrow{font-size:20px;color:#5a8a40;text-align:center}
.swap-action-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.swap-approve-btn{background:var(--green);border:none;color:#fff;border-radius:10px;padding:12px;cursor:pointer;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;transition:filter .2s}
.swap-approve-btn:hover{filter:brightness(1.1)}
.swap-reject-btn{background:var(--red-bg);border:1px solid var(--red-border);color:var(--red);border-radius:10px;padding:12px;cursor:pointer;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif}
.swap-cancel-btn{background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:10px;padding:10px;cursor:pointer;font-size:12px;font-family:'DM Sans',sans-serif;width:100%;margin-top:8px}
.swap-sent-card{background:var(--dad-bg);border:1px solid var(--dad-border);border-radius:14px;padding:18px}
.swap-sent-title{font-size:13px;color:var(--dad);margin-bottom:12px;display:flex;align-items:center;gap:8px}
.waiting-dots{display:inline-flex;gap:3px}
.waiting-dots span{width:4px;height:4px;border-radius:50%;background:var(--dad);animation:wd .9s infinite}
.waiting-dots span:nth-child(2){animation-delay:.2s}
.waiting-dots span:nth-child(3){animation-delay:.4s}
@keyframes wd{0%,100%{opacity:.2}50%{opacity:1}}
.new-swap-title{font-family:'Fraunces',serif;font-size:16px;font-weight:300;color:var(--text);margin-bottom:6px}
.new-swap-sub{font-size:12px;color:var(--text3);margin-bottom:16px;line-height:1.6}
.day-select-label{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin-bottom:8px;margin-top:14px}
.day-list{display:flex;flex-direction:column;gap:5px;max-height:220px;overflow-y:auto}
.day-item{display:flex;align-items:center;gap:10px;padding:10px 13px;border-radius:9px;background:var(--surface);border:1px solid var(--border);cursor:pointer;transition:all .15s}
.day-item:hover{background:var(--surface2)}
.day-item.selected{border-color:var(--dad);background:var(--dad-bg)}
.day-item.selected.mom-sel{border-color:var(--mom);background:var(--mom-bg)}
.day-item .di-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.day-item .di-dot.dad{background:var(--dad)}
.day-item .di-dot.mom{background:var(--mom)}
.day-item .di-label{font-size:13px;color:var(--text)}
.day-item .di-owner{font-size:11px;margin-right:auto}
.day-item .di-owner.dad{color:var(--dad)}
.day-item .di-owner.mom{color:var(--mom)}
.send-swap-btn{background:var(--dad);border:none;color:#fff;border-radius:10px;padding:13px;cursor:pointer;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;width:100%;margin-top:14px}
.send-swap-btn:disabled{background:var(--border2);color:var(--surface);cursor:default}
.whatsapp-btn{background:#25d366;border:none;color:#fff;border-radius:10px;padding:13px;cursor:pointer;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;width:100%;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:8px;transition:filter .15s}
.whatsapp-btn:hover{filter:brightness(1.08)}
.whatsapp-btn:disabled{background:var(--border2);color:var(--surface);cursor:default}
.whatsapp-icon{font-size:18px}
.swap-log-section{margin-top:24px}
.swap-log-title{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin-bottom:10px}
.swap-log-list{display:flex;flex-direction:column;gap:7px}
.swap-log-item{background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:11px 13px}
.sli-status{font-size:11px;font-weight:500;margin-bottom:4px}
.sli-status.approved{color:var(--green)}
.sli-status.rejected{color:var(--red)}
.sli-status.cancelled{color:var(--text3)}
.sli-text{font-size:12px;color:var(--text2);line-height:1.5}

.toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%);padding:10px 22px;border-radius:24px;font-size:13px;z-index:9999;animation:fadeup .3s ease;white-space:nowrap}
.toast.dad{background:var(--dad-bg);border:1px solid var(--dad-border);color:var(--dad-text)}
.toast.mom{background:var(--mom-bg);border:1px solid var(--mom-border);color:var(--mom-text)}
.toast.ok{background:var(--green-bg);border:1px solid var(--green-border);color:var(--green)}
.toast.err{background:var(--red-bg);border:1px solid var(--red-border);color:var(--red)}
@keyframes fadeup{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
`;

// ── Calendar Component ─────────────────────────────────────────────────────────
function Calendar({ schedule, liveLog, swapLog }) {
  const today = new Date();
  const [curYear, setCurYear] = useState(today.getFullYear());
  const [curMonth, setCurMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cp_notes") || "{}"); } catch { return {}; }
  });
  const [noteInput, setNoteInput] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  const changeMonth = (dir) => {
    let m = curMonth + dir, y = curYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCurMonth(m); setCurYear(y); setSelectedDay(null);
  };

  const logByDate = {};
  (liveLog || []).forEach(e => {
    if (e.parent === "system") return;
    const d = e.timestamp.slice(0, 10);
    if (!logByDate[d]) logByDate[d] = e;
  });

  const swapByDate = {};
  (swapLog || []).filter(s => s.status === "approved").forEach(s => {
    if (s.offerDay?.date) swapByDate[s.offerDay.date] = s;
    if (s.wantDay?.date) swapByDate[s.wantDay.date] = s;
  });

  const firstDow = new Date(curYear, curMonth, 1).getDay();
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const todayStr = toDateStr(today);

  let dadCount = 0, momCount = 0, swapCount = 0;
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(curYear, curMonth, d);
    const dateStr = toDateStr(dt);
    const owner = getScheduledOwner(dt, schedule);
    const actual = logByDate[dateStr];
    const swapped = swapByDate[dateStr];
    if (owner === "dad") dadCount++;
    if (owner === "mom") momCount++;
    if (swapped) swapCount++;
    cells.push({ d, dateStr, owner, actual, swapped, dt });
  }

  const handleDayClick = (cell) => {
    if (selectedDay?.dateStr === cell.dateStr) { setSelectedDay(null); return; }
    setSelectedDay(cell);
    setNoteInput(notes[cell.dateStr] || "");
    setNoteSaved(false);
  };

  const saveNote = () => {
    const updated = { ...notes, [selectedDay.dateStr]: noteInput };
    setNotes(updated);
    localStorage.setItem("cp_notes", JSON.stringify(updated));
    setNoteSaved(true);
  };

  return (
    <div className="cal-container">
      <div className="cal-nav-row">
        <div>
          <div className="cal-month-title">{MONTHS_HE[curMonth]}</div>
          <div className="cal-year-sub">{curYear}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="cal-arrow" onClick={() => changeMonth(-1)}>›</button>
          <button className="cal-arrow" onClick={() => changeMonth(1)}>‹</button>
        </div>
      </div>

      <div className="cal-legend">
        <div className="cal-leg"><div className="cal-leg-dot" style={{ background: "var(--dad)" }} /> אבא</div>
        <div className="cal-leg"><div className="cal-leg-dot" style={{ background: "var(--mom)" }} /> אמא</div>
        <div className="cal-leg"><div className="cal-leg-dot" style={{ background: "var(--dad)", width: 14, height: 4, borderRadius: 2 }} /> סימון בפועל</div>
        <div className="cal-leg"><div className="cal-leg-dot" style={{ background: "var(--green)" }} /> החלפה</div>
      </div>

      <div className="dow-row">
        {["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"].map(d => (
          <div key={d} className="dow-cell">{d}</div>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((cell, i) => {
          if (!cell) return <div key={"e"+i} className="dc dc-empty" />;
          const { d, dateStr, owner, actual, swapped, dt } = cell;
          const isPast = dt < today && dateStr !== todayStr;
          const isToday = dateStr === todayStr;
          const isSelected = selectedDay?.dateStr === dateStr;
          const cls = ["dc",
            owner === "dad" ? "dc-dad" : owner === "mom" ? "dc-mom" : "",
            isPast ? "dc-past" : "",
            isToday ? "dc-today" : "",
            isSelected ? "dc-selected" : "",
          ].filter(Boolean).join(" ");
          return (
            <div key={dateStr} className={cls} onClick={() => handleDayClick(cell)}>
              <div className="dc-num">{d}</div>
              <div className="dc-indicators">
                {actual && <div className={`dind dind-actual-${actual.parent}`} />}
                {swapped && <div className="dind dind-swap" />}
              </div>
            </div>
          );
        })}
      </div>

      {selectedDay && (
        <div className="day-detail">
          <div className="day-detail-header">
            <div className="day-detail-title">
              {DAYS_HE[selectedDay.dt.getDay()]} {selectedDay.d} ב{MONTHS_HE[curMonth]}
            </div>
            <button className="day-detail-close" onClick={() => setSelectedDay(null)}>✕</button>
          </div>
          <div className="day-detail-body">
            <div className="detail-row">
              <span className="detail-label">לפי הסדר</span>
              <span className={`detail-val ${selectedDay.owner || "none"}`}>
                {selectedDay.owner === "dad" ? "👨 אבא" : selectedDay.owner === "mom" ? "👩 אמא" : "לא מוגדר"}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">סימון בפועל</span>
              <span className={`detail-val ${selectedDay.actual ? selectedDay.actual.parent : "none"}`}>
                {selectedDay.actual
                  ? `${selectedDay.actual.parent === "dad" ? "👨 אבא" : "👩 אמא"} · ${new Date(selectedDay.actual.timestamp).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`
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
              <div className="detail-label" style={{ fontSize: 12, marginBottom: 5 }}>הערה</div>
              <textarea
                className="detail-note-input"
                rows={2}
                placeholder="הוסף הערה ליום זה..."
                value={noteInput}
                onChange={e => { setNoteInput(e.target.value); setNoteSaved(false); }}
              />
              <button className="detail-save-note" onClick={saveNote}>שמור</button>
              {noteSaved && <div className="detail-saved">✓ הערה נשמרה</div>}
            </div>
          </div>
        </div>
      )}

      <div className="cal-stats">
        <div className="cal-stat"><div className="cal-stat-num dad">{dadCount}</div><div className="cal-stat-label">ימי אבא</div></div>
        <div className="cal-stat"><div className="cal-stat-num mom">{momCount}</div><div className="cal-stat-label">ימי אמא</div></div>
        <div className="cal-stat"><div className="cal-stat-num swap">{swapCount}</div><div className="cal-stat-label">החלפות</div></div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("home");
  const [role, setRole] = useState(() => localStorage.getItem(ROLE_KEY) || null);
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

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const d = await apiFetch("/api/data");
      setData(d);
    } catch (e) { setError("שגיאה בטעינה: " + e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const id = setInterval(loadData, 15000); return () => clearInterval(id); }, [loadData]);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const saveRole = (r) => { setRole(r); localStorage.setItem(ROLE_KEY, r); };

  const todayScheduled = useCallback(() => {
    if (!data?.schedule) return null;
    return getScheduledOwner(new Date(), data.schedule);
  }, [data]);

  const handleMark = async () => {
    if (!role || saving) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/mark", { method: "POST", body: JSON.stringify({ parent: role }) });
      setData(prev => ({ ...prev, currentWith: res.currentWith, liveLog: [res.entry, ...prev.liveLog] }));
      showToast(`✓ ${role === "dad" ? "אבא" : "אמא"} סימן/ה בהצלחה`, role);
    } catch (e) { setError("שגיאה: " + e.message); }
    finally { setSaving(false); }
  };

  const startEdit = () => {
    const s = data?.schedule;
    setTmpFixed({ dad: [...(s?.fixed?.dad || [])], mom: [...(s?.fixed?.mom || [])] });
    setTmpRot([...(s?.rotating?.days || [])]);
    setTmpRotDad(s?.rotating?.currentWeekDad ?? true);
    setEditSchedule(true);
  };
  const toggleFixed = (day, parent) => {
    const other = parent === "dad" ? "mom" : "dad";
    setTmpFixed(prev => {
      if (prev[parent].includes(day)) return { ...prev, [parent]: prev[parent].filter(d => d !== day) };
      if (prev[other].includes(day) || tmpRot.includes(day)) return prev;
      return { ...prev, [parent]: [...prev[parent], day] };
    });
  };
  const toggleRot = (day) => {
    if (tmpFixed.dad.includes(day) || tmpFixed.mom.includes(day)) return;
    setTmpRot(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };
  const saveSchedule = async () => {
    const schedule = { fixed: tmpFixed, rotating: { days: tmpRot, currentWeekDad: tmpRotDad } };
    setSaving(true);
    try {
      const res = await apiFetch("/api/schedule", { method: "PUT", body: JSON.stringify({ schedule }) });
      setData(prev => ({ ...prev, schedule: res.schedule }));
      setEditSchedule(false);
      showToast("✓ הסדר נשמר", "ok");
    } catch (e) { setError("שגיאה: " + e.message); }
    finally { setSaving(false); }
  };
  const clearLog = async () => {
    if (!window.confirm("למחוק את כל ההיסטוריה?")) return;
    await apiFetch("/api/log", { method: "DELETE" });
    setData(prev => ({ ...prev, liveLog: [], currentWith: null }));
  };

  const sendSwap = async () => {
    if (!offerDay || !wantDay || !role || saving) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/swap", { method: "POST", body: JSON.stringify({ requestedBy: role, offerDay, wantDay }) });
      setData(prev => ({ ...prev, swapRequest: res.swapRequest }));
      setOfferDay(null); setWantDay(null); setSwapStep(1);
      showToast("✓ בקשת החלפה נשלחה!", "ok");
    } catch (e) { showToast("שגיאה: " + e.message, "err"); }
    finally { setSaving(false); }
  };
  const respondSwap = async (action) => {
    if (!role || saving) return;
    setSaving(true);
    try {
      await apiFetch("/api/swap/respond", { method: "PUT", body: JSON.stringify({ respondedBy: role, action }) });
      await loadData();
      showToast(action === "approve" ? "✓ אישרת את ההחלפה!" : "בקשה נדחתה", action === "approve" ? "ok" : "err");
    } catch (e) { showToast("שגיאה: " + e.message, "err"); }
    finally { setSaving(false); }
  };
  const cancelSwap = async () => {
    if (!role || saving) return;
    setSaving(true);
    try {
      await apiFetch("/api/swap", { method: "DELETE", body: JSON.stringify({ cancelledBy: role }) });
      await loadData();
      showToast("הבקשה בוטלה", "err");
    } catch (e) { showToast("שגיאה: " + e.message, "err"); }
    finally { setSaving(false); }
  };

  const sendWhatsApp = (offer, want) => {
    const selfName = role === "dad" ? "אבא" : "אמא";
    const msg =
      `שלום! ${selfName} מבקש/ת החלפת יום 🔄\n\n` +
      `📅 אני נותן/ת: *${offer.label}*\n` +
      `📅 אני רוצה: *${want.label}*\n\n` +
      `לאישור או דחייה — פתח/י את היומן המשותף:\n${APP_URL}`;
    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  const scheduled = todayScheduled();
  const sched = data?.schedule;
  const upcomingDays = sched ? buildUpcomingDays(sched) : [];
  const myDays = upcomingDays.filter(d => d.owner === role);
  const otherDays = upcomingDays.filter(d => d.owner && d.owner !== role);
  const swap = data?.swapRequest;
  const hasPendingSwap = swap?.status === "pending";
  const isSwapRequester = swap?.requestedBy === role;
  const canRespondToSwap = hasPendingSwap && !isSwapRequester;

  const getDayLabel = (dow) => {
    if (!sched) return null;
    if (sched.fixed.dad.includes(dow)) return "dad";
    if (sched.fixed.mom.includes(dow)) return "mom";
    if (sched.rotating.days.includes(dow)) return "rotating";
    return null;
  };
  const getTmpLabel = (dow) => {
    if (tmpFixed.dad.includes(dow)) return "dad";
    if (tmpFixed.mom.includes(dow)) return "mom";
    if (tmpRot.includes(dow)) return "rot";
    return null;
  };

  return (
    <>
      <style>{CSS}</style>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <div className="app">

        {/* ═══ HOME ═══ */}
        {view === "home" && (
          <div className="home">
            <div className="home-header">
              <span className="home-icon">👨‍👩‍👧</span>
              <div className="home-title">Togather</div>
              <div className="home-sub">יומן הורות משותפת</div>
            </div>
            <div className="section-label">אני הורה:</div>
            <div className="role-btns">
              {[{ k: "dad", e: "👨", n: "אבא" }, { k: "mom", e: "👩", n: "אמא" }].map(r => (
                <button key={r.k} className={`role-btn ${r.k} ${role === r.k ? "active" : ""}`} onClick={() => saveRole(r.k)}>
                  <span className="re">{r.e}</span><span className="rn">{r.n}</span>
                </button>
              ))}
            </div>
            {data && (
              <div className="today-card">
                <div className={`today-dot ${scheduled || "none"}`} />
                <div className="today-text">
                  היום ({DAYS_HE[new Date().getDay()]}):{" "}
                  {scheduled ? <span className={`cp ${scheduled}`}>{scheduled === "dad" ? "👨 אבא" : "👩 אמא"}</span>
                    : <span style={{ color: "var(--text3)" }}>לא מוגדר</span>}
                  {data.currentWith && <><br />בפועל: <span className={`cp ${data.currentWith}`}>{data.currentWith === "dad" ? "👨 אבא" : "👩 אמא"}</span></>}
                </div>
              </div>
            )}
            {hasPendingSwap && canRespondToSwap && (
              <div className="swap-alert" onClick={() => setView("swap")}>
                <div className="swap-alert-top"><div className="swap-alert-dot" /><div className="swap-alert-title">🔄 בקשת החלפה ממתינה לאישורך!</div></div>
                <div className="swap-alert-sub">{swap.offerDay.label} ↔ {swap.wantDay.label}</div>
              </div>
            )}
            {hasPendingSwap && isSwapRequester && (
              <div className="swap-alert" style={{ background: "var(--dad-bg)", borderColor: "var(--dad-border)" }} onClick={() => setView("swap")}>
                <div className="swap-alert-top"><div className="swap-alert-dot" style={{ background: "var(--dad)" }} /><div className="swap-alert-title" style={{ color: "var(--dad)" }}>⏳ הבקשה שלך ממתינה לאישור</div></div>
                <div className="swap-alert-sub" style={{ color: "var(--dad-text)" }}>{swap.offerDay.label} ↔ {swap.wantDay.label}</div>
              </div>
            )}
            <div className="nav-grid">
              <button className="nav-btn" onClick={() => setView("live")}><span className="ni">📍</span>סימון מיקום</button>
              <button className="nav-btn" onClick={() => setView("log")}><span className="ni">📋</span>יומן חי</button>
              <button className="nav-btn hl" onClick={() => setView("calendar")}><span className="ni">📅</span>לוח שנה</button>
              <button className="nav-btn" onClick={() => { setEditSchedule(false); setView("schedule"); }}><span className="ni">⚙️</span>סדר קבוע</button>
              <button
                className="nav-btn"
                style={{ gridColumn: "span 2", position: "relative", background: hasPendingSwap && canRespondToSwap ? "var(--green-bg)" : "var(--surface)", borderColor: hasPendingSwap && canRespondToSwap ? "var(--green-border)" : "var(--border)", color: hasPendingSwap && canRespondToSwap ? "var(--green)" : "var(--text2)" }}
                onClick={() => setView("swap")}
              >
                {hasPendingSwap && canRespondToSwap && <span className="nav-badge">!</span>}
                <span className="ni">🔄</span>
                {hasPendingSwap && canRespondToSwap ? "בקשת החלפה — ממתינה לאישורך!" : hasPendingSwap && isSwapRequester ? "⏳ בקשת החלפה — ממתינה לאישור" : "בקשת החלפת יום"}
              </button>
            </div>
          </div>
        )}

        {/* ═══ LIVE ═══ */}
        {view === "live" && (
          <div className="view">
            <div className="vheader"><button className="back-btn" onClick={() => setView("home")}>← חזרה</button><div className="vtitle">סימון מיקום</div></div>
            <div className="vbody">
              {error && <div className="error-msg">{error}</div>}
              <div className="live-hero">
                <div className="live-status-label">כרגע הילד/ים אצל:</div>
                <div className={`live-current ${data?.currentWith || ""}`}>
                  {data?.currentWith === "dad" ? "👨 אבא" : data?.currentWith === "mom" ? "👩 אמא" : "—"}
                </div>
                <div className="mark-wrap">
                  <button
                    className={`mark-btn ${role === "mom" ? "mom-btn" : ""} ${!role || saving ? "disabled" : ""}`}
                    onClick={handleMark} disabled={!role || saving}
                  >
                    <span className="me">{role === "dad" ? "👨" : role === "mom" ? "👩" : "❓"}</span>
                    {saving ? "שומר..." : role ? "הילד/ים אצלי!" : "בחר תפקיד"}
                  </button>
                </div>
                <div className="hint">{!role ? "חזור לדף הבית ובחר תפקיד" : "לחץ/י כשהילד/ים מגיעים אלייך"}</div>
              </div>
              <div className="sync-badge">🔄 מתעדכן כל 15 שניות · נתונים משותפים</div>
            </div>
          </div>
        )}

        {/* ═══ LOG ═══ */}
        {view === "log" && (
          <div className="view">
            <div className="vheader"><button className="back-btn" onClick={() => setView("home")}>← חזרה</button><div className="vtitle">יומן משותף</div></div>
            <div className="vbody">
              {loading && <div className="loading-spinner">טוען...</div>}
              {error && <div className="error-msg">{error}</div>}
              {!loading && !data?.liveLog?.length && <div className="empty"><span className="ei">📖</span>היומן ריק עדיין.</div>}
              {!loading && !!data?.liveLog?.length && (
                <>
                  <div className="log-list">
                    {data.liveLog.map(entry => (
                      <div key={entry.id} className="log-entry">
                        <div className={`log-dot ${entry.parent}`} />
                        <div>
                          <div className="log-text">
                            {entry.parent === "system" ? <span style={{ color: "var(--green)" }}>{entry.note}</span> : (
                              <><span className={`lw ${entry.parent}`}>{entry.parent === "dad" ? "אבא" : "אמא"}</span> סימן/ה: הילד/ים אצלי</>
                            )}
                          </div>
                          <div className="log-time">{formatDate(entry.timestamp)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="clear-btn" onClick={clearLog}>🗑️ מחק היסטוריה</button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══ CALENDAR ═══ */}
        {view === "calendar" && (
          <div className="view">
            <div className="vheader"><button className="back-btn" onClick={() => setView("home")}>← חזרה</button><div className="vtitle">לוח שנה</div></div>
            <div className="vbody">
              {loading && <div className="loading-spinner">טוען...</div>}
              {!loading && data?.schedule && (
                <Calendar schedule={data.schedule} liveLog={data.liveLog || []} swapLog={data.swapLog || []} />
              )}
            </div>
          </div>
        )}

        {/* ═══ SCHEDULE ═══ */}
        {view === "schedule" && (
          <div className="view">
            <div className="vheader"><button className="back-btn" onClick={() => setView("home")}>← חזרה</button><div className="vtitle">סדר קבוע מראש</div></div>
            <div className="vbody">
              {error && <div className="error-msg">{error}</div>}
              {!editSchedule ? (
                <>
                  <div className="legend">
                    <div className="li"><div className="ld" style={{ background: "var(--dad)" }} /> אבא</div>
                    <div className="li"><div className="ld" style={{ background: "var(--mom)" }} /> אמא</div>
                    <div className="li"><div className="ld" style={{ background: "var(--amber)" }} /> מתחלף שבועי</div>
                  </div>
                  <div className="week-view">
                    {DAYS_HE.map((day, i) => {
                      const label = getDayLabel(i);
                      const wk = getWeekNumber();
                      let who = label, note = "";
                      if (label === "rotating") {
                        const dadWk = sched.rotating.currentWeekDad ? wk % 2 === 0 : wk % 2 !== 0;
                        who = dadWk ? "dad" : "mom"; note = "שבועי מתחלף";
                      }
                      return (
                        <div className="week-day" key={i}>
                          <div className="wdn">{day}</div>
                          <div className={`wdb ${label === "rotating" ? "rot" : who || "none"}`}>
                            {who === "dad" ? "👨 אבא" : who === "mom" ? "👩 אמא" : "לא מוגדר"}
                          </div>
                          {note && <div className="wdn2">{note}</div>}
                        </div>
                      );
                    })}
                  </div>
                  <button className="edit-btn" onClick={startEdit}>✏️ עריכת הסדר</button>
                </>
              ) : (
                <>
                  <div className="sched-section">
                    <div className="sched-title">ימים קבועים לאבא 👨</div>
                    <div className="instr">לחץ על יום להוספה/הסרה</div>
                    <div className="days-grid">
                      {DAYS_HE.map((d, i) => { const l = getTmpLabel(i); return <div key={i} className={`dp ${l === "dad" ? "dad" : ""} ${l === "mom" || l === "rot" ? "disabled" : ""}`} onClick={() => toggleFixed(i, "dad")}>{d.slice(0, 2)}</div>; })}
                    </div>
                    <div className="sched-title" style={{ marginTop: 16 }}>ימים קבועים לאמא 👩</div>
                    <div className="days-grid">
                      {DAYS_HE.map((d, i) => { const l = getTmpLabel(i); return <div key={i} className={`dp ${l === "mom" ? "mom" : ""} ${l === "dad" || l === "rot" ? "disabled" : ""}`} onClick={() => toggleFixed(i, "mom")}>{d.slice(0, 2)}</div>; })}
                    </div>
                    <div className="sched-title" style={{ marginTop: 16 }}>ימים מתחלפים 🔄</div>
                    <div className="days-grid">
                      {DAYS_HE.map((d, i) => { const l = getTmpLabel(i); return <div key={i} className={`dp ${l === "rot" ? "rot" : ""} ${l === "dad" || l === "mom" ? "disabled" : ""}`} onClick={() => toggleRot(i)}>{d.slice(0, 2)}</div>; })}
                    </div>
                    <div className="toggle-row">
                      <span>השבוע הנוכחי — ימים המתחלפים אצל אבא?</span>
                      <div className={`toggle ${tmpRotDad ? "on" : ""}`} onClick={() => setTmpRotDad(v => !v)} />
                    </div>
                  </div>
                  <button className="save-btn" onClick={saveSchedule} disabled={saving}>{saving ? "שומר..." : "💾 שמור סדר"}</button>
                  <button className="cancel-btn" onClick={() => setEditSchedule(false)}>ביטול</button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══ SWAP ═══ */}
        {view === "swap" && (
          <div className="view">
            <div className="vheader"><button className="back-btn" onClick={() => setView("home")}>← חזרה</button><div className="vtitle">בקשת החלפת יום</div></div>
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
                      <button className="swap-approve-btn" onClick={() => respondSwap("approve")} disabled={saving}>✅ אישור</button>
                      <button className="swap-reject-btn" onClick={() => respondSwap("reject")} disabled={saving}>❌ דחייה</button>
                    </div>
                  </div>
                )}
                {hasPendingSwap && isSwapRequester && (
                  <div className="swap-sent-card">
                    <div className="swap-sent-title">⏳ הבקשה שלך ממתינה <span className="waiting-dots"><span /><span /><span /></span></div>
                    <div className="swap-days-display" style={{ "--green": "var(--dad)", "--green-border": "var(--dad-border)" }}>
                      <div className="swap-day-box" style={{ borderColor: "var(--dad-border)" }}><div className="sdb-who" style={{ color: "var(--dad-text)" }}>אתה נותן</div><div className="sdb-day" style={{ color: "var(--dad)" }}>{swap.offerDay.label}</div></div>
                      <div className="swap-arrow" style={{ color: "var(--dad)" }}>⇄</div>
                      <div className="swap-day-box" style={{ borderColor: "var(--dad-border)" }}><div className="sdb-who" style={{ color: "var(--dad-text)" }}>אתה רוצה</div><div className="sdb-day" style={{ color: "var(--dad)" }}>{swap.wantDay.label}</div></div>
                    </div>
                    <button className="swap-cancel-btn" onClick={cancelSwap} disabled={saving}>ביטול הבקשה</button>
                    <button
                      className="whatsapp-btn"
                      style={{ marginTop: 8 }}
                      onClick={() => sendWhatsApp(swap.offerDay, swap.wantDay)}
                    >
                      <span className="whatsapp-icon">📲</span> שלח שוב ב-WhatsApp
                    </button>
                  </div>
                )}
                {!hasPendingSwap && (
                  <div>
                    <div className="new-swap-title">📅 בקש החלפת יום</div>
                    <div className="new-swap-sub">{!role ? "חזור לדף הבית ובחר תפקיד" : swapStep === 1 ? "שלב 1: בחר יום שברצונך לתת" : "שלב 2: בחר את היום שאתה רוצה במקום"}</div>
                    {role && (<>
                      {swapStep === 1 && (<>
                        <div className="day-select-label">הימים שלך — 14 הימים הבאים</div>
                        <div className="day-list">
                          {myDays.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13 }}>אין ימים שלך ב-14 הימים הבאים</div>}
                          {myDays.map(d => (
                            <div key={d.date} className={`day-item ${offerDay?.date === d.date ? `selected ${role === "mom" ? "mom-sel" : ""}` : ""}`} onClick={() => setOfferDay({ date: d.date, dow: d.dow, label: d.label })}>
                              <div className={`di-dot ${role}`} /><div className="di-label">{d.label}</div><div className={`di-owner ${role}`}>{role === "dad" ? "אבא" : "אמא"}</div>
                            </div>
                          ))}
                        </div>
                        <button className="send-swap-btn" disabled={!offerDay} onClick={() => { if (offerDay) setSwapStep(2); }}>הבא →</button>
                      </>)}
                      {swapStep === 2 && (<>
                        <div style={{ fontSize: 13, color: "var(--green)", marginBottom: 10 }}>אתה מציע: <strong>{offerDay?.label}</strong></div>
                        <div className="day-select-label">ימי הצד השני</div>
                        <div className="day-list">
                          {otherDays.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13 }}>אין ימים של הצד השני</div>}
                          {otherDays.map(d => {
                            const other = role === "dad" ? "mom" : "dad";
                            return (
                              <div key={d.date} className={`day-item ${wantDay?.date === d.date ? `selected ${other === "mom" ? "mom-sel" : ""}` : ""}`} onClick={() => setWantDay({ date: d.date, dow: d.dow, label: d.label })}>
                                <div className={`di-dot ${other}`} /><div className="di-label">{d.label}</div><div className={`di-owner ${other}`}>{other === "dad" ? "👨 אבא" : "👩 אמא"}</div>
                              </div>
                            );
                          })}
                        </div>
                        <button className="send-swap-btn" disabled={!wantDay || saving} onClick={sendSwap}>{saving ? "שולח..." : "💾 שמור בקשה"}</button>
                        <button
                          className="whatsapp-btn"
                          disabled={!wantDay || saving}
                          onClick={async () => {
                            if (!wantDay || !offerDay) return;
                            await sendSwap();
                            sendWhatsApp(offerDay, wantDay);
                          }}
                        >
                          <span className="whatsapp-icon">📲</span> שלח בקשה ב-WhatsApp
                        </button>
                        <button className="cancel-btn" onClick={() => { setSwapStep(1); setWantDay(null); }}>← חזור</button>
                      </>)}
                    </>)}
                  </div>
                )}
                {!!data?.swapLog?.length && (
                  <div className="swap-log-section">
                    <div className="swap-log-title">היסטוריית החלפות</div>
                    <div className="swap-log-list">
                      {data.swapLog.map(s => (
                        <div key={s.id} className="swap-log-item">
                          <div className={`sli-status ${s.status}`}>{s.status === "approved" ? "✅ אושרה" : s.status === "rejected" ? "❌ נדחתה" : "🚫 בוטלה"}</div>
                          <div className="sli-text">{s.offerDay.label} ↔ {s.wantDay.label}<br />{s.requestedBy === "dad" ? "אבא" : "אמא"} ביקש · {formatDateShort(s.requestedAt)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
