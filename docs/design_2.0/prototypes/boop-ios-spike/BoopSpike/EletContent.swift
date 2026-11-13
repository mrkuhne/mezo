import SwiftUI

// The content of the seven areas. Each one is written as if it were its own product: a highlight worth
// reading, numbers you can act on, a real chart, a composition, detailed rows, and a menu of what else
// the area can do. Invented but realistic data — never the owner's real values.

enum EAreaContent {
    static func tabs(_ metric: Int) -> [ETab] {
        switch metric {
        case 5: return penz
        case 6: return nap
        case 7: return level
        case 1: return alvas
        case 2: return edzes
        case 3: return etel
        case 4: return energia
        default: return forma
        }
    }
    /// How much there is to look at in this area right now — the badge on its card.
    static func badge(_ metric: Int) -> Int { tabs(metric).reduce(0) { $0 + $1.badge } }

    private static let warm = Color(hex: 0xF2994A)

    // ───────────────────────────────────────────── Pénz
    /// Round 11 (owner): "nincsenek ikonok" — every section head that has a sensible glyph gets one.
    static func sectionGlyph(_ label: String) -> String? {
        switch label {
        case "A MAI HÍREK · AMI TÉGED ÉRINT": return "search-ink"
        case "A HÁROM REKESZ", "HONNAN JÖN EZ A SZÁM": return "scale-ink"
        case "MI VAN BENNE", "MIRE MEGY EL", "A JÁTÉKPÉNZ ALAKULÁSA", "A HÓNAP MENETE": return "chart-deep"
        case "AMI JÖN A KÖVETKEZŐ HÓNAPOKBAN": return "clock-ink"
        case "GYAKORLÁS", "A HÉT KERESKEDÉSEI": return "bolt-ink"
        case "A MAI TÉTELEK", "EZEN A HÉTEN": return "e-penz"
        case "MIRE GYŰJTÖK": return "star-sun"
        case "AMIT A HÉTEN LÁTOK", "AMIT ÉSZREVETTEM": return "spark-cream"
        case "A PÉNZ TERÜLET", "A GYAKORLÁS": return "plate-deep"
        default: return nil
        }
    }

