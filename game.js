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
        this.gameSpeed = 500; // Еще немного уменьшена начальная скорость (было 450)
        this.initialGameSpeed = 500; // Обновляем начальную скорость
        this.minGameSpeed = 220; // Немного увеличиваем минимальную скорость (было 200)
        this.lastRenderTime = 0;
        this.gameOver = false;
        this.foodCounter = 0; // Счетчик собранной еды для гарантированного спавна кристаллов
        this.forceCrystalSpawn = false; // Флаг для принудительного спавна кристаллов
        
        // Ultra-smooth movement properties with higher FPS
        this.moveProgress = 0;
        this.currentAngle = Math.atan2(this.direction.y, this.direction.x);
        this.targetAngle = this.currentAngle;
        this.rotationSpeed = 0.2;
        this.framesPerGridCell = 50; // Оптимальное количество кадров для плавного движения (было 60)
        this.segmentPositions = []; // Сохраняем текущие позиции сегментов для интерполяции
        this.previousPositions = []; // История предыдущих позиций для плавных переходов
        this.maxPositionHistory = 100; // Сохраняем больше истории для более плавной анимации
        this.useAdvancedBezier = true;
        
        // Инициализация начальных позиций
        for (let i = 0; i < this.snake.length; i++) {
            this.segmentPositions.push({
                x: this.snake[i].x,
                y: this.snake[i].y
            });
        }
        
        // Запуск с высоким FPS
        this.targetFPS = 120; // Целевой FPS для плавного движения
        
        // Smooth movement properties without any pulsation effects
        this.smoothness = 0.5;
        this.segmentSpacing = 0.04;
        this.trail = [];
        this.maxTrailLength = 15;
        this.lastPos = null;
        this.turnPoints = [];
        this.maxTurnPoints = 10;
        this.turnDuration = 0.8;
        this.elasticity = 0.4;
        this.bodyTension = 0.5;
        this.activeTurns = [];
        this.tailSegments = 5;
        this.tailPoints = [];
        this.snakeHistory = [];
        this.historyLimit = 20;
        
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
        // Очищаем холст с полной непрозрачностью для лучшей производительности
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Получаем интерполированные позиции для всех сегментов змейки
        const interpolatedPositions = this.getInterpolatedPositions();
        
        // Подготавливаем точки для отрисовки змейки
        const points = [];
        
        // Преобразуем интерполированные позиции в точки для отрисовки
        for (let i = 0; i < interpolatedPositions.length; i++) {
            const pos = interpolatedPositions[i];
            points.push({
                x: (pos.x + 0.5) * this.tileSize,
                y: (pos.y + 0.5) * this.tileSize,
                isHead: i === 0
            });
        }
        
        // Отрисовка змейки с использованием плавных кривых
        if (points.length >= 2) {
            // Рисуем тело змейки
            this.ctx.save();
            this.ctx.lineJoin = 'round';
            this.ctx.lineCap = 'round';
            
            // Градиент для тела
            const gradient = this.ctx.createLinearGradient(
                points[0].x, points[0].y,
                points[points.length-1].x, points[points.length-1].y
            );
            gradient.addColorStop(0, '#00ffff');
            gradient.addColorStop(0.3, '#00aaff');
            gradient.addColorStop(0.7, '#0066ee');
            gradient.addColorStop(1, '#0044aa');
            
            this.ctx.lineWidth = this.tileSize * 0.85;
            this.ctx.strokeStyle = gradient;
            this.ctx.shadowColor = '#00aaff';
            this.ctx.shadowBlur = 15;
            
            // Рисуем плавную кривую через все точки
            this.ctx.beginPath();
            this.ctx.moveTo(points[0].x, points[0].y);
            
            // Используем кривую Безье для соединения точек
            if (points.length > 2) {
                // Первый сегмент - квадратичная кривая Безье
                const xc1 = (points[0].x + points[1].x) / 2;
                const yc1 = (points[0].y + points[1].y) / 2;
                this.ctx.quadraticCurveTo(points[0].x, points[0].y, xc1, yc1);
                
                // Средние сегменты - соединяем через средние точки
                for (let i = 1; i < points.length - 1; i++) {
                    const xc = (points[i].x + points[i+1].x) / 2;
                    const yc = (points[i].y + points[i+1].y) / 2;
                    this.ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
                }
                
                // Последний сегмент - линия к последней точке
                this.ctx.lineTo(points[points.length-1].x, points[points.length-1].y);
            } else {
                // Если только две точки - прямая линия
                this.ctx.lineTo(points[1].x, points[1].y);
            }
            
            this.ctx.stroke();
            this.ctx.restore();
            
            // Рисуем голову змейки
            const headPoint = points[0];
            
            // Вычисляем угол для головы
            let headAngle;
            if (points.length > 1) {
                const dx = points[1].x - points[0].x;
                const dy = points[1].y - points[0].y;
                headAngle = Math.atan2(-dy, -dx); // Минус для правильной ориентации
            } else {
                headAngle = Math.atan2(-this.direction.y, -this.direction.x);
            }
            
            this.ctx.save();
            this.ctx.translate(headPoint.x, headPoint.y);
            this.ctx.rotate(headAngle);
            
            // Градиент для головы
            const headGradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.tileSize * 0.75);
            headGradient.addColorStop(0, '#ffffff');
            headGradient.addColorStop(0.3, '#00ffff');
            headGradient.addColorStop(0.7, '#00aaff');
            headGradient.addColorStop(1, '#0088dd');
            
            this.ctx.fillStyle = headGradient;
            this.ctx.shadowColor = '#00ffff';
            this.ctx.shadowBlur = 20;
            
            // Рисуем голову
            const headSize = this.tileSize * 0.95;
            this.ctx.beginPath();
            this.ctx.roundRect(-headSize/2, -headSize/2, headSize, headSize, 10);
            this.ctx.fill();
            
            // Рисуем глаза
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = '#000';
            const eyeSize = this.tileSize / 5;
            const eyeOffset = headSize/3;
            
            this.ctx.beginPath();
            this.ctx.arc(eyeOffset, -headSize/4, eyeSize, 0, Math.PI * 2);
            this.ctx.arc(eyeOffset, headSize/4, eyeSize, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Блики в глазах
            this.ctx.fillStyle = '#fff';
            this.ctx.beginPath();
            this.ctx.arc(eyeOffset + eyeSize/3, -headSize/4 - eyeSize/3, eyeSize/2.5, 0, Math.PI * 2);
            this.ctx.arc(eyeOffset + eyeSize/3, headSize/4 - eyeSize/3, eyeSize/2.5, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.restore();
        }

        // Рисуем еду и кристаллы
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
        
        // Simple glow without pulsation
        this.ctx.shadowColor = '#ff0000';
        this.ctx.shadowBlur = 15;
        
        // Fixed gradient without animation
        const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.tileSize/2);
        gradient.addColorStop(0, '#ff6666');
        gradient.addColorStop(0.5, '#ff0000');
        gradient.addColorStop(1, '#cc0000');
        
        this.ctx.fillStyle = gradient;
        
        // Fixed size circle without pulsation
        const foodSize = this.tileSize * 0.4;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, foodSize, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    drawCrystal() {
        const x = this.crystal.x * this.tileSize + this.tileSize / 2;
        const y = this.crystal.y * this.tileSize + this.tileSize / 2;
        
        this.ctx.save();
        this.ctx.translate(x, y);
        
        // Simple glow without pulsation
        this.ctx.shadowColor = '#9932CC';
        this.ctx.shadowBlur = 15;
        
        // Fixed gradient without animation
        const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.tileSize/2);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.5, '#9932CC');
        gradient.addColorStop(1, '#4B0082');
        
        this.ctx.fillStyle = gradient;
        
        // Draw crystal shape with fixed size (no pulsation)
        const crystalSize = this.tileSize * 0.35;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -crystalSize);
        this.ctx.lineTo(crystalSize, 0);
        this.ctx.lineTo(0, crystalSize);
        this.ctx.lineTo(-crystalSize, 0);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.restore();
    }

    // Полностью переработанный gameLoop для плавного движения с оптимальной скоростью
    gameLoop(currentTime = 0) {
        if (this.gameOver) return;
        
        // Запрашиваем следующий кадр с максимальной частотой
        window.requestAnimationFrame(this.gameLoop.bind(this));
        
        // Первый кадр инициализации
        if (this.lastRenderTime === 0) {
            this.lastRenderTime = currentTime;
            return;
        }
        
        // Расчет deltaTime с ограничением для стабильности
        const deltaTime = Math.min(currentTime - this.lastRenderTime, 16.66); // Максимум 60 FPS (16.66ms)
        
        // Увеличиваем прогресс движения с учетом целевого FPS
        // Используем коэффициент 2.0 для более медленной начальной скорости
        const speedFactor = 1000 / (this.gameSpeed * (this.framesPerGridCell / 20) * 2.0);
        this.moveProgress += deltaTime * speedFactor / this.framesPerGridCell;
        
        // Обновляем состояние игры при завершении шага
        if (this.moveProgress >= 1) {
            // Сохраняем текущие позиции для интерполяции
            this.previousPositions.unshift([...this.segmentPositions.map(pos => ({...pos}))]);
            if (this.previousPositions.length > this.maxPositionHistory) {
                this.previousPositions.pop();
            }
            
            // Обновляем игровую логику
            this.update();
            
            // Сбрасываем прогресс, сохраняя остаток для плавности
            this.moveProgress = this.moveProgress % 1;
        }
        
        // Всегда перерисовываем для максимально плавной анимации
        this.draw();
        
        this.lastRenderTime = currentTime;
    }

    update() {
        // Сохраняем текущую позицию головы для истории
        const currentHead = { ...this.snake[0] };
        
        // Применяем новое направление
        this.direction = { ...this.nextDirection };
        this.targetAngle = Math.atan2(this.direction.y, this.direction.x);
        
        // Создаем новую голову
        const head = this.snake[0];
        const newHead = {
            x: head.x + this.direction.x,
            y: head.y + this.direction.y
        };
        
        // Добавляем новую голову в начало змейки
        this.snake.unshift(newHead);
        
        // Обновляем позиции для интерполяции
        this.segmentPositions.unshift({
            x: newHead.x,
            y: newHead.y
        });
        
        // Проверяем столкновение с едой
        if (Math.round(newHead.x) === Math.round(this.food.x) && 
            Math.round(newHead.y) === Math.round(this.food.y)) {
            // Еда съедена, создаем новую еду
            this.food = this.generateFood();
            this.updateScore();
            
            // Если у нас нет кристалла, даем дополнительный шанс его создать (30%)
            if (!this.crystal && Math.random() < 0.3) {
                this.forceCrystalSpawn = true;
                this.crystal = this.generateCrystal();
            }
        } else {
            // Еда не съедена, удаляем хвост
            this.snake.pop();
            this.segmentPositions.pop();
        }
        
        // Проверяем столкновение с кристаллом
        if (this.crystal && 
            Math.round(newHead.x) === Math.round(this.crystal.x) && 
            Math.round(newHead.y) === Math.round(this.crystal.y)) {
            this.crystals++;
            localStorage.setItem('snakeCrystals', this.crystals);
            this.updateCrystalCounter();
            this.crystal = this.generateCrystal();
        }
        
        // Проверяем столкновения со стенами и самой собой
        if (this.checkWallCollision(newHead) || this.checkSelfCollision(newHead)) {
            this.gameOver = true;
            this.showGameOver();
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
        // Увеличиваем шанс появления кристалла с 20% до 40%
        if (Math.random() > 0.4 && !this.forceCrystalSpawn) return null;

        // Сбрасываем флаг принудительного спавна
        this.forceCrystalSpawn = false;

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
        // Increment score by 10 points for each food collected
        this.score += 10;
        
        // Update UI display
        this.scoreElement.textContent = this.score;
        
        // Update high score if needed
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.highScoreElement.textContent = this.highScore;
            localStorage.setItem('snakeHighScore', this.highScore.toString());
        }
        
        // Увеличиваем счетчик собранной еды
        this.foodCounter++;
        
        // Гарантированно спавним кристалл после каждых 5 единиц еды, если у нас его нет
        if (this.foodCounter >= 5 && !this.crystal) {
            this.forceCrystalSpawn = true;
            this.crystal = this.generateCrystal();
            this.foodCounter = 0; // Сбрасываем счетчик
        }
        
        // Adjust game speed only if score is less than 100
        // Заметное ускорение - 2 мс на каждые 10 очков, до 100 очков
        if (this.score < 100) {
            // Speed up the game slightly (higher gameSpeed = slower movement)
            this.gameSpeed = Math.max(this.minGameSpeed, this.gameSpeed - 2);
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
        // Handle arrow keys
        const dir = this.direction;
        let newDir = { x: dir.x, y: dir.y };
        
        // Map keys to directions
        switch (key) {
            case 'ArrowUp':
            case 'w':
            case 'ц':
                newDir = { x: 0, y: -1 };
                break;
            case 'ArrowDown':
            case 's':
            case 'ы':
                newDir = { x: 0, y: 1 };
                break;
            case 'ArrowLeft':
            case 'a':
            case 'ф':
                newDir = { x: -1, y: 0 };
                break;
            case 'ArrowRight':
            case 'd':
            case 'в':
                newDir = { x: 1, y: 0 };
                break;
        }
        
        // Check if direction is valid (not opposite of current)
        if (this.isValidDirection(newDir)) {
            // Only register turn if direction actually changes
            if (newDir.x !== this.direction.x || newDir.y !== this.direction.y) {
                const head = this.snake[0];
                
                // Calculate the exact position including interpolation progress
                const interpolatedPosition = { ...head };
                if (this.moveProgress > 0) {
                    // Adjust position by current movement progress
                    interpolatedPosition.x += this.direction.x * this.easeInOutCubic(this.moveProgress);
                    interpolatedPosition.y += this.direction.y * this.easeInOutCubic(this.moveProgress);
                }
                
                // Create a more detailed turn point with animation properties
                const turnPoint = {
                    x: interpolatedPosition.x,
                    y: interpolatedPosition.y,
                    exactX: interpolatedPosition.x, // Store exact position for precise animation
                    exactY: interpolatedPosition.y,
                    oldDir: { ...this.direction },  // Store previous direction
                    newDir: { ...newDir },          // Store new direction
                    progress: 0,                    // Animation progress
                    timestamp: performance.now(),   // Timestamp for timing calculations
                    angle: Math.atan2(newDir.y, newDir.x) - Math.atan2(this.direction.y, this.direction.x),
                    elasticPhase: 0                 // Phase for elastic animation
                };
                
                // Create an active turn animation
                this.activeTurns.push({
                    ...turnPoint,
                    segmentIndex: 0, // Which segment is turning
                    active: true
                });
                
                // Limit active turns
                if (this.activeTurns.length > 10) {
                    this.activeTurns.shift();
                }
                
                // Add to regular turn points
                this.turnPoints.push(turnPoint);
                
                // Keep only the most recent turn points
                while (this.turnPoints.length > this.maxTurnPoints) {
                    this.turnPoints.shift();
                }
                
                // Immediately set new direction for responsive controls
                this.nextDirection = newDir;
            }
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

        // Увеличиваем счетчик игр
        if (window.consoleManager) {
            window.consoleManager.incrementGamesPlayed();
        } else if (typeof ConsoleManager !== 'undefined') {
            // Создаем ConsoleManager если он не был инициализирован
            window.consoleManager = new ConsoleManager();
            window.consoleManager.incrementGamesPlayed();
        } else {
            // Если ConsoleManager не доступен, обновляем счетчик напрямую
            try {
                // Обновляем общий счетчик
                const currentGames = parseInt(localStorage.getItem('snakeGamesPlayed') || '0');
                localStorage.setItem('snakeGamesPlayed', (currentGames + 1).toString());
                
                // Обновляем счетчик в объекте stats
                const playerId = localStorage.getItem('snakePlayerId') || 'P0001';
                const statsKey = `snakeStats_${playerId}`;
                const stats = JSON.parse(localStorage.getItem(statsKey) || '{"gamesPlayed":0}');
                stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
                localStorage.setItem(statsKey, JSON.stringify(stats));
            } catch (e) {
                console.error('Failed to update games counter:', e);
            }
        }
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
        // Сохраняем текущий счет и другие параметры
        const currentScore = this.score;
        const currentCrystals = this.crystals;
        const currentHighScore = this.highScore;
        
        // Сбрасываем состояние игры, но сохраняем счет
        this.gameOver = false;
        this.gameOverElement.style.display = 'none';
        
        // Сбрасываем позицию змейки
        this.snake = [
            {x: Math.floor(this.gridSize/2), y: Math.floor(this.gridSize/2)},
            {x: Math.floor(this.gridSize/2)-1, y: Math.floor(this.gridSize/2)},
            {x: Math.floor(this.gridSize/2)-2, y: Math.floor(this.gridSize/2)}
        ];
        
        // Сбрасываем параметры анимации
        this.direction = {x: 1, y: 0};
        this.nextDirection = {x: 1, y: 0};
        this.moveProgress = 0;
        this.lastRenderTime = 0;
        this.currentAngle = Math.atan2(this.direction.y, this.direction.x);
        this.targetAngle = this.currentAngle;
        
        // Очищаем историю позиций
        this.previousPositions = [];
        
        // Инициализируем массив позиций для интерполяции
        this.segmentPositions = [];
        for (let i = 0; i < this.snake.length; i++) {
            this.segmentPositions.push({
                x: this.snake[i].x,
                y: this.snake[i].y
            });
        }
        
        // Рассчитываем скорость на основе текущего счета (ограничено 100 очками)
        // Заметное изменение скорости - 2 мс на каждые 10 очков
        const speedReduction = Math.min(currentScore, 100) / 5; // 2 мс на каждые 10 очков
        this.gameSpeed = Math.max(this.minGameSpeed, this.initialGameSpeed - speedReduction);
        
        // Восстанавливаем счет и статистику
        this.score = currentScore;
        this.crystals = currentCrystals;
        this.highScore = currentHighScore;
        
        // Обновляем отображение счета
        this.scoreElement.textContent = this.score;
        this.highScoreElement.textContent = this.highScore;
        this.updateCrystalCounter();
        
        // Создаем новую еду при необходимости
        if (!this.food) {
            this.food = this.generateFood();
        }
        
        // Создаем новый кристалл при необходимости
        if (!this.crystal) {
            this.forceCrystalSpawn = true; // Гарантируем появление кристалла
            this.crystal = this.generateCrystal();
        }
        
        // Сбрасываем счетчик еды
        this.foodCounter = 0;
        
        // Перезапускаем игровой цикл
        window.requestAnimationFrame(this.gameLoop.bind(this));
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
        
        // Ensure player exists and is in correct state before trying to play
        if (window.player && typeof window.player.getPlayerState === 'function') {
            try {
                // Only attempt to play video if player is ready
                if (window.youtubePlayerReady) {
                    const playerState = window.player.getPlayerState();
                    const randomVideoId = adVideos[Math.floor(Math.random() * adVideos.length)];
                    
                    // Always stop current video first
                    window.player.stopVideo();
                    
                    // Use timeout to ensure UI is ready before loading new video
                    setTimeout(() => {
                        window.player.loadVideoById({
                            videoId: randomVideoId
                        });
                        window.player.playVideo();
                        
                        // Enable continue button after 5 seconds in case video doesn't play properly
                        setTimeout(() => {
                            if (continueBtn && continueBtn.disabled) {
                                continueBtn.disabled = false;
                                continueBtn.style.opacity = '1';
                            }
                        }, 5000);
                    }, 500);
                } else {
                    console.log('YouTube player not fully ready');
                    continueBtn.disabled = false;
                    continueBtn.style.opacity = '1';
                }
            } catch (error) {
                console.error('Error playing video:', error);
                continueBtn.disabled = false;
                continueBtn.style.opacity = '1';
            }
        } else {
            console.log('YouTube player not available');
            continueBtn.disabled = false;
            continueBtn.style.opacity = '1';
        }

        // Add one-time click event listener to continue button with proper resurrection
        const continueHandler = () => {
            if (window.player && typeof window.player.stopVideo === 'function') {
                try {
                    window.player.stopVideo();
                } catch (error) {
                    console.error('Error stopping video:', error);
                }
            }
            
            this.adModal.style.display = 'none';
            let adRevivals = parseInt(localStorage.getItem('adRevivals')) || 3;
            adRevivals--;
            localStorage.setItem('adRevivals', adRevivals);
            
            // Update the counter display if element exists
            const adRevivalsLeft = document.getElementById('adRevivalsLeft');
            if (adRevivalsLeft) {
                adRevivalsLeft.textContent = adRevivals;
            }
            
            // Properly resurrect the player
            this.continueGame();
            
            // Remove the event listener to prevent multiple executions
            continueBtn.removeEventListener('click', continueHandler);
        };
        
        // Ensure only one event listener is added
        continueBtn.removeEventListener('click', continueHandler);
        continueBtn.addEventListener('click', continueHandler);
    }

    // Super smooth easing function for fluid animation
    easeInOutQuintic(t) {
        return t < 0.5
          ? 16 * t * t * t * t * t
          : 1 - Math.pow(-2 * t + 2, 5) / 2;
    }
    
    // Add extra physics-based easing functions for more natural movement
    
    // Spring-like animation for elastic movement
    springEasing(t) {
        const c4 = (2 * Math.PI) / 3;
        return t === 0
          ? 0
          : t === 1
          ? 1
          : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    
    // Natural bounce effect
    bounceEaseOut(t) {
        const n1 = 7.5625;
        const d1 = 2.75;
        
        if (t < 1 / d1) {
            return n1 * t * t;
        } else if (t < 2 / d1) {
            return n1 * (t -= 1.5 / d1) * t + 0.75;
        } else if (t < 2.5 / d1) {
            return n1 * (t -= 2.25 / d1) * t + 0.9375;
        } else {
            return n1 * (t -= 2.625 / d1) * t + 0.984375;
        }
    }
    
    // Simplified smoothStep for smoother movement without pulsation
    improvedSmoothStep(t) {
        // Use only cubic easing for smooth, predictable movement
        return this.easeInOutCubic(t);
    }

    // Enhanced easing functions for smoother animation
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
    
    easeInOutCubic(t) {
        return t < 0.5
          ? 4 * t * t * t
          : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // Improved smoothStep for better transitions
    smoothStep(t) {
        // Add a more sophisticated curve by combining different easing functions
        return this.easeInOutCubic(t);
    }

    // Linear interpolation between points
    lerp(start, end, t) {
        return start + (end - start) * t;
    }

    // Improved Bezier curve calculation
    bezierPoint(p0, p1, p2, p3, t) {
        // Cubic Bezier formula
        const oneMinusT = 1 - t;
        return oneMinusT * oneMinusT * oneMinusT * p0 + 
               3 * oneMinusT * oneMinusT * t * p1 + 
               3 * oneMinusT * t * t * p2 + 
               t * t * t * p3;
    }

    // Draw trail effects with fixed opacity (no pulsation)
    drawTrailEffects(points) {
        if (points.length < 2) return;
        
        this.ctx.save();
        
        // Draw fixed trail without pulsation
        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            
            // Fixed opacity based on position 
            const fadeOpacity = 0.08 * (1 - i / points.length);
            
            // Static glow without animation
            this.ctx.fillStyle = `rgba(0, 170, 255, ${fadeOpacity})`;
            
            // Fixed size glow
            const glowSize = this.tileSize * 0.3 * (1 - i / points.length);
            
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, glowSize, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }
    
    // Calculate catmull-rom spline point with fixed tension (no pulsation)
    getCatmullRomPoint(p0, p1, p2, p3, t, tension) {
        const t2 = t * t;
        const t3 = t2 * t;
        
        // Use fixed tension for consistent, smooth curves
        const fixedTension = 0.5;
        
        const v0 = (p2.x - p0.x) * fixedTension;
        const v1 = (p3.x - p1.x) * fixedTension;
        const x = (2 * p1.x - 2 * p2.x + v0 + v1) * t3 + 
                (-3 * p1.x + 3 * p2.x - 2 * v0 - v1) * t2 + 
                v0 * t + p1.x;
                
        const w0 = (p2.y - p0.y) * fixedTension;
        const w1 = (p3.y - p1.y) * fixedTension;
        const y = (2 * p1.y - 2 * p2.y + w0 + w1) * t3 + 
                (-3 * p1.y + 3 * p2.y - 2 * w0 - w1) * t2 + 
                w0 * t + p1.y;
                
        return { x, y };
    }
    
    // Elastic easing for bounce effect
    elasticEaseOut(t) {
        const c4 = (2 * Math.PI) / 3;
        return t === 0
            ? 0
            : t === 1
            ? 1
            : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }

    // Новый метод для расчета интерполированных позиций
    getInterpolatedPositions() {
        const positions = [];
        
        // Если нет предыдущих позиций, используем текущие
        if (this.previousPositions.length === 0) {
            return this.segmentPositions;
        }
        
        const previousPositions = this.previousPositions[0];
        
        // Интерполируем все сегменты
        for (let i = 0; i < this.segmentPositions.length; i++) {
            const current = this.segmentPositions[i];
            
            // Для головы используем moveProgress
            if (i === 0) {
                const previous = previousPositions[i] || current;
                
                // Плавная интерполяция для головы
                const t = this.easeInOutCubic(this.moveProgress);
                const x = previous.x + (current.x - previous.x) * t;
                const y = previous.y + (current.y - previous.y) * t;
                
                positions.push({ x, y });
            } 
            // Для остальных сегментов используем смещенный moveProgress
            else {
                const previous = previousPositions[i] || current;
                
                // Постепенное смещение для создания эффекта волны
                const delayFactor = i * 0.05; // Небольшая задержка между сегментами
                const segmentProgress = Math.max(0, this.moveProgress - delayFactor);
                
                if (segmentProgress > 0) {
                    // Плавная интерполяция для сегментов
                    const t = segmentProgress > 1 ? 1 : this.easeInOutCubic(segmentProgress);
                    const x = previous.x + (current.x - previous.x) * t;
                    const y = previous.y + (current.y - previous.y) * t;
                    
                    positions.push({ x, y });
                } else {
                    // Если сегмент еще не начал двигаться, используем предыдущую позицию
                    positions.push({ ...previous });
                }
            }
        }
        
        return positions;
    }
} 