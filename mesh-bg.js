/* MeshBg.start({ canvas, dark }) vrací { blast, setDark, stop }.
   blast({ x, y, all }) spustí vlnu od bodu. all pokryje celé okno.
   Soubor nezná konkrétní aplikaci. */
const MeshBg = (() => {
  function start(options = {}) {
  const canvas = options.canvas;
  if (!canvas || !canvas.getContext) return null;
  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const signals = new AbortController();
  let dark = Boolean(options.dark);
  let points = [];
  let links = [];
  let frame = 0;
  let running = false;
  const pointer = { x: -100, y: -100, px: -100, py: -100, inside: false };
  const blasts = [];

  function gap() {
    const width = window.innerWidth;
    if (width < 640) return 72;
    if (width < 1100) return 96;
    return 118;
  }

  function build() {
    const step = gap();
    const cols = Math.ceil(window.innerWidth / step) + 2;
    const rows = Math.ceil(window.innerHeight / step) + 2;
    points = [];
    for (let row = -1; row <= rows; row += 1) {
      for (let col = -1; col <= cols; col += 1) {
        const jitter = step * 0.36;
        points.push({
          x: col * step + (Math.random() - 0.5) * jitter,
          y: row * step + (Math.random() - 0.5) * jitter,
          z: Math.random() * 2 - 1,
          phase: Math.random() * Math.PI * 2,
          phase2: Math.random() * Math.PI * 2,
          amp: step * (0.22 + Math.random() * 0.28),
          mode: "on",
          visited: false,
          returnAt: 0,
          radius: 1.7,
          started: 0,
          shards: Array.from({ length: 8 }, () => ({
            angle: Math.random() * Math.PI * 2,
            dist: 16 + Math.random() * 26,
            size: 1.1 + Math.random() * 1.3,
          })),
        });
      }
    }
    const reach = step * 2.05;
    const reachSq = reach * reach;
    links = [];
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        if (dx * dx + dy * dy > reachSq) continue;
        links.push({ a: i, b: j, mode: "live", cutAt: 0.5, started: 0, restoreAt: 0 });
      }
    }
  }

  function palette() {
    if (dark) return { bg: "#07111a", rgb: [45, 212, 191], alpha: 0.55, node: "rgba(204, 251, 241, 0.9)" };
    return { bg: "#ffffff", rgb: [100, 116, 139], alpha: 0.85, node: "rgba(71, 85, 105, 0.9)" };
  }

  function project(x, y, z) {
    const depth = 0.68 + (z + 1) * 0.32;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    return {
      x: cx + (x - cx) * depth,
      y: cy + (y - cy) * depth,
      z,
      scale: 0.84 + (z + 1) * 0.16,
    };
  }

  function place(point, time) {
    let x = point.x;
    let y = point.y;
    let z = point.z;
    if (!reduced.matches) {
      const t = time * 0.0007;
      x += Math.sin(t * 0.62 + point.phase) * point.amp + Math.sin(t * 0.21 + point.phase2) * point.amp * 0.7;
      y += Math.cos(t * 0.47 + point.phase2) * point.amp + Math.sin(t * 0.16 + point.phase) * point.amp * 0.65;
      z += Math.sin(t * 0.37 + point.phase) * 0.7 + Math.cos(t * 0.19 + point.phase2) * 0.35;
      z = Math.max(-1, Math.min(1, z));
    }
    return project(x, y, z);
  }

  function lineLook(from, to) {
    const dist = Math.hypot(to.x - from.x, to.y - from.y, (to.z - from.z) * gap());
    const fade = Math.min(1, Math.max(0, (dist - gap() * 0.65) / (gap() * 2.1)));
    return { width: 1.65 - fade * 1.2, alpha: 1 - fade * 0.78 };
  }

  function applyLine(colors, from, to, strength) {
    const look = lineLook(from, to);
    const [red, green, blue] = colors.rgb;
    ctx.lineWidth = look.width;
    ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${colors.alpha * look.alpha * strength})`;
  }

  function pointOnSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const x = ax + dx * t;
    const y = ay + dy * t;
    return { t, d: Math.hypot(px - x, py - y) };
  }

  function cross(ax, ay, bx, by) {
    return ax * by - ay * bx;
  }

  function bladeHit(ax, ay, bx, by) {
    const radius = 22;
    const rx = bx - ax;
    const ry = by - ay;
    const sx = pointer.x - pointer.px;
    const sy = pointer.y - pointer.py;
    const denom = cross(rx, ry, sx, sy);
    if (Math.abs(denom) > 0.001 && (sx * sx + sy * sy) > 1) {
      const qpx = pointer.px - ax;
      const qpy = pointer.py - ay;
      const t = cross(qpx, qpy, sx, sy) / denom;
      const u = cross(qpx, qpy, rx, ry) / denom;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return t;
    }
    const near = pointOnSegment(pointer.x, pointer.y, ax, ay, bx, by);
    return near.d <= radius ? near.t : null;
  }

  function cutLines(time) {
    if (!pointer.inside) return;
    const placed = points.map((point) => place(point, time));
    links.forEach((link) => {
      if (link.mode !== "live") return;
      const from = placed[link.a];
      const to = placed[link.b];
      const at = bladeHit(from.x, from.y, to.x, to.y);
      if (at == null) return;
      link.cutAt = at;
      link.started = time;
      if (reduced.matches) {
        link.mode = "gone";
        link.restoreAt = time + 2000 + Math.random() * 2500;
        return;
      }
      link.mode = "cut";
    });
  }

  function blastDistance(spot, blast) {
    if (!blast.rect) return Math.hypot(spot.x - blast.x, spot.y - blast.y);
    const dx = Math.max(blast.rect.left - spot.x, 0, spot.x - blast.rect.right);
    const dy = Math.max(blast.rect.top - spot.y, 0, spot.y - blast.rect.bottom);
    return Math.hypot(dx, dy);
  }

  function silenceLink(link, time) {
    if (link.mode === "gone") return;
    link.mode = "gone";
    link.restoreAt = time + 2000 + Math.random() * 2500;
  }

  function blastLimit(blast) {
    if (blast.all) return Math.hypot(window.innerWidth, window.innerHeight) + gap();
    if (blast.rect) return blast.pad;
    return gap() * 3;
  }

  function detonate(placed, time) {
    if (!blasts.length) return;
    const step = gap();
    const ring = reduced.matches ? 0 : 180;
    for (let i = blasts.length - 1; i >= 0; i -= 1) {
      const blast = blasts[i];
      const maxReach = blastLimit(blast);
      const age = time - blast.started;
      const reach = ring === 0 ? maxReach : Math.min(maxReach, (age / ring) * step);
      placed.forEach((spot, index) => {
        const point = points[index];
        if (point.mode !== "on") return;
        const distance = blastDistance(spot, blast);
        if (distance > maxReach || distance > reach) return;
        point.mode = "boom";
        point.started = time;
        point.returnAt = time + 4000;
        point.visited = true;
        links.forEach((link) => {
          if (link.a === index || link.b === index) silenceLink(link, time);
        });
      });
      if (age >= (ring === 0 ? 0 : (maxReach / step) * ring) + 40) blasts.splice(i, 1);
    }
  }

  function wavePending(spot, time) {
    const step = gap();
    const ring = reduced.matches ? 0 : 180;
    return blasts.some((blast) => {
      const maxReach = blastLimit(blast);
      const distance = blastDistance(spot, blast);
      if (distance > maxReach) return false;
      const reach = ring === 0 ? maxReach : Math.min(maxReach, ((time - blast.started) / ring) * step);
      return distance > reach;
    });
  }

  function strokePiece(path, from, to, start, end) {
    path.moveTo(from.x + (to.x - from.x) * start, from.y + (to.y - from.y) * start);
    path.lineTo(from.x + (to.x - from.x) * end, from.y + (to.y - from.y) * end);
  }

  function draw(time) {
    const colors = palette();
    const width = window.innerWidth;
    const height = window.innerHeight;
    cutLines(time);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);
    const placed = points.map((point) => place(point, time));
    detonate(placed, time);
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    links.forEach((link) => {
      const from = placed[link.a];
      const to = placed[link.b];
      if (link.mode === "cut") {
        const p = Math.min(1, (time - link.started) / 420);
        const gap = 0.08 + p * 0.92;
        const left = Math.max(0, link.cutAt - gap * link.cutAt);
        const right = Math.min(1, link.cutAt + gap * (1 - link.cutAt));
        applyLine(colors, from, to, 1 - p);
        ctx.beginPath();
        if (left > 0.01) strokePiece(ctx, from, to, 0, left);
        if (right < 0.99) strokePiece(ctx, from, to, right, 1);
        ctx.stroke();
        if (p >= 1) {
          link.mode = "gone";
          link.restoreAt = time + 2000 + Math.random() * 2500;
        }
        return;
      }
      if (link.mode === "gone") {
        if (time >= link.restoreAt) {
          link.mode = "grow";
          link.started = time;
        }
        return;
      }
      if (link.mode === "grow") {
        const p = Math.min(1, (time - link.started) / 680);
        applyLine(colors, from, to, 0.35 + p * 0.65);
        ctx.beginPath();
        strokePiece(ctx, from, to, 0, p);
        ctx.stroke();
        if (p >= 1) link.mode = "live";
        return;
      }
      applyLine(colors, from, to, 1);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });
    const alive = points.map(() => 0);
    const degree = points.map(() => 0);
    links.forEach((link) => {
      degree[link.a] += 1;
      degree[link.b] += 1;
      if (link.mode === "gone") return;
      alive[link.a] += 1;
      alive[link.b] += 1;
    });
    let busiest = 1;
    alive.forEach((count) => {
      if (count > busiest) busiest = count;
    });
    ctx.fillStyle = colors.node;
    placed.forEach((spot, index) => {
      const point = points[index];
      if (!degree[index]) return;
      if (pointer.inside) {
        const crossed = pointOnSegment(spot.x, spot.y, pointer.px, pointer.py, pointer.x, pointer.y);
        if (crossed.d <= 16) point.visited = true;
      }
      if (alive[index] > 0) {
        if (point.returnAt && time < point.returnAt) {
          point.mode = "off";
          return;
        }
        if (point.mode !== "on") point.visited = false;
        point.mode = "on";
        point.returnAt = 0;
        const weight = (alive[index] - 1) / Math.max(1, busiest - 1);
        point.radius = 1.7 * (1 + Math.min(1, Math.max(0, weight)));
        ctx.beginPath();
        ctx.arc(spot.x, spot.y, point.radius * spot.scale, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (point.mode === "on") {
        if (wavePending(spot, time)) {
          ctx.beginPath();
          ctx.arc(spot.x, spot.y, point.radius * spot.scale, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        if (point.visited) {
          point.mode = "boom";
          point.started = time;
          point.returnAt = time + 4000;
        } else {
          point.mode = "off";
          point.visited = false;
        }
      }
      if (point.mode !== "boom") return;
      const progress = Math.min(1, (time - point.started) / (reduced.matches ? 1 : 520));
      ctx.globalAlpha = 1 - progress;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, point.radius * (1 - progress), 0, Math.PI * 2);
      ctx.fill();
      if (!reduced.matches) {
        point.shards.forEach((shard) => {
          ctx.beginPath();
          ctx.arc(
            spot.x + Math.cos(shard.angle) * shard.dist * progress,
            spot.y + Math.sin(shard.angle) * shard.dist * progress,
            shard.size * (1 - progress * 0.55),
            0,
            Math.PI * 2,
          );
          ctx.fill();
        });
      }
      ctx.globalAlpha = 1;
      if (progress >= 1) point.mode = "off";
    });
    pointer.px = pointer.x;
    pointer.py = pointer.y;
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    build();
    draw(performance.now());
  }

  function loop(time) {
    if (!running) return;
    draw(time);
    frame = requestAnimationFrame(loop);
  }

  function sync() {
    if (running) return;
    running = true;
    resize();
    frame = requestAnimationFrame(loop);
  }

  function blast(detail = {}) {
    if (!running) return;
    if (detail.rect) {
      blasts.push({
        rect: detail.rect,
        pad: Number.isFinite(detail.pad) ? detail.pad : gap() * 3,
        all: Boolean(detail.all),
        started: performance.now(),
      });
      return;
    }
    const x = Number(detail.x);
    const y = Number(detail.y);
    blasts.push({
      x: Number.isFinite(x) ? x : window.innerWidth / 2,
      y: Number.isFinite(y) ? y : window.innerHeight / 2,
      all: Boolean(detail.all),
      started: performance.now(),
    });
  }

  function setDark(next) {
    dark = Boolean(next);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frame);
    signals.abort();
  }

  const listen = { signal: signals.signal };
  window.addEventListener("pointermove", (event) => {
    if (!running) return;
    if (!pointer.inside) {
      pointer.px = event.clientX;
      pointer.py = event.clientY;
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.inside = true;
  }, listen);
  window.addEventListener("pointerleave", () => {
    pointer.inside = false;
  }, listen);
  window.addEventListener("resize", () => {
    if (running) resize();
  }, listen);
  document.addEventListener("visibilitychange", () => {
    if (!running) return;
    cancelAnimationFrame(frame);
    if (document.visibilityState === "visible") frame = requestAnimationFrame(loop);
  }, listen);
  sync();
  return { blast, setDark, stop };
  }

  return { start };
})();

window.MeshBg = MeshBg;
