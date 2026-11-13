import SwiftUI

// The Boop tab as a THREAD LIST (the owner's own words: "nyitok egy threadet, mint a Claude-ban"),
// the Terv tab with a LIFE GOAL at its top level, and Napló showing patterns that cross areas.

// MARK: - Boop · threads

struct EThread: Identifiable {
    let id: String
    let title: String, last: String, when: String
    let areas: [Int]
    let pinned: Bool
    let turns: [(Bool, String)]        // isBoop, text

    static let all: [EThread] = [
        EThread(id: "cipo", title: "Megvegyem a futócipőt?", last: "Igen, de a hétvégi étterem helyett.", when: "most",
                areas: [5, 7, 2, 0], pinned: false,
                turns: [
                    (false, "Ezt a cipőt érdemes megvenni?"),
                    (true, "Szerintem igen. 30 590 Ft, és négy boltban néztem meg: a szokásos ára 38 400, a legolcsóbb másik 36 900. Ez tényleg a legjobb ár, amit eddig láttam rá."),
                    (true, "A mostani cipőd 780 kilométernél jár, és a futóidőid három hete lassulnak. Ez nem feltétlenül a cipő, de egybeesik."),
                    (false, "És belefér a pénzembe?"),
                    (true, "Belefér, de szűken. A hónapból még 54 000 Ft szabad, és jön a biztosítás 21-én, 18 000 Ft. Marad 5 400 Ft mozgástér.\n\nHa a hétvégi éttermet kihagyod, az 12 000 Ft, és akkor kényelmes."),
                ]),
        EThread(id: "nyar", title: "A nyári formám", last: "Heti három futás és a fehérje a kulcs.", when: "tegnap",
                areas: [0, 2, 3, 1], pinned: true,
                turns: [
                    (false, "Hogy állok a nyári célommal?"),
                    (true, "Jobban, mint két hete. A súlyod 11 hét alatt 4,2 kg-ot csökkent, ez heti 0,38 kg — pont a tervezett ütem.\n\nAmi hátráltat: a fehérje. Az elmúlt 14 napból 9-en a cél alatt maradtál, átlagosan 22 grammal."),
                    (false, "Mit csináljak másképp?"),
                    (true, "Egyetlen dolgot: az ebéd legyen 45 g fehérje fölött. Ha ez megvan, a nap többi része magától összejön — ezt a saját 11 heted mutatja, nem egy szabálykönyv."),
                ]),
        EThread(id: "koltes", title: "Mire megy el a pénzem?", last: "Az éttermek, és mindig csütörtökön.", when: "2 napja",
                areas: [5, 3], pinned: false,
                turns: [
                    (false, "Mire megy el a pénzem?"),
                    (true, "Három hónap alatt a legnagyobb változó tétel az étterem: havi 78 000 Ft átlagban, és ennek 61%-a csütörtökön és pénteken.\n\nÉrdekes egybeesés: azokon a heteken, amikor az étterem 80 000 Ft fölé megy, a következő héten átlagosan 0,4 kg-mal többet mutat a mérleg."),
                ]),
        EThread(id: "alvas", title: "Miért alszom rosszabbul?", last: "A késői vacsora és a képernyő.", when: "múlt héten",
                areas: [1, 3, 4], pinned: false,
                turns: [
                    (false, "Az utóbbi időben rosszabbul alszom. Miért?"),
                    (true, "Két dolog látszik. A vacsoráid átlagosan 40 perccel későbbre csúsztak, és azokon a napokon 24 perccel kevesebbet alszol.\n\nA másik a feszültség: a sűrű naptárú napok után a mély alvásod átlagosan 18 perccel rövidebb."),
                ]),
    ]
}

struct EletBoopTab: View {
    var onToast: (String) -> Void
    @State private var open: EThread?
    private let m = EMetric.all[0]

