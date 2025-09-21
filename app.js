const VOICE_CONFIG = {
    amplitudeThreshold: 0.3,
    noiseGate: 0.1,
    continuousRecognition: true,
    interimResults: true,
    maxAlternatives: 1,
    restartDelay: 50,
    fftSize: 256,
    smoothingTimeConstant: 0.85
};

const VOICE_GAME_CONFIG = {
    birdStartX: 100, //DO NOT CHANGE
    birdStartY: 300, //DO NOT CHANGE
    birdSize: 30, //DO NOT CHANGE
    gravity: 0.05, //speed of drop for the bird
    flapStrength: -2, // Jump sensitivity (0 - -10)
    pipeWidth: 60, //change pipe width (size of the green pipe)
    pipeGap: 150, //height diff b/w pipe
    pipeSpeed: 1.5, // speed of the game
    tapCooldown: 200, // cool down time to eliminate multitouch
    gameWidth: 1200, // game viewing width
    gameHeight: 600 //DO NOT CHANGE
};

const KEYBOARD_GAME_CONFIG = {
    birdStartX: 100,
    birdStartY: 300,
    birdSize: 30,
    gravity: 0.2, 
    flapStrength: -7, 
    pipeWidth: 60, 
    pipeGap: 200, 
    pipeSpeed: 4,
    tapCooldown: 200,
    gameWidth: 1200,
    gameHeight: 600
};

let GAME_CONFIG = {}; // Will be set based on mode

const VOICE_COMMANDS = ["flap", "up", "jump", "go", "fly"];

// Game State
let gameState = {
    currentScreen: 'splash', // Start on splash screen
    playerName: '',
    score: 0,
    commandCount: 0,
    highScores: [],
    gameRunning: false,
    gamePaused: false,
    calibrationMode: false,
    testDetectionCount: 0,
    waitingForFirstInput: false
};

