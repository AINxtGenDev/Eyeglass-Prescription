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

  'disclaimer.title': 'Wichtiger Hinweis',
  'disclaimer.body': 'Diese Seite ist eine Lernhilfe: eine vereinfachte Veranschaulichung, kein Ersatz für die Messung und Beratung beim Optiker. Alle Zahlen sind Modellwerte. Das Modell rechnet mit einer sphärischen Vorderfläche, nicht mit asphärischen Herstellerdesigns. Die Basiskurve wird so gewählt, dass das Glas in diesem Modell möglichst dünn wird (Vorderfläche mindestens +0,50 dpt). Optiker und Hersteller wählen die Kurve auch nach Abbildungsqualität und Aussehen; echte Gläser können deshalb dicker sein – bei starken Minusgläsern in großen Fassungen um einige Millimeter (oder mit asphärischen Gläsern dünner). Die Mindestdicken sind typische Herstellerwerte; die Fertigungstoleranz der Mittendicke beträgt laut Hersteller bis zu ±0,3 mm. Prismen, Addition und Gleitsichtgläser werden nicht berücksichtigt; Rohglasdurchmesser und Facettenlage sind nicht modelliert.',
});
