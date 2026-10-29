
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const $ = id => document.getElementById(id);

const scoreDisplay = $("score");
const levelDisplay = $("level");
const bestDisplay = $("best-score");
const overlay = $("overlay");
const overlayTitle = $("overlay-title");
const overlayMessage = $("overlay-message");
const overlayEyebrow = $("overlay-eyebrow");
const menuSymbol = $("menu-symbol");
const menuHint = $("menu-hint");
const startButton = $("start-button");
const pauseButton = $("pause-button");
const settingsButton = $("settings-button");
const settingsPanel = $("settings-panel");
const settingsBack = $("settings-back");
const sfxSetting = $("sfx-setting");
const musicSetting = $("music-setting");
const soundToggle = $("sound-toggle");
const gameStatus = $("game-status");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

let player;
let obstacles = [];
let score = 0;
let level = 1;
let best = loadBestScore();
let bestAtStart = best;

let running = false;
let paused = false;
let screen = "menu";
let animationId = null;
let lastTime = 0;
let spawnTimer = 0;
let levelUpTimer = 0;
let levelUpText = "";
let elapsedTime = 0;

const keys = { left: false, right: false };

const defaultSettings = { sfx: true, music: false };
let settings = loadSettings();

let audioContext = null;
let musicNodes = null;
let musicTimer = null;
let musicNote = 0;

function loadBestScore() {
    try {
        return Number(localStorage.getItem("neonDodgeBest")) || 0;
    } catch {
        return 0;
    }
}

function loadSettings() {
    try {
        const saved = JSON.parse(
            localStorage.getItem("neonDodgeSettings")
        );

        return {
            sfx: typeof saved?.sfx === "boolean"
                ? saved.sfx : defaultSettings.sfx,
            music: typeof saved?.music === "boolean"
                ? saved.music : defaultSettings.music
        };
    } catch {
        return { ...defaultSettings };
    }
}

function saveSettings() {
    try {
        localStorage.setItem(
            "neonDodgeSettings",
            JSON.stringify(settings)
        );
    } catch {
        // Settings still work for the current session.
    }
}

function saveBestScore() {
    try {
        localStorage.setItem("neonDodgeBest", String(best));
    } catch {
        // The game can still run if storage is unavailable.
    }
}

// ---------- SOUND SYSTEM ----------

function getAudio() {
    try {
        const AudioClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioClass) return null;

        if (!audioContext) {
            audioContext = new AudioClass();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume().catch(() => { });
        }

        return audioContext;
    } catch {
        return null;
    }
}

function playTone(frequency, duration, type = "sine", volume = 0.06) {
    if (!settings.sfx) return;

    const audio = getAudio();
    if (!audio) return;

    try {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const now = audio.currentTime;

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + duration
        );

        oscillator.connect(gain);
        gain.connect(audio.destination);

        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
    } catch {
        // Sound is optional; gameplay should never depend on it.
    }
}

function playLevelSound() {
    playTone(520, 0.12, "sine", 0.055);
    playTone(780, 0.2, "sine", 0.045);
}

function playGameOverSound() {
    playTone(330, 0.18, "triangle", 0.05);
    playTone(220, 0.3, "triangle", 0.05);
}

function startMusic() {
    stopMusic();

    if (!settings.music) return;

    const audio = getAudio();
    if (!audio) return;

    try {
        const master = audio.createGain();
        master.gain.value = 0.025;
        master.connect(audio.destination);

        const oscillator = audio.createOscillator();
        const noteGain = audio.createGain();

        oscillator.type = "sine";
        noteGain.gain.value = 0.45;
        oscillator.connect(noteGain);
        noteGain.connect(master);
        oscillator.start();

        musicNodes = { oscillator, noteGain, master };
        musicNote = 0;

        const notes = [110, 164.81, 130.81, 196];

        musicTimer = setInterval(() => {
            if (!musicNodes || !audioContext) return;

            const current = musicNodes.oscillator.frequency;
            current.setTargetAtTime(
                notes[musicNote % notes.length],
                audioContext.currentTime,
                0.12
            );

            musicNote++;
        }, 650);
    } catch {
        stopMusic();
    }
}