    static let penz: [ETab] = [
        // ── Ma · "mi a dolgom ma?" — and on most days the answer is nothing.
        ETab(name: "Ma", blocks: [
            .highlight(label: "AMI MA SZÁMÍT", text: "Ma nincs dolgod a pénzeddel",
                       sub: "A hét kerete rendben, a hónap jól áll, és semmi nem jár le. Ha mégis vennél valamit, a *Költés* oldal megmondja, belefér-e."),
            .actions([EAction(glyph: "plus-ink", title: "Kiadás", primary: true),
                      EAction(glyph: "star-sun", title: "Befektetnék")]),
            .stats([EStat(value: "34 500", unit: "Ft", label: "ennyi maradt a hétből", hot: true),
                    EStat(value: "95 000", unit: "Ft", label: "a hónapból, 12 napra"),
                    EStat(value: "120 000", unit: "Ft", label: "ennyit tudsz befektetni")]),
            .news(label: "A MAI HÍREK · AMI TÉGED ÉRINT", items: [
                ENews(title: "A világ-ETF-ed 1,1%-ot esett a héten",
                      holding: "Világ-ETF", sleeve: "10+ év", holdingGlyph: "star-sun",
                      effect: "−18 400 Ft", effectNote: "a te részeden",
                      confidence: 2,
                      sources: ["Portfolio · A tengerentúli tőzsdék hete",
                                "Reuters · Global equities slip on rate outlook",
                                "Bloomberg · Tech leads the pullback",
                                "FT · Investors trim risk before the data",
                                "MNB adatszolgáltatás · árfolyamok",
                                "Az alapkezelő napi árfolyamközlése"],
                      when: "Ma 09:30 · 6 forrásból összevonva",
                      verdict: "Egy héten belüli mozgás a 10+ éves pénznél nem jelent semmit — a rekesz mérőszáma sem változott.",
                      body: "A hét eleji esés a kamatvárakozások átárazódásából jött, nem egyetlen cégből vagy iparágból. Az alapod a világ nagyjából 1 500 nagyvállalatát tartja, tehát pontosan azt csinálta, amit ilyenkor szokott: együtt mozgott a piaccal.\n\nA te rekeszed mérőszáma — *hány évnyi fix kiadásodat fedezi* — 4 év 8 hónapról 4 év 7 hónapra változott. Ez a fajta ingadozás havonta többször előfordul, és az elmúlt öt évben tizennyolcszor volt ennél nagyobb egyhetes esés ebben az alapban.\n\nAmiért ez egyáltalán felkerült ide: a szabályom szerint akkor szólok, ha a mozgás a *te* pénzedben forintban érzékelhető. 18 400 Ft az.",
                      uncertainty: "A hír megtörtént és az ár tény; a *miértje* viszont elemzői értelmezés, és a források sem értenek egyet abban, mennyi szól a kamatokról és mennyi a technológiai cégekről. Azt pedig, hogy innen merre megy, senki nem tudja — én sem.",
                      noAction: "Ez a pénz 10+ évre szól. Egy heti mozgás nem ok a lépésre, és nem is küldelek sehova."),
                ENews(title: "A jegybank nem változtatott az alapkamaton",
                      holding: "Állampapír", sleeve: "1–3 év", holdingGlyph: "scale-ink",
                      effect: "0 Ft", effectNote: "változatlan hozam",
                      confidence: 2,
                      sources: ["MNB · Monetáris Tanács közleménye",
                                "Portfolio · Maradt a kamatszint",
                                "Reuters · Hungary holds rates",
                                "Index · Mi lesz az állampapírokkal"],
                      when: "Ma 14:10 · 4 forrásból összevonva",
                      verdict: "A 2,4 milliós részed hozama változatlan. Azért írom ki, mert kamatdöntés volt — nem mert lépni kellene.",
                      body: "A papírod kamata az alapkamathoz van kötve, tehát a döntés közvetlenül érint — csak éppen úgy, hogy *nem történik semmi*. A következő kamatfordulód december 8-án lesz, az akkori szinttel.\n\nEzt a hírt akkor is kiteszem, ha nulla a hatás. Ha csak a mozgásokat mutatnám, azt hinnéd, hallgatásom azt jelenti, hogy nem történt semmi — pedig a „megtörtént, és nem érintett” más dolog, mint a „nem néztem meg”.",
                      uncertainty: "Itt kevés a bizonytalanság: a döntés hivatalos, a papírod képlete ismert. Amit nem tudok: hogy a következő üléseken mi lesz, és hogy az infláció hogyan alakul — a kettő együtt dönti el, mennyit ér ez a pénz reálisan.",
                      noAction: "A hozamod változatlan, a papír fut tovább. A következő döntési pontod a február 2-i lejárat."),
                ENews(title: "A forint 0,6%-ot erősödött az euróval szemben",
                      holding: "Deviza", sleeve: "5–10 év", holdingGlyph: "repeat-deep",
                      effect: "−7 200 Ft", effectNote: "forintban mérve",
                      confidence: 1,
                      sources: ["MNB · hivatalos középárfolyam",
                                "Portfolio · Erősödő forint",
                                "Reuters · Forint firms"],
                      when: "Ma 08:05 · 3 forrásból összevonva",
                      verdict: "Ez nem a befektetés mozgása, hanem az árfolyamé — ezt a kettőt mindig külön mutatom.",
                      body: "A devizában tartott részed ugyanannyi eurót ér, mint tegnap; forintban mérve kevesebbet, mert a forint erősödött. Ha holnap gyengül, ez magától visszajön — befektetési döntésed ettől nem lett se jobb, se rosszabb.\n\nEzért van a Pénzem oldalon két külön szám: *a befektetések mozgása* és *ebből az árfolyam*. Ha egybeolvasztanám őket, olyan teljesítményt mutatnék, amit a befektetés nem csinált.",
                      uncertainty: "Közepes biztonságra tettem, mert a magyarázat a bizonytalan rész: hogy pontosan mi erősítette a forintot ma, arról a három forrás három dolgot mond. Maga az árfolyam és a te forintértéked viszont tény.",
                      noAction: "Árfolyammozgás, nem befektetési esemény. Ha holnap gyengül a forint, magától visszajön."),
            ]),
            .info(label: "Hogyan készül ez az összefoglaló?",
                  body: "Csak azt hozom ide, ami a *te meglévő befektetéseidet* érinti, és csak akkor, ha tartósan számít: szabályozás, technológia, iparági szerkezet, vagy a hosszú távú számok. A napon belüli hullámzást kiszűröm.\n\nAz azonos eseményről szóló cikkeket egy hírbe vonom össze, és odaírom, hány forrásból. Minden forintösszeget *a rendszer számol ki* a te adataidból — a szöveget írom, a számokat nem —, és mindegyik mellé odaírom, mikori.\n\nMinden hírnél kiírom, mennyire vagyok biztos benne, és hol tévedhetek. Soha nincs itt „vedd meg” vagy „add el”."),
            .menu(label: "A PÉNZ TERÜLET", items: [
                EMenuItem(glyph: "plus-ink", name: "Kiadás", sub: "Készpénz, pár másodperc"),
                EMenuItem(glyph: "star-sun", name: "Nagyobb összeg", sub: "Boop kutat és javasol felosztást"),
                EMenuItem(glyph: "repeat-deep", name: "Havi stratégia", sub: "A fizetésedből és a költésedből"),
                EMenuItem(glyph: "book-sage", name: "Kimutatás", sub: "Hónapok, évek, letöltés")]),
            .ask("Kérdezd meg Boopot a pénzedről"),
        ]),

        // ── Pénzem · the portfolio, by horizon. The practice money is NOT in the total.
        ETab(name: "Pénzem", blocks: [
            .stats([EStat(value: "6 418 000", unit: "Ft", label: "amid most van"),
                    EStat(value: "+2,1", unit: "%", label: "a befektetések mozgása", trend: 1),
                    EStat(value: "−0,4", unit: "%", label: "ebből az árfolyam", trend: -1)]),
            .actions([EAction(glyph: "plus-ink", title: "Befektetést rögzítek", primary: true),
                      EAction(glyph: "star-sun", title: "Felosztást kérek")]),
            .info(label: "Mikoriak ezek az árak?",
                  body: "A tőzsdei árak a *tegnapi záróárak*, ma 07:00-kor frissültek. Az állampapír nem tőzsdei, azt a kamatból számolom, a devizát az MNB középárfolyamán.\n\nNapon belüli árat nem használok. A te időtávjaidon — egy évtől tizenötig — egy délelőtti mozgás nem mond semmit, viszont nézegetni csábít, és pont ez az, amit ez az oldal nem akar."),
            .rowlist(label: "A HÁROM REKESZ", rows: [
                ERow(glyph: "scale-ink", title: "1–3 év", sub: "Biztonság · állampapír, pénzpiac", right: "2 400 000", rightSub: "Ft · 37%", level: 0.37),
                ERow(glyph: "chart-deep", title: "5–10 év", sub: "Vegyes · ETF és kötvény", right: "1 860 000", rightSub: "Ft · 29%", level: 0.29),
                ERow(glyph: "star-sun", title: "10+ év", sub: "Növekedés · 4 év 7 hónapnyi fix kiadásod", right: "2 158 000", rightSub: "Ft · 34%", level: 0.34)],
                more: "Egy rekesz megnyitása"),
            .info(label: "Miért évek a hosszú rekesz mérőszáma?",
                  body: "A 10+ éves rekesznél nem a mai százalékot mutatom, mert az egy tizenöt éves pénznél félrevezető: egy rossz hét „−1,1%”-ként pánikot kelt, pedig semmit nem jelent.\n\nHelyette ezt: *ahogy most áll, növekedést nem feltételezve, ez a rekesz 4 év 7 hónap fix kiadásodat fedezi.* Növekedést azért nem számolok bele, mert azt nem tudom megígérni — és mert így a szám csak akkor nő, ha tényleg teszel bele."),
            .composition(label: "MI VAN BENNE", parts: [
                EPart(name: "Állampapír", value: 2_400_000, color: Color(hex: 0x2E8B57)),
                EPart(name: "Világ-ETF", value: 2_040_000, color: Color(hex: 0x4FBF86)),
                EPart(name: "Kötvény-ETF", value: 920_000, color: Color(hex: 0x8FDCB4)),
                EPart(name: "Részvény", value: 638_000, color: warm),
                EPart(name: "Deviza", value: 420_000, color: Color(hex: 0xC9EFD9))],
                note: "Ugyanaz a világ-ETF *két rekeszben* is ott van, külön darabszámmal — mert 7 évre és 15 évre nem ugyanazt jelenti."),
            .rowlist(label: "AMI JÖN A KÖVETKEZŐ HÓNAPOKBAN", rows: [
                ERow(glyph: "clock-ink", title: "Állampapír kamatfordulója", sub: "December 8. · 1 200 000 Ft-os rész", right: "+34 200", rightSub: "Ft kamat"),
                ERow(glyph: "repeat-deep", title: "Világ-ETF osztalékfizetés", sub: "December 19. · a 10+ rekeszből", right: "+8 900", rightSub: "Ft"),
                ERow(glyph: "scale-ink", title: "Állampapír lejárata", sub: "Február 2. · ekkor el kell dönteni, mi legyen vele", right: "1 200 000", rightSub: "Ft", badge: 1)],
                more: "A teljes időrend"),
            .rowlist(label: "GYAKORLÁS", rows: [
                ERow(glyph: "bolt-ink", title: "A játékpénz", sub: "Papír-próba · nem számít bele a fentibe", right: "+1 200", rightSub: "Ft a hónapban")],
                more: "Át a Gyakorlás oldalra"),
            .ask("Kérdezd meg Boopot a rekeszeidről"),
        ]),

        // ── Költés · the weekly remainder is the headline, and its derivation is one tap away.
        ETab(name: "Költés", badge: 2, blocks: [
            .level(label: "EZEN A HÉTEN", big: "34 500", unit: "Ft", right: "4 nap van hátra",
                   note: "Napi *8 600 Ft*. A hét eddigi költése 42 500 Ft volt.", value: 0.45, marker: 0.57),
            .actions([EAction(glyph: "plus-ink", title: "Kiadás", primary: true),
                      EAction(glyph: "search-ink", title: "2 tétel ellenőrzése")]),
            .rowlist(label: "HONNAN JÖN EZ A SZÁM", rows: [
                ERow(glyph: "plus-ink", title: "Ami bejön", sub: "Fizetés és egyéb bevétel", right: "+ 980 000", rightSub: "Ft"),
                ERow(glyph: "clock-ink", title: "Fix kiadások", sub: "Lakás, rezsi, előfizetések, bérletek", right: "− 412 000", rightSub: "Ft"),
                ERow(glyph: "star-sun", title: "Amit félreteszel", sub: "Megtakarítás és befektetés", right: "− 220 000", rightSub: "Ft"),
                ERow(glyph: "bolt-ink", title: "Gyakorlás", sub: "A havi játékkeret — külön sor, hogy ne a befektetésből menjen", right: "− 20 000", rightSub: "Ft"),
                ERow(glyph: "scale-ink", title: "Az előző hónap hiánya", sub: "Októberben 14 000 Ft-tal csúsztál el", right: "− 14 000", rightSub: "Ft"),
                ERow(glyph: "check-ink", title: "Ami szabadon marad", sub: "Ezt osztom szét a hónap hetei között", right: "314 000", rightSub: "Ft", hot: true)],
                more: "Egy sor módosítása"),
            .stats([EStat(value: "219 000", unit: "Ft", label: "elköltve a hónapban"),
                    EStat(value: "95 000", unit: "Ft", label: "ami még maradt", hot: true),
                    EStat(value: "7 900", unit: "Ft/nap", label: "a mostani tempód", trend: -1)]),
            .composition(label: "MIRE MEGY EL", parts: [
                EPart(name: "Élelmiszer", value: 96_400, color: Color(hex: 0x2E8B57)),
                EPart(name: "Éttermek", value: 48_000, color: warm),
                EPart(name: "Közlekedés", value: 31_200, color: Color(hex: 0x4FBF86)),
                EPart(name: "Sport", value: 24_000, color: Color(hex: 0x8FDCB4)),
                EPart(name: "Minden más", value: 19_400, color: Color(hex: 0xC9EFD9))],
                note: "A változó költésed *66%-a* élelmiszer és étterem."),
            .rowlist(label: "A MAI TÉTELEK", rows: [
                ERow(glyph: "bowl-cream", title: "Spar", sub: "Élelmiszer · 12:06 · banki üzenetből", right: "8 240", rightSub: "Ft", photo: "salata-sq.jpg"),
                ERow(glyph: "honey-sun", title: "Kávézó", sub: "Éttermek · 10:40 · készpénz, kézzel", right: "1 890", rightSub: "Ft", photo: "kave-sq.jpg"),
                ERow(glyph: "search-ink", title: "Két üzenet ellenőrzésre vár", sub: "Nem tudtam biztosan, melyik kategória", right: "6 420", rightSub: "Ft", badge: 2, hot: true)],
                more: "A hónap összes tétele · 84 db"),
            .rowlist(label: "MIRE GYŰJTÖK", rows: [
                ERow(glyph: "star-sun", title: "Tartalék · 6 hónap", sub: "4 hónap 2 hét összejött", right: "1 480 000", rightSub: "a 2 100 000-ből", level: 0.7),
                ERow(glyph: "leaf-sage", title: "Nyári út", sub: "Júniusra kell · jó tempóban vagy", right: "320 000", rightSub: "a 600 000-ből", level: 0.53),
                ERow(glyph: "shoe-cream", title: "Futócipő", sub: "Boop szerint januárban a legjobb · három lehetőséggel", right: "30 590", rightSub: "Ft", badge: 1)],
                more: "Cél vagy vásárlás hozzáadása"),
            .actions([EAction(glyph: "check-ink", title: "Hónap lezárása"),
                      EAction(glyph: "repeat-deep", title: "Keretek")]),
            .info(label: "Mi történik a hónap végén?",
                  body: "30-án lezárom a hónapot, és megkérdezem, mi legyen a maradékkal: *átviszed* a következő hónapra, *átteszed* a megtakarításba, vagy *hagyod*. Semmi nem történik magától.\n\nHa mínuszban zártál, a hiány a következő hónap levezetésében külön sorként jelenik meg — nem tüntetem el, és nem is írom felül a múltat."),
            .ask("Kérdezd meg Boopot, belefér-e valami"),
        ]),

        // ── Gyakorlás · day trading as learning. Paper first, owner-typed, no live tape.
        ETab(name: "Gyakorlás", badge: 1, blocks: [
            .highlight(label: "A HETI VISSZANÉZÉS", text: "A terv nélküli belépések vitték el a hetet",
                       sub: "Négy kereskedésből háromnál előre leírtad, hol lépsz ki — azok átlagban *+0,8R*-t hoztak. A negyediknél nem írtad le, és az *−1,7R* lett. Ez a hét leggyakoribb hibája, és *5 100 Ft-ba* került."),
            .actions([EAction(glyph: "pen-sun", title: "Új kereskedés", primary: true),
                      EAction(glyph: "book-sage", title: "A teljes napló")]),
            .stats([EStat(value: "+1 200", unit: "Ft", label: "a hónapban, papíron"),
                    EStat(value: "0,3", unit: "R", label: "az átlagod kereskedésenként"),
                    EStat(value: "12 / 20 000", unit: "Ft", label: "ennyi a keretből elkelt")]),
            .curve(label: "A JÁTÉKPÉNZ ALAKULÁSA", values: [0.5, 0.54, 0.47, 0.52, 0.61, 0.56, 0.58],
                   labels: ["H", "K", "Sze", "Cs", "P", "Szo", "V"], target: 0.5, now: 6,
                   note: "A szaggatott vonal a kiindulás. Hét kereskedési nap — *ez még túl kevés ahhoz, hogy bármit jelentsen.*"),
            .rowlist(label: "A HÉT KERESKEDÉSEI", rows: [
                ERow(glyph: "check-ink", title: "OTP · kitörés", sub: "Terv megvolt · kilépés a szintnél", right: "+1,9", rightSub: "R"),
                ERow(glyph: "check-ink", title: "Nasdaq-ETF · visszateszt", sub: "Terv megvolt · stop vitte ki", right: "−1,0", rightSub: "R"),
                ERow(glyph: "check-ink", title: "Mol · nyitási tartomány", sub: "Terv megvolt · kézzel zártad korábban", right: "+0,5", rightSub: "R"),
                ERow(glyph: "bolt-ink", title: "Richter · hírre ugrottam", sub: "Nem írtad le, hol lépsz ki · hiba megjelölve", right: "−1,7", rightSub: "R", badge: 1)],
                more: "Egy kereskedés megnyitása"),
            .list(label: "AMIT A HÉTEN LÁTOK", items: [
                ("A terv a döntő", "Amikor előre leírtad a kilépési szintet, az átlagod +0,8R. Amikor nem, −1,7R. Négy kereskedésnél ez még nem bizonyíték, csak feltűnő."),
                ("A hírre belépés a gyenge pont", "Mind a kettő veszteséges volt, amit friss hír után nyitottál."),
                ("A nyereséges kereskedéseket korán zárod", "Kettőből kettőt a tervezett szint előtt zártál be.")]),
            .info(label: "Mit jelent az R, és miért papíron megy?",
                  body: "Most *papíron* megy: valódi záróárakkal, de valódi pénz nélkül — ezt te fordítod élesre, amikor készen állsz.\n\nAz *R* azt jelenti, hogy a kockáztatott összeghez képest mennyit hozott egy kereskedés. Ha 2 000 Ft-ot kockáztattál és 3 800-at hozott, az +1,9R. Így a pozíció mérete nem tudja elrejteni az igazságot: egy nagy nyereség kis kockázattal többet ér, mint egy nagy nyereség óriási kockázattal.\n\nMinden adat a te beírt belépő, kilépő és kilépési szintedből számol: *élő árfolyamot nem figyelek, és a stopodat sem én őrzöm.* Ötven jelölt kereskedés alatt a százalékok még zajnak számítanak, és ezt mindig kiírom."),
            .menu(label: "A GYAKORLÁS", items: [
                EMenuItem(glyph: "pen-sun", name: "Új terv", sub: "Mit, miért, hol lépek ki"),
                EMenuItem(glyph: "leaf-sage", name: "Címkék", sub: "Nyolc, szándékosan nem húsz"),
                EMenuItem(glyph: "scale-ink", name: "A keret", sub: "Havi 20 000 Ft · nem nyúl a többihez"),
                EMenuItem(glyph: "star-sun", name: "Élesre fordítás", sub: "Amikor te úgy döntesz")]),
            .ask("Kérdezd meg Boopot a hetedről"),
        ]),
    ]


