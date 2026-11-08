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
  // Expert fields (02-10, MAT-03, MAT-04): out of range is never clamped and blocks both eyes.
  'val.VAL_BASECURVE_OUT_OF_MODEL':
    'Basiskurve {value} liegt außerhalb des berechneten Bereichs ({min} bis {max}). Für beide Gläser wird nichts berechnet.',
  'val.VAL_MINTHICKNESS_OUT_OF_MODEL':
    '{value} liegt außerhalb des berechneten Bereichs ({min} bis {max}). Für beide Gläser wird nichts berechnet.',
  // 02-11 (MAT-05): k = 0 is chosen with 'sphärisch'; only the cited −5,0…−1,0 is computed.
  'val.VAL_CONIC_OUT_OF_MODEL':
    'k {value} liegt außerhalb des berechneten Bereichs ({min} bis {max}). Für eine Kugelfläche „sphärisch“ wählen. Für beide Gläser wird nichts berechnet.',
  // 02-11 (FRAME-02): the rim depth never blocks an eye; only the rim line is not shown.
  'val.VAL_RIMDEPTH_OUT_OF_MODEL':
    'Randtiefe {value} liegt außerhalb des Bereichs ({min} bis {max}). Die Dicke und das Gewicht ändern sich dadurch nicht.',
  // 02-12 (MAT-06): {field} is material.custom.field.*; {value}/{min}/{max} plain numbers.
  'val.VAL_CUSTOM_OUT_OF_RANGE':
    '{field} {value} liegt außerhalb des zulässigen Bereichs ({min} bis {max}). Für beide Gläser wird nichts berechnet.',
  'val.VAL_CUSTOM_IMPLAUSIBLE':
    '{field} {value} ist ungewöhnlich (üblich {min} bis {max}). Bitte prüfen Sie den Wert; es wird damit gerechnet.',
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
  'rx.sign.expert-k': 'Vorzeichen umkehren: konische Konstante k',
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
  // 02-11 (FRAME-02, UI-SPEC "Randtiefe"): display only, never in the LensSpec.
  'frame.rim.label': 'Randtiefe der Fassung (mm)',
  'frame.rim.note': 'Standard {value} (angenommener Wert, keine Herstellerangabe). Die Randtiefe ändert Dicke und Gewicht nicht.',
  // {glass} = result.glass.*; {front}/{back} = fmtMm(bevelSplit(etMax.value, depth)) (03-01, D-05):
  // uses etMax, never the centre; a side ≤ 0,05 mm is 'bündig'.
  'frame.rim.both': '{glass}: Der Glasrand steht an seiner dicksten Stelle vorne {front} und hinten {back} aus der Fassung.',
  'frame.rim.front': '{glass}: Der Glasrand steht an seiner dicksten Stelle vorne {front} aus der Fassung, hinten ist er bündig.',
  'frame.rim.back': '{glass}: Der Glasrand steht an seiner dicksten Stelle hinten {back} aus der Fassung, vorne ist er bündig.',
  'frame.rim.fits': '{glass}: Der Glasrand passt in die Tiefe der Fassung.',
  'frame.rim.bevel': 'Die Aufteilung nach vorne und hinten ist angenommen: Facette bei einem Drittel der Randdicke von vorne.',
  // lens-critic MAJOR 1: {lead} = fmtMm(frontLeadMm(...).value); ≤ 0,05 mm → leadNone.
  'frame.rim.lead': '{glass}: Die Vorderfläche wölbt sich bis zu {lead} vor die Fassung.',
  'frame.rim.leadNone': '{glass}: Die Vorderfläche wölbt sich nicht vor die Fassung.',
  'tip.rim.name': 'Erklärung: Randtiefe',
  'tip.rim.text': 'Wie tief der Rand der Fassung ist, der das Glas hält. Ein dickerer Glasrand steht vorne oder hinten heraus.',

  // Material cards (02-07, D-14, UI-SPEC "Material"): index first, then a neutral descriptor.
  // Never imply that 1,74 is always better (PITFALLS Pitfall 8). material.<id> is the short label
  // used by the material line and the Technische Angaben case label.
  'material.title': 'Glasmaterial',
  'material.legend': 'Material nach Brechungs\u00ADindex',
  'material.hint':
    'Ein höherer Brechungsindex macht Minusgläser am Rand meist dünner. Was das bei Ihren Werten bringt, zeigt der Vergleich beim Ergebnis.',
  'material.abbeTerm': 'Was bedeutet die Abbe-Zahl?',
  // 02-12 (MAT-06, D-17, UI-SPEC Copywriting "Material Expert"): Experten-Ansicht only.
  'material.custom': 'Eigenes Material',
  'material.custom.title': 'Eigenes Material',
  'material.custom.sub': 'Werte selbst eingeben',
  'material.custom.label': 'beruht auf Ihren Angaben, kein geprüftes Material',
  'material.custom.onlyExpert': 'Eigenes Material gilt nur in der Experten-Ansicht. Es wird wieder {material} verwendet.',
  'material.custom.legend': 'Werte des eigenen Materials',
  'material.custom.ne.label': 'Brechungsindex nₑ',
  'material.custom.density.label': 'Dichte (g/cm³)',
  'material.custom.abbe.label': 'Abbe-Zahl (freiwillig)',
  'material.custom.minCT.label': 'Mindest\u00ADmitten\u00ADdicke (mm)',
  'material.custom.minET.label': 'Mindest\u00ADrand\u00ADdicke (mm)',
  'material.custom.minPrefill': 'vorbelegt wie {material}',
  'material.custom.field.ne': 'Brechungsindex nₑ',
  'material.custom.field.density': 'Dichte',
  'material.custom.field.abbe': 'Abbe-Zahl',
  'material.custom.noAbbe': 'ohne Abbe-Zahl',
  'result.materialLineCustom': '{eye}: Eigenes Material, nₑ {ne}, Dichte {density}, {abbe} – {label}',
  'result.materialLineCustom.abbe': 'Abbe-Zahl {abbe}',
  'tip.ne.name': 'Erklärung: Brechungsindex nₑ',
  'tip.ne.text': 'nₑ liegt meist 0,001 bis 0,007 über dem oft angegebenen n_d.',
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

  // Material comparison (02-07, RES-02, D-15, UI-SPEC Copywriting "Vergleich"). {mm}/{g} are
  // fmtMm/fmtGramWhole strings of the absolute displayed differences; the words carry the sign.
  'cmp.material.title': 'Was bringt ein anderes Material?',
  // 02-19 (lens-critic m3, m4): {eye} is cmp.eye.thicker or, when both glasses show the same
  // thickest value, cmp.eye.tie; the per-material minimum is stated always, not only in cmp.footnote.
  'cmp.material.intro':
    'Gleiches Rezept, gleiche Fassung, jedes Material mit seiner eigenen Mindestdicke. Dickste Stelle (Mitte oder Rand): {eye}. Gewicht: beide Gläser zusammen.',
  'cmp.eye.thicker': '{eye} (das dickere Glas)',
  'cmp.eye.tie': 'beide Gläser gleich dick – gezeigt: {eye}',
  'cmp.eye.od': 'das rechte Glas',
  'cmp.eye.os': 'das linke Glas',
  'cmp.col.material': 'Material',
  'cmp.col.thick': 'Dickste Stelle',
  'cmp.col.ct': 'Mitte',
  'cmp.col.weight': 'Gewicht (beide)',
  'cmp.col.diff': 'Unterschied zu Ihrer Auswahl',
  'cmp.eyes.summary': 'Werte je Auge anzeigen',
  'cmp.eyes.col.eye': 'Auge',
  'cmp.eyes.col.edge': 'Dickster Rand',
  'cmp.eyes.col.weight': 'Gewicht',
  'cmp.selected': 'Ihre Auswahl',
  'cmp.selectedSr': 'kein Unterschied, das ist Ihre Auswahl',
  'cmp.diff.thinnerLighter': '{mm} dünner, {g} leichter',
  'cmp.diff.thickerHeavier': '{mm} dicker, {g} schwerer',
  'cmp.diff.thinnerHeavier': '{mm} dünner, aber {g} schwerer',
  'cmp.diff.thickerLighter': '{mm} dicker, aber {g} leichter',
  'cmp.diff.equal': 'gleich dick, gleich schwer',
  'cmp.diff.equalThickLighter': 'gleich dick, {g} leichter',
  'cmp.diff.equalThickHeavier': 'gleich dick, {g} schwerer',
  'cmp.diff.equalWeightThinner': '{mm} dünner, gleich schwer',
  'cmp.diff.equalWeightThicker': '{mm} dicker, gleich schwer',
  'cmp.pct': '(≈ {pct}\u00A0% dünner)',
  'cmp.pctThicker': '(≈ {pct}\u00A0% dicker)',
  'cmp.run': 'Vergleich berechnen',
  'cmp.pending': 'Vergleich rechnet …',
  // Shown by 02-10 when Expert overrides are active (Research Pitfall 11).
  'cmp.footnote':
    'Die anderen Materialien sind mit ihren eigenen Mindestdicken gerechnet; Ihre Basiskurve und Vorderfläche gelten für alle.',
  'cmp.customExcluded': 'Ihr eigenes Material ist hier nicht aufgeführt; verglichen werden nur geprüfte Materialien.',
  'cmp.customSelected': 'Eigenes Material',
  'cmp.assumedNote': 'Für {materials} ist die Mindest-Randdicke angenommen (keine Herstellerangabe).',
  // Configuration comparison (02-08, RES-03, D-28, UI-SPEC Copywriting "Vergleich"). {mm}/{g}
  // are fmtMm/fmtGramWhole strings of the absolute displayed differences of B − A; the words
  // carry the sign. German comparatives take "als", equality takes "wie", so the equal parts have
  // their own sentences.
  'cmp.config.title': 'Zwei Varianten vergleichen',
  'cmp.config.help':
    'Merkt sich die jetzige Fassung und das Material als „Vorher“. Ändern Sie danach Fassung oder Material – das wird „Nachher“.',
  'cmp.config.cta': 'Variante vergleichen',
  'cmp.config.status': 'Vorher (A) ist gemerkt: {shape} {A}□{DBL}, {material}. Ändern Sie jetzt Fassung oder Material.',
  'cmp.config.same': 'Nachher ist noch gleich wie Vorher. Ändern Sie Fassung oder Material.',
  'cmp.config.diff': 'Nachher (B) ist an der dicksten Stelle {mm} {thinnerThicker} und insgesamt {g} {lighterHeavier} als Vorher (A).',
  'cmp.config.diffEqualThick':
    'Nachher (B) ist an der dicksten Stelle gleich dick wie Vorher (A) und insgesamt {g} {lighterHeavier}.',
  'cmp.config.diffEqualWeight':
    'Nachher (B) ist an der dicksten Stelle {mm} {thinnerThicker} als Vorher (A) und insgesamt gleich schwer.',
  'cmp.config.equal': 'Nachher (B) ist an der dicksten Stelle gleich dick und insgesamt gleich schwer wie Vorher (A).',
  'cmp.config.partial': 'Verglichen wird nur {eye}; das andere Glas ist nicht in beiden Varianten berechnet.',
  'cmp.config.word.thinner': 'dünner',
  'cmp.config.word.thicker': 'dicker',
  'cmp.config.word.lighter': 'leichter',
  'cmp.config.word.heavier': 'schwerer',
  'cmp.config.end': 'Vergleich beenden',
  'cmp.cfg.caption': 'Vorher und Nachher im Vergleich',
  'cmp.cfg.col.row': 'Wert',
  'cmp.cfg.col.a': 'Vorher (A)',
  'cmp.cfg.col.b': 'Nachher (B)',
  'cmp.cfg.col.diff': 'Unterschied',
  'cmp.cfg.row.thickOD': 'Dickste Stelle rechts',
  'cmp.cfg.row.thickOS': 'Dickste Stelle links',
  'cmp.cfg.row.ctOD': 'Mittendicke rechts',
  'cmp.cfg.row.ctOS': 'Mittendicke links',
  'cmp.cfg.row.weightBoth': 'Gewicht (beide)',
  'cmp.cfg.diff.thinner': '{mm} dünner',
  'cmp.cfg.diff.thicker': '{mm} dicker',
  'cmp.cfg.diff.lighter': '{g} leichter',
  'cmp.cfg.diff.heavier': '{g} schwerer',
  'cmp.cfg.diff.same': 'gleich',
  'cmp.show.legend': 'Ergebniskarten zeigen:',
  'cmp.show.a': 'Vorher',
  'cmp.show.b': 'Nachher',
  'cmp.show.suffix.a': ' – Vorher (A)',
  'tip.ct.name': 'Erklärung: Mittendicke',
  'tip.ct.text': 'Mittendicke: die Dicke des Glases in der Mitte. Bei Plusgläsern ist sie meist die dickste Stelle.',
  'tip.basecurve.name': 'Erklärung: Basiskurve',
  'tip.basecurve.text':
    'Die Wölbung der Vorderfläche in Dioptrien (auch Durchbiegung genannt). Sie beeinflusst, wie dick und wie gewölbt das Glas wird.',
  'tip.dec.name': 'Erklärung: Dezentration',
  'tip.dec.text':
    'Wie weit der optische Mittelpunkt von der Glasmitte zur Nase hin verschoben ist. Sie ergibt sich aus PD, Glasbreite und Stegbreite.',
  'tip.minct.name': 'Erklärung: Mindestmittendicke',
  'tip.minct.text':
    'Die kleinste Mittendicke, die der Hersteller für dieses Material angibt. Dünner wird das Glas in der Mitte nicht.',
  'tip.minet.name': 'Erklärung: Mindestranddicke',
  'tip.minet.text':
    'Die kleinste Dicke an der dünnsten Stelle des Randes. Bei Plusgläsern legt sie oft die Mittendicke fest.',
  'tip.et.name': 'Erklärung: Randdicke',
  'tip.et.text':
    'Randdicke: die Dicke am Rand des Glases. Bei Minusgläsern ist der Rand meist am dicksten, besonders außen.',

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
    '{glass}: am dicksten {thick} {thickLoc}, am dünnsten {thin} {thinLoc}. Mitte {ct}, Gewicht {weight}.',
  'result.headline.uniformEdge': '{glass}: Rand ringsum {etmin} dick, Mitte {ct}. Gewicht {weight}.',
  'result.label.thick': 'Dickste Stelle',
  'result.label.thin': 'Dünnste Stelle',
  'result.thinEdge': 'Rand ab {etmin}',
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
  // Preset chips and the inline confirm (02-09, D-27, UI-SPEC "Header, banner, presets",
  // "Destructive confirmation"). {preset} is a chip label; {A}/{DBL} are the preset's mm values.
  'preset.rx.label': 'Beispiele zum Ausprobieren:',
  'preset.rx.leicht': 'Leicht kurzsichtig',
  'preset.rx.stark': 'Stark kurzsichtig',
  'preset.rx.weit': 'Weitsichtig',
  'preset.rx.hhv': 'Hornhaut\u00ADverkrümmung',
  'preset.frame.label': 'Typische Größen:',
  'preset.frame.klein': 'Klein ({A}□{DBL})',
  'preset.frame.mittel': 'Mittel ({A}□{DBL})',
  'preset.frame.gross': 'Groß ({A}□{DBL})',
  'preset.confirm.q': 'Ihre Eingaben ersetzen?',
  'preset.confirm.body': 'Ihre eingetippten Werte werden durch das Beispiel „{preset}“ ersetzt.',
  'preset.confirm.replace': 'Ersetzen',
  'preset.confirm.keep': 'Eingaben behalten',
  'compute.failed.title': 'Berechnung abgebrochen',
  'compute.failed.explain':
    'Die Berechnung im Hintergrund ist fehlgeschlagen. Bitte einen Wert erneut ändern; hilft das nicht, die Seite neu laden.',

  // Lay location words (D-23); 'centre' = thickest point of a plus lens (B1).
  'loc.centre': 'in der Mitte',
  'loc.uniform': 'am ganzen Rand',
  'loc.even': 'überall gleich',
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
  // 02-17 (lens-critic M2): shown before bar.label / result.computing while the result cards show
  // Vorher (A); same words as cmp.show.suffix.a.
  'bar.prefix.a': 'Vorher (A):',
  'bar.eye': '{thick} · {weight}',
  'bar.values': 'R {od} | L {os}',
  'bar.jump': 'Zum Ergebnis:',

  // Experten-Ansicht suffix after the lay word, in parentheses (UI-SPEC "Location words (Expert suffix)").
  'loc.tech.centre': 'optischer Mittelpunkt',
  'loc.tech.uniform': 'rundum gleich',
  'loc.tech.even': 'gleichmäßige Dicke',
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
    'Zeigt zusätzlich die Glas-Einstellungen (Basiskurve, Mindestdicken und asphärische Vorderfläche selbst wählen), die Randtiefe der Fassung und die Zwischenwerte: Dezentration, Basiskurve, Rückfläche, Radien, Pfeilhöhen, festlegende Mindestdicke und das Gewicht auf 0,1 g.',
  'expert.tag': 'Experten-Ansicht',
  'expert.analysis.title': 'Experten-Analyse',
  'expert.zw.title': 'Zwischenwerte',
  'expert.zw.dec': 'Dezen\u00ADtration (zur Nase)',
  'expert.zw.etmax': 'Dickster Rand',
  'expert.zw.etmin': 'Dünnster Rand',
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
  // Glas-Einstellungen (02-10, MAT-03, MAT-04, UI-SPEC Copywriting "Material" Expert rows).
  'expert.gs.title': 'Glas-Einstellungen',
  'expert.bc.label': 'Basiskurve (dpt) – leer lassen für automatisch',
  'expert.bc.echoManual': 'von Ihnen vorgegeben',
  'expert.bc.echoAuto': 'automatisch',
  // {glass} = result.glass.*, {value} = fmtDiopter of the automatic D1, {vogelRef} = basecurve.* sentence.
  'expert.bc.autoLine': '{glass} – automatisch: {value} – dünnstes Glas, flachste Vorderfläche innerhalb 0,1 mm. {vogelRef}',
  'expert.bc.autoNone': '{glass} – automatisch: –',
  'expert.bc.minusNote':
    'Bei Minusgläsern wählt das Modell automatisch die flachste Vorderfläche (+0,50 dpt), weil sie das dünnste Glas ergibt. Handelsübliche Gläser sind oft stärker gewölbt (Faustregel nach Vogel); mit „Vogel-Basiskurve übernehmen“ sehen Sie ein solches Glas.',
  'expert.bc.vogelApply': 'Vogel-Basiskurve übernehmen',
  'expert.min.ct': 'Mindest\u00ADmitten\u00ADdicke (mm)',
  'expert.min.et': 'Mindest\u00ADrand\u00ADdicke (mm)',
  'expert.min.reset': 'Standardwerte setzen',
  'expert.min.sourced': 'Herstellerangabe (Zeiss-Datenblatt)',
  'expert.min.assumed': 'angenommen (keine Herstellerangabe)',
  'expert.min.typed': 'von Ihnen vorgegeben',
  // {glass} = result.glass.*, {text} = expert.binding.*
  'expert.binding.line': '{glass}: {text}',
  // 02-11 (MAT-05, UI-SPEC Copywriting "Vorderfläche"): a generic conic, never a manufacturer design.
  'expert.front.legend': 'Vorderfläche',
  'expert.front.sph': 'sphärisch',
  'expert.front.asph': 'asphärisch (allgemeines Modell, kein bestimmtes Herstellerdesign)',
  'expert.k.label': 'Konische Konstante k (Standard −1, erlaubt −5,0 bis −1,0)',
  'expert.k.echo': 'k = {k}',
  'expert.asph.note': 'In diesem Modell ändert die asphärische Vorderfläche vor allem Plusgläser.',
  'tip.k.name': 'Erklärung: konische Konstante k',
  'tip.k.text': 'Konische Konstante: 0 ist eine Kugel, negative Werte flachen die Fläche zum Rand hin ab.',

  // D-01 final + D-C (01-12): the flattest front within τ = 0,1 mm of the thinnest; Vogel is a reference only.
  'basecurve.rule.thinnest':
    'so gewählt, dass das Glas nahezu so dünn wie möglich wird (höchstens 0,1 mm mehr als das dünnste), mit der flachsten Vorderfläche unter diesen',
  'basecurve.rule.manual': 'von Ihnen vorgegeben',
  'basecurve.vogelClamped': ', begrenzt auf {clamped}',
  'basecurve.vogelRef': '(zum Vergleich: übliche Faustregel nach Vogel {vogel})',
  'basecurve.vogelRefThicker':
    '(zum Vergleich: übliche Faustregel nach Vogel {vogel}; damit wäre das Glas an der dicksten Stelle {thickness} dick)',
  // 02-10 (lens-critic phase-1 MINOR-5): the Vogel value as a usable 0,25 dpt step in 0,00…+10,00.
  'basecurve.vogelRounded': 'Zum Übernehmen gerundet: {rounded}.',
  // 02-11 (lens-critic MINOR-1): the rule and the Vogel comparison were evaluated at k = 0.
  'basecurve.sphericalBasis': '(für sphärische Vorderfläche bestimmt)',
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
  // 02-10 (MAT-03): D2 = Sph − D1v, so only a higher base curve clears a convex back (lens-critic M1).
  'diag.MANUAL_BACK_CONVEX.title': 'Rückfläche zum Auge hin gewölbt (konvex)',
  'diag.MANUAL_BACK_CONVEX.explain':
    'Mit der von Ihnen vorgegebenen Basiskurve ist die Vorderfläche für diese Plus-Wirkung zu flach, deshalb wölbt sich die Rückfläche zum Auge hin. Übliche Gläser haben eine nach innen gewölbte (konkave) Rückfläche.',
  'diag.MANUAL_BACK_CONVEX.suggest': 'Eine stärker gewölbte (höhere) Basiskurve wählen oder das Feld leer lassen.',

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
  // 02-07: the frame that paints the material comparison, on the same main thread (T-02-50).
  'tech.timingCompare': 'Vergleich-Frame einschließlich Darstellung (letzte {n}): Median {med}, längste {max}',
  // 02-20: the task after the input frame that queues the comparison jobs (ENG-09 (a)).
  'tech.timingCompareStart': 'Vergleich-Start nach dem Eingabe-Frame (letzte {n}): Median {med}, längste {max}',
  'tech.result':
    'Eingabe bis Ergebnis sichtbar (letzte {n} Ergebnisse): Median {med}, längste {max}; Darstellung des Ergebnisses längstens {renderMax}; davon Rechnen: Median {compute}',
  'tech.busy': '„rechnet …“ angezeigt seit dem Laden: {count}-mal; längste Wartezeit auf ein Ergebnis: {longest}',
  'tech.eventTiming': 'Längste Interaktion laut Browser-Messung (Event Timing, letzte {n}): {max}',
  'tech.eventTimingEmpty': 'Browser-Messung (Event Timing): keine Interaktion über {threshold}',
  'tech.eventTimingNone': 'Browser-Messung (Event Timing): nicht verfügbar',
  'tech.rerun': 'Erneut messen',
  'tech.ua': 'Browser: {ua}',
  // 03-07 (VIZ-02, D-06; UI-SPEC "Technische Angaben"): the frame's assumed design values.
  'tech.view.temple': 'Bügellänge in der 3D-Ansicht: {len} ({source})',
  'tech.view.templeSource.stamp': 'vom Bügel',
  'tech.view.templeSource.assumed': 'angenommener Wert',
  // 03-03 clamps the drawn temple to an assumed range; the stamp value is named, not hidden.
  'tech.view.templeSource.clamped': 'laut Bügel {stamp}, für die Darstellung auf {min} bis {max} begrenzt – angenommener Bereich',
  'tech.view.rimFace': 'Sichtbare Randbreite der Fassung: {w} (angenommener Wert, nur für die Darstellung)',
  'tech.view.planar': 'In der 3D-Ansicht sitzen die Gläser ohne Vorneigung und ohne Fassungsbogen, wie in der Berechnung.',
  // 03-08 (D-12, UI-SPEC "Quality tiers"). dispersion.on adds 'νₑ (angenähert)' to the UI-SPEC
  // string: the Farbsäume use 20/νe for 20/νd (RESEARCH A10), so the label says so.
  'tech.view.tier.hoch': '3D-Darstellung: Qualitätsstufe hoch (volle Auflösung{dispersion})',
  'tech.view.tier.mittel': '3D-Darstellung: Qualitätsstufe mittel (Telefon: Glasdurchsicht in halber Auflösung, ohne Farbsäume)',
  'tech.view.tier.sparsam': '3D-Darstellung: Qualitätsstufe sparsam (automatisch gesenkt, weil die Ansicht ruckelte)',
  'tech.view.dispersion.on': ', mit Farbsäumen aus der Abbe-Zahl νₑ (angenähert)',
  'tech.view.dispersion.off': ', ohne Farbsäume',
  'tech.view.exact': 'Form und Dicke der Gläser sind in jeder Qualitätsstufe gleich genau.',
  'tech.view.remesh': '3D-Neuaufbau zuletzt: {ms}',
  'tech.view.unavailable': '3D-Ansicht nicht verfügbar: {reason}',
  'tech.view.reason.noWebgl': 'kein WebGL 2',
  'tech.view.reason.loadFailed': 'Laden fehlgeschlagen',
  'tech.view.reason.paused': 'Grafik vom Browser angehalten',

  // 3D-Ansicht (03-05, VIZ-01, VIZ-04; UI-SPEC "Copywriting → View").
  'view.title': '3D-Ansicht Ihrer Brille',
  'view.stage.label': '3D-Ansicht steuern',
  'view.badge.glass': 'Visueller Eindruck',
  'view.badge.updating': '3D wird aktualisiert …',
  'view.caption.glass':
    'Visueller Eindruck – die Lichtbrechung im Glas ist nur angenähert. Form und Dicke der Gläser sind maßstabsgetreu berechnet.',
  'view.loading': '3D-Ansicht wird aufgebaut …',
  // 03-06 (D-17, UI-SPEC States): eye labels and the blocked, empty, load-failure and no-WebGL states.
  'view.eye.od': 'R',
  'view.eye.os': 'L',
  'view.eye.blocked': '{eye} – nicht berechnet',
  'view.empty': 'Noch keine Gläser – tragen Sie den Sph-Wert ein.',
  // UI-SPEC says 'Die berechneten Werte darunter …'; below 900 px the values sit ABOVE the view
  // (view-place.js, MAJOR 5), so the position word is dropped.
  'view.loadFailed': 'Die 3D-Ansicht konnte nicht geladen werden. Die berechneten Werte gelten unverändert.',
  'view.retry': 'Erneut versuchen',
  // 03-08 (UI-SPEC States): WebGL context loss and restore.
  'view.contextLost': 'Die 3D-Ansicht wird neu aufgebaut …',
  'view.contextGone': 'Die 3D-Ansicht ist vorübergehend nicht verfügbar. Laden Sie die Seite neu, um sie wieder zu sehen.',
  // 03-09 (VIZ-03, UI-SPEC "Toolbar and hints", "Canvas accessible name" view names).
  'view.presets.label': 'Blickrichtung',
  'view.preset.front': 'Vorne',
  'view.preset.side': 'Seite',
  'view.preset.top': 'Oben',
  'view.preset.reset': 'Ansicht zurücksetzen',
  'view.hint.pointer': 'Ziehen dreht die Brille · Umschalt + Ziehen verschiebt · Mausrad zoomt, nachdem Sie in die Ansicht geklickt haben.',
  'view.rotate': '3D drehen',
  'view.hint.touchOff': 'Tippen Sie auf „3D drehen“, um die Brille mit dem Finger zu drehen.',
  'view.hint.touchOn': 'Ein Finger dreht, zwei Finger zoomen und verschieben. Zum Weiterblättern wieder auf „3D drehen“ tippen.',
  'view.keys': 'Tastatur: Pfeiltasten drehen, Umschalt + Pfeiltasten verschieben, Plus und Minus zoomen, Pos1 setzt die Ansicht zurück.',
  'view.side.note': 'Seite: Blick auf den äußeren Rand des {eye} Glases.',
  'view.side.od': 'rechten',
  'view.side.os': 'linken',
  'view.viewName.default': 'schräg von vorne',
  'view.viewName.front': 'von vorne',
  'view.viewName.side': 'von der Seite ({eye} Glas)',
  'view.viewName.top': 'von oben',
  'view.viewName.free': 'frei gedreht',
  'view.viewName.od': 'rechtes',
  'view.viewName.os': 'linkes',
  // 03-11, D-19 (UI-SPEC Protrusion with Revision 1 R1-7); {front}/{back} = fmtMm(bevelSplit(...)),
  // {lead} = fmtMm(frontLeadMm(...).value), the same helpers and rim depth as the Expert rim lines.
  'view.protrusion.title': 'Überstand am dicksten Glasrand',
  'view.protrusion.both': '{eye}: Glasrand vorne {front}, hinten {back} aus der Fassung',
  'view.protrusion.front': '{eye}: Glasrand vorne {front} aus der Fassung, hinten bündig',
  'view.protrusion.back': '{eye}: Glasrand hinten {back} aus der Fassung, vorne bündig',
  'view.protrusion.none': '{eye}: Glasrand passt ganz in die Fassung',
  'view.protrusion.lead': '{eye}: Vorderfläche bis zu {lead} vor der Fassung',
  'view.protrusion.leadNone': '{eye}: Vorderfläche nicht vor der Fassung',
  'view.protrusion.assumed': 'Berechnet mit Randtiefe {rim} (angenommener Wert, keine Herstellerangabe; in der Experten-Ansicht änderbar).',
  'view.protrusion.bevelAssumed': 'Die Aufteilung nach vorne und hinten ist angenommen.',
  'view.protrusion.eye.od': 'Rechts',
  'view.protrusion.eye.os': 'Links',
  // 03-11, D-29 (UI-SPEC Canvas accessible name): view.aria.glass is the UI-SPEC sentence with the
  // two eye parts as {od} {os}, so a blocked eye can replace its part (view.aria.eyeBlocked). All
  // numbers and location words are the strings painted on the result cards (results.js cardStrings).
  'view.aria.glass': '3D-Ansicht der Brille, {viewName}. {od} {os} Fassung {shape} {A}□{DBL}, Material {material}.',
  'view.aria.eyeGlass': '{eye} Glas: dickste Stelle {thick} {loc}, Mitte {ct}.',
  'view.aria.eyeBlocked': '{eye} Glas: nicht berechnet.',
  'view.aria.eye.od': 'Rechtes',
  'view.aria.eye.os': 'Linkes',
  // 03-12 (VIZ-05, UX-02; UI-SPEC "Copywriting → Heatmap"). {min}/{max} = fmtMm of the engine
  // scale (heatScale), {step} = fmtIsoStep, {mm} = fmtMm of a heatCallouts value.
  'view.mode.legend': 'Darstellung',
  'view.mode.glass': 'Glas',
  'view.mode.heat': 'Dickenkarte',
  'view.badge.heat': 'Dickenkarte',
  'view.caption.heat': 'Die Farbe zeigt die Dicke an jeder Stelle: dunkler = dicker. Alle Zahlen stehen auch in der Tabelle unter der Ansicht.',
  'view.heatEye.legend': 'Zahlen am Glas für',
  'view.heatEye.od': 'Rechtes Glas',
  'view.heatEye.os': 'Linkes Glas',
  // 03-13 (VIZ-05, D-22; UI-SPEC Heatmap): on-lens callouts, {mm} = fmtMm of a heatCallouts value.
  'view.callout.thickest': 'dickste {mm}',
  'view.callout.thickestSuffix': '{mm} · dickste',
  // lens-critic MAJOR 4: shown when not every callout fits (then none is shown).
  'view.callout.tableOnly': 'Für die Zahlen am Glas ist die Ansicht zu klein – alle Werte stehen in der Tabelle.',
  'view.legend.title': 'Dicke in mm',
  'view.legend.thin': 'dünner',
  'view.legend.thick': 'dicker',
  'view.legend.step': 'Linien alle {step}',
  'view.legend.svgTitle': 'Farbskala der Dicke',
  'view.legend.svgDesc': 'Von {min} (dünner, hell) bis {max} (dicker, dunkel), Linien alle {step}.',
  'view.legend.flat': 'Das Glas ist fast überall gleich dick ({min} bis {max}).',
  'view.table.caption': 'Dicke an markanten Stellen',
  'view.table.col.where': 'Stelle',
  'view.table.row.centre': 'Mitte (optischer Mittelpunkt)',
  'view.table.row.nasal': 'innen (nasal)',
  'view.table.row.temporal': 'außen (temporal)',
  'view.table.row.superior': 'oben (superior)',
  'view.table.row.inferior': 'unten (inferior)',
  // UI-SPEC row text 'dickste Stelle ({loc})': the location differs per eye, so it sits in the cell.
  'view.table.row.thickest': 'dickste Stelle',
  'view.table.thickestCell': '{mm} ({loc})',
  'view.table.noChord':
    'Der optische Mittelpunkt liegt außerhalb der Fassungsform, deshalb gibt es keine Randwerte durch die Mitte.',
  'view.aria.heat':
    'Dickenkarte, {viewName}. Dünnste Stelle {min}, dickste Stelle {max}. Die Werte an markanten Stellen stehen in der Tabelle unter der Ansicht.',
  'view.noWebgl':
    'Ihr Browser kann die 3D-Ansicht nicht anzeigen (WebGL 2 fehlt oder ist ausgeschaltet). Alle Werte, der Vergleich und der Querschnitt funktionieren trotzdem.',

  // Querschnitt (02-13, ANA-01, D-30, D-37). Numbers are formatted outside the strings.
  'xs.title': 'Querschnitt',
  'xs.svgTitle': 'Querschnitt {eye}, Schnitt {angle}°',
  'xs.desc': 'Mittendicke {ct}; Rand {endA} ({locA}) und {endB} ({locB}).',
  'xs.descB': 'Nachher (B): Mittendicke {ct}; Rand {endA} ({locA}) und {endB} ({locB}).',
  'xs.descA': 'Vorher (A): Mittendicke {ct}; Rand {endA} ({locA}) und {endB} ({locB}).',
  'xs.legend': 'A (Vorher) — durchgezogen · B (Nachher) — gestrichelt',
  'xs.table.caption': 'Werte im Querschnitt',
  'xs.col.value': 'Wert',
  'xs.col.a': 'Vorher (A)',
  'xs.col.b': 'Nachher (B)',
  'xs.row.ct': 'Mittendicke',
  'xs.row.end': 'Rand {loc}',
  'xs.mid': 'Mitte',
  'xs.eye.legend': 'Glas',
  'xs.eye.od': 'Rechtes Glas',
  'xs.eye.os': 'Linkes Glas',
  'xs.meridian.label': 'Schnitt',
  'xs.meridian.h': 'waagrecht (0°)',
  'xs.meridian.hPrincipal': 'waagrecht (0°), Hauptschnitt ({power})',
  // 02-17 (lens-critic M1): {power} = engine meridianPower D(0) = S + C·sin²(0 − α); used when 0° is
  // neither α nor α + 90°, so it is not a principal meridian.
  'xs.meridian.hOblique': 'waagrecht (0°), kein Hauptschnitt ({power})',
  // 02-17 (gap-plan review): Zyl 0, the section power is Sph (engine meridianPower).
  'xs.meridian.hSphere': 'waagrecht (0°), {power}',
  'xs.meridian.principal': 'Hauptschnitt {axis}° ({power})',
  'xs.end.nasal': 'Nase',
  'xs.end.temporal': 'Schläfe',
  'xs.end.superior': 'oben',
  'xs.end.inferior': 'unten',
  'xs.end.nasal-superior': 'Nase oben',
  'xs.end.nasal-inferior': 'Nase unten',
  'xs.end.temporal-superior': 'Schläfe oben',
  'xs.end.temporal-inferior': 'Schläfe unten',
  'xs.noChord': 'Für diesen Schnitt lässt sich kein Querschnitt zeichnen: der optische Mittelpunkt liegt außerhalb der Fassung.',

  'footer.version': 'Version',

  'disclaimer.title': 'Wichtiger Hinweis',
  'disclaimer.body': 'Diese Seite ist eine Lernhilfe: eine vereinfachte Veranschaulichung, kein Ersatz für die Messung und Beratung beim Optiker. Alle Zahlen sind Modellwerte. Das Modell rechnet ohne Experten-Einstellung mit einer sphärischen Vorderfläche, nicht mit asphärischen Herstellerdesigns, und die Rückfläche ist in diesem Modell nie nach außen gewölbt. Die Basiskurve wird so gewählt, dass das Glas in diesem Modell nahezu so dünn wie möglich wird (höchstens 0,1 mm dicker), mit der flachsten Vorderfläche unter diesen (Vorderfläche mindestens +0,50 dpt). Optiker und Hersteller wählen die Kurve auch nach Abbildungsqualität und Aussehen; echte Gläser können deshalb dicker sein – bei Plusgläsern in der Mitte um bis zu etwa 0,4 mm (verglichen mit Zeiss-Lagergläsern bis +6 dpt), bei stärkeren Plusgläsern möglicherweise mehr; bei starken Minusgläsern in großen Fassungen am Rand um einige Millimeter (oder mit asphärischen Gläsern dünner). Die Mindestdicken sind typische Herstellerwerte; die Fertigungstoleranz der Mittendicke beträgt laut Hersteller bis zu ±0,3 mm. Prismen, Addition und Gleitsichtgläser werden nicht berücksichtigt; Der Rohglasdurchmesser ist nicht modelliert; die Lage der Facette ist angenommen (bei einem Drittel der Randdicke von vorne).',
});
