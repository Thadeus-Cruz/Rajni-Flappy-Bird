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
    gravity: 0.15, 
    flapStrength: -5, 
    pipeWidth: 60, 
    pipeGap: 200, 
    pipeSpeed: 3,
    tapCooldown: 200,
    gameWidth: 1200,
    gameHeight: 600
};

let GAME_CONFIG = {...VOICE_GAME_CONFIG}; // Default to voice config

const VOICE_COMMANDS = ["flap", "up", "jump", "go", "fly"];

// Game State
let gameState = {
    currentScreen: 'welcome',
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
let isAboveThreshold = false;

// Game Objects
let bird = null;
let pipes = [];
let canvas = null;
let ctx = null;
let animationFrame = null;

// DOM Elements
let screens = {};

// Initialize the game when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing enhanced voice-controlled game...');
    
    // Small delay to ensure all elements are rendered
    setTimeout(() => {
        initializeDOMElements();
        initializeGame();
        setupEventListeners();
        setupEnhancedVoiceRecognition();
        console.log('Game initialization complete');
    }, 100);
});

function initializeDOMElements() {
    console.log('Initializing DOM elements...');
    
    screens = {
        welcome: document.getElementById('welcome-screen'),
        calibration: document.getElementById('calibration-screen'),
        countdown: document.getElementById('countdown-screen'),
        game: document.getElementById('game-screen'),
        gameOver: document.getElementById('game-over-screen'),
        leaderboard: document.getElementById('leaderboard-screen')
    };
    
    // Verify all screens were found
    for (const [key, element] of Object.entries(screens)) {
        if (!element) {
            console.error(`Screen element not found: ${key}-screen`);
        } else {
            console.log(`Found screen: ${key}`);
        }
    }
}

function setupControlModeToggle() {
    const toggle = document.getElementById('control-mode-toggle');
    if (toggle) {
        // Load saved preference or use default
        const savedMode = localStorage.getItem('flappyBirdControlMode');
        GAME_CONFIG.controlMode = savedMode || 'voice';
        // Set the initial config based on mode
        updateGameConfigForMode(GAME_CONFIG.controlMode);
        // Reverse the initial checked state to match the correct mode
        toggle.checked = GAME_CONFIG.controlMode === 'keyboard';
        
        toggle.addEventListener('change', function() {
            // Reverse the logic here
            const newMode = this.checked ? 'keyboard' : 'voice';
            GAME_CONFIG.controlMode = newMode;
            updateGameConfigForMode(newMode);
            localStorage.setItem('flappyBirdControlMode', newMode);
            updateControlModeUI();
        });
    }
}

function updateGameConfigForMode(mode) {
    if (mode === 'voice') {
        Object.assign(GAME_CONFIG, VOICE_GAME_CONFIG);
    } else {
        Object.assign(GAME_CONFIG, KEYBOARD_GAME_CONFIG);
    }
}

function updateControlModeUI() {
    const modeIndicator = document.getElementById('control-mode-indicator');
    if (modeIndicator) {
        modeIndicator.textContent = GAME_CONFIG.controlMode === 'voice' ? '🎤 Voice Mode' : '⌨️ Keyboard Mode';
    }
    
    // Show/hide voice-specific UI elements
    const voiceElements = document.querySelectorAll('.voice-element');
    voiceElements.forEach(el => {
        el.style.display = GAME_CONFIG.controlMode === 'voice' ? '' : 'none';
    });
    
    // Show/hide keyboard instructions
    const keyboardElements = document.querySelectorAll('#keyboard-instructions, #keyboard-controls, #countdown-keyboard-hint');
    keyboardElements.forEach(el => {
        el.style.display = GAME_CONFIG.controlMode === 'keyboard' ? '' : 'none';
    });
    
    // Update countdown instruction text
    const countdownInstruction = document.getElementById('countdown-instruction');
    if (countdownInstruction) {
        countdownInstruction.textContent = GAME_CONFIG.controlMode === 'voice' 
            ? 'Make any sound to control the bird!' 
            : 'Press SPACE to start flying!';
    }
}