    // ───────────────────────────────────────────── Nap · a nap telítettsége (B7 given a home)
    static let nap: [ETab] = [
        ETab(name: "Ma", badge: 1, blocks: [
            .highlight(label: "AMI MA SZÁMÍT", text: "14 és 17:30 között nincs levegő",
                       sub: "Három hívás egymás után, köztük tíz perc. Utána viszont tiéd a nap — ezért tettem az edzést 18:30-ra."),
            .stats([EStat(value: "6", unit: "esemény", label: "ma a naptáradban"),
                    EStat(value: "72", unit: "%", label: "ennyire van tele a napod", trend: 1, hot: true),
                    EStat(value: "2ó 10p", unit: "", label: "összefüggő szabad idő")]),
            .curve(label: "MENNYI ENERGIÁD MARAD", values: [0.45, 0.68, 0.82, 0.78, 0.6, 0.42, 0.5, 0.72, 0.64, 0.38],
                   labels: ["6", "8", "10", "12", "14", "16", "18", "20", "22", ""], target: 0.5, now: 4,
                   note: "A szaggatott vonal az, ami alatt már nehéz bármit elkezdeni. Ma kétszer mész alá: 15 körül és este tíz után."),
            .rowlist(label: "A MAI ESEMÉNYEK", rows: [
                ERow(glyph: "clock-ink", title: "Heti tervezés", sub: "09:00 · 60 perc · felkészülve", right: "köze pes", rightSub: "terhelés", level: 0.5),
                ERow(glyph: "person-sage", title: "Ügyfélhívás · Nagy Péter", sub: "10:30 · 90 perc · nincs jegyzeted hozzá", right: "nehéz", rightSub: "terhelés", level: 0.88, badge: 1, hot: true),
                ERow(glyph: "clock-ink", title: "Csapatmegbeszélés", sub: "14:00 · 45 perc · felkészülve", right: "könnyű", rightSub: "terhelés", level: 0.3),
                ERow(glyph: "person-sage", title: "Ügyfélhívás · csúszhat", sub: "16:00 · 90 perc · ez szokott elhúzódni", right: "nehéz", rightSub: "terhelés", level: 0.82),
                ERow(glyph: "dumbbell-ink", title: "Felsőtest edzés", sub: "18:30 · 75 perc · te tetted ide", right: "közepes", rightSub: "terhelés", level: 0.55)],
                more: "A hét naptára"),
            .note(label: "HOGYAN PONTOZOM", body: "Minden eseményre megbecsülöm, mennyi fejmunkát, mennyi társas energiát és mennyi fizikai terhelést visz, és hogy mennyire vagy rá felkészülve. Ezt összevetem azzal, mennyi energiád van ma — az alvásodból, a pulzusváltozékonyságodból és az elmúlt napok terheléséből. A becslés az első hetekben tanul: amíg nincs elég check-ined, a számok tájékoztató jellegűek, és ezt ki is írom."),
            .menu(label: "A NAP TERÜLET", items: [
                EMenuItem(glyph: "clock-ink", name: "Napirend", sub: "A mai nap percről percre"),
                EMenuItem(glyph: "repeat-deep", name: "Naptárak", sub: "Melyik naptárt olvassa"),
                EMenuItem(glyph: "chart-deep", name: "Pontozás", sub: "Mi számít nehéz napnak", badge: 1),
                EMenuItem(glyph: "pen-sun", name: "Felkészülés", sub: "Amihez jegyzet vagy idő kell"),
                EMenuItem(glyph: "spark-cream", name: "Mire marad erőd", sub: "Mit bír még el a mai napod"),
                EMenuItem(glyph: "book-sage", name: "Előzmények", sub: "Hetek, zsúfoltság, kimerülés")]),
            .ask("Kérdezd meg Boopot a mai napodról"),
        ]),
        ETab(name: "Napirend", blocks: [
            .list(label: "A NAPOD, SORBAN", items: [
                ("06:53 · Ébredés", "7ó 12p alvás, ebből 1ó 36p mély"),
                ("07:20 · Reggeli check-in", "Energia 7 · hangulat 8 · feszültség 4"),
                ("08:00 · A reggeli posta", "34 levél · 31 elintézve · 2 megér egy percet"),
                ("08:20 · Reggeli", "Zabkása áfonyával · 32 g fehérje"),
                ("09:00 · Megbeszélések · 4 esemény", "9:00–12:00 · legsűrűbb 10:30-kor"),
                ("12:06 · Spar · 8 240 Ft", "A banki üzenetből, magától"),
                ("12:40 · Ebéd", "Csirke rizzsel, salátával · 46 g fehérje"),
                ("14:00 · Megbeszélések · 3 esemény", "14:00–17:30 · az ügyfélhívás csúszhat"),
                ("16:00 · Délutáni check-in", "3 kérdés · fél perc"),
                ("18:30 · Felsőtest edzés", "75 perc · 5 gyakorlat"),
                ("19:45 · Vacsora", "Boop: legalább 50 g fehérje"),
                ("21:30 · Esti zárás", "Kevesebb mint egy perc"),
                ("22:45 · Lefekvés", "Emlékeztetlek 22:15-kor")]),
            .ask("Kérdezd meg Boopot, hogy fér-e bele még valami"),
        ]),
        ETab(name: "Hét", blocks: [
            .heat(label: "MENNYIRE TELÍTETTEK A NAPJAID", cells: [("H", 0.55), ("K", 0.7), ("Sze", 0.95), ("Cs", 0.72), ("P", 0.6), ("Szo", 0.15), ("V", 0.1)],
                  note: "Szerda volt a legzsúfoltabb — és aznap aludtál a legkevesebbet. Ez a kettő nálad együtt jár."),
            .list(label: "AMIT ÉSZREVETTEM", items: [
                ("A zsúfolt nap másnapja is drága", "A 90% fölötti napok után a Formád átlagosan 9 ponttal alacsonyabb."),
                ("A hosszú hívások csúsznak", "Az ügyfélhívásaid 60%-a túllép a tervezett időn, átlagosan 18 perccel."),
                ("A szabad délután ritka", "Két hét alatt egyszer volt két óránál hosszabb összefüggő szabad időd.")]),
            .ask("Kérdezd meg Boopot a heti terhelésedről"),
        ]),
    ]

