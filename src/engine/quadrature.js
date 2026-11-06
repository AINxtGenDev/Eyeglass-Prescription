// Gauss–Legendre quadrature, n = 24, computed once at module load by Newton iteration on P_n.

function gaussLegendre(n) {
  const x = new Float64Array(n);
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));
    let dp = 0;
    for (let it = 0; it < 100; it++) {
      // Three-term recurrence: (k+1)P_{k+1} = (2k+1) z P_k − k P_{k−1}
      let p0 = 1;
      let p1 = z;
      for (let k = 1; k < n; k++) {
        const p2 = ((2 * k + 1) * z * p1 - k * p0) / (k + 1);
        p0 = p1;
        p1 = p2;
      }
      dp = (n * (z * p1 - p0)) / (z * z - 1);
      const dz = p1 / dp;
      z -= dz;
      if (Math.abs(dz) < 1e-15) break;
    }
    x[i] = z;
    w[i] = 2 / ((1 - z * z) * dp * dp);
  }
  return Object.freeze({ x, w });
}

export const GL24 = gaussLegendre(24);
