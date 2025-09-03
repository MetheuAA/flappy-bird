// script.js

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Telas e botões
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const pauseScreen = document.getElementById('pause-screen');
const rankingScreen = document.getElementById('ranking-screen');

const scoreDisplay = document.getElementById('score-display');
const finalScore = document.getElementById('final-score');
const highScoreDisplay = document.getElementById('high-score');

const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const resumeButton = document.getElementById('resume-button');

const rankingButton = document.getElementById('ranking-button');
const backRankingButton = document.getElementById('back-ranking');
const rankingList = document.getElementById('ranking-list');

const playerNameInput = document.getElementById('player-name');
const saveScoreButton = document.getElementById('save-score');

startButton.disabled = false;
startButton.textContent = "Iniciar";


// Áudios
const flapSound = new Audio('assets/audio/wing.wav');
const pointSound = new Audio('assets/audio/point.wav');
const hitSound = new Audio('assets/audio/hit.wav');
const dieSound = new Audio('assets/audio/die.wav');

// Sprites
const sprites = {};
let spritesLoaded = 0;
const totalSprites = 8;

function allSpritesLoaded() { setupGame(); }

function loadSprite(id) {
    sprites[id] = document.getElementById(id);
    const img = sprites[id];
    img.onload = () => {
        spritesLoaded++;
        if (spritesLoaded === totalSprites) allSpritesLoaded();
    };
    if (img.complete) {
        if (!img.dataset.loaded) {
            spritesLoaded++;
            img.dataset.loaded = 'true';
            if (spritesLoaded === totalSprites) allSpritesLoaded();
        }
    }
}

['bird_up','bird_mid','bird_down','pipe_green','pipe_red','background_day','base','logo_senac'].forEach(loadSprite);

// Constantes e variáveis
let gameLoopId, pipeIntervalId, isGameRunning = false, isPaused = false, score = 0;
let highscore = localStorage.getItem('flappyHighscore') || 0;
const GRAVITY = 0.3, FLAP_POWER = 6, PIPE_WIDTH = 52, PIPE_GAP = 200, PIPE_SPAWN_INTERVAL = 1800;
let PIPE_SPEED = 2;

let bird;
const birdAnimationFrames = ['bird_up', 'bird_mid', 'bird_down', 'bird_mid'];
let birdFrameIndex = 0, frameCounter = 0;
const birdWidth = 34, birdHeight = 24;
let pipes = [], baseScrollX = 0;

// --- CLASSES ---
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
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.rotate(this.angle);
        const currentFrame = sprites[birdAnimationFrames[birdFrameIndex]];
        ctx.drawImage(currentFrame, -this.width/2, -this.height/2, this.width, this.height);
        ctx.restore();
    }
    update() {
        this.velocity += GRAVITY;
        this.y += this.velocity;
        this.angle = this.velocity * 0.05;
        if (this.angle > Math.PI/2) this.angle = Math.PI/2;
        if (this.angle < -Math.PI/4) this.angle = -Math.PI/4;
        frameCounter++;
        if (frameCounter >= 5) {
            birdFrameIndex = (birdFrameIndex +1) % birdAnimationFrames.length;
            frameCounter = 0;
        }
    }
    flap() {
        this.velocity = -FLAP_POWER;
        flapSound.currentTime = 0; flapSound.play();
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
        const topHeight = this.gapY - this.gap/2;
        const bottomHeight = canvas.height - (this.gapY + this.gap/2);
        
        ctx.save();
        ctx.translate(this.x + this.width, topHeight);
        ctx.rotate(Math.PI);
        ctx.drawImage(pipeImage, 0, 0, this.width, pipeImage.height);
        ctx.restore();
        
        ctx.drawImage(pipeImage, this.x, this.gapY + this.gap/2, this.width, pipeImage.height);
    }
    update() { this.x -= PIPE_SPEED; }
}

// --- FUNÇÕES ---
function setupGame() {
    // habilita botão de iniciar
    startButton.disabled = false;
    startButton.textContent = "Iniciar";
    highScoreDisplay.textContent = localStorage.getItem('flappyHighscore') || 0;
}


function spawnPipes() {
    const minGapY = 200;
    const maxGapY = canvas.height - sprites.base.height - 200;
    const gapY = Math.floor(Math.random() * (maxGapY - minGapY +1)) + minGapY;
    const pipeColor = Math.random() < 0.5 ? 'pipe_green' : 'pipe_red';
    pipes.push(new Pipe(canvas.width, gapY, pipeColor));
}