    // ───────────────────────────────────────────── Levél
    static let level: [ETab] = [
        ETab(name: "Ma", badge: 2, blocks: [
            .highlight(label: "MEGÉR EGY PERCET", text: "A futócipő, amit figyelsz, ma tényleg olcsó",
                       sub: "30 590 Ft. Négy boltot néztem meg: a szokásos ára 38 400, a legolcsóbb másik 36 900. Ez az eddigi legjobb ár, amit láttam rá."),
            .stats([EStat(value: "34", unit: "levél", label: "érkezett reggel óta"),
                    EStat(value: "31", unit: "", label: "elintéztem helyetted"),
                    EStat(value: "2", unit: "", label: "megér egy percet", hot: true)]),
            .heat(label: "MIKOR ÉRKEZIK", cells: [("6", 0.1), ("8", 0.9), ("10", 0.45), ("12", 0.3), ("14", 0.6), ("16", 0.25), ("18", 0.15), ("20", 0.05)],
                  note: "A legtöbb reklám 8 és 9 között jön — ezért nézek bele 08:00-kor. A második futás 15:00-kor."),
            .mail(label: "AMIT NÉZZ MEG", items: [
                MailItem(from: "Futóbolt", what: "A kinézett futócipő 32%-kal olcsóbb", score: 9,
                         price: "30 590 Ft. Négy boltban néztem meg: a szokásos ára 38 400 Ft, a legolcsóbb máshol most 36 900 Ft.",
                         goal: "A mostani cipőd 780 km-nél jár, és a nyári célodhoz heti három futás kell.", verdict: 0),
                MailItem(from: "Fehérjebolt", what: "Akció a szokásos fehérjeporodra", score: 6,
                         price: "12 990 Ft 2 kg-ra. Pontosan ugyanannyi, mint amennyiért márciusban vetted — ez nem akció.",
                         goal: "Van még kb. három heted a jelenlegi zacskóból, nem sürgős.", verdict: 1)]),
            .rowlist(label: "AMIT ELINTÉZTEM HELYETTED", rows: [
                ERow(glyph: "e-level", title: "Hírlevelek", sub: "Elolvastam, egyik sem kötődik a céljaidhoz", right: "14", rightSub: ""),
                ERow(glyph: "honey-sun", title: "Reklám", sub: "Márkák, amiket sosem nyitsz meg", right: "11", rightSub: ""),
                ERow(glyph: "check-ink", title: "Számlák, értesítők", sub: "Rendben vannak, semmi teendő", right: "4", rightSub: ""),
                ERow(glyph: "scale-ink", title: "Belépési kódok", sub: "Ezekbe nem néztem bele, és nem is küldtem sehova", right: "2", rightSub: "")],
                more: "A mai posta teljes listája"),
            .menu(label: "A LEVÉL TERÜLET", items: [
                EMenuItem(glyph: "star-sun", name: "Figyelt", sub: "Termékek, amikre szólok", badge: 3),
                EMenuItem(glyph: "scale-ink", name: "Szabályok", sub: "Mibe nézhet bele és mibe nem"),
                EMenuItem(glyph: "person-sage", name: "Fiókok", sub: "Gmail és iCloud"),
                EMenuItem(glyph: "clock-ink", name: "Időzítés", sub: "Mikor fusson, mikor szóljon"),
                EMenuItem(glyph: "search-ink", name: "Keresés", sub: "Az eddigi összefoglalókban"),
                EMenuItem(glyph: "chart-deep", name: "Árnapló", sub: "Amit a Boop eddig látott")]),
            .ask("Kérdezd meg Boopot a mai postáról"),
        ]),
        ETab(name: "Figyelt", badge: 3, blocks: [
            .note(label: "MIT FIGYELEK", body: "Megmondod, mi érdekel, és csak akkor szólok, ha az ár tényleg alacsonyabb, mint amit máshol látok — nem akkor, ha csak rá van írva, hogy akció."),
            .rowlist(label: "AMIKET FIGYELEK", rows: [
                ERow(glyph: "shoe-cream", title: "Futócipő · 42-es", sub: "Ma jött rá a legjobb ár", right: "30 590", rightSub: "Ft · ma", badge: 1, hot: true),
                ERow(glyph: "bowl-cream", title: "Fehérjepor · vanília 2 kg", sub: "Idei legolcsóbb: augusztus", right: "11 400", rightSub: "Ft"),
                ERow(glyph: "scale-ink", title: "Okosmérleg", sub: "Hat hete figyelem, még nem volt olcsó", right: "—", rightSub: "")],
                more: "Új figyelés"),
            .curve(label: "A FUTÓCIPŐ ÁRA, AMIÓTA FIGYELEM", values: [0.95, 0.92, 0.98, 0.9, 0.93, 0.88, 0.95, 0.62],
                   labels: ["Szep", "", "Okt", "", "", "Nov", "", "ma"], target: nil, now: 7,
                   note: "Ezt a Boop a hozzád érkező levelekből gyűjti. Pár hónap alatt saját áremlékezete lesz a te termékeidről."),
            .ask("Kérdezd meg Boopot, mikor érdemes venni"),
        ]),
        ETab(name: "Szabályok", blocks: [
            .highlight(label: "A LÉNYEG", text: "A személyes leveleidbe gép nem néz bele",
                       sub: "Bank, biztosító, hivatal, orvosi levél és belépési kód sosem kerül gépi elemzésbe. Csak annyit mondok róluk, hogy megérkeztek."),
            .rowlist(label: "AMIBE SOSEM NÉZEK BELE", rows: [
                ERow(glyph: "scale-ink", title: "Bank, biztosító, hivatal", sub: "Csak jelzem, hogy jött", right: "", rightSub: ""),
                ERow(glyph: "check-ink", title: "Belépési kódok", sub: "Felismerem a feladóról, azonnal félreteszem", right: "", rightSub: ""),
                ERow(glyph: "heart-cream", title: "Orvosi, egészségügyi", sub: "Csak ha külön megkéred", right: "", rightSub: "")],
                more: ""),
            .note(label: "AMIT TÖRLÖK, MIELŐTT BÁRMI TÖRTÉNNE", body: "A nyomkövető képeket, a téged azonosító linkeket, a rendelési számokat és a saját e-mail-címedet. Ami a gépi elemzéshez eljut, az a reklámszöveg, a terméknév és az ár — vagyis az, amit több millió másik embernek is kiküldtek."),
            .menu(label: "BEÁLLÍTÁSOK", items: [
                EMenuItem(glyph: "person-sage", name: "Feladó tiltása", sub: "Akitől sosem akarsz hallani"),
                EMenuItem(glyph: "plus-ink", name: "Új szabály", sub: "Téma, feladó vagy kulcsszó")]),
            .ask("Kérdezd meg Boopot, mit lát a leveleidből"),
        ]),
        ETab(name: "Fiókok", blocks: [
            .rowlist(label: "A POSTAFIÓKJAID", rows: [
                ERow(glyph: "e-level", title: "Gmail", sub: "Csak olvasás · utoljára 08:00-kor", right: "aktív", rightSub: ""),
                ERow(glyph: "e-level", title: "iCloud", sub: "Csak olvasás · utoljára 08:00-kor", right: "aktív", rightSub: "")],
                more: "Fiók hozzáadása"),
            .note(label: "HOGYAN KAPCSOLÓDIK", body: "Mindkét fiókhoz te hozol létre egy külön kulcsot a saját fiókod beállításaiban, és te írod be — a jelszavadat soha nem kérem és nem látom. A kulcs bármikor visszavonható, és akkor a Boop azonnal elveszti a hozzáférést."),
            .heat(label: "MENNYI JÖN NAPONTA", cells: [("H", 0.6), ("K", 0.74), ("Sze", 0.52), ("Cs", 0.91), ("P", 0.68), ("Szo", 0.3), ("V", 0.22)],
                  note: "Hetente átlagosan 212 levél. Ebből 14 volt az, amit tényleg megnyitottál."),
            .ask("Kérdezd meg Boopot a postafiókjaidról"),
        ]),
    ]

