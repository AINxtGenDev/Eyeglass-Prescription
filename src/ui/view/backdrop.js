// Studio backdrop (03-08, D-10, D-11; UI-SPEC "Background chart", "Contact shadow").
// Both textures are our own canvas drawings made at runtime: no reference-folder image and no
// third-party chart. The chart distance (CHART_DISTANCE_MM, 200 mm behind the frame front) and
// every size here are UI-SPEC design values, not optics.
//
// - Chart (03-08; resized in 03-09 amendment A2): a vertical plane at z = −CHART_DISTANCE_MM with
//   a 10 mm checkerboard (#1a1a1a / #ffffff) and, at y = 0, a 600 × 24 mm white band with the
//   letter row 'E F P T O Z L P E D' (12 mm cap height). MeshBasicMaterial with toneMapped false,
//   so its pixels are the chart colours; seen through the lenses it shows the bending (checker
//   edges) and scale (letters).
//   A2: the checker plane is sized by setRect() from the camera math (chartRect: it covers the
//   whole view in the default, Vorne and heat poses over the allowed zoom range at the current
//   stage aspect), not a fixed 600 × 400 mm. So the texture is one 20 mm checker period repeated
//   (RepeatWrapping): the squares stay 10 mm and sharp at any plane size. The rectangle edges are
//   multiples of 20 mm, so square edges stay on the 10 mm grid with the 03-08 phase (ink at the
//   square whose top-left corner is (−300, 200)). The letter band is its own plane 0,5 mm in
//   front of the checker (no z-fighting at 24-bit depth and the near plane of 10 mm).
// - Contact shadow: a soft ellipse drawn once on a 256 × 128 canvas, on a horizontal plane under
//   the frame at y = −(B/2 + 25 mm). fit() only moves and scales it. No shadow maps on any tier.
// - Context restore (Pitfall 7): canvas textures re-upload from their canvas (reupload()).
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace } from 'three';
import { CHART_DISTANCE_MM } from '../../engine/mesh/frame.js';

/** Tier texture sizes are px for a 600 × 400 mm area (03-08), so px per mm = w / 600. */
const TIER_AREA_W_MM = 600;
const SQUARE_MM = 10;
/** 03-08 plane before the first camera rectangle (mm). */
const INITIAL_RECT = Object.freeze({ x0: -300, x1: 300, y0: -200, y1: 200 });
/** Letter band: width, height, cap height, letter pitch (mm); its z offset in front of the checker. */
const BAND_W_MM = 600;
const BAND_MM = 24;
const CAP_MM = 12;
const PITCH_MM = 20;
const BAND_Z_MM = 0.5;
// 04-08 (D-08): exported so the Durchblick chart (refraction.js) is drawn by the same code.
export const LETTERS = Object.freeze(['E', 'F', 'P', 'T', 'O', 'Z', 'L', 'P', 'E', 'D']);
export const INK = '#1a1a1a';
export const PAPER = '#ffffff';
/** Shadow canvas size and peak opacity; the gap below the boxing box bottom (mm). */
const SHADOW_CANVAS = [256, 128];
const SHADOW_PEAK = 0.25;
const SHADOW_GAP_MM = 25;

export const canvasOf = (w, h) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, g: /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')) };
};

/**
 * The letter band into a 2D context: a paper rectangle with the LETTERS row in ink, weight 600,
 * centred vertically with the given cap height, one letter per pitch from the rect's left edge.
 * Shared by the phase-3 chart (drawBand) and the Durchblick chart (04-08, D-08).
 * @param {CanvasRenderingContext2D} g
 * @param {{ x: number, y: number, w: number, h: number }} rect canvas px
 * @param {number} capPx cap height in canvas px
 * @param {number} pitchPx letter pitch in canvas px
 * @param {number} [count] number of letters (default: as many whole pitches as fit)
 */
export function drawLetterBand(g, rect, capPx, pitchPx, count = Math.floor(rect.w / pitchPx)) {
  g.fillStyle = PAPER;
  g.fillRect(rect.x, rect.y, rect.w, rect.h);
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  // Font size for the cap height: measure the cap height of 'E' at a reference size.
  g.font = '600 100px system-ui, sans-serif';
  const m = g.measureText('E');
  const capPer100 = m.actualBoundingBoxAscent > 0 ? m.actualBoundingBoxAscent : 70;
  g.font = `600 ${Math.round((capPx * 100) / capPer100)}px system-ui, sans-serif`;
  const baseline = rect.y + rect.h / 2 + capPx / 2;
  for (let i = 0; i < count; i++) g.fillText(LETTERS[i % LETTERS.length], rect.x + (i + 0.5) * pitchPx, baseline);
}

