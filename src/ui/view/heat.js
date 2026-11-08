// Dickenkarte material (03-12, VIZ-05, UX-02, D-21…D-23; UI-SPEC "Heatmap colours", RESEARCH
// Pattern 7). This shader colours an ENGINE SCALAR only: the per-vertex `thickness` attribute that
// the mesh worker filled with the engine's thicknessAt (lens.js). It computes no optics (CLAUDE.md:
// no GLSL copy of the optics); the scale and the iso step come from the engine (heatScale /
// isoLevels in src/engine/mesh/heat.js), set by view.js once per delivery.
//
// - Colour = cividis(1 − t), t = (thickness − scaleMin) / (scaleMax − scaleMin): thicker = darker.
// - Unlit, toneMapped false, and no colorspace / tone-mapping include: the LUT uniform holds RAW
//   sRGB floats (cividis.js CIVIDIS_UNIFORM, not three.js Color, which would linearise hex), and the
//   fragment writes them unchanged to the sRGB canvas, so each pixel equals the legend colour.
// - Iso lines (RESEARCH Pattern 7): abs(fract(q − 0,5) − 0,5) / fwidth(q) < 1 with q = th / step is
//   within 1 px of a multiple of the step, so the line is about 2 px wide at any zoom. Only the
//   level values strictly inside (scaleMin, scaleMax) are drawn (heat.js isoLevels values). Line
//   colour #ffffff where the LUT position u < 0,5, else #1a1a1a (UI-SPEC, min 4,17:1).
// - D-26 / MINOR 1 rebuttal: the material is created once and stays on a hidden one-triangle
//   carrier mesh, so compileAsync (r187 compile() walks scene.traverse, visible or not) or the
//   synchronous compile of the carrier builds its program before the first switch.
import { ShaderMaterial, Vector3, Mesh, BufferGeometry, BufferAttribute } from 'three';
import { CIVIDIS_UNIFORM, CIVIDIS_HEX, ISO_SWITCH_U } from './cividis.js';

const N = CIVIDIS_HEX.length;
/** UI-SPEC iso-line colour on light map colours: #1a1a1a as a raw sRGB float. */
const DARK_LINE = (0x1a / 255).toFixed(6);

const vertexShader = /* glsl */ `
attribute float thickness;
varying float vThick;
void main() {
  vThick = thickness;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float scaleMin;
uniform float scaleMax;
uniform float isoStep;
uniform vec3 lut[${N}];
varying float vThick;
void main() {
  float t = clamp((vThick - scaleMin) / max(scaleMax - scaleMin, 1e-6), 0.0, 1.0);
  float u = 1.0 - t;
  float x = u * ${(N - 1).toFixed(1)};
  int i = int(min(floor(x), ${(N - 2).toFixed(1)}));
  vec3 c = mix(lut[i], lut[i + 1], x - float(i));
  if (isoStep > 0.0) {
    float q = vThick / isoStep;
    float k = floor(q + 0.5) * isoStep;
    float d = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), 1e-6);
    if (d < 1.0 && k > scaleMin + 1e-4 && k < scaleMax - 1e-4) {
      c = u < ${ISO_SWITCH_U.toFixed(1)} ? vec3(1.0) : vec3(${DARK_LINE});
    }
  }
  gl_FragColor = vec4(c, 1.0);
}
`;

/**
 * The heat material plus its hidden carrier mesh (added to the scene).
 * @param {import('three').Scene} scene
 */
export function createHeat(scene) {
  const lut = [];
  for (let i = 0; i < N; i++) lut.push(new Vector3(CIVIDIS_UNIFORM[3 * i], CIVIDIS_UNIFORM[3 * i + 1], CIVIDIS_UNIFORM[3 * i + 2]));
  const material = new ShaderMaterial({
    name: 'heat',
    uniforms: {
      scaleMin: { value: 0 },
      scaleMax: { value: 1 },
      isoStep: { value: 0 },
      lut: { value: lut },
    },
    vertexShader,
    fragmentShader,
    toneMapped: false,
  });
  // Carrier: same attributes as a lens face (position, normal, thickness), one triangle, hidden.
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  g.setAttribute('thickness', new BufferAttribute(new Float32Array(3), 1));
  const carrier = new Mesh(g, material);
  carrier.name = 'heatCarrier';
  carrier.visible = false;
  scene.add(carrier);
  return {
    material,
    carrier,
    /**
     * Shared scale (D-23) and iso step from the engine's isoLevels; flat → no lines.
     * @param {{ scaleMin: number, scaleMax: number, step: number, flat: boolean }} levels
     */
    setScale({ scaleMin, scaleMax, step, flat }) {
      material.uniforms.scaleMin.value = scaleMin;
      material.uniforms.scaleMax.value = scaleMax;
      material.uniforms.isoStep.value = flat ? 0 : step;
    },
    uniforms: () => ({
      scaleMin: material.uniforms.scaleMin.value,
      scaleMax: material.uniforms.scaleMax.value,
      isoStep: material.uniforms.isoStep.value,
    }),
  };
}
