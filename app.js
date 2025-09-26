const GAME_CONFIG = {
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

// Game State
let gameState = {
    currentScreen: 'splash', 
    playerName: '',
    score: 0,
    flapCount: 0,
    highScores: [],
    gameRunning: false,
    gamePaused: false,
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

        const soundName = Object.keys(this.sounds).find(key => this.sounds[key] === sound);
        const targetVolume = this.volumes[soundName] || 1;

        sound.play().catch(() => {}); 
        let currentVolume = sound.volume;
        const step = targetVolume / (duration / 20); 

        sound.fadeInterval = setInterval(() => {
            currentVolume += step;
            if (currentVolume >= targetVolume) {
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
            sound.volume = this.volumes[soundName] || 1;
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
        const music = {home: this.sounds.home, bgm: this.sounds.bgm};
        Object.entries(music).forEach(([name, sound]) => {
            if (sound) {
                if (sound.fadeInterval) clearInterval(sound.fadeInterval);
                sound.pause();
                sound.currentTime = 0;
                sound.volume = this.volumes[name] || 1;
            }
        });
    },

    stopAll() {
        Object.entries(this.sounds).forEach(([name, sound]) => {
            if (sound) {
                if (sound.fadeInterval) clearInterval(sound.fadeInterval);
                sound.pause();
                sound.currentTime = 0;
                sound.onended = null;
                sound.volume = this.volumes[name] || 1;
            }
        });
    }
};

// --- MODIFIED: Text-to-Speech Engine with new Voice Selection ---
let selectedVoice = null;

function initializeSpeechSynthesis() {
    if ('speechSynthesis' in window) {
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                // Find a "bold" male voice, prioritizing US, then UK English
                selectedVoice = voices.find(voice => voice.lang === 'en-US' && voice.name.toLowerCase().includes('male')) ||
                                voices.find(voice => voice.lang === 'en-GB' && voice.name.toLowerCase().includes('male')) ||
                                null;
                console.log('Selected voice:', selectedVoice ? selectedVoice.name : 'Default');
            }
        };

        if (window.speechSynthesis.getVoices().length > 0) {
            loadVoices();
        } else {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }
}

function speakText(text, onEndCallback) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        utterance.pitch = 1; 
        utterance.rate = 0.7;
        
        utterance.onend = () => {
            if (onEndCallback) {
                onEndCallback();
            }
        };

        window.speechSynthesis.speak(utterance);
    } else {
        console.error('Text-to-speech not supported in this browser.');
        if (onEndCallback) {
            onEndCallback();
        }
    }
}


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
        AudioManager.init();
        initializeSpeechSynthesis();
    }, 100);
});

function initializeDOMElements() {
    screens = {
        splash: document.getElementById('splash-screen'), 
        welcome: document.getElementById('welcome-screen'),
        countdown: document.getElementById('countdown-screen'),
        game: document.getElementById('game-screen'),
        gameOver: document.getElementById('game-over-screen'),
        leaderboard: document.getElementById('leaderboard-screen')
    };
}

function initializeGame() {
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

    const handleFlapAction = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        e.preventDefault();

        const now = Date.now();
        if (now - lastTouchTime < GAME_CONFIG.tapCooldown) return;
        lastTouchTime = now;

        if (gameState.waitingForFirstInput) {
            startFirstFlap();
        } else if (gameState.gameRunning && !gameState.gamePaused) {
            performFlap();
        }
    };

    gameScreen.addEventListener('touchstart', handleFlapAction, { passive: false });
    gameScreen.addEventListener('mousedown', handleFlapAction, { passive: false });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyP') {
            togglePause();
            return;
        }
        
        if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
             e.preventDefault();
            const now = Date.now();
            if (now - lastTouchTime < GAME_CONFIG.tapCooldown) return;
            lastTouchTime = now;

            if (gameState.waitingForFirstInput) {
                startFirstFlap();
            } else if (gameState.gameRunning && !gameState.gamePaused) {
                performFlap();
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

    document.getElementById('try-again-btn').addEventListener('click', handleStartGame);
    document.getElementById('new-player-btn').addEventListener('click', () => { gameState.playerName = ''; document.getElementById('player-name').value = ''; showScreen('welcome'); });
    document.getElementById('view-scores-btn').addEventListener('click', showLeaderboard);
    document.getElementById('play-again-btn').addEventListener('click', handleStartGame);
    document.getElementById('back-to-menu-btn').addEventListener('click', () => showScreen('welcome'));
    document.getElementById('pause-btn').addEventListener('click', togglePause);
}

function performFlap() {
    flapBird();
    gameState.flapCount++;
    updateFlapCounter();
}

function startFirstFlap() {
    if(!gameState.waitingForFirstInput) return;
    const waitingMessage = document.getElementById('waiting-message');
    if (waitingMessage) waitingMessage.remove();
    gameState.waitingForFirstInput = false;
    AudioManager.stopMusic();
    AudioManager.play('bgm');
    performFlap(); 
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

    AudioManager.stopMusic();
    const nameAudio = AudioManager.sounds.name;

    setTimeout(() => {
        nameAudio.currentTime = 0.0;
        nameAudio.play();

        const checkTimeInterval = setInterval(() => {
            if (nameAudio.currentTime >= 0.77) {
                clearInterval(checkTimeInterval);
                nameAudio.pause();

                speakText(gameState.playerName, () => {
                    nameAudio.currentTime = 1.72;
                    nameAudio.play();
                    
                    nameAudio.onended = () => {
                        nameAudio.onended = null;
                        startCountdown();
                    };
                });
            }
        }, 10);

    }, 100);
}


function handleViewLeaderboard() {
    showLeaderboard();
}

function updateFlapCounter() {
    document.getElementById('flap-count').textContent = gameState.flapCount;
}

function startCountdown() {
    showScreen('countdown');
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
    waitingMessage.textContent = 'Tap or press SPACE to start!';
    waitingMessage.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:white; font-size:24px; text-shadow:2px 2px 4px #000; z-index: 10;';
    document.getElementById('game-container').appendChild(waitingMessage);
}

function resetGame() {
    gameState.score = 0;
    gameState.flapCount = 0;
    updateScoreDisplay();
    updateFlapCounter();
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
    
    AudioManager.stopAll();
    
    addToLeaderboard(gameState.playerName, gameState.score, gameState.flapCount);

    AudioManager.play('lose', () => {
        showGameOverScreen(); 
        AudioManager.play('gameover', () => { 
            setTimeout(() => AudioManager.play('home'), 500);
        });
    });
}

function addToLeaderboard(name, score, flaps) {
    gameState.highScores.push({ playerName: name, score, flaps, date: new Date().toLocaleDateString() });
    gameState.highScores.sort((a, b) => b.score - a.score).splice(10);
    saveHighScores();
}

function showGameOverScreen() {
    document.getElementById('final-score-value').textContent = gameState.score;
    document.getElementById('final-flaps').textContent = gameState.flapCount;
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
            <div class="commands-col">${s.flaps}</div>
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
    const homeMusicScreens = ['welcome', 'leaderboard', 'gameOver'];

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