    // ───────────────────────────────────────────── Étel
    static let etel: [ETab] = [
        ETab(name: "Ma", badge: 1, blocks: [
            .highlight(label: "AMI MA SZÁMÍT", text: "A fehérje megint elmarad",
                       sub: "38 g a 165-ből, ebéd után. A vacsoránál legalább 50 grammra lesz szükség — egy csirkés tál pont ennyit hoz."),
            .stats([EStat(value: "1 180", unit: "kcal", label: "a 2 350-ből"),
                    EStat(value: "38", unit: "g", label: "fehérje a 165-ből", trend: -1, hot: true),
                    EStat(value: "2", unit: "étkezés", label: "eddig, a négyből")]),
            .curve(label: "A NAP MENETE", values: [0, 0.04, 0.17, 0.18, 0.2, 0.5, 0.5, 0.52, 0.72, 0.95],
                   labels: ["6", "8", "", "10", "12", "", "14", "16", "18", "20"],
                   target: 1.0, now: 4,
                   note: "A görbe vége a mai terv: a vacsora után éred el a keretet."),
            .composition(label: "MAKRÓK MA", parts: [
                EPart(name: "Fehérje", value: 38, color: Color(hex: 0x4FBF86)),
                EPart(name: "Szénhidrát", value: 142, color: Color(hex: 0xA6E8C8)),
                EPart(name: "Zsír", value: 41, color: Color(hex: 0xF4C860))],
                note: "A fehérje aránya ma 16% — a célod 28% körül van."),
            .rowlist(label: "AMIT MA ETTÉL", rows: [
                ERow(glyph: "bowl-cream", title: "Zabkása áfonyával", sub: "Reggeli · 08:20 · fotóval", right: "410", rightSub: "kcal · 32 g"),
                ERow(glyph: "honey-sun", title: "Kávé tejjel", sub: "Nasi · 10:40", right: "150", rightSub: "kcal · 4 g"),
                ERow(glyph: "plate-deep", title: "Csirke rizzsel, salátával", sub: "Ebéd · 12:40 · fotóval", right: "620", rightSub: "kcal · 46 g"),
                ERow(glyph: "fish-peach", title: "Vacsora", sub: "19:45 · még nincs · Boop: 50 g fehérje", right: "—", rightSub: "", hot: true)],
                more: "A hét összes étkezése"),
            .menu(label: "AZ ÉTEL TERÜLET", items: [
                EMenuItem(glyph: "camera-ink", name: "Fotóval", sub: "Lefotózod, a Boop felismeri"),
                EMenuItem(glyph: "search-ink", name: "Vonalkód", sub: "Bolti termék egy pillanat alatt"),
                EMenuItem(glyph: "book-sage", name: "Receptek", sub: "A sajátjaid és amit ajánlok", badge: 3),
                EMenuItem(glyph: "leaf-sage", name: "Kamra", sub: "Mi van itthon", badge: 4),
                EMenuItem(glyph: "drop-sky", name: "Víz", sub: "1,4 l a 2,5-ből ma"),
                EMenuItem(glyph: "flame-peach", name: "Kiegészítők", sub: "A napi stackod · 2 maradt", badge: 2)]),
            .ask("Kérdezd meg Boopot az étkezésedről"),
        ]),
        ETab(name: "Receptek", badge: 3, blocks: [
            .highlight(label: "AMI MA BEFÉRNE", text: "Három recept, ami pont a hiányzó fehérjét hozza",
                       sub: "Mindhárom belefér a mai maradék keretbe, és kettőhöz minden megvan a kamrádban."),
            .rowlist(label: "VACSORÁRA", rows: [
                ERow(glyph: "plate-deep", title: "Csirkés tál édesburgonyával", sub: "25 perc · minden megvan itthon", right: "640", rightSub: "kcal · 52 g", badge: 1, hot: true),
                ERow(glyph: "fish-peach", title: "Tonhalas tészta", sub: "18 perc · a tonhal hiányzik", right: "580", rightSub: "kcal · 46 g"),
                ERow(glyph: "bowl-cream", title: "Túrós-tojásos rakott", sub: "30 perc · minden megvan itthon", right: "520", rightSub: "kcal · 48 g")],
                more: "Az összes recepted · 42 db"),
            .menu(label: "TOVÁBB", items: [
                EMenuItem(glyph: "plus-ink", name: "Új recept", sub: "Kézzel vagy linkből"),
                EMenuItem(glyph: "star-sun", name: "Kedvencek", sub: "Amit sűrűn főzöl"),
                EMenuItem(glyph: "leaf-sage", name: "Bevásárlólista", sub: "A hét receptjeiből", badge: 1),
                EMenuItem(glyph: "scale-ink", name: "Allergének", sub: "Amit kerülsz")]),
            .ask("Kérdezd meg Boopot, mit főzz"),
        ]),
        ETab(name: "Kamra", badge: 4, blocks: [
            .stats([EStat(value: "34", unit: "tétel", label: "van itthon"),
                    EStat(value: "4", unit: "", label: "a héten lejár", hot: true),
                    EStat(value: "9", unit: "", label: "a bevásárlólistán")]),
            .rowlist(label: "AMI HAMAROSAN LEJÁR", rows: [
                ERow(glyph: "bowl-cream", title: "Görög joghurt", sub: "2 pohár", right: "2", rightSub: "nap", badge: 1, hot: true),
                ERow(glyph: "leaf-sage", title: "Spenót", sub: "1 zacskó", right: "3", rightSub: "nap"),
                ERow(glyph: "fish-peach", title: "Csirkemell", sub: "Fagyasztóban · 400 g", right: "—", rightSub: "")],
                more: "A teljes kamra · 34 tétel"),
            .ask("Kérdezd meg Boopot, mit főzz abból, ami itthon van"),
        ]),
        ETab(name: "Hét", blocks: [
            .curve(label: "FEHÉRJE A HÉTEN", values: [0.9, 0.72, 0.55, 0.23, 0.8, 0.66, 0.5],
                   labels: ["H", "K", "Sze", "Cs", "P", "Szo", "V"], target: 1.0, now: 3,
                   note: "14 napból 9-en maradtál a cél alatt, átlagosan 22 grammal. Ez a nyári célod legnagyobb fékje."),
            .heat(label: "MIKOR ESZEL", cells: [("H", 0.6), ("K", 0.7), ("Sze", 0.5), ("Cs", 0.8), ("P", 0.4), ("Szo", 0.9), ("V", 0.3)],
                  note: "A sötétebb nap azt jelenti, hogy későbbre csúsztak az étkezések. A késői vacsorák után 24 perccel kevesebbet alszol."),
            .ask("Kérdezd meg Boopot a heti étkezésedről"),
        ]),
    ]

