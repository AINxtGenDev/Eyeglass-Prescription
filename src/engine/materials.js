// MAT-01 materials. The engine uses `ne` (mercury e-line, 546.07 nm) everywhere; `nd`
// (helium d-line) is recorded for reference only.
//
// All values re-read with `pdftotext` from the cited Zeiss PDFs on 2026-11-06.
// `page` is the PDF page (document page + 3 in fsv2023.pdf, + 2 in clearview-lensspec.pdf)
// unless it says "doc p.".
// `assumed` lists fields not read from a sheet row (RESEARCH Assumptions A5).
//
// CORRECTION (RESEARCH "Materials"): PITFALLS.md lists CR-39 ne 1.502. Some Zeiss 1.5 sheets
// (PhotoFusion, BlueGuard) do state ne 1.502, but the three spherical sheets used as fixtures
// state nd 1.499 / ne 1.500. 1.500 is used because it matches the fixture sheets (the BVP check
// closes to 0.023 D with it).

const row = (r) => Object.freeze({ ...r, source: Object.freeze(r.source) });

export const MATERIALS = Object.freeze({
  cr39: row({
    id: 'cr39',
    ne: 1.5,
    nd: 1.499,
    ve: 56,
    vd: 58,
    density: 1.32, // g/cm³
    minCT: 1.8, // mm, all minus rows of the sheet
    minET: 1.0, // mm, plus rows 65/70 mm
    source: {
      doc: 'ZEISS Finished Single Vision Fact Sheets, Version 6/23, synchrony Finished SV SPH 1.5 HC (doc 00523.FS1)',
      url: 'https://www.zeiss.com/content/dam/vis-b2b/usa/downloads/pdfs/fsv2023.pdf',
      page: 'doc p.124/132/140',
    },
  }),
  // Trivex: Z00981.FS1 pdf p.77 states nd 1.527, ne 1.530, νd 45, νe 45, density 1.11
  // (same on Z00982.FS1, pdf p.80). pdf p.79: "70 mm Minus Range … Minimum CT 1.5 mm";
  // 65 mm plus rows at ET 1.0 mm.
  // Conflict: "synchrony Finished SV SPH 1.53 HC" (doc 00617.FS1, pdf p.84) states the same
  // nd/ne/density but Abbe νd 58 / νe 56, equal to the CR-39 sheets and likely a copy error.
  // 45/45 from Z00981.FS1 is used.
  trivex: row({
    id: 'trivex',
    ne: 1.53,
    nd: 1.527,
    ve: 45,
    vd: 45,
    density: 1.11,
    minCT: 1.5,
    minET: 1.0,
    source: {
      doc: 'ZEISS FSV Fact Sheets, Version 6/23, ZEISS Finished SV SPH 1.53 UVProtect DuraVision Platinum UV (doc Z00981.FS1)',
      url: 'https://www.zeiss.com/content/dam/vis-b2b/usa/downloads/pdfs/fsv2023.pdf',
      page: 'pdf p.77 (constants), p.79 (thicknesses)',
    },
  }),
  // Polycarbonate: synchrony Finished SV AS 1.59 HC+ (doc 00495.FS1) pdf p.66 and the
  // spherical PC sheet pdf p.69: nd 1.586, ne 1.590, νd 30, νe 29, density 1.20.
  // pdf p.68 (HC+): plus ET 1.3, minus CT 1.5 (1.4/1.3 at higher minus), "No lens to be sold
  // with a CT under 1.1mm"; pdf p.62 (UVProtect HART, Z00955.FS1) minus CT 1.5 → 1.3.
  pc: row({
    id: 'pc',
    ne: 1.59,
    nd: 1.586,
    ve: 29,
    vd: 30,
    density: 1.2,
    minCT: 1.5,
    minET: 1.3,
    source: {
      doc: 'ZEISS FSV Fact Sheets, Version 6/23, synchrony Finished SV AS 1.59 HC+ (doc 00495.FS1) / spherical PC sheet',
      url: 'https://www.zeiss.com/content/dam/vis-b2b/usa/downloads/pdfs/fsv2023.pdf',
      page: 'pdf p.66/69 (constants), p.68 and p.62 (thicknesses)',
    },
  }),
  // 1.60: ClearView 1.6 BlueGuard DuraVision Platinum UV (Z01539.FS1) pdf p.31: nd 1.595,
  // ne 1.598, νd 41, νe 40, density 1.31 (same on Z01537/Z01538/Z01568.FS1, pdf p.35/39/43).
  // Alternative: 1.30 g/cm³ on ZEISS Finished SV SPH UVProtect 1.6 HART (Z00596.FS2, pdf p.47).
  // pdf p.33–34: minus CT 1.2, plus ET 1.1.
  idx160: row({
    id: 'idx160',
    ne: 1.598,
    nd: 1.595,
    ve: 40,
    vd: 41,
    density: 1.31,
    minCT: 1.2,
    minET: 1.1,
    source: {
      doc: 'ZEISS ClearView lens specifications, ZEISS Finished SV ClearView 1.6 BlueGuard DuraVision Platinum UV (doc Z01539.FS1)',
      url: 'https://www.zeiss.com/content/dam/vis-b2b/usa/downloads/pdfs/clearview-lensspec.pdf',
      page: 'pdf p.31 (constants), p.33–34 (thicknesses)',
    },
  }),
  // 1.67: ZEISS Finished SV AS 1.67 BlueGuard DuraVision Platinum UV (Z01258.FS4) pdf p.7:
  // nd 1.659, ne 1.664, νd 32, νe 32, density 1.35 (ClearView 1.67 sheets: 1.36).
  // pdf p.10: 75 mm minus CT 1.20. minET 1.0 is ASSUMED (A5); this sheet's 65 mm plus rows
  // show ET 1.05 (pdf p.9).
  idx167: row({
    id: 'idx167',
    ne: 1.664,
    nd: 1.659,
    ve: 32,
    vd: 32,
    density: 1.35,
    minCT: 1.2,
    minET: 1.0,
    assumed: Object.freeze(['minET']),
    source: {
      doc: 'ZEISS FSV Fact Sheets, Version 6/23, ZEISS Finished SV AS 1.67 sheets (e.g. doc Z01258.FS4)',
      url: 'https://www.zeiss.com/content/dam/vis-b2b/usa/downloads/pdfs/fsv2023.pdf',
      page: 'pdf p.7–23',
    },
  }),
  // 1.74: ZEISS Finished SV AS 1.74 UVProtect DuraVision Platinum (Z00945.FS1) pdf p.4:
  // nd 1.731, ne 1.738, νd 32.6, νe 32, density 1.47. pdf p.6: 75 mm minus CT 1.10.
  // minET 1.0 is ASSUMED (A5).
  idx174: row({
    id: 'idx174',
    ne: 1.738,
    nd: 1.731,
    ve: 32,
    vd: 32.6,
    density: 1.47,
    minCT: 1.1,
    minET: 1.0,
    assumed: Object.freeze(['minET']),
    source: {
      doc: 'ZEISS FSV Fact Sheets, Version 6/23, ZEISS Finished SV AS 1.74 UVProtect DuraVision Platinum (doc Z00945.FS1)',
      url: 'https://www.zeiss.com/content/dam/vis-b2b/usa/downloads/pdfs/fsv2023.pdf',
      page: 'pdf p.4–6',
    },
  }),
});
