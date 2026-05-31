const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');

const W = 600;
const H = 560;
canvas.width = W;
canvas.height = H;

// ── Sprites desenhados em canvas ──────────────────────────────────────────────
function drawPlayer(x, y) {
  ctx.fillStyle = '#0f0';
  // corpo
  ctx.fillRect(x + 10, y + 10, 20, 14);
  // canhão
  ctx.fillRect(x + 18, y + 2, 4, 10);
  // pés
  ctx.fillRect(x + 2, y + 20, 8, 6);
  ctx.fillRect(x + 30, y + 20, 8, 6);
}

function drawInvader(x, y, type, frame) {
  const colors = ['#f55', '#f90', '#55f'];
  ctx.fillStyle = colors[type % 3];
  const f = frame % 2;

  if (type === 0) {
    // octopus
    ctx.fillRect(x + 8, y, 16, 4);
    ctx.fillRect(x + 4, y + 4, 24, 12);
    ctx.fillRect(x + 8, y + 16, 16, 4);
    if (f === 0) {
      ctx.fillRect(x + 2, y + 6, 4, 8);
      ctx.fillRect(x + 26, y + 6, 4, 8);
    } else {
      ctx.fillRect(x + 4, y + 12, 4, 6);
      ctx.fillRect(x + 24, y + 12, 4, 6);
    }
    ctx.fillRect(x + 10, y + 8, 4, 4);
    ctx.fillRect(x + 18, y + 8, 4, 4);
  } else if (type === 1) {
    // crab
    ctx.fillRect(x + 6, y + 2, 20, 4);
    ctx.fillRect(x + 4, y + 6, 24, 10);
    ctx.fillRect(x + 8, y + 16, 6, 4);
    ctx.fillRect(x + 18, y + 16, 6, 4);
    if (f === 0) {
      ctx.fillRect(x, y + 4, 4, 6);
      ctx.fillRect(x + 28, y + 4, 4, 6);
    } else {
      ctx.fillRect(x, y + 8, 4, 4);
      ctx.fillRect(x + 28, y + 8, 4, 4);
    }
    ctx.fillRect(x + 10, y + 8, 4, 4);
    ctx.fillRect(x + 18, y + 8, 4, 4);
  } else {
    // squid
    ctx.fillRect(x + 10, y, 12, 4);
    ctx.fillRect(x + 6, y + 4, 20, 12);
    ctx.fillRect(x + 4, y + 10, 4, 4);
    ctx.fillRect(x + 24, y + 10, 4, 4);
    ctx.fillRect(x + 8, y + 16, 6, 4);
    ctx.fillRect(x + 18, y + 16, 6, 4);
    if (f === 0) {
      ctx.fillRect(x + 2, y + 14, 4, 6);
      ctx.fillRect(x + 26, y + 14, 4, 6);
    } else {
      ctx.fillRect(x + 2, y + 8, 4, 4);
      ctx.fillRect(x + 26, y + 8, 4, 4);
    }
    ctx.fillRect(x + 12, y + 6, 8, 4);
  }
}

function drawBunker(x, y, health) {
  const alpha = health / 4;
  ctx.fillStyle = `rgba(0, 200, 0, ${alpha})`;
  // corpo principal
  ctx.fillRect(x, y + 8, 48, 24);
  // topo
  ctx.fillRect(x + 8, y, 32, 8);
  // recorte interior
  ctx.clearRect(x + 12, y + 24, 24, 8);
}

function drawUFO(x, y) {
  ctx.fillStyle = '#f0f';
  ctx.fillRect(x + 10, y + 6, 40, 8);
  ctx.fillRect(x + 4, y + 10, 52, 8);
  ctx.fillRect(x + 16, y, 28, 6);
  ctx.fillRect(x + 10, y + 18, 8, 4);
  ctx.fillRect(x + 22, y + 18, 8, 4);
  ctx.fillRect(x + 34, y + 18, 8, 4);
}

// ── Estado do jogo ────────────────────────────────────────────────────────────
let state, keys, animFrame;

function initState(level) {
  const speed = 0.5 + (level - 1) * 0.3;
  const rows = Math.min(3 + Math.floor((level - 1) / 2), 6);

  const invaders = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 11; c++) {
      invaders.push({
        x: 60 + c * 48,
        y: 60 + r * 44,
        type: Math.floor(r / 2),
        alive: true,
      });
    }
  }

  return {
    player: { x: W / 2 - 20, y: H - 48, w: 40, h: 26, speed: 4 },
    bullets: [],
    enemyBullets: [],
    invaders,
    bunkers: [60, 160, 260, 360, 460].map(bx => ({ x: bx, y: H - 120, health: 4 })),
    ufo: { x: -60, y: 28, active: false, timer: 0, interval: 600 },
    score: 0,
    lives: 3,
    level,
    invDir: 1,
    invSpeed: speed,
    invMoveTimer: 0,
    invMoveInterval: 60,
    invFrame: 0,
    shootTimer: 0,
    shootInterval: 90,
    playerCooldown: 0,
    gameOver: false,
    won: false,
    explosions: [],
  };
}