// Audio Manager
const AudioManager = {
    sounds: {},
    volumes: {
        home: 0.3,
        name: 1.0,
        score: 1.0,
        bgm: 0.25,
        lose: 1.0,
        gameover: 0.6,
        countdown: 0.8
    },
    isMuted: false,
    userInteracted: false,
    isTabActive: true, 
    pausedForVisibility: [], 

    init() {
        this.sounds.home = document.getElementById('audio-home');
        this.sounds.name = document.getElementById('audio-name');
        this.sounds.score = document.getElementById('audio-score');
        this.sounds.bgm = document.getElementById('audio-bgm');
        this.sounds.lose = document.getElementById('audio-lose');
        this.sounds.gameover = document.getElementById('audio-gameover');
        this.sounds.countdown = document.getElementById('audio-countdown'); 

        Object.entries(this.sounds).forEach(([name, sound]) => {
            if (sound && this.volumes[name] !== undefined) {
                sound.volume = this.volumes[name];
            }
        });

        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    },

    handleVisibilityChange() {
        if (document.hidden) {
            this.isTabActive = false;
            this.pausedForVisibility = [];
            Object.entries(this.sounds).forEach(([name, sound]) => {
                if (sound && !sound.paused) {
                    this.fadeOut(sound);
                    this.pausedForVisibility.push(name);
                }
            });
        } else {
            this.isTabActive = true;
            this.pausedForVisibility.forEach(name => {
                if (this.sounds[name]) {
                    this.fadeIn(this.sounds[name]);
                }
            });
            this.pausedForVisibility = [];
        }
    },

    fadeOut(sound, duration = 300) {
        if (!sound) return;
        let currentVolume = sound.volume;
        if (sound.fadeInterval) clearInterval(sound.fadeInterval);
        const step = currentVolume / (duration / 20); 

        sound.fadeInterval = setInterval(() => {
            currentVolume -= step;
            if (currentVolume <= 0) {
                sound.volume = 0;
                sound.pause();
                clearInterval(sound.fadeInterval);
            } else {
                sound.volume = currentVolume;
            }
        }, 20);
    },

    fadeIn(sound, duration = 300) {
        if (!sound || !this.isTabActive || (this.isMuted && sound.loop)) return;
        if (sound.fadeInterval) clearInterval(sound.fadeInterval);

        // Find the sound's name to get its target volume
        const soundName = Object.keys(this.sounds).find(key => this.sounds[key] === sound);
        const targetVolume = this.volumes[soundName] || 1;

        sound.play().catch(() => {}); 
        let currentVolume = sound.volume;
        // Adjust the step based on the target volume
        const step = targetVolume / (duration / 20); 

        sound.fadeInterval = setInterval(() => {
            currentVolume += step;
            if (currentVolume >= targetVolume) { // Check against target volume
                sound.volume = targetVolume;
                clearInterval(sound.fadeInterval);
            } else {
                sound.volume = currentVolume;
            }
        }, 20);
    },

    isPlaying(soundName) {
        const sound = this.sounds[soundName];
        return sound && !sound.paused && sound.currentTime > 0;
    },

    play(soundName, onEnded = null) {
        if (!this.userInteracted || this.isMuted) return;
        
        const sound = this.sounds[soundName];
        if (sound) {
            
            if (sound.loop && !sound.paused) {
                 if (onEnded) {
                     sound.onended = () => {
                         sound.onended = null;
                         onEnded();
                     };
                 } else {
                     sound.onended = null;
                 }
                 return; 
            }

            if (sound.fadeInterval) clearInterval(sound.fadeInterval);
            // REPLACE 'sound.volume = 1;' with this line:
            sound.volume = this.volumes[soundName] || 1; // Use custom volume

            sound.currentTime = 0;
            
            if (this.isTabActive) {
                sound.play().catch(e => {
                    if (e.name !== 'AbortError') {
                        console.error(`Audio play failed for ${soundName}:`, e);
                    }
                });
            }
            
            if (onEnded) {
                sound.onended = () => {
                    sound.onended = null;
                    onEnded();
                };
            } else {
                sound.onended = null;
            }
        }
    },

    stopMusic() {
        // REWRITE THIS FUNCTION to get the sound names
        const music = {home: this.sounds.home, bgm: this.sounds.bgm};
        Object.entries(music).forEach(([name, sound]) => {
            if (sound) {
                if (sound.fadeInterval) clearInterval(sound.fadeInterval);
                sound.pause();
                sound.currentTime = 0;
                sound.volume = this.volumes[name] || 1; // Reset to custom volume
            }
        });
    },

    stopAll() {
        // REWRITE THIS FUNCTION to get the sound names
        Object.entries(this.sounds).forEach(([name, sound]) => {
            if (sound) {
                if (sound.fadeInterval) clearInterval(sound.fadeInterval);
                sound.pause();
                sound.currentTime = 0;
                sound.onended = null;
                sound.volume = this.volumes[name] || 1; // Reset to custom volume
            }
        });
    }
};


// Enhanced Voice Recognition System
let recognition = null;
let audioContext = null;
let microphoneStream = null;
let analyserNode = null;
let dataArray = null;
let isListening = false;
let isAudioInitialized = false;
let amplitudeDetectionActive = false;
let lastCommandTime = 0;
let voiceAnimationFrame = null;

// Game Objects
let bird = null;
let pipes = [];
let canvas = null;
let ctx = null;
let animationFrame = null;
let birdImg = null;

// DOM Elements
let screens = {};

// Initialize the game when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        initializeDOMElements();
        initializeGame();
        setupEventListeners();
        setupEnhancedVoiceRecognition();
        AudioManager.init();
    }, 100);
});

function initializeDOMElements() {
    screens = {
        splash: document.getElementById('splash-screen'), 
        welcome: document.getElementById('welcome-screen'),
        calibration: document.getElementById('calibration-screen'),
        countdown: document.getElementById('countdown-screen'),
        game: document.getElementById('game-screen'),
        gameOver: document.getElementById('game-over-screen'),
        leaderboard: document.getElementById('leaderboard-screen')
    };
}