    var body: some View {
        ZStack {
            gPageBackground(m.top).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Group { if EWarm.on { EPhotoHead(metric: 0, height: 290) } else { GHead(sky: m.sky, height: 260) } }
                        .overlay(alignment: .bottomLeading) {
                            VStack(alignment: .leading, spacing: 8) {
                                GLabel("BOOP")
                                Text("Kérdezz bármiről").font(AuraFont.serif(34)).foregroundStyle(.white)
                                Text("Minden szál látja az alvásodat, az étkezésedet, az edzéseidet, a pénzedet, a naptáradat és a leveleidet.")
                                    .font(.system(size: 14.5)).lineSpacing(4).foregroundStyle(.white.opacity(0.8))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .padding(.horizontal, 20).padding(.bottom, 8)
                        }

                    Button { onToast("Új szál · üres lappal") } label: {
                        HStack(spacing: 12) {
                            ZStack { Circle().fill(.white); AuraGlyph("plus-ink", gBase, size: 17) }.frame(width: 36, height: 36)
                            Text("Új szál").font(.system(size: 16, weight: .medium)).foregroundStyle(.white)
                            Spacer()
                        }
                        .padding(14).gCard(20)
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 16).padding(.top, 18)

                    GLabel("A SZÁLAID").padding(.horizontal, 20).padding(.top, 26).padding(.bottom, 10)

                    VStack(spacing: 10) {
                        ForEach(EThread.all) { t in
                            Button { open = t } label: { threadRow(t) }.buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 110)
                }
            }
            .scrollIndicators(.hidden)
            .ignoresSafeArea(edges: .top)
        }
        .sheet(item: $open) { t in
            EThreadView(t: t)
                .presentationDetents([.large])
                .presentationBackground(gBase)
                .presentationCornerRadius(34)
                .presentationDragIndicator(.visible)
        }
    }

    private func threadRow(_ t: EThread) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 7) {
                    if t.pinned { AuraGlyph("star-sun", .white.opacity(0.85), size: 13) }
                    Text(t.title).font(.system(size: 16, weight: .medium)).foregroundStyle(.white)
                        .lineLimit(1)
                }
                Text(t.last).font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
                HStack(spacing: 5) {
                    ForEach(t.areas, id: \.self) { a in
                        StillOrb(colors: EMetric.all[a].orb, size: 15, level: 0.8)
                    }
                    Text(t.areas.map { EMetric.all[$0].name }.joined(separator: " · "))
                        .font(.system(size: 11.5)).foregroundStyle(.white.opacity(0.45)).lineLimit(1)
                }
                .padding(.top, 2)
            }
            Spacer(minLength: 6)
            Text(t.when).font(.system(size: 12)).foregroundStyle(.white.opacity(0.4))
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .gCard(20)
    }
}

struct EThreadView: View {
    let t: EThread
    @State private var draft = ""

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                Text(t.title).font(AuraFont.serif(24)).foregroundStyle(.white)
                HStack(spacing: 6) {
                    ForEach(t.areas, id: \.self) { a in
                        HStack(spacing: 5) {
                            StillOrb(colors: EMetric.all[a].orb, size: 14, level: 0.8)
                            Text(EMetric.all[a].name).font(.system(size: 11.5)).foregroundStyle(.white.opacity(0.7))
                        }
                        .padding(.horizontal, 8).frame(height: 26)
                        .background(Capsule().fill(.white.opacity(0.08)))
                    }
                    Spacer()
                }
            }
            .padding(.horizontal, 20).padding(.top, 22).padding(.bottom, 16)
            .frame(maxWidth: .infinity, alignment: .leading)

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(Array(t.turns.enumerated()), id: \.offset) { _, turn in
                        if turn.0 {
                            HStack(alignment: .top, spacing: 10) {
                                StillOrb(colors: EMetric.all[0].orb, size: 26, level: 0.85)
                                Text(turn.1).font(.system(size: 15)).lineSpacing(4).foregroundStyle(.white.opacity(0.92))
                                    .fixedSize(horizontal: false, vertical: true)
                                    .padding(.top, 2)
                                Spacer(minLength: 20)
                            }
                        } else {
                            HStack {
                                Spacer(minLength: 50)
                                Text(turn.1).font(.system(size: 15)).lineSpacing(4).foregroundStyle(gBase)
                                    .fixedSize(horizontal: false, vertical: true)
                                    .padding(.horizontal, 16).padding(.vertical, 11)
                                    .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white))
                            }
                        }
                    }
                }
                .padding(.horizontal, 20).padding(.bottom, 20)
            }
            .scrollIndicators(.hidden)

            HStack(spacing: 10) {
                TextField("", text: $draft, prompt: Text("Kérdezz tovább…").foregroundStyle(.white.opacity(0.45)))
                    .font(.system(size: 15)).foregroundStyle(.white)
                AuraGlyph("chat-ink", .white.opacity(0.7), size: 18)
            }
            .padding(.horizontal, 18).frame(height: 50)
            .background(Capsule().fill(.white.opacity(0.08)))
            .overlay(Capsule().stroke(.white.opacity(0.12)))
            .padding(.horizontal, 16).padding(.bottom, 18)
        }
        .background(gPageBackground(EMetric.all[0].top).ignoresSafeArea())
    }
}

