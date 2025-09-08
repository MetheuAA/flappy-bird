// script.js

// 1. Configuração Inicial e Variáveis
// ===================================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const pauseScreen = document.getElementById('pause-screen');
const scoreDisplay = document.getElementById('score-display');
const finalScore = document.getElementById('final-score');
const highScoreDisplay = document.getElementById('high-score');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button'); // pode não existir mais, ok.
const resumeButton = document.getElementById('resume-button');

// NOVO: elementos do nome/salvar e toast
const playerNameInput = document.getElementById('player-name');
const saveScoreButton = document.getElementById('save-score') || document.getElementById('save-score-button');
const toastEl = document.getElementById('toast');

// start button pode ficar "A Carregar..." até sprites carregarem.
// Ele ainda funciona; se quiser mudar o texto depois, veja "setupGame()".
startButton.disabled = false;

// Áudio do jogo
const flapSound = new Audio('assets/audio/wing.wav');
const pointSound = new Audio('assets/audio/point.wav');
const hitSound = new Audio('assets/audio/hit.wav');
const dieSound = new Audio('assets/audio/die.wav');

// Sprites do jogo
const sprites = {};
let spritesLoaded = 0;
const totalSprites = 8;

function allSpritesLoaded() {
    setupGame();
}

function loadSprite(id) {
    sprites[id] = document.getElementById(id);
    const img = sprites[id];
    img.onload = () => {
        spritesLoaded++;
        if (spritesLoaded === totalSprites) {
            allSpritesLoaded();
        }
    };
    if (img.complete) {
        if (!img.dataset.loaded) {
            spritesLoaded++;
            img.dataset.loaded = 'true';
            if (spritesLoaded === totalSprites) {
                allSpritesLoaded();
            }
        }
    }
}

// Carregamento dos sprites
loadSprite('bird_up');
loadSprite('bird_mid');
loadSprite('bird_down');
loadSprite('pipe_green');
loadSprite('pipe_red');
loadSprite('background_day');
loadSprite('base');
loadSprite('logo_senac');

// Variáveis do Jogo e Constantes
let gameLoopId, pipeIntervalId, isGameRunning = false, isPaused = false, score = 0;
let highscore = localStorage.getItem('flappyHighscore') || 0;
const GRAVITY = 0.3, FLAP_POWER = 6, PIPE_WIDTH = 52, PIPE_GAP = 200, PIPE_SPAWN_INTERVAL = 1800;
let PIPE_SPEED = 2;

// Variáveis para o pássaro
let bird;
const birdAnimationFrames = ['bird_up', 'bird_mid', 'bird_down', 'bird_mid'];
let birdFrameIndex = 0, frameCounter = 0;
const birdWidth = 34, birdHeight = 24;
let pipes = [], baseScrollX = 0;

// 2. Classes para os Elementos do Jogo
// ===================================================================
class Bird { 
    constructor() {
        this.x = canvas.width / 4 - birdWidth / 2;
        this.y = canvas.height / 2 - birdHeight / 2;
        this.width = birdWidth;
        this.height = birdHeight;
        this.velocity = 0;
        this.angle = 0;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.angle);
        const currentFrame = sprites[birdAnimationFrames[birdFrameIndex]];
        ctx.drawImage(currentFrame, -this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }
    update() {
        this.velocity += GRAVITY;
        this.y += this.velocity;
        this.angle = this.velocity * 0.05;
        if (this.angle > Math.PI / 2) this.angle = Math.PI / 2;
        if (this.angle < -Math.PI / 4) this.angle = -Math.PI / 4;
        frameCounter++;
        if (frameCounter >= 5) {
            birdFrameIndex = (birdFrameIndex + 1) % birdAnimationFrames.length;
            frameCounter = 0;
        }
    }
    flap() {
        this.velocity = -FLAP_POWER;
        flapSound.currentTime = 0;
        flapSound.play();
    }
}