function setupControlModeToggle() {
    const toggle = document.getElementById('control-mode-toggle');
    if (toggle) {
        const savedMode = localStorage.getItem('flappyBirdControlMode') || 'keyboard'; 
        toggle.checked = savedMode === 'keyboard';
        updateGameConfigForMode(savedMode);
        
        toggle.addEventListener('change', function() {
            const newMode = this.checked ? 'keyboard' : 'voice';
            updateGameConfigForMode(newMode);
            localStorage.setItem('flappyBirdControlMode', newMode);
            updateControlModeUI();
        });
    }
}

function updateGameConfigForMode(mode) {
     if (mode === 'voice') {
        GAME_CONFIG = {...VOICE_GAME_CONFIG};
    } else {
        GAME_CONFIG = {...KEYBOARD_GAME_CONFIG};
    }
    GAME_CONFIG.controlMode = mode;
}

function updateControlModeUI() {
    const modeIndicator = document.getElementById('control-mode-indicator');
    if (modeIndicator) {
        modeIndicator.textContent = GAME_CONFIG.controlMode === 'voice' ? '🎤 Voice Mode' : '⌨️ Keyboard/Mobile Mode';
    }
    document.querySelectorAll('.voice-element').forEach(el => el.style.display = GAME_CONFIG.controlMode === 'voice' ? '' : 'none');
    document.querySelectorAll('#keyboard-instructions, #keyboard-controls, #countdown-keyboard-hint').forEach(el => el.style.display = GAME_CONFIG.controlMode === 'keyboard' ? '' : 'none');
    
    const countdownInstruction = document.getElementById('countdown-instruction');
    if (countdownInstruction) {
        countdownInstruction.textContent = GAME_CONFIG.controlMode === 'voice' 
            ? 'Make any sound to control the bird!' 
            : 'Tap screen or press SPACE to start!';
    }
}

function initializeGame() {
    setupControlModeToggle();
    updateControlModeUI();
    
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    canvas.width = GAME_CONFIG.gameWidth;
    canvas.height = GAME_CONFIG.gameHeight;
    
    birdImg = new Image();
    birdImg.src = './flappy-bird.png'; 
    
    resetBird();
    loadHighScores();
    showScreen('splash'); 
}