function initializeGame() {
    setupControlModeToggle();
    console.log('Initializing game...');
    
    canvas = document.getElementById('game-canvas');
    if (canvas) {
        ctx = canvas.getContext('2d');
        canvas.width = GAME_CONFIG.gameWidth;
        canvas.height = GAME_CONFIG.gameHeight;
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        console.log('Canvas initialized');
    } else {
        console.error('Canvas not found');
    }
    
    resetBird();
    loadHighScores();
    showScreen('welcome');
    console.log('Game initialization complete');
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Welcome screen
    const startGameBtn = document.getElementById('start-game-btn');
    const viewLeaderboardBtn = document.getElementById('view-leaderboard-btn');
    const playerNameInput = document.getElementById('player-name');
    
    if (startGameBtn) {
        startGameBtn.addEventListener('click', handleStartGame);
        startGameBtn.addEventListener('mousedown', handleStartGame);
    }
    
    if (viewLeaderboardBtn) {
        viewLeaderboardBtn.addEventListener('click', handleViewLeaderboard);
        viewLeaderboardBtn.addEventListener('mousedown', handleViewLeaderboard);
    }
    
    if (playerNameInput) {
        playerNameInput.addEventListener('input', function(e) {
            gameState.playerName = e.target.value.trim();
        });
        
        playerNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (gameState.playerName) {
                    handleStartGame();
                }
            }
        });
    }
    
    // Calibration screen
    const continueGameBtn = document.getElementById('continue-game-btn');
    const backToWelcomeBtn = document.getElementById('back-to-welcome-btn');
    const testVoiceBtn = document.getElementById('test-voice-btn');
    const sensitivitySlider = document.getElementById('sensitivity-slider');
    
    if (continueGameBtn) {
        continueGameBtn.addEventListener('click', function(e) {
            e.preventDefault();
            startCountdown();
        });
    }
    
    if (backToWelcomeBtn) {
        backToWelcomeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            stopCalibration();
            showScreen('welcome');
        });
    }
    
    if (testVoiceBtn) {
        testVoiceBtn.addEventListener('click', function(e) {
            e.preventDefault();
            toggleVoiceTest();
        });
    }
    
    if (sensitivitySlider) {
        sensitivitySlider.addEventListener('input', function(e) {
            VOICE_CONFIG.amplitudeThreshold = parseFloat(e.target.value);
            updateThresholdLine();
        });
    }
    
    // Game over screen
    const tryAgainBtn = document.getElementById('try-again-btn');
    const newPlayerBtn = document.getElementById('new-player-btn');
    const viewScoresBtn = document.getElementById('view-scores-btn');
    const mainMenuBtn = document.getElementById('main-menu-btn');
    
    if (tryAgainBtn) {
        tryAgainBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleStartGame();
        });
    }
    
    if (newPlayerBtn) {
        newPlayerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            gameState.playerName = '';
            document.getElementById('player-name').value = '';
            showScreen('welcome');
        });
    }
    
    if (viewScoresBtn) {
        viewScoresBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showLeaderboard();
        });
    }
    
    if (mainMenuBtn) {
        mainMenuBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showScreen('welcome');
        });
    }
    
    // Leaderboard screen
    const playAgainBtn = document.getElementById('play-again-btn');
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    
    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleStartGame();
        });
    }
    
    if (backToMenuBtn) {
        backToMenuBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showScreen('welcome');
        });
    }
    
    // Game controls
    const pauseBtn = document.getElementById('pause-btn');
    const gameSensitivity = document.getElementById('game-sensitivity');
    
    if (pauseBtn) {
        pauseBtn.addEventListener('click', togglePause);
    }
    
    if (gameSensitivity) {
        gameSensitivity.addEventListener('input', function(e) {
            VOICE_CONFIG.amplitudeThreshold = parseFloat(e.target.value);
        });
    }
    
    // Microphone permission modal
    const requestMicBtn = document.getElementById('request-mic-btn');
    const cancelMicBtn = document.getElementById('cancel-mic-btn');
    
    if (requestMicBtn) {
        requestMicBtn.addEventListener('click', requestMicrophonePermission);
    }
    
    if (cancelMicBtn) {
        cancelMicBtn.addEventListener('click', function() {
            hideModal('mic-permission-modal');
        });
    }
    
    // Troubleshoot modal
    const closeTroubleshootBtn = document.getElementById('close-troubleshoot-btn');
    const testAgainBtn = document.getElementById('test-again-btn');
    
    if (closeTroubleshootBtn) {
        closeTroubleshootBtn.addEventListener('click', function() {
            hideModal('troubleshoot-modal');
        });
    }
    
    if (testAgainBtn) {
        testAgainBtn.addEventListener('click', function() {
            hideModal('troubleshoot-modal');
            showScreen('calibration');
            startCalibration();
        });
    }
    
    console.log('Event listeners setup complete');
}

