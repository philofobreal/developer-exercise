# Tervezési review – Ousterhout-féle moduláris architektúra

Állapot: kötelező minden változtatásnál és minden review-nál ([ADR-037](adr/037-standing-design-review.md)). Forrás: John Ousterhout, *A Philosophy of Software Design* (magyarul: *A szoftvertervezés filozófiája*). A projektbeli alkalmazás a saját tervezési döntésünk, nem a könyv gépileg bizonyított megvalósítása.

A cél nem a minél több modul, hanem a **kisebb összetettség**: kevesebb függőség, kevesebb homály, és hogy egy változás ne gyűrűzzön tovább. A modult a benne elrejtett **tudás vagy döntés** határozza meg, nem a végrehajtási lépések sorrendje vagy a fájlméret.

## Mikor kell lefuttatni

- **Tervezéskor:** minden új modul, interfész vagy jelentős refaktorálás előtt. Legalább két tervet vázolunk („design it twice”), és a mélyebbet választjuk.
- **Implementáció után:** a saját kódon, a commit előtt.
- **Review-ban:** minden kódreview kötelező része, a helyességi szempontok mellett. A megállapítás kategóriája `design`.

## 1. Minden érintett modulra: tudás és interfész

Írd le egy-egy mondatban:

1. **Mit rejt el?** Melyik döntést vagy tudást birtokolja egyedül? Ha nincs ilyen, a modul felesleges vagy rossz helyen húzódik a határ.
2. **Mi az interfésze?** Milyen kevés és milyen egyszerű dolgot kell a hívónak tudnia? Mélynek az a modul számít, amelynek kicsi az interfésze és sok a mögötte rejtett megvalósítás.
3. **Ki a hívója, és mit kell neki tudnia?** Ha a hívónak ismernie kell a belső sorrendet, állapotot vagy adatszerkezetet, az szivárgás.

Új vagy szélesített nyilvános interfész előtt rögzítsd, mi marad elrejtve, mely hívók változnak és miért, és vezesd be ADR-be (AGENTS.md).

## 2. Figyelmeztető jelek (red flags)

| Jel | Mit keress | Jellemző javítás |
| --- | --- | --- |
| **Sekély modul** | Az interfész majdnem olyan összetett, mint a megvalósítás. | Összevonás, vagy a bonyolultság lehúzása a modulba. |
| **Információszivárgás** | Ugyanazt a döntést (formátum, szabály, sorrend) két modul is ismeri. | Egy tulajdonos; a többiek őt kérdezik. |
| **Időbeli felbontás** | A modulhatárok a végrehajtás lépéseit követik, nem a tudást. | A közös tudást birtokló modul. |
| **Időbeli csatolás** | A hívónak adott sorrendben kell több hívást vagy párhuzamos állapotot szinkronban tartania. | A modul birtokolja az állapotot, és egy műveletet ad. |
| **Túlexponálás** | A gyakori használathoz ritka részleteket is ismerni kell. | Jó alapértelmezések, kisebb interfész. |
| **Továbbító metódus vagy változó** | Egy réteg csak továbbad, saját absztrakció nélkül. | A réteg eltávolítása vagy valódi felelősség adása. |
| **Ismétlés** | Ugyanaz a nem triviális kód több helyen. | Egy közös, általános célú függvény a tudás tulajdonosánál. |
| **Speciális és általános keveredése** | Egy általános mechanizmusba beékelt különleges esetek. | Általánosabb mechanizmus, a különleges eset a hívónál. |
| **Összenőtt metódusok** | Az egyik nem érthető a másik nélkül. | Összevonás vagy a közös tudás külön modulba. |
| **A megjegyzés a kódot ismétli** | A megjegyzés nem mond többet a kódnál. | A megjegyzés a *miért*-et és az elvont jelentést írja le. |
| **Megvalósítási részlet az interfészleírásban** | A hívónak szóló leírás a belső működést magyarázza. | Az interfészleírás a szerződést írja le, a belső részletek a megvalósítás mellé kerülnek. |
| **Homályos vagy nehezen választható név** | A név nem mondja meg pontosan, mi ez, vagy több dolgot is jelenthetne. | Gyakran rossz bontás jele: gondold újra a határt. |
| **Nehéz leírni** | A modul vagy függvény szerződése nem fér el pár mondatban. | Rossz absztrakció: válaszd szét vagy vond össze. |
| **Nem nyilvánvaló kód** | Az olvasó csak hosszas nyomozással érti, mit csinál a kód és miért. | Jobb nevek, egyszerűbb szerkezet, a szerződés megjegyzésben. |

## 3. Elvek, amelyeket a tervnek követnie kell

- **Mély modulok:** kicsi interfész, sok elrejtett megvalósítás.
- **Információrejtés:** minden tervezési döntésnek egy tulajdonosa van. Gráf-, séma-, normalizálási és tartalomszabály nem duplikálható nézetben, vezérlőben vagy másik core-modulban (AGENTS.md).
- **A bonyolultság lefelé húzása:** inkább a modul legyen bonyolultabb, mint a hívói.
- **Különböző réteg, különböző absztrakció:** ha két szomszédos réteg ugyanazt az absztrakciót adja, az egyik felesleges.
- **A hibák kitervezése a létezésből:** olyan szemantika, amelyben a hibás eset nem fordulhat elő, vagy természetes jelentése van. Például a körkörös gráf „semmi nem ér el semmit”, nem félig számolt lezárt.
- **Általános célú modulok:** a modul a jelen igényt elégítse ki, de általános interfésszel; a különleges eset a hívónál maradjon.
- **Kétszer tervezni:** jelentős döntés előtt legalább két alternatívát érdemes összevetni.
- **A megjegyzés a terv része:** az interfész megjegyzése a szerződést és az elrejtett döntést írja le, előbb, mint a kód.
- **Stratégiai, nem taktikai programozás:** a gyors javítás nem hagyhat hátra szivárgást vagy különleges esetet; ha mégis, azt nyíltan rögzíteni kell (ADR vagy hátralévő munka).

## 4. Gépi ellenőrzés és emberi felelősség

- **Az [architektúra-kapu](../scripts/architecture-rules.ts) kikényszeríti:**
  - az importirányokat és a tiltott műveleteket;
  - a `information-hiding` szabályt: a core belső moduljait csak a tulajdonosuk importálhatja.
- **Ami review-feladat marad:** a mélység, a kohézió, a szivárgás és a nevek minősége. Ezeket statikus ellenőrzés nem bizonyítja; a fenti lista alapján, kimondva kell megítélni.
- **Új belső modul:** ha a modul egy döntést rejt el, és csak meghatározott hívóknak szól, vedd fel a kapu tulajdonoslistájába.
