const bell = document.getElementById("bell");
const tick = document.getElementById("tick");
let interval;

/* ================= STATE ================= */
let state = JSON.parse(localStorage.getItem("quizState")) || {
  teams: [],
  active: 0,
  time: 30,
  maxTime: 30, // Added to track initial timer length for SVG circle
  running: false,
  round: "",
  history: []
};

// Stack to hold snapshot history for UNDO
let historyStack = [];

/* ================= INIT ================= */
document.getElementById("menuBtn").onclick = () => document.getElementById("sidebar").classList.toggle("open");
document.getElementById("fullscreenBtn").onclick = toggleFullscreen;
document.getElementById("teamCount").onchange = e => initTeams(parseInt(e.target.value));

// Changed from oninput to onchange to prevent undo bloat
document.getElementById("roundInput").onchange = e => {
  pushState(); 
  state.round = e.target.value;
  save();
  render();
};

document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
  }
});

unlockAudio();
document.getElementById("roundInput").value = state.round || "";

if (state.teams.length === 0) {
  initTeams(4);
} else {
  renderNames();
}
render();

/* ================= UNDO ENGINE ================= */
function pushState() {
  historyStack.push(JSON.stringify(state));
  if (historyStack.length > 30) historyStack.shift(); 
}

function undo() {
  if (historyStack.length === 0) return;
  
  pauseTimer();
  const previousState = historyStack.pop();
  state = JSON.parse(previousState);
  
  save();
  render();
}

/* ================= CORE FUNCTIONS ================= */
function unlockAudio() {
  const unlock = () => {
    bell.play().then(() => { bell.pause(); bell.currentTime = 0; }).catch(() => {});
    tick.play().then(() => { tick.pause(); tick.currentTime = 0; }).catch(() => {});
    document.removeEventListener("click", unlock);
  };
  document.addEventListener("click", unlock);
}

function initTeams(count) {
  pushState();
  state.teams = Array.from({length: count}, (_, i) => ({ name: `Team ${i + 1}`, score: 0 }));
  state.active = 0;
  renderNames();
  save();
  render();
}

function renderNames() {
  const box = document.getElementById("teamNames");
  box.innerHTML = "";
  state.teams.forEach((t) => {
    const input = document.createElement("input");
    input.value = t.name;
    // Changed from oninput to onchange to prevent undo bloat
    input.onchange = e => { 
      pushState();
      t.name = e.target.value; 
      save(); 
      render(); 
    };
    box.appendChild(input);
  });
}

/* ================= TIMER ================= */
function toggleTimer() {
  state.running ? pauseTimer() : startTimer(state.time === 0 ? state.maxTime : state.time);
}

function startTimer(sec) {
  clearInterval(interval);
  state.time = sec;
  // Update maxTime if this is a fresh timer start (not a resume)
  if (sec === 15 || sec === 30) state.maxTime = sec; 
  state.running = true;
  render();
  
  interval = setInterval(() => {
    state.time--;
    
    // Play tick sound in the critical window
    if (state.time <= 5 && state.time > 0) {
      tick.currentTime = 0;
      tick.play().catch(() => {});
    }
    
    if (state.time <= 0) {
      state.time = 0;
      pauseTimer();
      bell.currentTime = 0;
      bell.play().catch(() => {});
    }
    save();
    render();
  }, 1000);
}

function pauseTimer() {
  clearInterval(interval);
  state.running = false;
  save();
  render();
}

function resetTimer() {
  pushState();
  pauseTimer();
  state.time = 30;
  state.maxTime = 30;
  save();
  render();
}

/* ================= SCORING ================= */
function log(action, pts) {
  const record = `[${state.round || "General"}] ${state.teams[state.active].name}: ${action} ${pts >= 0 ? '+' : ''}${pts} pts`;
  state.history.unshift(record);
  if (state.history.length > 50) state.history.pop();
}

function addScore(pts) {
  pushState();
  state.teams[state.active].score += pts;
  log("Earned", pts);
  save();
  render();
}

function passQuestion() {
  pushState();
  state.active = (state.active + 1) % state.teams.length;
  startTimer(15);
  save();
  render();
}

function nextTurn() {
  pushState(); 
  state.active = (state.active + 1) % state.teams.length;
  pauseTimer();
  state.time = 30;
  state.maxTime = 30;
  save();
  render();
}

function gamble(win) {
  // Added Math.abs() to prevent negative wagering logic errors
  const v = Math.abs(parseInt(document.getElementById("gambleAmount").value) || 0);
  if (!v) return alert("Enter amount");
  
  pushState(); 
  const pts = win ? v : -(v / 2);
  state.teams[state.active].score += pts;
  log(win ? "Gambled (Win)" : "Gambled (Loss)", pts);
  save();
  render();
}

/* ================= HELPERS ================= */
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}

function save() { localStorage.setItem("quizState", JSON.stringify(state)); }

function resetAll() {
  if (confirm("Reset entire game?")) {
    localStorage.removeItem("quizState");
    location.reload();
  }
}

function clearHistory() {
  if (confirm("Clear all scoring records?")) {
    pushState();
    state.history = [];
    save();
    render();
  }
}

/* ================= RENDER ================= */
function render() {
  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");
  if (playIcon && pauseIcon) {
    playIcon.style.display = state.running ? "none" : "block";
    pauseIcon.style.display = state.running ? "block" : "none";
  }

  // Timer & SVG Ring Logic
  const timeEl = document.getElementById("time");
  timeEl.innerText = state.time;
  
  const circle = document.querySelector('.progress-ring__circle');
  if (circle) {
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    
    // Calculate ratio (prevent dividing by 0)
    const maxT = state.maxTime || 30;
    const ratio = Math.max(0, state.time / maxT);
    const offset = circumference - ratio * circumference;
    circle.style.strokeDashoffset = offset;
    
    // Switch color during critical time
    if (state.running && state.time <= 5 && state.time > 0) {
      timeEl.classList.add("critical");
      circle.style.stroke = "var(--danger-color)";
    } else {
      timeEl.classList.remove("critical");
      circle.style.stroke = "var(--accent-cyan)";
    }
  }

  document.getElementById("roundTitle").innerText = "Round: " + (state.round || "-");
  document.getElementById("activeName").innerText = state.teams[state.active]?.name || "-";

  // Teams - XSS Mitigation (Replaced innerHTML with DOM creation)
  const max = Math.max(...state.teams.map(t => t.score));
  const teamsDiv = document.getElementById("teams");
  teamsDiv.innerHTML = "";

  state.teams.forEach((t, i) => {
    const d = document.createElement("div");
    d.className = `team ${i === state.active ? 'active' : ''} ${t.score === max && max > 0 ? 'leader' : ''}`;
    
    d.onclick = () => { 
      if (state.active !== i) {
        pushState();
        state.active = i; 
        save(); 
        render(); 
      }
    };
    
    const h3 = document.createElement("h3");
    h3.textContent = t.name;
    
    const scoreDiv = document.createElement("div");
    scoreDiv.className = "score";
    scoreDiv.textContent = t.score;
    
    d.appendChild(h3);
    d.appendChild(scoreDiv);
    teamsDiv.appendChild(d);
  });

  // Records - XSS Mitigation (Replaced innerHTML template literals)
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = "";
  state.history.forEach(h => {
    const li = document.createElement("li");
    li.textContent = h;
    historyList.appendChild(li);
  });

  const undoBtn = document.getElementById("undoBtn");
  if (undoBtn) {
    undoBtn.disabled = historyStack.length === 0;
  }
}
