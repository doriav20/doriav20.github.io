const CW = 360;
const CH = 640;
const GRAVITY = 1600;
const FLAP_VEL = -510;
const PIPE_SPEED = 210;
const PIPE_GAP = 148;
const PIPE_W = 54;
const PIPE_INT = 1.62;
const GROUND_H = 72;
const BIRD_SZ = 46;
const BIRD_X = 88;

let state = 'title';
let score = 0;
let bestScore = 0;
let sel = 0;
let birdImgs = Array(4).fill(null);
let bird = {x: BIRD_X, y: 0, vy: 0, angle: 0};
let pipes = [];
let pipeTimer = 0;
let gndOff = 0;
let parts = [];
let cloudOff = 0;
let titleT = 0;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    const s = Math.min(window.innerWidth / CW, window.innerHeight / CH, 1.7);
    canvas.width = CW;
    canvas.height = CH;
    canvas.style.width = CW * s + 'px';
    canvas.style.height = CH * s + 'px';
}

resize();
window.addEventListener('resize', resize);

function loadImages() {
    return new Promise(resolve => {
        let n = 0;
        THEMES.forEach((t, i) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                birdImgs[i] = img;
                if (++n === THEMES.length) resolve();
            };
            img.onerror = () => {
                birdImgs[i] = null;
                if (++n === THEMES.length) resolve();
            };
            img.src = t.imgUrl;
        });
    });
}

function buildSelector() {
    const c = document.getElementById('bird-selector');
    c.innerHTML = '';

    THEMES.forEach(t => {
        const el = document.createElement('div');
        el.className = 'bird-option' + (t.id === sel ? ' selected' : '');
        el.dataset.bird = t.id;
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        el.setAttribute('aria-label', 'Select ' + t.name + ' bird');

        const img = document.createElement('img');
        img.src = t.imgUrl;
        img.crossOrigin = 'anonymous';
        img.alt = t.name;
        img.width = 56;
        img.height = 56;
        img.loading = 'lazy';

        const nm = document.createElement('div');
        nm.className = 'bird-name';
        nm.style.color = sel === t.id ? t.birdColor : '#8888aa';
        nm.textContent = t.name;

        el.appendChild(img);
        el.appendChild(nm);

        el.addEventListener('click', () => {
            sel = t.id;
            buildSelector();
            applyTheme();
        });

        el.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                sel = t.id;
                buildSelector();
                applyTheme();
            }
        });

        c.appendChild(el);
    });
}

function applyTheme() {
    const T = THEMES[sel];

    document.getElementById('title-text').style.color = T.titleColor;
    document.getElementById('btn-start').style.background = T.btnBg;
    document.getElementById('btn-resume').style.background = T.btnBg;
    document.getElementById('btn-restart').style.background = T.btnBg;
    document.querySelector('.hud-score').style.color = T.scoreColor;
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (id) document.getElementById('screen-' + id).classList.add('active');
    document.getElementById('pause-btn').style.display = 'none';
    document.getElementById('hud').style.opacity = '0';
}

function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('pause-btn').style.display = 'flex';
    document.getElementById('hud').style.opacity = '1';
}

function initBird() {
    bird.x = BIRD_X;
    bird.y = CH / 2 - 40;
    bird.vy = 0;
    bird.angle = 0;
}

function spawnPipe() {
    const skyH = CH - GROUND_H;
    const topH = 60 + Math.random() * (skyH - PIPE_GAP - 120);
    pipes.push({x: CW + PIPE_W, topH, scored: false});
}

function resetGame() {
    score = 0;
    pipes = [];
    pipeTimer = 0;
    gndOff = 0;
    parts = [];
    initBird();
    document.getElementById('hud-score').textContent = '0';
}