class Pipe { 
    constructor(x, gapY, sprite) {
        this.x = x;
        this.width = PIPE_WIDTH;
        this.gapY = gapY;
        this.gap = PIPE_GAP;
        this.passed = false;
        this.sprite = sprite;
    }
    draw() {
        const pipeImage = sprites[this.sprite];
        const topHeight = this.gapY - this.gap / 2;
        const bottomHeight = canvas.height - (this.gapY + this.gap / 2);
        
        // topo invertido
        ctx.save();
        ctx.translate(this.x + this.width, topHeight);
        ctx.rotate(Math.PI);
        ctx.drawImage(pipeImage, 0, 0, this.width, pipeImage.height);
        ctx.restore();
        
        // bottom normal
        ctx.drawImage(pipeImage, this.x, this.gapY + this.gap / 2, this.width, pipeImage.height);
    }
    update() {
        this.x -= PIPE_SPEED;
    }
}

// 3. Funções de Lógica do Jogo
// ===================================================================
function setupGame() {
    startButton.disabled = false;
    startButton.textContent = "Iniciar";
    highScoreDisplay.textContent = localStorage.getItem('flappyHighscore') || 0;
}

function gameLoop() {
    if (!isGameRunning || isPaused) return;
    update();
    draw();
    gameLoopId = requestAnimationFrame(gameLoop);
}

function update() {
    bird.update();
    baseScrollX -= PIPE_SPEED;
    if (baseScrollX <= -sprites.base.width) {
        baseScrollX = 0;
    }
    pipes.forEach((pipe, index) => {
        pipe.update();
        if (pipe.x + pipe.width < 0) {
            pipes.splice(index, 1);
        }
        if (!pipe.passed && bird.x > pipe.x + pipe.width) {
            score++;
            pipe.passed = true;
            scoreDisplay.textContent = score;
            pointSound.play();
            if (score > 0 && score % 5 === 0) {
                PIPE_SPEED += 0.5;
            }
        }
        if (checkCollision(pipe)) {
            endGame();
        }
    });
    if (bird.y + bird.height > canvas.height - sprites.base.height || bird.y < 0) {
        endGame();
    }
}

function draw() {
    ctx.drawImage(sprites.background_day, 0, 0, canvas.width, canvas.height);
    
    // logo central com transparência
    ctx.save();
    ctx.globalAlpha = 0.2;
    const logoWidth = sprites.logo_senac.width * 0.8;
    const logoHeight = sprites.logo_senac.height * 0.8;
    const logoX = (canvas.width - logoWidth) / 2;
    const logoY = (canvas.height - logoHeight) / 2;
    ctx.drawImage(sprites.logo_senac, logoX, logoY, logoWidth, logoHeight);
    ctx.restore();

    pipes.forEach(pipe => pipe.draw());
    ctx.drawImage(sprites.base, baseScrollX, canvas.height - sprites.base.height, sprites.base.width, sprites.base.height);
    ctx.drawImage(sprites.base, baseScrollX + sprites.base.width, canvas.height - sprites.base.height, sprites.base.width, sprites.base.height);
    bird.draw();
}

function spawnPipes() {
    const minGapY = 200;
    const maxGapY = canvas.height - sprites.base.height - 200;
    const gapY = Math.floor(Math.random() * (maxGapY - minGapY + 1)) + minGapY;
    const pipeColor = Math.random() < 0.5 ? 'pipe_green' : 'pipe_red';
    pipes.push(new Pipe(canvas.width, gapY, pipeColor));
}

function checkCollision(pipe) {
    const birdBox = { x: bird.x, y: bird.y, width: bird.width, height: bird.height };
    const topPipeBox = { x: pipe.x, y: pipe.gapY - pipe.gap / 2 - sprites.pipe_green.height, width: pipe.width, height: sprites.pipe_green.height };
    const bottomPipeBox = { x: pipe.x, y: pipe.gapY + pipe.gap / 2, width: pipe.width, height: sprites.pipe_green.height };
    
    if (birdBox.x < topPipeBox.x + topPipeBox.width && birdBox.x + birdBox.width > topPipeBox.x && birdBox.y < topPipeBox.y + topPipeBox.height && birdBox.y + birdBox.height > topPipeBox.y) return true;
    if (birdBox.x < bottomPipeBox.x + bottomPipeBox.width && birdBox.x + birdBox.width > bottomPipeBox.x && birdBox.y < bottomPipeBox.y + bottomPipeBox.height && birdBox.y + birdBox.height > bottomPipeBox.y) return true;
    return false;
}

