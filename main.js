/* ===========================================
   HONEYMOON RUSH - Main Game Logic
   =========================================== */

// --- Mobile viewport height fix ---
// On iOS/Android browsers, 100vh isn't always the visible height due to URL/tool bars.
// We set a CSS variable --app-height to the real visual viewport height and use it in CSS.
function updateAppHeight() {
    const vv = window.visualViewport;
    const height = vv?.height || window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
}

function setupViewportFix() {
    updateAppHeight();
    window.addEventListener('resize', updateAppHeight);
    window.addEventListener('orientationchange', updateAppHeight);
    window.visualViewport?.addEventListener('resize', updateAppHeight);
    window.visualViewport?.addEventListener('scroll', updateAppHeight);
}

// --- Hub Door Hitbox Positioning ---
// Maps door coordinates from the source hub_bg.png (640×640) to screen pixels,
// accounting for object-fit:cover cropping on portrait/landscape viewports.
function positionDoorHitboxes() {
    const hubEl = document.getElementById('hub');
    const bgImg = hubEl?.querySelector('.hub-bg');
    if (!hubEl || !bgImg) return;

    const vpW = hubEl.clientWidth;
    const vpH = hubEl.clientHeight;

    // Source image is 640×640 (square)
    const imgW = 640;
    const imgH = 640;
    const imgRatio = imgW / imgH; // 1.0
    const vpRatio = vpW / vpH;

    // object-fit:cover logic — compute rendered size & offset
    let rendW, rendH, offX, offY;
    if (vpRatio > imgRatio) {
        // Viewport is wider → image fills width, crops top/bottom
        rendW = vpW;
        rendH = vpW / imgRatio;
        offX = 0;
        offY = (vpH - rendH) / 2;
    } else {
        // Viewport is taller (typical mobile portrait) → image fills height, crops sides
        rendH = vpH;
        rendW = vpH * imgRatio;
        offX = (vpW - rendW) / 2;
        offY = 0;
    }

    // Map image-% to screen-px
    const imgToScreen = (imgXPct, imgYPct) => ({
        x: offX + (imgXPct / 100) * rendW,
        y: offY + (imgYPct / 100) * rendH
    });

    // Position each door hitbox using its data-img-* attributes
    document.querySelectorAll('.door-hitbox').forEach(btn => {
        const x1 = parseFloat(btn.dataset.imgX1);
        const x2 = parseFloat(btn.dataset.imgX2);
        const y1 = parseFloat(btn.dataset.imgY1);
        const y2 = parseFloat(btn.dataset.imgY2);

        const topLeft = imgToScreen(x1, y1);
        const botRight = imgToScreen(x2, y2);

        const left = topLeft.x;
        const top = topLeft.y;
        const width = botRight.x - topLeft.x;
        const height = botRight.y - topLeft.y;

        btn.style.left = `${left}px`;
        btn.style.top = `${top}px`;
        btn.style.width = `${width}px`;
        btn.style.height = `${height}px`;
    });
}

function setupDoorPositioning() {
    // Initial positioning (may fire before image loads, so also listen for load)
    positionDoorHitboxes();
    const bgImg = document.querySelector('.hub-bg');
    if (bgImg && !bgImg.complete) {
        bgImg.addEventListener('load', positionDoorHitboxes);
    }
    // Re-position on resize / orientation change
    window.addEventListener('resize', positionDoorHitboxes);
    window.addEventListener('orientationchange', () => {
        setTimeout(positionDoorHitboxes, 150);
    });
}

// --- Constants ---
const STORAGE_KEY = 'honeymoon_rush_state';

// --- Game State ---
const GameState = {
    completed: {
        broadway: false,
        taxi: false,
        park: false
    },
    unlockedFinal: false
};

// --- State Management ---
function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(GameState.completed, parsed.completed || {});
            GameState.unlockedFinal = parsed.unlockedFinal || false;
            console.log('[GameState] Loaded from localStorage:', GameState);
        } else {
            console.log('[GameState] No saved state found, using defaults.');
        }
    } catch (e) {
        console.error('[GameState] Error loading state:', e);
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(GameState));
        console.log('[GameState] Saved to localStorage:', GameState);
    } catch (e) {
        console.error('[GameState] Error saving state:', e);
    }
}

const IntroDialog = {
    texts: [
        "¡Nueva York os espera!",
        "Tras un largo vuelo, por fin habéis llegado...",
        "Pero la aventura acaba de empezar.",
        "Tres puertas. Tres desafíos. Una recompensa épica.",
        "Superad cada reto y conseguid las llaves doradas.",
        "¡Solo los más valientes lo lograrán!",
        "¿Estáis listos?"
    ],
    currentIndex: 0,
    charIndex: 0,
    isTyping: false,
    el: null,
    typingSpeed: 70, // Slower for retro feel
    interval: null,

    init() {
        this.el = document.getElementById('hub-dialog');
        if (!this.el) return;

        // Check if intro already seen in this session
        if (sessionStorage.getItem('intro_seen')) {
            this.el.classList.add('hidden');
            return;
        }

        this.el.classList.remove('hidden');
        this.currentIndex = 0;
        this.showCurrentText();

        // Interaction to advance
        // Use a wrapper function to bind 'this' correctly if needed, though arrow func works
        this.clickHandler = (e) => {
            e.stopPropagation();
            this.handleInput();
        };

        this.el.addEventListener('click', this.clickHandler);

        // Also allow clicking anywhere on overlay to advance
        const overlay = document.querySelector('.hub-overlay');
        if (overlay) {
            overlay.addEventListener('click', this.clickHandler);
        }
    },

    showCurrentText() {
        if (this.currentIndex >= this.texts.length) {
            this.endIntro();
            return;
        }

        this.isTyping = true;
        this.charIndex = 0;
        this.el.textContent = "";
        this.el.classList.remove('waiting');

        const currentText = this.texts[this.currentIndex];

        // Clear any existing interval just in case
        if (this.interval) clearInterval(this.interval);

        this.interval = setInterval(() => {
            this.el.textContent += currentText.charAt(this.charIndex);
            this.charIndex++;

            if (this.charIndex >= currentText.length) {
                this.finishTyping();
            }
        }, this.typingSpeed);
    },

    finishTyping() {
        clearInterval(this.interval);
        this.interval = null;
        this.isTyping = false;
        this.el.textContent = this.texts[this.currentIndex]; // Ensure full text
        this.el.classList.add('waiting'); // Show cursor
    },

    handleInput() {
        if (this.currentIndex >= this.texts.length) return;

        if (this.isTyping) {
            // Instant finish
            this.finishTyping();
        } else {
            // Next text
            this.currentIndex++;
            this.showCurrentText();
        }
    },

    endIntro() {
        this.el.classList.add('hidden');
        sessionStorage.setItem('intro_seen', 'true');
        // Clean up listeners if you want, but strictly not necessary for a single page app session
    },

    reset() {
        sessionStorage.removeItem('intro_seen');
        this.el.classList.remove('hidden');
        this.init();
    }
};