function setupEventListeners() {
    document.getElementById('splash-screen').addEventListener('click', () => {
        if (!AudioManager.userInteracted) {
            AudioManager.userInteracted = true;
            AudioManager.play('home');
        }
        showScreen('welcome');
    }, { once: true }); 

    const gameScreen = document.getElementById('game-screen');
    let lastTouchTime = 0;
    gameScreen.addEventListener('touchstart', (e) => {
        // Prevent flapping when pause button is tapped
        if (e.target.id === 'pause-btn') {
            return;
        }
        e.preventDefault();
        const now = Date.now();
        if (now - lastTouchTime < GAME_CONFIG.tapCooldown) return;
        lastTouchTime = now;

        if (gameState.waitingForFirstInput) {
            startFirstFlap();
        } else if (GAME_CONFIG.controlMode === 'keyboard' && gameState.gameRunning && !gameState.gamePaused) {
            flapAndCount();
        }
    }, { passive: false });

    // Add mouse click listener for flapping
    let lastClickTime = 0;
    gameScreen.addEventListener('mousedown', (e) => {
        // Prevent flapping when pause button is clicked
        if (e.target.id === 'pause-btn') {
            return;
        }
        e.preventDefault();
        const now = Date.now();
        if (now - lastClickTime < GAME_CONFIG.tapCooldown) return;
        lastClickTime = now;

        if (gameState.waitingForFirstInput) {
            startFirstFlap();
        } else if (GAME_CONFIG.controlMode === 'keyboard' && gameState.gameRunning && !gameState.gamePaused) {
            flapAndCount();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyP') togglePause();
        
        if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
             e.preventDefault();
            if (gameState.waitingForFirstInput) {
                startFirstFlap();
            } else if (GAME_CONFIG.controlMode === 'keyboard' && gameState.gameRunning && !gameState.gamePaused) {
                flapAndCount();
            }
        }
    });

    document.getElementById('start-game-btn').addEventListener('click', handleStartGame);
    document.getElementById('view-leaderboard-btn').addEventListener('click', handleViewLeaderboard);
    document.getElementById('player-name').addEventListener('input', (e) => gameState.playerName = e.target.value.trim());
    document.getElementById('player-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleStartGame();
        }
    });
    document.getElementById('continue-game-btn').addEventListener('click', startCountdown);
    document.getElementById('back-to-welcome-btn').addEventListener('click', () => { stopCalibration(); showScreen('welcome'); });
    document.getElementById('test-voice-btn').addEventListener('click', toggleVoiceTest);
    document.getElementById('sensitivity-slider').addEventListener('input', (e) => { VOICE_CONFIG.amplitudeThreshold = parseFloat(e.target.value); updateThresholdLine(); });
    document.getElementById('try-again-btn').addEventListener('click', handleStartGame);
    document.getElementById('new-player-btn').addEventListener('click', () => { gameState.playerName = ''; document.getElementById('player-name').value = ''; showScreen('welcome'); });
    document.getElementById('view-scores-btn').addEventListener('click', showLeaderboard);
    document.getElementById('play-again-btn').addEventListener('click', handleStartGame);
    document.getElementById('back-to-menu-btn').addEventListener('click', () => showScreen('welcome'));
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('request-mic-btn').addEventListener('click', requestMicrophonePermission);
    document.getElementById('cancel-mic-btn').addEventListener('click', () => hideModal('mic-permission-modal'));
    document.getElementById('close-troubleshoot-btn').addEventListener('click', () => hideModal('troubleshoot-modal'));
    document.getElementById('test-again-btn').addEventListener('click', () => { hideModal('troubleshoot-modal'); showScreen('calibration'); startCalibration(); });
}

function flapAndCount() {
    flapBird();
    gameState.commandCount++;
    updateCommandCounter();
}

function startFirstFlap() {
    if(!gameState.waitingForFirstInput) return;
    const waitingMessage = document.getElementById('waiting-message');
    if (waitingMessage) waitingMessage.remove();
    gameState.waitingForFirstInput = false;
    AudioManager.stopMusic();
    AudioManager.play('bgm');
    flapAndCount(); 
    gameLoop();
}

function handleStartGame() {
    if (!gameState.playerName.trim()) {
        const input = document.getElementById('player-name');
        input.focus();
        input.style.borderColor = 'var(--color-error)';
        setTimeout(() => { input.style.borderColor = ''; }, 2000);
        return;
    }
    
    AudioManager.play('name');
    showScreen('calibration');
    if (GAME_CONFIG.controlMode === 'voice') {
        startCalibration();
    }
}

function handleViewLeaderboard() {
    showLeaderboard();
}

function setupEnhancedVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript.toLowerCase().trim();
                if (VOICE_COMMANDS.some(command => transcript.includes(command))) {
                    handleVoiceCommand('speech', transcript);
                    if (recognition) recognition.stop(); 
                }
            }
        };
        recognition.onend = () => { if (isListening && recognition) recognition.start(); };
        recognition.onerror = (event) => console.error('Speech recognition error:', event.error);
    }
}

async function initializeAudioContext() {
    if (isAudioInitialized) return true;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        const source = audioContext.createMediaStreamSource(microphoneStream);
        source.connect(analyserNode);
        dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        isAudioInitialized = true;
        startAmplitudeDetection();
        return true;
    } catch(err) {
        console.error("Error initializing audio context:", err);
        return false;
    }
}