/** One 20 mm checker period (2 × 2 squares) at k px per mm; ink top-left and bottom-right. */
function drawTile(k) {
  const q = Math.max(2, Math.round(SQUARE_MM * k));
  const { canvas, g } = canvasOf(2 * q, 2 * q);
  g.fillStyle = PAPER;
  g.fillRect(0, 0, 2 * q, 2 * q);
  g.fillStyle = INK;
  g.fillRect(0, 0, q, q);
  g.fillRect(q, q, q, q);
  return canvas;
}

/** The letter band (600 × 24 mm) at k px per mm. */
function drawBand(k) {
  const w = Math.round(BAND_W_MM * k);
  const h = Math.round(BAND_MM * k);
  const { canvas, g } = canvasOf(w, h);
  drawLetterBand(g, { x: 0, y: 0, w, h }, CAP_MM * k, PITCH_MM * k, Math.floor(BAND_W_MM / PITCH_MM));
  return canvas;
}

/**
 * @param {import('three').Scene} scene
 * @param {import('three').WebGLRenderer} renderer
 * @param {readonly number[]} size [w, h] tier texture px for a 600 × 400 mm area
 */
export function createChart(scene, renderer, size) {
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const checkerMat = new MeshBasicMaterial({ toneMapped: false });
  const bandMat = new MeshBasicMaterial({ toneMapped: false });
  const checker = new Mesh(new PlaneGeometry(1, 1), checkerMat);
  checker.name = 'chart-checker';
  const band = new Mesh(new PlaneGeometry(BAND_W_MM, BAND_MM), bandMat);
  band.name = 'chart-band';
  band.position.z = BAND_Z_MM;
  const mesh = new Group();
  mesh.name = 'chart';
  mesh.add(checker, band);
  mesh.position.set(0, 0, -CHART_DISTANCE_MM);
  scene.add(mesh);
  let current = '';
  let rect = { ...INITIAL_RECT };

  const texture = (canvas) => {
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = anisotropy;
    return map;
  };
  const applyRect = () => {
    const w = rect.x1 - rect.x0;
    const h = rect.y1 - rect.y0;
    checker.scale.set(w, h, 1);
    checker.position.set((rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2, 0);
    checkerMat.map?.repeat.set(w / (2 * SQUARE_MM), h / (2 * SQUARE_MM));
  };

  function setSize([w, h]) {
    const key = `${w}x${h}`;
    if (key === current) return;
    current = key;
    const k = w / TIER_AREA_W_MM;
    const oldTile = checkerMat.map;
    const oldBand = bandMat.map;
    const tile = texture(drawTile(k));
    tile.wrapS = RepeatWrapping;
    tile.wrapT = RepeatWrapping;
    checkerMat.map = tile;
    bandMat.map = texture(drawBand(k));
    checkerMat.needsUpdate = true;
    bandMat.needsUpdate = true;
    applyRect();
    oldTile?.dispose();
    oldBand?.dispose();
  }
  setSize(size);

  return {
    mesh,
    setSize,
    /** A2: the checker rectangle on the chart plane (mm, edges on the 20 mm period). */
    setRect(r) {
      if (r.x0 === rect.x0 && r.x1 === rect.x1 && r.y0 === rect.y0 && r.y1 === rect.y1) return;
      rect = { x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1 };
      applyRect();
    },
    rect: () => ({ ...rect }),
    /** Tier texture size in px, e.g. '2048x1366'. */
    size: () => current,
    reupload: () => {
      for (const m of [checkerMat, bandMat]) if (m.map) m.map.needsUpdate = true;
    },
  };
}

/** @param {import('three').Scene} scene */
export function createShadow(scene) {
  const [w, h] = SHADOW_CANVAS;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  // A circle gradient squashed to an ellipse by the canvas aspect; transparent at the rim.
  g.setTransform(1, 0, 0, h / w, 0, 0);
  const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grad.addColorStop(0, `rgba(26, 26, 26, ${SHADOW_PEAK})`);
  grad.addColorStop(0.5, `rgba(26, 26, 26, ${SHADOW_PEAK * 0.55})`);
  grad.addColorStop(1, 'rgba(26, 26, 26, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, w);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  const mesh = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
  mesh.name = 'contact-shadow';
  mesh.rotation.x = -Math.PI / 2; // horizontal, facing up
  mesh.visible = false;
  scene.add(mesh);

  return {
    mesh,
    /**
     * Under the frame: y = −(B/2 + 25 mm), centred on the frame's bounding sphere, scaled to its
     * footprint (front width and temple depth both lie inside the sphere diameter).
     * @param {{ x: number, y: number, z: number, r: number }} sphere world, mm
     * @param {number} B boxing height (mm)
     */
    fit(sphere, B) {
      mesh.position.set(sphere.x, -(B / 2 + SHADOW_GAP_MM), sphere.z);
      mesh.scale.set(2 * sphere.r, 2 * sphere.r, 1);
      mesh.visible = true;
    },
    hide: () => {
      mesh.visible = false;
    },
    reupload: () => {
      map.needsUpdate = true;
    },
  };
}