function handleStartGame(e) {
    if (e) e.preventDefault();
    
    const playerNameInput = document.getElementById('player-name');
    let playerName = gameState.playerName;
    
    if (playerNameInput && playerNameInput.value.trim()) {
        playerName = playerNameInput.value.trim();
        gameState.playerName = playerName;
    }
    
    if (!playerName) {
        if (playerNameInput) {
            playerNameInput.focus();
            playerNameInput.style.borderColor = 'var(--color-error)';
            setTimeout(() => {
                playerNameInput.style.borderColor = '';
            }, 2000);
        }
        alert('Please enter your name to start the game!');
        return;
    }
    
    showScreen('calibration');
    startCalibration();
}

function handleViewLeaderboard(e) {
    if (e) e.preventDefault();
    showLeaderboard();
}

// Enhanced Voice Recognition System
function setupEnhancedVoiceRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        recognition.continuous = VOICE_CONFIG.continuousRecognition;
        recognition.interimResults = VOICE_CONFIG.interimResults;
        recognition.maxAlternatives = VOICE_CONFIG.maxAlternatives;
        recognition.lang = 'en-US';
        
        recognition.onresult = function(event) {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript.toLowerCase().trim();
                
                if (VOICE_COMMANDS.some(command => transcript.includes(command))) {
                    handleVoiceCommand('speech', transcript);
                }
            }
        };
        
        recognition.onerror = function(event) {
            console.log('Speech recognition error:', event.error);
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                updateMicrophoneStatus('Recognition Error');
                setTimeout(() => restartSpeechRecognition(), VOICE_CONFIG.restartDelay);
            }
        };
        
        recognition.onend = function() {
            if (isListening && (gameState.gameRunning || gameState.calibrationMode)) {
                setTimeout(() => restartSpeechRecognition(), VOICE_CONFIG.restartDelay);
            }
        };
    }
}

function restartSpeechRecognition() {
    if (!recognition || !isListening) return;
    
    try {
        recognition.start();
    } catch (error) {
        if (error.name !== 'InvalidStateError') {
            console.error('Error restarting recognition:', error);
        }
    }
}

async function initializeAudioContext() {
    if (isAudioInitialized) return true;
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        microphoneStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 44100
            }
        });
        
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = VOICE_CONFIG.fftSize;
        analyserNode.smoothingTimeConstant = VOICE_CONFIG.smoothingTimeConstant;
        
        const source = audioContext.createMediaStreamSource(microphoneStream);
        source.connect(analyserNode);
        
        dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        
        isAudioInitialized = true;
        startAmplitudeDetection();
        return true;
    } catch (error) {
        console.error('Error initializing audio context:', error);
        return false;
    }
}

function startAmplitudeDetection() {
    if (!isAudioInitialized || !analyserNode || !dataArray) return;
    
    amplitudeDetectionActive = true;
    isAboveThreshold = false;
    
    function detectAmplitude() {
        if (!amplitudeDetectionActive) return;
        
        analyserNode.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const averageAmplitude = sum / dataArray.length;
        const normalizedAmplitude = averageAmplitude / 255;
        
        updateVoiceLevelIndicators(normalizedAmplitude);
        
        const currentTime = Date.now();
        
        if (normalizedAmplitude > VOICE_CONFIG.amplitudeThreshold) {
            if (!isAboveThreshold || (currentTime - lastCommandTime > GAME_CONFIG.tapCooldown)) {
                isAboveThreshold = true;
                handleVoiceCommand('amplitude', 'sound detected');
                lastCommandTime = currentTime;
            }
        } else {
            isAboveThreshold = false;
        }
        
        voiceAnimationFrame = requestAnimationFrame(detectAmplitude);
    }
    
    detectAmplitude();
}

