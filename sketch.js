// Tilt Ball —— 倾斜手机控制小球收集星星
// 没有传感器时：按住并拖动（鼠标/触摸）让球朝手指方向加速，或用方向键

let state = 'title';          // 'title' 或 'play'
let ball, target;
let particles = [];
let score = 0;

let tilt = { x: 0, y: 0 };    // 传感器倾斜量（-1 ~ 1）
let sensorActive = false;     // 是否真正收到传感器数据
let listening = false;
let controlMode = '';

let pointer = { down: false, x: 0, y: 0 };
let startBtn;

function setup() {
  const cnv = createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 1);
  textFont('sans-serif');

  // 页面样式：全屏、无滚动、触摸时不滚动页面
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.background = '#0b0b14';
  cnv.elt.style.display = 'block';
  cnv.elt.style.touchAction = 'none';

  // 鼠标/触摸控制（传感器不可用时的备用方案）
  const el = cnv.elt;
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    pointer = { down: true, x: e.offsetX, y: e.offsetY };
  });
  el.addEventListener('pointermove', (e) => {
    if (pointer.down) { pointer.x = e.offsetX; pointer.y = e.offsetY; }
  });
  const up = () => (pointer.down = false);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);

  // Start 按钮
  startBtn = createButton('Start');
  styleButton(startBtn);
  placeButton();
  startBtn.elt.addEventListener('click', startGame);

  resetGame();
}

function draw() {
  background(250, 50, 10);
  drawBackgroundDots();

  if (state === 'title') {
    drawTitle();
    return;
  }

  updateBall();
  checkTarget();

  drawTarget();
  drawParticles();
  drawBall();
  drawHUD();
}

// ---------- 开始 & 传感器 ----------

async function startGame() {
  startBtn.attribute('disabled', '');

  if (!listening && typeof DeviceOrientationEvent !== 'undefined') {
    try {
      // iPhone / iPad (iOS 13+) 需要在点击时请求权限
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res === 'granted') {
          window.addEventListener('deviceorientation', onOrientation);
          listening = true;
        }
      } else {
        // Android 和其他浏览器不需要权限
        window.addEventListener('deviceorientation', onOrientation);
        listening = true;
      }
    } catch (e) {
      // 权限被拒或出错 → 使用触摸/鼠标
    }
  }

  resetGame();
  state = 'play';
  startBtn.hide();
  controlMode = 'Checking sensor...';

  // 等 1 秒看是否真的收到传感器数据（电脑浏览器通常收不到）
  setTimeout(() => {
    controlMode = sensorActive
      ? 'Tilt your phone to move'
      : 'No motion sensor: hold & drag, or use arrow keys';
  }, 1000);
}

function onOrientation(e) {
  if (e.beta === null || e.gamma === null) return;
  sensorActive = true;

  // 根据屏幕方向调整轴（横屏时也能正常操作）
  const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  let ax, ay;
  if (angle === 90)                       { ax = e.beta;   ay = -e.gamma; }
  else if (angle === -90 || angle === 270) { ax = -e.beta;  ay = e.gamma; }
  else if (angle === 180)                 { ax = -e.gamma; ay = -e.beta; }
  else                                    { ax = e.gamma;  ay = e.beta; }

  // 倾斜 45° 视为最大
  tilt.x = constrain(ax / 45, -1, 1);
  tilt.y = constrain(ay / 45, -1, 1);
}

// ---------- 游戏逻辑 ----------

function resetGame() {
  ball = { x: width / 2, y: height / 2, vx: 0, vy: 0, r: min(width, height) * 0.05, hue: 0 };
  ball.r = constrain(ball.r, 16, 36);
  score = 0;
  particles = [];
  newTarget();
}

function newTarget() {
  const m = 60;
  target = { x: random(m, width - m), y: random(m, height - m), r: 22, hue: random(360) };
}

function updateBall() {
  let ax = 0, ay = 0;
  const power = 0.6;

  if (sensorActive) {
    ax += tilt.x * power;
    ay += tilt.y * power;
  }

  // 按住时朝手指/鼠标方向加速
  if (pointer.down) {
    const dx = pointer.x - ball.x, dy = pointer.y - ball.y;
    const d = max(1, sqrt(dx * dx + dy * dy));
    const k = power * min(1, d / 100);
    ax += (dx / d) * k;
    ay += (dy / d) * k;
  }

  // 方向键
  if (keyIsDown(LEFT_ARROW))  ax -= power;
  if (keyIsDown(RIGHT_ARROW)) ax += power;
  if (keyIsDown(UP_ARROW))    ay -= power;
  if (keyIsDown(DOWN_ARROW))  ay += power;

  ball.vx = (ball.vx + ax) * 0.985;  // 轻微摩擦
  ball.vy = (ball.vy + ay) * 0.985;
  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.hue = (ball.hue + 1) % 360;

  // 边缘反弹
  const bounce = 0.8;
  if (ball.x < ball.r)          { ball.x = ball.r;          hitWall(ball.vx); ball.vx = -ball.vx * bounce; }
  if (ball.x > width - ball.r)  { ball.x = width - ball.r;  hitWall(ball.vx); ball.vx = -ball.vx * bounce; }
  if (ball.y < ball.r)          { ball.y = ball.r;          hitWall(ball.vy); ball.vy = -ball.vy * bounce; }
  if (ball.y > height - ball.r) { ball.y = height - ball.r; hitWall(ball.vy); ball.vy = -ball.vy * bounce; }
}

