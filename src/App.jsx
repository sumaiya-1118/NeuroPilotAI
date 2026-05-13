import { useState, useRef, useCallback, useEffect, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS & THEME
// ═══════════════════════════════════════════════════════════════════════════

const P = {
  critical: { label:"Critical", color:"#ff6b6b", bg:"rgba(255,107,107,.12)", border:"rgba(255,107,107,.28)", dot:"#ff6b6b" },
  high:     { label:"High",     color:"#ffa94d", bg:"rgba(255,169,77,.12)",  border:"rgba(255,169,77,.28)",  dot:"#ffa94d" },
  medium:   { label:"Medium",   color:"#74c0fc", bg:"rgba(116,192,252,.1)",  border:"rgba(116,192,252,.22)", dot:"#74c0fc" },
  low:      { label:"Low",      color:"#868e96", bg:"rgba(134,142,150,.08)", border:"rgba(134,142,150,.18)", dot:"#868e96" },
};

const EFFORT = {
  quick:    "⚡ Quick (5–15 min)",
  moderate: "⏱ Moderate (20–40 min)",
  deep:     "🧠 Deep (45–90 min)",
};

const EMO = {
  stress:"😤", overwhelm:"😵", anxiety:"😟",
  neutral:"😌", motivated:"🚀", procrastinating:"💤", burnout:"🥵",
};

const EMO_COLOR = {
  calm:"#69db7c", stressed:"#ffa94d", overwhelmed:"#ff6b6b",
  anxious:"#fcc419", motivated:"#69db7c",
};

const CAT_ICON = {
  work:"💼", personal:"👤", health:"❤️", communication:"💬", creative:"🎨", admin:"📁",
};

const POMO_PHASES = { work:"Focus", shortBreak:"Short Break", longBreak:"Long Break" };
const STORAGE_KEY = "np_v4";

// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveStore(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function fmtTimer(s) {
  return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}
function fmtClock(d) { return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }); }
function fmtDateShort(d) { return d.toLocaleDateString([], { weekday:"short", month:"short", day:"numeric" }); }
function todayKey() { const n=new Date(); return `${n.getFullYear()}-${n.getMonth()}-${n.getDate()}`; }
function getSR() { const SR=window.SpeechRecognition||window.webkitSpeechRecognition; return SR?new SR():null; }
function uid() { return Math.random().toString(36).slice(2,9); }

// ═══════════════════════════════════════════════════════════════════════════
// AI PROCESSOR  — Gemini API
// ═══════════════════════════════════════════════════════════════════════════

async function processWithAI(text) {

  try {

    console.log(import.meta.env)
    console.log(import.meta.env.VITE_GEMINI_API_KEY)

    const now = new Date();

    const todayFull = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit"
    });

    const tmrDate = new Date(
      now.getTime() + 86400000
    ).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric"
    });

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a world-class ADHD productivity coach. Think like a calm, direct coach who deeply understands executive dysfunction, time blindness, and overwhelm — NOT a generic task parser.

TODAY: ${todayFull}. Current time: ${timeStr}. Tomorrow = ${tmrDate}.

Analyze this brain dump and respond ONLY with valid JSON:

"""${text}"""

Return EXACTLY this structure:
{
  "tasks": [
    {
      "id": "t1",
      "title": "Action verb + object",
      "priority": "critical|high|medium|low",
      "deadlineLabel": "Tomorrow 10:00 AM",
      "deadlineISO": null,
      "estimatedMinutes": 30,
      "nextAction": "Specific first step",
      "emotionTag": "stress|overwhelm|anxiety|neutral",
      "effortLevel": "quick|moderate|deep",
      "category": "work|personal|health",
      "coachNote": "Short ADHD coaching tip"
    }
  ]
}`
                }
              ]
            }
          ]
        })
      }
    )

    const data = await resp.json();

    if (data.error) {
      throw new Error(data.error.message || "API error");
    }

    const raw =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {

      const m = cleaned.match(/\{[\s\S]*\}/);

      if (m) {
        return JSON.parse(m[0]);
      }

      throw new Error("Could not parse AI response");
    }

  } catch (error) {

   console.log("Gemini quota reached. Using smart fallback AI.");

    // FALLBACK RESPONSE
   return {
  tasks: [
    {
      id: "t1",
      title: text.slice(0, 30) || "Complete important task",
      priority: "high",
      deadlineLabel: "Today",
      deadlineISO: null,
      estimatedMinutes: 30,
      nextAction: "Break the task into one small actionable step.",
      emotionTag: "overwhelm",
      effortLevel: "moderate",
      category: "work",
      coachNote:
        "Starting imperfectly is better than waiting for motivation."
    }
         ]
         };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL CSS
// ═══════════════════════════════════════════════════════════════════════════

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Figtree:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{background:#080911;color:#e2e2ee;font-family:'Figtree',system-ui,sans-serif;line-height:1.5}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}
::selection{background:rgba(124,109,240,.3)}
textarea,input,button,select{font-family:'Figtree',system-ui,sans-serif}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes pulseRing{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.7);opacity:0}}
@keyframes breathe{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.7;transform:scale(1.1)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
@keyframes bounceIn{0%{transform:scale(.92);opacity:0}60%{transform:scale(1.03)}100%{transform:scale(1);opacity:1}}
@keyframes progressFill{from{width:0}to{width:var(--target-width,100%)}}
.fade-in{animation:fadeUp .32s ease both}
.fade-d1{animation:fadeUp .32s ease .07s both}
.fade-d2{animation:fadeUp .32s ease .14s both}
.fade-d3{animation:fadeUp .32s ease .21s both}
.fade-d4{animation:fadeUp .32s ease .28s both}
.slide-in{animation:slideIn .28s ease both}
.bounce-in{animation:bounceIn .4s cubic-bezier(.34,1.56,.64,1) both}

.btn-primary{background:linear-gradient(135deg,#7c6df0 0%,#5264f0 100%);border:none;border-radius:14px;color:#fff;cursor:pointer;font-size:.875rem;font-weight:600;padding:12px 22px;transition:transform .14s,box-shadow .14s;box-shadow:0 3px 14px rgba(124,109,240,.28);white-space:nowrap}
.btn-primary:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 5px 20px rgba(124,109,240,.4)}
.btn-primary:active:not(:disabled){transform:translateY(0)}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}
.btn-ghost{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:12px;color:rgba(255,255,255,.55);cursor:pointer;font-size:.8rem;font-weight:500;padding:9px 15px;transition:all .14s;white-space:nowrap}
.btn-ghost:hover{background:rgba(255,255,255,.09);color:rgba(255,255,255,.8);border-color:rgba(255,255,255,.15)}
.btn-success{background:rgba(105,219,124,.1);border:1px solid rgba(105,219,124,.28);border-radius:12px;color:#69db7c;cursor:pointer;font-size:.82rem;font-weight:600;padding:9px 16px;transition:all .14s;white-space:nowrap}
.btn-success:hover{background:rgba(105,219,124,.18);border-color:rgba(105,219,124,.45)}
.btn-warn{background:rgba(255,169,77,.08);border:1px solid rgba(255,169,77,.22);border-radius:12px;color:#ffa94d;cursor:pointer;font-size:.8rem;font-weight:500;padding:8px 14px;transition:all .14s;white-space:nowrap}
.btn-warn:hover{background:rgba(255,169,77,.15)}
.btn-danger{background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.2);border-radius:12px;color:#ff8f8f;cursor:pointer;font-size:.75rem;font-weight:500;padding:6px 12px;transition:all .14s;white-space:nowrap}
.btn-danger:hover{background:rgba(255,107,107,.15)}
.card{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:18px;padding:20px}
.np-input{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:12px;color:#e2e2ee;font-size:.9rem;outline:none;padding:10px 14px;transition:border-color .18s,box-shadow .18s}
.np-input:focus{border-color:rgba(124,109,240,.5);box-shadow:0 0 0 3px rgba(124,109,240,.1)}
.np-input::placeholder{color:rgba(255,255,255,.22)}
.np-textarea{width:100%;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);border-radius:14px;color:#e2e2ee;font-size:.95rem;line-height:1.75;outline:none;padding:16px;resize:vertical;transition:border-color .18s,box-shadow .18s}
.np-textarea:focus{border-color:rgba(124,109,240,.5);box-shadow:0 0 0 3px rgba(124,109,240,.1)}
.np-textarea::placeholder{color:rgba(255,255,255,.2)}
.task-card{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:0 16px 16px 0;border-left-width:3px;cursor:pointer;padding:14px 16px;transition:border-color .16s,background .16s,transform .14s}
.task-card:hover:not(.done){border-color:rgba(255,255,255,.13);background:rgba(255,255,255,.04);transform:translateX(2px)}
.task-card.done{opacity:.36;cursor:default}
.nav-btn{background:none;border:none;border-left:2px solid transparent;color:rgba(255,255,255,.38);cursor:pointer;display:flex;align-items:center;gap:10px;font-size:.84rem;font-weight:500;padding:10px 12px;border-radius:0 10px 10px 0;text-align:left;transition:all .14s;width:100%}
.nav-btn:hover{color:rgba(255,255,255,.7);background:rgba(255,255,255,.04)}
.nav-btn.active{color:#b8aefc;background:rgba(124,109,240,.1);border-left-color:#7c6df0}
.tag{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:20px;font-size:.67rem;font-weight:600;white-space:nowrap;letter-spacing:.02em}
.section-title{font-family:'Syne',sans-serif;font-size:1.55rem;font-weight:800;letter-spacing:-.025em;margin-bottom:.4rem}
.section-sub{color:rgba(255,255,255,.38);font-size:.82rem}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.info-row:last-child{border-bottom:none}
.coach-bubble{background:rgba(124,109,240,.07);border:1px solid rgba(124,109,240,.18);border-radius:12px;padding:10px 14px;font-size:.8rem;color:rgba(255,255,255,.65);line-height:1.5;font-style:italic}
.overload-banner{background:linear-gradient(135deg,rgba(255,107,107,.09),rgba(255,107,107,.04));border:1px solid rgba(255,107,107,.25);border-radius:14px;padding:13px 16px}
.insight-bar{background:linear-gradient(135deg,rgba(124,109,240,.08),rgba(82,100,240,.04));border:1px solid rgba(124,109,240,.2);border-radius:16px;padding:14px 18px}
.progress-track{background:rgba(255,255,255,.07);border-radius:20px;height:5px;overflow:hidden}
.progress-fill{height:100%;border-radius:20px;background:linear-gradient(90deg,#7c6df0,#69db7c);transition:width .5s ease}
.deadline-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(255,169,77,.1);border:1px solid rgba(255,169,77,.25);border-radius:8px;padding:3px 10px;font-size:.72rem;color:#ffa94d;font-weight:500}
.start-here-card{position:relative;overflow:hidden;background:linear-gradient(135deg,rgba(124,109,240,.11),rgba(82,100,240,.06));border:1px solid rgba(124,109,240,.38);border-radius:20px;padding:22px 24px}
.start-here-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#7c6df0,#5264f0,#7c6df0);background-size:200% auto;animation:shimmer 2.5s linear infinite}
.quick-win-card{background:rgba(105,219,124,.06);border:1px solid rgba(105,219,124,.22);border-radius:14px;padding:13px 16px}
.focus-ring{position:absolute;inset:-14px;border-radius:50%;background:radial-gradient(circle,rgba(124,109,240,.15),transparent 70%);animation:breathe 3s ease-in-out infinite}
.nudge-text{font-size:.78rem;color:rgba(255,255,255,.38);font-style:italic;text-align:center;animation:fadeIn .4s ease}
.stat-pill{background:rgba(255,255,255,.04);border-radius:12px;padding:10px 8px;text-align:center}
.energy-tip{background:rgba(116,192,252,.06);border:1px solid rgba(116,192,252,.18);border-radius:12px;padding:10px 14px;font-size:.8rem;color:rgba(116,192,252,.9);line-height:1.55}
.postpone-chip{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:4px 12px;font-size:.72rem;color:rgba(255,255,255,.5);cursor:pointer;transition:all .14s}
.postpone-chip:hover{background:rgba(255,255,255,.08);color:rgba(255,255,255,.75)}
`;

