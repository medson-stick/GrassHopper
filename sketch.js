/* =========================================================
   GRASS HOPPER — Core Game Script (sketch.js)
   - Canvas rendering + gameplay loop
   - UI screens (title / forest / world map)
   - Biome theme system (sky/grass/bugs)
========================================================= */

/* =====================
   DOM ELEMENTS
   Grabs the canvas + overlay UI elements
===================== */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const titleScreen = document.getElementById("titleScreen");
const worldMap = document.getElementById("worldMap");
const globeBtn = document.getElementById("globeBtn");
const inventoryBox = document.getElementById("inventory");
const startBtn = document.getElementById("startBtn");

/* =====================
   CONSTANTS + GAME STATE
   Stores key tuning values + current runtime state
===================== */
const GRASS_RATIO = 0.66;          // grass line at 66% of screen height
const OFFSCREEN_BUFFER = 400;      // extra grass offscreen for window expansion
const BUG_TYPES = ["hopper", "beetle", "moth"]; // allowed bug types
const inventory = { hopper: 0, beetle: 0, moth: 0 }; // counts of caught bugs

const BUG_SPRITES = {
  hopper: "🦗",
  beetle: "🪲",
  moth: "🦋"
};

//Locations & Arrays
let state = "title";               // title, forest, map
let currentLocation = "forest";    // forest, meadow, swamp
let grassBackBlades = [];
let grassFrontBlades = [];
let bugs = [];
let mouse = { x: 0, y: 0 };

/* =====================
   THEME SYSTEM
   Base theme + per-location overrides to reduce repetition
===================== */
const BASE_THEME = Object.freeze({
  sky: "#7bd2cb",
  ground: "#6c833b",
  trees: "#63732c",
  grassFront: "#286328",
  grassBack: "rgba(12, 60, 22, 0.98)",
});

const THEME_OVERRIDES = Object.freeze({
  forest: {},

  meadow: {
    sky: "#9fe7ff",
    ground: "#44b84a",
    trees: "#2b7a2f",
    grassFront: "#35b135",
    grassBack: "rgba(20, 95, 28, 0.95)",
    bugs: { hopper: "#a6ff4d", beetle: "#4d2b1a", moth: "#fff2cc" }
  },

  swamp: {
    sky: "#7fb8a6",
    ground: "#2f6b3d",
    trees: "#143f2a",
    grassFront: "#2a8a4a",
    grassBack: "rgba(10, 35, 20, 0.98)",
    bugs: { hopper: "#55ffb3", beetle: "#1a1a1a", moth: "#bfffea" }
  }
});

// Returns the active theme, falling back safely to forest/base
function getTheme() {
  const o = THEME_OVERRIDES[currentLocation] || THEME_OVERRIDES.forest;
  return {
    ...BASE_THEME,
    ...o,
    bugs: { ...BASE_THEME.bugs, ...(o.bugs || {}) }
  };
}

/* =====================
   RESIZE HANDLING
   Keeps canvas + grass consistent with the window
===================== */
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;

  // Rebuild grass + refresh bugs to match the new geometry
  if (state === "forest") {
    createGrass();
    for (const b of bugs) b.reset();
  }
}
window.addEventListener("resize", resize);
resize(); // initial sizing

/* =====================
   GRASS SYSTEM
   Two layers: back (darker/slow), front (dense/interactive)
===================== */
class GrassBlade {
  constructor(x, baseY, opts) {
    this.x = x;
    this.baseY = baseY;

    // Random blade height, scaled per layer
    this.height = (40 + Math.random() * 50) * (opts.heightScale ?? 1);

    this.angle = 0;
    this.targetAngle = 0;

    // Layer style + physics tuning
    this.color = opts.color;
    this.curve = opts.curve;
    this.stiffness = opts.stiffness;
    this.damping = opts.damping;
    this.interactStrength = opts.interactStrength;
    this.maxBend = opts.maxBend;

    // Stored once to avoid thickness flicker
    this.thickness = opts.thickness ?? (0.9 + Math.random() * 0.6);
    this.highlightAlpha = opts.highlightAlpha ?? 0.08;
  }

  update() {
    // Smoothly chase the target angle
    this.angle += (this.targetAngle - this.angle) * this.stiffness;

    // Gradually reduce target for calmer motion
    this.targetAngle *= this.damping;

    // Clamp blade bend to keep it realistic
    if (this.angle > this.maxBend) this.angle = this.maxBend;
    if (this.angle < -this.maxBend) this.angle = -this.maxBend;
  }

