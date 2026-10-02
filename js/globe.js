/* Canvas orthographic globe, generalized from CRS_African_Alumni_Atlas.html's
   IIFE (drag-to-rotate, momentum, auto-rotate-when-idle, tooltip hit-testing)
   into a reusable module driven by whichever continent is "active":
     Globe.init({...})
     Globe.setColorMap(iso3ToFillColor, defaultFill)   -- recolor countries
     Globe.setInfoMap(iso3ToTooltipHTML)                 -- tooltip content
     Globe.rotateTo(lon, lat, {duration})                -- animated rotation
     Globe.setZoom(factor, {duration})                   -- animated zoom
   Uses the vendored d3-geo (geoOrthographic + geoPath + geoContains) and
   versor (quaternion slerp, exact-drag) exactly as the prototype did --
   only the per-country fill/tooltip logic and the rotate/zoom animation
   API are new. */

const Globe = (() => {
  const DEG2RAD = Math.PI / 180;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const NOT_REP_FILL = '#726d5f';
  const ROW_FILL = '#2b3245';
  const BORDER = 'rgba(8,10,16,0.55)';

  let canvas, ctx, wrap, tooltipEl;
  let countries = [];
  let graticuleData;
  let projection, path;
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  let cssW = 0, cssH = 0, cx = 0, cy = 0, baseR = 0;
  let zoomFactor = 1;

  let colorMap = {};
  let defaultFill = ROW_FILL;
  let infoMap = {};

  function R() { return baseR * zoomFactor; }

  function resize() {
    const rect = wrap.getBoundingClientRect();
    cssW = rect.width; cssH = rect.height;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = cssW / 2; cy = cssH / 2;
    baseR = Math.min(cssW, cssH) / 2 * 0.84;
    projection.translate([cx, cy]).scale(R());
  }

  function render() {
    ctx.clearRect(0, 0, cssW, cssH);
    const rad = R();

    const oceanGrad = ctx.createRadialGradient(cx - rad * 0.35, cy - rad * 0.42, rad * 0.05, cx, cy, rad * 1.05);
    oceanGrad.addColorStop(0, '#202c46');
    oceanGrad.addColorStop(0.55, '#121a2c');
    oceanGrad.addColorStop(1, '#080b13');
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fillStyle = oceanGrad; ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); path(graticuleData); ctx.stroke();
    ctx.restore();

    for (const c of countries) {
      ctx.beginPath();
      path(c.geojson);
      const fill = colorMap[c.iso] || defaultFill;
      ctx.fillStyle = fill;
      ctx.fill('evenodd');
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = BORDER;
      ctx.stroke();
    }

    const rim = ctx.createRadialGradient(cx, cy, rad * 0.94, cx, cy, rad * 1.16);
    rim.addColorStop(0, 'rgba(130,175,255,0)');
    rim.addColorStop(0.6, 'rgba(130,175,255,0.16)');
    rim.addColorStop(1, 'rgba(130,175,255,0)');
    ctx.beginPath(); ctx.arc(cx, cy, rad * 1.16, 0, Math.PI * 2); ctx.fillStyle = rim; ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.clip();
    const dawn = ctx.createRadialGradient(cx - rad * 0.65, cy + rad * 0.6, 0, cx - rad * 0.65, cy + rad * 0.6, rad * 1.15);
    dawn.addColorStop(0, 'rgba(255,190,110,0.30)');
    dawn.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = dawn;
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    ctx.restore();
  }

  /* ---- rotation / interaction state (ported from the prototype) ---- */
  let dragging = false, moved = 0;
  let v0, q0, r0;
  let prevAppliedRotate;
  let lastMx = 0, lastMy = 0, lastT = 0;
  let velLambda = 0, velPhi = 0;
  let autoRotating = !reduceMotion;
  const AUTO_SPEED_DEG = 2.6;
  const DECAY = 0.94;
  let idleTimer = null;

  /* ---- animated rotate/zoom (new: drives the scrollytelling continent takeover) ---- */
  let rotAnim = null; // { interp, start, duration }
  let zoomAnim = null; // { from, to, start, duration }

  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function angDiff(a, b) { let d = a - b; while (d > 180) d -= 360; while (d < -180) d += 360; return d; }
  function clampToDisk(mx, my) {
    const dx = mx - cx, dy = my - cy, dist = Math.hypot(dx, dy);
    if (dist <= R() - 1 || dist === 0) return [mx, my];
    const k = (R() - 1) / dist;
    return [cx + dx * k, cy + dy * k];
  }

  function scheduleIdle() {
    clearTimeout(idleTimer);
    if (reduceMotion) return;
    idleTimer = setTimeout(() => { if (!dragging) autoRotating = true; }, 2200);
  }

  let lastFrame = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;

    if (rotAnim) {
      const t = clamp((now - rotAnim.start) / rotAnim.duration, 0, 1);
      projection.rotate(rotAnim.interp(easeInOutCubic(t)));
      if (t >= 1) rotAnim = null;
    } else if (!dragging) {
      if (Math.abs(velLambda) > 0.02 || Math.abs(velPhi) > 0.02) {
        const r = projection.rotate();
        projection.rotate([r[0] + velLambda * dt, clamp(r[1] + velPhi * dt, -89, 89), r[2]]);
        velLambda *= DECAY; velPhi *= DECAY;
      } else if (autoRotating) {
        const r = projection.rotate();
        projection.rotate([r[0] + AUTO_SPEED_DEG * dt, r[1], r[2]]);
      }
    }

    if (zoomAnim) {
      const t = clamp((now - zoomAnim.start) / zoomAnim.duration, 0, 1);
      zoomFactor = zoomAnim.from + (zoomAnim.to - zoomAnim.from) * easeInOutCubic(t);
      projection.scale(R());
      if (t >= 1) zoomFactor = zoomAnim.to, zoomAnim = null;
    }

    render();
    requestAnimationFrame(tick);
  }

  function rotateTo(lon, lat, { duration = 900 } = {}) {
    const target = [-lon, -lat, 0];
    if (reduceMotion) { projection.rotate(target); rotAnim = null; return; }
    autoRotating = false;
    clearTimeout(idleTimer);
    rotAnim = { interp: versor.interpolate(projection.rotate(), target), start: performance.now(), duration };
  }

  function setZoom(factor, { duration = 900 } = {}) {
    if (reduceMotion) { zoomFactor = factor; projection.scale(R()); zoomAnim = null; return; }
    zoomAnim = { from: zoomFactor, to: factor, start: performance.now(), duration };
  }

  /* ---- tooltip + hit-testing ---- */
  function showTooltip(country, clientX, clientY) {
    const html = infoMap[country.iso];
    if (!html) { hideTooltip(); return; }
    tooltipEl.innerHTML = html;
    const pad = 16;
    let x = clientX + 16, y = clientY + 16;
    const tw = 240, th = 90;
    if (x + tw + pad > window.innerWidth) x = clientX - tw - 16;
    if (y + th + pad > window.innerHeight) y = clientY - th - 16;
    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
    tooltipEl.classList.add('visible');
  }
  function hideTooltip() { tooltipEl.classList.remove('visible'); }

  function pickCountry(rawX, rawY) {
    if (Math.hypot(rawX - cx, rawY - cy) > R()) return null;
    const lonlat = projection.invert([rawX, rawY]);
    if (!lonlat || !isFinite(lonlat[0]) || !isFinite(lonlat[1])) return null;
    for (const c of countries) {
      if (d3.geoContains(c.geojson, lonlat)) return c;
    }
    return null;
  }

  function bindInteraction() {
    canvas.style.touchAction = 'none';

    canvas.addEventListener('pointerdown', e => {
      dragging = true; autoRotating = false; rotAnim = null; velLambda = 0; velPhi = 0; moved = 0;
      const rect = canvas.getBoundingClientRect();
      const [mx, my] = clampToDisk(e.clientX - rect.left, e.clientY - rect.top);
      r0 = projection.rotate();
      prevAppliedRotate = r0;
      q0 = versor(r0);
      v0 = versor.cartesian(projection.invert([mx, my]));
      lastMx = mx; lastMy = my; lastT = performance.now();
      canvas.setPointerCapture(e.pointerId);
      clearTimeout(idleTimer);
      hideTooltip();
    });
    canvas.addEventListener('pointermove', e => {
      const rect = canvas.getBoundingClientRect();
      const rawX = e.clientX - rect.left, rawY = e.clientY - rect.top;
      if (dragging) {
        const [mx, my] = clampToDisk(rawX, rawY);
        projection.rotate(r0);
        const v1 = versor.cartesian(projection.invert([mx, my]));
        const q1 = versor.multiply(q0, versor.delta(v0, v1));
        const newRotate = versor.rotation(q1);
        projection.rotate(newRotate);

        const now = performance.now();
        const dt = Math.max(0.001, (now - lastT) / 1000);
        velLambda = angDiff(newRotate[0], prevAppliedRotate[0]) / dt;
        velPhi = (newRotate[1] - prevAppliedRotate[1]) / dt;
        prevAppliedRotate = newRotate;

        moved += Math.hypot(mx - lastMx, my - lastMy);
        lastMx = mx; lastMy = my; lastT = now;
      } else {
        const c = pickCountry(rawX, rawY);
        if (c) { canvas.style.cursor = 'pointer'; showTooltip(c, e.clientX, e.clientY); }
        else { canvas.style.cursor = 'grab'; hideTooltip(); }
      }
    });
    canvas.addEventListener('pointerup', e => {
      dragging = false;
      if (moved < 4) {
        const rect = canvas.getBoundingClientRect();
        const c = pickCountry(e.clientX - rect.left, e.clientY - rect.top);
        if (c) showTooltip(c, e.clientX, e.clientY); else hideTooltip();
      }
      scheduleIdle();
    });
    canvas.addEventListener('pointercancel', () => { dragging = false; scheduleIdle(); });
    canvas.addEventListener('pointerleave', () => { if (!dragging) hideTooltip(); });
  }

  function init({ canvasEl, tooltipEl: tt, world, initialRotate = [-20, -8, 0] }) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    wrap = canvas.parentElement;
    tooltipEl = tt;

    countries = world.map(f => ({ name: f.n, iso: f.a3, continent: f.c, geojson: { type: 'MultiPolygon', coordinates: f.g } }));
    graticuleData = d3.geoGraticule()();
    projection = d3.geoOrthographic().clipAngle(90).precision(0.4).rotate(initialRotate);
    path = d3.geoPath(projection, ctx);

    new ResizeObserver(resize).observe(wrap);
    resize();
    bindInteraction();
    scheduleIdle();
    requestAnimationFrame(tick);
  }

  function setColorMap(map, fallback = ROW_FILL) { colorMap = map; defaultFill = fallback; }
  function setInfoMap(map) { infoMap = map; }

  return { init, setColorMap, setInfoMap, rotateTo, setZoom, resize, NOT_REP_FILL, ROW_FILL };
})();
