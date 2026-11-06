// MAT-01 materials. The engine uses `ne` (e-line index), never `nd`.
//
// CORRECTION (RESEARCH "Materials"): PITFALLS.md lists CR-39 ne 1.502. Some Zeiss 1.5 sheets
// (PhotoFusion, BlueGuard) do state ne 1.502, but the three spherical sheets used as fixtures
// state nd 1.499 / ne 1.500. 1.500 is used because it matches the fixture sheets (the BVP check
// closes to 0.023 D with it). Plan 01-06 adds the other four materials.

export const MATERIALS = Object.freeze({
  cr39: Object.freeze({
    id: 'cr39',
    ne: 1.5,
    nd: 1.499,
    ve: 56,
    vd: 58,
    density: 1.32, // g/cm³
    minCT: 1.8, // mm, all minus rows of the sheet
    minET: 1.0, // mm, plus rows 65/70 mm
    source: Object.freeze({
      doc: 'ZEISS Finished Single Vision Fact Sheets, Version 6/23, synchrony Finished SV SPH 1.5 HC (doc 00523.FS1)',
      url: 'https://www.zeiss.com/content/dam/vis-b2b/usa/downloads/pdfs/fsv2023.pdf',
      page: 'doc p.124/132/140',
    }),
  }),
});
