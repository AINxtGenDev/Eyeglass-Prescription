// Studio backdrop (03-08, D-10, D-11; UI-SPEC "Background chart", "Contact shadow").
// Both textures are our own canvas drawings made at runtime: no reference-folder image and no
// third-party chart. The chart distance (CHART_DISTANCE_MM, 200 mm behind the frame front) and
// every size here are UI-SPEC design values, not optics.
//
// - Chart: a 600 × 400 mm vertical plane at z = −CHART_DISTANCE_MM with a 10 mm checkerboard
//   (#1a1a1a / #ffffff) and, at y = 0, a 24 mm white band with the letter row 'E F P T O Z L P E D'
//   (12 mm cap height). MeshBasicMaterial with toneMapped false, so its pixels are the chart
//   colours; seen through the lenses it shows the bending (checker edges) and scale (letters).
// - Contact shadow: a soft ellipse drawn once on a 256 × 128 canvas, on a horizontal plane under
//   the frame at y = −(B/2 + 25 mm). fit() only moves and scales it. No shadow maps on any tier.
// - Context restore (Pitfall 7): canvas textures re-upload from their canvas (reupload()).
import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { CHART_DISTANCE_MM } from '../../engine/mesh/frame.js';

/** Chart plane size (mm) and checker square (mm). */
const CHART_W_MM = 600;
const CHART_H_MM = 400;
const SQUARE_MM = 10;
/** Letter band: height, cap height, letter pitch (mm). */
const BAND_MM = 24;
const CAP_MM = 12;
const PITCH_MM = 20;
const LETTERS = ['E', 'F', 'P', 'T', 'O', 'Z', 'L', 'P', 'E', 'D'];
const INK = '#1a1a1a';
const PAPER = '#ffffff';
/** Shadow canvas size and peak opacity; the gap below the boxing box bottom (mm). */
const SHADOW_CANVAS = [256, 128];
const SHADOW_PEAK = 0.25;
const SHADOW_GAP_MM = 25;

/** Draw the chart at w × h px (the plane is 600 × 400 mm, so px per mm = w / 600). */
function drawChart(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const kx = w / CHART_W_MM;
  const ky = h / CHART_H_MM;
  g.fillStyle = PAPER;
  g.fillRect(0, 0, w, h);
  g.fillStyle = INK;
  const nx = CHART_W_MM / SQUARE_MM;
  const ny = CHART_H_MM / SQUARE_MM;
  for (let j = 0; j < ny; j++) {
    for (let i = (j % 2); i < nx; i += 2) {
      // Integer pixel edges, so neighbouring squares do not leave hairline seams.
      const x0 = Math.round(i * SQUARE_MM * kx);
      const y0 = Math.round(j * SQUARE_MM * ky);
      g.fillRect(x0, y0, Math.round((i + 1) * SQUARE_MM * kx) - x0, Math.round((j + 1) * SQUARE_MM * ky) - y0);
    }
  }
  // Letter band centred on y = 0 (canvas centre).
  const bandTop = Math.round((CHART_H_MM / 2 - BAND_MM / 2) * ky);
  g.fillStyle = PAPER;
  g.fillRect(0, bandTop, w, Math.round(BAND_MM * ky));
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  // Font size for a 12 mm cap height: measure the cap height of 'E' at a reference size.
  g.font = '600 100px system-ui, sans-serif';
  const m = g.measureText('E');
  const capPer100 = m.actualBoundingBoxAscent > 0 ? m.actualBoundingBoxAscent : 70;
  const capPx = CAP_MM * ky;
  g.font = `600 ${Math.round((capPx * 100) / capPer100)}px system-ui, sans-serif`;
  const baseline = (CHART_H_MM / 2) * ky + capPx / 2;
  const count = Math.floor(CHART_W_MM / PITCH_MM);
  for (let k = 0; k < count; k++) {
    g.fillText(LETTERS[k % LETTERS.length], (k + 0.5) * PITCH_MM * kx, baseline);
  }
  return canvas;
}

/**
 * @param {import('three').Scene} scene
 * @param {import('three').WebGLRenderer} renderer
 * @param {readonly number[]} size [w, h] texture px (tier chart size)
 */
export function createChart(scene, renderer, size) {
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const material = new MeshBasicMaterial({ toneMapped: false });
  const mesh = new Mesh(new PlaneGeometry(CHART_W_MM, CHART_H_MM), material);
  mesh.name = 'chart';
  mesh.position.set(0, 0, -CHART_DISTANCE_MM);
  scene.add(mesh);
  let current = '';

  function setSize([w, h]) {
    const key = `${w}x${h}`;
    if (key === current) return;
    current = key;
    const old = material.map;
    const map = new CanvasTexture(drawChart(w, h));
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = anisotropy;
    material.map = map;
    material.needsUpdate = true;
    old?.dispose();
  }
  setSize(size);

  return {
    mesh,
    setSize,
    /** Texture size in px, e.g. '2048x1366'. */
    size: () => current,
    reupload: () => {
      if (material.map) material.map.needsUpdate = true;
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