function stopMusic() {
    if (musicTimer !== null) {
        clearInterval(musicTimer);
        musicTimer = null;
    }

    if (musicNodes) {
        try {
            musicNodes.oscillator.stop();
            musicNodes.master.disconnect();
        } catch {
            // Nodes may already have stopped.
        }

        musicNodes = null;
    }
}

function syncSoundUI() {
    sfxSetting.checked = settings.sfx;
    musicSetting.checked = settings.music;

    soundToggle.textContent =
        settings.sfx || settings.music
            ? "🔊 SOUND ON"
            : "🔇 SOUND OFF";

    soundToggle.setAttribute(
        "aria-pressed",
        String(settings.sfx || settings.music)
    );
}

function setMusicEnabled(enabled) {
    settings.music = enabled;
    saveSettings();
    syncSoundUI();

    if (enabled) {
        startMusic();
    } else {
        stopMusic();
    }
}

// ---------- GAME SETUP ----------

function resetGame() {
    player = {
        x: WIDTH / 2 - 17,
        y: HEIGHT - 65,
        width: 34,
        height: 34,
        speed: 340
    };

    obstacles = [];
    score = 0;
    level = 1;
    spawnTimer = 0;
    lastTime = 0;
    levelUpTimer = 0;
    levelUpText = "";
    elapsedTime = 0;

    scoreDisplay.textContent = "0";
    levelDisplay.textContent = "1";
    bestDisplay.textContent = best;
}

function setStatus(text) {
    gameStatus.innerHTML =
        '<span class="status-dot"></span> ' + text;
}

function showOverlay() {
    overlay.classList.remove("hidden");
}

function hideOverlay() {
    overlay.classList.add("hidden");
    settingsPanel.hidden = true;
    startButton.hidden = false;
    settingsButton.hidden = false;
    menuHint.hidden = false;
}

function setMenuContent({
    symbol, eyebrow, title, message,
    button, hint, status
}) {
    menuSymbol.textContent = symbol;
    overlayEyebrow.textContent = eyebrow;
    overlayTitle.textContent = title;
    overlayMessage.textContent = message;
    startButton.textContent = button;
    menuHint.textContent = hint;
    setStatus(status);
}

function showMainMenu() {
    running = false;
    paused = false;
    screen = "menu";

    stopMusic();

    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    pauseButton.hidden = true;
    hideOverlay();

    setMenuContent({
        symbol: "✦",
        eyebrow: "READY PLAYER ONE",
        title: "ENTER THE ARCADE",
        message: "Dodge the falling blocks, level up, and chase a new high score.",
        button: "▶ START GAME",
        hint: "MOVE WITH ← → OR A / D",
        status: "ARCADE READY"
    });

    showOverlay();
}

function startGame() {
    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    resetGame();

    running = true;
    paused = false;
    screen = "playing";

    pauseButton.hidden = false;
    pauseButton.textContent = "Ⅱ PAUSE";
    bestAtStart = best;

    hideOverlay();
    setStatus("GAME IN PROGRESS");

    if (settings.music) startMusic();

    animationId = requestAnimationFrame(gameLoop);
}

function pauseGame() {
    if (!running) return;

    running = false;
    paused = true;
    screen = "paused";
    lastTime = 0;

    keys.left = false;
    keys.right = false;

    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    stopMusic();

    pauseButton.textContent = "▶ RESUME";

    setMenuContent({
        symbol: "Ⅱ",
        eyebrow: "TAKE A BREATHER",
        title: "GAME PAUSED",
        message: `Score: ${Math.floor(score)} · Level: ${level}. Ready when you are.`,
        button: "▶ RESUME GAME",
        hint: "PRESS P TO RESUME",
        status: "GAME PAUSED"
    });

    settingsButton.hidden = true;
    showOverlay();
}

function resumeGame() {
    if (!paused) return;

    running = true;
    paused = false;
    screen = "playing";
    lastTime = 0;

    pauseButton.textContent = "Ⅱ PAUSE";
    hideOverlay();
    setStatus("GAME IN PROGRESS");

    if (settings.music) startMusic();

    animationId = requestAnimationFrame(gameLoop);
}

function togglePause() {
    if (running) {
        pauseGame();
    } else if (paused) {
        resumeGame();
    }
}