function startAmplitudeDetection() {
    if (!isAudioInitialized || amplitudeDetectionActive) return;
    amplitudeDetectionActive = true;
    
    function detect() {
        if (!amplitudeDetectionActive) return;
        analyserNode.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        updateVoiceLevelIndicators(average / 128); 
        if (average / 128 > VOICE_CONFIG.amplitudeThreshold) {
            handleVoiceCommand('amplitude', 'sound detected');
        }
        voiceAnimationFrame = requestAnimationFrame(detect);
    }
    detect();
}

function stopAmplitudeDetection() {
    amplitudeDetectionActive = false;
    if (voiceAnimationFrame) cancelAnimationFrame(voiceAnimationFrame);
}

function updateVoiceLevelIndicators(level) {
    const width = `${Math.min(level * 100, 100)}%`;
    document.querySelectorAll('#voice-level-bar, #countdown-voice-bar, #game-voice-bar').forEach(bar => {
        if(bar) bar.style.width = width;
    });
}

function updateThresholdLine() {
    const line = document.querySelector('.voice-threshold-line');
    if (line) line.style.left = `${VOICE_CONFIG.amplitudeThreshold * 100}%`;
}

function handleVoiceCommand(source, command) {
    if (GAME_CONFIG.controlMode !== 'voice' || (Date.now() - lastCommandTime < GAME_CONFIG.tapCooldown)) return;
    lastCommandTime = Date.now();

    if (gameState.calibrationMode) {
        gameState.testDetectionCount++;
        updateDetectionCount();
    } else if (gameState.waitingForFirstInput) {
        startFirstFlap();
    } else if (gameState.gameRunning && !gameState.gamePaused) {
        flapAndCount();
        showVoiceFeedback(command, source);
    }
}

function showVoiceFeedback(command, source) {
    const feedback = document.getElementById('voice-feedback');
    if (!feedback) return;
    feedback.textContent = source === 'speech' ? `"${command.split(" ").pop()}"` : 'SOUND!';
    feedback.classList.add('show');
    setTimeout(() => feedback.classList.remove('show'), 800);
}

function updateCommandCounter() {
    document.getElementById('command-count').textContent = gameState.commandCount;
}

function updateDetectionCount() {
    document.querySelector('#detection-count span').textContent = gameState.testDetectionCount;
}

async function requestMicrophonePermission() {
    hideModal('mic-permission-modal');
    const success = await initializeAudioContext();
    if (success && recognition) {
        isListening = true;
        recognition.start();
    }
}

function startCalibration() {
    gameState.calibrationMode = true;
    gameState.testDetectionCount = 0;
    updateDetectionCount();
    updateThresholdLine();
    if (!isAudioInitialized) {
        showModal('mic-permission-modal');
    } else if (!isListening && recognition) {
        isListening = true;
        recognition.start();
    }
}

function stopCalibration() {
    gameState.calibrationMode = false;
    isListening = false;
    if (recognition) recognition.stop();
    stopAmplitudeDetection();
}

function toggleVoiceTest() {
    const testBtn = document.getElementById('test-voice-btn');
    testBtn.textContent = 'Testing... Speak!';
    testBtn.disabled = true;
    setTimeout(() => {
        testBtn.textContent = 'Test Voice Commands';
        testBtn.disabled = false;
    }, 5000);
}

function startCountdown() {
    stopCalibration();
    showScreen('countdown');
    // NEW: Play countdown sound
    AudioManager.play('countdown'); 
    
    let count = 3;
    const numberEl = document.getElementById('countdown-number');
    numberEl.textContent = count;
    const interval = setInterval(() => {
        count--;
        if(numberEl) numberEl.textContent = count;
        if (count <= 0) {
            clearInterval(interval);
            startGameplay();
        }
    }, 1000);
}