function hitWall(speed) {
  if (abs(speed) > 2) spawnParticles(ball.x, ball.y, ball.hue, floor(abs(speed) * 2));
}

function checkTarget() {
  if (dist(ball.x, ball.y, target.x, target.y) < ball.r + target.r) {
    score++;
    spawnParticles(target.x, target.y, target.hue, 30);
    newTarget();
  }
}

function spawnParticles(x, y, hue, n) {
  for (let i = 0; i < n; i++) {
    const a = random(TWO_PI), sp = random(1, 6);
    particles.push({
      x, y, vx: cos(a) * sp, vy: sin(a) * sp,
      hue: (hue + random(-40, 40) + 360) % 360,
      size: random(4, 10), life: 50
    });
  }
}

// ---------- 绘制 ----------

function drawBackgroundDots() {
  noStroke();
  const step = 40;
  for (let x = step / 2; x < width; x += step) {
    for (let y = step / 2; y < height; y += step) {
      fill((x + y + frameCount) % 360, 60, 60, 0.15);
      circle(x, y, 4);
    }
  }
}

function drawBall() {
  noStroke();
  fill(ball.hue, 80, 100, 0.2);
  circle(ball.x, ball.y, ball.r * 3);           // 光晕
  fill(ball.hue, 80, 100);
  circle(ball.x, ball.y, ball.r * 2);           // 本体
  fill(0, 0, 100, 0.7);
  circle(ball.x - ball.r * 0.35, ball.y - ball.r * 0.35, ball.r * 0.6); // 高光
}

function drawTarget() {
  const pulse = 1 + 0.15 * sin(frameCount * 0.1);
  push();
  translate(target.x, target.y);
  rotate(frameCount * 0.03);
  noStroke();
  fill(target.hue, 70, 100, 0.25);
  circle(0, 0, target.r * 3 * pulse);
  fill(target.hue, 70, 100);
  star(target.r * pulse, target.r * 0.45 * pulse, 5);
  pop();
}

function drawParticles() {
  noStroke();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.95; p.vy *= 0.95;
    p.life--;
    fill(p.hue, 80, 100, p.life / 50);
    circle(p.x, p.y, p.size);
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawHUD() {
  noStroke();
  fill(0, 0, 100);
  textAlign(LEFT, TOP);
  textSize(28);
  text('★ ' + score, 16, 16);
  textSize(14);
  fill(0, 0, 100, 0.75);
  textAlign(LEFT, BOTTOM);
  text(controlMode, 16, height - 16);
}

function drawTitle() {
  noStroke();
  textAlign(CENTER, CENTER);
  fill((frameCount * 2) % 360, 70, 100);
  textSize(min(56, width / 7));
  text('Tilt Ball', width / 2, height / 2 - 70);
  fill(0, 0, 100, 0.85);
  textSize(min(18, width / 22));
  text('Tilt your phone to collect stars.\nOn a computer: hold & drag, or use arrow keys.',
       width / 2, height / 2 - 10);
}

function star(r1, r2, n) {
  beginShape();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = (PI / n) * i - HALF_PI;
    vertex(cos(a) * r, sin(a) * r);
  }
  endShape(CLOSE);
}

// ---------- 其他 ----------

function styleButton(btn) {
  btn.style('padding', '14px 36px');
  btn.style('font-size', '18px');
  btn.style('font-family', 'sans-serif');
  btn.style('color', '#fff');
  btn.style('background', 'rgba(255,255,255,0.15)');
  btn.style('border', '1px solid rgba(255,255,255,0.5)');
  btn.style('border-radius', '28px');
  btn.style('cursor', 'pointer');
  btn.style('transform', 'translateX(-50%)');
  btn.style('z-index', '10');
}

function placeButton() {
  startBtn.position(width / 2, height / 2 + 50);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  placeButton();
  ball.x = constrain(ball.x, ball.r, width - ball.r);
  ball.y = constrain(ball.y, ball.r, height - ball.r);
  if (target.x > width - 30 || target.y > height - 30) newTarget();
}