    // ───────────────────────────────────────────── Edzés
    static let edzes: [ETab] = [
        ETab(name: "Ma", badge: 1, blocks: [
            .highlight(label: "MA ESTE", text: "Felsőtest · a mezociklus 3. hete",
                       sub: "75 perc, öt gyakorlat. A fekvenyomásnál 2,5 kg-mal többet javaslok, mert múlt héten mindhárom sorozat könnyen ment."),
            .stats([EStat(value: "1 240", unit: "lépés", label: "a napi 8 000-ből", trend: -1),
                    EStat(value: "75", unit: "perc", label: "a mai edzés", hot: true),
                    EStat(value: "3/6", unit: "", label: "a mezociklus hete")]),
            .rowlist(label: "A MAI EDZÉS", rows: [
                ERow(glyph: "dumbbell-ink", title: "Fekvenyomás", sub: "3 sorozat · 8 ismétlés", right: "72,5", rightSub: "kg · +2,5", badge: 1, hot: true),
                ERow(glyph: "dumbbell-ink", title: "Evezés", sub: "3 sorozat · 10 ismétlés", right: "60", rightSub: "kg"),
                ERow(glyph: "dumbbell-ink", title: "Vállból nyomás", sub: "3 sorozat · 10 ismétlés", right: "32,5", rightSub: "kg"),
                ERow(glyph: "dumbbell-ink", title: "Húzódzkodás", sub: "3 sorozat · amennyi megy", right: "+5", rightSub: "kg"),
                ERow(glyph: "dumbbell-ink", title: "Bicepsz", sub: "2 sorozat · 12 ismétlés", right: "14", rightSub: "kg")],
                more: "Edzés indítása"),
            .curve(label: "HETI TERHELÉS", values: [0.8, 0.05, 0.62, 0.75, 0.05, 0.9, 0.05],
                   labels: ["H", "K", "Sze", "Cs", "P", "Szo", "V"], target: nil, now: 3,
                   note: "Heti három edzés és egy hosszú futás — ez a nyári célod alapterhelése."),
            .menu(label: "AZ EDZÉS TERÜLET", items: [
                EMenuItem(glyph: "bolt-sun", name: "Indítás", sub: "A mai edzés, sorozatról sorozatra"),
                EMenuItem(glyph: "chart-deep", name: "Edzésterv", sub: "A mezociklusod · 3. hét", badge: 1),
                EMenuItem(glyph: "ball-sun", name: "Gyakorlatok", sub: "128 gyakorlat, saját súlyokkal"),
                EMenuItem(glyph: "shoe-cream", name: "Futás", sub: "A heti futóblokkod"),
                EMenuItem(glyph: "medal-sun", name: "Rekordok", sub: "A legjobbjaid"),
                EMenuItem(glyph: "book-sage", name: "Előzmények", sub: "Minden eddigi edzés")]),
            .ask("Kérdezd meg Boopot a mai edzésről"),
        ]),
        ETab(name: "Terv", badge: 1, blocks: [
            .level(label: "A MEZOCIKLUSOD", big: "3", unit: "/ 6 hét", right: "Felsőtest-alsótest · 4 nap",
                   note: "A negyedik hét a legnehezebb, az ötödik a csúcs, a hatodik könnyű. Utána méred magad.",
                   value: 0.5, marker: nil),
            .rowlist(label: "A HÉT NAPJAI", rows: [
                ERow(glyph: "dumbbell-ink", title: "Hétfő · Láb", sub: "68 perc · kész", right: "✓", rightSub: ""),
                ERow(glyph: "shoe-cream", title: "Szerda · Futás", sub: "6,4 km · 5:48 / km", right: "✓", rightSub: ""),
                ERow(glyph: "dumbbell-ink", title: "Csütörtök · Felsőtest", sub: "Ma 18:30-kor", right: "ma", rightSub: "", badge: 1, hot: true),
                ERow(glyph: "shoe-cream", title: "Szombat · Hosszú futás", sub: "10 km · tervezett", right: "", rightSub: "")],
                more: "A teljes mezociklus"),
            .ask("Kérdezd meg Boopot az edzéstervedről"),
        ]),
        ETab(name: "Gyakorlatok", blocks: [
            .rowlist(label: "A LEGTÖBBET HASZNÁLTAK", rows: [
                ERow(glyph: "dumbbell-ink", title: "Fekvenyomás", sub: "48 alkalom · utoljára múlt csütörtök", right: "70", rightSub: "kg · rekord 75"),
                ERow(glyph: "dumbbell-ink", title: "Guggolás", sub: "44 alkalom · utoljára hétfő", right: "95", rightSub: "kg · rekord 100"),
                ERow(glyph: "dumbbell-ink", title: "Felhúzás", sub: "31 alkalom", right: "110", rightSub: "kg · rekord 115")],
                more: "Mind a 128 gyakorlat"),
            .ask("Kérdezd meg Boopot egy gyakorlatról"),
        ]),
        ETab(name: "Előzmények", blocks: [
            .curve(label: "A FUTÓIDŐD ALAKULÁSA", values: [0.8, 0.82, 0.78, 0.7, 0.66, 0.6],
                   labels: ["6 hete", "", "4 hete", "", "2 hete", "most"], target: nil, now: 5,
                   note: "Három hete lassulsz, átlagosan 14 másodperccel kilométerenként. A cipőd 780 km-nél jár."),
            .list(label: "AMIT ÉSZREVETTEM", items: [
                ("A lábnapok stabilak", "Nyolc hete nem hagytál ki egyet sem."),
                ("Az esti edzés nem rontja az alvásod", "A 20:00 után végzett edzések után is 7 óra fölött alszol."),
                ("A rossz alvás utáni napon gyengébb vagy", "Hat óra alatti alvás után átlagosan 8%-kal kevesebbet emelsz.")]),
            .ask("Kérdezd meg Boopot a fejlődésedről"),
        ]),
    ]