function checkCollision(pipe) {
    const birdBox = { x: bird.x, y: bird.y, width: bird.width, height: bird.height };
    const topPipeBox = { x: pipe.x, y: pipe.gapY - pipe.gap/2 - sprites.pipe_green.height, width: pipe.width, height: sprites.pipe_green.height };
    const bottomPipeBox = { x: pipe.x, y: pipe.gapY + pipe.gap/2, width: pipe.width, height: sprites.pipe_green.height };
    
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
    rankingScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    scoreDisplay.style.display = 'block';
    scoreDisplay.textContent = score;
    gameLoop();
    pipeIntervalId = setInterval(spawnPipes, PIPE_SPAWN_INTERVAL);
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
    if (baseScrollX <= -sprites.base.width) baseScrollX = 0;
    pipes.forEach((pipe,index)=>{
        pipe.update();
        if(pipe.x + pipe.width <0) pipes.splice(index,1);
        if(!pipe.passed && bird.x > pipe.x + pipe.width){
            score++;
            pipe.passed = true;
            scoreDisplay.textContent = score;
            pointSound.play();
            if(score>0 && score %5===0) PIPE_SPEED+=0.5;
        }
        if(checkCollision(pipe)) endGame();
    });
    if(bird.y + bird.height > canvas.height - sprites.base.height || bird.y <0) endGame();
}

function draw() {
    ctx.drawImage(sprites.background_day,0,0,canvas.width,canvas.height);
    ctx.save();
    ctx.globalAlpha = 0.2;
    const logoWidth = sprites.logo_senac.width*0.8;
    const logoHeight = sprites.logo_senac.height*0.8;
    const logoX = (canvas.width - logoWidth)/2;
    const logoY = (canvas.height - logoHeight)/2;
    ctx.drawImage(sprites.logo_senac,logoX,logoY,logoWidth,logoHeight);
    ctx.restore();

    pipes.forEach(pipe => pipe.draw());
    ctx.drawImage(sprites.base, baseScrollX, canvas.height - sprites.base.height, sprites.base.width, sprites.base.height);
    ctx.drawImage(sprites.base, baseScrollX + sprites.base.width, canvas.height - sprites.base.height, sprites.base.width, sprites.base.height);
    bird.draw();
}

function endGame() {
    hitSound.play();
    setTimeout(()=>{ dieSound.play(); },200);
    isGameRunning = false;
    cancelAnimationFrame(gameLoopId);
    clearInterval(pipeIntervalId);
    if(score>highscore){
        highscore=score;
        localStorage.setItem('flappyHighscore',highscore);
    }
    finalScore.textContent = score;
    highScoreDisplay.textContent = highscore;
    gameOverScreen.classList.remove('hidden');
    scoreDisplay.style.display='none';
}

// --- EVENTOS ---
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
resumeButton.addEventListener('click', togglePause);

rankingButton.addEventListener('click', () => {
    rankingScreen.classList.remove('hidden');
    startScreen.classList.add('hidden');
    updateRanking();
});

backRankingButton.addEventListener('click', ()=>{
    rankingScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

saveScoreButton.addEventListener('click', ()=>{
    const name = playerNameInput.value.trim();
    if(name==='') return alert('Digite seu nome!');
    saveRanking(name, score);
    playerNameInput.value='';
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

// Flap do pássaro
document.addEventListener('keydown', (e)=>{
    if(e.code==='Space' && isGameRunning && !isPaused) bird.flap();
    if(e.code==='KeyP' && isGameRunning) togglePause();
});
canvas.addEventListener('mousedown', ()=>{
    if(isGameRunning && !isPaused) bird.flap();
});

// --- PAUSA ---
function togglePause(){
    if(!isGameRunning) return;
    isPaused=!isPaused;
    if(isPaused){
        cancelAnimationFrame(gameLoopId);
        clearInterval(pipeIntervalId);
        pauseScreen.classList.remove('hidden');
    } else {
        pauseScreen.classList.add('hidden');
        gameLoopId=requestAnimationFrame(gameLoop);
        pipeIntervalId=setInterval(spawnPipes,PIPE_SPAWN_INTERVAL);
    }
}

// --- RANKING ---
function saveRanking(name, score){
    let ranking = JSON.parse(localStorage.getItem('flappyRanking')) || [];
    ranking.push({name, score});
    ranking.sort((a,b)=>b.score - a.score);
    if(ranking.length>10) ranking.length=10;
    localStorage.setItem('flappyRanking',JSON.stringify(ranking));
}

function updateRanking(){
    let ranking = JSON.parse(localStorage.getItem('flappyRanking')) || [];
    rankingList.innerHTML='';
    ranking.forEach(entry=>{
        const li = document.createElement('li');
        li.textContent = `${entry.name} - ${entry.score}`;
        rankingList.appendChild(li);
    });
}
