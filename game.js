class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.scoreElement = document.getElementById('score');
        this.highScoreElement = document.getElementById('highScore');
        this.gameOverElement = document.getElementById('gameOver');
        
        // Mobile touch controls
        this.setupMobileControls();
        
        // Touch swipe controls
        this.touchStartX = null;
        this.touchStartY = null;
        this.touchStartTime = null;
        this.swipeIndicator = null;
        this.setupTouchControls();
        
        // Adjust canvas size for mobile
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Полностью отключаем все эффекты наклона
        document.addEventListener('mousemove', () => {
            this.canvas.style.transform = 'none';
            this.canvas.style.perspective = 'none';
            this.canvas.style.transform = 'translate(0, 0)';
        });
        
        // Принудительно устанавливаем стили
        this.canvas.style.transform = 'none';
        this.canvas.style.perspective = 'none';
        this.canvas.style.transition = 'none';
        this.canvas.style.transformStyle = 'flat';
        
        // Game settings
        this.tileSize = 20; // Base tile size
        this.gridSize = 20; // Default size, will be updated based on selection
        this.maxSpeed = false; // Флаг для максимальной скорости
        this.inputBuffer = null; // Буфер для следующего ввода
        this.inputDelay = 50; // Задержка между нажатиями клавиш (мс)
        this.lastInputTime = 0; // Время последнего ввода
        this.gameRunning = false; // Flag to track if game is running
        this.startPosition = { x: 5, y: 5 }; // Default starting position
        this.baseInterval = 150; // Default move interval
        this.pendingAdRevival = false; // Flag to track if we're waiting for ad revival
        this.animationFrameId = null; // Store animation frame ID
        this.adRevivalsUsed = 0; // Counter for ad revivals
        this.maxAdRevivals = 3; // Maximum number of ad revivals allowed
        
        // Crystal system
        this.crystals = parseInt(localStorage.getItem('snakeCrystals')) || 0;
        this.crystalElement = document.createElement('div');
        this.crystalElement.id = 'crystals';
        this.crystalElement.style.cssText = `
            position: absolute;
            top: -90px;
            left: 0;
            right: 0;
            color: #9932CC;
            text-align: center;
            font-size: 16px;
            text-shadow: 0 0 10px rgba(153, 50, 204, 0.7);
        `;
        this.crystalElement.textContent = `КРИСТАЛЛЫ: ${this.crystals}`;
        document.querySelector('.game-container').appendChild(this.crystalElement);
        
        // Ad system
        this.adVideoIds = [
            "f_QMb-Ba9YI",
            "TPzfGKFeu_c",
            "f_il9BwhAd0"
        ];
        this.adModal = null;
        this.youtubePlayer = null;
        
        // Load YouTube API
        this.loadYouTubeAPI();
        
        // Special orbs settings
        this.specialOrbTypes = [
            { 
                type: 'negative', 
                color: '#ff0000', 
                gradient: null,
                effect: 'decreaseScore',
                spawnChance: 0.2
            },
            { 
                type: 'positive', 
                color: '#00ff00', 
                gradient: null,
                effect: 'increaseScore',
                spawnChance: 0.3
            },
            { 
                type: 'speedUp', 
                color: '#ffff00', 
                gradient: null,
                effect: 'increaseSpeed',
                spawnChance: 0.25,
                duration: 15000, // 15 seconds
                disappearTime: 15000 // 15 seconds
            },
            { 
                type: 'slowDown', 
                color: '#0000ff', 
                gradient: null,
                effect: 'decreaseSpeed',
                spawnChance: 0.25,
                duration: 15000, // 15 seconds
                disappearTime: 15000 // 15 seconds
            },
            { 
                type: 'crystal', 
                color: '#9932CC', 
                gradient: null,
                effect: 'addCrystal',
                spawnChance: 0.4, // Increased from 0.15 to 0.4 for more frequent spawns
                disappearTime: 12000 // Reduced from 15 to 12 seconds
            }
        ];
        
        // Crystal spawn timing
        this.lastCrystalTime = 0;
        this.crystalSpawnInterval = 7000; // 7 seconds between crystal spawns
        
        // Active effects
        this.activeEffects = {
            speedModifier: 1,
            speedEffectEndTime: 0
        };
        
        // Initialize empty arrays
        this.snake = [];
        this.specialOrbs = [];
        this.previousPositions = [];
        
        // Create size selection menu
        this.createSizeMenu();
        
        // Wait for size selection before starting the game
        this.initialized = false;
        
        // Bind methods to ensure proper 'this' context
        this.gameLoop = this.gameLoop.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.completeAdRevival = this.completeAdRevival.bind(this);
        this.onYouTubeIframeAPIReady = this.onYouTubeIframeAPIReady.bind(this);
        this.onPlayerReady = this.onPlayerReady.bind(this);
        this.onPlayerStateChange = this.onPlayerStateChange.bind(this);
        
        // Set up event listeners
        document.addEventListener('keydown', this.handleKeyPress);
        
        // Make onYouTubeIframeAPIReady globally accessible
        window.onYouTubeIframeAPIReady = this.onYouTubeIframeAPIReady;
    }
    
    loadYouTubeAPI() {
        // Load the YouTube IFrame Player API code asynchronously
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
    
    onYouTubeIframeAPIReady() {
        console.log('YouTube API ready');
        // API is ready, but we don't create the player yet
        // We'll create it when needed for the ad
    }
    
    onPlayerReady(event) {
        console.log('Player ready');
        // Start playing the video when player is ready
        event.target.playVideo();
    }
    
    onPlayerStateChange(event) {
        // When video ends (state = 0), enable the continue button
        if (event.data === YT.PlayerState.ENDED) {
            console.log('Video ended');
            this.enableContinueButton();
        }
    }
    
    enableContinueButton() {
        // Find the continue button in the modal
        const continueButton = this.adModal.querySelector('#continueButton');
        if (continueButton) {
            // Show ad completion message
            const timerDisplay = this.adModal.querySelector('#timerDisplay');
            if (timerDisplay) {
                timerDisplay.textContent = 'Реклама завершена!';
                timerDisplay.style.color = '#00ff00';
            }
            
            // Enable continue button
            continueButton.disabled = false;
            continueButton.style.background = '#FF8C00';
            continueButton.style.borderColor = '#FF8C00';
            continueButton.style.color = '#fff';
            continueButton.style.cursor = 'pointer';
            
            continueButton.onmouseover = () => {
                continueButton.style.background = '#FFA500';
                continueButton.style.transform = 'translateY(-2px)';
                continueButton.style.boxShadow = '0 5px 15px rgba(255, 140, 0, 0.5)';
            };
            
            continueButton.onmouseout = () => {
                continueButton.style.background = '#FF8C00';
                continueButton.style.transform = 'translateY(0)';
                continueButton.style.boxShadow = 'none';
            };
            
            // Add completion message to container
            const playerContainer = this.adModal.querySelector('#playerContainer');
            if (playerContainer) {
                const completionMessage = document.createElement('div');
                completionMessage.textContent = 'Реклама просмотрена!';
                completionMessage.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #00ff00;
                    font-size: 24px;
                    text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
                    background: rgba(0, 0, 0, 0.7);
                    padding: 20px;
                    border-radius: 10px;
                    z-index: 10;
                `;
                playerContainer.appendChild(completionMessage);
            }
        }
    }

    createSizeMenu() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;

        this.menuElement = document.createElement('div');
        this.menuElement.style.cssText = `
            background: #000;
            padding: 30px 50px;
            border-radius: 15px;
            border: 2px solid #00ffff;
            text-align: center;
            min-width: 300px;
        `;

        const title = document.createElement('h2');
        title.textContent = 'Выберите размер поля';
        title.style.cssText = `
            color: #00ffff;
            margin-bottom: 30px;
            font-size: 24px;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
        `;

        const sizes = [10, 20, 40];
        let currentSizeIndex = 1; // Начинаем с 20x20

        const sizeDisplay = document.createElement('div');
        sizeDisplay.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            margin-bottom: 30px;
        `;

        const createArrowButton = (direction) => {
            const button = document.createElement('button');
            button.textContent = direction === 'left' ? '←' : '→';
            button.style.cssText = `
                background: none;
                border: none;
                color: #00ffff;
                font-size: 30px;
                cursor: pointer;
                padding: 0 10px;
                transition: transform 0.2s;
            `;
            button.onmouseover = () => button.style.transform = 'scale(1.2)';
            button.onmouseout = () => button.style.transform = 'scale(1)';
            return button;
        };

        const leftArrow = createArrowButton('left');
        const rightArrow = createArrowButton('right');

        const sizeText = document.createElement('div');
        sizeText.style.cssText = `
            color: #00ffff;
            font-size: 36px;
            font-weight: bold;
            min-width: 150px;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
        `;

        const updateSizeText = () => {
            const size = sizes[currentSizeIndex];
            sizeText.textContent = `${size} x ${size}`;
        };

        leftArrow.onclick = () => {
            if (currentSizeIndex > 0) {
                currentSizeIndex--;
                updateSizeText();
            }
        };

        rightArrow.onclick = () => {
            if (currentSizeIndex < sizes.length - 1) {
                currentSizeIndex++;
                updateSizeText();
            }
        };

        const startButton = document.createElement('button');
        startButton.textContent = 'Начать игру';
        startButton.style.cssText = `
            background: #00ffff;
            color: #000;
            border: none;
            padding: 12px 30px;
            font-size: 18px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s;
            margin-top: 20px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
        `;

        startButton.onmouseover = () => {
            startButton.style.background = '#66ffff';
            startButton.style.transform = 'translateY(-2px)';
            startButton.style.boxShadow = '0 5px 15px rgba(0, 255, 255, 0.4)';
        };

        startButton.onmouseout = () => {
            startButton.style.background = '#00ffff';
            startButton.style.transform = 'translateY(0)';
            startButton.style.boxShadow = 'none';
        };

        startButton.onclick = () => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s';
            setTimeout(() => {
                this.initializeGame(sizes[currentSizeIndex]);
                overlay.remove();
            }, 300);
        };

        updateSizeText();

        sizeDisplay.appendChild(leftArrow);
        sizeDisplay.appendChild(sizeText);
        sizeDisplay.appendChild(rightArrow);

        this.menuElement.appendChild(title);
        this.menuElement.appendChild(sizeDisplay);
        this.menuElement.appendChild(startButton);

        overlay.appendChild(this.menuElement);
        document.body.appendChild(overlay);
    }

    initializeGame(size) {
        this.gridSize = size;
        this.tileSize = Math.min(
            Math.floor(this.canvas.width / size),
            Math.floor(this.canvas.height / size)
        );
        
        // Update canvas size to match grid
        this.canvas.width = this.tileSize * size;
        this.canvas.height = this.tileSize * size;
        
        // Remove menu
        if (this.menuElement) {
            this.menuElement.remove();
        }
        
        // Initialize game components
        this.deathCount = 0;
        
        // For large grids, adjust settings for better performance
        if (size >= 40) {
            // Reduce particle count for large grids
            this.maxParticles = 15;
            
            // Increase the move interval slightly for better playability
            this.baseInterval = 180;
            
            // Adjust snake starting position for large grids
            this.startPosition = {
                x: Math.floor(size / 8),
                y: Math.floor(size / 8)
            };
        } else {
            this.maxParticles = 30;
            this.baseInterval = 150;
            this.startPosition = {
                x: 5,
                y: 5
            };
        }
        
        // Initialize game components
        this.initializeGameComponents();
        
        // Start game with a forced reset
        this.initialized = true;
        this.reset();
        
        // Force immediate rendering of the first frame
        this.draw();
        
        // Use setTimeout to ensure the UI updates before starting the game loop
        setTimeout(() => {
            console.log("Starting game loop for grid size: " + size);
            this.lastRenderTime = performance.now();
            this.lastMoveTime = performance.now();
            this.gameRunning = true;
            
            // Start the game loop
            this.startGameLoop();
        }, 200);
    }

    initializeGameComponents() {
        // Particle systems
        this.particles = new Array(this.maxParticles).fill(null).map(() => ({
            active: false,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            alpha: 0,
            color: ''
        }));
        this.activeParticles = 0;

        // Sound effects
        this.createSoundEffects();
        
        // Load high score
        this.highScore = localStorage.getItem('snakeHighScore') || 0;
        this.highScoreElement.textContent = this.highScore;
        
        // Pre-create gradients
        this.snakeGradient = this.createSnakeGradient();
        this.foodGradient = this.createFoodGradient();
        
        // Create special orb gradients
        this.specialOrbTypes.forEach(orb => {
            orb.gradient = this.createSpecialOrbGradient(orb.color);
        });
        
        // Animation settings
        this.animationProgress = 0;
        this.previousPositions = [];
        
        // Game loop optimization
        this.lastRenderTime = 0;
        this.lastMoveTime = 0;
        this.fps = 60;
        this.fpsInterval = 1000 / this.fps;
    }

    createSoundEffects() {
        // Создаем аудио контекст
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Создаем звук "бульканья"
        this.createBubbleSound = () => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(
                400,
                this.audioContext.currentTime + 0.1
            );
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(
                0.01,
                this.audioContext.currentTime + 0.1
            );
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.1);
        };
    }

    createSnakeGradient() {
        const gradient = this.ctx.createLinearGradient(0, 0, this.tileSize, this.tileSize);
        gradient.addColorStop(0, '#00ffff');
        gradient.addColorStop(1, '#0099ff');
        return gradient;
    }

    createFoodGradient() {
        const gradient = this.ctx.createRadialGradient(
            this.tileSize / 2, this.tileSize / 2, 0,
            this.tileSize / 2, this.tileSize / 2, this.tileSize / 2
        );
        gradient.addColorStop(0, '#ff00ff');
        gradient.addColorStop(1, '#ff0066');
        return gradient;
    }

    createSpecialOrbGradient(color) {
        const gradient = this.ctx.createRadialGradient(
            this.tileSize / 2, this.tileSize / 2, 0,
            this.tileSize / 2, this.tileSize / 2, this.tileSize / 2
        );
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, this.darkenColor(color, 30));
        return gradient;
    }
    
    darkenColor(color, percent) {
        // Convert hex to RGB
        let r = parseInt(color.substring(1, 3), 16);
        let g = parseInt(color.substring(3, 5), 16);
        let b = parseInt(color.substring(5, 7), 16);
        
        // Darken
        r = Math.floor(r * (100 - percent) / 100);
        g = Math.floor(g * (100 - percent) / 100);
        b = Math.floor(b * (100 - percent) / 100);
        
        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    reset() {
        this.snake = [
            { x: this.startPosition.x, y: this.startPosition.y },
            { x: this.startPosition.x - 1, y: this.startPosition.y },
            { x: this.startPosition.x - 2, y: this.startPosition.y }
        ];
        
        this.direction = 'right';
        this.nextDirection = 'right';
        this.score = 0;
        this.gameOver = false;
        this.moveInterval = this.baseInterval;
        this.food = this.generateFood();
        this.specialOrbs = [];
        this.lastMoveTime = 0;
        this.activeParticles = 0;
        this.animationProgress = 0;
        this.previousPositions = this.snake.map(segment => ({ ...segment }));
        this.lastSpecialOrbTime = 0;
        
        // Reset ad revival counter when starting a new game
        this.adRevivalsUsed = 0;
        
        // Reset active effects
        this.activeEffects = {
            speedModifier: 1,
            speedEffectEndTime: 0
        };
        
        this.scoreElement.textContent = this.score;
        this.gameOverElement.style.display = 'none';
        this.createBackgroundBuffer();
        this.inputBuffer = null;
        this.lastInputTime = 0;
        this.inputDelay = 30; // Устанавливаем меньшую задержку ввода
    }

    createBackgroundBuffer() {
        this.bgCanvas = document.createElement('canvas');
        this.bgCanvas.width = this.canvas.width;
        this.bgCanvas.height = this.canvas.height;
        const bgCtx = this.bgCanvas.getContext('2d', { alpha: false });

        // Чистый черный фон
        bgCtx.fillStyle = '#000000';
        bgCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // For large grids, optimize grid drawing
        if (this.gridSize >= 40) {
            // Draw fewer grid lines for better performance
            bgCtx.strokeStyle = '#1a1a1a';
            bgCtx.lineWidth = 1;
            
            // Draw only every 5th line for large grids
            for(let i = 0; i <= this.gridSize; i += 5) {
                // Вертикальные линии
                bgCtx.beginPath();
                bgCtx.moveTo(i * this.tileSize, 0);
                bgCtx.lineTo(i * this.tileSize, this.canvas.height);
                bgCtx.stroke();
                
                // Горизонтальные линии
                bgCtx.beginPath();
                bgCtx.moveTo(0, i * this.tileSize);
                bgCtx.lineTo(this.canvas.width, i * this.tileSize);
                bgCtx.stroke();
            }
        } else {
            // Regular grid for smaller sizes
            bgCtx.strokeStyle = '#1a1a1a';
            bgCtx.lineWidth = 1;
            
            for(let i = 0; i <= this.gridSize; i++) {
                // Вертикальные линии
                bgCtx.beginPath();
                bgCtx.moveTo(i * this.tileSize, 0);
                bgCtx.lineTo(i * this.tileSize, this.canvas.height);
                bgCtx.stroke();
                
                // Горизонтальные линии
                bgCtx.beginPath();
                bgCtx.moveTo(0, i * this.tileSize);
                bgCtx.lineTo(this.canvas.width, i * this.tileSize);
                bgCtx.stroke();
            }
        }
    }

    createParticle(x, y, color) {
        if (this.activeParticles >= this.maxParticles) return null;
        
        const particle = this.particles[this.activeParticles];
        particle.active = true;
        particle.x = x;
        particle.y = y;
        particle.vx = (Math.random() - 0.5) * 4;
        particle.vy = (Math.random() - 0.5) * 4;
        particle.alpha = 1;
        particle.color = color;
        particle.isDiamond = false; // By default, particles are circles
        this.activeParticles++;
        
        return particle;
    }

    updateParticles() {
        let i = 0;
        while (i < this.activeParticles) {
            const particle = this.particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.alpha *= 0.92;
            
            if (particle.alpha < 0.1) {
                particle.active = false;
                this.particles[i] = this.particles[this.activeParticles - 1];
                this.activeParticles--;
            } else {
                i++;
            }
        }
    }
    
    generateFood() {
        let food;
        let attempts = 0;
        const maxAttempts = 50;
        
        // For large grids, we need to be more careful about placement
        const safeDistance = this.gridSize >= 40 ? 3 : 1;
        
        do {
            food = {
                x: Math.floor(Math.random() * this.gridSize),
                y: Math.floor(Math.random() * this.gridSize),
                type: 'regular'
            };
            
            attempts++;
            if (attempts >= maxAttempts) {
                // If we can't find a good spot after many attempts, just place it somewhere valid
                for (let x = 0; x < this.gridSize; x++) {
                    for (let y = 0; y < this.gridSize; y++) {
                        const isSnake = this.snake.some(segment => segment.x === x && segment.y === y);
                        const isSpecialOrb = this.specialOrbs.some(orb => orb.x === x && orb.y === y);
                        
                        if (!isSnake && !isSpecialOrb) {
                            return { x, y, type: 'regular' };
                        }
                    }
                }
                // If we somehow still can't find a spot, place it far from the snake
                return { 
                    x: (this.snake[0].x + Math.floor(this.gridSize / 2)) % this.gridSize,
                    y: (this.snake[0].y + Math.floor(this.gridSize / 2)) % this.gridSize,
                    type: 'regular'
                };
            }
            
            // Check if the food is too close to the snake head
            const head = this.snake[0];
            const tooCloseToHead = Math.abs(food.x - head.x) <= safeDistance && 
                                  Math.abs(food.y - head.y) <= safeDistance;
            
            if (tooCloseToHead) continue;
            
        } while (
            this.snake.some(segment => segment.x === food.x && segment.y === food.y) ||
            this.specialOrbs.some(orb => orb.x === food.x && orb.y === food.y)
        );
        
        return food;
    }
    
    generateSpecialOrb() {
        // For large grids, adjust spawn chances
        if (this.gridSize >= 40) {
            // Reduce spawn chances for large grids to avoid too many orbs
            this.specialOrbTypes.forEach(orb => {
                orb.spawnChance = orb.spawnChance * 0.7;
            });
        }
        
        // Choose a random orb type based on spawn chance
        const totalChance = this.specialOrbTypes.reduce((sum, orb) => sum + orb.spawnChance, 0);
        let random = Math.random() * totalChance;
        let selectedType = null;
        
        for (const orbType of this.specialOrbTypes) {
            random -= orbType.spawnChance;
            if (random <= 0) {
                selectedType = orbType;
                break;
            }
        }
        
        if (!selectedType) return null;
        
        let orb;
        let attempts = 0;
        const maxAttempts = 20;
        
        // For large grids, we need to be more careful about placement
        const safeDistance = this.gridSize >= 40 ? 3 : 1;
        
        do {
            orb = {
                x: Math.floor(Math.random() * this.gridSize),
                y: Math.floor(Math.random() * this.gridSize),
                type: selectedType.type,
                createdAt: performance.now(),
                disappearAt: selectedType.disappearTime ? performance.now() + selectedType.disappearTime : null
            };
            attempts++;
            
            if (attempts >= maxAttempts) return null;
            
            // Check if the orb is too close to the snake head
            const head = this.snake[0];
            const tooCloseToHead = Math.abs(orb.x - head.x) <= safeDistance && 
                                  Math.abs(orb.y - head.y) <= safeDistance;
            
            if (tooCloseToHead) continue;
            
        } while (
            this.snake.some(segment => segment.x === orb.x && segment.y === orb.y) ||
            (this.food.x === orb.x && this.food.y === orb.y) ||
            this.specialOrbs.some(existingOrb => existingOrb.x === orb.x && existingOrb.y === orb.y)
        );
        
        return orb;
    }
    
    handleKeyPress(event) {
        const keyMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right',
            'w': 'up',
            's': 'down',
            'a': 'left',
            'd': 'right'
        };
        
        const newDirection = keyMap[event.key];
        if (!newDirection) return;
        
        this.handleDirectionChange(newDirection);
    }
    
    handleSpecialOrb(orb) {
        const orbType = this.specialOrbTypes.find(type => type.type === orb.type);
        
        if (!orbType) return;
        
        switch (orbType.effect) {
            case 'decreaseScore':
                // Decrease score by 10 and remove one segment
                this.score = Math.max(0, this.score - 10);
                this.scoreElement.textContent = this.score;
                
                if (this.snake.length > 3) {
                    const removedSegment = this.snake.pop();
                    // Create particles for the removed segment
                    for (let i = 0; i < 5; i++) {
                        this.createParticle(
                            removedSegment.x * this.tileSize + this.tileSize / 2,
                            removedSegment.y * this.tileSize + this.tileSize / 2,
                            orbType.color
                        );
                    }
                }
                break;
                
            case 'increaseScore':
                // Increase score by 10 and add one segment
                this.score += 10;
                this.scoreElement.textContent = this.score;
                
                // Add a new segment at the end of the snake
                const tail = this.snake[this.snake.length - 1];
                this.snake.push({ ...tail });
                break;
                
            case 'increaseSpeed':
                // Increase speed by 30% for 15 seconds
                this.activeEffects.speedModifier = 0.7; // 30% faster (lower interval)
                this.activeEffects.speedEffectEndTime = performance.now() + orbType.duration;
                break;
                
            case 'decreaseSpeed':
                // Decrease speed by 30% for 15 seconds
                this.activeEffects.speedModifier = 1.3; // 30% slower (higher interval)
                this.activeEffects.speedEffectEndTime = performance.now() + orbType.duration;
                break;
                
            case 'addCrystal':
                // Add a crystal
                this.crystals++;
                localStorage.setItem('snakeCrystals', this.crystals);
                this.crystalElement.textContent = `КРИСТАЛЛЫ: ${this.crystals}`;
                
                // Create special crystal collection effect - diamond-shaped particles
                for (let i = 0; i < 12; i++) {
                    const particle = this.createParticle(
                        orb.x * this.tileSize + this.tileSize / 2,
                        orb.y * this.tileSize + this.tileSize / 2,
                        orbType.color
                    );
                    
                    // If we have a reference to the particle, make it diamond-shaped
                    if (particle) {
                        particle.isDiamond = true;
                    }
                }
                break;
        }
        
        // Create particles for the collected orb
        for (let i = 0; i < 8; i++) {
            this.createParticle(
                orb.x * this.tileSize + this.tileSize / 2,
                orb.y * this.tileSize + this.tileSize / 2,
                orbType.color
            );
        }
        
        // Play sound effect
        this.createBubbleSound();
    }
    
    moveSnake(currentTime) {
        if (this.gameOver) return false;
        
        // Check if any speed effect has expired
        if (this.activeEffects.speedEffectEndTime > 0 && currentTime >= this.activeEffects.speedEffectEndTime) {
            this.activeEffects.speedModifier = 1;
            this.activeEffects.speedEffectEndTime = 0;
        }
        
        // Apply speed modifier to move interval
        const effectiveInterval = this.moveInterval * this.activeEffects.speedModifier;
        
        if (currentTime - this.lastMoveTime < effectiveInterval) {
            // Update animation progress
            this.animationProgress = (currentTime - this.lastMoveTime) / effectiveInterval;
            return false;
        }
        
        this.lastMoveTime = currentTime;
        
        // Adjust special orb generation timing based on grid size (reduced times)
        const specialOrbInterval = this.gridSize >= 40 ? 6000 : 4000; // Reduced from 8000/5000 to 6000/4000
        
        // Check if it's time to generate a special orb
        if (currentTime - this.lastSpecialOrbTime > specialOrbInterval) {
            // For large grids, limit the number of special orbs but allow more for smaller grids
            const maxSpecialOrbs = this.gridSize >= 40 ? 4 : 7; // Increased from 3/6 to 4/7
            
            if (this.specialOrbs.length < maxSpecialOrbs) {
                const newOrb = this.generateSpecialOrb();
                if (newOrb) {
                    this.specialOrbs.push(newOrb);
                }
            }
            this.lastSpecialOrbTime = currentTime;
        }
        
        // Check if any special orbs should disappear
        this.specialOrbs = this.specialOrbs.filter(orb => {
            if (orb.disappearAt && currentTime >= orb.disappearAt) {
                // Create disappearing particles
                for (let i = 0; i < 5; i++) {
                    const orbType = this.specialOrbTypes.find(type => type.type === orb.type);
                    this.createParticle(
                        orb.x * this.tileSize + this.tileSize / 2,
                        orb.y * this.tileSize + this.tileSize / 2,
                        orbType ? orbType.color : '#ffffff'
                    );
                }
                return false;
            }
            return true;
        });
        
        // Применяем буферизованный ввод, если он есть
        if (this.inputBuffer) {
            this.nextDirection = this.inputBuffer;
            this.inputBuffer = null;
        }
        
        this.direction = this.nextDirection;
        
        // Store previous positions for animation
        this.previousPositions = this.snake.map(segment => ({ ...segment }));
        this.animationProgress = 0;
        
        const head = { ...this.snake[0] };
        
        switch (this.direction) {
            case 'up': head.y--; break;
            case 'down': head.y++; break;
            case 'left': head.x--; break;
            case 'right': head.x++; break;
        }
        
        if (
            head.x < 0 || head.x >= this.gridSize ||
            head.y < 0 || head.y >= this.gridSize ||
            this.snake.some(segment => segment.x === head.x && segment.y === head.y)
        ) {
            this.gameOver = true;
            this.createGameOverScreen();
            this.gameOverElement.style.display = 'block';
            this.deathCount++;
            
            // Update high score if needed
            if (this.score > this.highScore) {
                this.highScore = this.score;
                this.highScoreElement.textContent = this.highScore;
                localStorage.setItem('snakeHighScore', this.highScore);
            }
            return false;
        }
        
        this.snake.unshift(head);
        
        // Check for collision with special orbs
        const collidedOrbIndex = this.specialOrbs.findIndex(orb => orb.x === head.x && orb.y === head.y);
        if (collidedOrbIndex !== -1) {
            const collidedOrb = this.specialOrbs[collidedOrbIndex];
            this.handleSpecialOrb(collidedOrb);
            this.specialOrbs.splice(collidedOrbIndex, 1);
        }
        // Check for collision with regular food
        else if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            this.scoreElement.textContent = this.score;
            this.food = this.generateFood();
            
            // Проверяем достижение максимальной скорости с учетом размера поля
            if (!this.maxSpeed) {
                const speedLimit = this.gridSize === 10 ? 80 : 140;
                if (this.score < speedLimit) {
                    this.moveInterval = Math.max(50, this.moveInterval - 5);
                }
            }
            
            // Создаем эффекты при сборе еды
            for(let i = 0; i < 8; i++) {
                this.createParticle(
                    head.x * this.tileSize + this.tileSize / 2,
                    head.y * this.tileSize + this.tileSize / 2,
                    '#ff00ff'
                );
            }
            
            // Воспроизводим звук
            this.createBubbleSound();
        } else {
            const tail = this.snake.pop();
            this.createParticle(
                tail.x * this.tileSize + this.tileSize / 2,
                tail.y * this.tileSize + this.tileSize / 2,
                '#00ffff'
            );
        }
        
        return true;
    }
    
    update(currentTime) {
        if (this.moveSnake(currentTime)) {
            this.updateParticles();
        }
    }
    
    draw() {
        // Clear the canvas first
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Отрисовка фона
        this.ctx.drawImage(this.bgCanvas, 0, 0);
        
        // For large grids, optimize rendering
        const isLargeGrid = this.gridSize >= 40;
        
        // Отрисовка частиц
        for (let i = 0; i < this.activeParticles; i++) {
            const particle = this.particles[i];
            if (!particle.active) continue;
            
            this.ctx.globalAlpha = particle.alpha;
            this.ctx.fillStyle = particle.color;
            
            if (particle.isDiamond) {
                // Draw diamond-shaped particles for crystals
                const size = isLargeGrid ? 6 : 8;
                
                this.ctx.save();
                this.ctx.translate(particle.x, particle.y);
                this.ctx.rotate(Math.PI / 4); // Rotate 45 degrees
                this.ctx.fillRect(-size / 2, -size / 2, size, size);
                this.ctx.restore();
            } else {
                // Draw regular circular particles
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, isLargeGrid ? 2 : 3, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        this.ctx.globalAlpha = 1;
        
        // Отрисовка змейки
        this.ctx.shadowColor = '#00ffff';
        this.ctx.shadowBlur = isLargeGrid ? 5 : 10;
        
        // Make sure snake is visible even on large grids
        const snakeColor = isLargeGrid ? '#00ffff' : this.snakeGradient;
        
        for (let i = 0; i < this.snake.length; i++) {
            const current = this.snake[i];
            const previous = this.previousPositions[i] || current;
            
            // Интерполяция позиции
            const x = previous.x + (current.x - previous.x) * this.animationProgress;
            const y = previous.y + (current.y - previous.y) * this.animationProgress;
            
            // Преобразование в пиксельные координаты
            const pixelX = x * this.tileSize;
            const pixelY = y * this.tileSize;
            
            // Отрисовка сегмента змейки
            this.ctx.fillStyle = snakeColor;
            this.ctx.fillRect(
                pixelX + (isLargeGrid ? 1 : 2),
                pixelY + (isLargeGrid ? 1 : 2),
                this.tileSize - (isLargeGrid ? 2 : 4),
                this.tileSize - (isLargeGrid ? 2 : 4)
            );
        }
        
        // Отрисовка еды - make sure it's visible
        if (this.food) {
            const foodX = this.food.x * this.tileSize + this.tileSize / 2;
            const foodY = this.food.y * this.tileSize + this.tileSize / 2;
            
            this.ctx.shadowColor = '#ff00ff';
            this.ctx.shadowBlur = isLargeGrid ? 8 : (15 + Math.sin(performance.now() / 200) * 5);
            
            // Use solid color for large grids to ensure visibility
            this.ctx.fillStyle = isLargeGrid ? '#ff00ff' : this.foodGradient;
            
            this.ctx.beginPath();
            this.ctx.arc(
                foodX,
                foodY,
                this.tileSize / (isLargeGrid ? 3.5 : 3),
                0,
                Math.PI * 2
            );
            this.ctx.fill();
        }
        
        // Draw special orbs
        for (const orb of this.specialOrbs) {
            const orbType = this.specialOrbTypes.find(type => type.type === orb.type);
            if (!orbType) continue;
            
            const orbX = orb.x * this.tileSize + this.tileSize / 2;
            const orbY = orb.y * this.tileSize + this.tileSize / 2;
            
            // Pulsating effect for orbs that will disappear
            let scale = 1;
            if (orb.disappearAt) {
                const timeLeft = orb.disappearAt - performance.now();
                if (timeLeft < 5000) { // Start pulsating in the last 5 seconds
                    scale = 0.8 + Math.sin(performance.now() / 100) * 0.2;
                }
            }
            
            this.ctx.shadowColor = orbType.color;
            this.ctx.shadowBlur = isLargeGrid ? 8 : (15 + Math.sin(performance.now() / 200) * 5);
            
            // Use solid color for large grids
            this.ctx.fillStyle = isLargeGrid ? orbType.color : orbType.gradient;
            
            // Draw crystal as a diamond shape if it's a crystal orb, otherwise draw as circle
            if (orbType.type === 'crystal') {
                // Draw a diamond (rotated square) for crystals - INCREASED SIZE
                const size = (this.tileSize / (isLargeGrid ? 2 : 1.8)) * scale;
                
                // Add a glow effect for crystals
                this.ctx.shadowBlur = isLargeGrid ? 12 : 20;
                
                this.ctx.save();
                this.ctx.translate(orbX, orbY);
                this.ctx.rotate(Math.PI / 4); // Rotate 45 degrees
                
                // Add a slight rotation animation
                this.ctx.rotate(Math.sin(performance.now() / 500) * 0.2);
                
                // Draw the main diamond shape
                this.ctx.fillRect(-size / 2, -size / 2, size, size);
                
                // Add a highlight effect
                this.ctx.fillStyle = '#ffffff';
                this.ctx.globalAlpha = 0.4 + Math.sin(performance.now() / 300) * 0.2;
                this.ctx.fillRect(-size / 3, -size / 3, size / 1.5, size / 1.5);
                
                // Add a second smaller highlight for more sparkle
                this.ctx.fillStyle = '#ffffff';
                this.ctx.globalAlpha = 0.7;
                this.ctx.fillRect(-size / 6, -size / 6, size / 3, size / 3);
                
                this.ctx.globalAlpha = 1;
                this.ctx.restore();
                
                // Add a pulsing outer glow
                if (!isLargeGrid) {
                    const pulseSize = size * 1.2;
                    this.ctx.save();
                    this.ctx.translate(orbX, orbY);
                    this.ctx.rotate(Math.PI / 4);
                    this.ctx.strokeStyle = orbType.color;
                    this.ctx.lineWidth = 2;
                    this.ctx.globalAlpha = 0.2 + Math.sin(performance.now() / 200) * 0.1;
                    this.ctx.strokeRect(-pulseSize / 2, -pulseSize / 2, pulseSize, pulseSize);
                    this.ctx.restore();
                }
            } else {
                // Draw regular orbs as circles
                this.ctx.beginPath();
                this.ctx.arc(
                    orbX,
                    orbY,
                    (this.tileSize / (isLargeGrid ? 3.5 : 3)) * scale,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();
            }
        }
        
        this.ctx.shadowBlur = 0;
        
        // Draw active effect indicator
        if (this.activeEffects.speedEffectEndTime > 0) {
            const timeLeft = this.activeEffects.speedEffectEndTime - performance.now();
            const percentage = timeLeft / 15000; // 15 seconds is the duration
            
            this.ctx.fillStyle = this.activeEffects.speedModifier < 1 ? '#ffff00' : '#0000ff';
            this.ctx.globalAlpha = 0.5;
            this.ctx.fillRect(
                10,
                10,
                (this.canvas.width - 20) * percentage,
                5
            );
            this.ctx.globalAlpha = 1;
        }
    }
    
    watchAdForRevive() {
        // Increment the ad revival counter
        this.adRevivalsUsed++;
        
        // Select a random ad video ID
        const randomAdIndex = Math.floor(Math.random() * this.adVideoIds.length);
        const videoId = this.adVideoIds[randomAdIndex];
        
        // Store game state before opening ad
        this.gameRunning = false;
        this.pendingAdRevival = true;
        
        // Cancel any existing animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Create a modal to inform the user
        this.adModal = document.createElement('div');
        this.adModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            color: white;
            font-family: 'Press Start 2P', cursive;
        `;
        
        const adText = document.createElement('div');
        adText.textContent = 'ПРОСМОТР РЕКЛАМЫ';
        adText.style.cssText = `
            margin-bottom: 20px;
            font-size: 24px;
            color: #FF8C00;
            text-shadow: 0 0 10px rgba(255, 140, 0, 0.5);
        `;
        
        const adInfo = document.createElement('div');
        adInfo.textContent = 'Пожалуйста, посмотрите рекламу полностью для возрождения.';
        adInfo.style.fontSize = '14px';
        adInfo.style.marginBottom = '20px';
        adInfo.style.textAlign = 'center';
        
        // Show remaining ad revivals
        const revivals = document.createElement('div');
        revivals.textContent = `Осталось возрождений за рекламу: ${this.maxAdRevivals - this.adRevivalsUsed} из ${this.maxAdRevivals}`;
        revivals.style.fontSize = '12px';
        revivals.style.marginBottom = '20px';
        revivals.style.color = '#FF8C00';
        
        // Create a container for the YouTube player
        const playerContainer = document.createElement('div');
        playerContainer.id = 'playerContainer';
        playerContainer.style.cssText = `
            width: 80%;
            height: 60%;
            max-width: 800px;
            max-height: 600px;
            margin-bottom: 20px;
            border: 2px solid #FF8C00;
            position: relative;
            background: #000;
        `;
        
        // Create a div for the YouTube player
        const playerDiv = document.createElement('div');
        playerDiv.id = 'youtubePlayer';
        playerDiv.style.cssText = `
            width: 100%;
            height: 100%;
        `;
        playerContainer.appendChild(playerDiv);
        
        // Create timer display
        const timerDisplay = document.createElement('div');
        timerDisplay.id = 'timerDisplay';
        timerDisplay.style.cssText = `
            margin-top: 10px;
            font-size: 14px;
            color: #FF8C00;
        `;
        timerDisplay.textContent = 'Загрузка видео...';
        
        // Create continue button (initially disabled)
        const continueButton = document.createElement('button');
        continueButton.id = 'continueButton';
        continueButton.textContent = 'ПРОДОЛЖИТЬ ИГРУ';
        continueButton.style.cssText = `
            margin-top: 20px;
            padding: 15px 30px;
            font-family: 'Press Start 2P', cursive;
            font-size: 14px;
            background: #333;
            border: 2px solid #666;
            color: #666;
            cursor: not-allowed;
            transition: all 0.3s;
            border-radius: 5px;
            text-transform: uppercase;
            letter-spacing: 1px;
        `;
        continueButton.disabled = true;
        
        // Set up continue button click handler
        continueButton.onclick = () => {
            if (!continueButton.disabled) {
                // Complete the revival process
                this.completeAdRevival();
            }
        };
        
        // Add elements to modal
        this.adModal.appendChild(adText);
        this.adModal.appendChild(adInfo);
        this.adModal.appendChild(revivals);
        this.adModal.appendChild(playerContainer);
        this.adModal.appendChild(timerDisplay);
        this.adModal.appendChild(continueButton);
        
        // Add modal to page
        document.body.appendChild(this.adModal);
        
        // Create YouTube player
        if (typeof YT !== 'undefined' && YT.Player) {
            this.createYouTubePlayer(videoId);
        } else {
            // If YouTube API is not loaded yet, wait for it
            window.onYouTubeIframeAPIReady = () => {
                this.createYouTubePlayer(videoId);
            };
        }
    }
    
    createYouTubePlayer(videoId) {
        // Create the YouTube player
        this.youtubePlayer = new YT.Player('youtubePlayer', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'autoplay': 1,
                'controls': 0,
                'disablekb': 1,
                'fs': 0,
                'modestbranding': 1,
                'rel': 0,
                'showinfo': 0
            },
            events: {
                'onReady': this.onPlayerReady,
                'onStateChange': this.onPlayerStateChange
            }
        });
        
        // Update timer display
        const timerDisplay = this.adModal.querySelector('#timerDisplay');
        if (timerDisplay) {
            timerDisplay.textContent = 'Просмотр рекламы...';
        }
    }
    
    completeAdRevival() {
        console.log('Completing ad revival');
        
        // Only proceed if we're still waiting for revival
        if (!this.pendingAdRevival) return;
        
        // Reset the pending flag
        this.pendingAdRevival = false;
        
        // Stop and destroy the YouTube player if it exists
        if (this.youtubePlayer) {
            try {
                this.youtubePlayer.stopVideo();
                this.youtubePlayer.destroy();
                this.youtubePlayer = null;
            } catch (e) {
                console.log('Error stopping YouTube player', e);
            }
        }
        
        // Remove the modal if it exists
        if (this.adModal && this.adModal.parentNode) {
            document.body.removeChild(this.adModal);
            this.adModal = null;
        }
        
        // Hide game over screen
        this.gameOverElement.style.display = 'none';
        
        // Revive the player
        this.reviveAfterAd();
    }
    
    reviveAfterAd() {
        console.log('Reviving after ad');
        
        // Store current score
        const currentScore = this.score;
        
        // Reset game state but keep score
        this.gameOver = false;
        
        // Keep the original snake length
        const snakeLength = this.snake.length;
        this.snake = [];
        
        // Create new snake at starting position with original length
        for (let i = 0; i < snakeLength; i++) {
            this.snake.push({
                x: this.startPosition.x - i,
                y: this.startPosition.y
            });
        }
        
        // Reset direction
        this.direction = 'right';
        this.nextDirection = 'right';
        
        // Keep the current speed (don't reset moveInterval)
        
        // Generate new food
        this.food = this.generateFood();
        
        // Reset animation and timing
        this.previousPositions = this.snake.map(segment => ({ ...segment }));
        this.animationProgress = 0;
        this.lastMoveTime = performance.now();
        this.lastRenderTime = performance.now();
        
        // Restore score
        this.score = currentScore;
        this.scoreElement.textContent = this.score;
        
        // Resume game with a slight delay to ensure everything is ready
        setTimeout(() => {
            console.log('Resuming game after ad with original length: ' + snakeLength);
            this.gameRunning = true;
            
            // Start a new game loop
            this.startGameLoop();
        }, 500);
    }
    
    startGameLoop() {
        console.log('Starting game loop');
        
        // Cancel any existing animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        // Reset timing
        this.lastRenderTime = performance.now();
        
        // Start the game loop
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }
    
    gameLoop(currentTime) {
        // If game is not running, don't continue the loop
        if (!this.initialized || !this.gameRunning) {
            console.log('Game not running, stopping loop');
            return;
        }
        
        // Request next frame
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
        
        const elapsed = currentTime - this.lastRenderTime;
        
        // Limit frame rate for better performance
        if (elapsed > this.fpsInterval) {
            this.lastRenderTime = currentTime - (elapsed % this.fpsInterval);
            
            // Update and draw
            this.update(currentTime);
            this.draw();
        }
    }

    restart() {
        // Cancel any existing animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        this.reset();
        this.gameRunning = true;
        this.startGameLoop();
    }

    createGameOverScreen() {
        // Clear any existing game over content
        this.gameOverElement.innerHTML = '';
        
        const gameOverTitle = document.createElement('div');
        gameOverTitle.textContent = 'ИГРА ОКОНЧЕНА';
        gameOverTitle.style.marginBottom = '20px';
        gameOverTitle.style.fontSize = '24px';
        
        this.gameOverElement.appendChild(gameOverTitle);
        
        // Container for buttons to align them
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
        `;
        
        // Add revival option if player has enough crystals
        if (this.crystals >= 10) {
            const reviveButton = document.createElement('button');
            reviveButton.textContent = 'ВОЗРОДИТЬСЯ (10 КРИСТАЛЛОВ)';
            reviveButton.style.cssText = `
                margin: 5px;
                padding: 15px 30px;
                font-family: 'Press Start 2P', cursive;
                font-size: 14px;
                background: #9932CC;
                border: 2px solid #9932CC;
                color: #fff;
                cursor: pointer;
                transition: all 0.3s;
                border-radius: 5px;
                text-transform: uppercase;
                letter-spacing: 1px;
                width: 100%;
            `;
            
            reviveButton.onmouseover = () => {
                reviveButton.style.background = '#B041FF';
                reviveButton.style.transform = 'translateY(-2px)';
                reviveButton.style.boxShadow = '0 5px 15px rgba(153, 50, 204, 0.5)';
            };
            
            reviveButton.onmouseout = () => {
                reviveButton.style.background = '#9932CC';
                reviveButton.style.transform = 'translateY(0)';
                reviveButton.style.boxShadow = 'none';
            };
            
            reviveButton.onclick = () => {
                this.revive();
            };
            
            buttonsContainer.appendChild(reviveButton);
        } else {
            // Show how many more crystals are needed
            const crystalInfo = document.createElement('div');
            crystalInfo.textContent = `Вам нужно еще ${10 - this.crystals} кристаллов для возрождения`;
            crystalInfo.style.cssText = `
                color: #9932CC;
                margin: 5px;
                font-size: 12px;
            `;
            buttonsContainer.appendChild(crystalInfo);
        }
        
        // Add watch ad button if ad revivals are still available
        if (this.adRevivalsUsed < this.maxAdRevivals) {
            const adButton = document.createElement('button');
            adButton.textContent = `ВОЗРОДИТЬСЯ (СМОТРЕТЬ РЕКЛАМУ) - ${this.maxAdRevivals - this.adRevivalsUsed} из ${this.maxAdRevivals}`;
            adButton.style.cssText = `
                margin: 5px;
                padding: 15px 30px;
                font-family: 'Press Start 2P', cursive;
                font-size: 14px;
                background: #FF8C00;
                border: 2px solid #FF8C00;
                color: #fff;
                cursor: pointer;
                transition: all 0.3s;
                border-radius: 5px;
                text-transform: uppercase;
                letter-spacing: 1px;
                width: 100%;
            `;
            
            adButton.onmouseover = () => {
                adButton.style.background = '#FFA500';
                adButton.style.transform = 'translateY(-2px)';
                adButton.style.boxShadow = '0 5px 15px rgba(255, 140, 0, 0.5)';
            };
            
            adButton.onmouseout = () => {
                adButton.style.background = '#FF8C00';
                adButton.style.transform = 'translateY(0)';
                adButton.style.boxShadow = 'none';
            };
            
            adButton.onclick = () => {
                this.watchAdForRevive();
            };
            
            buttonsContainer.appendChild(adButton);
        } else {
            // Show message that ad revivals are used up
            const adInfo = document.createElement('div');
            adInfo.textContent = 'Лимит возрождений за рекламу исчерпан';
            adInfo.style.cssText = `
                color: #FF8C00;
                margin: 5px;
                font-size: 12px;
            `;
            buttonsContainer.appendChild(adInfo);
        }
        
        // Add retry button
        const retryButton = document.createElement('button');
        retryButton.textContent = 'НАЧАТЬ ЗАНОВО';
        retryButton.style.cssText = `
            margin: 5px;
            padding: 15px 30px;
            font-family: 'Press Start 2P', cursive;
            font-size: 16px;
            background: transparent;
            border: 2px solid #ff0066;
            color: #ff0066;
            cursor: pointer;
            transition: all 0.3s;
            border-radius: 5px;
            text-transform: uppercase;
            letter-spacing: 2px;
            width: 100%;
        `;
        
        retryButton.onmouseover = () => {
            retryButton.style.background = '#ff0066';
            retryButton.style.color = '#000';
            retryButton.style.transform = 'translateY(-2px)';
            retryButton.style.boxShadow = '0 5px 15px rgba(255, 0, 102, 0.5)';
        };
        
        retryButton.onmouseout = () => {
            retryButton.style.background = 'transparent';
            retryButton.style.color = '#ff0066';
            retryButton.style.transform = 'translateY(0)';
            retryButton.style.boxShadow = 'none';
        };
        
        retryButton.onclick = () => {
            this.restart();
        };
        
        buttonsContainer.appendChild(retryButton);
        this.gameOverElement.appendChild(buttonsContainer);
    }
    
    revive() {
        // Spend crystals
        this.crystals -= 10;
        localStorage.setItem('snakeCrystals', this.crystals);
        this.crystalElement.textContent = `КРИСТАЛЛЫ: ${this.crystals}`;
        
        // Store current score
        const currentScore = this.score;
        
        // Reset game state but keep score
        this.gameOver = false;
        this.gameOverElement.style.display = 'none';
        
        // Reset snake to initial length (3 segments)
        this.snake = [];
        for (let i = 0; i < 3; i++) {
            this.snake.push({
                x: this.startPosition.x - i,
                y: this.startPosition.y
            });
        }
        
        // Reset direction
        this.direction = 'right';
        this.nextDirection = 'right';
        
        // Reset speed to initial value
        this.moveInterval = this.baseInterval;
        
        // Generate new food
        this.food = this.generateFood();
        
        // Reset animation and timing
        this.previousPositions = this.snake.map(segment => ({ ...segment }));
        this.animationProgress = 0;
        this.lastMoveTime = performance.now();
        
        // Restore score
        this.score = currentScore;
        this.scoreElement.textContent = this.score;
        
        // Resume game
        this.gameRunning = true;
        this.startGameLoop();
    }

    setupMobileControls() {
        // Setup mobile button controls
        const buttons = {
            'btnUp': 'up',
            'btnDown': 'down',
            'btnLeft': 'left',
            'btnRight': 'right'
        };

        // Создаем контейнер для мобильного управления вне game-container
        this.mobileControls = document.querySelector('.mobile-controls');

        Object.entries(buttons).forEach(([id, direction]) => {
            const button = document.getElementById(id);
            if (button) {
                // Добавляем обработчики для всех типов событий
                ['touchstart', 'touchend', 'touchcancel'].forEach(eventType => {
                    button.addEventListener(eventType, (e) => {
                        e.preventDefault();
                        if (eventType === 'touchstart') {
                            // Визуальный эффект при нажатии
                            button.style.transform = 'scale(0.95)';
                            button.style.background = 'rgba(0, 255, 255, 0.4)';
                            this.handleDirectionChange(direction);
                        } else {
                            // Возвращаем исходный вид при отпускании
                            button.style.transform = 'scale(1)';
                            button.style.background = 'rgba(0, 255, 255, 0.15)';
                        }
                    });
                });
            }
        });

        // Обработчик для скрытия/показа управления при game over
        const gameOverObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.style.display === 'block') {
                    // Прячем управление при game over
                    this.mobileControls.style.display = 'none';
                } else if (mutation.target.style.display === 'none') {
                    // Показываем управление при возобновлении игры
                    if (window.innerWidth <= 768) {
                        this.mobileControls.style.display = 'block';
                    }
                }
            });
        });

        // Начинаем наблюдение за изменениями экрана game over
        gameOverObserver.observe(this.gameOverElement, {
            attributes: true,
            attributeFilter: ['style']
        });
    }

    setupTouchControls() {
        // Setup swipe controls
        this.touchStartX = null;
        this.touchStartY = null;
        this.touchStartTime = null;
        this.swipeIndicator = null;
        
        // Создаем индикатор свайпа
        this.createSwipeIndicator();

        this.canvas.addEventListener('touchstart', (e) => {
            if (this.gameOver) return; // Игнорируем свайпы при game over
            
            e.preventDefault();
            const touch = e.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
            this.touchStartTime = Date.now();
            
            // Показываем индикатор свайпа
            if (this.swipeIndicator) {
                this.swipeIndicator.style.left = `${touch.clientX}px`;
                this.swipeIndicator.style.top = `${touch.clientY}px`;
                this.swipeIndicator.style.opacity = '1';
            }
        });

        this.canvas.addEventListener('touchmove', (e) => {
            if (this.gameOver) return; // Игнорируем свайпы при game over
            
            e.preventDefault();
            if (!this.touchStartX || !this.touchStartY) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - this.touchStartX;
            const deltaY = touch.clientY - this.touchStartY;
            
            // Обновляем позицию индикатора свайпа
            if (this.swipeIndicator) {
                const angle = Math.atan2(deltaY, deltaX);
                const distance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), 50);
                const translateX = Math.cos(angle) * distance;
                const translateY = Math.sin(angle) * distance;
                
                this.swipeIndicator.style.transform = `translate(${translateX}px, ${translateY}px)`;
                
                // Добавляем направляющую линию
                this.swipeIndicator.style.background = `
                    linear-gradient(${angle}rad, 
                    rgba(0, 255, 255, 0.4), 
                    rgba(0, 255, 255, 0.1))
                `;
            }

            // Определяем направление свайпа на лету для более быстрой реакции
            const minSwipeDistance = 15; // Уменьшенное минимальное расстояние для свайпа
            
            if (Math.abs(deltaX) > minSwipeDistance || Math.abs(deltaY) > minSwipeDistance) {
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    // Горизонтальный свайп
                    if (deltaX > 0) {
                        this.handleDirectionChange('right');
                    } else {
                        this.handleDirectionChange('left');
                    }
                } else {
                    // Вертикальный свайп
                    if (deltaY > 0) {
                        this.handleDirectionChange('down');
                    } else {
                        this.handleDirectionChange('up');
                    }
                }
                
                // Обновляем начальную позицию для следующего свайпа
                this.touchStartX = touch.clientX;
                this.touchStartY = touch.clientY;
            }
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            
            // Скрываем индикатор свайпа
            if (this.swipeIndicator) {
                this.swipeIndicator.style.opacity = '0';
                this.swipeIndicator.style.transform = 'translate(0, 0)';
                this.swipeIndicator.style.background = 'rgba(0, 255, 255, 0.2)';
            }

            this.touchStartX = null;
            this.touchStartY = null;
            this.touchStartTime = null;
        });
    }

    createSwipeIndicator() {
        // Создаем визуальный индикатор свайпа
        this.swipeIndicator = document.createElement('div');
        this.swipeIndicator.style.cssText = `
            position: fixed;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(0, 255, 255, 0.2);
            border: 2px solid rgba(0, 255, 255, 0.5);
            pointer-events: none;
            transition: opacity 0.3s;
            opacity: 0;
            z-index: 1000;
            transform: translate(-50%, -50%);
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
            backdrop-filter: blur(5px);
        `;
        document.body.appendChild(this.swipeIndicator);
    }

    handleDirectionChange(newDirection) {
        const currentTime = performance.now();
        if (currentTime - this.lastInputTime < 30) {
            return;
        }

        const opposites = {
            'up': 'down',
            'down': 'up',
            'left': 'right',
            'right': 'left'
        };

        // Если это противоположное направление текущему, игнорируем
        if (opposites[newDirection] === this.direction) {
            return;
        }

        this.lastInputTime = currentTime;
        
        // Немедленно меняем направление, если змейка не в процессе движения
        if (this.animationProgress < 0.3) {
            this.nextDirection = newDirection;
            this.inputBuffer = null;
        } else {
            // Сохраняем ввод в буфер только если это не противоположное направление
            if (!this.inputBuffer || opposites[newDirection] !== this.inputBuffer) {
                this.inputBuffer = newDirection;
            }
        }
    }

    resizeCanvas() {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            const size = Math.min(window.innerWidth - 40, window.innerHeight - 200);
            this.canvas.style.width = `${size}px`;
            this.canvas.style.height = `${size}px`;
        } else {
            this.canvas.style.width = '400px';
            this.canvas.style.height = '400px';
        }
    }
}

// Start the game
const game = new SnakeGame(); 