function resetState() {
    GameState.completed.broadway = false;
    GameState.completed.taxi = false;
    GameState.completed.park = false;
    GameState.unlockedFinal = false;
    saveState();
    updateUI();
    IntroDialog.reset(); // Restart intro on reset
    console.log('[GameState] State reset.');
    // alert("Progreso reiniciado."); // Removed repetitive alert, intro restart is enough feedback
}

// Debug button listener
document.getElementById('debug-reset-btn')?.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent ensuring clicks on hub background if any
    if (confirm("¿Seguro que quieres borrar todo el progreso?")) {
        resetState();
    }
});

function playBGMHub() {
    const bgmHub = document.getElementById('bgm-hub');
    if (bgmHub) {
        bgmHub.volume = 0.3;
        bgmHub.play().catch(e => console.log("BGM Hub play failed", e));
    }
}

function stopBGMHub() {
    const bgmHub = document.getElementById('bgm-hub');
    if (bgmHub) {
        bgmHub.pause();
        bgmHub.currentTime = 0;
    }
}

// --- Navigation ---
function navigateTo(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });

    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        console.log(`[Navigation] Navigated to: ${screenId}`);

        // Handle Hub BGM logic
        if (screenId === 'hub') {
            playBGMHub();
        } else {
            stopBGMHub();
        }
    } else {
        console.error(`[Navigation] Screen not found: ${screenId}`);
    }
}

// --- UI Updates ---
function updateUI() {
    // Update keys counter (still useful for logic, though maybe not shown in new Hub design directly)
    const keysCount = Object.values(GameState.completed).filter(Boolean).length;
    // const keysCountEl = document.getElementById('keys-count');
    // if (keysCountEl) keysCountEl.textContent = keysCount;

    // Update Hub Door Zones
    const zones = ['broadway', 'taxi', 'park'];
    zones.forEach(zoneId => {
        const zoneEl = document.getElementById(`door-${zoneId}`);
        const isCompleted = GameState.completed[zoneId];

        if (zoneEl) {
            if (isCompleted) {
                zoneEl.classList.add('completed');
                zoneEl.querySelector('.status-icon')?.classList.remove('hidden');
            } else {
                zoneEl.classList.remove('completed');
                zoneEl.querySelector('.status-icon')?.classList.add('hidden');
            }
        }
    });

    // Check if all games completed -> unlock final
    if (keysCount === 3 && !GameState.unlockedFinal) {
        GameState.unlockedFinal = true;
        saveState();
        // Auto-navigate to final screen after a short delay
        setTimeout(() => {
            navigateTo('final');
        }, 1000); // Slightly longer delay to see the last checkmark
    }
}

// --- Game Completion Handler ---
function completeGame(gameId) {
    if (GameState.completed.hasOwnProperty(gameId)) {
        GameState.completed[gameId] = true;
        saveState();
        updateUI();

        console.log(`[Game] Completed: ${gameId}`);

        // Navigate back to hub
        setTimeout(() => {
            navigateTo('hub');
        }, 300);
    }
}

// --- Canvas Helper (for minigames) ---
function setupCanvas(canvasElement) {
    const ctx = canvasElement.getContext('2d');
    if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false; // Safari fallback
        ctx.mozImageSmoothingEnabled = false;    // Firefox fallback
    }
    return ctx;
}

