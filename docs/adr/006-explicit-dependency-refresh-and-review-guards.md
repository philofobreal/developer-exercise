# ADR-006 – Explicit függőségfrissítés és szerzői kérésazonosság

Állapot: implementáció és regressziós ellenőrzés. A v2 trusted/preview/local-demo határ és az ADR-001–005 megmarad.

## A képi evaluate-eset

A korábbi generátor exportja soros láncot tárolhat (`[]`, `[1]`, `[2]`, …), miközben a `dependencyHints` csak a deklaráció/használat kapcsolatot írja le. A validátor helyesen a tényleges dependencies/edges/profiles alapján dönt; a képen látható `b, note, a, c` sorrendet a régi lánc tiltja. A mai generátor már scoped primitív DAG-ot készít. Az importált lánc automatikus lazítása kézi szerzői szabályt is törölhetne, ezért normál import/Modell alkalmazása változatlanul megőrzi a JSON-t.

Új, explicit **Sorfüggőségek újraszámítása** művelet használja ugyanazt a meglévő JS/TS elemzést. A strict TS author engine új `refreshLegacyDependencies` portja rejti az auditálást; a `dependency-refresh` modul a régi sor-/blokkazonosságra vetíti az új elemzést. A sorok kódja, ID-ja, normalization, sourceLine, fixed, blocks és profiles megmarad; a kézi edges megmarad, a generált strukturális élek hozzáadódnak. Csak a dependencies és a generált authoring-diagnosztika frissül. Eltérő fizikai sor-/blokkszerkezetnél az operation elutasított; teljes forrás-újragenerálás külön művelet marad. A végső modell a megszokott compiler/audit/self-check admissionön megy át.

A Node catalog és a Pages adapter kizárólag ennek a typed portnak a wiringját kapja: meglévő author compile kérés, `refreshDependencies: true` és teljes v2 model. Nincs learner endpoint vagy parseres tanulói kiértékelés. A UI előre kimondja a dependencies felülírását és a többi szabály megtartását; kompatibilis próbálkozás megmarad és újraértékelődik. A szerver új author draftot ad, a trusted referencia nem változik. Ez az ADR-001 szűk legacy wiring-kivétele, nem új JS-beli elemzési algoritmus.

## Review során erősített határok

- A natív IR pontosan lefedi a fizikai source sorokat; a végső LF nem mesterséges üres sor. A v2 bridge eddigi blank/trim kivételei változatlanok. A spanok egyenkénti helyessége önmagában nem elég: hiányzó utasítást is észlelni kell.
- A render javaslat minden indexét ellenőrizzük, a ritkás JS-tömb üres helyét is. Hibás javaslatnál az eredeti teljes unit marad.
- A parser runtime_error terminális az adott workerre; következő kérés új runtime-ot indít, így átmeneti loaderhiba után lehet újrapróbálkozni. A syntax_error/resource_limit normál, kéréshez kötött diagnosztika marad.
- A szerzői művelet sorrendjét a typed author-workspace rejti. A guard már a fájl-/clipboard-/hálózati I/O előtt készül; a legújabb reference művelet, feladatváltás vagy admission érvényteleníti a korábbit. Egy késői File.text eredmény nem foglalhatja el egy újabb szerkesztés vagy import helyét. A belső `authorRequestGeneration` nem persistált/session mező. A controller és a typed file-handler csak capture/check portot hív; a sorrendi politika nem a legacy handlerben él.

Az új port miatt változó hívók: author engine, Node catalog, Pages adapter, workbench/legacy controller. A core továbbra sem ismer parsert vagy infrastruktúrát; a v2 modell szerződése nem változik. A Python natív adapter és a v3 termékintegráció továbbra is nyitott.
