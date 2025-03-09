class ConsoleManager {
    constructor() {
        // Encrypted password hash (БУТЕРСУПЕР)
        this.password = 'БУТЕРСУПЕР'; // Временно храним пароль в открытом виде для отладки
        this.isAuthenticated = false;
        
        this.consoleElement = document.createElement('div');
        this.consoleElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 380px;
            background: linear-gradient(180deg, rgba(8, 8, 24, 0.95) 0%, rgba(15, 15, 31, 0.95) 100%);
            border: 2px solid rgba(0, 255, 255, 0.15);
            border-radius: 12px;
            padding: 20px;
            display: none;
            z-index: 2000;
            font-family: 'Russo One', sans-serif;
            box-shadow: 0 0 30px rgba(0, 0, 0, 0.5),
                        inset 0 0 20px rgba(0, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            animation: consoleFadeIn 0.3s ease-out;
        `;
        
        this.consoleTitle = document.createElement('div');
        this.consoleTitle.style.cssText = `
            color: #00ffff;
            font-size: 16px;
            margin-bottom: 15px;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 2px;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border-bottom: 1px solid rgba(0, 255, 255, 0.1);
            padding-bottom: 12px;
        `;
        this.consoleTitle.innerHTML = '<i class="fas fa-terminal"></i> Консоль';
        
        // Создаем контейнер для поля ввода
        this.inputContainer = document.createElement('div');
        this.inputContainer.style.cssText = `
            background: rgba(0, 0, 0, 0.4);
            border-radius: 10px;
            padding: 15px;
            margin: 0 auto;
            width: 90%;
            display: flex;
            justify-content: center;
        `;
        
        this.consoleInput = document.createElement('input');
        this.consoleInput.type = 'text';
        this.consoleInput.style.cssText = `
            width: 100%;
            max-width: 300px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(0, 255, 255, 0.15);
            border-radius: 8px;
            color: #00ffff;
            padding: 12px 15px;
            font-family: 'Russo One', sans-serif;
            font-size: 14px;
            outline: none;
            transition: all 0.3s ease;
            letter-spacing: 0.5px;
            text-align: center;
        `;
        this.consoleInput.placeholder = this.isAuthenticated ? 'Введите команду...' : 'Введите пароль...';
        
        this.consoleInput.addEventListener('mouseover', () => {
            this.consoleInput.style.borderColor = 'rgba(0, 255, 255, 0.3)';
            this.consoleInput.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.1)';
        });
        
        this.consoleInput.addEventListener('mouseout', () => {
            if (document.activeElement !== this.consoleInput) {
                this.consoleInput.style.borderColor = 'rgba(0, 255, 255, 0.15)';
                this.consoleInput.style.boxShadow = 'none';
            }
        });
        
        this.consoleInput.addEventListener('focus', () => {
            this.consoleInput.style.borderColor = 'rgba(0, 255, 255, 0.3)';
            this.consoleInput.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.15)';
        });
        
        this.consoleInput.addEventListener('blur', () => {
            this.consoleInput.style.borderColor = 'rgba(0, 255, 255, 0.15)';
            this.consoleInput.style.boxShadow = 'none';
        });
        
        this.consoleOutput = document.createElement('div');
        this.consoleOutput.style.cssText = `
            margin: 12px auto 0;
            color: #00ffff;
            font-size: 14px;
            min-height: 20px;
            padding: 12px 15px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            border: 1px solid rgba(0, 255, 255, 0.1);
            transition: all 0.3s ease;
            display: none;
            letter-spacing: 0.5px;
            width: 90%;
            text-align: center;
        `;
        
        this.helpText = document.createElement('div');
        this.helpText.style.cssText = `
            margin-top: 15px;
            color: rgba(255, 255, 255, 0.4);
            font-size: 12px;
            text-align: center;
            padding-top: 12px;
            border-top: 1px solid rgba(0, 255, 255, 0.1);
            letter-spacing: 0.5px;
        `;
        this.updateHelpText();
        
        // Добавляем элементы в контейнер
        this.inputContainer.appendChild(this.consoleInput);
        
        this.consoleElement.appendChild(this.consoleTitle);
        this.consoleElement.appendChild(this.inputContainer);
        this.consoleElement.appendChild(this.consoleOutput);
        this.consoleElement.appendChild(this.helpText);
        document.body.appendChild(this.consoleElement);
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes consoleFadeIn {
                from {
                    opacity: 0;
                    transform: translate(-50%, -48%);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, -50%);
                }
            }
        `;
        document.head.appendChild(style);
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ё' || e.key === '`') {
                e.preventDefault();
                this.toggle();
            }
        });
        
        this.consoleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (!this.isAuthenticated) {
                    this.authenticate(this.consoleInput.value);
                } else {
                    this.executeCommand(this.consoleInput.value);
                }
                this.consoleInput.value = '';
            } else if (e.key === 'Escape') {
                this.toggle();
            }
        });

        // Инициализация ID игрока при первом запуске
        if (!localStorage.getItem('snakePlayerId')) {
            this.generateUniqueId();
        }
        
        // Инициализация счетчика игр
        if (!localStorage.getItem('snakeGamesPlayed')) {
            localStorage.setItem('snakeGamesPlayed', '0');
        }
    }
    
    updateHelpText() {
        if (!this.isAuthenticated) {
            this.helpText.innerHTML = `
                <div>Требуется авторизация</div>
                <div style="margin-top: 8px;">ESC - закрыть консоль</div>
            `;
        } else {
            this.helpText.innerHTML = `
                <div style="margin-bottom: 8px;">Доступные команды:</div>
                <div style="color: #00ffff;">/give &lt;количество&gt;</div>
                <div style="color: #00ffff;">/idnum &lt;номер&gt;</div>
                <div style="color: #00ffff;">/stats</div>
                <div style="margin-top: 8px;">ESC - закрыть консоль</div>
            `;
        }
    }
    
    authenticate(password) {
        if (password === this.password) {
            this.isAuthenticated = true;
            this.consoleInput.placeholder = 'Введите команду...';
            this.updateHelpText();
            this.showOutput('Авторизация успешна', true);
        } else {
            this.showOutput('Неверный пароль', false);
        }
    }
    
    showOutput(message, success) {
        this.consoleOutput.style.display = 'block';
        this.consoleOutput.innerHTML = `<i class="fas fa-${success ? 'check' : 'exclamation'}-circle"></i> ${message}`;
        this.consoleOutput.style.color = success ? '#00ff00' : '#ff0000';
        this.consoleOutput.style.animation = 'none';
        this.consoleOutput.offsetHeight;
        this.consoleOutput.style.animation = 'consoleFadeIn 0.3s ease-out';
    }
    
    toggle() {
        const isVisible = this.consoleElement.style.display === 'block';
        if (!isVisible) {
            this.consoleElement.style.display = 'block';
            this.consoleElement.style.animation = 'consoleFadeIn 0.3s ease-out';
            this.consoleInput.focus();
            this.consoleOutput.style.display = 'none';
            if (window.game && typeof window.game.setGameRunning === 'function') {
                window.game.setGameRunning(false);
            }
        } else {
            this.consoleElement.style.display = 'none';
            this.isAuthenticated = false;
            this.consoleInput.placeholder = 'Введите пароль...';
            this.updateHelpText();
            if (window.game && typeof window.game.setGameRunning === 'function') {
                window.game.setGameRunning(true);
            }
        }
    }
    
    executeCommand(command) {
        this.consoleOutput.style.display = 'block';
        
        const giveMatch = command.match(/^\/give\s+(\d+)$/);
        const idMatch = command.match(/^\/idnum\s+(\d+)$/);
        const statsMatch = command.match(/^\/stats$/);
        
        if (giveMatch) {
            const amount = parseInt(giveMatch[1]);
            if (amount > 0) {
                const crystals = parseInt(localStorage.getItem('snakeCrystals') || '0') + amount;
                localStorage.setItem('snakeCrystals', crystals);
                this.updateCrystalsDisplay(crystals);
                this.showOutput(`Добавлено ${amount} кристаллов`, true);
            } else {
                this.showOutput('Количество должно быть больше 0', false);
            }
        } else if (idMatch) {
            const newId = parseInt(idMatch[1]);
            if (newId > 0) {
                const uniqueId = this.generateUniqueId();
                this.updateIdDisplay(uniqueId);
                this.showOutput(`ID изменен на ${uniqueId}`, true);
            } else {
                this.showOutput('ID должен быть больше 0', false);
            }
        } else if (statsMatch) {
            const gamesPlayed = localStorage.getItem('snakeGamesPlayed') || '0';
            const playerId = localStorage.getItem('snakePlayerId') || 'Не назначен';
            const crystals = localStorage.getItem('snakeCrystals') || '0';
            this.showOutput(`Статистика:\nИгр сыграно: ${gamesPlayed}\nID игрока: ${playerId}\nКристаллов: ${crystals}`, true);
        } else {
            this.showOutput('Неверная команда. Используйте: /give <количество>, /idnum <номер> или /stats', false);
        }
    }
    
    updateCrystalsDisplay(crystals) {
        // Update crystals display in both menu and game
        const crystalElement = document.querySelector('.crystals') || document.getElementById('crystals');
        if (crystalElement) {
            crystalElement.textContent = `КРИСТАЛЛЫ: ${crystals}`;
        }
        if (window.game && window.game.crystalElement) {
            window.game.crystalElement.textContent = `КРИСТАЛЛЫ: ${crystals}`;
            window.game.crystals = crystals;
        }
    }
    
    updateIdDisplay(id) {
        // Update ID display in menu
        const playerIdElement = document.querySelector('.player-id');
        if (playerIdElement) {
            playerIdElement.textContent = `ID: ${id}`;
        }
        if (window.game) {
            window.game.playerId = id;
        }
    }

    // Генерация уникального ID
    generateUniqueId() {
        const timestamp = Date.now().toString(36);
        const randomStr = Math.random().toString(36).substring(2, 8);
        const uniqueId = `P${timestamp}${randomStr}`.toUpperCase();
        localStorage.setItem('snakePlayerId', uniqueId);
        return uniqueId;
    }

    // Увеличение счетчика игр
    incrementGamesPlayed() {
        // Увеличиваем общий счетчик игр
        const currentGames = parseInt(localStorage.getItem('snakeGamesPlayed') || '0');
        localStorage.setItem('snakeGamesPlayed', (currentGames + 1).toString());
        
        // Также обновляем счетчик в объекте stats для конкретного игрока
        const playerId = localStorage.getItem('snakePlayerId') || this.generatePlayerId();
        const statsKey = `snakeStats_${playerId}`;
        
        // Получаем текущую статистику или создаем новый объект
        let stats = {};
        try {
            stats = JSON.parse(localStorage.getItem(statsKey) || '{"gamesPlayed":0, "totalScore":0}');
        } catch (e) {
            stats = {"gamesPlayed":0, "totalScore":0};
        }
        
        // Увеличиваем счетчик игр
        stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
        
        // Сохраняем обновленную статистику
        localStorage.setItem(statsKey, JSON.stringify(stats));
        
        return currentGames + 1;
    }
}

// Create global console instance
window.consoleManager = new ConsoleManager(); 