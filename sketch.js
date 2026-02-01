/* =====================
   GET ELEMENTS (loaded with defer)
===================== */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const titleScreen = document.getElementById("titleScreen");
const worldMap = document.getElementById("worldMap");
const globeBtn = document.getElementById("globeBtn");
const inventoryBox = document.getElementById("inventory");
const startBtn = document.getElementById("startBtn");

/* =====================
   GAME STATE
===================== */
let state = "title"; // title, forest, map
let grassBlades = [];
let bugs = [];
let mouse = { x: 0, y: 0 };

const inventory = { hopper: 0, beetle: 0, moth: 0 };

/* =====================
   CANVAS RESIZE
===================== */
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;

  // If we're in the forest, rebuild world elements to match new size
  if (state === "forest") {
    createGrass();
    bugs.forEach(b => b.reset());
  }
}

window.addEventListener("resize", resize);
resize(); // ✅ IMPORTANT: actually call it once at start

/* =====================
   GRASS
===================== */
class GrassBlade {
  constructor(x, baseY) {
    this.x = x;
    this.baseY = baseY;
    this.height = 40 + Math.random() * 50;
    this.angle = 0;
    this.targetAngle = 0;
  }

  // Updates the angle of the grass blade for swaying effect
  update() {
  this.angle += (this.targetAngle - this.angle) * 0.15;

  // calms the motion faster (less wiggly)
  this.targetAngle *= 0.85;

  // limit bend so it never folds too far
  const maxBend = 0.55; // radians (~31 degrees)
  if (this.angle > maxBend) this.angle = maxBend;
  if (this.angle < -maxBend) this.angle = -maxBend;
}


  draw() {
  const h = this.height;

  // Tip position (still based on angle)
  const tipX = this.x + Math.sin(this.angle) * h;
  const tipY = this.baseY - Math.cos(this.angle) * h;

  // Control point makes the blade curve (halfway up + pushed sideways)
  const curve = 0.55; // 0..1 (higher = more curve)
  const ctrlX = this.x + Math.sin(this.angle) * h * curve;
  const ctrlY = this.baseY - Math.cos(this.angle) * h * 0.5;

  ctx.strokeStyle = "#1f7a1f";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(this.x, this.baseY);
  ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
  ctx.stroke();
}


  interact(mx, my) {
  const dist = Math.hypot(this.x - mx, this.baseY - my);

  if (dist < 70) {
    // reduced strength
    this.targetAngle = (this.x - mx) * 0.015;

    // also clamp target so mouse can't force extreme bends
    const maxTarget = 0.55;
    if (this.targetAngle > maxTarget) this.targetAngle = maxTarget;
    if (this.targetAngle < -maxTarget) this.targetAngle = -maxTarget;
  }
}

}

function createGrass() {
  grassBlades = [];
  const grassTop = canvas.height * 0.66;

  // ✅ offscreen buffer so widening the window never shows gaps
  const buffer = 400;
  //The gap between each blade of grass
  for (let x = -buffer; x < canvas.width + buffer; x += 2) {
    grassBlades.push(new GrassBlade(x, grassTop));
  }
}

/* =====================
   BUGS
===================== */
class Bug {
  constructor() { this.reset(); }

  reset() {
    this.x = Math.random() * canvas.width;
    this.y = canvas.height * 0.66 + Math.random() * 20;
    this.vx = (Math.random() - 0.5) * 3;
    this.vy = -6 - Math.random() * 4;
    this.radius = 10;

    this.type = ["hopper", "beetle", "moth"][Math.floor(Math.random() * 3)];
    this.color =
      this.type === "hopper" ? "#5aff5a" :
      this.type === "beetle" ? "#3b2f1e" :
      "#ddd";
  }

  update() {
    this.vy += 0.25;
    this.x += this.vx;
    this.y += this.vy;
    const grassTop = canvas.height * 0.66;

    // If bug falls back into the grass, reset it (it "disappears")
    if (this.vy > 0 && this.y >= grassTop + 10) {
      this.reset();
      return;
    }

    if (this.y > canvas.height + 60 || this.x < -120 || this.x > canvas.width + 120) {
      this.reset();
    }
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  isClicked(mx, my) {
    return Math.hypot(this.x - mx, this.y - my) < this.radius;
  }
}

/* =====================
   UI
===================== */
function updateInventoryUI() {
  inventoryBox.innerHTML = `
    🦗 Hopper: ${inventory.hopper}<br>
    🪲 Beetle: ${inventory.beetle}<br>
    🦋 Moth: ${inventory.moth}
  `;
}

/* =====================
   DRAW
===================== */
function drawBackground() {
  // sky
  ctx.fillStyle = "#7fd3ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // tree blobs
  ctx.fillStyle = "#1f5c2b";
  for (let i = 0; i < canvas.width / 120 + 2; i++) {
    const x = i * 120 + 50;
    ctx.beginPath();
    ctx.arc(x, canvas.height * 0.6, 90, 0, Math.PI * 2);
    ctx.fill();
  }

  // ground
  ctx.fillStyle = "#2d8f3a";
  ctx.fillRect(0, canvas.height * 0.66, canvas.width, canvas.height);
}

/* =====================
   SCREENS
===================== */
function showForest() {
  state = "forest";
  titleScreen.classList.remove("active");
  worldMap.classList.remove("active");

  createGrass();
  bugs = [];
  for (let i = 0; i < 7; i++) bugs.push(new Bug());
}

function showMap() {
  state = "map";
  worldMap.classList.add("active");
}

function hideMap() {
  worldMap.classList.remove("active");
  showForest();
}

/* ✅ Inline fallback used by your HTML button */
window.__GH_START__ = () => showForest();

/* Also attach normal handler */
startBtn.addEventListener("click", (e) => {
  e.preventDefault();
  showForest();
});

/* Globe + map buttons */
globeBtn.addEventListener("click", () => {
  if (state === "forest") showMap();
});

document.querySelectorAll(".mapButtons button").forEach(btn => {
  btn.addEventListener("click", () => hideMap());
});

/* =====================
   INPUT
===================== */
canvas.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

canvas.addEventListener("mousedown", (e) => {
  if (state !== "forest") return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (let i = bugs.length - 1; i >= 0; i--) {
    if (bugs[i].isClicked(mx, my)) {
      inventory[bugs[i].type]++;
      updateInventoryUI();
      bugs[i].reset();
      break;
    }
  }
});

function drawGrassOccluder() {
  const grassTop = canvas.height * 0.66;

  // a thick strip right at the grass line to cover bugs that are "behind" grass
  ctx.fillStyle = "#2d8f3a";
  ctx.fillRect(0, grassTop - 6, canvas.width, 14);

  // a slightly darker edge to sell depth
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, grassTop - 6, canvas.width, 6);
}

/* =====================
   LOOP
===================== */
function loop() {
  if (state === "forest") {
  drawBackground();

  // update systems
  grassBlades.forEach(g => {
    g.interact(mouse.x, mouse.y);
    g.update();
  });
  bugs.forEach(b => b.update());

  // draw bugs first (so grass draws over them)
  bugs.forEach(b => b.draw());

  // draw a thick strip at the grass line to hide lower bug parts
  drawGrassOccluder();

  // draw grass blades last (foreground)
  grassBlades.forEach(g => g.draw());
}


  requestAnimationFrame(loop);
}

updateInventoryUI();
loop();