function flap() {
    if (state !== 'playing') return;

    bird.vy = FLAP_VEL;
    playSFX(580, 0.08, 'sine');

    const T = THEMES[sel];
    for (let i = 0; i < 6; i++) {
        parts.push({
            x: bird.x - 8,
            y: bird.y + BIRD_SZ / 2,
            vx: -Math.random() * 90 - 20,
            vy: (Math.random() - 0.5) * 130,
            life: 0.3,
            maxLife: 0.3,
            color: T.birdColor,
            size: 4 + Math.random() * 4,
        });
    }
}

function startGame() {
    state = 'playing';
    resetGame();
    hideAllScreens();
    if (audioCtx) audioCtx.resume();
}

function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    showScreen('pause');
}

function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    hideAllScreens();
    lastTime = performance.now();
}

function gameOver() {
    state = 'gameover';
    const isNew = score > bestScore;
    if (isNew) bestScore = score;

    document.getElementById('go-score').textContent = score;
    document.getElementById('go-score').style.color = THEMES[sel].birdColor;
    document.getElementById('go-best').textContent = isNew ? '\u2605 NEW BEST: ' + bestScore : 'Best: ' + bestScore;
    document.getElementById('go-best').style.color = isNew ? THEMES[sel].birdColor : '#a855f7';
    document.getElementById('hud-best').textContent = bestScore;

    playSFX(180, 0.45, 'sawtooth');

    const T = THEMES[sel];
    for (let i = 0; i < 22; i++) {
        const a = (Math.PI * 2 * i) / 22;
        parts.push({
            x: bird.x + BIRD_SZ / 2,
            y: bird.y + BIRD_SZ / 2,
            vx: Math.cos(a) * (100 + Math.random() * 200),
            vy: Math.sin(a) * (100 + Math.random() * 200),
            life: 0.9,
            maxLife: 0.9,
            color: i % 2 === 0 ? T.birdColor : T.birdAccent,
            size: 6 + Math.random() * 6,
        });
    }

    setTimeout(() => showScreen('gameover'), 700);
}

function checkCollision() {
    const bx = bird.x + 7;
    const by = bird.y + 7;
    const bw = BIRD_SZ - 14;
    const bh = BIRD_SZ - 14;

    if (bird.y + BIRD_SZ >= CH - GROUND_H) return true;
    if (bird.y < -10) return true;

    for (const p of pipes) {
        if (bx + bw > p.x && bx < p.x + PIPE_W) {
            if (by < p.topH || by + bh > p.topH + PIPE_GAP) return true;
        }
    }

    return false;
}

let audioCtx;

function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSFX(freq, dur, type) {
    try {
        ensureAudio();
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = type || 'square';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.22, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
        o.connect(g).connect(audioCtx.destination);
        o.start();
        o.stop(audioCtx.currentTime + dur);
    } catch (e) {
    }
}

function update(dt) {
    if (state !== 'playing') return;

    bird.vy += GRAVITY * dt;
    bird.y += bird.vy * dt;

    const tA =
        bird.vy > 0
            ? Math.min((bird.vy / 600) * (Math.PI / 2), Math.PI * 0.42)
            : Math.max((bird.vy / 600) * (Math.PI / 2), -0.4);

    bird.angle += (tA - bird.angle) * 10 * dt;
    gndOff = (gndOff + PIPE_SPEED * dt) % 48;

    pipeTimer += dt;
    if (pipeTimer >= PIPE_INT) {
        spawnPipe();
        pipeTimer = 0;
    }

    for (const p of pipes) p.x -= PIPE_SPEED * dt;
    pipes = pipes.filter(p => p.x + PIPE_W > -20);

    for (const p of pipes) {
        if (!p.scored && p.x + PIPE_W < bird.x) {
            p.scored = true;
            score++;
            document.getElementById('hud-score').textContent = score;
            playSFX(860, 0.07, 'square');
        }
    }

    for (const p of parts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 320 * dt;
        p.life -= dt;
    }

    parts = parts.filter(p => p.life > 0);

    if (checkCollision()) gameOver();
}