    // ───────────────────────────────────────────── Alvás
    static let alvas: [ETab] = [
        ETab(name: "Ma", blocks: [
            .highlight(label: "AZ ÉJSZAKA", text: "Kipihented magad",
                       sub: "7 óra 12 perc, ebből 1 óra 36 perc mély. 22:48-kor aludtál el, 12 perccel korábban, mint szoktál."),
            .stats([EStat(value: "7ó 12p", unit: "", label: "a 7,5 órás célból", hot: true),
                    EStat(value: "1ó 36p", unit: "", label: "mély alvás", trend: 1),
                    EStat(value: "52", unit: "", label: "nyugalmi pulzus", trend: -1)]),
            .curve(label: "AZ ÉJSZAKA MENETE", values: [0.3, 0.85, 0.9, 0.5, 0.75, 0.4, 0.6, 0.25, 0.15],
                   labels: ["23", "", "1", "", "3", "", "5", "", "7"], target: nil, now: nil,
                   note: "A magasabb szakaszok a mély alvás. A második és harmadik óra volt a legmélyebb."),
            .menu(label: "AZ ALVÁS TERÜLET", items: [
                EMenuItem(glyph: "bell-cream", name: "Lefekvés", sub: "Emlékeztető 22:15-kor"),
                EMenuItem(glyph: "chart-deep", name: "Előzmények", sub: "Hetek, hónapok"),
                EMenuItem(glyph: "heart-cream", name: "Pulzus", sub: "Éjszakai pulzus és HRV"),
                EMenuItem(glyph: "moon-cream", name: "Mi hat rá", sub: "Vacsora, naptár, edzés")]),
            .ask("Kérdezd meg Boopot az alvásodról"),
        ]),
        ETab(name: "Hét", blocks: [
            .curve(label: "A HÉT ÉJSZAKÁI", values: [0.7, 0.75, 0.6, 0.8, 0.72, 0.9, 0.82],
                   labels: ["H", "K", "Sze", "Cs", "P", "Szo", "V"], target: 0.85, now: 3,
                   note: "A heti átlagod 7 óra 4 perc. A legrövidebb szerda volt, a sűrű naptárú nap után."),
            .list(label: "AMI HATOTT RÁ", items: [
                ("A késői vacsora", "A 20:30 utáni vacsorák után átlagosan 24 perccel kevesebbet alszol."),
                ("A sűrű naptár", "A hat eseménynél zsúfoltabb napok után a mély alvásod 18 perccel rövidebb."),
                ("Az esti edzés", "A 20:00 után befejezett edzések nem rontották el — ez nálad nem gond.")]),
            .ask("Kérdezd meg Boopot, mitől alszol jobban"),
        ]),
        ETab(name: "Előzmények", blocks: [
            .curve(label: "AZ UTOLSÓ HAT HÉT", values: [0.62, 0.7, 0.58, 0.75, 0.8, 0.84],
                   labels: ["41", "42", "43", "44", "45", "46"], target: 0.85, now: 5,
                   note: "Hat hét alatt az átlagod 6 óra 38 percről 7 óra 4 percre nőtt."),
            .ask("Kérdezd meg Boopot a hosszú távú alvásodról"),
        ]),
    ]

