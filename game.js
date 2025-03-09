class SnakeGame {
    constructor(canvas, scoreElement, highScoreElement, gameOverElement) {
        // Initialize canvas and UI elements
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.scoreElement = scoreElement;
        this.highScoreElement = highScoreElement;
        this.gameOverElement = gameOverElement;

        // Set up game dimensions
        this.setupGameDimensions();

        // Initialize game state
        this.snake = [
            {x: Math.floor(this.gridSize/2), y: Math.floor(this.gridSize/2)},
            {x: Math.floor(this.gridSize/2)-1, y: Math.floor(this.gridSize/2)},
            {x: Math.floor(this.gridSize/2)-2, y: Math.floor(this.gridSize/2)}
        ];
        this.direction = {x: 1, y: 0};
        this.nextDirection = {x: 1, y: 0};
        this.food = this.generateFood();
        this.crystal = this.generateCrystal();
        this.score = 0;
        this.crystals = parseInt(localStorage.getItem('snakeCrystals')) || 0;
        this.highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;
        this.gameSpeed = 200;
        this.lastRenderTime = 0;
        this.gameOver = false;
        
        // Animation properties
        this.moveProgress = 0;
        this.currentAngle = 0;
        this.targetAngle = 0;
        this.rotationSpeed = 0.08;
        this.smoothness = 0.15;
        this.segmentSpacing = 0.15;
        this.trail = [];
        this.maxTrailLength = 8;
        this.lastPos = null;
        
        // Add ad modal
        this.createAdModal();

        // Display initial high score
        this.highScoreElement.textContent = this.highScore;

        // Create UI elements regardless of device type
        this.createMenuButton();
        this.createCrystalCounter();
        
        // Initialize controls
        this.initializeControls();

        // Update initial score display
        this.updateScore();
        this.updateCrystalCounter();
        
        // Force initial render
        this.draw();
        
        // Start game loop
        requestAnimationFrame(() => this.gameLoop());
    }

    setupGameDimensions() {
        if (window.innerWidth <= 768) {
            // Mobile dimensions
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            const size = Math.min(screenWidth - 40, Math.min(screenHeight - 200, 400));
            
            this.canvas.width = size;
            this.canvas.height = size;
        } else {
            // Desktop dimensions
            this.canvas.width = 400;
            this.canvas.height = 400;
        }
        
        this.tileSize = this.canvas.width / 20; // 20x20 grid
        this.gridSize = 20;
    }

    draw() {
        // Clear canvas with subtle fade
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Calculate current position with bezier interpolation
        const progress = this.smoothStep(this.moveProgress);
        const head = this.snake[0];
        
        // Calculate smooth position with bezier curve
        let drawX, drawY;
        if (this.lastPos) {
            // Use bezier curve for smoother movement
            const t = progress;
            const cp1x = this.lastPos.x + this.direction.x * 0.5;
            const cp1y = this.lastPos.y + this.direction.y * 0.5;
            const cp2x = head.x - this.direction.x * 0.5;
            const cp2y = head.y - this.direction.y * 0.5;
            
            drawX = this.bezierPoint(this.lastPos.x, cp1x, cp2x, head.x, t);
            drawY = this.bezierPoint(this.lastPos.y, cp1y, cp2y, head.y, t);
        } else {
            drawX = head.x + this.direction.x * progress;
            drawY = head.y + this.direction.y * progress;
        }

        // Draw snake body with improved smoothness
        for (let i = this.snake.length - 1; i >= 0; i--) {
            const segment = this.snake[i];
            const segmentProgress = Math.max(0, progress - (i * this.segmentSpacing));
            let segX = segment.x;
            let segY = segment.y;
            
            if (i === 0) {
                segX = drawX;
                segY = drawY;
            } else {
                const prev = this.snake[i - 1];
                if (segmentProgress > 0) {
                    const eased = this.smoothStep(segmentProgress);
                    segX = this.lerp(segment.x, prev.x, eased);
                    segY = this.lerp(segment.y, prev.y, eased);
                }
            }

            // Draw segment with enhanced effects
            this.ctx.save();
            this.ctx.translate((segX + 0.5) * this.tileSize, (segY + 0.5) * this.tileSize);
            
            if (i === 0) {
                // Ultra smooth head rotation
                this.targetAngle = Math.atan2(this.direction.y, this.direction.x);
                const angleDiff = this.targetAngle - this.currentAngle;
                const normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
                this.currentAngle += normalizedDiff * this.rotationSpeed;
                this.ctx.rotate(this.currentAngle);

                // Draw head with enhanced gradient
                const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.tileSize);
                gradient.addColorStop(0, '#ffffff');
                gradient.addColorStop(0.2, '#00ffff');
                gradient.addColorStop(0.5, '#0088ff');
                gradient.addColorStop(1, '#0066cc');
                this.ctx.fillStyle = gradient;
                
                // Smooth glow effect
                this.ctx.shadowColor = '#00ffff';
                this.ctx.shadowBlur = 15;
                
                const size = this.tileSize * 0.9;
                this.ctx.beginPath();
                this.ctx.roundRect(-size/2, -size/2, size, size, 8);
                this.ctx.fill();

                // Draw eyes with smooth highlights
                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = '#000';
                const eyeSize = this.tileSize / 5;
                const eyeOffset = size/3;
                
                this.ctx.beginPath();
                this.ctx.arc(eyeOffset, -size/4, eyeSize, 0, Math.PI * 2);
                this.ctx.arc(eyeOffset, size/4, eyeSize, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.fillStyle = '#fff';
                this.ctx.beginPath();
                this.ctx.arc(eyeOffset + eyeSize/3, -size/4 - eyeSize/3, eyeSize/3, 0, Math.PI * 2);
                this.ctx.arc(eyeOffset + eyeSize/3, size/4 - eyeSize/3, eyeSize/3, 0, Math.PI * 2);
                this.ctx.fill();
            } else {
                // Draw body segments with smooth transitions
                const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.tileSize);
                gradient.addColorStop(0, '#0088ff');
                gradient.addColorStop(0.6, '#0066cc');
                gradient.addColorStop(1, '#004499');
                this.ctx.fillStyle = gradient;
                
                const size = this.tileSize * (0.85 - (i * 0.01));
                this.ctx.shadowColor = '#0066cc';
                this.ctx.shadowBlur = 10;
                
                this.ctx.beginPath();
                this.ctx.roundRect(-size/2, -size/2, size, size, 6);
                this.ctx.fill();
            }
            
            this.ctx.restore();
        }

        // Draw food and crystal
        if (this.food) {
            this.drawFood();
        }
        if (this.crystal) {
            this.drawCrystal();
        }
    }

    drawFood() {
        const x = this.food.x * this.tileSize + this.tileSize / 2;
        const y = this.food.y * this.tileSize + this.tileSize / 2;
        
        this.ctx.save();
        this.ctx.translate(x, y);
        
        // Add glow
        this.ctx.shadowColor = '#ff0000';
        this.ctx.shadowBlur = 15;
        
        // Create gradient
        const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.tileSize/2);
        gradient.addColorStop(0, '#ff6666');
        gradient.addColorStop(0.5, '#ff0000');
        gradient.addColorStop(1, '#cc0000');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, this.tileSize/2 * 0.8, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    drawCrystal() {
        const x = this.crystal.x * this.tileSize + this.tileSize / 2;
        const y = this.crystal.y * this.tileSize + this.tileSize / 2;
        
        this.ctx.save();
        this.ctx.translate(x, y);
        
        // Add glow
        this.ctx.shadowColor = '#9932CC';
        this.ctx.shadowBlur = 15;
        
        // Create gradient
        const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.tileSize/2);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.5, '#9932CC');
        gradient.addColorStop(1, '#4B0082');
        
        this.ctx.fillStyle = gradient;
        
        // Draw crystal shape
        const size = this.tileSize * 0.7;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -size/2);
        this.ctx.lineTo(size/2, 0);
        this.ctx.lineTo(0, size/2);
        this.ctx.lineTo(-size/2, 0);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.restore();
    }

    gameLoop(currentTime = 0) {
        if (this.gameOver) return;

        requestAnimationFrame(time => this.gameLoop(time));

        if (this.lastRenderTime === 0) {
            this.lastRenderTime = currentTime;
            return;
        }

        const timeSinceLastRender = currentTime - this.lastRenderTime;
        this.moveProgress = Math.min(1, timeSinceLastRender / this.gameSpeed);

        if (timeSinceLastRender >= this.gameSpeed) {
            const nextPos = {
                x: this.snake[0].x + this.nextDirection.x,
                y: this.snake[0].y + this.nextDirection.y
            };

            // Check collisions
            if (nextPos.x < 0 || nextPos.x >= this.gridSize || 
                nextPos.y < 0 || nextPos.y >= this.gridSize ||
                this.snake.slice(1).some(segment => 
                    segment.x === nextPos.x && segment.y === nextPos.y)) {
                this.showGameOver();
                return;
            }

            // Store last position for smooth interpolation
            this.lastPos = {...this.snake[0]};
            
            this.direction = {...this.nextDirection};
            this.update();
            this.moveProgress = 0;
            this.lastRenderTime = currentTime;
        }

        this.draw();
    }

    update() {
        const newHead = {
            x: this.snake[0].x + this.direction.x,
            y: this.snake[0].y + this.direction.y
        };

        // Add new head
        this.snake.unshift(newHead);

        // Check if food is eaten
        if (newHead.x === this.food.x && newHead.y === this.food.y) {
            this.score += 10;
            this.updateScore();
        this.food = this.generateFood();
            this.gameSpeed = Math.max(50, this.gameSpeed - 2);
        } else {
            this.snake.pop();
        }

        // Check if crystal is collected
        if (this.crystal && 
            newHead.x === this.crystal.x && 
            newHead.y === this.crystal.y) {
            this.crystals++;
            this.crystal = this.generateCrystal();
            this.updateCrystalCounter();
        }
    }

    checkWallCollision(position) {
        // Wall collision check with integer positions
        return Math.floor(position.x) < 0 || Math.floor(position.x) >= this.gridSize ||
               Math.floor(position.y) < 0 || Math.floor(position.y) >= this.gridSize;
    }

    checkSelfCollision(position) {
        // Skip collision check for first few frames
        if (this.frameCount < 5) return false;
        
        const headX = Math.round(position.x);
        const headY = Math.round(position.y);
        
        return this.snake.slice(1).some(segment => {
            const segX = Math.round(segment.x);
            const segY = Math.round(segment.y);
            return segX === headX && segY === headY;
        });
    }
    
    generateFood() {
        let food;
        do {
            food = {
                x: Math.floor(Math.random() * this.gridSize),
                y: Math.floor(Math.random() * this.gridSize)
            };
        } while (this.snake.some(segment => segment.x === food.x && segment.y === food.y) ||
                (this.crystal && this.crystal.x === food.x && this.crystal.y === food.y));
        return food;
    }
    
    generateCrystal() {
        // 20% chance to generate crystal
        if (Math.random() > 0.2) return null;

        let crystal;
        do {
            crystal = {
                x: Math.floor(Math.random() * this.gridSize),
                y: Math.floor(Math.random() * this.gridSize)
            };
        } while (this.snake.some(segment => segment.x === crystal.x && segment.y === crystal.y) ||
                (this.food.x === crystal.x && this.food.y === crystal.y));
        return crystal;
    }

    updateScore() {
        this.scoreElement.textContent = this.score;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.highScoreElement.textContent = this.highScore;
            localStorage.setItem('snakeHighScore', this.highScore.toString());
        }
    }

    initializeControls() {
        // Keyboard controls
        document.addEventListener('keydown', e => {
            e.preventDefault(); // Prevent page scrolling
            this.handleKeyPress(e.key);
        });

        // Mobile controls
        const buttons = {
            'btnUp': { x: 0, y: -1 },
            'btnDown': { x: 0, y: 1 },
            'btnLeft': { x: -1, y: 0 },
            'btnRight': { x: 1, y: 0 }
        };

        Object.keys(buttons).forEach(btnId => {
            const button = document.getElementById(btnId);
            if (button) {
                ['touchstart', 'mousedown'].forEach(eventType => {
                    button.addEventListener(eventType, (e) => {
                        e.preventDefault();
                        const newDir = buttons[btnId];
                        if (this.isValidDirection(newDir)) {
                            this.nextDirection = newDir;
                        }
                    });
                });
            }
        });
    }

    isValidDirection(newDir) {
        // Prevent 180-degree turns
        return !(this.direction.x === -newDir.x && this.direction.y === -newDir.y);
    }

    handleKeyPress(key) {
        const directions = {
            'ArrowUp': { x: 0, y: -1 },
            'ArrowDown': { x: 0, y: 1 },
            'ArrowLeft': { x: -1, y: 0 },
            'ArrowRight': { x: 1, y: 0 }
        };

        const newDirection = directions[key];
        if (newDirection && this.isValidDirection(newDirection)) {
            this.nextDirection = newDirection;
        }
    }

    showGameOver() {
        this.gameOver = true;
        
        // Update final scores
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalHighScore').textContent = this.highScore;
        document.getElementById('finalCrystals').textContent = this.crystals;
        
        // Show game over screen with animation
        const gameOverElement = document.getElementById('gameOver');
        gameOverElement.style.display = 'block';
        
        // Clear existing buttons
        const buttonsContainer = gameOverElement.querySelector('.buttons');
        buttonsContainer.innerHTML = '';
        
        // Add revival button for crystals
        const reviveButton = document.createElement('button');
        reviveButton.className = 'retry-btn revival-btn';
        reviveButton.innerHTML = '<i class="fas fa-gem"></i> Возродиться за 10 кристаллов';
        
        if (this.crystals >= 10) {
            reviveButton.onclick = () => this.revive('crystal');
            reviveButton.disabled = false;
        } else {
            reviveButton.disabled = true;
            reviveButton.style.opacity = '0.5';
        }
        
        // Add revival button for ads with remaining count
        const adRevivals = parseInt(localStorage.getItem('adRevivals')) || 3;
        const adReviveButton = document.createElement('button');
        adReviveButton.className = 'retry-btn ad-revival-btn';
        adReviveButton.style.cssText = 'background-color: #ff8c00 !important; margin-bottom: 5px;';
        adReviveButton.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                <div><i class="fas fa-play"></i> Возродиться за рекламу</div>
                <div style="font-size: 12px; opacity: 0.8;">Осталось: ${adRevivals} из 3</div>
            </div>`;
        
        if (adRevivals > 0) {
            adReviveButton.onclick = () => this.revive('ad');
            adReviveButton.disabled = false;
        } else {
            adReviveButton.disabled = true;
            adReviveButton.style.opacity = '0.5';
        }
        
        // Add retry button
        const retryButton = document.createElement('button');
        retryButton.className = 'retry-btn';
        retryButton.innerHTML = '<i class="fas fa-redo"></i> Начать заново';
        retryButton.onclick = () => window.location.reload();
        
        // Add menu button
        const menuButton = document.createElement('button');
        menuButton.className = 'menu-btn';
        menuButton.innerHTML = '<i class="fas fa-home"></i> В меню';
        menuButton.onclick = () => window.location.href = 'index.html';
        
        // Add all elements to container
        buttonsContainer.appendChild(reviveButton);
        buttonsContainer.appendChild(adReviveButton);
        buttonsContainer.appendChild(retryButton);
        buttonsContainer.appendChild(menuButton);
    }

    revive(type) {
        if (type === 'crystal' && this.crystals >= 10) {
            this.crystals -= 10;
            this.updateCrystalCounter();
            this.continueGame();
        } else if (type === 'ad') {
            let adRevivals = parseInt(localStorage.getItem('adRevivals')) || 3;
            if (adRevivals > 0) {
                this.showAdModal();
            }
        }
    }

    continueGame() {
        this.gameOver = false;
        this.gameOverElement.style.display = 'none';
        // Reset snake position but keep length and score
        const head = this.snake[0];
        this.snake = [
            {x: Math.floor(this.gridSize/2), y: Math.floor(this.gridSize/2)},
            {x: Math.floor(this.gridSize/2)-1, y: Math.floor(this.gridSize/2)},
            {x: Math.floor(this.gridSize/2)-2, y: Math.floor(this.gridSize/2)}
        ];
        this.direction = {x: 1, y: 0};
        this.food = this.generateFood();
        this.crystal = this.generateCrystal();
        this.gameLoop();
    }

    createMenuButton() {
        // First, remove ALL existing menu buttons
        const existingButtons = document.querySelectorAll('.menu-button, .back-button');
        existingButtons.forEach(button => {
            button.parentNode.removeChild(button);
        });

        // Create new menu button
        const menuButton = document.createElement('button');
        
        // Set class and styles
        menuButton.className = 'menu-button';
        if (window.innerWidth <= 768) {
            menuButton.classList.add('mobile-menu');
        }
        
        menuButton.innerHTML = `
            <i class="fas fa-bars"></i>
            <span>Меню</span>
        `;
        
        menuButton.addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        // Add button to document
        document.body.appendChild(menuButton);

        // Update button position on window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth <= 768) {
                menuButton.classList.add('mobile-menu');
            } else {
                menuButton.classList.remove('mobile-menu');
            }
        });
    }

    createCrystalCounter() {
        const counter = document.createElement('div');
        counter.className = 'crystal-counter';
        counter.innerHTML = `
            <i class="fas fa-gem"></i>
            <span>0</span>
        `;
        document.body.appendChild(counter);
        return counter;
    }

    updateCrystalCounter() {
        if (!this.crystalCounter) {
            this.crystalCounter = document.querySelector('.crystal-counter');
            if (!this.crystalCounter) {
                this.crystalCounter = this.createCrystalCounter();
            }
        }
        const counterSpan = this.crystalCounter.querySelector('span');
        if (counterSpan) {
            counterSpan.textContent = this.crystals;
            // Save crystals to localStorage
            localStorage.setItem('snakeCrystals', this.crystals.toString());
        }
    }

    createAdModal() {
        // Instead of creating a new modal, get the existing one
        this.adModal = document.querySelector('.ad-modal');
        if (!this.adModal) {
            console.error('Ad modal not found in HTML');
            return;
        }

        // No need to initialize YouTube player here as it's handled in game.html
    }

    showAdModal() {
        if (!this.adModal) {
            console.error('Ad modal not initialized');
            return;
        }

        this.adModal.style.display = 'flex';
        const continueBtn = this.adModal.querySelector('.continue-btn');
        const timer = this.adModal.querySelector('.ad-timer');

        // Hide timer as we don't need it anymore
        if (timer) timer.style.display = 'none';

        // Reset continue button
        continueBtn.disabled = true;
        continueBtn.style.opacity = '0.5';

        // Start playing a random video if player is ready
        if (window.player && typeof window.player.playVideo === 'function') {
            const randomVideoId = adVideos[Math.floor(Math.random() * adVideos.length)];
            window.player.loadVideoById({
                videoId: randomVideoId
            });
            window.player.playVideo();
        } else {
            console.log('YouTube player not ready');
            // If player is not ready, allow continuing without ad
            continueBtn.disabled = false;
            continueBtn.style.opacity = '1';
        }

        // Add one-time click event listener to continue button
        continueBtn.addEventListener('click', () => {
            if (window.player && typeof window.player.stopVideo === 'function') {
                window.player.stopVideo();
            }
            let adRevivals = parseInt(localStorage.getItem('adRevivals')) || 3;
            adRevivals--;
            localStorage.setItem('adRevivals', adRevivals);
            document.getElementById('adRevivalsLeft').textContent = adRevivals;
            this.adModal.style.display = 'none';
            this.continueGame();
        }, { once: true });
    }

    // Smooth interpolation functions
    lerp(start, end, t) {
        return start * (1 - t) + end * t;
    }

    smoothStep(t) {
        return t * t * (3 - 2 * t);
    }

    bezierPoint(p0, p1, p2, p3, t) {
        const oneMinusT = 1 - t;
        return Math.pow(oneMinusT, 3) * p0 +
               3 * Math.pow(oneMinusT, 2) * t * p1 +
               3 * oneMinusT * Math.pow(t, 2) * p2 +
               Math.pow(t, 3) * p3;
    }
} 