// --- Broadway Minigame Logic ---
const BroadwayGame = {
    sequence: [],
    playerSequence: [],
    level: 1,
    maxLevels: 5,
    colors: ['red', 'blue', 'yellow', 'green'],
    isInputBlocked: true,
    audio: null,
    bgm: null,

    init() {
        this.cacheDOM();
        this.resetGame();
        console.log('[Broadway] Initialized');
    },

    cacheDOM() {
        this.els = {
            screen: document.getElementById('broadway'),
            message: document.getElementById('broadway-message'),
            level: document.getElementById('broadway-level'),
            buttons: document.querySelectorAll('.game-btn'),
            audio: document.getElementById('sfx-button'),
            bgm: document.getElementById('bgm-broadway')
        };
        this.audio = this.els.audio;
        this.bgm = this.els.bgm;
    },

    resetGame() {
        this.sequence = [];
        this.playerSequence = [];
        this.level = 1;
        this.isInputBlocked = true;
        this.updateUI();
    },

    startGame() {
        console.log('[Broadway] Starting new game');
        this.resetGame();
        this.playBGM();
        // Small delay before first round
        setTimeout(() => this.startRound(), 1000);
    },

    stopGame() {
        this.stopBGM();
    },

    playBGM() {
        if (this.bgm) {
            this.bgm.volume = 0.3;
            this.bgm.play().catch(e => console.log("BGM play failed", e));
        }
    },

    stopBGM() {
        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }
    },

    startRound() {
        this.playerSequence = [];
        this.isInputBlocked = true;
        this.setMessage("WATCH!");

        // Add new step
        const nextColor = this.colors[Math.floor(Math.random() * this.colors.length)];
        this.sequence.push(nextColor);
        console.log(`[Broadway] Level ${this.level}, Sequence:`, this.sequence);

        this.updateUI();
        this.playSequence();
    },

    playSequence() {
        let i = 0;
        const interval = setInterval(() => {
            if (i >= this.sequence.length) {
                clearInterval(interval);
                this.isInputBlocked = false;
                this.setMessage("YOUR TURN!");
                return;
            }

            this.highlightButton(this.sequence[i]);
            i++;
        }, 800); // Speed of sequence
    },

    highlightButton(color) {
        const btn = document.querySelector(`.game-btn.${color}`);
        if (btn) {
            // Visual feedback
            btn.classList.add('active');

            // Audio feedback
            if (this.audio) {
                this.audio.currentTime = 0;
                this.audio.play().catch(e => console.warn("Audio play failed", e));
            }

            setTimeout(() => {
                btn.classList.remove('active');
            }, 300);
        }
    },

    handleInput(color) {
        if (this.isInputBlocked) return;

        // Visual feedback immediately on tap
        this.highlightButton(color);
        this.playerSequence.push(color);

        // Check input
        const currentIndex = this.playerSequence.length - 1;

        if (this.playerSequence[currentIndex] !== this.sequence[currentIndex]) {
            this.gameOver();
            return;
        }

        // Check if round complete
        if (this.playerSequence.length === this.sequence.length) {
            this.isInputBlocked = true;
            this.setMessage("GOOD!");

            if (this.level >= this.maxLevels) {
                this.gameWin();
            } else {
                this.level++;
                setTimeout(() => this.startRound(), 1000);
            }
        }
    },

    gameOver() {
        this.isInputBlocked = true;
        this.setMessage("FAIL!");
        document.body.style.backgroundColor = '#500'; // Flash red
        setTimeout(() => {
            document.body.style.backgroundColor = '';
            this.startGame(); // Simple restart for now
        }, 1000);
    },

    gameWin() {
        console.log('[Broadway] WINNER!');
        this.setMessage("SUPERADO!");
        this.stopBGM();
        completeGame('broadway'); // Handled in main global scope
    },

    setMessage(text) {
        if (this.els.message) this.els.message.textContent = text;
    },

    updateUI() {
        if (this.els.level) this.els.level.textContent = this.level;
    }
};