function stopAmplitudeDetection() {
    amplitudeDetectionActive = false;
    isAboveThreshold = false;
    if (voiceAnimationFrame) {
        cancelAnimationFrame(voiceAnimationFrame);
        voiceAnimationFrame = null;
    }
}

function updateVoiceLevelIndicators(level) {
    const voiceLevelBar = document.getElementById('voice-level-bar');
    if (voiceLevelBar) {
        voiceLevelBar.style.width = `${Math.min(level * 100, 100)}%`;
    }
    
    const countdownVoiceBar = document.getElementById('countdown-voice-bar');
    if (countdownVoiceBar) {
        countdownVoiceBar.style.width = `${Math.min(level * 100, 100)}%`;
    }
    
    const gameVoiceBar = document.getElementById('game-voice-bar');
    if (gameVoiceBar) {
        gameVoiceBar.style.width = `${Math.min(level * 100, 100)}%`;
    }
}

function updateThresholdLine() {
    const thresholdLine = document.querySelector('.voice-threshold-line');
    if (thresholdLine) {
        thresholdLine.style.left = `${VOICE_CONFIG.amplitudeThreshold * 100}%`;
    }
}

function handleVoiceCommand(source, command) {
    // Only process voice commands if in voice mode
    if (GAME_CONFIG.controlMode !== 'voice') return;

    if (gameState.calibrationMode) {
        handleCalibrationCommand(source, command);
        return;
    }
    
    if (gameState.waitingForFirstInput) {
        const waitingMessage = document.getElementById('waiting-message');
        if (waitingMessage) {
            waitingMessage.remove();
        }
        gameState.waitingForFirstInput = false;
        gameLoop();
    }
    
    if (gameState.gameRunning && !gameState.gamePaused && !gameState.waitingForFirstInput) {
        flapBird();
        gameState.commandCount++;
        updateCommandCounter();
        showVoiceFeedback(command, source);
        updateMicrophoneStatus('Command Detected!', true);
        
        setTimeout(() => {
            updateMicrophoneStatus('Listening...');
        }, 400);
    }
}

function handleCalibrationCommand(source, command) {
    gameState.testDetectionCount++;
    updateDetectionCount();
    
    const feedback = document.getElementById('voice-test-feedback');
    if (feedback) {
        feedback.textContent = `✅ ${source.toUpperCase()}: "${command}"`;
        feedback.classList.add('detected');
        
        setTimeout(() => {
            feedback.classList.remove('detected');
        }, 1000);
    }
}

function showVoiceFeedback(command, source) {
    let feedback = document.getElementById('voice-feedback');
    if (!feedback) {
        feedback = document.createElement('div');
        feedback.id = 'voice-feedback';
        document.getElementById('game-screen').appendChild(feedback);
    }
    
    const displayText = source === 'amplitude' ? '🔊 SOUND' : `💬 "${command}"`;
    feedback.textContent = displayText;
    feedback.classList.add('show');
    
    setTimeout(() => {
        feedback.classList.remove('show');
    }, 800);
}

function updateCommandCounter() {
    const commandCount = document.getElementById('command-count');
    if (commandCount) {
        commandCount.textContent = gameState.commandCount;
    }
}

function updateDetectionCount() {
    const detectionSpan = document.querySelector('#detection-count span');
    if (detectionSpan) {
        detectionSpan.textContent = gameState.testDetectionCount;
    }
}

function updateMicrophoneStatus(status, detected = false) {
    const micStatus = document.getElementById('mic-status');
    const micIndicator = document.getElementById('mic-indicator');
    const countdownVoiceText = document.getElementById('countdown-voice-text');
    
    if (micStatus) {
        micStatus.textContent = status;
    }
    
    if (countdownVoiceText) {
        countdownVoiceText.textContent = status;
    }
    
    if (micIndicator) {
        micIndicator.classList.remove('listening', 'detected');
        
        if (detected) {
            micIndicator.classList.add('detected');
        } else if (isListening) {
            micIndicator.classList.add('listening');
        }
    }
}

