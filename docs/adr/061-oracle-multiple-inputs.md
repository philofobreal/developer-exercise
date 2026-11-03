# ADR-061 – Több bemenet az orákulumban, paraméteres programok

Állapot: **elfogadva** (2026-11-03). Orákulum és mérés, az 5. fázis 1. tétele ([megbízhatósági terv](../megbizhatosagi-audit-terv.md)). A generátor és a validátor változatlan.

## Kontextus

A P3 és a P4 futásidejű része eddig egyetlen rögzített próbát futtatott. Ami csak egy másik bemeneten tér el, azt az orákulum egyenértékűnek látta. Ilyen például egy ág, amely csak nagyobb határértéknél fut le, és egy saját tömbműveletet ütköztet egy másikkal (a P2 ezt a futásra bízza, ADR-025). Ennek két hatása volt:
- a mérés egy helyes elutasítást résnek számolt;
- ugyanígy egy hibás elfogadás is rejtve maradhatott.

A véletlen programok paraméter nélküli belépési pontot használtak, ezért a bemeneti szerződés (ADR-050) futásidőben nem kapott ellenséges bemenetet.

## Döntés

1. **Több próba:** a fixture `probes` listát kaphat. Minden próba friss kontextusban fut, az eredményeket próbánként hasonlítjuk össze. Az elérési tanú (ADR-058) az összes futás unióját veszi, az ADR-043 lefutott sorai szintén minden próba uniója.
   - A referenciaérték az első próbáé.
   - A `probe` mező megmarad, egy próbás fixture-nél semmi nem változik.
2. **Paraméteres programfajta** (`param`, `randomParameterProgram`): `evaluate(data, limit)`, amely
   - olvassa a paraméter tulajdonságait, felsorolja a kulcsait, bejárja a tömbjét, és írhatja is;
   - mellette saját tömbműveleteket és nyomkövetést végez.

   A próbák a bemeneti szerződést követik:
   - **`valid`:** három egyszerű adat;
   - **`any`:** ezek mellett `null`, más típusú érték, rögzítő getter és rögzítő Proxy, amelyek minden olvasást megfigyelhetővé tesznek.

   Minden próba elkapja a kivételt, így egy dobó bemenet mellett a többi is lefut.
3. **A kampány** a `param` fajtát mindkét bemeneti szerződéssel méri (`--inputs`), a gyors alapérték két új csoportot kapott.

## Bizonyíték

- **[multi-probe.test.mjs](../../tests/multi-probe.test.mjs):**
  - egy elágazással ütköző tömbművelet: egy próbával egyenértékűnek látszik, két próbával eltér;
  - a két szerződés próbakészlete;
  - két mag mindkét szerződéssel 0 hibás elfogadással.
- **Kampány, 5 mag, JS és TS:**
  - `any`: 2 033 sorrend/nyelv, 0 hibás elfogadás;
  - `valid`: 2 054 sorrend/nyelv, 0 hibás elfogadás, 2 rés (`for…of`).
- **Korpusz:** a rögzített számok változatlanok. `check:all` 1036/1036.

## Korlátok

- **A próbák rögzítettek:** több bemenet sem bizonyítja az egyenértékűséget, csak több helyen méri.
- **A korpusz fixture-jei** egyelőre egy próbával futnak, mert a feladatok bemenete a programon belül van.

## Tervezési review (ADR-037)

- **Hely:** a több próba az orákulum futtató részében van (`executeAll`), a paraméteres fajta a véletlen generátorok mellett.
- **Hívók:** változatlanok; a kampány a fajtagenerátornak a szerződést is átadja.