// --- Taxi Minigame Logic (Canvas-based) ---
const TaxiGame = {
    // Constants
    LANE_COUNT: 3,
    GAME_DURATION: 30, // seconds
    OBSTACLE_SPEED: 5,
    SPAWN_INTERVAL: 1200, // ms between obstacles
    TAXI_WIDTH: 52,
    TAXI_HEIGHT: 107, // 52 * (880/427) approx
    OBSTACLE_WIDTH: 35,
    OBSTACLE_HEIGHT: 35,

    // Road image layout constants (from road.png analysis: 1536x2752)
    // These are the pixel positions in the source image
    ROAD_IMG: {
        width: 1536,
        height: 2752,
        roadLeft: 442,      // Where the asphalt starts (after left white line)
        roadRight: 1092,    // Where the asphalt ends (before right white line)
        get roadWidth() { return this.roadRight - this.roadLeft; }, // ~650px
        // Lane dividers at ~650 and ~882 in the source image
        laneDividers: [650, 882],
        // Full visible area including sidewalks
        visibleLeft: 0,
        visibleRight: 1536
    },

    // State
    canvas: null,
    ctx: null,
    isRunning: false,
    animationId: null,
    playerLane: 1, // 0=left, 1=center, 2=right
    obstacles: [],
    timer: 30,
    timerInterval: null,
    lastSpawnTime: 0,
    roadOffset: 0,
    countdownEl: null,
    isCountingDown: false,
    bgm: null,

    // Assets
    assets: {
        taxi: new Image(),
        road: new Image(),
        cone: new Image(),
        hotdog: new Image(),
        pedestrians: new Image() // Sprite sheet
    },

    // Pedestrian sprite sheet config (8 sprites in 2 rows of 4)
    PEDESTRIAN_SPRITE: {
        cols: 4,
        rows: 2,
        count: 8,
        spriteW: 205,
        spriteH: 390
    },

    // Cached dimensions (computed at resize)
    laneWidth: 0,
    lanePositions: [],
    taxiY: 0,
    // Scaling/mapping from road.png coordinates to canvas
    _scale: 1,
    _offsetX: 0,
    _drawRoadLeft: 0,
    _drawRoadRight: 0,
    _drawRoadWidth: 0,

    init() {
        this.canvas = document.getElementById('taxi-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.countdownEl = document.getElementById('taxi-countdown');
        this.bgm = document.getElementById('bgm-taxi');
        if (this.ctx) {
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.webkitImageSmoothingEnabled = false;
            this.ctx.mozImageSmoothingEnabled = false;
        }
        this.loadAssets();
        console.log('[Taxi] Initialized');
    },

    showCountdown(text) {
        if (!this.countdownEl) return;
        this.countdownEl.textContent = text;
        this.countdownEl.classList.remove('hidden');

        // Re-trigger animation
        this.countdownEl.classList.remove('is-animating');
        // Force reflow
        void this.countdownEl.offsetWidth;
        this.countdownEl.classList.add('is-animating');
    },

    hideCountdown() {
        if (!this.countdownEl) return;
        this.countdownEl.classList.add('hidden');
        this.countdownEl.classList.remove('is-animating');
    },

    async runCountdown() {
        // Prevent overlapping countdowns
        if (this.isCountingDown) return;
        this.isCountingDown = true;

        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        this.showCountdown('3');
        await wait(900);
        this.showCountdown('2');
        await wait(900);
        this.showCountdown('1');
        await wait(900);
        this.hideCountdown();

        this.isCountingDown = false;
    },

    loadAssets() {
        // Preload assets
        this.assets.taxi.src = 'assets/taxi.png';
        this.assets.road.src = 'assets/road.png';
        this.assets.cone.src = 'assets/cone.png';
        this.assets.hotdog.src = 'assets/hotdog.png';
        this.assets.pedestrians.src = 'assets/pedestrians.png'; // Sprite sheet
    },

    resizeCanvas() {
        if (!this.canvas) return;

        // Set canvas to full screen
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Disable smoothing after resize
        if (this.ctx) {
            this.ctx.imageSmoothingEnabled = false;
        }

        const cw = this.canvas.width;
        const ch = this.canvas.height;
        const RI = this.ROAD_IMG;

        // Scale the road image to fill the canvas width
        // The entire road.png width maps to the canvas width
        this._scale = cw / RI.width;

        // Map road boundaries from source image to canvas coordinates
        this._drawRoadLeft = RI.roadLeft * this._scale;
        this._drawRoadRight = RI.roadRight * this._scale;
        this._drawRoadWidth = RI.roadWidth * this._scale;

        // Calculate lane width from the actual road area in canvas coords
        this.laneWidth = this._drawRoadWidth / this.LANE_COUNT;

        // Calculate lane center positions based on the road image layout
        this.lanePositions = [];
        for (let i = 0; i < this.LANE_COUNT; i++) {
            this.lanePositions[i] = this._drawRoadLeft + this.laneWidth * i + this.laneWidth / 2;
        }

        // Scale taxi size proportionally to lane width (taxi should be ~75% of lane width)
        this.TAXI_WIDTH = Math.round(this.laneWidth * 0.70);
        this.TAXI_HEIGHT = Math.round(this.TAXI_WIDTH * (880 / 427)); // Maintain taxi aspect ratio

        // Scale obstacle sizes proportionally
        this.OBSTACLE_WIDTH = Math.round(this.laneWidth * 0.55);
        this.OBSTACLE_HEIGHT = Math.round(this.OBSTACLE_WIDTH);

        // Taxi Y position (near bottom, but leaving some margin)
        this.taxiY = ch - this.TAXI_HEIGHT - Math.round(ch * 0.05);

        console.log(`[Taxi] Resized: canvas=${cw}x${ch}, scale=${this._scale.toFixed(3)}, roadOnCanvas=[${this._drawRoadLeft.toFixed(0)},${this._drawRoadRight.toFixed(0)}], laneW=${this.laneWidth.toFixed(0)}, taxiSize=${this.TAXI_WIDTH}x${this.TAXI_HEIGHT}`);
    },

    startGame() {
        console.log('[Taxi] Starting game');
        this.resizeCanvas();
        this.resetState();
        this.setupControls();
        this.playBGM();
        this.isRunning = false;

        // Countdown first, then start movement + timer
        this.runCountdown().then(() => {
            if (!document.getElementById('taxi')?.classList.contains('active')) return;

            this.isRunning = true;
            this.lastSpawnTime = performance.now();

            // Start timer
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);
            this.updateTimerDisplay();

            // Start game loop
            this.gameLoop();
        });
    },

    resetState() {
        this.playerLane = 1;
        this.obstacles = [];
        this.timer = this.GAME_DURATION;
        this.roadOffset = 0;
    },

    stopGame() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.hideCountdown();
        this.isCountingDown = false;
        this.removeControls();
        this.stopBGM();
    },

    setupControls() {
        // Touch controls
        this.touchHandler = (e) => {
            e.preventDefault();
            if (!this.isRunning) return;

            const touch = e.touches[0];
            const halfWidth = this.canvas.width / 2;

            if (touch.clientX < halfWidth) {
                // Left half - move left
                this.playerLane = Math.max(0, this.playerLane - 1);
            } else {
                // Right half - move right
                this.playerLane = Math.min(this.LANE_COUNT - 1, this.playerLane + 1);
            }
        };

        // Mouse fallback for desktop testing
        this.clickHandler = (e) => {
            if (!this.isRunning) return;

            const halfWidth = this.canvas.width / 2;

            if (e.clientX < halfWidth) {
                this.playerLane = Math.max(0, this.playerLane - 1);
            } else {
                this.playerLane = Math.min(this.LANE_COUNT - 1, this.playerLane + 1);
            }
        };

        this.canvas.addEventListener('touchstart', this.touchHandler, { passive: false });
        this.canvas.addEventListener('click', this.clickHandler);
    },

    removeControls() {
        if (this.touchHandler) {
            this.canvas.removeEventListener('touchstart', this.touchHandler);
        }
        if (this.clickHandler) {
            this.canvas.removeEventListener('click', this.clickHandler);
        }
    },

    updateTimer() {
        this.timer--;
        this.updateTimerDisplay();

        if (this.timer <= 0) {
            this.gameWin();
        }
    },

    updateTimerDisplay() {
        const timerEl = document.getElementById('taxi-time');
        if (timerEl) {
            timerEl.textContent = Math.max(0, this.timer);
        }
    },

    spawnObstacle(now) {
        if (now - this.lastSpawnTime < this.SPAWN_INTERVAL) return;

        this.lastSpawnTime = now;

        // Random lane
        const lane = Math.floor(Math.random() * this.LANE_COUNT);

        // Obstacle types: 0=cone, 1=hotdog stand, 2=pedestrian
        const type = Math.floor(Math.random() * 3);

        // Dimensions scaled relative to lane width (set at resizeCanvas)
        let w = this.OBSTACLE_WIDTH;
        let h = this.OBSTACLE_HEIGHT;
        let spriteIndex = null;

        if (type === 1) { // Hotdog stand - BIGGER
            // Original: 696x1020 -> Aspect Ratio ~1.47
            w = Math.round(this.laneWidth * 0.70);
            h = Math.round(w * (1020 / 696));
        } else if (type === 2) { // Pedestrian
            // Random sprite from sheet
            spriteIndex = Math.floor(Math.random() * this.PEDESTRIAN_SPRITE.count);
            w = Math.round(this.laneWidth * 0.50);
            h = Math.round(w * (this.PEDESTRIAN_SPRITE.spriteH / this.PEDESTRIAN_SPRITE.spriteW));
        }

        this.obstacles.push({
            lane: lane,
            y: -h,
            type: type,
            width: w,
            height: h,
            spriteIndex: spriteIndex
        });
    },

    playBGM() {
        if (this.bgm) {
            this.bgm.volume = 0.3;
            this.bgm.play().catch(e => console.log("BGM play failed", e));
        }
    },

    stopBGM() {
        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }
    },

    updateObstacles() {
        // Increase speed slightly as game progresses
        const speedMultiplier = 1 + (this.GAME_DURATION - this.timer) * 0.02;

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.y += this.OBSTACLE_SPEED * speedMultiplier;

            // Remove if off screen
            if (obs.y > this.canvas.height + 50) {
                this.obstacles.splice(i, 1);
            }
        }
    },

    checkCollisions() {
        const taxiX = this.lanePositions[this.playerLane] - this.TAXI_WIDTH / 2;
        const taxiY = this.taxiY;

        for (const obs of this.obstacles) {
            const obsX = this.lanePositions[obs.lane] - obs.width / 2;

            // AABB collision
            if (
                taxiX < obsX + obs.width &&
                taxiX + this.TAXI_WIDTH > obsX &&
                taxiY < obs.y + obs.height &&
                taxiY + this.TAXI_HEIGHT > obs.y
            ) {
                return true;
            }
        }
        return false;
    },

    gameLoop() {
        if (!this.isRunning) return;

        const now = performance.now();

        // Update
        this.spawnObstacle(now);
        this.updateObstacles();

        // Check collision
        if (this.checkCollisions()) {
            this.gameOver();
            return;
        }

        // Draw
        this.draw();

        // Next frame
        this.animationId = requestAnimationFrame(() => this.gameLoop());
    },

    draw() {
        const ctx = this.ctx;
        const cw = this.canvas.width;
        const ch = this.canvas.height;

        // Clear
        ctx.clearRect(0, 0, cw, ch);

        const RI = this.ROAD_IMG;

        // --- Background / Road ---
        if (this.assets.road.complete && this.assets.road.naturalWidth !== 0) {
            // Scrolling road background using the actual road.png
            // The road image is 1536x2752. We scale it to fill the canvas width,
            // then tile it vertically with scrolling.
            if (this._scrollY === undefined) this._scrollY = 0;

            // The scaled height of the road image when it fills canvas width
            const scaledImgH = (RI.height / RI.width) * cw;

            // Speed multiplier for scroll (matches obstacle speed feel)
            const speedMultiplier = 1 + (this.GAME_DURATION - this.timer) * 0.02;
            this._scrollY = (this._scrollY + this.OBSTACLE_SPEED * speedMultiplier) % scaledImgH;

            // Draw enough tiled copies to ALWAYS cover the whole canvas.
            // This fixes the dark band that can appear at the bottom on wrap.
            const startY = -scaledImgH + (this._scrollY % scaledImgH);
            for (let y = startY; y < ch + scaledImgH; y += scaledImgH) {
                ctx.drawImage(
                    this.assets.road,
                    0, 0, RI.width, RI.height,
                    0, y, cw, scaledImgH
                );
            }

        } else {
            // Fallback: Geometric primitive drawing (when image hasn't loaded)
            const roadLeft = this._drawRoadLeft;
            const roadWidth = this._drawRoadWidth;

            // Sidewalks
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(0, 0, cw, ch);

            // Road
            ctx.fillStyle = '#333';
            ctx.fillRect(roadLeft, 0, roadWidth, ch);

            // Road edges (white lines like in the image)
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(roadLeft - 3, 0, 3, ch);
            ctx.fillRect(roadLeft + roadWidth, 0, 3, ch);

            // Lane dividers (dashed white lines)
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.setLineDash([30, 20]);

            // Animate road markings
            this.roadOffset = (this.roadOffset + 4) % 50;
            ctx.lineDashOffset = -this.roadOffset;

            for (let i = 1; i < this.LANE_COUNT; i++) {
                const x = roadLeft + this.laneWidth * i;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, ch);
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }

        // --- Obstacles ---
        for (const obs of this.obstacles) {
            const x = this.lanePositions[obs.lane] - obs.width / 2;

            let img = null;
            if (obs.type === 0) img = this.assets.cone;
            else if (obs.type === 1) img = this.assets.hotdog;
            else if (obs.type === 2) img = this.assets.pedestrians; // Sprite sheet

            if (img && img.complete && img.naturalWidth !== 0) {
                if (obs.type === 2 && obs.spriteIndex !== null) {
                    // Draw specific sprite from pedestrian sheet
                    const sp = this.PEDESTRIAN_SPRITE;
                    const col = obs.spriteIndex % sp.cols;
                    const row = Math.floor(obs.spriteIndex / sp.cols);
                    const sx = col * sp.spriteW;
                    const sy = row * sp.spriteH;
                    ctx.drawImage(img, sx, sy, sp.spriteW, sp.spriteH, x, obs.y, obs.width, obs.height);
                } else {
                    // Draw full image (cone, hotdog)
                    ctx.drawImage(img, x, obs.y, obs.width, obs.height);
                }
            } else {
                // Fallback Shapes
                if (obs.type === 0) {
                    // Cone - orange
                    ctx.fillStyle = '#f97316';
                    ctx.fillRect(x, obs.y, obs.width, obs.height);
                    // White stripes
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(x, obs.y + 8, obs.width, 6);
                    ctx.fillRect(x, obs.y + 20, obs.width, 6);
                } else if (obs.type === 1) {
                    // Hotdog stand - red/yellow
                    ctx.fillStyle = '#ef4444';
                    ctx.fillRect(x, obs.y, obs.width, obs.height);
                    ctx.fillStyle = '#facc15';
                    ctx.beginPath();
                    ctx.arc(x + obs.width / 2, obs.y + 10, obs.width / 2, Math.PI, 0);
                    ctx.fill();
                } else {
                    // Pedestrian - blue
                    ctx.fillStyle = '#3b82f6';
                    ctx.fillRect(x + 5, obs.y + 10, obs.width - 10, obs.height - 10);
                    ctx.fillStyle = '#fcd5b8';
                    ctx.beginPath(); // Head
                    ctx.arc(x + obs.width / 2, obs.y + 5, 8, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // --- Player Taxi ---
        const taxiX = this.lanePositions[this.playerLane] - this.TAXI_WIDTH / 2;

        if (this.assets.taxi.complete && this.assets.taxi.naturalWidth !== 0) {
            ctx.drawImage(this.assets.taxi, taxiX, this.taxiY, this.TAXI_WIDTH, this.TAXI_HEIGHT);
        } else {
            // Fallback Taxi
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(taxiX, this.taxiY, this.TAXI_WIDTH, this.TAXI_HEIGHT);

            ctx.fillStyle = '#d97706';
            ctx.fillRect(taxiX + 5, this.taxiY + 15, this.TAXI_WIDTH - 10, 25);

            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(taxiX + 5, this.taxiY + 20, this.TAXI_WIDTH - 10, 15);

            // Headlights
            ctx.fillStyle = '#fffde7';
            ctx.fillRect(taxiX + 5, this.taxiY, 8, 5);
            ctx.fillRect(taxiX + this.TAXI_WIDTH - 13, this.taxiY, 8, 5);
        }
    },

    showMessage(text) {
        const msgEl = document.getElementById('taxi-message');
        if (msgEl) {
            msgEl.textContent = text;
            msgEl.classList.remove('hidden');
        }
    },

    hideMessage() {
        const msgEl = document.getElementById('taxi-message');
        if (msgEl) {
            msgEl.classList.add('hidden');
        }
    },

    gameOver() {
        console.log('[Taxi] Game Over - Collision!');
        this.stopGame();
        this.showMessage('¡CRASH!');

        // Restart after delay
        setTimeout(() => {
            this.hideMessage();
            this.startGame();
        }, 1500);
    },

    gameWin() {
        console.log('[Taxi] Winner!');
        this.stopGame();
        this.showMessage('¡SUPERADO!');

        setTimeout(() => {
            this.hideMessage();
            completeGame('taxi');
        }, 1000);
    }
};

// --- Central Park Minigame Logic ---
const ParkGame = {
    canvas: null,
    ctx: null,
    isRunning: false,
    animationId: null,
    score: 0,
    targetScore: 10,
    baseGameSpeed: 5,
    baseSpawnInterval: 120,

    // Physics
    gravity: 0.6,
    jumpForce: -12,
    groundY: 0,
    couple: {
        x: 50,
        y: 0,
        width: 95,   // Scaled to match background (646/746 ratio)
        height: 110,
        dy: 0,
        isJumping: false
    },

    // Items
    items: [],
    spawnTimer: 0,
    spawnInterval: 120,
    gameSpeed: 5,
    difficultyThreshold: 8,

    // Background scroll
    bgScrollX: 0,

    // Background image dimensions (central-park-bg.png is 1024x1024)
    BG_IMG: {
        width: 1024,
        height: 1024,
        pathHeightRatio: 0.15 // Path is approx 15% from bottom
    },

    // Assets
    assets: {
        bg: new Image(),
        couple: new Image(),
        items: new Image()
    },

    init() {
        this.canvas = document.getElementById('park-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        if (this.ctx) {
            this.ctx.imageSmoothingEnabled = false;
        }

        // Load assets
        this.assets.bg.src = 'assets/central-park-bg.png';
        this.assets.couple.src = 'assets/couple.png';

        console.log('[Park] Initialized');
    },

    resizeCanvas() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Ground level: based on where the path is in the background image
        // The path starts at ~85% from top (15% from bottom)
        this.groundY = this.canvas.height * 0.88;
    },

    startGame() {
        console.log('[Park] Starting game');
        this.resizeCanvas();
        this.resetState();
        this.setupControls();
        this.playBGM();
        this.isRunning = true;

        // Show instructions briefly
        const inst = document.getElementById('park-instructions');
        if (inst) {
            inst.classList.remove('hidden');
            setTimeout(() => inst.classList.add('hidden'), 3000);
        }

        this.gameLoop();
    },

    resetState() {
        this.score = 0;
        this.items = [];
        this.spawnTimer = 0;
        this.couple.y = this.groundY - this.couple.height;
        this.couple.dy = 0;
        this.couple.isJumping = false;
        this.updateScoreDisplay();
        this.hideMessage();
    },

    stopGame() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.removeControls();
        this.stopBGM();
    },

    setupControls() {
        this.inputHandler = (e) => {
            e.preventDefault();
            if (!this.isRunning) return;
            this.pumpJump();
        };

        this.canvas.addEventListener('touchstart', this.inputHandler, { passive: false });
        this.canvas.addEventListener('mousedown', this.inputHandler);
    },

    removeControls() {
        if (this.inputHandler) {
            this.canvas.removeEventListener('touchstart', this.inputHandler);
            this.canvas.removeEventListener('mousedown', this.inputHandler);
        }
    },

    pumpJump() {
        if (!this.couple.isJumping) {
            this.couple.dy = this.jumpForce;
            this.couple.isJumping = true;
        }
    },

    playBGM() {
        const bgm = document.getElementById('bgm-park');
        if (bgm) {
            bgm.volume = 0.3;
            bgm.play().catch(e => console.log("BGM Park play failed", e));
        }
    },

    stopBGM() {
        const bgm = document.getElementById('bgm-park');
        if (bgm) {
            bgm.pause();
            bgm.currentTime = 0;
        }
    },

    updateDifficulty() {
        // Increase difficulty after reaching threshold
        if (this.score >= this.difficultyThreshold) {
            this.gameSpeed = this.baseGameSpeed * 1.5;
            this.spawnInterval = this.baseSpawnInterval * 0.6; // Faster spawning
        } else {
            this.gameSpeed = this.baseGameSpeed;
            this.spawnInterval = this.baseSpawnInterval;
        }
    },

    spawnItem() {
        this.spawnTimer++;
        if (this.spawnTimer > this.spawnInterval) {
            this.spawnTimer = 0;

            // Increase bad item chance after threshold
            const badChance = this.score >= this.difficultyThreshold ? 0.5 : 0.35;
            const isBad = Math.random() < badChance;
            const type = isBad ? (Math.random() < 0.5 ? 'squirrel' : 'cyclist') : (Math.random() < 0.5 ? 'balloon' : 'pretzel');

            let y = this.groundY - 40; // Default Low
            if (type === 'balloon') {
                y = this.groundY - 150; // High
            }

            this.items.push({
                x: this.canvas.width,
                y: y,
                width: 40,
                height: 40,
                type: type,
                isBad: isBad
            });
        }
    },

    update() {
        // Update difficulty
        this.updateDifficulty();

        // Physics
        this.couple.dy += this.gravity;
        this.couple.y += this.couple.dy;

        // Ground collision
        if (this.couple.y + this.couple.height > this.groundY) {
            this.couple.y = this.groundY - this.couple.height;
            this.couple.dy = 0;
            this.couple.isJumping = false;
        }

        // Items
        for (let i = this.items.length - 1; i >= 0; i--) {
            let item = this.items[i];
            item.x -= this.gameSpeed;

            // Remove off-screen
            if (item.x + item.width < 0) {
                this.items.splice(i, 1);
                continue;
            }

            // Collision
            if (
                this.couple.x < item.x + item.width &&
                this.couple.x + this.couple.width > item.x &&
                this.couple.y < item.y + item.height &&
                this.couple.y + this.couple.height > item.y
            ) {
                // Hit!
                if (item.isBad) {
                    this.gameOver();
                    return;
                } else {
                    // Good item
                    this.score++;
                    this.updateScoreDisplay();
                    this.items.splice(i, 1);

                    if (this.score >= this.targetScore) {
                        this.gameWin();
                        return;
                    }
                }
            }
        }

        this.spawnItem();
    },

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // --- Scrolling Background ---
        if (this.assets.bg.complete && this.assets.bg.naturalWidth !== 0) {
            // Scale background to fill canvas height, maintaining aspect ratio
            const bgAspect = this.BG_IMG.width / this.BG_IMG.height;
            const scaledBgW = h * bgAspect;
            const scaledBgH = h;

            // Update scroll position
            this.bgScrollX = (this.bgScrollX + this.gameSpeed) % scaledBgW;

            // Draw two copies for seamless loop
            ctx.drawImage(this.assets.bg, -this.bgScrollX, 0, scaledBgW, scaledBgH);
            ctx.drawImage(this.assets.bg, scaledBgW - this.bgScrollX, 0, scaledBgW, scaledBgH);
        } else {
            // Fallback: Simple colored background
            ctx.fillStyle = '#87CEEB';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#228B22';
            ctx.fillRect(0, this.groundY, w, h - this.groundY);
            ctx.fillStyle = '#888888';
            ctx.fillRect(0, this.groundY, w, 20);
        }

        // Couple
        if (this.assets.couple.complete && this.assets.couple.naturalWidth !== 0) {
            ctx.drawImage(this.assets.couple, this.couple.x, this.couple.y, this.couple.width, this.couple.height);
        } else {
            ctx.fillStyle = '#FF69B4';
            ctx.fillRect(this.couple.x, this.couple.y, this.couple.width, this.couple.height);
        }

        // Draw Items
        for (const item of this.items) {
            if (item.isBad) {
                ctx.fillStyle = '#8B0000'; // Dark Red
                if (item.type === 'squirrel') ctx.fillStyle = '#A0522D'; // Brown

                // Draw Bad Item
                ctx.fillRect(item.x, item.y, item.width, item.height);

                // Label
                ctx.fillStyle = '#FFF';
                ctx.font = '10px monospace';
                ctx.fillText('BAD', item.x, item.y - 5);
            } else {
                ctx.fillStyle = '#FFA500'; // Orange
                if (item.type === 'balloon') {
                    ctx.fillStyle = '#FF4500'; // Red Balloon
                    // String
                    ctx.beginPath();
                    ctx.moveTo(item.x + item.width / 2, item.y + item.height);
                    ctx.lineTo(item.x + item.width / 2, item.y + item.height + 20);
                    ctx.stroke();
                }

                // Draw Good Item
                ctx.fillRect(item.x, item.y, item.width, item.height);
            }
        }
    },

    gameLoop() {
        if (!this.isRunning) return;

        this.update();
        if (this.isRunning) {
            this.draw();
            this.animationId = requestAnimationFrame(() => this.gameLoop());
        }
    },

    updateScoreDisplay() {
        const el = document.getElementById('park-score-val');
        if (el) el.textContent = `${this.score}/${this.targetScore}`;
    },

    showMessage(text) {
        const msgEl = document.getElementById('park-message');
        if (msgEl) {
            msgEl.textContent = text;
            msgEl.classList.remove('hidden');
        }
    },

    hideMessage() {
        const msgEl = document.getElementById('park-message');
        if (msgEl) msgEl.classList.add('hidden');
    },

    gameOver() {
        this.stopGame();
        this.showMessage('¡OH NO!');
        setTimeout(() => {
            this.startGame();
        }, 1500);
    },

    gameWin() {
        this.stopGame();
        this.showMessage('¡CONSEGUIDO!');
        setTimeout(() => {
            completeGame('park');
        }, 1500);
    }
};