function startGameplay() {
    showScreen('game');
    resetGame();
    gameState.gameRunning = true;
    gameState.waitingForFirstInput = true;
    
    const waitingMessage = document.createElement('div');
    waitingMessage.id = 'waiting-message';
    waitingMessage.textContent = GAME_CONFIG.controlMode === 'voice' ? 'Make a sound to start!' : 'Tap or press SPACE to start!';
    waitingMessage.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:white; font-size:24px; text-shadow:2px 2px 4px #000; z-index: 10;';
    document.getElementById('game-container').appendChild(waitingMessage);

    if (GAME_CONFIG.controlMode === 'voice' && !isListening) {
        isListening = true;
        if(recognition) recognition.start();
        if(!amplitudeDetectionActive) startAmplitudeDetection();
    }
}

function resetGame() {
    gameState.score = 0;
    gameState.commandCount = 0;
    updateScoreDisplay();
    updateCommandCounter();
    resetBird();
    pipes = [];
    generateInitialPipes();
}

function resetBird() {
    bird = { x: GAME_CONFIG.birdStartX, y: GAME_CONFIG.birdStartY, velocity: 0, size: GAME_CONFIG.birdSize };
}

function generateInitialPipes() {
     for (let i = 0; i < 3; i++) {
        pipes.push(createPipe(GAME_CONFIG.gameWidth + i * 400));
    }
}

function createPipe(x) {
    const topHeight = Math.random() * (GAME_CONFIG.gameHeight - GAME_CONFIG.pipeGap - 100) + 50;
    return { x, topHeight, bottomY: topHeight + GAME_CONFIG.pipeGap, passed: false };
}

function flapBird() {
    if (bird) bird.velocity = GAME_CONFIG.flapStrength;
}

function gameLoop() {
    if (!gameState.gameRunning || gameState.gamePaused || gameState.waitingForFirstInput) return;
    updateGame();
    drawGame();
    animationFrame = requestAnimationFrame(gameLoop);
}

function updateGame() {
    bird.velocity += GAME_CONFIG.gravity;
    bird.y += bird.velocity;

    pipes.forEach(pipe => {
        pipe.x -= GAME_CONFIG.pipeSpeed;
        if (!pipe.passed && pipe.x + GAME_CONFIG.pipeWidth < bird.x) {
            pipe.passed = true;
            gameState.score++;
            updateScoreDisplay();
            AudioManager.play('score');
        }
    });

    if (pipes.length > 0 && pipes[0].x < -GAME_CONFIG.pipeWidth) {
        pipes.shift();
    }
    
    if (pipes.length === 0 || pipes[pipes.length - 1].x < canvas.width - 300) {
        pipes.push(createPipe(canvas.width));
    }

    if (checkCollisions()) endGame();
}

function checkCollisions() {
    if (bird.y > canvas.height - bird.size || bird.y < 0) return true;
    for (const pipe of pipes) {
        if (bird.x + bird.size > pipe.x && bird.x < pipe.x + GAME_CONFIG.pipeWidth &&
            (bird.y < pipe.topHeight || bird.y + bird.size > pipe.bottomY)) {
            return true;
        }
    }
    return false;
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    pipes.forEach(pipe => {
        ctx.fillStyle = '#228B22';
        ctx.fillRect(pipe.x, 0, GAME_CONFIG.pipeWidth, pipe.topHeight);
        ctx.fillRect(pipe.x, pipe.bottomY, GAME_CONFIG.pipeWidth, canvas.height - pipe.bottomY);
    });

    if (birdImg && birdImg.complete && birdImg.naturalHeight !== 0) {
        ctx.save();
        ctx.translate(bird.x + bird.size / 2, bird.y + bird.size / 2);
        
        let rotation = Math.max(Math.min(bird.velocity * 0.1, Math.PI / 2), -Math.PI / 9);
        ctx.rotate(rotation);
        
        ctx.drawImage(birdImg, -bird.size / 2, -bird.size / 2, bird.size, bird.size);
        ctx.restore();
    } else {
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.arc(bird.x + bird.size/2, bird.y + bird.size/2, bird.size/2, 0, Math.PI * 2);
        ctx.fill();
    }
}

