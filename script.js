// Global constant declarations
const SFX_DIRECTORY = './assets/audio/';
const DEFAULT_BACKGROUND = `linear-gradient(hsl(0, 0%, 100%), hsl(0, 0%, 60%))`;
const MAX_MS = 86400000;

const UNIT_MS = {
    hours: 3600000,
    mins: 60000,
    secs: 1000,
}

const TIMER_STATES = {
    RUNNING: 'running',
    PAUSED: 'paused',
    FINISHED: 'finished',
    STOPPED: 'stopped',
}

const timer = {
    currentState: TIMER_STATES.STOPPED,
    initialTime: 0,
    timeRemaining: 0,
    startTime: 0,
    pausedTime: 0,
    animationFrameID: null,
}

const elements = {
    root: document.querySelector(':root'),
    timerDisplay: {
        container: document.querySelector('.timer-display'),
        stepButtons: null,
        hours: document.querySelector('#hours-display'),
        mins: document.querySelector('#minutes-display'),
        secs: document.querySelector('#seconds-display'),
    },
    timerControls: {
        start: document.querySelector('#start-timer'),
        pause: document.querySelector('#pause-timer'),
        reset: document.querySelector('#reset-timer'),
    },
    countdownCircle: {
        container: document.querySelector('.countdown-circle-container'),
        fill: document.querySelector('.countdown-circle-fill'),
    },
    audio: document.querySelector('#timer-audio'),
}

document.querySelectorAll('.timer-unit-wrapper').forEach(wrapper => {
    populateStepButtons(wrapper);
});

elements.timerDisplay.stepButtons = document.querySelectorAll('.step-button');

// === Functions ===
function populateStepButtons(wrapper) {
    const unit = wrapper.dataset.unit;

    const increaseButton = document.createElement('button');
    const decreaseButton = document.createElement('button');

    increaseButton.textContent = '+';
    decreaseButton.textContent = '−';

    increaseButton.classList.add('step-button', 'step-button--increase', 'invisible');
    decreaseButton.classList.add('step-button', 'step-button--decrease', 'invisible');

    wrapper.appendChild(increaseButton);
    wrapper.appendChild(decreaseButton);
    
    increaseButton.addEventListener('click', () => {
        timer.initialTime = Math.min(MAX_MS, timer.initialTime + UNIT_MS[unit]);
        updateTimerDisplay(timer.initialTime);
    });

    decreaseButton.addEventListener('click', () => {
        timer.initialTime = Math.max(0, timer.initialTime - UNIT_MS[unit]);
        updateTimerDisplay(timer.initialTime);
    });

    wrapper.addEventListener('mouseenter', () => {
        if (timer.currentState === TIMER_STATES.STOPPED) {
            elements.timerDisplay.stepButtons?.forEach(button => {
                button.classList.add('invisible');
            });
            increaseButton.classList.remove('invisible');
            decreaseButton.classList.remove('invisible');
        }
    });

    wrapper.addEventListener('mouseleave', () => {
        increaseButton.classList.add('invisible');
        decreaseButton.classList.add('invisible');
    });
}

function updateTimerDisplay(time) {
    const { hours, mins, secs } = msToUnits(time);
    elements.timerDisplay.hours.textContent = String(hours).padStart(2, '0');
    elements.timerDisplay.mins.textContent = String(mins).padStart(2, '0');
    elements.timerDisplay.secs.textContent = String(secs).padStart(2, '0');
}

function msToUnits(ms) {
    const totalSecs = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = Math.floor(totalSecs % 60);

    return { hours, mins, secs };
}

function resetTimer() {
    timer.currentState = TIMER_STATES.STOPPED;
    timer.timeRemaining = timer.initialTime;
    timer.pausedTime = 0;

    clearCountdownAnimation();
    stopAudio(elements.audio);
    toggleElementStyles();
    updateTimerDisplay(timer.timeRemaining);

    document.body.style.background = DEFAULT_BACKGROUND;
}

function clearCountdownAnimation() {
    cancelAnimationFrame(timer.animationFrameID);
    timer.animationFrameID = null;
}

