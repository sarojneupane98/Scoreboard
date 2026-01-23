const bell = document.getElementById("bell");

/* ================= STATE ================= */
let state = JSON.parse(localStorage.getItem("quizState")) || {
    teams: [],
    active: 0,
    time: 30,
    running: false,
    round: "",
    history: []
};

let interval;

/* ================= INIT ================= */
document.getElementById("menuBtn").onclick = () =>
    document.getElementById("sidebar").classList.toggle("open");

document.getElementById("fullscreenBtn").onclick = toggleFullscreen;

document.getElementById("teamCount").onchange = e =>
    initTeams(parseInt(e.target.value));

document.getElementById("roundInput").oninput = e => {
    state.round = e.target.value;
    save();
    render();
};

unlockAudio();

// Fix: Sync the round input value on load
document.getElementById("roundInput").value = state.round || "";

if (state.teams.length === 0) {
    initTeams(4);
} else {
    renderNames();
}
render();

/* ================= AUDIO ================= */
function unlockAudio() {
    const unlock = () => {
        bell.play().then(() => {
            bell.pause();
            bell.currentTime = 0;
            console.log("Audio successfully unlocked!");
        }).catch(e => {
            console.error("Audio unlock failed:", e);
        });
        document.removeEventListener("click", unlock);
    };
    document.addEventListener("click", unlock);
}



/* ================= TEAMS ================= */
function initTeams(count) {
    state.teams = [];
    for (let i=0;i<count;i++) {
        state.teams.push({ name:`Team ${i+1}`, score:0 });
    }
    state.active = 0;
    renderNames();
    save();
    render();
}

function renderNames() {
    const box = document.getElementById("teamNames");
    box.innerHTML = "";
    state.teams.forEach((t,i)=>{
        const input = document.createElement("input");
        input.value = t.name;
        input.oninput = e => {
            t.name = e.target.value;
            save(); render();
        };
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
    
    interval = setInterval(()=>{
        state.time--;
        if (state.time <= 0) {
    state.time = 0;
    pauseTimer();
    
    // Play the sound
    bell.currentTime = 0; 
    bell.play().catch(error => {
        console.log("Playback prevented. Ensure you clicked the page once first.");
    });
}
        save(); render();
    },1000);
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
    save(); render();
}

/* ================= SCORING ================= */
function log(action, pts) {
    state.history.unshift(
        `${state.round || "Round"} | ${state.teams[state.active].name} ${action} (${pts})`
    );
    if (state.history.length > 50) state.history.pop();
}

function addScore(pts) {
    state.teams[state.active].score += pts;
    log("scored", pts);
    save(); render();
}

function passQuestion() {
    state.active = (state.active + 1) % state.teams.length;
    startTimer(15);
    log("passed", 0);
    save(); render();
}

function nextTurn() {
    state.active = (state.active + 1) % state.teams.length;
    pauseTimer(); 
    state.time = 30;
    log("next turn", 0);
    save();
    render(); 
}

function gamble(win) {
    const v = parseInt(document.getElementById("gambleAmount").value);
    if (!v) return alert("Enter amount");
    const pts = win ? v : -(v/2);
    state.teams[state.active].score += pts;
    log(win?"gambled +":"gambled -", pts);
    save(); render();
}

/* ================= FULLSCREEN ================= */
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

/* ================= STORAGE ================= */
function save() {
    localStorage.setItem("quizState", JSON.stringify(state));
}

function resetAll() {
    if (confirm("Reset entire game?")) {
        localStorage.removeItem("quizState");
        location.reload();
    }
}

/* ================= RENDER ================= */
function render() {
    const playIcon = document.getElementById("playIcon");
    const pauseIcon = document.getElementById("pauseIcon");
    
    if (playIcon && pauseIcon) {
        if (state.running) {
            playIcon.style.display = "none";
            pauseIcon.style.display = "block";
        } else {
            playIcon.style.display = "block";
            pauseIcon.style.display = "none";
        }
    }

    document.getElementById("time").innerText = state.time;
    document.getElementById("roundTitle").innerText = "Round: " + (state.round || "-");
    document.getElementById("activeName").innerText = state.teams[state.active]?.name || "-";

    const max = Math.max(...state.teams.map(t => t.score));
    const teamsDiv = document.getElementById("teams");
    teamsDiv.innerHTML = "";

    state.teams.forEach((t, i) => {
        const d = document.createElement("div");
        d.className = "team";
        if (i === state.active) d.classList.add("active");
        if (t.score === max && max > 0) d.classList.add("leader");
        d.onclick = () => { state.active = i; save(); render(); };
        d.innerHTML = `<h3>${t.name}</h3><div class="score">${t.score}</div>`;
        teamsDiv.appendChild(d);
    });

    document.getElementById("historyList").innerHTML =
        state.history.map(h => `<li>${h}</li>`).join("");
}
