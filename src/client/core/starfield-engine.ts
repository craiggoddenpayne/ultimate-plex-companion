const TAU = Math.PI * 2;

export function initStarfield() {
  const canvas = document.querySelector('#starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) return;
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0,
    height = 0,
    dpr = 1,
    particles: any[] = [],
    frame = 0,
    lastPaint = 0,
    running = true,
    scene = '';
  let warmColour = '247,190,99',
    coolColour = '200,218,238',
    glowColour = '245,173,46',
    effects = 'full';

  const rgba = (colour, alpha) => `rgba(${colour},${alpha})`;
  const density = (minimum, maximum, divisor) =>
    Math.min(maximum, Math.max(minimum, Math.round((width * height) / divisor)));
  const paused = () => motionQuery.matches || effects === 'still';
  const motion = () => (paused() ? 0 : effects === 'ambient' ? 0.32 : 1);

  function palette() {
    const styles = getComputedStyle(document.documentElement);
    warmColour = styles.getPropertyValue('--star-warm-rgb').trim() || '247,190,99';
    coolColour = styles.getPropertyValue('--star-cool-rgb').trim() || '200,218,238';
    glowColour = styles.getPropertyValue('--theme-glow').trim() || '245,173,46';
    effects = document.documentElement.dataset.effects || 'full';
    return document.documentElement.dataset.background || 'starfield';
  }

  function resetStar(star, initial = false) {
    const depth = 1100,
      focal = 285,
      originX = width * 0.55,
      originY = height * 0.46;
    star.z = initial ? 30 + Math.random() * (depth - 30) : depth;
    star.x = ((Math.random() * width - originX) * star.z) / focal;
    star.y = ((Math.random() * height - originY) * star.z) / focal;
    star.radius = 0.45 + Math.random() * 1.15;
    star.alpha = 0.35 + Math.random() * 0.55;
    star.warm = Math.random() < 0.15;
    star.phase = Math.random() * TAU;
  }

  function createScene() {
    particles = [];
    if (scene === 'starfield') {
      particles = Array.from({ length: density(120, 260, 7200) }, () => {
        const star: any = {};
        resetStar(star, true);
        return star;
      });
    }
    if (scene === 'vortex')
      particles = Array.from({ length: density(100, 190, 9000) }, () => ({
        angle: Math.random() * TAU,
        radius: 12 + Math.random() * Math.min(width, height) * 0.62,
        speed: 0.12 + Math.random() * 0.3,
        size: 0.45 + Math.random() * 1.35,
        alpha: 0.18 + Math.random() * 0.52,
        warm: Math.random() < 0.22,
      }));
    if (scene === 'constellation')
      particles = Array.from({ length: density(44, 68, 20_000) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        size: 0.7 + Math.random() * 1.1,
        alpha: 0.3 + Math.random() * 0.45,
      }));
    if (scene === 'orbits')
      particles = Array.from({ length: 28 }, (_, index) => ({
        ring: index % 7,
        angle: Math.random() * TAU,
        speed: 0.035 + (index % 7) * 0.008,
        size: index % 5 === 0 ? 1.8 : 0.8,
        warm: index % 4 === 0,
      }));
    if (scene === 'embers')
      particles = Array.from({ length: density(65, 130, 12_000) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 8 + Math.random() * 19,
        drift: (Math.random() - 0.5) * 7,
        size: 0.5 + Math.random() * 1.6,
        alpha: 0.16 + Math.random() * 0.5,
        phase: Math.random() * TAU,
      }));
  }

  function backgroundGlow(x = width * 0.58, y = height * 0.42, radius = Math.min(width, height) * 0.3) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, rgba(glowColour, effects === 'ambient' ? 0.025 : 0.045));
    gradient.addColorStop(0.35, rgba(coolColour, 0.012));
    gradient.addColorStop(1, rgba(coolColour, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStarfield(time, delta) {
    const depth = 1100,
      focal = 285,
      originX = width * 0.55,
      originY = height * 0.46,
      speed = 105 * motion();
    backgroundGlow(originX, originY, Math.min(width, height) * 0.24);
    for (const star of particles) {
      star.z -= ((speed * delta) / 1000) * (0.82 + star.radius * 0.24);
      let scale = focal / Math.max(1, star.z),
        x = originX + star.x * scale,
        y = originY + star.y * scale;
      if (star.z < 4 || x < -70 || x > width + 70 || y < -70 || y > height + 70) {
        resetStar(star);
        scale = focal / star.z;
        x = originX + star.x * scale;
        y = originY + star.y * scale;
      }
      const proximity = 1 - star.z / depth,
        shimmer = paused() ? 1 : 0.88 + Math.sin(time * 0.0012 + star.phase) * 0.12,
        alpha = Math.min(0.9, star.alpha * (0.38 + proximity * 0.75) * shimmer),
        radius = star.radius * (0.4 + proximity * 1.45);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fillStyle = rgba(star.warm ? warmColour : coolColour, alpha);
      ctx.fill();
    }
  }

  function drawVortex(_time, delta) {
    const centreX = width * 0.58,
      centreY = height * 0.44,
      maxRadius = Math.min(width, height) * 0.62;
    backgroundGlow(centreX, centreY, maxRadius * 0.55);
    for (const particle of particles) {
      const previous = particle.angle;
      particle.angle += particle.speed * (delta / 1000) * motion();
      const twist = particle.angle + (particle.radius / maxRadius) * 5.5,
        x = centreX + Math.cos(twist) * particle.radius,
        y = centreY + Math.sin(twist) * particle.radius * 0.56,
        oldTwist = previous + (particle.radius / maxRadius) * 5.5,
        oldX = centreX + Math.cos(oldTwist) * particle.radius,
        oldY = centreY + Math.sin(oldTwist) * particle.radius * 0.56,
        colour = particle.warm ? warmColour : coolColour;
      ctx.beginPath();
      ctx.moveTo(oldX, oldY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = rgba(colour, particle.alpha * 0.34);
      ctx.lineWidth = particle.size * 0.55;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, particle.size, 0, TAU);
      ctx.fillStyle = rgba(colour, particle.alpha);
      ctx.fill();
    }
  }

  function drawAurora(time) {
    const phase = time * 0.00012 * (paused() ? 0 : effects === 'ambient' ? 0.32 : 1);
    backgroundGlow(width * 0.65, height * 0.2, Math.min(width, height) * 0.55);
    ctx.globalCompositeOperation = 'screen';
    for (let band = 0; band < 5; band++) {
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, rgba(coolColour, 0));
      gradient.addColorStop(0.35, rgba(band % 2 ? warmColour : coolColour, 0.055));
      gradient.addColorStop(0.7, rgba(band % 2 ? coolColour : glowColour, 0.11));
      gradient.addColorStop(1, rgba(warmColour, 0));
      ctx.beginPath();
      for (let step = 0; step <= 36; step++) {
        const x = (step / 36) * width,
          y =
            height * (0.17 + band * 0.12) +
            Math.sin(step * 0.34 + phase * (1 + band * 0.08) + band) * (28 + band * 5) +
            Math.cos(step * 0.13 - phase) * 15;
        if (step) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 11 + band * 5;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawConstellation(_time, delta) {
    backgroundGlow(width * 0.65, height * 0.35, Math.min(width, height) * 0.38);
    const speed = motion(),
      threshold = Math.min(130, Math.max(82, width * 0.09));
    for (const point of particles) {
      point.x = (point.x + point.vx * (delta / 1000) * speed + width) % width;
      point.y = (point.y + point.vy * (delta / 1000) * speed + height) % height;
    }
    for (let a = 0; a < particles.length; a++)
      for (let b = a + 1; b < particles.length; b++) {
        const first = particles[a],
          second = particles[b],
          distance = Math.hypot(first.x - second.x, first.y - second.y);
        if (distance >= threshold) continue;
        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
        ctx.lineTo(second.x, second.y);
        ctx.strokeStyle = rgba(coolColour, (1 - distance / threshold) * 0.1);
        ctx.lineWidth = 0.55;
        ctx.stroke();
      }
    for (const point of particles) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.size, 0, TAU);
      ctx.fillStyle = rgba(coolColour, point.alpha);
      ctx.fill();
    }
  }

  function drawOrbits(_time, delta) {
    const centreX = width * 0.62,
      centreY = height * 0.43,
      maximum = Math.min(width, height) * 0.48,
      speed = motion();
    backgroundGlow(centreX, centreY, maximum * 0.8);
    ctx.save();
    ctx.translate(centreX, centreY);
    ctx.rotate(-0.18);
    for (let ring = 0; ring < 7; ring++) {
      const radius = maximum * (0.22 + ring * 0.12);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * (0.42 + ring * 0.018), 0, 0, TAU);
      ctx.strokeStyle = rgba(ring % 2 ? coolColour : glowColour, 0.07 + ring * 0.008);
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    for (const satellite of particles) {
      satellite.angle += satellite.speed * (delta / 1000) * speed;
      const radius = maximum * (0.22 + satellite.ring * 0.12),
        x = Math.cos(satellite.angle) * radius,
        y = Math.sin(satellite.angle) * radius * (0.42 + satellite.ring * 0.018);
      ctx.beginPath();
      ctx.arc(x, y, satellite.size, 0, TAU);
      ctx.fillStyle = rgba(satellite.warm ? warmColour : coolColour, satellite.size > 1 ? 0.65 : 0.34);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWaves(time) {
    const phase = time * 0.00035 * (paused() ? 0 : effects === 'ambient' ? 0.32 : 1);
    backgroundGlow(width * 0.55, height * 0.55, Math.min(width, height) * 0.48);
    for (let wave = 0; wave < 7; wave++) {
      ctx.beginPath();
      for (let step = 0; step <= 48; step++) {
        const x = (step / 48) * width,
          y =
            height * (0.25 + wave * 0.085) +
            Math.sin(step * 0.3 + phase * (1 + wave * 0.09) + wave * 0.75) * (13 + wave * 2) +
            Math.sin(step * 0.09 - phase * 0.7) * 7;
        if (step) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = rgba(wave % 3 === 0 ? warmColour : coolColour, 0.07 + (6 - wave) * 0.012);
      ctx.lineWidth = wave % 3 === 0 ? 1.25 : 0.7;
      ctx.stroke();
    }
  }

  function drawEmbers(time, delta) {
    backgroundGlow(width * 0.52, height * 0.72, Math.min(width, height) * 0.42);
    const speed = motion();
    for (const ember of particles) {
      ember.y -= ember.speed * (delta / 1000) * speed;
      ember.x += (ember.drift + Math.sin(time * 0.0007 + ember.phase) * 3) * (delta / 1000) * speed;
      if (ember.y < -12) {
        ember.y = height + Math.random() * 50;
        ember.x = Math.random() * width;
      }
      if (ember.x < -20) ember.x = width + 10;
      if (ember.x > width + 20) ember.x = -10;
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, ember.size, 0, TAU);
      ctx.fillStyle = rgba(ember.size > 1.3 ? warmColour : glowColour, ember.alpha);
      ctx.fill();
    }
  }

  function paint(time, delta) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    if (scene === 'off') return;
    if (scene === 'starfield') drawStarfield(time, delta);
    if (scene === 'vortex') drawVortex(time, delta);
    if (scene === 'aurora') drawAurora(time);
    if (scene === 'constellation') drawConstellation(time, delta);
    if (scene === 'orbits') drawOrbits(time, delta);
    if (scene === 'waves') drawWaves(time);
    if (scene === 'embers') drawEmbers(time, delta);
  }

  function resize() {
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, width < 700 ? 1 : 1.25);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createScene();
    paint(performance.now(), 0);
  }

  function animate(time) {
    if (!running) return;
    const interval = effects === 'ambient' ? 80 : 33;
    if (time - lastPaint >= interval) {
      paint(time, Math.min(80, time - lastPaint || interval));
      lastPaint = time;
    }
    frame = requestAnimationFrame(animate);
  }

  function schedule() {
    cancelAnimationFrame(frame);
    canvas.hidden = scene === 'off';
    paint(performance.now(), 0);
    if (running && !paused() && scene !== 'off') frame = requestAnimationFrame(animate);
  }

  function syncTheme() {
    const nextScene = palette();
    if (nextScene !== scene) {
      scene = nextScene;
      createScene();
    }
    schedule();
  }

  function visibility() {
    running = !document.hidden;
    schedule();
  }

  addEventListener('resize', resize, { passive: true });
  addEventListener('companionthemechange', syncTheme);
  document.addEventListener('visibilitychange', visibility);
  motionQuery.addEventListener?.('change', schedule);
  scene = palette();
  resize();
  schedule();
}