async function requestMicrophonePermission() {
    hideModal('mic-permission-modal');
    
    const audioInitialized = await initializeAudioContext();
    
    if (audioInitialized && recognition) {
        try {
            recognition.start();
            isListening = true;
            updateMicrophoneStatus('Listening...');
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            updateMicrophoneStatus('Permission Denied');
        }
    }
}

function startCalibration() {
    gameState.calibrationMode = true;
    gameState.testDetectionCount = 0;
    updateDetectionCount();
    updateThresholdLine();
    
    const gameSensitivity = document.getElementById('game-sensitivity');
    if (gameSensitivity) {
        gameSensitivity.value = VOICE_CONFIG.amplitudeThreshold;
    }
    
    if (!isAudioInitialized) {
        showModal('mic-permission-modal');
    } else if (!isListening && recognition) {
        try {
            recognition.start();
            isListening = true;
        } catch (error) {
            console.error('Error starting recognition in calibration:', error);
        }
    }
}

function stopCalibration() {
    gameState.calibrationMode = false;
    
    if (recognition && isListening) {
        recognition.stop();
        isListening = false;
    }
}

function toggleVoiceTest() {
    const testBtn = document.getElementById('test-voice-btn');
    
    if (gameState.calibrationMode) {
        gameState.testDetectionCount = 0;
        updateDetectionCount();
        
        if (testBtn) {
            testBtn.textContent = 'Testing... (Try voice commands!)';
            testBtn.disabled = true;
        }
        
        setTimeout(() => {
            if (testBtn) {
                testBtn.textContent = 'Test Voice Commands';
                testBtn.disabled = false;
            }
        }, 5000);
    }
}

function startCountdown() {
    showScreen('countdown');
    gameState.calibrationMode = false;
    
    let count = 3;
    const countdownNumber = document.getElementById('countdown-number');
    
    const updateCountdown = () => {
        if (countdownNumber) {
            countdownNumber.textContent = count;
            countdownNumber.style.animation = 'none';
            setTimeout(() => {
                countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
            }, 10);
        }
        
        count--;
        
        if (count < 0) {
            startGameplay();
        } else {
            setTimeout(updateCountdown, 1000);
        }
    };
    
    updateCountdown();
}

function startGameplay() {
    showScreen('game');
    canvas.focus();
    resetGame();
    gameState.gameRunning = true;
    gameState.gamePaused = false;
    gameState.waitingForFirstInput = true;
    isAboveThreshold = false;
    
    const waitingMessage = document.createElement('div');
    waitingMessage.id = 'waiting-message';
    waitingMessage.textContent = GAME_CONFIG.controlMode === 'voice' 
    ? 'Make a sound OR press SPACE to start!' 
    : 'Press SPACE to start!';
    waitingMessage.style.position = 'absolute';
    waitingMessage.style.top = '50%';
    waitingMessage.style.left = '50%';
    waitingMessage.style.transform = 'translate(-50%, -50%)';
    waitingMessage.style.color = 'white';
    waitingMessage.style.fontSize = '24px';
    waitingMessage.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
    document.getElementById('game-screen').appendChild(waitingMessage);
    
    if (recognition && !isListening) {
        try {
            recognition.start();
            isListening = true;
            updateMicrophoneStatus('Listening...');
        } catch (error) {
            console.error('Error starting speech recognition:', error);
        }
    }
    
    if (isAudioInitialized && !amplitudeDetectionActive) {
        startAmplitudeDetection();
    }
}

function resetGame() {
    gameState.score = 0;
    gameState.commandCount = 0;
    updateScoreDisplay();
    updateCommandCounter();
    updateControlModeUI();
    resetBird();
    pipes = [];
    generateInitialPipes();
}

function resetBird() {
    bird = {
        x: GAME_CONFIG.birdStartX,
        y: GAME_CONFIG.birdStartY,
        velocity: 0,
        size: GAME_CONFIG.birdSize
    };
}

function generateInitialPipes() {
    for (let i = 0; i < 3; i++) {
        pipes.push(createPipe(GAME_CONFIG.gameWidth + i * 300));
    }
}

