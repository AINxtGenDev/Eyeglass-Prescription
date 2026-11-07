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
  'rx.od': 'Rechtes Auge (R / OD)',
  'rx.os': 'Linkes Auge (L / OS)',
  'rx.sph.abbr': 'Sph',
  'rx.sph.title': 'Sphäre: der Kugelwert auf dem Brillenpass',
  'rx.sph.unit': '(dpt)',
  'rx.od.sph.label': 'Sph rechtes Auge in Dioptrien',
  'rx.os.sph.label': 'Sph linkes Auge in Dioptrien',
  // Zyl/Achse (RX-03); tooltips per PITFALLS "German (de-AT) Pitfalls".
  'rx.cyl.abbr': 'Zyl',
  'rx.cyl.title': 'Zylinder: Ausgleich einer Hornhautverkrümmung (Astigmatismus)',
  'rx.axis.abbr': 'Achse',
  'rx.axis.title': 'Achse: Richtung des Zylinders in Grad (0–180), nur zusammen mit Zyl',
  'rx.axis.unit': '(°)',
  'rx.od.cyl.label': 'Zyl rechtes Auge in Dioptrien',
  'rx.os.cyl.label': 'Zyl linkes Auge in Dioptrien',
  'rx.od.axis.label': 'Achse rechtes Auge in Grad',
  'rx.os.axis.label': 'Achse linkes Auge in Grad',
  'rx.forms': '{eye}: Minuszylinder: {minus} · Pluszylinder: {plus}',
  'rx.CYL_TRANSPOSED': 'Ihr Pluszylinder wurde in die Minuszylinder-Schreibweise umgerechnet.',
  'rx.AXIS_MISSING_FOR_CYL': 'Zu einem Zyl-Wert gehört eine Achse. Bitte die Achse vom Brillenpass eintragen (0 bis 180).',
  'rx.pd.header': 'PD (mm, je Auge)',

  // Field message tiers (02-03, RX-04, RX-05, D-07, D-08; UI-SPEC Copywriting "Rezept (Rx)").
  // {value}/{typed}/{min}/{max}/{suggestion} are formatted by format.js (numbers never live here).
  'val.tier.error': 'Fehler:',
  'val.tier.hint': 'Hinweis:',
  'val.tier.out-of-model': 'Außerhalb des Modells:',
  'val.VAL_OFF_STEP': 'Brillenwerte gehen meist in 0,25-Schritten. Meinten Sie {suggestion}?',
  'val.VAL_CONTACT_LENS':
    'Das sieht nach einem Kontaktlinsen-Wert aus (BC oder DIA). Hier gehören die Werte vom Brillenpass hin, nicht die der Kontaktlinsen.',
  'val.VAL_SPH_OUT_OF_MODEL':
    '{value} liegt außerhalb des berechneten Bereichs ({min} bis {max}). Für dieses Auge wird nichts berechnet.',
  'val.VAL_CYL_OUT_OF_MODEL':
    'Zyl {value} liegt außerhalb des berechneten Bereichs ({min} bis {max} in Minuszylinder-Schreibweise; Ihre Eingabe: {typed}). Für dieses Auge wird nichts berechnet.',
  'val.VAL_PD_OUT_OF_MODEL':
    'PD {value} liegt außerhalb des berechneten Bereichs ({min} bis {max} je Auge). Für dieses Auge wird nichts berechnet.',
  // Smart PD (02-04, RX-06, D-05; UI-SPEC Copywriting "Rezept (Rx)"). A question blocks the eye.
  'val.VAL_PD_QUESTION': 'Bis dahin wird für dieses Auge nichts berechnet.',
  'val.VAL_PD_CONFLICT':
    'Im anderen PD-Feld steht schon ein Wert für beide Augen ({value} für dieses Auge). Bitte nur ein Feld verwenden oder die Werte angleichen.',
  // Frame model ranges (FRAME-02); {field} is the literal term A, B or DBL.
  'val.VAL_FRAME_OUT_OF_MODEL':
    '{field} {value} liegt außerhalb des berechneten Bereichs ({min} bis {max}). Für beide Gläser wird nichts berechnet.',
  // Sph checked on the minus-cylinder form after a plus cylinder (RESEARCH Pitfall 8).
  'val.transposedSuffix': 'Der Wert gilt in Minuszylinder-Schreibweise; Ihre Eingabe: {typed}.',
  'val.contactLensSuffix': 'Falls das der Durchmesser (DIA) einer Kontaktlinse ist: Hier gehören die Werte vom Brillenpass hin.',
  'val.apply': '{suggestion} übernehmen',
  // Visible in card mode (02-03); the explanation moved into tip.pd.text.
  'rx.od.pd.label': 'PD rechtes Auge in Millimetern',
  'rx.os.pd.label': 'PD linkes Auge in Millimetern',
  // "±" before Sph and Zyl: the iOS decimal keypad has no minus key (RESEARCH Pitfall 3).
  'rx.sign.od.sph': 'Vorzeichen umkehren: Sph rechts',
  'rx.sign.od.cyl': 'Vorzeichen umkehren: Zyl rechts',
  'rx.sign.os.sph': 'Vorzeichen umkehren: Sph links',
  'rx.sign.os.cyl': 'Vorzeichen umkehren: Zyl links',
  // D-04 as changed by the UI-SPEC: Sph, Zyl and Achse only (RESEARCH Pitfall 9).
  'rx.same': 'Linkes Auge gleich wie rechtes (Sph, Zyl, Achse)',
  'rx.mirrored': 'übernommen von rechts',
  // Other values on the paper (RX-08, D-09). Add and prism are explained, not modelled (v1).
  'rx.other.summary': 'Auf meinem Rezept stehen noch andere Werte (Add, Prisma, HSA …)',
  'rx.other.intro':
    'Diese Seite zeigt ein einfaches Glas für die Ferne (kein Gleitsichtglas). Die folgenden Werte werden erklärt, aber nicht berechnet.',
  'rx.other.add.term': 'Add',
  'rx.other.add.text':
    'Zusatzwert für die Nähe (Lesebrille, Gleitsichtbrille). Wird hier nicht berechnet; gezeigt wird das Glas für die Ferne.',
  'rx.other.prism.term': 'Prisma / Basis',
  'rx.other.prism.text':
    'Ausgleich für das Zusammenspiel der Augen. Wird hier nicht berechnet; ein Prisma kann ein Glas an einer Seite dicker machen.',
  'rx.other.hsa.term': 'HSA',
  'rx.other.hsa.text': 'Hornhaut\u00ADscheitel\u00ADabstand: der Abstand zwischen Glas und Auge. Er ändert die Glasdicke nicht.',
  'rx.other.fn.term': 'F / N',
  'rx.other.fn.text': 'Ferne / Nähe: Stehen zwei Zeilen am Brillenpass, tragen Sie hier die Werte für die Ferne ein.',
  'rx.other.ep.term': 'EP / H',
  'rx.other.ep.text': 'Einschleifhöhe: wie hoch die Pupille im Glas sitzt. Wird in dieser Version nicht verwendet.',

  // Toggletips (UX-01, D-31; UI-SPEC "Toggletip texts"). name = the button's accessible name.
  'tip.sph.name': 'Erklärung: Sphäre',
  'tip.sph.text': 'Sphäre: der Hauptwert Ihrer Brille in Dioptrien. Minus bedeutet kurzsichtig, Plus bedeutet weitsichtig.',
  'tip.cyl.name': 'Erklärung: Zylinder',
  'tip.cyl.text':
    'Zylinder: gleicht eine Hornhaut\u00ADverkrümmung aus. Steht kein Zyl am Brillenpass, lassen Sie das Feld leer.',
  'tip.axis.name': 'Erklärung: Achse',
  'tip.axis.text':
    'Die Richtung des Zylinders in Grad (0 bis 180). Sie ist kein Wert für die Dicke und gehört immer zum Zyl.',
  'tip.pd.name': 'Erklärung: Pupillendistanz',
  'tip.pd.text':
    'Pupillen\u00ADdistanz: Abstand von der Nasenmitte zur Pupille, je Auge in Millimetern. Steht nur eine Zahl (z. B. 64) da, ist es der Wert für beide Augen zusammen.',

  // PD fields (02-04, RX-06, D-05, D-06). {value}/{total}/{half}/{od}/{os}/{pd} are fmtMm strings.
  'pd.PD_AMBIGUOUS':
    'Ist {value} der Wert für ein Auge oder für beide zusammen? Für ein Auge liegt die PD meist bei 25 bis 35 mm, für beide zusammen bei 51 bis 77 mm. Bitte auf dem Brillenpass nachsehen.',
  'pd.PD_DISTANCE_NEAR':
    'Zwei Werte über 50 mm sind meist die PD für die Ferne und für die Nähe. Bitte nur die PD für die Ferne eintragen (die größere Zahl).',
  'pd.PD_LOOKS_LIKE_HSA':
    'Ist das der HSA (Hornhaut\u00ADscheitel\u00ADabstand)? Die PD liegt meist bei 25 bis 35 mm je Auge.',
  'pd.binocularNote': '{total} Gesamt-PD → je {half}',
  'pd.pairNote': '{od} rechts, {os} links',
  'pd.assumed': 'PD angenommen: {pd} je Auge ({eyes}) – fragen Sie Ihren Optiker nach Ihrem Wert.',
  'pd.eyes.both': 'rechts und links',
  'pd.eyes.od': 'rechts',
  'pd.eyes.os': 'links',

  // Temple stamp (02-04, FRAME-03, D-11, D-12). The drawing is our own SVG.
  'stamp.label': 'Maße vom Brillenbügel',
  'stamp.hint': 'z. B. 52□18 140 – die ersten zwei Zahlen genügen.',
  'stamp.echo': 'Glasbreite {A} · Stegbreite {DBL}',
  'stamp.echoTemple': 'Glasbreite {A} · Stegbreite {DBL} (Bügellänge {temple}: wird nicht gebraucht)',
  'stamp.STAMP_INVALID': 'Bitte zwei oder drei Zahlen eingeben, z. B. 52□18 140 oder 52-18-140.',
  'stamp.STAMP_SWAPPED':
    'Die Zahlen scheinen vertauscht – meist steht die Glasbreite (40 bis 62 mm) zuerst. Meinten Sie {A}□{DBL}?',
  'stamp.help': 'Wo finde ich das?',
  'stamp.figcaption':
    'Die Zahlen stehen meist innen an einem Bügel: zuerst die Glasbreite, dann die Stegbreite, dann die Bügellänge, alle in Millimetern.',
  'stamp.svg.title': 'Bügel einer Brille mit den eingeprägten Maßen',
  'stamp.svg.desc':
    'Seitenansicht eines Brillenbügels. Eine Lupe vergrößert die Prägung 52□18 140: 52 ist die Glasbreite, 18 die Stegbreite, 140 die Bügellänge.',
  'stamp.svg.a': 'Glasbreite',
  'stamp.svg.dbl': 'Stegbreite',
  'stamp.svg.temple': 'Bügellänge',

  // Frame section (02-04, FRAME-01/02/03; UI-SPEC Copywriting "Fassung"). Shape outlines are model
  // shapes, not a specific product.
  'frame.title': 'Ihre Fassung',
  'frame.shape.legend': 'Form der Fassung',
  'frame.shape.rund': 'Rund',
  'frame.shape.rechteckig': 'Rechteckig',
  'frame.shape.panto': 'Panto',
  'frame.shape.pilot': 'Pilot',
  'frame.single': 'Einzelmaße in mm',
  'frame.a.label': 'A – Glasbreite (mm)',
  'frame.b.label': 'B – Glashöhe (mm)',
  'frame.dbl.label': 'DBL – Stegbreite (mm)',
  'frame.defaults': 'Standardmaße übernehmen (A {A} · B {B} · DBL {DBL})',
  'frame.bEstimated': '{B}, geschätzt aus der Form',
  'frame.bAssumed': 'Glashöhe B geschätzt: {B} aus der Form – für genauere Werte B messen oder beim Optiker erfragen.',
  'tip.stamp.name': 'Erklärung: Stempel',
  'tip.stamp.text':
    'Die Zahlen, die innen am Bügel eingeprägt sind: Glasbreite, Stegbreite und Bügellänge in Millimetern. Für die Rechnung genügen die ersten zwei.',
  'tip.a.name': 'Erklärung: Glasbreite A',
  'tip.a.text': 'Glasbreite: die Breite eines Glases in der Fassung, in Millimetern. Die erste Zahl am Bügel.',
  'tip.b.name': 'Erklärung: Glashöhe B',
  'tip.b.text': 'Glashöhe: die Höhe eines Glases in der Fassung. Steht selten am Bügel; wir schätzen sie aus der Form.',
  'tip.dbl.name': 'Erklärung: Stegbreite DBL',
  'tip.dbl.text': 'Stegbreite: der Abstand zwischen den beiden Gläsern über der Nase. Die zweite Zahl am Bügel.',

  // Material cards (02-07, D-14, UI-SPEC "Material"): index first, then a neutral descriptor.
  // Never imply that 1,74 is always better (PITFALLS Pitfall 8). material.<id> is the short label
  // used by the material line and the Technische Angaben case label.
  'material.title': 'Glasmaterial',
  'material.legend': 'Material nach Brechungs\u00ADindex',
  'material.hint':
    'Ein höherer Brechungsindex macht Minusgläser am Rand meist dünner. Was das bei Ihren Werten bringt, zeigt der Vergleich beim Ergebnis.',
  'material.abbeTerm': 'Was bedeutet die Abbe-Zahl?',
  'material.cr39': 'Kunststoff CR-39 (1,50)',
  'material.trivex': 'Trivex 1,53',
  'material.pc': 'Polycarbonat (1,59)',
  'material.idx160': 'Kunststoff 1,60',
  'material.idx167': 'Kunststoff 1,67',
  'material.idx174': 'Kunststoff 1,74',
  'material.cr39.title': '1,50 · Standard',
  'material.cr39.sub': 'Kunststoff CR-39 · Abbe-Zahl\u00A0{abbe}',
  'material.trivex.title': '1,53 · Trivex',
  'material.trivex.sub': 'leichtes Kunststoffmaterial · Abbe-Zahl\u00A0{abbe}',
  'material.pc.title': '1,59 · Polycarbonat',
  'material.pc.sub': 'Abbe-Zahl\u00A0{abbe}',
  'material.idx160.title': '1,60 · Höherbrechend',
  'material.idx160.sub': 'Kunststoff · Abbe-Zahl\u00A0{abbe}',
  'material.idx167.title': '1,67 · Hochbrechend',
  'material.idx167.sub': 'Kunststoff · Abbe-Zahl\u00A0{abbe}',
  'material.idx174.title': '1,74 · Höchstbrechend',
  'material.idx174.sub': 'Kunststoff · Abbe-Zahl\u00A0{abbe}',
  'tip.index.name': 'Erklärung: Brechungsindex',
  'tip.index.text':
    'Brechungs\u00ADindex: wie stark das Material Licht bricht. Ein höherer Wert braucht für dieselben Dioptrien weniger Material.',
  'tip.abbe.name': 'Erklärung: Abbe-Zahl',
  'tip.abbe.text': 'Je höher die Abbe-Zahl, desto weniger Farbsäume sieht man am Glasrand.',

  'result.title': 'Ergebnis je Glas',
  'result.ct': 'Mittendicke',
  'result.etmin': 'Dünnste Randdicke',
  'result.weight': 'Gewicht (pro Glas)',
  'result.status': 'Hinweis',
  'result.inputMissing': 'Bitte zuerst einen gültigen Sph-Wert eingeben.',
  'result.inputInvalid': 'Bitte zuerst die markierten Felder korrigieren.',
  // Blocked eye before its field message is due (RESEARCH Pitfall 5).
  'result.incomplete': 'Eingabe unvollständig …',
  'result.blocked': 'Für dieses Glas wird nichts berechnet. Bitte das markierte Feld korrigieren.',
  'result.blockedJump': 'Zum markierten Feld',
  'result.materialLine': '{eye}: {label}, Dichte {density}, Abbe-Zahl {abbe} (je höher, desto weniger Farbsäume)',
  // Text labels next to diagnostics (never colour alone).
  'result.diagLabel.impossible': 'Nicht herstellbar',
  'result.diagLabel.failed': 'Nicht berechenbar',
  'result.diagLabel.warn': 'Hinweis',
  // 01-15: a result not painted 50 ms after the input (RAIL feedback rule, ENG-09 (d)).
  'result.computing': 'rechnet …',
  'result.computingNote': 'rechnet … Die Werte gehören noch zur vorigen Eingabe.',
  // 02-01 result cards (RES-01, UI-SPEC Copywriting "Ergebnis").
  'result.card.od': 'Rechtes Glas (R)',
  'result.card.os': 'Linkes Glas (L)',
  'result.glass.od': 'Rechtes Glas',
  'result.glass.os': 'Linkes Glas',
  'result.side.od': 'rechte',
  'result.side.os': 'linke',
  'result.headline':
    '{glass}: am dicksten {thick} {thickLoc}, am dünnsten {etmin} {etminLoc}. Mitte {ct}, Gewicht {weight}.',
  'result.headline.uniformEdge': '{glass}: Rand ringsum {etmin} dick, Mitte {ct}. Gewicht {weight}.',
  'result.label.thick': 'Dickste Stelle',
  'result.label.etmin': 'Dünnste Stelle',
  'result.label.ct': 'Mitte (Mittendicke)',
  'result.label.weight': 'Gewicht',
  'result.weightUnder1': 'unter 1 g',
  'result.shortDisclaimer': 'Modellwerte – kein Ersatz für die Messung und Beratung beim Optiker.',
  'result.disclaimerJump': 'Zum Hinweis unten',
  'result.empty.heading': 'Noch kein Ergebnis für das {glass} Glas',
  'result.empty.body': 'Tragen Sie den Sph-Wert von Ihrem Brillenpass ein – das Ergebnis erscheint sofort.',
  // RES-04: {glass} is the thicker/heavier side, {other} the other one; the cause sentence follows.
  'result.lr.thicker': 'Das {glass} Glas ist an der dicksten Stelle {diff} dicker als das {other}',
  'result.lr.heavier': 'Das {glass} Glas ist {diff} schwerer als das {other}',
  'result.lr.cause.rx': '– weil die Rezeptwerte der beiden Augen verschieden sind.',
  'result.lr.cause.pd':
    '– weil die Pupillen\u00ADdistanz (PD) der beiden Augen verschieden ist: das Glas sitzt dadurch anders in der Fassung.',
  'result.lr.cause.rx-pd': '– weil Rezeptwerte und Pupillen\u00ADdistanz der beiden Augen verschieden sind.',
  'example.banner': 'Beispiel — ersetzen Sie die Werte durch Ihre eigenen.',
  'example.clear': 'Eigene Werte eingeben',
  'compute.failed.title': 'Berechnung abgebrochen',
  'compute.failed.explain':
    'Die Berechnung im Hintergrund ist fehlgeschlagen. Bitte einen Wert erneut ändern; hilft das nicht, die Seite neu laden.',

  // Lay location words (D-23); 'centre' = thickest point of a plus lens (B1).
  'loc.centre': 'in der Mitte',
  'loc.uniform': 'am ganzen Rand',
  'loc.nasal': 'innen (zur Nase)',
  'loc.temporal': 'außen (zur Schläfe)',
  'loc.superior': 'oben',
  'loc.inferior': 'unten',
  'loc.nasal-superior': 'innen oben',
  'loc.nasal-inferior': 'innen unten',
  'loc.temporal-superior': 'außen oben',
  'loc.temporal-inferior': 'außen unten',
  // Page layout and the phone/tablet summary bar (02-02, D-19, D-20). {thick}/{weight} are the
  // strings the result cards were painted with. bar.jump is the hidden start of the bar's name.
  'layout.results.region': 'Ergebnis und Vergleich',
  'bar.label': 'Dickste Stelle · Gewicht',
  'bar.eye': '{thick} · {weight}',
  'bar.values': 'R {od} | L {os}',
  'bar.jump': 'Zum Ergebnis:',

  // Experten-Ansicht suffix after the lay word, in parentheses (UI-SPEC "Location words (Expert suffix)").
  'loc.tech.centre': 'optischer Mittelpunkt',
  'loc.tech.uniform': 'rundum gleich',
  'loc.tech.nasal': 'nasal',
  'loc.tech.temporal': 'temporal',
  'loc.tech.superior': 'superior',
  'loc.tech.inferior': 'inferior',
  'loc.tech.nasal-superior': 'nasal-superior',
  'loc.tech.nasal-inferior': 'nasal-inferior',
  'loc.tech.temporal-superior': 'temporal-superior',
  'loc.tech.temporal-inferior': 'temporal-inferior',

  // Experten-Ansicht (02-02, D-32, UX-02, ANA-02). The hint names only what the switch shows today;
  // later phase-2 plans extend it with their Expert blocks.
  'expert.switch': 'Experten-Ansicht',
  'expert.hint':
    'Zeigt zusätzlich die Zwischenwerte: Dezentration, Basiskurve, Rückfläche, Radien, Pfeilhöhen, festlegende Mindestdicke und das Gewicht auf 0,1 g.',
  'expert.tag': 'Experten-Ansicht',
  'expert.analysis.title': 'Experten-Analyse',
  'expert.zw.title': 'Zwischenwerte',
  'expert.zw.dec': 'Dezen\u00ADtration (zur Nase)',
  'expert.zw.etmax': 'Dickster Rand',
  'expert.zw.basecurve': 'Basiskurve D1',
  'expert.zw.d2': 'Rückfläche D2 (Hauptschnitte)',
  'expert.zw.radii': 'Radien',
  'expert.zw.sags': 'Pfeilhöhen',
  'expert.zw.binding': 'Festlegende Mindestdicke',
  'expert.zw.weight': 'Gewicht (0,1 g)',
  'expert.zw.d2.value': '{a} / {b}',
  'expert.zw.radii.value': 'Vorderfläche R1 {r1} · Rückfläche Ra {ra}, Rb {rb}',
  'expert.zw.plano': 'plan',
  // Sag at a named outline point: front and back surface, mm toward the eye from each vertex plane.
  'expert.zw.sags.point': '{where}: vorne {front}, hinten {back}',
  'expert.binding.minCT': 'Die Mittendicke ist durch den Mindestwert festgelegt.',
  'expert.binding.minET': 'Die Mittendicke ergibt sich aus der Mindest-Randdicke.',

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
  // {where} = tech.where.* (01-15: the bench runs in the worker, or on the page in the fallback).
  'tech.timing': 'Rechenzeit {where}, Normalfall ({case}): Median {median}, p{pct} {tail} ({runs} Läufe)',
  'tech.timingFrame':
    'Rechenzeit {where}, Normalfall mit geänderter Fassungsbreite (Form neu berechnet): Median {median}, p{pct} {tail} ({runs} Läufe)',
  'tech.timingWorst':
    'Rechenzeit {where}, Grenzfall ({case}; langsamster Fall unter den 1000 geprüften Zufallspaaren): Median {median}, p{pct} {tail} ({runs} Läufe)',
  'tech.timingRescan':
    'Rechenzeit {where}, seltener Fall mit erweiterter Suche ({case}): Median {median}, p{pct} {tail} ({runs} Läufe)',
  'tech.measuring': 'wird gemessen …',
  'tech.benchFailed': 'Messung abgebrochen',
  'tech.where.worker': 'im Hintergrund',
  'tech.where.sync': 'direkt auf der Seite',
  'tech.mode.worker': 'Rechenweg: im Hintergrund (Web Worker); Eingaben bleiben flüssig.',
  'tech.mode.sync':
    'Rechenweg: direkt auf der Seite, weil der Hintergrund-Rechner (Web Worker) nicht startet. Ein schwerer Fall kann die Eingabe dabei einmal kurz stocken lassen.',
  'tech.mode.syncTimeout':
    'Rechenweg: direkt auf der Seite, weil der Hintergrund-Rechner (Web Worker) nicht geantwortet hat. Ein schwerer Fall kann die Eingabe dabei einmal kurz stocken lassen.',
  'tech.case': '{rx}, {material}, {shape} {A} × {B}, DBL {dbl}, PD {pd}',
  'tech.caseFh': ', Einschleifhöhe {fh}',
  // Main-thread timing (01-15): every frame an input causes, including style, layout and paint.
  'tech.inputRender':
    'Eingabe bis Reaktion (letzte {n} Eingaben): Median {reactMed}, längste {reactMax}; Hauptthread je Eingabe einschließlich Darstellung: Median {mainMed}, längste {mainMax}',
  'tech.result':
    'Eingabe bis Ergebnis sichtbar (letzte {n} Ergebnisse): Median {med}, längste {max}; Darstellung des Ergebnisses längstens {renderMax}; davon Rechnen: Median {compute}',
  'tech.busy': '„rechnet …“ angezeigt seit dem Laden: {count}-mal; längste Wartezeit auf ein Ergebnis: {longest}',
  'tech.eventTiming': 'Längste Interaktion laut Browser-Messung (Event Timing, letzte {n}): {max}',
  'tech.eventTimingEmpty': 'Browser-Messung (Event Timing): keine Interaktion über {threshold}',
  'tech.eventTimingNone': 'Browser-Messung (Event Timing): nicht verfügbar',
  'tech.rerun': 'Erneut messen',
  'tech.ua': 'Browser: {ua}',

  'footer.version': 'Version',

  'disclaimer.title': 'Wichtiger Hinweis',
  'disclaimer.body': 'Diese Seite ist eine Lernhilfe: eine vereinfachte Veranschaulichung, kein Ersatz für die Messung und Beratung beim Optiker. Alle Zahlen sind Modellwerte. Das Modell rechnet mit einer sphärischen Vorderfläche, nicht mit asphärischen Herstellerdesigns, und die Rückfläche ist in diesem Modell nie nach außen gewölbt. Die Basiskurve wird so gewählt, dass das Glas in diesem Modell nahezu so dünn wie möglich wird (höchstens 0,1 mm dicker), mit der flachsten Vorderfläche unter diesen (Vorderfläche mindestens +0,50 dpt). Optiker und Hersteller wählen die Kurve auch nach Abbildungsqualität und Aussehen; echte Gläser können deshalb dicker sein – bei Plusgläsern in der Mitte um bis zu etwa 0,4 mm (verglichen mit Zeiss-Lagergläsern bis +6 dpt), bei stärkeren Plusgläsern möglicherweise mehr; bei starken Minusgläsern in großen Fassungen am Rand um einige Millimeter (oder mit asphärischen Gläsern dünner). Die Mindestdicken sind typische Herstellerwerte; die Fertigungstoleranz der Mittendicke beträgt laut Hersteller bis zu ±0,3 mm. Prismen, Addition und Gleitsichtgläser werden nicht berücksichtigt; Rohglasdurchmesser und Facettenlage sind nicht modelliert.',
});
