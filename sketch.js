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
let grassBackBlades = [];
let grassFrontBlades = [];
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
  constructor(x, baseY, opts = {}) {
    this.x = x;
    this.baseY = baseY;

    const heightScale = opts.heightScale ?? 1;
    this.height = (40 + Math.random() * 50) * heightScale;

    this.angle = 0;
    this.targetAngle = 0;

    // Layer tuning
    this.color = opts.color ?? "#1f7a1f";
    this.curve = opts.curve ?? 0.45;
    this.stiffness = opts.stiffness ?? 0.15;     // how fast it follows target
    this.damping = opts.damping ?? 0.85;         // how fast it settles
    this.interactStrength = opts.interactStrength ?? 0.015;
    this.maxBend = opts.maxBend ?? 0.55;
    this.interactive = opts.interactive ?? true;

    // Store thickness ONCE to avoid flicker
    this.thickness = opts.thickness ?? (0.9 + Math.random() * 0.6);

    // Optional subtle highlight
    this.highlightAlpha = opts.highlightAlpha ?? 0.08;
  }

  update() {
    this.angle += (this.targetAngle - this.angle) * this.stiffness;
    this.targetAngle *= this.damping;

    if (this.angle > this.maxBend) this.angle = this.maxBend;
    if (this.angle < -this.maxBend) this.angle = -this.maxBend;
  }

  interact(mx, my) {
    if (!this.interactive) return;

    const dist = Math.hypot(this.x - mx, this.baseY - my);
    if (dist < 70) {
      this.targetAngle = (this.x - mx) * this.interactStrength;

      if (this.targetAngle > this.maxBend) this.targetAngle = this.maxBend;
      if (this.targetAngle < -this.maxBend) this.targetAngle = -this.maxBend;
    }
  }

  draw() {
    const h = this.height;

    const tipX = this.x + Math.sin(this.angle) * h;
    const tipY = this.baseY - Math.cos(this.angle) * h;

    const ctrlX = this.x + Math.sin(this.angle) * h * this.curve;
    const ctrlY = this.baseY - Math.cos(this.angle) * h * 0.55;

    // main blade
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.thickness;
    ctx.beginPath();
    ctx.moveTo(this.x, this.baseY);
    ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
    ctx.stroke();

    // subtle highlight (optional)
    if (this.highlightAlpha > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${this.highlightAlpha})`;
      ctx.lineWidth = this.thickness * 0.6;
      ctx.beginPath();
      ctx.moveTo(this.x, this.baseY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.stroke();
    }
  }
}
function createGrass() {
  grassBackBlades = [];
  grassFrontBlades = [];

  const grassTop = canvas.height * 0.66;
  const buffer = 400;

  // BACK grass (darker + slower)
  const backSpacing = 3;
  for (let x = -buffer; x < canvas.width + buffer; x += backSpacing) {
    grassBackBlades.push(
      new GrassBlade(x, grassTop, {
        color: "#145a22",         // darker green
        thickness: 1.2,           // keep it thin
        heightScale: 0.78,        // slightly shorter
        curve: 0.40,
        stiffness: 0.08,          // slower movement
        damping: 0.90,            // settles gently
        interactStrength: 0.006,  // less mouse influence
        maxBend: 0.38,            // bends less
        highlightAlpha: 0.0,
      })
    );
  }

  // FRONT grass (your dense layer)
  const frontSpacing = 2;
  for (let x = -buffer; x < canvas.width + buffer; x += frontSpacing) {
    grassFrontBlades.push(
      new GrassBlade(x, grassTop, {
        color: "#1f7a1f",
        curve: 0.45,
        stiffness: 0.15,
        damping: 0.85,
        interactStrength: 0.015,
        maxBend: 0.55,
        highlightAlpha: 0.08
      })
    );
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
    if (this.vy > 0 && this.y >= grassTop) {
      this.reset();
      return;
    }

  }

  draw() {
    const grassTop = canvas.height * 0.66;
    if (this.y > grassTop + 2) return; // ✅ don't draw once inside grass

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

  // thicker strip to cover bug bottoms more convincingly
  ctx.fillStyle = "#2d8f3a";
  ctx.fillRect(0, grassTop - 10, canvas.width, 26);

  // darker lip at the top edge
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.fillRect(0, grassTop - 10, canvas.width, 8);
}

/* =====================
   LOOP
===================== */
function loop() {
  if (state === "forest") {
    drawBackground();

    // UPDATE
    grassBackBlades.forEach(g => { g.interact(mouse.x, mouse.y); g.update(); });
    grassFrontBlades.forEach(g => { g.interact(mouse.x, mouse.y); g.update(); });
    bugs.forEach(b => b.update());

    // DRAW (back -> bugs -> occluder -> front)
    grassBackBlades.forEach(g => g.draw());

    bugs.forEach(b => b.draw());

    drawGrassOccluder();

    grassFrontBlades.forEach(g => g.draw());
  }



  requestAnimationFrame(loop);
}

updateInventoryUI();
loop();