function createPipe(x) {
    const gapStart = Math.random() * (GAME_CONFIG.gameHeight - GAME_CONFIG.pipeGap - 100) + 50;
    return {
        x: x,
        topHeight: gapStart,
        bottomY: gapStart + GAME_CONFIG.pipeGap,
        bottomHeight: GAME_CONFIG.gameHeight - (gapStart + GAME_CONFIG.pipeGap),
        width: GAME_CONFIG.pipeWidth,
        passed: false
    };
}

function flapBird() {
    if (bird) {
        bird.velocity = GAME_CONFIG.flapStrength;
    }
}

function gameLoop() {
    if (!gameState.gameRunning || gameState.gamePaused || gameState.waitingForFirstInput) {
        return;
    }
    
    updateGame();
    drawGame();
    
    animationFrame = requestAnimationFrame(gameLoop);
}

function updateGame() {
    // Update bird
    bird.velocity += GAME_CONFIG.gravity;
    bird.y += bird.velocity;
    
    // Update pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= GAME_CONFIG.pipeSpeed;
        
        // Check for scoring
        if (!pipes[i].passed && pipes[i].x + pipes[i].width < bird.x) {
            pipes[i].passed = true;
            gameState.score++;
            updateScoreDisplay();
        }
        
        // Remove pipes that are off screen
        if (pipes[i].x + pipes[i].width < 0) {
            pipes.splice(i, 1);
        }
    }
    
    // Add new pipes
    if (pipes.length === 0 || pipes[pipes.length - 1].x < GAME_CONFIG.gameWidth - 300) {
        pipes.push(createPipe(GAME_CONFIG.gameWidth));
    }
    
    // Check collisions
    if (checkCollisions()) {
        endGame();
    }
}

function checkCollisions() {
    // Ground and ceiling collision
    if (bird.y + bird.size > GAME_CONFIG.gameHeight || bird.y < 0) {
        return true;
    }
    
    // Pipe collision
    for (const pipe of pipes) {
        if (bird.x + bird.size > pipe.x && bird.x < pipe.x + pipe.width) {
            if (bird.y < pipe.topHeight || bird.y + bird.size > pipe.bottomY) {
                return true;
            }
        }
    }
    
    return false;
}

function drawGame() {
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, GAME_CONFIG.gameWidth, GAME_CONFIG.gameHeight);
    
    // Draw clouds
    drawClouds();
    
    // Draw pipes
    ctx.fillStyle = '#228B22';
    for (const pipe of pipes) {
        // Top pipe
        ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
        
        // Bottom pipe
        ctx.fillRect(pipe.x, pipe.bottomY, pipe.width, pipe.bottomHeight);
        
        // Pipe caps
        ctx.fillStyle = '#2F4F2F';
        ctx.fillRect(pipe.x - 5, pipe.topHeight - 20, pipe.width + 10, 20);
        ctx.fillRect(pipe.x - 5, pipe.bottomY, pipe.width + 10, 20);
        ctx.fillStyle = '#228B22';
    }
    
    // Draw bird
    drawBird();
    
    // Draw ground
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, GAME_CONFIG.gameHeight - 50, GAME_CONFIG.gameWidth, 50);
}

function drawClouds() {
    if (!ctx) return;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    
    // Static clouds for visual appeal
    drawCloud(150, 100, 40);
    drawCloud(400, 80, 60);
    drawCloud(650, 120, 50);
    drawCloud(200, 200, 35);
    drawCloud(500, 180, 45);
}

function drawCloud(x, y, size) {
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.arc(x + size * 0.6, y, size * 0.8, 0, Math.PI * 2);
    ctx.arc(x + size * 1.2, y, size, 0, Math.PI * 2);
    ctx.arc(x + size * 1.8, y, size * 0.7, 0, Math.PI * 2);
    ctx.arc(x + size * 2.2, y, size * 0.9, 0, Math.PI * 2);
    ctx.fill();
}