// MARK: - Terv · the life goal everything hangs under

/// Owner decision, 2026-11-13: **Terv is the home of the areas.** No fifth bar button — the goal and the six
/// areas live on one page, because the areas ARE the legs of the goal. Each card opens that area's own app.
struct EletTerv: View {
    var onToast: (String) -> Void
    @Binding var path: [String]
    private let m = EMetric.all[0]

    /// metric index · what it contributes to the goal · where that stands · progress · today's own verdict
    private let legs: [(Int, String, String, Double, String)] = [
        (2, "Heti három futás", "ezen a héten kettő van meg", 0.66, "Van még benne több · 1 240 lépés"),
        (3, "Napi 165 g fehérje", "14 napból 5-ön jött össze", 0.36, "Jó úton jársz · 38 g eddig"),
        (1, "7,5 óra alvás", "a heti átlagod 7 óra 4 perc", 0.82, "Kipihented magad · 7ó 12p"),
        (5, "Havi 60 000 Ft félretéve", "ebből 38 000 Ft megvan", 0.63, "A kereten belül vagy · 281 600 Ft"),
        (4, "Heti két nyugodt nap", "ezen a héten egy volt", 0.5, "Kicsit feszült vagy · 4/10"),
        (6, "A naptárad hagyjon helyet", "ma 72%-ban tele", 0.72, "Zsúfolt délután · 6 esemény"),
        (7, "Csak az számít, ami a célhoz tartozik", "ma 2 levél ilyen volt a 34-ből", 0.9, "Két dolgot nézz meg · 34 levél"),
    ]

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                gPageBackground(m.top).ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        Group { if EWarm.on { EPhotoHead(metric: 0, height: 300) } else { GHead(sky: m.sky, height: 290) } }
                            .overlay(alignment: .bottomLeading) {
                                VStack(alignment: .leading, spacing: 8) {
                                    GLabel("AZ ÉLETCÉLOD · 2027 NYARA")
                                    Text("Nyárra formába kerülni").font(AuraFont.serif(34)).foregroundStyle(.white)
                                    Text("31 hét van hátra. A hat területed ennek a célnak a lábai — mindegyik tud róla, hogy a többi hogy halad.")
                                        .font(.system(size: 14.5)).lineSpacing(4).foregroundStyle(.white.opacity(0.82))
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .padding(.horizontal, 20).padding(.bottom, 6)
                            }

                        HStack(spacing: 10) {
                            Text("A területeid").font(AuraFont.serif(26)).foregroundStyle(.white)
                            Text("MINDEGYIK A SAJÁT OLDALÁRA NYÍLIK").font(AuraFont.mono(10)).tracking(1.1)
                                .foregroundStyle(.white.opacity(0.4)).padding(.top, 8)
                            Spacer()
                        }
                        .padding(.horizontal, 16)

                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 11), GridItem(.flexible(), spacing: 11)], spacing: 11) {
                            ForEach(Array(legs.enumerated()), id: \.offset) { _, l in
                                Button { path.append("m\(l.0)") } label: { areaCard(l) }.buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)

                        VStack(alignment: .leading, spacing: 10) {
                            GLabel("AMI ÖSSZEKÖTI ŐKET")
                            Text("A pénz is a célhoz tartozik: a futócipő és a nyári út ugyanabból a keretből megy. Ezért szólok, ha egy akció tényleg olcsó — és ezért hallgatok, ha nem az.")
                                .font(.system(size: 15)).lineSpacing(4).foregroundStyle(.white.opacity(0.85))
                                .fixedSize(horizontal: false, vertical: true)
                            EAskRow(text: "Kérdezd meg Boopot a célról") { onToast("Új szál · a céllal a kezében") }
                                .padding(.top, 6)
                        }
                        .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .padding(.bottom, 110)
                    }
                }
                .scrollIndicators(.hidden)
                .ignoresSafeArea(edges: .top)
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: String.self) { key in
                EletAreaPage(metric: Int(key.dropFirst()) ?? 0, onToast: onToast)
            }
        }
    }

    /// Two per row: a big orb with its number, the area name, today's one-liner, the goal leg,
    /// and a badge saying how much there is to look at inside.
    private func areaCard(_ l: (Int, String, String, Double, String)) -> some View {
        let a = EMetric.all[l.0]
        let badge = EAreaContent.badge(l.0)
        return VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topTrailing) {
                HStack(spacing: 0) {
                    ZStack {
                        Circle().fill(a.glow.opacity(0.22)).frame(width: 74, height: 74).blur(radius: 16)
                        StillOrb(colors: a.orb, size: 62, level: Double(a.value) / 100)
                        Text("\(a.value)").font(.custom("Outfit", size: 21).weight(.medium))
                            .foregroundStyle(.white).shadow(color: .black.opacity(0.45), radius: 4)
                    }
                    Spacer(minLength: 0)
                }
                if badge > 0 {
                    HStack(spacing: 4) {
                        AuraGlyph("bell-cream", gBase, size: 10)
                        Text("\(badge)").font(.custom("Outfit", size: 12).weight(.semibold)).foregroundStyle(gBase)
                    }
                    .padding(.horizontal, 7).frame(height: 22)
                    .background(Capsule().fill(a.glow))
                    .shadow(color: a.glow.opacity(0.55), radius: 7)
                }
            }
            Text(a.name).font(.system(size: 17, weight: .semibold)).foregroundStyle(.white)
                .padding(.top, 12)
            Text(l.4).font(.system(size: 12.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.6))
                .fixedSize(horizontal: false, vertical: true).padding(.top, 3)
            Spacer(minLength: 10)
            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline) {
                    Text(l.1).font(.system(size: 12.5, weight: .medium)).foregroundStyle(.white.opacity(0.9))
                        .lineLimit(1).minimumScaleFactor(0.8)
                    Spacer(minLength: 4)
                    Text("\(Int(l.3 * 100))%").font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.55))
                }
                ELevelBar(level: l.3, hue: a.glow)
            }
            .padding(.top, 10)
        }
        .padding(15)
        .frame(maxWidth: .infinity, minHeight: 232, alignment: .topLeading)
        .gCard(24)
    }
}

