# Modell-életciklus és integráció

Forrás → opcionális, külön kért teljes formázás → alkalmazáskor nyelvi audit és AST-alapú CodeLine-modell → JSON-szerkesztés → Schema/struktúra/szintaxis/referenciasorrend audit → aktív szerzői előnézet → beszúró rendezés → élő vizuális behúzás → strukturális értékelés.

`installPreview` csak sikeresen fordított referenciát vesz át. A UI kérésazonosítóval eldobja az időközben elavult szerzői válaszokat. Azonos sor-ID, tokentartalom, fixed jelző és normalizálási mód esetén a korábbi `answer`, `pool`, `custom` megmarad; a régi riportot eldobjuk és az új szabályokkal azonnal értékelünk. Inkompatibilis sorhalmaznál új próbálkozás indul. JSON-/szintaktikai-/modellaudit-hibánál a korábbi aktív modell érvényes marad.

A `dependencies` minden kötelező előzményét együttesen megköveteli. Például független `a` és `b` deklaráció esetén mindkettő függhet a függvény nyitójától, a `return` pedig mindkettőtől. A referenciák eredeti sorrendje nem bizonyítja a lazítás szemantikai helyességét.

Minden beviteli mód `0..N` fizikai beszúrási határt ad az `attempt` modulnak. A célzott sor felezőpontja dönti el az előtte/mögötte választást. A fix helyek kimaradnak a mozgatható helyekből; a köztes elemek a legközelebbi szabad hely felé tolódnak. Sikertelen beszúrás atomikus. A kompatibilitási `swap` metódus is beszúrást delegál, külön cserealgoritmus nincs.

Az inputadapter natív DnD-t, mouse/pen/touch pointert és billentyűzetet kezel. A natív dragstart átveszi a munkamenet tulajdonlását: az ezt követő böngészős pointercancel nem törli a natív húzást. Egyéni pointergesztust csak a hozzá tartozó pointerazonosító megszakítása törölhet. A vizuálisan eltolódó sorok hit-testje a tényleges CSS-transzformációt kompenzálja. Pointermozgatáskor a szélek mentén animation-frame alapú autoscroll működik. A render saját panelenkénti scrollmemóriát használ. A billentyűzetes mozgatás visszaadja a fókuszt az adott sor fogantyújára, és élő státuszüzenetet közöl.

A szerzői modell JSON-ként exportálható/importálható. A verziózott munkamenetfájl a próbálkozást és saját feladatnál a szerzői modellt tartalmazza, értékelési riportot nem. A kézi helyi mentés opt-in; visszatöltése importként újraellenőrződik. A beépített szerverreferencia szabályai sem exportból, sem localStorage-ból nem származhatnak.

Az integrációt a `model-roundtrip`, `author-audit`, `persistence-registry`, HTTP-tesztek és a valódi Node/Pages böngészős mátrix ellenőrzi. A pontos aktuális eredmények az [auditjelentésben](audit-report.md) találhatók.