function stopAudio(audioEl) {
    if (!audioEl) return;
    audioEl.pause();
    audioEl.currentTime = 0;
}

function toggleElementStyles() {
    const state = timer.currentState;
    
    elements.timerControls.start.classList.toggle('hidden', (state === TIMER_STATES.RUNNING || state === TIMER_STATES.FINISHED));
    elements.timerControls.pause.classList.toggle('hidden', state !== TIMER_STATES.RUNNING);
    elements.timerControls.reset.classList.toggle('hidden', state === TIMER_STATES.STOPPED);
    elements.countdownCircle.container.classList.toggle('hidden', state === TIMER_STATES.STOPPED);

    elements.countdownCircle.fill.style.opacity = state === TIMER_STATES.RUNNING || state === TIMER_STATES.PAUSED ? 1 : 0;

    elements.root.style.setProperty('--shadow-saturation', state === TIMER_STATES.STOPPED ? '0%' : '100%');
    elements.root.style.setProperty('--shadow-lightness', state === TIMER_STATES.STOPPED ? '45%' : '30%');
}

async function startTimer() {
    if (timer.currentState === TIMER_STATES.RUNNING) return;

    if (timer.initialTime === 0) {
        document.querySelectorAll('#seconds-wrapper .step-button')
            .forEach(control => control.classList.remove('invisible'));
        return;
    }

    timer.currentState = TIMER_STATES.RUNNING;
    
    toggleElementStyles();

    const now = performance.now();
    timer.startTime = now - timer.pausedTime;

    function animateCountdown(now) {
        const elapsed = Math.max(now - timer.startTime, 0);
        timer.timeRemaining = Math.max(timer.initialTime - elapsed, 0);
        const pctTimeRemaining = timer.timeRemaining / timer.initialTime * 100;

        updateTimerDisplay(timer.timeRemaining);
        updateBackgroundColor(pctTimeRemaining);
        updateCircleFill(pctTimeRemaining);

        if (timer.timeRemaining > 0) {
            timer.animationFrameID = requestAnimationFrame(animateCountdown);
        } else {
            handleTimerFinish();
        }
    }

    timer.animationFrameID = requestAnimationFrame(animateCountdown);
}

function updateBackgroundColor(percent) {
    const hue = percent / 100 * 120;
    document.body.style.background = `linear-gradient(hsl(${hue}, 100%, 75%), hsl(${hue}, 100%, 40%))`;
    elements.root.style.setProperty('--shadow-hue', hue);
}

function updateCircleFill(percent) {
    elements.countdownCircle.fill.style.strokeDasharray = `${percent} 100`;
}

function handleTimerFinish() {
    timer.currentState = TIMER_STATES.FINISHED;
    clearCountdownAnimation();
    startTimeWarning();
    toggleElementStyles();
}

function startTimeWarning() {
    const audio = elements.audio;
    audio.currentTime = 0;
    playAudio(audio);
    resetClass(elements.timerDisplay.container, 'flash');
}

async function playAudio(audioEl) {
    if (!audioEl.src) {
        console.warn('No audio available.');
        return;
    }

    if (!audioEl.paused && !audioEl.ended) return;
    
    try {
        await audioEl.play();
    } catch (error) {
        console.warn('Audio playback failed:', error);
    }
}

function resetClass(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
}

function pauseTimer() {
    if (timer.currentState !== TIMER_STATES.RUNNING) return;
    timer.currentState = TIMER_STATES.PAUSED;
    timer.pausedTime = performance.now() - timer.startTime;
    clearCountdownAnimation();
    toggleElementStyles()
}

// === Event listeners ===
elements.timerControls.start.addEventListener('click', startTimer);
elements.timerControls.pause.addEventListener('click', pauseTimer);
elements.timerControls.reset.addEventListener('click', resetTimer);
elements.audio.addEventListener('ended', startTimeWarning);

document.addEventListener('DOMContentLoaded', () => {
    updateTimerDisplay(0);
    resetTimer();
});