// --- Touch Event Prevention (for game areas) ---
function preventDefaultTouch(element) {
    element.addEventListener('touchstart', (e) => {
        // Allow clicks on buttons/inputs if needed, but prevent scroll
        // For broadway buttons, we handle formatting
    }, { passive: false });

    element.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Hub Door Hitboxes (circular buttons)
    document.querySelectorAll('.door-hitbox').forEach(zone => {
        zone.addEventListener('click', () => {
            // If completed, do nothing (CSS handles pointer-events, but double check)
            if (zone.classList.contains('completed')) return;

            const gameId = zone.dataset.game;
            if (gameId) {
                navigateTo(gameId);
            }
        });
    });

    // Back buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;

            // Stop Broadway music if we are leaving it
            if (document.getElementById('broadway').classList.contains('active')) {
                BroadwayGame.stopGame();
            }

            // Stop Taxi game if we are leaving it
            if (document.getElementById('taxi').classList.contains('active')) {
                TaxiGame.stopGame();
            }

            if (target) {
                navigateTo(target);
            }
        });
    });

    // Dev buttons (for testing)
    document.getElementById('dev-complete-broadway')?.addEventListener('click', () => {
        completeGame('broadway');
    });

    document.getElementById('dev-complete-taxi')?.addEventListener('click', () => {
        completeGame('taxi');
    });

    document.getElementById('dev-complete-park')?.addEventListener('click', () => {
        completeGame('park');
    });

    // Broadway Game Buttons
    document.querySelectorAll('.game-btn').forEach(btn => {
        // Handle both click and touchstart to ensure 3D effect works on mobile
        const handleBtn = (e) => {
            e.preventDefault(); // Prevent double firing
            const color = btn.dataset.color;
            if (color) BroadwayGame.handleInput(color);
        };

        btn.addEventListener('mousedown', handleBtn);
        btn.addEventListener('touchstart', handleBtn, { passive: false });
    });

    // Start Broadway game when navigating to it
    // We can hook into the navigateTo function via a customized way or just check here 
    // For simplicity, we'll modify navigateTo logic or add a MutationObserver/Event
    // Actually, simpler: when clicking the door, we also init the game.
    document.getElementById('door-broadway')?.addEventListener('click', () => {
        // wait for transition
        setTimeout(() => BroadwayGame.startGame(), 500);
    });

    // Start Taxi game when navigating to it
    document.getElementById('door-taxi')?.addEventListener('click', () => {
        setTimeout(() => TaxiGame.startGame(), 500);
    });

    // Start Park game when navigating to it
    document.getElementById('door-park')?.addEventListener('click', () => {
        setTimeout(() => ParkGame.startGame(), 500);
    });

    // Stop Park game if leaving
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            if (document.getElementById('park').classList.contains('active')) {
                ParkGame.stopGame();
            }
        });
    });

    // Prevent touch default behavior on game areas
    document.querySelectorAll('.game-area').forEach(area => {
        preventDefaultTouch(area);
    });

    // Init game modules
    BroadwayGame.init();
    TaxiGame.init();
    ParkGame.init();

    // --- Audio Auto-Play Handling ---
    // Start Hub music on first user interaction (to bypass browser autoplay policy)
    const handleFirstInteraction = () => {
        const hubScreen = document.getElementById('hub');
        if (hubScreen && hubScreen.classList.contains('active')) {
            playBGMHub();
        }
        // Remove listeners after first use
        document.removeEventListener('click', handleFirstInteraction);
        document.removeEventListener('touchstart', handleFirstInteraction);
    };
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
}

// --- Initialization ---
function init() {
    console.log('[App] Initializing Honeymoon Rush...');

    setupViewportFix();
    setupDoorPositioning();

    loadState();
    updateUI();
    setupEventListeners();

    // Ensure Hub is shown on start (unless final is unlocked)
    if (GameState.unlockedFinal) {
        navigateTo('final');
    } else {
        navigateTo('hub');
    }

    // Initialize Intro Dialog
    IntroDialog.init();

    console.log('[App] Initialization complete.');
}

// --- Start App ---
document.addEventListener('DOMContentLoaded', init);
