# ADR-002 – A fixed abszolút sorhelyet jelent

Állapot: megvalósítva, kiadás előtti review során.

## Probléma és döntés

A CodeLine v2 fixed jelző dokumentált értéke: a referenciasor abszolút pozíciója nem változhat. A régi fordító ezt sorrendi horgonyélekkel valósította meg. Ezek a többi sort az eredeti oldalukhoz is kötötték, így helyes, változatlan fixed pozíciójú sorrendeket is elutasítottak. A felület szabadon rendezhető helyeket használó beszúrása nem követelte ezt a többletkorlátot.

A külső v2 JSON változatlan. A fordító a belső CodeToken típus opcionális, nullától induló fixedPosition mezőjére vetíti a fixed sor referenciaindexét. A modellfordító ellenőrzi a tartományt és az ütközést. A validátor a tartalomhoz illő jelöltekből kiszűri a rossz pozíciójú rögzített tokent. A teljes tartalmi bijekció, multiplicitás, scope, dependencies, edges, profiles és közös keresési budget megmarad.

A felület és a persistence továbbra is saját domainmodulján keresztül védi a helyet és a tartalmat. Nincs külön UI-validátor vagy többletmodell-szabály a controllerben.

## Következmény és ellenőrzés

A fixed nem elválasztó fal. Például A, B, FIX, D, E esetén D, B, FIX, A, E megengedhető, ha nincs más függőségi vagy scope-korlát. A rögzített sor elmozdítása továbbra is hibás. Korábban az implicit horgonyélekre támaszkodó oldalkorlátot most explicit dependencies/edges szabállyal kell megadni; ez a dokumentált abszolút hely szemantikájának hibajavítása.

Öt sor összes 120 permutációja közül pontosan a 24 változatlan középső fixed helyű sorrend elfogadott. Külön regresszió vizsgálja az érvénytelen és ütköző belső pozíciókat, a duplikált kódtartalomhoz tartozó helyes tanút és az 500 rögzített soros méretet. Node és alútvonalas Pages böngészőteszt ellenőrzi a rögzített sor körüli tényleges beszúrást és elfogadást.
