// German (de-AT) dictionary: the single source of every visible string.
// Thickness is always "Mittendicke"/"Randdicke" (see PITFALLS de-AT). Numbers are never
// inside these strings; the UI formats them and passes them as {params}.
// Plan 01-03 adds the page keys; plan 01-10 adds the diagnostic texts.
export default Object.freeze({
  'app.title': 'Brillenglas-Rechner – Dicke und Gewicht',

  'parse.PARSE_EMPTY': 'Bitte einen Wert eingeben.',
  'parse.PARSE_NOT_A_NUMBER':
    'Das ist keine gültige Zahl. Erlaubt sind Ziffern, ein Vorzeichen und ein Komma, z. B. −2,25.',
  'parse.PARSE_MIXED_SEPARATORS': 'Bitte nur ein Dezimalzeichen verwenden, z. B. −2,25.',
  'parse.PARSE_TOO_MANY_DECIMALS':
    'Zu viele Nachkommastellen: Dioptrien haben höchstens zwei (z. B. −2,25), Millimeter höchstens eine (z. B. 32,5).',
  'parse.PARSE_AXIS_OUT_OF_RANGE': 'Die Achse muss eine ganze Zahl zwischen 0° und 180° sein.',

  'rx.caption': 'Ihre Brillenwerte (vom Brillenpass)',
  'rx.eye': 'Auge',
  'rx.od': 'R – rechtes Auge',
  'rx.os': 'L – linkes Auge',
  'rx.sph.abbr': 'Sph',
  'rx.sph.title': 'Sphäre: der Kugelwert auf dem Brillenpass',
  'rx.sph.unit': '(dpt)',
  'rx.sph.label': 'Tippen Sie den Sph-Wert so ein, wie er auf dem Brillenpass steht, z. B. −2,25 oder +1.',
  'rx.od.sph.label': 'Sph rechtes Auge in Dioptrien',
  'rx.os.sph.label': 'Sph linkes Auge in Dioptrien',
  'rx.pd.header': 'PD (mm, je Auge)',
  'rx.od.pd.label': 'PD rechtes Auge in Millimetern (Abstand Nasenmitte bis Pupille)',
  'rx.os.pd.label': 'PD linkes Auge in Millimetern (Abstand Nasenmitte bis Pupille)',

  // Frame (FRAME-01). Shape outlines are model shapes, not a specific product.
  'frame.legend': 'Fassung',
  'frame.shape.label': 'Form der Fassung',
  'frame.shape.rund': 'Rund',
  'frame.shape.rechteckig': 'Rechteckig',
  'frame.shape.panto': 'Panto',
  'frame.shape.pilot': 'Pilot',
  'frame.a.label': 'A – Glasbreite (mm)',
  'frame.b.label': 'B – Glashöhe (mm)',
  'frame.dbl.label': 'DBL – Stegbreite (mm)',
  'frame.hint':
    'Glasbreite und Stegbreite stehen meist innen am Bügel, z. B. „52□18 145“: 52 mm Glasbreite, 18 mm Stegbreite. Die Glashöhe steht dort selten; beim Wechsel der Form werden typische Werte vorgeschlagen.',

  // Option labels per MATERIALS id. Never imply that 1,74 is always better (PITFALLS Pitfall 8).
  'material.label': 'Material (Brechungsindex)',
  'material.hint':
    'Ein höherer Brechungsindex macht Minusgläser am Rand dünner. Ob sich das lohnt, hängt von Ihren Werten und der Fassung ab – vergleichen Sie die Zahlen unten.',
  'material.cr39': 'Kunststoff CR-39 (1,50)',
  'material.trivex': 'Trivex 1,53',
  'material.pc': 'Polycarbonat (1,59)',
  'material.idx160': 'Kunststoff 1,60',
  'material.idx167': 'Kunststoff 1,67',
  'material.idx174': 'Kunststoff 1,74',

  'result.title': 'Ergebnis je Glas',
  'result.ct': 'Mittendicke',
  'result.etmax': 'Dickste Randdicke',
  'result.etmin': 'Dünnste Randdicke',
  'result.weight': 'Gewicht (pro Glas)',
  'result.basecurve': 'Basiskurve (Vorderfläche)',
  'result.status': 'Hinweis',
  'result.inputMissing': 'Bitte zuerst einen gültigen Sph-Wert eingeben.',
  'result.inputInvalid': 'Bitte zuerst die markierten Felder korrigieren.',
  'result.dec': 'Dezentration (zur Nase)',
  'result.materialLine': '{eye}: {label}, Dichte {density}',
  'result.notComputable': 'Dieses Glas lässt sich so nicht berechnen (Code {code}).',

  'loc.nasal': 'nasal (zur Nase)',
  'loc.temporal': 'schläfenseitig (außen)',
  'loc.superior': 'oben',
  'loc.inferior': 'unten',
  'loc.nasal-superior': 'oben, zur Nase',
  'loc.nasal-inferior': 'unten, zur Nase',
  'loc.temporal-superior': 'oben, schläfenseitig',
  'loc.temporal-inferior': 'unten, schläfenseitig',

  // D-01 final: the automatic curve is the thinnest computable front; Vogel is a reference only.
  'basecurve.rule.thinnest': 'so gewählt, dass das Glas möglichst dünn wird',
  'basecurve.rule.manual': 'von Ihnen vorgegeben',
  'basecurve.vogelRef': '(zum Vergleich: übliche Faustregel nach Vogel {vogel})',

  'tech.summary': 'Technische Angaben',
  'tech.timing': 'Rechenzeit beide Gläser: Median {median}, p95 {p95} (50 Läufe)',
  'tech.timingWorst':
    'Rechenzeit Grenzfall (+12,00 dpt, PD 10 mm, viele Rechenschritte): Median {median}, p95 {p95} (50 Läufe)',
  'tech.inputRender': 'Letzte Eingabe bis Anzeige: {ms}',
  'tech.rerun': 'Erneut messen',
  'tech.ua': 'Browser: {ua}',

  'footer.version': 'Version',

  'disclaimer.title': 'Wichtiger Hinweis',
  'disclaimer.body': 'Diese Seite ist eine Lernhilfe: eine vereinfachte Veranschaulichung, kein Ersatz für die Messung und Beratung beim Optiker. Alle Zahlen sind Modellwerte. Das Modell rechnet mit einer sphärischen Vorderfläche, nicht mit asphärischen Herstellerdesigns. Die Basiskurve wird so gewählt, dass das Glas in diesem Modell möglichst dünn wird (Vorderfläche mindestens +0,50 dpt). Optiker und Hersteller wählen die Kurve auch nach Abbildungsqualität und Aussehen; echte Gläser können deshalb dicker sein – bei starken Minusgläsern in großen Fassungen um einige Millimeter (oder mit asphärischen Gläsern dünner). Die Mindestdicken sind typische Herstellerwerte; die Fertigungstoleranz der Mittendicke beträgt laut Hersteller bis zu ±0,3 mm. Prismen, Addition und Gleitsichtgläser werden nicht berücksichtigt; Rohglasdurchmesser und Facettenlage sind nicht modelliert.',
});
