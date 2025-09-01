// flappy.js — versão corrigida

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// UI
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-button');
const finalScoreEl = document.getElementById('final-score');
const bestScoreEl = document.getElementById('best-score');
const spriteContainer = document.getElementById('sprite-container');

// Sprites e sons
const SPRITES = {};
const SFX = {
    wing: new Audio('assets/audio/wing.wav'),
    point: new Audio('assets/audio/point.wav'),
    hit: new Audio('assets/audio/hit.wav'),
    die: new Audio('assets/audio/die.wav')
};
Object.values(SFX).forEach(a => { a.preload='auto'; try{ a.volume=0.95 }catch{} });

// Estado
let running = false;
let frame = 0;
let score = 0;
let bestScore = Number(localStorage.getItem('flappy_best') || 0);

// Mundo
const WORLD = {
    gravity: 0.45,
    baseY: canvas.height - 112,
    baseScroll: 0,
    pipes: []
};

// Utilidades
function safePlay(audio){ try{ audio.currentTime=0; audio.play(); }catch{} }
function randRange(min,max){ return Math.random()*(max-min)+min; }
function aabb(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }

// --- BIRD ---
class Bird {
    constructor(){ this.reset(); }
    reset(){ this.x=120; this.y=canvas.height/2; this.vy=0; this.anim=1; this.w=34; this.h=24; }
    flap(){ this.vy=-7; safePlay(SFX.wing); }
    update(){
        this.vy += WORLD.gravity;
        this.y += this.vy;
        if(frame % 5 === 0) this.anim=(this.anim+1)%3;
        if(this.y<-40) this.y=-40;
    }
    draw(){
        const imgs = [SPRITES.bluebird_downflap, SPRITES.bluebird_midflap, SPRITES.bluebird_upflap];
        const img = imgs[this.anim]||imgs[1];
        if(img && img.complete) ctx.drawImage(img,this.x,this.y,this.w,this.h);
        else { ctx.fillStyle='#ff0'; ctx.fillRect(this.x,this.y,this.w,this.h); }
    }
    getAABB(){ return { x:this.x, y:this.y, w:this.w, h:this.h }; }
}
const bird = new Bird();

// --- PIPE ---
class PipePair {
    constructor(x,gapY,gapH,useRed=false){
        this.x=x; this.gapY=gapY; this.gapH=gapH;
        this.passed=false; this.useRed=useRed;
    }
    update(speed){ this.x -= speed; }
    isOffscreen(){ return this.x + (SPRITES.pipe_green?.width||52) < 0; }

    draw(){
        const pipeImg = this.useRed ? (SPRITES.pipe_red || SPRITES.pipe_green) : (SPRITES.pipe_green || SPRITES.pipe_red);
        const pw = pipeImg?.width || 52;
        const ph = pipeImg?.height || 320;

        if(!pipeImg || !pipeImg.complete){
            ctx.fillStyle='#2d9a3a';
            ctx.fillRect(this.x,0,52,this.gapY);
            ctx.fillRect(this.x,this.gapY+this.gapH,52,WORLD.baseY-(this.gapY+this.gapH));
            return;
        }

        // Top Pipe — ajustado para alinhamento correto
        ctx.drawImage(pipeImg, this.x, this.gapY - ph, pw, ph);

        // Bottom Pipe
        ctx.drawImage(pipeImg, this.x, this.gapY + this.gapH, pw, ph);
    }

    collides(birdBox){
        const pw = (SPRITES.pipe_green?.width)||(SPRITES.pipe_red?.width)||52;

        // Top Pipe
        const topRect = { x:this.x, y:0, w:pw, h:this.gapY };

        // Bottom Pipe
        const bottomRect = { x:this.x, y:this.gapY+this.gapH, w:pw, h:WORLD.baseY-(this.gapY+this.gapH) };

        return aabb(birdBox.x,birdBox.y,birdBox.w,birdBox.h,topRect.x,topRect.y,topRect.w,topRect.h)
            || aabb(birdBox.x,birdBox.y,birdBox.w,birdBox.h,bottomRect.x,bottomRect.y,bottomRect.w,bottomRect.h);
    }
}

// --- SPAWN E DIFICULDADE ---
let spawnCounter=0;
function difficulty(){
    const speed = 2.2 + Math.min(3.3, score*0.03);
    const gapH = Math.max(120, 200 - score*2);
    const spawnEvery = Math.max(50, 110 - Math.floor(score*0.6));
    return { speed, gapH, spawnEvery };
}

function spawnPipes(){
    const { speed, gapH, spawnEvery } = difficulty();
    if(spawnCounter++ < spawnEvery) return;
    spawnCounter=0;

    const minGapY=40;
    const maxGapY=WORLD.baseY-gapH-40;
    const gapY=Math.floor(randRange(minGapY,maxGapY));

    // Distância mínima entre canos
    if(WORLD.pipes.length>0){
        const lastPipe = WORLD.pipes[WORLD.pipes.length-1];
        const minDistance = 140;
        if((lastPipe.x + (SPRITES.pipe_green?.width||52)) > (canvas.width - minDistance)) return;
    }

    const useRed = Math.random()<0.45;
    WORLD.pipes.push(new PipePair(canvas.width+10,gapY,gapH,useRed));
}

// --- UPDATE PIPES ---
function updatePipes(){
    const { speed } = difficulty();
    for(let i=WORLD.pipes.length-1;i>=0;i--){
        const pipe = WORLD.pipes[i];
        pipe.update(speed);

        if(!pipe.passed && (pipe.x+(SPRITES.pipe_green?.width||52)) < bird.x){
            pipe.passed=true; score++; safePlay(SFX.point);
        }

        if(pipe.collides(bird.getAABB())) return onHit();
        if(pipe.isOffscreen()) WORLD.pipes.splice(i,1);
    }
}