// MARK: - Napló · patterns that cross areas

struct EletNaplo: View {
    private let m = EMetric.all[4]
    private let patterns: [(String, [Int], String)] = [
        ("Az étterem megjelenik a mérlegen",
         [5, 3, 0],
         "Azokon a heteken, amikor az étteremre költés 80 000 Ft fölé megy, a rá következő héten átlagosan 0,4 kg-mal többet mutat a mérleg. Hat hétből ötször így volt."),
        ("A sűrű naptár rövidebb mély alvást hoz",
         [4, 1],
         "A hat eseménynél zsúfoltabb napok után a mély alvásod átlagosan 18 perccel rövidebb. Ezeken a napokon érdemes 22:30 előtt lefeküdni."),
        ("A reklámlevelek 94%-a nem érdekel",
         [7, 5],
         "Három hét alatt 612 levélből 36-ot nyitottál meg. A megnyitottak háromnegyede két márkától jött — a többit ezentúl csendben szűröm."),
    ]

    var body: some View {
        ZStack {
            gPageBackground(m.top).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    GHead(sky: m.sky, height: 270)
                        .overlay(alignment: .bottomLeading) {
                            VStack(alignment: .leading, spacing: 8) {
                                GLabel("NAPLÓ · MINTÁK")
                                Text("Amit észrevettem").font(AuraFont.serif(34)).foregroundStyle(.white)
                                Text("A minták akkor lettek érdekesek, amikor a pénz és a levél is bekerült.")
                                    .font(.system(size: 14.5)).lineSpacing(4).foregroundStyle(.white.opacity(0.82))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .padding(.horizontal, 20).padding(.bottom, 8)
                        }
                    ForEach(Array(patterns.enumerated()), id: \.offset) { _, p in
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(spacing: 6) {
                                ForEach(p.1, id: \.self) { a in
                                    StillOrb(colors: EMetric.all[a].orb, size: 18, level: 0.8)
                                }
                                Spacer()
                            }
                            Text(p.0).font(AuraFont.serif(20)).lineSpacing(3).foregroundStyle(.white)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(p.2).font(.system(size: 14)).lineSpacing(4).foregroundStyle(.white.opacity(0.75))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
                        .padding(.horizontal, 16)
                    }
                    Spacer(minLength: 110)
                }
            }
            .scrollIndicators(.hidden)
            .ignoresSafeArea(edges: .top)
        }
    }
}