function endGame() {
    running = false;
    paused = false;
    screen = "gameover";

    keys.left = false;
    keys.right = false;

    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    stopMusic();
    playGameOverSound();

    const finalScore = Math.floor(score);
    const isNewBest = finalScore > bestAtStart;

    if (isNewBest) {
        best = finalScore;
        saveBestScore();
    }

    bestDisplay.textContent = best;
    pauseButton.hidden = true;

    menuSymbol.textContent = isNewBest ? "🏆" : "✦";
    overlayEyebrow.textContent = isNewBest
        ? "NEW PERSONAL BEST!"
        : "RUN COMPLETE";

    overlayTitle.textContent = "GAME OVER";
    overlayMessage.textContent =
        `Score: ${finalScore} · Level: ${level} · Best: ${best}` +
        (isNewBest ? " — Amazing run!" : " — Ready for another run?");

    startButton.textContent = "↻ PLAY AGAIN";
    menuHint.textContent = "TIP: KEEP MOVING TO SURVIVE";
    settingsButton.hidden = false;

    showOverlay();
    setStatus("RUN COMPLETE");
}

// ---------- LEVELS AND OBSTACLES ----------

function spawnObstacle() {
    const size = 22 + Math.random() * 25;

    const speed =
        (180 + Math.random() * 100) *
        (1 + (level - 1) * 0.18);

    obstacles.push({
        x: Math.random() * (WIDTH - size),
        y: -size,
        width: size,
        height: size,
        speed
    });
}

function collides(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function update(deltaTime) {
    const seconds = deltaTime / 1000;

    if (keys.left) player.x -= player.speed * seconds;
    if (keys.right) player.x += player.speed * seconds;

    player.x = Math.max(
        0,
        Math.min(WIDTH - player.width, player.x)
    );

    score += seconds * 10;
    elapsedTime += seconds;
    scoreDisplay.textContent = Math.floor(score);

    const newLevel = Math.floor(score / 100) + 1;

    if (newLevel > level) {
        level = newLevel;
        levelDisplay.textContent = level;
        levelUpTimer = 1.8;
        levelUpText = `LEVEL ${level}!`;
        playLevelSound();
    }

    if (levelUpTimer > 0) {
        levelUpTimer -= seconds;
    }

    const spawnInterval = Math.max(
        260,
        850 - (level - 1) * 70
    );

    spawnTimer += deltaTime;

    if (spawnTimer >= spawnInterval) {
        spawnObstacle();
        spawnTimer = 0;
    }

    for (const obstacle of obstacles) {
        obstacle.y += obstacle.speed * seconds;

        if (collides(player, obstacle)) {
            endGame();
            return;
        }
    }

    obstacles = obstacles.filter(
        obstacle => obstacle.y < HEIGHT + obstacle.height
    );

    if (Math.floor(score) > best) {
        best = Math.floor(score);
        bestDisplay.textContent = best;
        saveBestScore();
    }
}

// ---------- DRAWING ----------

function drawBackground() {
    ctx.fillStyle = "#080d1b";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = "#152441";
    ctx.lineWidth = 1;

    for (let x = 0; x <= WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
    }

    for (let y = 0; y <= HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
    }

    // Subtle neon floor line.
    ctx.strokeStyle = "#00f5ff25";
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT - 15);
    ctx.lineTo(WIDTH, HEIGHT - 15);
    ctx.stroke();
}

function drawPlayer() {
    ctx.save();
    ctx.shadowBlur = 22;
    ctx.shadowColor = "#00f5ff";
    ctx.fillStyle = "#00f5ff";

    ctx.fillRect(
        player.x, player.y,
        player.width, player.height
    );

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#12304a";

    ctx.fillRect(
        player.x + 8, player.y + 8,
        player.width - 16, player.height - 16
    );

    ctx.restore();
}

function drawObstacles() {
    for (const obstacle of obstacles) {
        ctx.save();
        ctx.shadowBlur = 16;
        ctx.shadowColor = "#ff367c";
        ctx.fillStyle = "#ff367c";

        ctx.fillRect(
            obstacle.x, obstacle.y,
            obstacle.width, obstacle.height
        );

        ctx.restore();
    }
}

