const bell = document.getElementById("bell");
let interval;

/* ================= STATE ================= */
let state = JSON.parse(localStorage.getItem("quizState")) || {
    teams: [],
    active: 0,
    time: 30,
    running: false,
    round: "",
    history: []
};

/* ================= INIT ================= */
document.getElementById("menuBtn").onclick = () => document.getElementById("sidebar").classList.toggle("open");
document.getElementById("fullscreenBtn").onclick = toggleFullscreen;
document.getElementById("teamCount").onchange = e => initTeams(parseInt(e.target.value));
document.getElementById("roundInput").oninput = e => {
    state.round = e.target.value;
    save();
    render();
};

unlockAudio();
document.getElementById("roundInput").value = state.round || "";

if (state.teams.length === 0) {
    initTeams(4);
} else {
    renderNames();
}
render();

/* ================= CORE FUNCTIONS ================= */
function unlockAudio() {
    const unlock = () => {
        bell.play().then(() => {
            bell.pause();
            bell.currentTime = 0;
        }).catch(e => console.log("Audio unlock interaction required"));
        document.removeEventListener("click", unlock);
    };
    document.addEventListener("click", unlock);
}

function initTeams(count) {
    state.teams = Array.from({length: count}, (_, i) => ({ name: `Team ${i + 1}`, score: 0 }));
    state.active = 0;
    renderNames();
    save();
    render();
}

function renderNames() {
    const box = document.getElementById("teamNames");
    box.innerHTML = "";
    state.teams.forEach((t, i) => {
        const input = document.createElement("input");
        input.value = t.name;
        input.oninput = e => { t.name = e.target.value; save(); render(); };
        box.appendChild(input);
    });
}

/* ================= TIMER ================= */
function toggleTimer() {
    state.running ? pauseTimer() : startTimer(state.time);
}

function startTimer(sec) {
    clearInterval(interval);
    state.time = sec;
    state.running = true;
    render();
    
    interval = setInterval(() => {
        state.time--;
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
    pauseTimer();
    state.time = 30;
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
    state.teams[state.active].score += pts;
    log("Earned", pts);
    save();
    render();
}

function passQuestion() {
    state.active = (state.active + 1) % state.teams.length;
    startTimer(15);
    save();
    render();
}

function nextTurn() {
    state.active = (state.active + 1) % state.teams.length;
    pauseTimer();
    state.time = 30;
    save();
    render();
}

function gamble(win) {
    const v = parseInt(document.getElementById("gambleAmount").value) || 0;
    if (!v) return alert("Enter amount");
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
        state.history = [];
        save();
        render();
    }
}

/* ================= RENDER ================= */
function render() {
    // Icons
    const playIcon = document.getElementById("playIcon");
    const pauseIcon = document.getElementById("pauseIcon");
    if (playIcon && pauseIcon) {
        playIcon.style.display = state.running ? "none" : "block";
        pauseIcon.style.display = state.running ? "block" : "none";
    }

    // Timer
    const timeEl = document.getElementById("time");
    timeEl.innerText = state.time;
    state.running && state.time <= 5 && state.time > 0 ? 
        timeEl.classList.add("critical") : timeEl.classList.remove("critical");

    // UI Labels
    document.getElementById("roundTitle").innerText = "Round: " + (state.round || "-");
    document.getElementById("activeName").innerText = state.teams[state.active]?.name || "-";

    // Teams
    const max = Math.max(...state.teams.map(t => t.score));
    const teamsDiv = document.getElementById("teams");
    teamsDiv.innerHTML = "";

    state.teams.forEach((t, i) => {
        const d = document.createElement("div");
        d.className = `team ${i === state.active ? 'active' : ''} ${t.score === max && max > 0 ? 'leader' : ''}`;
        d.onclick = () => { state.active = i; save(); render(); };
        d.innerHTML = `<h3>${t.name}</h3><div class="score">${t.score}</div>`;
        teamsDiv.appendChild(d);
    });

    // Records
    document.getElementById("historyList").innerHTML = state.history.map(h => `<li>${h}</li>`).join("");
}
