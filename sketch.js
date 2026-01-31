const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
window.addEventListener("resize", resize);
resize();

/* ---------- STATE ---------- */
let state = "title";

/* ---------- UI ---------- */
const titleScreen = document.getElementById("titleScreen");
const worldMap = document.getElementById("worldMap");
const startBtn = document.getElementById("startBtn");
const globeBtn = document.getElementById("globeBtn");

/* ---------- GAME SYSTEMS ---------- */
let grass = [];
let bugs = [];
let mouse = { x: 0, y: 0 };

class GrassBlade {
  constructor(x, y) {
    this.x = x;
    this.baseY = y;
    this.height = 40 + Math.random() * 50;
    this.angle = 0;
    this.target = 0;
  }
  update() {
    this.angle += (this.target - this.angle) * 0.15;
    this.target *= 0.9;
  }
  draw() {
    ctx.strokeStyle = "#1f7a1f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x, this.baseY);
    ctx.lineTo(
      this.x + Math.sin(this.angle) * this.height,
      this.baseY - Math.cos(this.angle) * this.height
    );
    ctx.stroke();
  }
  interact(mx, my) {
    const d = Math.hypot(this.x - mx, this.baseY - my);
    if (d < 70) this.target = (this.x - mx) * 0.025;
  }
}

class Bug {
  constructor() { this.reset(); }
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = canvas.height * 0.66;
    this.vx = (Math.random() - 0.5) * 3;
    this.vy = -6 - Math.random() * 4;
    this.radius = 10;
    this.type = ["hopper", "beetle", "moth"][Math.floor(Math.random() * 3)];
  }
  update() {
    this.vy += 0.25;
    this.x += this.vx;
    this.y += this.vy;
    if (this.y > canvas.height + 50) this.reset();
  }
  draw() {
    ctx.fillStyle = "#5aff5a";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  hit(mx, my) {
    return Math.hypot(this.x - mx, this.y - my) < this.radius;
  }
}

/* ---------- GAME SETUP ---------- */
function setupForest() {
  grass = [];
  bugs = [];
  const base = canvas.height * 0.66;
  for (let x = 0; x < canvas.width; x += 6) {
    grass.push(new GrassBlade(x, base));
  }
  for (let i = 0; i < 6; i++) bugs.push(new Bug());
}

/* ---------- SCREEN CONTROL ---------- */
function showForest() {
  state = "forest";
  titleScreen.classList.remove("active");
  worldMap.classList.remove("active");
  setupForest();
}

function showMap() {
  state = "map";
  worldMap.classList.add("active");
}

/* ---------- INPUT ---------- */
startBtn.onclick = showForest;
globeBtn.onclick = () => state === "forest" && showMap();

canvas.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

canvas.addEventListener("mousedown", e => {
  if (state !== "forest") return;
  for (let b of bugs) {
    if (b.hit(mouse.x, mouse.y)) b.reset();
  }
});

/* ---------- DRAW ---------- */
function drawBackground() {
  ctx.fillStyle = "#7fd3ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#2d8f3a";
  ctx.fillRect(0, canvas.height * 0.66, canvas.width, canvas.height);
}

function loop() {
  if (state === "forest") {
    drawBackground();
    grass.forEach(g => { g.interact(mouse.x, mouse.y); g.update(); g.draw(); });
    bugs.forEach(b => { b.update(); b.draw(); });
  }
  requestAnimationFrame(loop);
}
loop();