    // ───────────────────────────────────────────── Energia
    static let energia: [ETab] = [
        ETab(name: "Ma", badge: 1, blocks: [
            .highlight(label: "AMI MA SZÁMÍT", text: "Kicsit feszült vagy",
                       sub: "A délelőtti check-inben 4-es feszültséget jelöltél, és hat megbeszélés van a naptáradban. A délutáni check-in 16:00-kor jön."),
            .stats([EStat(value: "7", unit: "/10", label: "energia"),
                    EStat(value: "8", unit: "/10", label: "hangulat"),
                    EStat(value: "4", unit: "/10", label: "feszültség", trend: 1, hot: true)]),
            .curve(label: "A NAP ENERGIÁJA", values: [0.5, 0.7, 0.8, 0.72, 0.55, 0.45, 0.6, 0.7, 0.5],
                   labels: ["6", "8", "10", "12", "14", "16", "18", "20", "22"], target: nil, now: 4,
                   note: "A 14 óra körüli gödör minden sűrű napon megjelenik nálad. Egy rövid séta ebéd után szokta átvinni."),
            .heat(label: "A NAPTÁRAD SŰRŰSÉGE", cells: [("9", 0.8), ("10", 0.95), ("11", 0.6), ("12", 0.1), ("13", 0.0), ("14", 0.7), ("15", 0.75), ("16", 0.5), ("17", 0.3)],
                  note: "Hat esemény 9 és 17:30 között. A 10:30-as blokk a legsűrűbb."),
            .menu(label: "AZ ENERGIA TERÜLET", items: [
                EMenuItem(glyph: "pen-sun", name: "Check-in", sub: "Három kérdés, fél perc", badge: 1),
                EMenuItem(glyph: "chart-deep", name: "Előzmények", sub: "Napok, hetek"),
                EMenuItem(glyph: "spark-cream", name: "Minták", sub: "Mi hoz le és mi emel"),
                EMenuItem(glyph: "bell-cream", name: "Emlékeztetők", sub: "Mikor kérdezzen")]),
            .ask("Kérdezd meg Boopot a közérzetedről"),
        ]),
        ETab(name: "Check-inek", blocks: [
            .curve(label: "ENERGIA A HÉTEN", values: [0.7, 0.6, 0.45, 0.7, 0.55, 0.85, 0.8],
                   labels: ["H", "K", "Sze", "Cs", "P", "Szo", "V"], target: nil, now: 3,
                   note: "Szerda volt a mélypont — a legzsúfoltabb nap, a legrövidebb alvás után."),
            .ask("Kérdezd meg Boopot az energiádról"),
        ]),
        ETab(name: "Minták", blocks: [
            .list(label: "AMIT ÉSZREVETTEM", items: [
                ("A zsúfolt napok ára", "A hat eseménynél sűrűbb napokon a feszültséged átlagosan 2 ponttal magasabb."),
                ("Az edzés utáni nap", "Edzés utáni reggeleken az energiád átlagosan 1,4 ponttal jobb."),
                ("A hétvége", "Szombaton a legjobb a közérzeted — nyolc hete minden alkalommal.")]),
            .ask("Kérdezd meg Boopot a mintáidról"),
        ]),
    ]

    // ───────────────────────────────────────────── Forma
    static let forma: [ETab] = [
        ETab(name: "Ma", blocks: [
            .highlight(label: "A MAI FORMÁD", text: "Jó napod lesz",
                       sub: "A mélyalvásod 18 perccel a heti átlag felett volt, a pulzusváltozékonyságod rendben. A 18:30-as edzés belefér."),
            .stats([EStat(value: "78", unit: "/100", label: "ma", hot: true),
                    EStat(value: "74", unit: "", label: "a heti átlagod", trend: 1),
                    EStat(value: "+4", unit: "", label: "a tegnapihoz képest", trend: 1)]),
            .rowlist(label: "MI HAT RÁ MA", rows: [
                ERow(glyph: "moon-cream", title: "Alvás", sub: "7ó 12p, ebből 1ó 36p mély — ez emeli", right: "84", rightSub: "", level: 0.84),
                ERow(glyph: "heart-cream", title: "Energia", sub: "A délelőtti feszültség 4 volt — ez húzza le", right: "69", rightSub: "", level: 0.69),
                ERow(glyph: "dumbbell-ink", title: "Edzés", sub: "1 240 lépés eddig — ez húzza le", right: "62", rightSub: "", level: 0.62),
                ERow(glyph: "e-penz", title: "Pénz", sub: "A kereten belül vagy — nem terhel", right: "74", rightSub: "", level: 0.74)],
                more: ""),
            .ask("Kérdezd meg Boopot a formádról"),
        ]),
        ETab(name: "Mi hat rá", blocks: [
            .curve(label: "A FORMÁD A HÉTEN", values: [0.72, 0.7, 0.58, 0.78, 0.68, 0.82, 0.8],
                   labels: ["H", "K", "Sze", "Cs", "P", "Szo", "V"], target: 0.75, now: 3,
                   note: "Szerda volt a leggyengébb nap: rövid alvás és zsúfolt naptár együtt."),
            .note(label: "HOGYAN SZÁMOLOM", body: "A Forma nem orvosi mérőszám, hanem a te saját előzményeidhez képest mutatja, mire vagy ma képes: az alvásodból, a pulzusváltozékonyságodból, az elmúlt napok terheléséből és abból, amit a check-inekben mondtál."),
            .ask("Kérdezd meg Boopot, mi befolyásolja"),
        ]),
    ]
}