// ═══════════════════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function Spinner({ size = 15 }) {
  return (
    <span style={{ display:"inline-block", width:size, height:size, border:"2px solid rgba(255,255,255,.2)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin .72s linear infinite", flexShrink:0 }} />
  );
}

function PriBadge({ priority, size="sm" }) {
  const cfg = P[priority] || P.low;
  return (
    <span className="tag" style={{ background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`, padding:size==="lg"?"4px 12px":"2px 8px", fontSize:size==="lg"?".75rem":".66rem" }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:cfg.dot, display:"inline-block", flexShrink:0 }} />
      {cfg.label}
    </span>
  );
}

function DeadlineBadge({ label }) {
  if (!label) return null;
  return (
    <span className="deadline-badge">🕐 {label}</span>
  );
}

function ProgressBar({ value, max, color = "linear-gradient(90deg,#7c6df0,#69db7c)" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width:`${pct}%`, background:color }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════

function Sidebar({ view, setView, aiResult, activeTasks, doneCount, habitStreak }) {
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  const navItems = [
    { id:"dump",     icon:"🧠", label:"Brain Dump" },
    { id:"tasks",    icon:"📋", label:"Tasks" },
    { id:"focus",    icon:"🎯", label:"Focus Mode" },
    { id:"habits",   icon:"🔥", label:"Habits" },
    { id:"journal",  icon:"📓", label:"Journal" },
    { id:"settings", icon:"⚙️",  label:"Settings" },
  ];

  const totalTasks = activeTasks.length + doneCount;
  const pct = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  return (
    <aside style={{ width:208, flexShrink:0, borderRight:"1px solid rgba(255,255,255,.06)", display:"flex", flexDirection:"column", gap:22, padding:"26px 0", background:"rgba(255,255,255,.012)", minHeight:"100vh", position:"sticky", top:0 }}>
      {/* Logo */}
      <div style={{ padding:"0 16px" }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:"1.1rem", fontWeight:800, letterSpacing:"-.02em" }}>
          <span style={{ color:"#7c6df0" }}>neuro</span><span>pilot</span>
          <span style={{ marginLeft:6, fontSize:".5rem", background:"rgba(124,109,240,.18)", color:"#b8aefc", border:"1px solid rgba(124,109,240,.3)", borderRadius:4, padding:"1px 5px", fontFamily:"'Figtree',sans-serif", fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", verticalAlign:"middle" }}>AI</span>
        </div>
        <div style={{ fontSize:".58rem", color:"rgba(255,255,255,.25)", marginTop:3, letterSpacing:".08em", textTransform:"uppercase" }}>
          ADHD Productivity Coach
        </div>
      </div>

      {/* Clock */}
      <div style={{ padding:"0 16px" }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:"1.9rem", fontWeight:700, lineHeight:1 }}>{fmtClock(clock)}</div>
        <div style={{ fontSize:".68rem", color:"rgba(255,255,255,.32)", marginTop:4 }}>{fmtDateShort(clock)}</div>
      </div>

      {/* Nav */}
      <nav style={{ display:"flex", flexDirection:"column", gap:2, padding:"0 4px" }}>
        {navItems.map(({ id, icon, label }) => (
          <button key={id} className={`nav-btn${view===id?" active":""}`} onClick={() => setView(id)}>
            <span style={{ fontSize:".95rem" }}>{icon}</span>{label}
            {id==="tasks" && activeTasks.length > 0 && (
              <span style={{ marginLeft:"auto", background:"rgba(124,109,240,.25)", color:"#b8aefc", borderRadius:8, fontSize:".6rem", fontWeight:700, padding:"1px 6px" }}>{activeTasks.length}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Stats */}
      <div style={{ padding:"0 12px", marginTop:"auto", display:"flex", flexDirection:"column", gap:10 }}>
        {totalTasks > 0 && (
          <div>
            <div style={{ fontSize:".58rem", color:"rgba(255,255,255,.25)", letterSpacing:".07em", textTransform:"uppercase", marginBottom:7 }}>Session Progress</div>
            <div style={{ display:"flex", gap:7, marginBottom:8 }}>
              <div className="stat-pill" style={{ flex:1 }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:"1.45rem", fontWeight:700, lineHeight:1 }}>{activeTasks.length}</div>
                <div style={{ fontSize:".55rem", color:"rgba(255,255,255,.35)", marginTop:2 }}>Active</div>
              </div>
              <div className="stat-pill" style={{ flex:1, background:"rgba(105,219,124,.07)" }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:"1.45rem", fontWeight:700, lineHeight:1, color:"#69db7c" }}>{doneCount}</div>
                <div style={{ fontSize:".55rem", color:"rgba(255,255,255,.35)", marginTop:2 }}>Done</div>
              </div>
            </div>
            <div style={{ marginBottom:5 }}>
              <ProgressBar value={doneCount} max={totalTasks} />
            </div>
            <div style={{ fontSize:".62rem", color:"rgba(255,255,255,.3)", textAlign:"right" }}>{pct}% complete</div>
          </div>
        )}

        {habitStreak > 0 && (
          <div style={{ background:"rgba(255,169,77,.08)", border:"1px solid rgba(255,169,77,.18)", borderRadius:11, padding:"9px 11px" }}>
            <div style={{ fontSize:".55rem", color:"rgba(255,169,77,.7)", letterSpacing:".06em", textTransform:"uppercase", marginBottom:3 }}>Best Streak</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:"1.3rem", fontWeight:700, color:"#ffa94d" }}>{habitStreak} days 🔥</div>
          </div>
        )}

        {aiResult?.overloadDetected && (
          <div style={{ background:"rgba(255,107,107,.08)", border:"1px solid rgba(255,107,107,.22)", borderRadius:10, padding:"9px 11px", fontSize:".68rem", color:"#ff9898", lineHeight:1.5 }}>
            ⚠️ <strong>Overload detected</strong><br />
            <span style={{ fontSize:".62rem", opacity:.7 }}>Focus on one task only</span>
          </div>
        )}

        {aiResult?.emotionSummary && aiResult.emotionSummary !== "calm" && (
          <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)", borderRadius:10, padding:"8px 11px", fontSize:".68rem", color:"rgba(255,255,255,.5)", lineHeight:1.5 }}>
            {EMO[aiResult.emotionSummary] || "😌"} Detected: <span style={{ color:EMO_COLOR[aiResult.emotionSummary]||"#74c0fc", fontWeight:600 }}>{aiResult.emotionSummary}</span>
          </div>
        )}
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BRAIN DUMP VIEW
// ═══════════════════════════════════════════════════════════════════════════

const EXAMPLES = [
  "Tomorrow 10am presentation submission. Need to finish slides. Feeling stressed because I also need to upload the YouTube video by 2pm and call the client tonight.",
  "Have to review the contract by Friday EOD, fix production bug ASAP, and completely blanking on that report my manager needs. Feeling totally underwater.",
  "Need to email Dr. Smith before 3pm today, pick up kids at 5, finish the landing page design for the client meeting next Tuesday. Also procrastinating the tax stuff.",
  "Team standup in 30 mins, haven't prepared. Project deadline end of day. Behind on three things. Can't focus, feeling overwhelmed and just sitting here.",
];

function DumpView({ liveText, setBrainDump, isListening, speechOk, toggleMic, isProcessing, stage, process, error }) {
  const wordCount = liveText.trim() ? liveText.trim().split(/\s+/).length : 0;

  return (
    <div style={{ maxWidth:660, margin:"0 auto" }} className="fade-in">
      <div style={{ marginBottom:"2.2rem" }}>
        <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(1.7rem,3vw,2.3rem)", fontWeight:800, letterSpacing:"-.03em", lineHeight:1.1, marginBottom:".7rem" }}>
          What's on <span style={{ color:"#7c6df0" }}>your mind?</span>
        </h1>
        <p style={{ color:"rgba(255,255,255,.4)", fontSize:".93rem", lineHeight:1.65 }}>
          Speak or type everything — tasks, deadlines, worries, half-formed thoughts. AI extracts structure, detects urgency, reads your emotional state, and tells you exactly what to do first.
        </p>
      </div>

      <div style={{ position:"relative", marginBottom:10 }}>
        <textarea
          className="np-textarea"
          style={{ minHeight:200 }}
          value={liveText}
          onChange={e => !isListening && setBrainDump(e.target.value)}
          readOnly={isListening}
          placeholder="Just dump everything here — deadlines, stress, meetings, half-forgotten things. AI handles the sorting. The messier, the better."
        />
        {isListening && (
          <div style={{ position:"absolute", top:13, right:14, display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ position:"relative", width:10, height:10 }}>
              <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:"#7c6df0", animation:"pulseRing 1.4s ease-out infinite" }} />
              <div style={{ width:10, height:10, borderRadius:"50%", background:"#7c6df0" }} />
            </div>
            <span style={{ fontSize:".66rem", color:"#b8aefc", letterSpacing:".04em" }}>LISTENING</span>
          </div>
        )}
        {liveText && (
          <div style={{ position:"absolute", bottom:11, right:13, fontSize:".63rem", color:"rgba(255,255,255,.2)" }}>
            {wordCount} word{wordCount !== 1 ? "s" : ""} · {liveText.length} chars
          </div>
        )}
      </div>

      <div style={{ display:"flex", gap:9, alignItems:"center", marginBottom:14 }}>
        {speechOk && (
          <button
            onClick={toggleMic}
            title={isListening ? "Stop listening" : "Start voice input"}
            style={{ width:48, height:48, borderRadius:"50%", border:"none", flexShrink:0,
              background: isListening ? "linear-gradient(135deg,#7c6df0,#5264f0)" : "rgba(255,255,255,.07)",
              color:"#fff", cursor:"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all .2s", boxShadow: isListening ? "0 3px 18px rgba(124,109,240,.45)" : "none" }}
          >{isListening ? "⏹" : "🎤"}</button>
        )}
        <button
          className="btn-primary"
          onClick={process}
          disabled={isProcessing || !liveText.trim()}
          style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:9, height:48 }}
        >
          {isProcessing
            ? <><Spinner size={14} />{stage || "Processing…"}</>
            : "✨  Process with AI"}
        </button>
        {liveText.trim() && !isProcessing && (
          <button className="btn-ghost" onClick={() => setBrainDump("")}>Clear</button>
        )}
      </div>

      {error && (
        <div style={{ background:"rgba(255,107,107,.09)", border:"1px solid rgba(255,107,107,.25)", borderRadius:12, padding:"12px 16px", fontSize:".84rem", color:"#ff9898", marginBottom:18, lineHeight:1.6 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!liveText.trim() && (
        <div style={{ marginTop:"2rem" }}>
          <p style={{ fontSize:".6rem", color:"rgba(255,255,255,.25)", letterSpacing:".07em", textTransform:"uppercase", marginBottom:10 }}>Try an example</p>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setBrainDump(ex)}
                className="fade-in"
                style={{ background:"rgba(255,255,255,.024)", border:"1px solid rgba(255,255,255,.07)", borderRadius:12, padding:"11px 14px", color:"rgba(255,255,255,.42)", fontSize:".78rem", cursor:"pointer", textAlign:"left", lineHeight:1.55, fontFamily:"'Figtree',system-ui,sans-serif", transition:"all .15s", animationDelay:`${i*0.05}s` }}
                onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,.05)"; e.currentTarget.style.color="rgba(255,255,255,.65)"; e.currentTarget.style.borderColor="rgba(124,109,240,.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,.024)"; e.currentTarget.style.color="rgba(255,255,255,.42)"; e.currentTarget.style.borderColor="rgba(255,255,255,.07)"; }}
              >
                <span style={{ color:"rgba(124,109,240,.6)", marginRight:8 }}>→</span>
                {ex.length > 115 ? ex.slice(0,115)+"…" : ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {!liveText.trim() && (
        <div style={{ marginTop:"2.5rem", padding:"18px 20px", background:"rgba(255,255,255,.018)", border:"1px solid rgba(255,255,255,.06)", borderRadius:16 }}>
          <div style={{ fontSize:".6rem", color:"rgba(255,255,255,.25)", letterSpacing:".07em", textTransform:"uppercase", marginBottom:10 }}>How it works</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[
              ["🗣️", "Speak or type", "Dump your thoughts — tasks, deadlines, stress, whatever"],
              ["🤖", "AI understands", "Extracts tasks, deadlines, urgency, emotions, and priorities"],
              ["⚡", "Instant clarity", "Get a ranked plan with next actions — start in seconds"],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                <span style={{ fontSize:"1.1rem", flexShrink:0, marginTop:1 }}>{icon}</span>
                <div>
                  <div style={{ fontSize:".82rem", fontWeight:600, color:"rgba(255,255,255,.7)", marginBottom:2 }}>{title}</div>
                  <div style={{ fontSize:".75rem", color:"rgba(255,255,255,.35)", lineHeight:1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPANDABLE TASK CARD
// ═══════════════════════════════════════════════════════════════════════════

function TaskCard({ task, done, onMarkDone, onFocus, onPostpone, delay=0, isStartHere=false }) {
  const [open, setOpen] = useState(false);
  const cfg = P[task.priority] || P.low;

  return (
    <div
      className={`task-card${done?" done":""}`}
      style={{ animation:`fadeUp .3s ease ${delay}s both`, borderLeftColor: done ? "rgba(255,255,255,.08)" : cfg.dot }}
      onClick={() => !done && setOpen(o => !o)}
    >
      <div style={{ display:"flex", gap:11, alignItems:"flex-start" }}>
        {/* Checkbox */}
        <button
          onClick={e => { e.stopPropagation(); onMarkDone(task.id); }}
          style={{ width:22, height:22, borderRadius:6, flexShrink:0, marginTop:2,
            border:`1.5px solid ${done?"#69db7c":"rgba(255,255,255,.18)"}`,
            background: done ? "rgba(105,219,124,.15)" : "transparent",
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            color:"#69db7c", fontSize:".8rem", transition:"all .15s" }}
        >{done && "✓"}</button>

        {/* Content */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap", marginBottom:4 }}>
            <span style={{ fontWeight:600, fontSize:".9rem", color:done?"rgba(255,255,255,.3)":"#e2e2ee", textDecoration:done?"line-through":"none" }}>
              {task.title}
            </span>
            <PriBadge priority={task.priority} />
            {task.category && (
              <span style={{ fontSize:".68rem", color:"rgba(255,255,255,.28)" }}>{CAT_ICON[task.category]||""}</span>
            )}
            {isStartHere && !done && (
              <span className="tag" style={{ background:"rgba(124,109,240,.2)", color:"#b8aefc", border:"1px solid rgba(124,109,240,.35)", fontSize:".6rem" }}>⚡ Start Here</span>
            )}
          </div>

          {task.deadlineLabel && <DeadlineBadge label={task.deadlineLabel} />}

          {/* Expanded */}
          {open && !done && (
            <div style={{ marginTop:14, borderTop:"1px solid rgba(255,255,255,.06)", paddingTop:14 }} onClick={e => e.stopPropagation()}>
              {/* Next Action */}
              <div style={{ background:"rgba(124,109,240,.08)", border:"1px solid rgba(124,109,240,.18)", borderRadius:12, padding:"11px 14px", marginBottom:12 }}>
                <div style={{ fontSize:".58rem", color:"#b8aefc", letterSpacing:".06em", textTransform:"uppercase", marginBottom:5 }}>Next Action — Do This Now</div>
                <p style={{ fontSize:".88rem", color:"#e2e2ee", lineHeight:1.5 }}>→ {task.nextAction}</p>
              </div>

              {/* Coach Note */}
              {task.coachNote && (
                <div className="coach-bubble" style={{ marginBottom:12 }}>
                  💬 {task.coachNote}
                </div>
              )}

              {/* Meta row */}
              <div style={{ display:"flex", gap:14, marginBottom:14, flexWrap:"wrap" }}>
                {task.effortLevel && (
                  <span style={{ fontSize:".72rem", color:"rgba(255,255,255,.38)" }}>{EFFORT[task.effortLevel]}</span>
                )}
                <span style={{ fontSize:".72rem", color:"rgba(255,255,255,.38)" }}>~{task.estimatedMinutes} min</span>
                {task.emotionTag && task.emotionTag !== "neutral" && (
                  <span style={{ fontSize:".72rem", color:"rgba(255,255,255,.38)" }}>{EMO[task.emotionTag]} {task.emotionTag}</span>
                )}
                {task.category && (
                  <span style={{ fontSize:".72rem", color:"rgba(255,255,255,.38)", textTransform:"capitalize" }}>{task.category}</span>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <button className="btn-primary" style={{ padding:"8px 16px", fontSize:".8rem" }} onClick={() => onFocus(task.id)}>🎯 Deep Focus</button>
                <button className="btn-success" style={{ padding:"8px 14px", fontSize:".8rem" }} onClick={() => onMarkDone(task.id)}>✓ Done</button>
                {onPostpone && (
                  <button className="btn-ghost" style={{ padding:"8px 12px", fontSize:".75rem" }} onClick={() => onPostpone(task.id)}>Later →</button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right side meta */}
        {!open && (
          <div style={{ flexShrink:0, textAlign:"right" }}>
            <div style={{ fontSize:".7rem", color:"rgba(255,255,255,.3)", marginBottom:3 }}>{task.estimatedMinutes}m</div>
            {task.emotionTag && task.emotionTag !== "neutral" && (
              <div style={{ fontSize:".88rem" }}>{EMO[task.emotionTag]}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TASKS VIEW
// ═══════════════════════════════════════════════════════════════════════════

function TasksView({ tasks, activeTasks, aiResult, completedIds, postponedIds, onMarkDone, onPostpone, onFocus, setView }) {
  const startHere = useMemo(() =>
    (aiResult && tasks.find(t => t.id === aiResult.startHereId && !completedIds.has(t.id) && !postponedIds.has(t.id))) || null,
    [tasks, aiResult, completedIds, postponedIds]);

  const quickWin = useMemo(() =>
    (aiResult?.quickWinId && tasks.find(t => t.id === aiResult.quickWinId && !completedIds.has(t.id) && !postponedIds.has(t.id) && t.id !== aiResult?.startHereId)) || null,
    [tasks, aiResult, completedIds, postponedIds]);

  const remaining = tasks.filter(t =>
    !completedIds.has(t.id) &&
    !postponedIds.has(t.id) &&
    !(startHere && t.id === startHere.id)
  );

  const postponedList = tasks.filter(t => postponedIds.has(t.id) && !completedIds.has(t.id));
  const doneList      = tasks.filter(t => completedIds.has(t.id));
  const ec = EMO_COLOR[aiResult?.emotionSummary] || "#74c0fc";

  return (
    <div style={{ maxWidth:720, margin:"0 auto" }} className="fade-in">
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"1.5rem", gap:12 }}>
        <div>
          <h2 className="section-title">Action Plan</h2>
          <p className="section-sub">{activeTasks.length} active · {completedIds.size} done{postponedIds.size > 0 ? ` · ${postponedIds.size} postponed` : ""}</p>
        </div>
        <button className="btn-ghost" style={{ fontSize:".75rem", marginTop:4 }} onClick={() => setView("dump")}>+ New dump</button>
      </div>

      {/* AI Insight Bar */}
      {aiResult?.overallInsight && (
        <div className="insight-bar fade-d1" style={{ marginBottom:10 }}>
          <div style={{ display:"flex", gap:11, alignItems:"flex-start" }}>
            <span style={{ fontSize:"1rem", flexShrink:0 }}>🤖</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:".58rem", color:"#b8aefc", letterSpacing:".06em", textTransform:"uppercase", marginBottom:4 }}>AI Coach Insight</div>
              <p style={{ fontSize:".87rem", color:"rgba(255,255,255,.78)", lineHeight:1.5 }}>{aiResult.overallInsight}</p>
            </div>
            {aiResult.emotionSummary && (
              <span className="tag" style={{ background:`${ec}14`, color:ec, border:`1px solid ${ec}30`, padding:"3px 10px", fontSize:".68rem", flexShrink:0, marginTop:2 }}>
                {EMO[aiResult.emotionSummary] || "😌"} {aiResult.emotionSummary}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Energy Strategy */}
      {aiResult?.energyStrategy && (
        <div className="energy-tip fade-d1" style={{ marginBottom:10 }}>
          ⚡ <strong>Strategy:</strong> {aiResult.energyStrategy}
        </div>
      )}

      {/* Overload Banner */}
      {aiResult?.overloadDetected && (
        <div className="overload-banner fade-d2" style={{ marginBottom:12 }}>
          <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
            <span style={{ fontSize:"1.1rem" }}>⚠️</span>
            <div>
              <div style={{ fontWeight:700, color:"#ffbcbc", fontSize:".85rem", marginBottom:3 }}>Mental overload detected</div>
              <p style={{ fontSize:".78rem", color:"rgba(255,107,107,.8)", lineHeight:1.5 }}>
                You have more active tasks than your brain can comfortably hold. Focus <em>only</em> on the Start Here task. Ignore everything else until it's done.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Start Here Card */}
      {startHere && (
        <div className="start-here-card fade-d2" style={{ marginBottom:14 }}>
          <div style={{ marginBottom:12 }}>
            <span className="tag" style={{ background:"rgba(124,109,240,.22)", color:"#b8aefc", border:"1px solid rgba(124,109,240,.4)", fontSize:".62rem", fontWeight:700, letterSpacing:".07em", textTransform:"uppercase" }}>
              ⚡ Start Here
            </span>
          </div>
          <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
            <div style={{ flex:1, minWidth:0 }}>
              <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:"1.2rem", fontWeight:700, lineHeight:1.2, marginBottom:6 }}>{startHere.title}</h3>
              {startHere.deadlineLabel && (
                <div style={{ marginBottom:12 }}><DeadlineBadge label={startHere.deadlineLabel} /></div>
              )}
              <div style={{ background:"rgba(255,255,255,.06)", borderRadius:12, padding:"12px 15px", marginBottom:10 }}>
                <div style={{ fontSize:".58rem", color:"rgba(255,255,255,.35)", letterSpacing:".06em", textTransform:"uppercase", marginBottom:5 }}>Your Only Job Right Now</div>
                <p style={{ fontSize:".93rem", color:"#e2e2ee", lineHeight:1.5 }}>→ {startHere.nextAction}</p>
              </div>
              {startHere.coachNote && (
                <div className="coach-bubble" style={{ marginBottom:12 }}>💬 {startHere.coachNote}</div>
              )}
              <div style={{ display:"flex", gap:9, flexWrap:"wrap" }}>
                <button className="btn-primary" style={{ padding:"10px 18px" }} onClick={() => onFocus(startHere.id)}>🎯 Start Focus</button>
                <button className="btn-success" onClick={() => onMarkDone(startHere.id)}>✓ Done</button>
              </div>
            </div>
            <div style={{ flexShrink:0, textAlign:"right" }}>
              <PriBadge priority={startHere.priority} size="lg" />
              <div style={{ marginTop:8, fontSize:".7rem", color:"rgba(255,255,255,.32)" }}>~{startHere.estimatedMinutes} min</div>
              {startHere.effortLevel && (
                <div style={{ marginTop:5, fontSize:".65rem", color:"rgba(255,255,255,.28)" }}>{EFFORT[startHere.effortLevel]}</div>
              )}
              {startHere.emotionTag && startHere.emotionTag !== "neutral" && (
                <div style={{ marginTop:6, fontSize:"1.1rem" }}>{EMO[startHere.emotionTag]}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Win */}
      {quickWin && (
        <div className="quick-win-card fade-d3" style={{ marginBottom:14, display:"flex", gap:11, alignItems:"center" }}>
          <span style={{ fontSize:"1rem", flexShrink:0 }}>⚡</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:".58rem", color:"#69db7c", letterSpacing:".06em", textTransform:"uppercase", marginBottom:3 }}>Quick Win — Build Momentum</div>
            <p style={{ fontSize:".83rem", color:"rgba(255,255,255,.72)" }}>
              <strong style={{ color:"#e2e2ee" }}>{quickWin.title}</strong> — ~{quickWin.estimatedMinutes} min. Complete this to build momentum before deep work.
            </p>
          </div>
          <button className="btn-success" style={{ fontSize:".75rem", padding:"7px 13px", flexShrink:0 }} onClick={() => onFocus(quickWin.id)}>
            Start →
          </button>
        </div>
      )}

      {/* Remaining Tasks */}
      {remaining.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
          {remaining.map((task, i) => (
            <TaskCard
              key={task.id}
              task={task}
              done={false}
              onMarkDone={onMarkDone}
              onFocus={onFocus}
              onPostpone={onPostpone}
              delay={i * 0.04}
              isStartHere={task.id === aiResult?.startHereId}
            />
          ))}
        </div>
      )}

      {/* Postponed */}
      {postponedList.length > 0 && (
        <div style={{ marginTop:16 }}>
          <p style={{ fontSize:".6rem", color:"rgba(255,255,255,.22)", letterSpacing:".07em", textTransform:"uppercase", marginBottom:9 }}>Postponed — Do Later</p>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {postponedList.map(task => (
              <div key={task.id} style={{ background:"rgba(255,255,255,.018)", border:"1px dashed rgba(255,255,255,.07)", borderRadius:12, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:".85rem", color:"rgba(255,255,255,.35)", flex:1 }}>{task.title}</span>
                <button className="btn-ghost" style={{ fontSize:".72rem", padding:"5px 10px" }} onClick={() => onPostpone(task.id)}>Restore</button>
                <button className="btn-success" style={{ fontSize:".72rem", padding:"5px 10px" }} onClick={() => onMarkDone(task.id)}>✓</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Done */}
      {doneList.length > 0 && (
        <div style={{ marginTop:16 }}>
          <p style={{ fontSize:".6rem", color:"rgba(255,255,255,.22)", letterSpacing:".07em", textTransform:"uppercase", marginBottom:9 }}>Completed 🎉</p>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {doneList.map(task => (
              <TaskCard key={task.id} task={task} done onMarkDone={() => {}} onFocus={() => {}} />
            ))}
          </div>
        </div>
      )}

      {/* All done */}
      {activeTasks.length === 0 && tasks.length > 0 && (
        <div style={{ textAlign:"center", padding:"3.5rem 1rem" }} className="bounce-in">
          <div style={{ fontSize:"3rem", marginBottom:12 }}>🎉</div>
          <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:"1.3rem", fontWeight:700, marginBottom:8 }}>All done!</h3>
          <p style={{ color:"rgba(255,255,255,.4)", marginBottom:24, fontSize:".88rem", maxWidth:340, margin:"0 auto 24px" }}>
            That's the whole session. Seriously — great work. Do a new brain dump whenever you're ready.
          </p>
          <button className="btn-primary" onClick={() => setView("dump")}>New Brain Dump</button>
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 && (
        <div style={{ textAlign:"center", padding:"3rem 1rem" }}>
          <div style={{ fontSize:"2.5rem", marginBottom:12, opacity:.3 }}>📋</div>
          <p style={{ color:"rgba(255,255,255,.3)", marginBottom:20, fontSize:".88rem" }}>No tasks yet. Do a brain dump and let AI organize it for you.</p>
          <button className="btn-primary" onClick={() => setView("dump")}>Start Brain Dump</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// POMODORO WIDGET
// ═══════════════════════════════════════════════════════════════════════════

function PomodoroWidget({ focusLabel }) {
  const [phase,   setPhase]   = useState("work");
  const [secs,    setSecs]    = useState(25 * 60);
  const [run,     setRun]     = useState(false);
  const [done,    setDone]    = useState(0);
  const [workDur, setWorkDur] = useState(25 * 60);

  const DURATIONS = { work:workDur, shortBreak:5*60, longBreak:15*60 };

  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => {
      setSecs(s => {
        if (s <= 1) {
          clearInterval(t);
          setRun(false);
          if (phase === "work") {
            const nd = done + 1;
            setDone(nd);
            const next = nd % 4 === 0 ? "longBreak" : "shortBreak";
            setPhase(next);
            setSecs(next === "longBreak" ? 15*60 : 5*60);
          } else {
            setPhase("work");
            setSecs(workDur);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [run, phase, done, workDur]);

  const total  = DURATIONS[phase];
  const prog   = 1 - secs / total;
  const circum = 2 * Math.PI * 66;
  const COLORS = { work:"#7c6df0", shortBreak:"#69db7c", longBreak:"#74c0fc" };
  const col    = COLORS[phase];

  return (
    <div className="card" style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div>
        <div style={{ fontSize:".6rem", color:"rgba(255,255,255,.28)", letterSpacing:".07em", textTransform:"uppercase", marginBottom:8 }}>Pomodoro Timer</div>
        <div style={{ display:"flex", gap:6 }}>
          {Object.entries(POMO_PHASES).map(([k, v]) => (
            <button key={k} onClick={() => { setPhase(k); setSecs(DURATIONS[k]); setRun(false); }}
              style={{ padding:"4px 10px", borderRadius:20, border:`1px solid ${phase===k?`${COLORS[k]}50`:"rgba(255,255,255,.08)"}`, background:phase===k?`${COLORS[k]}18`:"transparent", color:phase===k?COLORS[k]:"rgba(255,255,255,.4)", fontSize:".67rem", fontWeight:600, cursor:"pointer", transition:"all .14s" }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {focusLabel && (
        <div style={{ background:"rgba(255,255,255,.04)", borderRadius:10, padding:"8px 12px", fontSize:".78rem", color:"rgba(255,255,255,.5)", borderLeft:`3px solid ${col}`, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
          {focusLabel}
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"center" }}>
        <div style={{ position:"relative", display:"inline-block" }}>
          {run && <div style={{ position:"absolute", inset:-12, borderRadius:"50%", background:`radial-gradient(circle,${col}18,transparent 70%)`, animation:"breathe 3s ease-in-out infinite" }} />}
          <svg width={160} height={160} style={{ transform:"rotate(-90deg)", display:"block" }}>
            <circle cx={80} cy={80} r={66} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={7} />
            <circle cx={80} cy={80} r={66} fill="none" stroke={col} strokeWidth={7} strokeLinecap="round"
              strokeDasharray={circum} strokeDashoffset={circum*(1-prog)}
              style={{ transition:"stroke-dashoffset 1s linear, stroke .3s" }} />
          </svg>
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:"1.9rem", fontWeight:700, lineHeight:1 }}>{fmtTimer(secs)}</div>
            <div style={{ fontSize:".65rem", color:"rgba(255,255,255,.38)", marginTop:3 }}>{POMO_PHASES[phase]}</div>
          </div>
        </div>
      </div>

      <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
        <button className="btn-ghost" onClick={() => { setRun(false); setSecs(DURATIONS[phase]); }} style={{ fontSize:".78rem" }}>↺</button>
        <button className="btn-primary" style={{ minWidth:110, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }} onClick={() => setRun(r => !r)}>
          {run ? "⏸  Pause" : "▶  Start"}
        </button>
        <button className="btn-ghost" onClick={() => {
          setRun(false);
          if (phase==="work") { const nd=done+1; setDone(nd); const next=nd%4===0?"longBreak":"shortBreak"; setPhase(next); setSecs(next==="longBreak"?15*60:5*60); }
          else { setPhase("work"); setSecs(workDur); }
        }} style={{ fontSize:".78rem" }}>→</button>
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
        <div style={{ fontSize:".72rem", color:"rgba(255,255,255,.32)" }}>🍅 {done} session{done!==1?"s":""}</div>
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          <span style={{ fontSize:".65rem", color:"rgba(255,255,255,.3)" }}>Work:</span>
          {[15,25,45,60].map(m => (
            <button key={m} onClick={() => { setWorkDur(m*60); if(phase==="work") setSecs(m*60); setRun(false); }}
              style={{ padding:"2px 7px", borderRadius:7, border:`1px solid ${workDur===m*60?"rgba(124,109,240,.45)":"rgba(255,255,255,.08)"}`, background:workDur===m*60?"rgba(124,109,240,.15)":"transparent", color:workDur===m*60?"#b8aefc":"rgba(255,255,255,.38)", fontSize:".62rem", cursor:"pointer" }}>
              {m}m
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FOCUS VIEW
// ═══════════════════════════════════════════════════════════════════════════

const NUDGES = [
  "One tiny step. Just open it.",
  "Progress over perfection. Keep moving.",
  "The first 2 minutes are the hardest.",
  "You're doing this. Stay here.",
  "Ignore everything else. Only this.",
  "Done is better than perfect.",
  "You can rest after. Not yet.",
  "Small actions compound. Trust the process.",
  "Your brain is working. Keep going.",
  "Stay on task. You got this.",
];

function FocusView({ task, aiResult, allTasks, onMarkDone, setView }) {
  const [secs,    setSecs]    = useState(0);
  const [running, setRunning] = useState(false);
  const [nudgeIdx,setNudgeIdx]= useState(0);

  const nudge      = NUDGES[nudgeIdx % NUDGES.length];
  const targetSecs = (task?.estimatedMinutes || 25) * 60;
  const progress   = Math.min(1, secs / targetSecs);
  const circum     = 2 * Math.PI * 74;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Rotate nudge every ~4 minutes
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNudgeIdx(i => i + 1), 240000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => { setSecs(0); setRunning(false); setNudgeIdx(0); }, [task?.id]);

  if (!task) {
    const topTask = allTasks?.find(t => !["completed"].includes(t.status));
    return (
      <div style={{ maxWidth:500, margin:"0 auto", textAlign:"center", paddingTop:"4rem" }}>
        <div style={{ fontSize:"2.5rem", marginBottom:14, opacity:.38 }}>🎯</div>
        <p style={{ color:"rgba(255,255,255,.38)", marginBottom:20, fontSize:".9rem" }}>No task selected. Pick one from your task board to enter deep focus.</p>
        <button className="btn-primary" onClick={() => setView("tasks")}>Go to Tasks</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth:620, margin:"0 auto" }} className="fade-in">
      <button className="btn-ghost" onClick={() => setView("tasks")} style={{ marginBottom:"1.8rem", fontSize:".78rem" }}>← Back to tasks</button>

      {/* Header */}
      <div style={{ textAlign:"center", marginBottom:"2rem" }}>
        <div style={{ fontSize:".6rem", letterSpacing:".1em", color:"rgba(255,255,255,.28)", textTransform:"uppercase", marginBottom:10 }}>Deep Focus Mode</div>
        <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(1.4rem,2.5vw,1.9rem)", fontWeight:800, letterSpacing:"-.03em", lineHeight:1.1, marginBottom:10 }}>{task.title}</h2>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, flexWrap:"wrap" }}>
          <PriBadge priority={task.priority} size="lg" />
          {task.deadlineLabel && <DeadlineBadge label={task.deadlineLabel} />}
        </div>
      </div>

      {/* Next Action Box */}
      <div style={{ background:"rgba(124,109,240,.08)", border:"1px solid rgba(124,109,240,.22)", borderRadius:16, padding:"16px 20px", marginBottom:"2rem", textAlign:"center" }}>
        <div style={{ fontSize:".58rem", color:"#b8aefc", letterSpacing:".07em", textTransform:"uppercase", marginBottom:8 }}>Your Only Job Right Now</div>
        <p style={{ fontSize:"1rem", color:"#e2e2ee", lineHeight:1.5 }}>→ {task.nextAction}</p>
      </div>

      {/* Timer Ring */}
      <div style={{ textAlign:"center", marginBottom:"2rem" }}>
        <div style={{ position:"relative", display:"inline-block" }}>
          {running && <div className="focus-ring" />}
          <svg width={186} height={186} style={{ transform:"rotate(-90deg)", display:"block" }}>
            <circle cx={93} cy={93} r={74} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={7} />
            <circle cx={93} cy={93} r={74} fill="none" stroke={running?"#7c6df0":"rgba(124,109,240,.38)"} strokeWidth={7} strokeLinecap="round"
              strokeDasharray={circum} strokeDashoffset={circum*(1-progress)}
              style={{ transition:"stroke-dashoffset 1s linear, stroke .3s" }} />
          </svg>
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:"2.2rem", fontWeight:700, lineHeight:1 }}>{fmtTimer(secs)}</div>
            <div style={{ fontSize:".68rem", color:"rgba(255,255,255,.32)", marginTop:4 }}>of {task.estimatedMinutes}m goal</div>
          </div>
        </div>
        {running && <p className="nudge-text" key={nudgeIdx} style={{ marginTop:14 }}>"{nudge}"</p>}
        {!running && secs > 0 && (
          <p style={{ marginTop:14, fontSize:".78rem", color:"rgba(255,255,255,.32)" }}>Paused — {fmtTimer(secs)} focused so far</p>
        )}
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:11, justifyContent:"center", marginBottom:"2.5rem" }}>
        <button className="btn-primary" style={{ minWidth:140, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }} onClick={() => setRunning(r => !r)}>
          {running ? "⏸  Pause" : secs > 0 ? "▶  Resume" : "▶  Start"}
        </button>
        <button className="btn-success" style={{ minWidth:110 }} onClick={() => { setRunning(false); onMarkDone(task.id); setView("tasks"); }}>✓  Done!</button>
        {secs > 0 && <button className="btn-ghost" onClick={() => { setRunning(false); setSecs(0); }} style={{ fontSize:".78rem" }}>↺</button>}
      </div>

      {/* Coach note */}
      {task.coachNote && (
        <div className="coach-bubble" style={{ marginBottom:"1.5rem" }}>💬 {task.coachNote}</div>
      )}

      {/* Pomodoro Widget */}
      <PomodoroWidget focusLabel={task.title} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HABITS VIEW
// ═══════════════════════════════════════════════════════════════════════════

function HabitsView({ habits, setHabits, habitLog, setHabitLog }) {
  const [newName, setNewName] = useState("");
  const today = todayKey();

  const addHabit = () => {
    const n = newName.trim();
    if (!n) return;
    setHabits(h => [...h, { id:uid(), name:n, createdAt:Date.now() }]);
    setNewName("");
  };

  const toggleToday = (id) => {
    setHabitLog(prev => {
      const key = `${id}::${today}`;
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = Date.now();
      return next;
    });
  };

  const removeHabit = (id) => {
    if (!window.confirm("Remove this habit?")) return;
    setHabits(h => h.filter(x => x.id !== id));
    setHabitLog(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.startsWith(id+"::")) delete next[k]; });
      return next;
    });
  };

  const getStreak = (id) => {
    let streak = 0; const d = new Date();
    for (let i = 0; i < 365; i++) {
      const k = `${id}::${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (habitLog[k]) streak++;
      else if (i > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  };

  const getLast7 = (id) => Array.from({ length:7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const k = `${id}::${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return { done:!!habitLog[k], label:d.toLocaleDateString([],{weekday:"short"})[0] };
  });

  const completedToday = habits.filter(h => habitLog[`${h.id}::${today}`]).length;

  return (
    <div style={{ maxWidth:660, margin:"0 auto" }} className="fade-in">
      <div style={{ marginBottom:"1.8rem" }}>
        <h2 className="section-title">Habit Tracker</h2>
        <p className="section-sub">{completedToday} of {habits.length} done today</p>
      </div>

      <div style={{ display:"flex", gap:9, marginBottom:"1.4rem" }}>
        <input className="np-input" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key==="Enter"&&addHabit()} placeholder="Add a new habit…" />
        <button className="btn-primary" style={{ padding:"10px 18px" }} onClick={addHabit}>Add</button>
      </div>

      {habits.length > 0 && (
        <div style={{ marginBottom:"1.4rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7, fontSize:".72rem", color:"rgba(255,255,255,.4)" }}>
            <span>Today's progress</span>
            <span style={{ color:completedToday===habits.length&&habits.length>0?"#69db7c":"rgba(255,255,255,.4)" }}>
              {completedToday===habits.length&&habits.length>0 ? "🎉 All done!" : `${completedToday}/${habits.length}`}
            </span>
          </div>
          <ProgressBar value={completedToday} max={habits.length} />
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {habits.length === 0 && (
          <div style={{ textAlign:"center", padding:"2.5rem 1rem", color:"rgba(255,255,255,.28)", fontSize:".88rem" }}>
            <div style={{ fontSize:"2rem", marginBottom:10, opacity:.4 }}>🔥</div>
            No habits yet. Add one above to start tracking your streak.
          </div>
        )}
        {habits.map((h, i) => {
          const done   = !!habitLog[`${h.id}::${today}`];
          const streak = getStreak(h.id);
          const last7  = getLast7(h.id);
          return (
            <div key={h.id} style={{ background:"rgba(255,255,255,.025)", border:`1px solid ${done?"rgba(105,219,124,.2)":"rgba(255,255,255,.07)"}`, borderRadius:14, padding:"13px 15px", display:"flex", alignItems:"center", gap:12, animation:`fadeUp .3s ease ${i*0.05}s both`, transition:"border-color .2s" }}>
              <button onClick={() => toggleToday(h.id)}
                style={{ width:36, height:36, borderRadius:10, flexShrink:0, border:`1.5px solid ${done?"#69db7c":"rgba(255,255,255,.18)"}`, background:done?"rgba(105,219,124,.18)":"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#69db7c", fontSize:"1.1rem", transition:"all .15s" }}>
                {done ? "✓" : ""}
              </button>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:".9rem", color:done?"rgba(255,255,255,.5)":"#e2e2ee", textDecoration:done?"line-through":"none" }}>{h.name}</div>
                {streak > 0 && <div style={{ fontSize:".68rem", color:"#ffa94d", marginTop:2 }}>🔥 {streak} day streak</div>}
              </div>
              <div style={{ display:"flex", gap:4, alignItems:"center", flexShrink:0 }}>
                {last7.map((day, di) => (
                  <div key={di} title={day.label} style={{ width:7, height:7, borderRadius:"50%", background:day.done?"#7c6df0":"rgba(255,255,255,.1)", transition:"background .2s" }} />
                ))}
              </div>
              <button className="btn-danger" style={{ padding:"5px 10px", fontSize:".7rem", flexShrink:0 }} onClick={() => removeHabit(h.id)}>✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// JOURNAL VIEW
// ═══════════════════════════════════════════════════════════════════════════

const JOURNAL_PROMPTS = [
  "What's the one thing that, if done, would make today a win?",
  "What am I avoiding right now — and what's the smallest possible step?",
  "How is my energy? What do I need to protect it?",
  "What worked today? What didn't, and what would I change?",
  "What am I procrastinating on, and why, really?",
  "If my future self could give me advice right now, what would they say?",
  "What's one thing I'm proud of completing recently?",
  "What's draining my mental energy the most right now?",
  "What does 'done enough' look like for today?",
];

function JournalView({ entries, setEntries }) {
  const [text,   setText]   = useState("");
  const [mood,   setMood]   = useState(null);
  const [prompt, setPrompt] = useState(() => JOURNAL_PROMPTS[Math.floor(Math.random()*JOURNAL_PROMPTS.length)]);

  const save = () => {
    const t = text.trim();
    if (!t) return;
    setEntries(prev => [{ id:uid(), text:t, mood, date:new Date().toISOString() }, ...prev]);
    setText(""); setMood(null);
    setPrompt(JOURNAL_PROMPTS[Math.floor(Math.random()*JOURNAL_PROMPTS.length)]);
  };

  const MOODS = [["😄","great"],["🙂","okay"],["😐","meh"],["😟","tough"],["😵","overwhelmed"]];

  return (
    <div style={{ maxWidth:660, margin:"0 auto" }} className="fade-in">
      <div style={{ marginBottom:"1.8rem" }}>
        <h2 className="section-title">Reflection Journal</h2>
        <p className="section-sub">Short honest reflections — build self-awareness over time</p>
      </div>

      <div style={{ background:"rgba(124,109,240,.07)", border:"1px solid rgba(124,109,240,.16)", borderRadius:14, padding:"14px 18px", marginBottom:16 }}>
        <div style={{ fontSize:".6rem", color:"#b8aefc", letterSpacing:".06em", textTransform:"uppercase", marginBottom:5 }}>Today's Prompt</div>
        <p style={{ fontSize:".9rem", color:"rgba(255,255,255,.7)", lineHeight:1.55, fontStyle:"italic" }}>"{prompt}"</p>
        <button onClick={() => setPrompt(JOURNAL_PROMPTS[Math.floor(Math.random()*JOURNAL_PROMPTS.length)])} style={{ marginTop:8, background:"none", border:"none", color:"rgba(255,255,255,.3)", fontSize:".7rem", cursor:"pointer", padding:0 }}>↻ Different prompt</button>
      </div>

      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:12 }}>
        <span style={{ fontSize:".72rem", color:"rgba(255,255,255,.35)", flexShrink:0 }}>Feeling:</span>
        {MOODS.map(([icon,label]) => (
          <button key={label} onClick={() => setMood(label)} title={label}
            style={{ fontSize:"1.3rem", width:38, height:38, borderRadius:"50%", border:`1px solid ${mood===label?"rgba(124,109,240,.5)":"rgba(255,255,255,.08)"}`, background:mood===label?"rgba(124,109,240,.18)":"rgba(255,255,255,.04)", cursor:"pointer", transition:"all .14s" }}>
            {icon}
          </button>
        ))}
      </div>

      <textarea className="np-textarea" style={{ minHeight:140, marginBottom:12 }} value={text} onChange={e => setText(e.target.value)} placeholder="Write freely — stream of consciousness is fine. This is just for you." />
      <div style={{ display:"flex", justifyContent:"flex-end" }}>
        <button className="btn-primary" disabled={!text.trim()} onClick={save}>Save Entry</button>
      </div>

      {entries.length > 0 && (
        <div style={{ marginTop:"2rem" }}>
          <div style={{ fontSize:".6rem", color:"rgba(255,255,255,.25)", letterSpacing:".07em", textTransform:"uppercase", marginBottom:12 }}>Past Entries</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {entries.map((e, i) => (
              <div key={e.id} className="card" style={{ padding:"14px 16px", animation:`fadeUp .3s ease ${i*0.04}s both` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <span style={{ fontSize:".68rem", color:"rgba(255,255,255,.32)" }}>
                    {new Date(e.date).toLocaleDateString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                  </span>
                  {e.mood && (
                    <span style={{ fontSize:".75rem", color:"rgba(255,255,255,.35)" }}>
                      {MOODS.find(m => m[1]===e.mood)?.[0]||""} {e.mood}
                    </span>
                  )}
                </div>
                <p style={{ fontSize:".84rem", color:"rgba(255,255,255,.6)", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{e.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS VIEW
// ═══════════════════════════════════════════════════════════════════════════

function SettingsView({ tasks, habits, entries, onClearAll }) {
  const [notifPerm, setNotifPerm] = useState(() => typeof Notification!=="undefined" ? Notification.permission : "denied");
  const reqNotif = async () => {
    if (typeof Notification==="undefined") return;
    const p = await Notification.requestPermission();
    setNotifPerm(p);
  };

  return (
    <div style={{ maxWidth:580, margin:"0 auto" }} className="fade-in">
      <div style={{ marginBottom:"1.8rem" }}>
        <h2 className="section-title">Settings</h2>
        <p className="section-sub">Preferences, data, and notifications</p>
      </div>

      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:".62rem", color:"rgba(255,255,255,.3)", letterSpacing:".07em", textTransform:"uppercase", marginBottom:12 }}>Your Data</div>
        {[["Tasks saved",tasks.length],["Habits tracked",habits.length],["Journal entries",entries.length],["Storage","Browser only — never leaves device"]].map(([l,v]) => (
          <div key={l} className="info-row">
            <span style={{ fontSize:".78rem", color:"rgba(255,255,255,.4)" }}>{l}</span>
            <span style={{ fontSize:".82rem", fontWeight:600 }}>{v}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:".62rem", color:"rgba(255,255,255,.3)", letterSpacing:".07em", textTransform:"uppercase", marginBottom:12 }}>Notifications</div>
        <div className="info-row">
          <span style={{ fontSize:".78rem", color:"rgba(255,255,255,.4)" }}>Permission</span>
          <span style={{ fontSize:".82rem", fontWeight:600, color:notifPerm==="granted"?"#69db7c":"#ffa94d" }}>{notifPerm}</span>
        </div>
        {notifPerm !== "granted" && (
          <button className="btn-primary" style={{ marginTop:12, fontSize:".82rem", padding:"9px 18px" }} onClick={reqNotif}>Enable Notifications</button>
        )}
      </div>

      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:".62rem", color:"rgba(255,255,255,.3)", letterSpacing:".07em", textTransform:"uppercase", marginBottom:12 }}>About NeuroPilot AI</div>
        <p style={{ fontSize:".84rem", color:"rgba(255,255,255,.42)", lineHeight:1.65 }}>
          NeuroPilot uses Claude AI (Sonnet 4) to transform chaotic brain dumps into structured, prioritized action plans with emotion detection, deadline extraction, coach notes, and next-action coaching. All data is stored locally in your browser only. Voice input uses your browser's on-device speech recognition engine.
        </p>
      </div>

      <div className="card" style={{ borderColor:"rgba(255,107,107,.2)" }}>
        <div style={{ fontSize:".62rem", color:"rgba(255,107,107,.6)", letterSpacing:".07em", textTransform:"uppercase", marginBottom:12 }}>Danger Zone</div>
        <p style={{ fontSize:".8rem", color:"rgba(255,255,255,.38)", marginBottom:14 }}>Clears all tasks, habits, journal entries, and brain dump history. This cannot be undone.</p>
        <button className="btn-danger" onClick={() => { if(window.confirm("Clear ALL data? This cannot be undone.")) onClearAll(); }}>Clear All Data</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════

export default function App() {
  const stored = loadStore();

  const [view,         setView]      = useState("dump");
  const [brainDump,    setBrainDump] = useState("");
  const [interim,      setInterim]   = useState("");
  const [isListening,  setListening] = useState(false);
  const [isProcessing, setProcess]   = useState(false);
  const [stage,        setStage]     = useState("");
  const [error,        setError]     = useState(null);
  const [aiResult,     setAiResult]  = useState(null);
  const [tasks,        setTasks]     = useState(() => stored.tasks || []);
  const [completedIds, setCompleted] = useState(() => new Set(stored.completedIds || []));
  const [postponedIds, setPostponed] = useState(() => new Set(stored.postponedIds || []));
  const [focusTaskId,  setFocusTask] = useState(null);
  const [habits,       setHabits]    = useState(() => stored.habits || []);
  const [habitLog,     setHabitLog]  = useState(() => stored.habitLog || {});
  const [journal,      setJournal]   = useState(() => stored.journal || []);

  const recRef   = useRef(null);
  const speechOk = !!(window?.SpeechRecognition || window?.webkitSpeechRecognition);
  const focusTask    = tasks.find(t => t.id === focusTaskId) || null;
  const activeTasks  = tasks.filter(t => !completedIds.has(t.id) && !postponedIds.has(t.id));
  const liveText     = brainDump + (isListening && interim ? (brainDump && !/\s$/.test(brainDump) ? " " : "") + interim : "");

  const maxStreak = useMemo(() => {
    if (!habits.length) return 0;
    return Math.max(0, ...habits.map(h => {
      let s = 0; const d = new Date();
      for (let i = 0; i < 365; i++) {
        if (habitLog[`${h.id}::${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`]) s++;
        else if (i > 0) break;
        d.setDate(d.getDate() - 1);
      }
      return s;
    }));
  }, [habits, habitLog]);

  // Persist on change
  useEffect(() => {
    saveStore({ tasks, completedIds:[...completedIds], postponedIds:[...postponedIds], habits, habitLog, journal });
  }, [tasks, completedIds, postponedIds, habits, habitLog, journal]);

  // Speech recognition setup
  useEffect(() => {
    if (!speechOk) return;
    const rec = getSR();
    if (!rec) return;
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    rec.onresult = e => {
      let fin = "", itr = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0]?.transcript ?? "";
        if (e.results[i].isFinal) fin += t; else itr += t;
      }
      if (fin) { setBrainDump(p => p + (p && !/\s$/.test(p) ? " " : "") + fin); setInterim(itr); }
      else setInterim(itr);
    };
    rec.onerror = e => {
      if (e.error !== "aborted" && e.error !== "no-speech") setError("Mic error: " + e.error);
      setListening(false);
    };
    rec.onend = () => { setListening(false); setInterim(""); };
    recRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
  }, []);

  const toggleMic = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    if (isListening) { try { rec.stop(); } catch {} setListening(false); }
    else { try { rec.start(); setListening(true); } catch {} }
  }, [isListening]);

  const process = useCallback(async () => {
    const text = liveText.trim();
    if (!text || isProcessing) return;
    setProcess(true); setError(null);
    try {
      setStage("Reading your thoughts…"); await new Promise(r => setTimeout(r, 300));
      setStage("Detecting urgency & emotions…");
      const result = await processWithAI(text);
      setStage("Building your action plan…"); await new Promise(r => setTimeout(r, 200));
      const ORDER = { critical:0, high:1, medium:2, low:3 };
      const sorted = [...result.tasks].sort((a,b) => (ORDER[a.priority]??3)-(ORDER[b.priority]??3));
      setAiResult({ ...result, tasks:sorted });
      setTasks(sorted);
      setCompleted(new Set());
      setPostponed(new Set());
      setView("tasks");
    } catch(e) {
      setError("AI error: " + e.message + " — check your connection and try again.");
    } finally {
      setProcess(false); setStage("");
    }
  }, [liveText, isProcessing]);

  const enterFocus = useCallback((taskId) => {
    setFocusTask(taskId);
    setView("focus");
  }, []);

  const markDone = useCallback((taskId) => {
    setCompleted(prev => new Set([...prev, taskId]));
    if (focusTaskId === taskId) setFocusTask(null);
  }, [focusTaskId]);

  const togglePostpone = useCallback((taskId) => {
    setPostponed(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const clearAll = () => {
    setTasks([]); setCompleted(new Set()); setPostponed(new Set());
    setHabits([]); setHabitLog({}); setJournal([]);
    setBrainDump(""); setAiResult(null); setFocusTask(null);
    saveStore({});
    setView("dump");
  };

  const nav = useCallback((v) => {
    if (v === "focus" && !focusTask) { setView("tasks"); return; }
    setView(v);
  }, [focusTask]);

  return (
    <div style={{ minHeight:"100vh", background:"#080911", color:"#e2e2ee", fontFamily:"'Figtree',system-ui,sans-serif" }}>
      <style>{CSS}</style>
      {/* Ambient glow */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, background:"radial-gradient(ellipse 55% 50% at 10% 8%,rgba(124,109,240,.08),transparent),radial-gradient(ellipse 45% 55% at 88% 92%,rgba(82,100,240,.06),transparent)" }} />
      <div style={{ position:"relative", zIndex:1, display:"flex", minHeight:"100vh" }}>
        <Sidebar
          view={view}
          setView={nav}
          aiResult={aiResult}
          activeTasks={activeTasks}
          doneCount={completedIds.size}
          habitStreak={maxStreak}
        />
        <main style={{ flex:1, padding:"clamp(1.4rem,2.8vw,2.4rem)", overflowY:"auto", maxHeight:"100vh" }}>
          {view==="dump"     && <DumpView liveText={liveText} setBrainDump={setBrainDump} isListening={isListening} speechOk={speechOk} toggleMic={toggleMic} isProcessing={isProcessing} stage={stage} process={process} error={error} />}
          {view==="tasks"    && <TasksView tasks={tasks} activeTasks={activeTasks} aiResult={aiResult} completedIds={completedIds} postponedIds={postponedIds} onMarkDone={markDone} onPostpone={togglePostpone} onFocus={enterFocus} setView={setView} />}
          {view==="focus"    && <FocusView task={focusTask} aiResult={aiResult} allTasks={activeTasks} onMarkDone={markDone} setView={setView} />}
          {view==="habits"   && <HabitsView habits={habits} setHabits={setHabits} habitLog={habitLog} setHabitLog={setHabitLog} />}
          {view==="journal"  && <JournalView entries={journal} setEntries={setJournal} />}
          {view==="settings" && <SettingsView tasks={tasks} habits={habits} entries={journal} onClearAll={clearAll} />}
        </main>
      </div>
    </div>
  );
}