function drawBird() {
    if (!ctx || !bird) return;
    
    const centerX = bird.x + bird.size / 2;
    const centerY = bird.y + bird.size / 2;
    
    // Bird body
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, bird.size / 2, bird.size / 2 * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Bird wing
    ctx.fillStyle = '#FFA500';
    ctx.beginPath();
    const wingOffset = bird.velocity < 0 ? -5 : 0;
    ctx.ellipse(centerX - 5, centerY + wingOffset, bird.size / 3, bird.size / 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Bird eye
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(centerX + 8, centerY - 5, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Bird beak
    ctx.fillStyle = '#FF6347';
    ctx.beginPath();
    ctx.moveTo(centerX + bird.size / 2, centerY);
    ctx.lineTo(centerX + bird.size / 2 + 10, centerY - 3);
    ctx.lineTo(centerX + bird.size / 2, centerY + 3);
    ctx.closePath();
    ctx.fill();
}

function updateScoreDisplay() {
    const scoreElement = document.getElementById('current-score');
    if (scoreElement) {
        scoreElement.textContent = gameState.score;
    }
}

function endGame() {
    gameState.gameRunning = false;
    
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }
    
    stopAmplitudeDetection();
    if (recognition && isListening) {
        recognition.stop();
        isListening = false;
    }
    
    addToLeaderboard(gameState.playerName, gameState.score, gameState.commandCount);
    showGameOverScreen();
}

function addToLeaderboard(playerName, score, commands) {
    const entry = {
        playerName: playerName,
        score: score,
        commands: commands,
        date: new Date().toLocaleString()
    };
    
    gameState.highScores.push(entry);
    gameState.highScores.sort((a, b) => b.score - a.score);
    
    if (gameState.highScores.length > 10) {
        gameState.highScores = gameState.highScores.slice(0, 10);
    }
    
    saveHighScores();
}

function showGameOverScreen() {
    const finalScoreElement = document.getElementById('final-score-value');
    const finalCommandsElement = document.getElementById('final-commands');
    const detectionRateElement = document.getElementById('detection-rate');
    
    if (finalScoreElement) {
        finalScoreElement.textContent = gameState.score;
    }
    
    if (finalCommandsElement) {
        finalCommandsElement.textContent = gameState.commandCount;
    }
    
    if (detectionRateElement && gameState.commandCount > 0) {
        const detectionRate = Math.min(100, (gameState.commandCount / Math.max(gameState.commandCount, 1)) * 100);
        detectionRateElement.textContent = `${detectionRate.toFixed(0)}%`;
    }
    
    const isNewRecord = gameState.highScores.length > 0 && 
                       gameState.score === gameState.highScores[0].score;
    
    const newRecordElement = document.getElementById('new-record');
    if (newRecordElement) {
        if (isNewRecord) {
            newRecordElement.classList.remove('hidden');
        } else {
            newRecordElement.classList.add('hidden');
        }
    }
    
    const currentRank = getCurrentPlayerRank();
    const rankElement = document.getElementById('rank-value');
    if (rankElement) {
        rankElement.textContent = currentRank > 0 ? `#${currentRank}` : 'Not in Top 10';
    }
    
    showScreen('gameOver');
}

function getCurrentPlayerRank() {
    for (let i = 0; i < gameState.highScores.length; i++) {
        if (gameState.highScores[i].playerName === gameState.playerName && 
            gameState.highScores[i].score === gameState.score) {
            return i + 1;
        }
    }
    return -1;
}

function showLeaderboard() {
    updateLeaderboardDisplay();
    showScreen('leaderboard');
}

function updateLeaderboardDisplay() {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;
    
    if (gameState.highScores.length === 0) {
        leaderboardList.innerHTML = '<div class="empty-leaderboard">No scores yet! Be the first to play!</div>';
        return;
    }
    
    const currentPlayerName = gameState.playerName;
    
    leaderboardList.innerHTML = gameState.highScores.map((entry, index) => {
        const isCurrentPlayer = entry.playerName === currentPlayerName && 
                               entry.score === gameState.score;
        
        return `
            <div class="leaderboard-entry ${isCurrentPlayer ? 'current-player' : ''}">
                <div class="rank-col">#${index + 1}</div>
                <div class="name-col">${entry.playerName}</div>
                <div class="score-col">${entry.score}</div>
                <div class="commands-col">${entry.commands || 0}</div>
                <div class="date-col">${entry.date}</div>
            </div>
        `;
    }).join('');
}

function togglePause() {
    if (!gameState.gameRunning) return;
    
    gameState.gamePaused = !gameState.gamePaused;
    const pauseBtn = document.getElementById('pause-btn');
    
    if (pauseBtn) {
        if (gameState.gamePaused) {
            pauseBtn.textContent = 'Resume ▶️';
            stopAmplitudeDetection();
            if (recognition && isListening) {
                recognition.stop();
                isListening = false;
            }
        } else {
            pauseBtn.textContent = 'Pause ⏸️';
            gameLoop();
            startAmplitudeDetection();
            if (recognition && !isListening) {
                try {
                    recognition.start();
                    isListening = true;
                } catch (error) {
                    console.log('Error starting recognition:', error);
                }
            }
        }
    }
}

function showScreen(screenName) {
    // Hide all screens
    Object.values(screens).forEach(screen => {
        if (screen) {
            screen.classList.remove('active');
        }
    });
    
    // Show target screen
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
        gameState.currentScreen = screenName;
    }
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

// CSV Storage Functions
function saveHighScores() {
    try {
        // Convert high scores to CSV
        const csvContent = gameState.highScores.map(entry => 
            `"${entry.playerName}",${entry.score},${entry.commands},"${entry.date}"`
        ).join('\n');
        
        // Add header
        const csvWithHeader = "Name,Score,Commands,Date\n" + csvContent;
        
        // Save to localStorage
        localStorage.setItem('flappyBirdLeaderboard', csvWithHeader);
    } catch (error) {
        console.error('Error saving high scores:', error);
    }
}

function loadHighScores() {
    try {
        const csvData = localStorage.getItem('flappyBirdLeaderboard');
        if (!csvData) {
            gameState.highScores = [];
            return;
        }
        
        // Parse CSV
        const lines = csvData.split('\n');
        gameState.highScores = [];
        
        // Skip header line (start from index 1)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                // Handle quoted fields with commas
                const fields = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                if (fields && fields.length >= 4) {
                    const playerName = fields[0].replace(/"/g, '');
                    const score = parseInt(fields[1]);
                    const commands = parseInt(fields[2]);
                    const date = fields[3].replace(/"/g, '');
                    
                    gameState.highScores.push({
                        playerName: playerName,
                        score: score,
                        commands: commands,
                        date: date
                    });
                }
            }
        }
        
        // Sort by score
        gameState.highScores.sort((a, b) => b.score - a.score);
    } catch (error) {
        console.error('Error loading high scores:', error);
        gameState.highScores = [];
    }
}

// In the keyboard event listener (near the end of app.js)
document.addEventListener('keydown', function(e) {
    // Always allow these keys regardless of control mode
    if (e.code === 'KeyP' && gameState.gameRunning) {
        // Pause with P key (works in both modes)
        e.preventDefault();
        togglePause();
        return;
    }
    
    if (e.code === 'Escape') {
        // Escape to go back (works in both modes)
        e.preventDefault();
        if (gameState.currentScreen === 'leaderboard' || gameState.currentScreen === 'gameOver') {
            showScreen('welcome');
        } else if (gameState.currentScreen === 'calibration') {
            stopCalibration();
            showScreen('welcome');
        }
        return;
    }

    // Handle space bar to start game in waiting state (works in both modes)
    if (gameState.waitingForFirstInput && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW')) {
        e.preventDefault();
        const waitingMessage = document.getElementById('waiting-message');
        if (waitingMessage) {
            waitingMessage.remove();
        }
        gameState.waitingForFirstInput = false;
        gameLoop();
        return;
    }

    // Only process other game controls if in keyboard mode
    if (GAME_CONFIG.controlMode !== 'keyboard') return;

    // Rest of the keyboard controls...
    if (gameState.gameRunning && !gameState.gamePaused && !gameState.waitingForFirstInput) {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || 
            e.code === 'Enter' || e.code === 'KeyF') {
            e.preventDefault();
            flapBird();
            gameState.commandCount++;
            updateCommandCounter();
            showVoiceFeedback('keyboard', 'keyboard');
        }
    }
    
    // Calibration screen keyboard test (only in keyboard mode)
    if (gameState.calibrationMode) {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || 
            e.code === 'Enter' || e.code === 'KeyF') {
            e.preventDefault();
            handleVoiceCommand('keyboard', 'keyboard input');
        }
    }
});

console.log('Enhanced Voice-Controlled Flappy Bird with dual detection system loaded!');