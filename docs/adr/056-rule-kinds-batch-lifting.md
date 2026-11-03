# ADR-056 – Szabályok típus szerint, egy lépésben feloldva

Állapot: **elfogadva** (2026-11-02). Megjelenítés; a mag szabályművelete (ADR-018) és a minősítés (ADR-017) változatlan. A felhasználó kérése: általános megoldás, ne csak a kulcssorrendre.

## Kontextus

Az [ADR-055](055-key-order-setting.md) a kulcssorrendet kezeli egy beállítással. Más szabálytípusnál a tanár eddig csak soronként, a láncszem gombbal oldhatott fel szabályt. Ha egy típus sok szabályt adott, ez kattintgatás volt, és könnyű volt kihagyni egyet.

## Döntés

1. **Csoportosítás:** a Szabályok lépés „Szabályok típus szerint” blokkja a modell nem szerkezeti szabályait egyetlen okkódjuk szerint csoportosítja. Minden csoportnál látszik a jelentés (ADR-054), a szerkeszthetőségi osztály, a szabályok száma és az első néhány pár.
2. **Feloldás:** a „Mind feloldása” egy megerősítő mezőt nyit; az indoklás minden lazításhoz bekerül. A megerősítés a csoport összes szabályát **egy kötegben** küldi a magnak, az osztálynak megfelelő megerősítéssel.
   - **Ugyanaz az út:** a mag ugyanazt az ellenőrzést végzi, mint egyenkénti eltávolításnál (szerkezeti szabály nem távolítható el, policy-felülírás, újraminősítés).
   - **A minősítés őszinte:** bizonyított szabály feloldása után „Nem igazolt”.
3. **A több okú szabály** nem kerül egyik csoportba sem, csak egyenként oldható fel. Így egy csoport feloldása nem dönt egy másik okról. A blokk megmondja, hány ilyen van.
4. **Útmutatás:** a blokk és a „Miért?” szöveg megmondja, hogy kulcssorrendnél a Forrás lépés beállítása a jobb út, mert a modell ott „Elemzéssel igazolt” marad.
5. **Javított szöveg:** az ADR-054 „Miért?” blokkja eddig tévesen azt írta, hogy a bizonyított szabály feloldása után a minősítés „Szerzői döntéssel módosított”. A valóság „Nem igazolt”, és a szöveg ezt mondja.

## Felépítés

- **A csoportosítás, a köteg és az eredmény rögzítése** a típusos szabálypanel-modulban van (`renderRuleKinds`, `readRuleKindEdits`, `settleRuleKind`).
- **A régi `ui.js` vezérlő** csak bekötést kapott (ADR-001): megnyitás, mégse, megerősítés. Az `authorApply` visszaadja a választ, hogy a köteg eredménye kiírható legyen.
- **Ismétlés (rögzített tervezési megállapítás, lezárva: [ADR-065](065-design-debt-removal-and-module-split.md)):** a megerősítési szint osztályonkénti leképezése a felületen is szerepel (ADR-054). A mag ellenőrzi, eltérésnél elutasít, és a felület a mag üzenetét mutatja.

## Bizonyíték

- **Egységtesztek** ([author-rule-panel.test.mjs](../../tests/author-rule-panel.test.mjs)):
  - csak egy okú, nem szerkezeti csoportok jelennek meg;
  - a megerősítés csak választás után látszik;
  - tanulói nézetben nincs blokk;
  - a köteg az osztály megerősítését és az indoklást viszi;
  - a szerver minden csoportot alkalmaz, és utána egyik szabály sem marad meg.
- **Böngésző:** egy csoport feloldása után a korábban elutasított sorrend „Elfogadva”.