// ── Input ─────────────────────────────────────────────────────────────────────
keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ── Colisão retangular ────────────────────────────────────────────────────────
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ── Lógica principal ──────────────────────────────────────────────────────────
function update() {
  if (!state || state.gameOver || state.won) return;

  const s = state;

  // Mover jogador
  if (keys['ArrowLeft'] && s.player.x > 0) s.player.x -= s.player.speed;
  if (keys['ArrowRight'] && s.player.x + s.player.w < W) s.player.x += s.player.speed;

  // Atirar
  if (s.playerCooldown > 0) s.playerCooldown--;
  if (keys['Space'] && s.playerCooldown === 0) {
    s.bullets.push({ x: s.player.x + s.player.w / 2 - 2, y: s.player.y, w: 4, h: 12 });
    s.playerCooldown = 20;
  }

  // Mover balas do jogador
  s.bullets = s.bullets.filter(b => {
    b.y -= 8;
    return b.y + b.h > 0;
  });

  // Mover balas inimigas
  s.enemyBullets = s.enemyBullets.filter(b => {
    b.y += 4;
    return b.y < H;
  });

  // Mover invasores
  s.invMoveTimer++;
  const aliveCount = s.invaders.filter(i => i.alive).length;
  const dynamicInterval = Math.max(8, s.invMoveInterval - Math.floor((s.invaders.length - aliveCount) * 1.2));

  if (s.invMoveTimer >= dynamicInterval) {
    s.invMoveTimer = 0;
    s.invFrame++;
    let hitWall = false;

    for (const inv of s.invaders) {
      if (!inv.alive) continue;
      inv.x += s.invDir * 12;
      if (inv.x < 4 || inv.x + 32 > W - 4) hitWall = true;
    }

    if (hitWall) {
      s.invDir *= -1;
      for (const inv of s.invaders) {
        if (inv.alive) inv.y += 16;
      }
    }
  }

  // Invasores atiram
  s.shootTimer++;
  if (s.shootTimer >= s.shootInterval) {
    s.shootTimer = 0;
    const alive = s.invaders.filter(i => i.alive);
    if (alive.length > 0) {
      const shooter = alive[Math.floor(Math.random() * alive.length)];
      s.enemyBullets.push({ x: shooter.x + 14, y: shooter.y + 20, w: 4, h: 12 });
    }
    s.shootInterval = 60 + Math.random() * 60;
  }

  // Colisão: balas do jogador x invasores
  for (const b of s.bullets) {
    for (const inv of s.invaders) {
      if (!inv.alive) continue;
      if (rectsOverlap(b.x, b.y, b.w, b.h, inv.x, inv.y, 32, 20)) {
        inv.alive = false;
        b.y = -100;
        const pts = [30, 20, 10][inv.type % 3];
        s.score += pts;
        scoreEl.textContent = s.score;
        s.explosions.push({ x: inv.x, y: inv.y, timer: 20 });
      }
    }
  }

  // Colisão: balas x bunkers
  for (const bunk of s.bunkers) {
    if (bunk.health <= 0) continue;
    for (const b of s.bullets) {
      if (rectsOverlap(b.x, b.y, b.w, b.h, bunk.x, bunk.y, 48, 32)) {
        b.y = -100;
        bunk.health--;
      }
    }
    for (const b of s.enemyBullets) {
      if (rectsOverlap(b.x, b.y, b.w, b.h, bunk.x, bunk.y, 48, 32)) {
        b.y = H + 100;
        bunk.health--;
      }
    }
  }

  // Colisão: balas inimigas x jogador
  for (const b of s.enemyBullets) {
    if (rectsOverlap(b.x, b.y, b.w, b.h, s.player.x + 4, s.player.y + 4, s.player.w - 8, s.player.h - 4)) {
      b.y = H + 100;
      s.lives--;
      livesEl.textContent = s.lives;
      s.explosions.push({ x: s.player.x, y: s.player.y, timer: 30 });
      s.player.x = W / 2 - 20;
      if (s.lives <= 0) {
        s.gameOver = true;
        showOverlay('GAME OVER', 'JOGAR NOVAMENTE');
      }
    }
  }

  // UFO
  s.ufo.timer++;
  if (!s.ufo.active && s.ufo.timer >= s.ufo.interval) {
    s.ufo.active = true;
    s.ufo.x = -60;
    s.ufo.timer = 0;
    s.ufo.interval = 400 + Math.floor(Math.random() * 400);
  }
  if (s.ufo.active) {
    s.ufo.x += 2;
    if (s.ufo.x > W + 10) s.ufo.active = false;

    for (const b of s.bullets) {
      if (rectsOverlap(b.x, b.y, b.w, b.h, s.ufo.x, s.ufo.y, 60, 22)) {
        b.y = -100;
        s.score += 100;
        scoreEl.textContent = s.score;
        s.ufo.active = false;
        s.explosions.push({ x: s.ufo.x, y: s.ufo.y, timer: 25 });
      }
    }
  }

  // Invasores chegaram ao chão?
  for (const inv of s.invaders) {
    if (inv.alive && inv.y + 20 >= s.player.y) {
      s.gameOver = true;
      showOverlay('GAME OVER', 'JOGAR NOVAMENTE');
      return;
    }
  }

  // Todos mortos → próxima fase
  if (s.invaders.every(i => !i.alive)) {
    s.won = true;
    setTimeout(() => {
      state = initState(s.level + 1);
      state.score = s.score;
      state.lives = s.lives;
      scoreEl.textContent = state.score;
      livesEl.textContent = state.lives;
      levelEl.textContent = state.level;
    }, 1000);
  }

  // Explosões
  s.explosions = s.explosions.filter(e => {
    e.timer--;
    return e.timer > 0;
  });
}

