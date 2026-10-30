
function updateClock() {
    const now = new Date();

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const period = hours >= 12 ? "PM" : "AM";

    hours = hours % 12 || 12;

    document.getElementById("time").textContent =
        `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`;

    document.getElementById("period").textContent = period;

    document.getElementById("date").textContent =
        new Intl.DateTimeFormat("en-KE", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(now);

    const hour = now.getHours();

    document.getElementById("greeting").textContent =
        hour < 12 ? "Good morning!" :
            hour < 18 ? "Good afternoon!" : "Good evening!";
}

updateClock();
setInterval(updateClock, 1000);


// STOPWATCH
let stopwatchRunning = false;
let stopwatchStart = 0;
let stopwatchElapsed = 0;
let stopwatchInterval = null;

const stopwatchDisplay = document.getElementById("stopwatch");
const stopwatchButton = document.getElementById("start-stopwatch");

function renderStopwatch() {
    let elapsed = stopwatchElapsed;

    if (stopwatchRunning) {
        elapsed += Date.now() - stopwatchStart;
    }

    const centiseconds = Math.floor(elapsed / 10) % 100;
    const totalSeconds = Math.floor(elapsed / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    stopwatchDisplay.textContent =
        `${String(hours).padStart(2, "0")}:` +
        `${String(minutes).padStart(2, "0")}:` +
        `${String(seconds).padStart(2, "0")}.` +
        `${String(centiseconds).padStart(2, "0")}`;
}

stopwatchButton.addEventListener("click", function () {
    if (!stopwatchRunning) {
        stopwatchStart = Date.now();
        stopwatchRunning = true;
        stopwatchButton.textContent = "Pause";

        stopwatchInterval = setInterval(renderStopwatch, 30);
    } else {
        stopwatchElapsed += Date.now() - stopwatchStart;
        stopwatchRunning = false;
        clearInterval(stopwatchInterval);
        stopwatchButton.textContent = "Resume";
        renderStopwatch();
    }
});

document.getElementById("reset-stopwatch").addEventListener("click", function () {
    stopwatchRunning = false;
    clearInterval(stopwatchInterval);
    stopwatchElapsed = 0;
    stopwatchButton.textContent = "Start";
    renderStopwatch();
});


// COUNTDOWN TIMER
let countdownInterval = null;
let countdownEnd = 0;
let remainingSeconds = 60;
let countdownRunning = false;

const minutesInput = document.getElementById("minutes");
const secondsInput = document.getElementById("seconds");
const countdownDisplay = document.getElementById("countdown");
const countdownMessage = document.getElementById("timer-message");
const countdownStartButton = document.getElementById("start-countdown");
const countdownPauseButton = document.getElementById("pause-countdown");

function readCountdownInputs() {
    const minutes = Number(minutesInput.value);
    const seconds = Number(secondsInput.value);

    if (
        minutesInput.value.trim() === "" ||
        secondsInput.value.trim() === "" ||
        !Number.isInteger(minutes) ||
        !Number.isInteger(seconds) ||
        minutes < 0 || minutes > 999 ||
        seconds < 0 || seconds > 59 ||
        minutes + seconds === 0
    ) {
        countdownMessage.textContent =
            "Enter a time above zero (seconds: 0–59).";
        return false;
    }

    remainingSeconds = minutes * 60 + seconds;
    return true;
}

function renderCountdown() {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;

    countdownDisplay.textContent =
        `${String(mins).padStart(2, "0")}:` +
        `${String(secs).padStart(2, "0")}`;
}

function stopCountdown() {
    clearInterval(countdownInterval);
    countdownInterval = null;
    countdownRunning = false;

    countdownStartButton.disabled = false;
    countdownStartButton.textContent = "Start";

    countdownPauseButton.disabled = true;
}
// ALARM SOUND
let audioContext = null;

function prepareAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!audioContext) {
        audioContext = new AudioContext();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
}

function playAlarm() {
    if (!audioContext || audioContext.state !== "running") return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.type = "sine";
    oscillator.frequency.value = 880;

    gain.gain.value = 0.3;

    oscillator.start();

    setTimeout(() => {
        oscillator.stop();
    }, 1500);
}

function tickCountdown() {
    remainingSeconds = Math.max(
        0,
        Math.ceil((countdownEnd - Date.now()) / 1000)
    );

    renderCountdown();

    if (remainingSeconds <= 0) {
        stopCountdown();
        countdownMessage.textContent = "Time is up! 🎉";
        playAlarm();
    }
}

function startCountdown() {
    if (countdownRunning) return;
    prepareAudio();

    if (!readCountdownInputs()) return;

    countdownRunning = true;
    countdownEnd = Date.now() + remainingSeconds * 1000;

    countdownMessage.textContent = "Countdown running...";
    countdownStartButton.textContent = "Running...";
    countdownStartButton.disabled = true;
    countdownPauseButton.disabled = false;

    tickCountdown();

    if (countdownRunning) {
        countdownInterval = setInterval(tickCountdown, 200);
    }
}

countdownStartButton.addEventListener("click", startCountdown);

countdownPauseButton.addEventListener("click", function () {
    if (!countdownRunning) return;

    remainingSeconds = Math.max(
        0,
        Math.ceil((countdownEnd - Date.now()) / 1000)
    );

    stopCountdown();
    renderCountdown();

    countdownMessage.textContent =
        remainingSeconds === 0 ? "Time is up! 🎉" : "Countdown paused.";

    countdownStartButton.textContent =
        remainingSeconds === 0 ? "Start again" : "Resume";
});

document.getElementById("reset-countdown").addEventListener("click", function () {
    stopCountdown();
    remainingSeconds = 60;
    minutesInput.value = 1;
    secondsInput.value = 0;

    renderCountdown();
    countdownMessage.textContent = "Ready to start!";
    countdownStartButton.textContent = "Start";
});

countdownPauseButton.disabled = true;

renderStopwatch();
renderCountdown();