function updateScoreDisplay() {
    document.getElementById('current-score').textContent = gameState.score;
}

function endGame() {
    if (!gameState.gameRunning) return;
    gameState.gameRunning = false;
    cancelAnimationFrame(animationFrame);
    isListening = false;
    if(recognition) recognition.stop();
    stopAmplitudeDetection();
    
    AudioManager.stopAll();
    
    addToLeaderboard(gameState.playerName, gameState.score, gameState.commandCount);

    AudioManager.play('lose', () => {
        showGameOverScreen(); 
        AudioManager.play('gameover', () => { 
            setTimeout(() => AudioManager.play('home'), 500);
        });
    });
}

function addToLeaderboard(name, score, commands) {
    gameState.highScores.push({ playerName: name, score, commands, date: new Date().toLocaleDateString() });
    gameState.highScores.sort((a, b) => b.score - a.score).splice(10);
    saveHighScores();
}

function showGameOverScreen() {
    document.getElementById('final-score-value').textContent = gameState.score;
    document.getElementById('final-commands').textContent = gameState.commandCount;
    const isNewRecord = gameState.highScores.length > 0 && gameState.score > 0 && gameState.score >= gameState.highScores[0].score;
    document.getElementById('new-record').classList.toggle('hidden', !isNewRecord);
    const rank = gameState.highScores.findIndex(s => s.playerName === gameState.playerName && s.score === gameState.score) + 1;
    document.getElementById('rank-value').textContent = rank > 0 ? `#${rank}` : 'N/A';
    showScreen('gameOver');
}

function showLeaderboard() {
    updateLeaderboardDisplay();
    showScreen('leaderboard');
}

function updateLeaderboardDisplay() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    list.innerHTML = gameState.highScores.length ? gameState.highScores.map((s, i) => `
        <div class="leaderboard-entry">
            <div class="rank-col">#${i + 1}</div>
            <div class="name-col">${s.playerName}</div>
            <div class="score-col">${s.score}</div>
            <div class="commands-col">${s.commands}</div>
            <div class="date-col">${s.date}</div>
        </div>`).join('') : '<div class="empty-leaderboard">No scores yet! Be the first!</div>';
}

function togglePause() {
    if (!gameState.gameRunning) return;
    gameState.gamePaused = !gameState.gamePaused;
    const btn = document.getElementById('pause-btn');
    if(btn) btn.textContent = gameState.gamePaused ? 'Resume ▶️' : 'Pause ⏸️';
    
    if (gameState.gamePaused) {
        if(AudioManager.sounds.bgm) AudioManager.sounds.bgm.pause();
    } else {
        if(AudioManager.sounds.bgm) AudioManager.sounds.bgm.play();
        gameLoop();
    }
}

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
    gameState.currentScreen = screenName;

    const bgmScreens = ['game', 'countdown'];
    const homeMusicScreens = ['welcome', 'leaderboard', 'calibration', 'gameOver'];

    if (bgmScreens.includes(screenName)) {
        AudioManager.stopMusic(); 
    } else if (homeMusicScreens.includes(screenName)) {
        if (AudioManager.isPlaying('bgm')) {
             AudioManager.stopMusic(); 
        }
        
        if (screenName !== 'gameOver') {
            AudioManager.play('home');
        }
    } else {
        AudioManager.stopMusic();
    }
}


function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }

function saveHighScores() {
    try {
        localStorage.setItem('flappyBirdScores', JSON.stringify(gameState.highScores));
    } catch (e) {
        console.error("Could not save scores to local storage.", e);
    }
}

function loadHighScores() {
    try {
        const scores = localStorage.getItem('flappyBirdScores');
        gameState.highScores = scores ? JSON.parse(scores) : [];
    } catch (e) {
        console.error("Could not load scores from local storage.", e);
        gameState.highScores = [];
    }
}
