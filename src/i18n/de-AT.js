// German (de-AT) dictionary: the single source of every visible string.
// Thickness is always "Mittendicke"/"Randdicke" (see PITFALLS de-AT). Numbers are never
// inside these strings; the UI formats them and passes them as {params}.
export default Object.freeze({
  'app.title': 'Brillenglas-Rechner – Dicke und Gewicht',

  'parse.PARSE_EMPTY': 'Bitte einen Wert eingeben.',
  'parse.PARSE_NOT_A_NUMBER':
    'Das ist keine gültige Zahl. Erlaubt sind Ziffern, ein Vorzeichen und ein Komma, z. B. −2,25.',
  'parse.PARSE_MIXED_SEPARATORS': 'Bitte nur ein Dezimalzeichen verwenden, z. B. −2,25.',
  'parse.PARSE_TOO_MANY_DECIMALS':
    'Zu viele Nachkommastellen: Dioptrien haben höchstens zwei (z. B. −2,25), Millimeter höchstens eine (z. B. 32,5).',
  'parse.PARSE_AXIS_OUT_OF_RANGE': 'Die Achse muss eine ganze Zahl zwischen 0° und 180° sein.',
  'parse.PARSE_AXIS_INVALID':
    'Die Achse ist eine ganze Gradzahl ohne Vorzeichen und ohne Komma, von 0° bis 180°, z. B. 90.',

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
  // Zyl/Achse (RX-03); tooltips per PITFALLS "German (de-AT) Pitfalls".
  'rx.cyl.abbr': 'Zyl',
  'rx.cyl.title': 'Zylinder: Ausgleich einer Hornhautverkrümmung (Astigmatismus)',
  'rx.cyl.label':
    'Zyl leer lassen, wenn auf dem Brillenpass keiner steht. Ein Pluszylinder (z. B. +2,00) wird automatisch umgerechnet.',
  'rx.axis.abbr': 'Achse',
  'rx.axis.title': 'Achse: Richtung des Zylinders in Grad (0–180), nur zusammen mit Zyl',
  'rx.axis.unit': '(°)',
  'rx.axis.label': 'Die Achse ist eine Richtung in Grad (0 bis 180), kein Wert für die Glasdicke. Sie gehört immer zum Zyl.',
  'rx.od.cyl.label': 'Zyl rechtes Auge in Dioptrien',
  'rx.os.cyl.label': 'Zyl linkes Auge in Dioptrien',
  'rx.od.axis.label': 'Achse rechtes Auge in Grad',
  'rx.os.axis.label': 'Achse linkes Auge in Grad',
  'rx.forms': '{eye}: Minuszylinder: {minus} · Pluszylinder: {plus}',
  'rx.CYL_TRANSPOSED': 'Ihr Pluszylinder wurde in die Minuszylinder-Schreibweise umgerechnet.',
  'rx.AXIS_MISSING_FOR_CYL': 'Zu einem Zyl-Wert gehört eine Achse. Bitte die Achse vom Brillenpass eintragen (0 bis 180).',
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
  'result.materialLine': '{eye}: {label}, Dichte {density}, Abbe-Zahl {abbe} (je höher, desto weniger Farbsäume)',
  // Text labels next to diagnostics (never colour alone).
  'result.diagLabel.impossible': 'Nicht herstellbar',
  'result.diagLabel.failed': 'Nicht berechenbar',
  'result.diagLabel.warn': 'Hinweis',

  'loc.nasal': 'nasal (zur Nase)',
  'loc.temporal': 'schläfenseitig (außen)',
  'loc.superior': 'oben',
  'loc.inferior': 'unten',
  'loc.nasal-superior': 'oben, zur Nase',
  'loc.nasal-inferior': 'unten, zur Nase',
  'loc.temporal-superior': 'oben, schläfenseitig',
  'loc.temporal-inferior': 'unten, schläfenseitig',

  // D-01 final + D-C (01-12): the flattest front within τ = 0,1 mm of the thinnest; Vogel is a reference only.
  'basecurve.rule.thinnest':
    'so gewählt, dass das Glas nahezu so dünn wie möglich wird (höchstens 0,1 mm mehr als das dünnste), mit der flachsten Vorderfläche unter diesen',
  'basecurve.rule.manual': 'von Ihnen vorgegeben',
  'basecurve.vogelClamped': ', begrenzt auf {clamped}',
  'basecurve.vogelRef': '(zum Vergleich: übliche Faustregel nach Vogel {vogel})',
  'basecurve.vogelRefThicker':
    '(zum Vergleich: übliche Faustregel nach Vogel {vogel}; damit wäre das Glas an der dicksten Stelle {thickness} dick)',
  'basecurve.vogelRefImpossible':
    '(zum Vergleich: übliche Faustregel nach Vogel {vogel}; damit ließe sich das Glas in diesem Modell nicht berechnen)',

  // ENG-07 diagnostics (L10N-01/02): one title/explain/suggest per code of DIAGNOSTICS.
  // Every suggestion is backed by a test in src/engine/diagnostics.test.js (T-01-13).
  // Params are engine numbers formatted by the UI (fmtMm).
  'diag.FRONT_SAG_UNDEFINED.title': 'Dieses Glas ist so nicht herstellbar',
  'diag.FRONT_SAG_UNDEFINED.explain':
    'Mit der gewählten Basiskurve wäre die Vorderfläche ein Ausschnitt einer Kugel mit dem Radius {R1}. Der Rand der Fassung liegt aber bis zu {rhoMax} vom optischen Mittelpunkt entfernt – weiter, als diese Kugel reicht. Die Vorderfläche kann das Glas deshalb nicht ganz bedecken.',
  'diag.FRONT_SAG_UNDEFINED.suggest':
    'Wählen Sie eine flachere Basiskurve, eine kleinere Fassung oder ein höherbrechendes Material (z. B. 1,74).',
  'diag.BACK_SAG_UNDEFINED.title': 'Dieses Glas ist so nicht herstellbar',
  'diag.BACK_SAG_UNDEFINED.explain':
    'In diesem Rechenmodell (Vorderfläche zwischen +0,50 und +14,00 dpt) lässt sich dieses Glas nicht herstellen: Für Ihre Werte müsste die Rückfläche in mindestens einer Richtung (meist der Richtung mit der größeren Korrektur) so stark gekrümmt sein, dass sie den Rand der Fassung in dieser Richtung nicht mehr erreicht – mit jeder erlaubten Vorderfläche. Die Untergrenze von +0,50 dpt ist eine Annahme dieses Modells, keine Grenze der Fertigung; manche Hersteller verwenden noch flachere Vorderflächen.',
  'diag.BACK_SAG_UNDEFINED.suggest':
    'Wählen Sie eine kleinere, vor allem weniger hohe bzw. weniger breite Fassung oder ein höherbrechendes Material (z. B. 1,74).',
  // 01-12: only reached when no front up to +14,00 gives a computable lens with a non-convex back
  // (tested for +16 rund 40/18/32; a manual front of +14,50 computes there, which backs the text).
  'diag.BACK_SURFACE_CONVEX.title': 'In diesem Rechenmodell nicht berechenbar',
  'diag.BACK_SURFACE_CONVEX.explain':
    'In diesem Rechenmodell ist die Rückfläche (die Seite zum Auge) nie nach außen gewölbt. Für eine so starke Pluskorrektur wäre das aber mit jeder erlaubten Vorderfläche (+0,50 bis +14,00 dpt) nötig, oder das Glas ließe sich in dieser Fassung gar nicht berechnen. Nötig wäre eine Vorderfläche, die stärker gekrümmt ist als +14,00 dpt; das liegt außerhalb des Bereichs dieses Modells.',
  'diag.BACK_SURFACE_CONVEX.suggest':
    'Für sehr starke Plusgläser verwenden Hersteller besondere Glasformen, die dieses Modell nicht abbildet. Fragen Sie Ihren Optiker, welche Gläser für Sie möglich sind.',
  'diag.VERTEX_TERM_INVALID.title': 'Berechnung nicht möglich',
  'diag.VERTEX_TERM_INVALID.explain':
    'Für diese Werte stößt das Rechenmodell an eine interne Grenze: Die Glasdicke wäre im Verhältnis zur Krümmung der Vorderfläche zu groß. Damit keine falschen Zahlen erscheinen, wird nichts angezeigt.',
  'diag.VERTEX_TERM_INVALID.suggest':
    'Prüfen Sie die Eingaben. Wenn sie stimmen, kann Ihnen Ihr Optiker sagen, welche Gläser möglich sind.',
  'diag.THICK_LENS_NOT_CONVERGED.title': 'Berechnung nicht möglich',
  'diag.THICK_LENS_NOT_CONVERGED.explain':
    'Die Rechnung für die Glasdicke ist zu keinem stabilen Ergebnis gekommen – eine interne Grenze dieses Rechenmodells. Damit keine falschen Zahlen erscheinen, wird nichts angezeigt.',
  'diag.THICK_LENS_NOT_CONVERGED.suggest':
    'Prüfen Sie die Eingaben. Wenn sie stimmen, kann Ihnen Ihr Optiker sagen, welche Gläser möglich sind.',
  'diag.NON_FINITE_RESULT.title': 'Berechnung nicht möglich',
  'diag.NON_FINITE_RESULT.explain':
    'Die Rechnung hat einen ungültigen Zahlenwert ergeben – eine interne Grenze dieses Rechenmodells. Damit keine falschen Zahlen erscheinen, wird nichts angezeigt.',
  'diag.NON_FINITE_RESULT.suggest':
    'Prüfen Sie die Eingaben. Wenn sie stimmen, kann Ihnen Ihr Optiker sagen, welche Gläser möglich sind.',
  'diag.INVALID_SPEC.title': 'Berechnung nicht möglich',
  'diag.INVALID_SPEC.explain':
    'Die Eingaben ergeben keine vollständige Angabe für die Berechnung. Das ist eine interne Prüfung dieses Rechners.',
  'diag.INVALID_SPEC.suggest': 'Prüfen Sie alle Felder und laden Sie die Seite bei Bedarf neu.',
  'diag.OC_OUTSIDE_OUTLINE.title': 'Optischer Mittelpunkt außerhalb des Glases',
  'diag.OC_OUTSIDE_OUTLINE.explain':
    'Mit diesen Werten liegt der optische Mittelpunkt (die Stelle, durch die Sie geradeaus blicken) außerhalb der Glasform. Die Zahlen sind berechnet, ein solches Glas ist aber ungewöhnlich.',
  'diag.OC_OUTSIDE_OUTLINE.suggest': 'Prüfen Sie PD und Fassungsmaße.',
  'diag.BLANK_EXCEEDS_STOCK.title': 'Großes Rohglas nötig',
  'diag.BLANK_EXCEEDS_STOCK.explain':
    'Für dieses Glas braucht es ein Rohglas mit mindestens etwa {mbsMm} Durchmesser; übliche Lagergläser haben höchstens {stockMm}. Es ist daher meist eine Sonderanfertigung und kann dicker oder teurer sein als hier gezeigt.',
  'diag.BLANK_EXCEEDS_STOCK.suggest':
    'Eine kleinere Fassung, deren Glasmitte näher an Ihrer Pupille liegt, braucht ein kleineres Rohglas.',
  'diag.CT_SET_BY_MIN_CT.title': 'Mittendicke durch Mindestdicke bestimmt',
  'diag.CT_SET_BY_MIN_CT.explain':
    'Die Mittendicke ist die kleinste Mittendicke, die der Hersteller für dieses Material angibt.',
  'diag.CT_SET_BY_MIN_CT.suggest': 'Keine Eingabe nötig; das ist ein Hinweis zur Berechnung.',
  'diag.CT_SET_BY_MIN_ET.title': 'Mittendicke durch Mindest-Randdicke bestimmt',
  'diag.CT_SET_BY_MIN_ET.explain':
    'Die Mittendicke ist so gewählt, dass die dünnste Stelle am Rand die Mindest-Randdicke des Herstellers erreicht.',
  'diag.CT_SET_BY_MIN_ET.suggest': 'Keine Eingabe nötig; das ist ein Hinweis zur Berechnung.',

  'tech.summary': 'Technische Angaben',
  // Bench readouts (01-14): numbers and the case come in as parameters, never as text (MINOR-5).
  'tech.timing': 'Rechenzeit Normalfall ({case}): Median {median}, p{pct} {tail} ({runs} Läufe)',
  'tech.timingFrame':
    'Rechenzeit Normalfall mit geänderter Fassungsbreite (Form neu berechnet): Median {median}, p{pct} {tail} ({runs} Läufe)',
  'tech.timingWorst':
    'Rechenzeit Grenzfall ({case}; langsamster gemessener Fall): Median {median}, p{pct} {tail} ({runs} Läufe)',
  'tech.case': '{rx}, {material}, {shape} {A} × {B}, DBL {dbl}, PD {pd}',
  'tech.caseFh': ', Einschleifhöhe {fh}',
  'tech.inputRender':
    'Eingabe bis Anzeige (Median der letzten {n} Eingaben): Rechenarbeit {work}, Wartezeit inklusive {latency}',
  'tech.rerun': 'Erneut messen',
  'tech.ua': 'Browser: {ua}',

  'footer.version': 'Version',

  'disclaimer.title': 'Wichtiger Hinweis',
  'disclaimer.body': 'Diese Seite ist eine Lernhilfe: eine vereinfachte Veranschaulichung, kein Ersatz für die Messung und Beratung beim Optiker. Alle Zahlen sind Modellwerte. Das Modell rechnet mit einer sphärischen Vorderfläche, nicht mit asphärischen Herstellerdesigns, und die Rückfläche ist in diesem Modell nie nach außen gewölbt. Die Basiskurve wird so gewählt, dass das Glas in diesem Modell nahezu so dünn wie möglich wird (höchstens 0,1 mm dicker), mit der flachsten Vorderfläche unter diesen (Vorderfläche mindestens +0,50 dpt). Optiker und Hersteller wählen die Kurve auch nach Abbildungsqualität und Aussehen; echte Gläser können deshalb dicker sein – bei Plusgläsern in der Mitte um bis zu etwa 0,4 mm (verglichen mit Zeiss-Lagergläsern bis +6 dpt), bei stärkeren Plusgläsern möglicherweise mehr; bei starken Minusgläsern in großen Fassungen am Rand um einige Millimeter (oder mit asphärischen Gläsern dünner). Die Mindestdicken sind typische Herstellerwerte; die Fertigungstoleranz der Mittendicke beträgt laut Hersteller bis zu ±0,3 mm. Prismen, Addition und Gleitsichtgläser werden nicht berücksichtigt; Rohglasdurchmesser und Facettenlage sind nicht modelliert.',
});