// ── Renderização ──────────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);

  if (!state) return;
  const s = state;

  // Jogador
  if (!s.gameOver) drawPlayer(s.player.x, s.player.y);

  // Balas do jogador
  ctx.fillStyle = '#0f0';
  for (const b of s.bullets) ctx.fillRect(b.x, b.y, b.w, b.h);

  // Balas inimigas
  ctx.fillStyle = '#f55';
  for (const b of s.enemyBullets) {
    ctx.fillRect(b.x, b.y, b.w, 4);
    ctx.fillRect(b.x + 1, b.y + 4, 2, 4);
    ctx.fillRect(b.x, b.y + 8, b.w, 4);
  }

  // Invasores
  for (const inv of s.invaders) {
    if (inv.alive) drawInvader(inv.x, inv.y, inv.type, s.invFrame);
  }

  // UFO
  if (s.ufo.active) drawUFO(s.ufo.x, s.ufo.y);

  // Bunkers
  for (const bunk of s.bunkers) {
    if (bunk.health > 0) drawBunker(bunk.x, bunk.y, bunk.health);
  }

  // Explosões
  for (const ex of s.explosions) {
    const r = (1 - ex.timer / 30) * 24;
    ctx.strokeStyle = `rgba(255,200,0,${ex.timer / 30})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex.x + 16, ex.y + 10, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255,100,0,${ex.timer / 30 * 0.6})`;
    ctx.beginPath();
    ctx.arc(ex.x + 16, ex.y + 10, r * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Linha de terra
  ctx.strokeStyle = '#0f06';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H - 20);
  ctx.lineTo(W, H - 20);
  ctx.stroke();
}

// ── Loop ──────────────────────────────────────────────────────────────────────
function loop() {
  update();
  draw();
  animFrame = requestAnimationFrame(loop);
}

// ── Overlay ───────────────────────────────────────────────────────────────────
function showOverlay(title, btnText, subtitle) {
  overlay.innerHTML = '';

  const h1 = document.createElement('h1');
  h1.textContent = title;
  overlay.appendChild(h1);

  if (subtitle) {
    const p = document.createElement('p');
    p.className = 'result-msg';
    p.textContent = subtitle;
    overlay.appendChild(p);
  }

  const p2 = document.createElement('p');
  p2.innerHTML = 'Use <kbd>←</kbd> <kbd>→</kbd> para mover e <kbd>Espaço</kbd> para atirar';
  overlay.appendChild(p2);

  const btn = document.createElement('button');
  btn.id = 'start-btn';
  btn.textContent = btnText;
  btn.addEventListener('click', startGame);
  overlay.appendChild(btn);

  overlay.classList.add('visible');
}

function startGame() {
  overlay.classList.remove('visible');
  state = initState(1);
  scoreEl.textContent = 0;
  livesEl.textContent = 3;
  levelEl.textContent = 1;
  if (!animFrame) loop();
}

startBtn.addEventListener('click', startGame);
loop();