function startGame() {
    bird = new Bird();
    pipes = [];
    score = 0;
    PIPE_SPEED = 2;
    isGameRunning = true;
    isPaused = false;
    baseScrollX = 0;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    scoreDisplay.style.display = 'block';
    scoreDisplay.textContent = score;
    gameLoop();
    pipeIntervalId = setInterval(spawnPipes, PIPE_SPAWN_INTERVAL);
}

function togglePause() {
    if (!isGameRunning) return;
    isPaused = !isPaused;
    if (isPaused) {
        cancelAnimationFrame(gameLoopId);
        clearInterval(pipeIntervalId);
        pauseScreen.classList.remove('hidden');
    } else {
        pauseScreen.classList.add('hidden');
        gameLoopId = requestAnimationFrame(gameLoop);
        pipeIntervalId = setInterval(spawnPipes, PIPE_SPAWN_INTERVAL);
    }
}

function endGame() {
    hitSound.play();
    setTimeout(() => { dieSound.play(); }, 200);
    isGameRunning = false;
    cancelAnimationFrame(gameLoopId);
    clearInterval(pipeIntervalId);
    if (score > highscore) {
        highscore = score;
        localStorage.setItem('flappyHighscore', highscore);
    }
    finalScore.textContent = score;
    highScoreDisplay.textContent = highscore;
    gameOverScreen.classList.remove('hidden');
    scoreDisplay.style.display = 'none';
}

// 4. Eventos e Listeners
// ===================================================================
startButton.addEventListener('click', startGame);
if (restartButton) restartButton.addEventListener('click', startGame);
resumeButton.addEventListener('click', togglePause);
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && isGameRunning && !isPaused) bird.flap();
    if (e.code === 'KeyP' && isGameRunning) togglePause();
});
canvas.addEventListener('mousedown', () => {
    if (isGameRunning && !isPaused) bird.flap();
});

// =======================
// NOVO: Ranking + Toast
// =======================
function getRanking() {
    try {
        return JSON.parse(localStorage.getItem('flappy_ranking') || '[]');
    } catch {
        return [];
    }
}
function saveToRanking(name, scoreValue) {
    const list = getRanking();
    list.push({ name, score: scoreValue });
    list.sort((a, b) => b.score - a.score);
    localStorage.setItem('flappy_ranking', JSON.stringify(list.slice(0, 10)));
}

let toastTimer = null;
function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    // força reflow p/ anim funcionar mesmo repetindo
    // eslint-disable-next-line no-unused-expressions
    toastEl.offsetHeight;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastEl.classList.remove('show');
        setTimeout(() => toastEl.classList.add('hidden'), 400);
    }, 5000);
}

// Handler do botão "Salvar Pontuação"
if (saveScoreButton) {
    saveScoreButton.addEventListener('click', () => {
        const name = (playerNameInput?.value || '').trim();
        if (!name) {
            showToast('Digite um nome para salvar sua pontuação!');
            return; // NÃO volta pra tela inicial, e NÃO salva sem nome
        }

        // Salva no ranking e volta pra tela inicial
        saveToRanking(name, score);
        if (playerNameInput) playerNameInput.value = '';

        gameOverScreen.classList.add('hidden');
        startScreen.classList.remove('hidden');
    });

    // elementos da tela de ranking
        const rankingButton = document.getElementById('ranking-button');
        const rankingScreen = document.getElementById('ranking-screen');
        const backButton = document.getElementById('back-button');
        const rankingList = document.getElementById('ranking-list');

        // abrir ranking
        rankingButton.addEventListener('click', () => {
            startScreen.classList.add('hidden');
            rankingScreen.classList.remove('hidden');
            renderRanking();
        });

        // voltar da tela de ranking
        backButton.addEventListener('click', () => {
            rankingScreen.classList.add('hidden');
            startScreen.classList.remove('hidden');
        });

        // renderizar ranking
        function renderRanking() {
            const ranking = getRanking();
            rankingList.innerHTML = ranking
                .map((p, i) => `<li>${i + 1}. ${p.name} - ${p.score}</li>`)
                .join('');
        }

}