const STARS = [
    [38, 28],
    [88, 76],
    [158, 18],
    [208, 52],
    [278, 32],
    [318, 88],
    [48, 118],
    [138, 96],
    [248, 138],
    [178, 64],
    [302, 50],
];

function drawSky(T) {
    const g = ctx.createLinearGradient(0, 0, 0, CH - GROUND_H);
    g.addColorStop(0, T.sky.top);
    g.addColorStop(0.45, T.sky.mid);
    g.addColorStop(1, T.sky.bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH - GROUND_H);

    if (T.sky.stars) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        STARS.forEach(([sx, sy]) => {
            ctx.beginPath();
            ctx.arc(sx, sy, 1.1, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

function drawClouds(T, dt) {
    if (state === 'playing') cloudOff += dt * 18;
    ctx.fillStyle = T.sky.cloudColor;

    [
        {x: 55, y: 75, r: 28, s: 0.3},
        {x: 195, y: 48, r: 22, s: 0.2},
        {x: 305, y: 96, r: 19, s: 0.25},
        {x: 140, y: 130, r: 16, s: 0.18},
    ].forEach(c => {
        const cx = ((c.x - cloudOff * c.s) % (CW + 110) + CW + 110) % (CW + 110) - 55;
        ctx.beginPath();
        ctx.arc(cx, c.y, c.r, 0, Math.PI * 2);
        ctx.arc(cx + c.r * 0.8, c.y - c.r * 0.4, c.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawPipe(p, T) {
    const P = T.pipe;

    ctx.fillStyle = P.body;
    ctx.fillRect(p.x, 0, PIPE_W, p.topH);

    ctx.fillStyle = P.cap;
    ctx.beginPath();
    ctx.roundRect(p.x - 5, p.topH - 22, PIPE_W + 10, 22, [0, 0, 6, 6]);
    ctx.fill();

    ctx.fillStyle = P.shine;
    ctx.fillRect(p.x + 6, 0, 8, p.topH - 22);

    const botY = p.topH + PIPE_GAP;
    const botH = CH - GROUND_H - botY;

    ctx.fillStyle = P.body;
    ctx.fillRect(p.x, botY, PIPE_W, botH);

    ctx.fillStyle = P.cap;
    ctx.beginPath();
    ctx.roundRect(p.x - 5, botY, PIPE_W + 10, 22, [6, 6, 0, 0]);
    ctx.fill();

    ctx.fillStyle = P.shine;
    ctx.fillRect(p.x + 6, botY + 22, 8, botH);
}

function drawGround(T) {
    const G = T.ground;
    const gy = CH - GROUND_H;

    const dg = ctx.createLinearGradient(0, gy, 0, CH);
    dg.addColorStop(0, G.dirt1);
    dg.addColorStop(1, G.dirt2);
    ctx.fillStyle = dg;
    ctx.fillRect(0, gy, CW, GROUND_H);

    ctx.fillStyle = G.grass;
    ctx.fillRect(0, gy, CW, 14);

    ctx.fillStyle = G.grassDash;
    for (let x = -(gndOff % 48); x < CW + 48; x += 48) {
        ctx.fillRect(x, gy + 4, 24, 6);
    }
}

function drawBird(T) {
    const cx = bird.x + BIRD_SZ / 2;
    const cy = bird.y + BIRD_SZ / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(bird.angle);

    const bg = ctx.createRadialGradient(-5, -8, 3, 0, 0, BIRD_SZ / 2);
    bg.addColorStop(0, T.birdColor + 'cc');
    bg.addColorStop(1, T.birdColor + '33');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_SZ / 2, 0, Math.PI * 2);
    ctx.fill();

    const img = birdImgs[sel];
    if (img && img.complete && img.naturalWidth > 0) {
        const s = BIRD_SZ * 0.82;
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, BIRD_SZ / 2 - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, -s / 2, -s / 2, s, s);
        ctx.restore();
    } else {
        ctx.font = BIRD_SZ * 0.5 + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\uD83D\uDE0A', 0, 0);
    }

    const wf = Math.sin(Date.now() / 80) * 0.3;
    ctx.fillStyle = T.birdColor;
    ctx.globalAlpha = 0.6;
    ctx.save();
    ctx.rotate(-0.3 + wf);
    ctx.beginPath();
    ctx.ellipse(-BIRD_SZ * 0.3, BIRD_SZ * 0.06, BIRD_SZ * 0.22, BIRD_SZ * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = T.birdAccent + '55';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_SZ / 2 + 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

function drawTitleBird(T, dt) {
    titleT += dt;
    const cy = CH / 2 - 60 + Math.sin(titleT * 2.5) * 22;
    const cx = CW / 2;
    const r = BIRD_SZ * 0.62;

    ctx.save();
    ctx.globalAlpha = 0.4;
    const bg = ctx.createRadialGradient(cx - 4, cy - 6, 2, cx, cy, r);
    bg.addColorStop(0, T.birdColor + 'cc');
    bg.addColorStop(1, T.birdColor + '22');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawParticles() {
    for (const p of parts) {
        const a = p.life / p.maxLife;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        const s = p.size * a;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
}

function render(dt) {
    const T = THEMES[sel];
    ctx.clearRect(0, 0, CW, CH);

    drawSky(T);
    drawClouds(T, dt);

    for (const p of pipes) drawPipe(p, T);

    drawGround(T);

    if (state === 'title') {
        drawTitleBird(T, dt);
    } else {
        drawBird(T);
        drawParticles();
    }

    const v = ctx.createRadialGradient(CW / 2, CH / 2, CH * 0.3, CW / 2, CH / 2, CH * 0.77);
    v.addColorStop(0, 'transparent');
    v.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, CW, CH);
}

let lastTime = performance.now();
let _fps = 0;
let _fr = 0;
let _fpsLast = performance.now();

function loop(ts) {
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    _fr++;
    if (ts - _fpsLast >= 1000) {
        _fps = (_fr * 1000) / (ts - _fpsLast);
        _fr = 0;
        _fpsLast = ts;
    }

    document.getElementById('debug').textContent = 'FPS:' + _fps.toFixed(0) + ' | ' + state + ' | score:' + score;

    update(dt);
    render(dt);
    requestAnimationFrame(loop);
}

function handleFlap() {
    if (state === 'playing') {
        flap();
        return;
    }

    if (state === 'title' || state === 'gameover') {
        startGame();
        return;
    }
}

document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleFlap();
    }

    if (e.code === 'KeyP' && state === 'playing') pauseGame();
    if (e.code === 'KeyP' && state === 'paused') resumeGame();
});

canvas.addEventListener('click', () => {
    ensureAudio();
    handleFlap();
});

canvas.addEventListener(
    'touchstart',
    e => {
        e.preventDefault();
        ensureAudio();
        handleFlap();
    },
    {passive: false}
);

document.getElementById('btn-start').addEventListener('click', () => {
    ensureAudio();
    startGame();
});

document.getElementById('btn-resume').addEventListener('click', resumeGame);

document.getElementById('btn-restart').addEventListener('click', () => {
    ensureAudio();
    startGame();
});

document.getElementById('btn-menu-pause').addEventListener('click', () => {
    state = 'title';
    showScreen('title');
    buildSelector();
    applyTheme();
});

document.getElementById('btn-menu-go').addEventListener('click', () => {
    state = 'title';
    showScreen('title');
    buildSelector();
    applyTheme();
});

document.getElementById('pause-btn').addEventListener('click', pauseGame);

async function init() {
    await loadImages();
    buildSelector();
    applyTheme();
    initBird();
    showScreen('title');
    requestAnimationFrame(loop);
}

init();