function drawLevelAnnouncement() {
    if (levelUpTimer <= 0) return;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 42px Segoe UI, Arial";
    ctx.shadowBlur = 24;
    ctx.shadowColor = "#00f5ff";
    ctx.fillStyle = "#00f5ff";

    ctx.fillText(levelUpText, WIDTH / 2, HEIGHT / 2);

    ctx.restore();
}

function draw() {
    drawBackground();
    drawPlayer();
    drawObstacles();
    drawLevelAnnouncement();
}

function gameLoop(timestamp) {
    if (!running) {
        animationId = null;
        return;
    }

    if (lastTime === 0) lastTime = timestamp;

    const deltaTime = Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;

    update(deltaTime);
    draw();

    if (running) {
        animationId = requestAnimationFrame(gameLoop);
    } else {
        animationId = null;
    }
}

// ---------- SETTINGS AND CONTROLS ----------

function openSettings() {
    const previousScreen = screen;
    screen = "settings";

    overlayTitle.textContent = "SETTINGS";
    overlayEyebrow.textContent = "MAKE IT YOURS";
    overlayMessage.textContent = "Choose your arcade sound preferences.";
    menuSymbol.textContent = "⚙";
    menuHint.hidden = true;

    startButton.hidden = true;
    settingsButton.hidden = true;
    settingsPanel.hidden = false;

    settingsBack.textContent =
        previousScreen === "paused" ? "← BACK TO PAUSE" : "← BACK";

    showOverlay();
}

function closeSettings() {
    settingsPanel.hidden = true;

    if (paused) {
        screen = "paused";

        setMenuContent({
            symbol: "Ⅱ",
            eyebrow: "TAKE A BREATHER",
            title: "GAME PAUSED",
            message: `Score: ${Math.floor(score)} · Level: ${level}. Ready when you are.`,
            button: "▶ RESUME GAME",
            hint: "PRESS P TO RESUME",
            status: "GAME PAUSED"
        });

        settingsButton.hidden = true;
        showOverlay();
        return;
    }

    screen = "menu";
    showMainMenu();
}

startButton.addEventListener("click", () => {
    if (screen === "paused") {
        resumeGame();
    } else {
        startGame();
    }
});

pauseButton.addEventListener("click", togglePause);

settingsButton.addEventListener("click", openSettings);
settingsBack.addEventListener("click", closeSettings);

sfxSetting.addEventListener("change", () => {
    settings.sfx = sfxSetting.checked;
    saveSettings();
    syncSoundUI();

    if (settings.sfx) playTone(660, 0.12);
});

musicSetting.addEventListener("change", () => {
    setMusicEnabled(musicSetting.checked);
});

soundToggle.addEventListener("click", () => {
    const enabled = settings.sfx || settings.music;

    if (enabled) {
        settings.sfx = false;
        setMusicEnabled(false);
        saveSettings();
        syncSoundUI();
    } else {
        settings.sfx = true;
        saveSettings();
        syncSoundUI();
        playTone(660, 0.12);
    }
});

document.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();

    if (["arrowleft", "arrowright", " "].includes(key)) {
        event.preventDefault();
    }

    if (key === "arrowleft" || key === "a") keys.left = true;
    if (key === "arrowright" || key === "d") keys.right = true;

    if (key === "p" && (running || paused)) {
        togglePause();
    }

    if (key === "escape" && screen === "settings") {
        closeSettings();
    }
});

document.addEventListener("keyup", event => {
    const key = event.key.toLowerCase();

    if (key === "arrowleft" || key === "a") keys.left = false;
    if (key === "arrowright" || key === "d") keys.right = false;
});

window.addEventListener("blur", () => {
    keys.left = false;
    keys.right = false;

    // Automatically pause if the player switches away.
    if (running) pauseGame();
});

function setupHoldButton(id, direction) {
    const button = $(id);

    button.addEventListener("pointerdown", event => {
        event.preventDefault();
        keys[direction] = true;
        button.setPointerCapture(event.pointerId);
    });

    const stopMoving = () => {
        keys[direction] = false;
    };

    button.addEventListener("pointerup", stopMoving);
    button.addEventListener("pointercancel", stopMoving);
    button.addEventListener("lostpointercapture", stopMoving);
}

setupHoldButton("left-button", "left");
setupHoldButton("right-button", "right");

// ---------- INITIAL SCREEN ----------

syncSoundUI();
resetGame();
draw();
showMainMenu();