  interact(mx, my) {
    // Only bend if cursor is near the blade base
    const dist = Math.hypot(this.x - mx, this.baseY - my);
    if (dist < 70) {
      // Mouse pushes the target angle sideways
      this.targetAngle = (this.x - mx) * this.interactStrength;

      // Clamp target so mouse can't force extreme bends
      if (this.targetAngle > this.maxBend) this.targetAngle = this.maxBend;
      if (this.targetAngle < -this.maxBend) this.targetAngle = -this.maxBend;
    }
  }

  draw() {
    // Tip position based on bend angle
    const h = this.height;
    const tipX = this.x + Math.sin(this.angle) * h;
    const tipY = this.baseY - Math.cos(this.angle) * h;

    // Control point to create a curved blade
    const ctrlX = this.x + Math.sin(this.angle) * h * this.curve;
    const ctrlY = this.baseY - Math.cos(this.angle) * h * 0.55;

    // Main blade stroke
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.thickness;
    ctx.beginPath();
    ctx.moveTo(this.x, this.baseY);
    ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
    ctx.stroke();

    // Subtle highlight for depth
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

// Builds one grass layer with a given spacing and options
function buildGrassLayer({ spacing, opts }) {
  const blades = [];
  const baseY = grassTopY();

  // Include offscreen blades to avoid gaps after resizing wider
  for (let x = -OFFSCREEN_BUFFER; x < canvas.width + OFFSCREEN_BUFFER; x += spacing) {
    blades.push(new GrassBlade(x, baseY, opts));
  }
  return blades;
}

// Rebuild both layers using the active biome theme
function createGrass() {
  const theme = getTheme();

  grassBackBlades = buildGrassLayer({
    spacing: 3,
    opts: {
      color: theme.grassBack,
      thickness: 1.2,
      heightScale: 0.78,
      curve: 0.40,
      stiffness: 0.08,
      damping: 0.90,
      interactStrength: 0.006,
      maxBend: 0.38,
      highlightAlpha: 0.0
    }
  });

  grassFrontBlades = buildGrassLayer({
    spacing: 2, // dense blades
    opts: {
      color: theme.grassFront,
      curve: 0.45,
      stiffness: 0.15,
      damping: 0.85,
      interactStrength: 0.015,
      maxBend: 0.55,
      highlightAlpha: 0.08
    }
  });
}

// Computes the y-position of the grass line for current canvas size
function grassTopY() {
  return canvas.height * GRASS_RATIO;
}

/* =====================
   BUG SYSTEM
   Bugs emerge from grass, jump, then "sink" back in
===================== */
class Bug {
  constructor() { this.reset(); }

  reset() {
    const theme = getTheme();
    const gt = grassTopY();

    // Start near the grass line to look like it emerges
    this.x = Math.random() * canvas.width;
    this.y = gt + 18;

    // Random jump direction and strength
    this.vx = (Math.random() - 0.5) * 3;
    this.vy = -6 - Math.random() * 4;

    this.radius = 12;

    // Pick a bug type and apply the biome’s color
    this.type = BUG_TYPES[(Math.random() * BUG_TYPES.length) | 0];
    this.color = theme.bugs[this.type] || "#fff";
  }

  update() {
    const gt = grassTopY();

    // Basic gravity + motion
    this.vy += 0.25;
    this.x += this.vx;
    this.y += this.vy;

    // If falling into grass, disappear immediately
    if (this.vy > 0 && this.y >= gt + 2) {
      this.reset();
      return;
    }

    // Safety reset if it drifts too far away
    if (this.x < -120 || this.x > canvas.width + 120 || this.y < -200 || this.y > canvas.height + 200) {
      this.reset();
    }
  }

  draw() {
    const gt = grassTopY();
    const bugSize = Math.max(18, this.radius * 2.6);
    this.drawSize = bugSize;



    // Don’t draw if it’s already inside the grass
    if (this.y > gt + 2) return;

    const emoji = BUG_SPRITES[this.type] || "🐛";

    // Size: tie to radius so it scales nicely
    const size = Math.max(18, this.radius * 2.6);

    ctx.save();

    // Center the emoji on the bug position
    ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Subtle shadow for pop (helps readability over grass/sky)
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    // Draw the emoji
    ctx.fillText(emoji, this.x, this.y);

    ctx.restore();
  }

  isClicked(mx, my) {
    // Fallback size if not drawn yet this frame
    const size = this.drawSize || Math.max(18, this.radius * 2.6);

    // Rectangle centered on (this.x, this.y)
    const halfW = size * 0.65; // slightly generous horizontally
    const halfH = size * 0.70; // slightly generous vertically

    return (
      mx >= this.x - halfW &&
      mx <= this.x + halfW &&
      my >= this.y - halfH &&
      my <= this.y + halfH
    );
  }
}

/* =====================
   UI (Inventory)
   Updates the top-left inventory overlay
===================== */
function updateInventoryUI() {
  inventoryBox.innerHTML = `
    🦗 Hopper: ${inventory.hopper}<br>
    🪲 Beetle: ${inventory.beetle}<br>
    🦋 Moth: ${inventory.moth}
  `;
}

/* =====================
   BACKGROUND RENDERING
   Sky + trees + ground, all theme-driven
===================== */
function drawBackground() {
  const theme = getTheme();
  const gt = grassTopY();

  // Sky background fill
  ctx.fillStyle = theme.sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Simple tree blobs (parallax-ish silhouette)
  ctx.fillStyle = theme.trees;
  for (let i = 0; i < canvas.width / 120 + 2; i++) {
    const x = i * 120 + 50;
    ctx.beginPath();
    ctx.arc(x, canvas.height * 0.6, 90, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground fill below grass line
  ctx.fillStyle = theme.ground;
  ctx.fillRect(0, gt, canvas.width, canvas.height);
}

// Occluder strip hides bug bottoms so they appear behind grass
function drawGrassOccluder() {
  const theme = getTheme();
  const gt = grassTopY();

  // Thick strip matches ground to cover the transition
  ctx.fillStyle = theme.ground;
  ctx.fillRect(0, gt - 10, canvas.width, 26);

  // Dark lip adds a sense of depth at the boundary
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.fillRect(0, gt - 10, canvas.width, 8);
}

/* =====================
   STATE / NAVIGATION
   Title -> Forest, Forest <-> World Map, Biome switching
===================== */
function ensureForestInitialized() {
  // Build grass only if not built yet
  if (grassFrontBlades.length === 0) createGrass();

  // Spawn initial bugs only once
  if (bugs.length === 0) {
    for (let i = 0; i < 7; i++) bugs.push(new Bug());
  }
}

function showForest() {
  state = "forest";
  titleScreen.classList.remove("active"); // hide title overlay
  worldMap.classList.remove("active");    // hide map overlay
  ensureForestInitialized();
}

function showMap() {
  state = "map";
  worldMap.classList.add("active");       // show map overlay
}

function hideMap() {
  worldMap.classList.remove("active");    // hide map overlay
  showForest();
}

function setLocation(loc) {
  // Validate location key
  if (!THEME_OVERRIDES[loc]) loc = "forest";
  currentLocation = loc;

  // Apply immediately if player is in the forest scene
  if (state === "forest") {
    createGrass();             // rebuild blades with new colors
    for (const b of bugs) b.reset(); // refresh bug colors/types
  }
}

/* =====================
   EVENT LISTENERS
   One-time input wiring for UI + canvas interaction
===================== */
startBtn.addEventListener("click", (e) => {
  e.preventDefault(); // prevents accidental form-like behavior
  showForest();
});

globeBtn.addEventListener("click", () => {
  if (state === "forest") showMap(); // globe only works during gameplay
});

document.querySelectorAll(".mapButtons button").forEach(btn => {
  btn.addEventListener("click", () => {
    setLocation(btn.dataset.area); // reads forest/meadow/swamp
    hideMap();
  });
});

canvas.addEventListener("mousemove", (e) => {
  // Track mouse for grass interaction
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

canvas.addEventListener("mousedown", (e) => {
  if (state !== "forest") return; // only collect bugs in gameplay

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Check bugs from end to start (feels like top-most is clicked first)
  for (let i = bugs.length - 1; i >= 0; i--) {
    if (bugs[i].isClicked(mx, my)) {
      inventory[bugs[i].type]++; // increase count for that bug type
      updateInventoryUI();
      bugs[i].reset();           // respawn that bug
      break;
    }
  }
});

/* =====================
   MAIN LOOP
   Updates + draws scene with correct depth order
===================== */
function loop() {
  if (state === "forest") {
    drawBackground();

    // Update physics first
    for (const g of grassBackBlades) { g.interact(mouse.x, mouse.y); g.update(); }
    for (const g of grassFrontBlades) { g.interact(mouse.x, mouse.y); g.update(); }
    for (const b of bugs) b.update();

    // Draw order creates depth (back grass -> bugs -> occlusion -> front grass)
    for (const g of grassBackBlades) g.draw();
    for (const b of bugs) b.draw();
    drawGrassOccluder();
    for (const g of grassFrontBlades) g.draw();
  }

  requestAnimationFrame(loop); // schedule next frame
}

/* =====================
   BOOT
   Initialize UI and start the render loop
===================== */
updateInventoryUI();
loop();