// --- DESENHO ---
function drawBackground(){
    const bg = SPRITES.background_day;
    if(bg && bg.complete) ctx.drawImage(bg,0,0,canvas.width,canvas.height);
    else { ctx.fillStyle='#70c5ce'; ctx.fillRect(0,0,canvas.width,canvas.height); }
}

function drawBase(speed){
    const base = SPRITES.base;
    if(!base || !base.complete) return;
    WORLD.baseScroll = (WORLD.baseScroll - speed) % base.width;
    const y = WORLD.baseY;
    for(let i=-1;i<3;i++) ctx.drawImage(base,WORLD.baseScroll+i*base.width,y);
}

function drawHUD(){
    ctx.font='800 32px Montserrat, sans-serif';
    ctx.textAlign='center';
    ctx.lineWidth=6; ctx.strokeStyle='rgba(255, 255, 255, 0.45)'; ctx.fillStyle='#fff';
    ctx.strokeText(String(score),canvas.width/2,80);
    ctx.fillText(String(score),canvas.width/2,80);
}

// --- UPDATE & LOOP ---
function update(){
    frame++;
    bird.update();
    spawnPipes();
    updatePipes();
    if(bird.getAABB().y+bird.h >= WORLD.baseY) onHit();
}

function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawBackground();
    WORLD.pipes.forEach(p=>p.draw());
    drawBase(difficulty().speed);
    bird.draw();
    drawHUD();
}

function gameLoop(){
    if(running) update();
    draw();
    requestAnimationFrame(gameLoop);
}

// --- CONTROLES ---
function handleFlap(){ if(!running) startGame(); else bird.flap(); }
window.addEventListener('keydown',e=>{
    if(e.code==='Space'){ e.preventDefault(); handleFlap(); }
    if(e.code==='KeyP') togglePause();
});
canvas.addEventListener('pointerdown',handleFlap,{passive:true});
startBtn.addEventListener('click',startGame);

let paused = false;
function togglePause(){
    if(!running) return;
    paused = !paused;
    document.getElementById('pause-screen').classList.toggle('hidden', !paused);
}

// --- GAME FLOW ---
function startGame(){
    running=true; paused=false;
    score=0; frame=0; spawnCounter=0;
    WORLD.pipes.length=0; WORLD.baseScroll=0; bird.reset();
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
}

function onHit(){
    safePlay(SFX.hit); setTimeout(()=>safePlay(SFX.die),90);
    running=false; 
    if(score>bestScore){ bestScore=score; localStorage.setItem('flappy_best',String(bestScore)); }
    finalScoreEl.textContent=String(score);
    bestScoreEl.textContent=String(bestScore);

    // Reset ranking UI
    nameInput.disabled = false;
    saveBtn.disabled = false;
    nameInput.value = '';
    rankingDiv.classList.add('hidden');

    gameOverScreen.classList.remove('hidden');
}



// --- Ranking ---
const saveBtn = document.getElementById('save-score');
const nameInput = document.getElementById('player-name');
const rankingDiv = document.getElementById('ranking');
const rankingList = document.getElementById('ranking-list');

function getRanking(){
    const ranking = JSON.parse(localStorage.getItem('flappy_ranking') || '[]');
    return ranking;
}

function saveRanking(name, score){
    const ranking = getRanking();
    ranking.push({name, score});
    // Ordena decrescente e mantém só top 5
    ranking.sort((a,b)=>b.score - a.score);
    localStorage.setItem('flappy_ranking', JSON.stringify(ranking.slice(0,5)));
}

function showRanking(){
    const ranking = getRanking();
    rankingList.innerHTML = '';
    ranking.forEach(entry=>{
        const li = document.createElement('li');
        li.textContent = `${entry.name} - ${entry.score}`;
        rankingList.appendChild(li);
    });
    rankingDiv.classList.remove('hidden');
}

// Botão salvar
saveBtn.addEventListener('click',()=>{
    const name = nameInput.value.trim() || 'Anônimo';
    saveRanking(name, score);
    showRanking();

    // Desabilita input e botão
    nameInput.disabled = true;
    saveBtn.disabled = true;

    // Volta automaticamente para a tela inicial após 1 segundo
    setTimeout(()=>{
        gameOverScreen.classList.add('hidden');
        startScreen.classList.remove('hidden');
    }, 1000);
});



function restartGame(){
    startGame();
}

// --- CARREGAMENTO DE SPRITES ---
function loadSpritesFromDOM(){
    const imgs = Array.from(spriteContainer.querySelectorAll('img'));
    if(!imgs.length) return Promise.resolve();
    let loaded=0; const total=imgs.length;
    return new Promise(resolve=>{
        imgs.forEach(img=>{
            SPRITES[img.id]=img;
            if(img.complete && img.naturalWidth>0){ loaded++; if(loaded>=total) resolve(); }
            else {
                img.addEventListener('load',()=>{ loaded++; if(loaded>=total) resolve(); });
                img.addEventListener('error',()=>{ loaded++; if(loaded>=total) resolve(); });
            }
        });
    });
}

async function boot(){
    startBtn.disabled=true; startBtn.textContent='A Carregar...';
    await loadSpritesFromDOM();
    startBtn.disabled=false; startBtn.textContent='Iniciar';
    bestScoreEl.textContent=String(bestScore);
    if(SPRITES.base && SPRITES.base.complete) WORLD.baseY=canvas.height-SPRITES.base.height;
    requestAnimationFrame(gameLoop);
}

boot();
