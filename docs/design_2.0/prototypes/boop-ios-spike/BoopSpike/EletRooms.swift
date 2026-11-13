import SwiftUI

// The two new rooms. They deliberately wear the SAME skeleton as Alvás or Étel:
// verdict sentence → the level → the days behind it → what you can do → "kérdezz erről".

private func roomHead(_ m: EMetric) -> some View {
    GHead(sky: m.sky, height: 300)
        .overlay(alignment: .bottomLeading) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    EGlyph(m.glyph, .white, size: 20)
                    Text(m.name.uppercased()).font(AuraFont.mono(12, .bold)).tracking(2).foregroundStyle(.white.opacity(0.8))
                }
                Text(m.headline).font(AuraFont.serif(34)).foregroundStyle(.white)
                Text(m.sentence).font(.system(size: 15.5)).lineSpacing(4).foregroundStyle(.white.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 20).padding(.bottom, 8)
        }
}

// MARK: - Pénz

struct EletMoneyRoom: View {
    var onToast: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    private let m = EMetric.all[5]

    private let buckets: [(String, Int, Int, String)] = [
        ("Élelmiszer", 96_400, 150_000, "a keret kétharmadánál, a hónap felénél"),
        ("Éttermek", 24_000, 25_000, "szinte elfogyott"),
        ("Edzés, sport", 12_000, 30_000, "a bérlet megvan"),
        ("Lakás, rezsi", 118_000, 120_000, "fix"),
        ("Minden más", 31_200, 75_000, ""),
    ]
    private let days: [(String, Double, Bool)] = [
        ("H", 0.32, false), ("K", 0.58, false), ("Sze", 0.21, false), ("Cs", 0.9, true),
        ("P", 0.44, false), ("Szo", 0.76, false), ("V", 0.18, false),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                roomHead(m)

                VStack(alignment: .leading, spacing: 14) {
                    GLabel("A HAVI KERET")
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("281 600").font(.custom("Outfit", size: 40).weight(.light)).foregroundStyle(.white)
                        Text("Ft").font(.system(size: 16)).foregroundStyle(.white.opacity(0.6))
                        Spacer()
                        Text("a 610 000-ből").font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
                    }
                    ELevelBar(level: 0.46, hue: m.glow, marker: 0.43)
                    HStack {
                        Text("A fehér vonal az, ahol a hónap 13. napján tartanod kéne.")
                            .font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.55))
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
                .padding(.horizontal, 16)

                VStack(alignment: .leading, spacing: 16) {
                    GLabel("MIRE MEGY EL")
                    ForEach(Array(buckets.enumerated()), id: \.offset) { _, b in
                        VStack(alignment: .leading, spacing: 7) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(b.0).font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                                Spacer()
                                Text("\(fmt(b.1)) / \(fmt(b.2)) Ft").font(AuraFont.mono(12)).foregroundStyle(.white.opacity(0.65))
                            }
                            ELevelBar(level: min(1, Double(b.1) / Double(b.2)),
                                      hue: Double(b.1) / Double(b.2) > 0.85 ? Color(hex: 0xF2994A) : m.glow)
                            if !b.3.isEmpty {
                                Text(b.3).font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
                            }
                        }
                    }
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
                .padding(.horizontal, 16)

                VStack(alignment: .leading, spacing: 14) {
                    GLabel("A NAPOK MÖGÖTTE · EZ A HÉT")
                    HStack(alignment: .bottom, spacing: 10) {
                        ForEach(Array(days.enumerated()), id: \.offset) { _, d in
                            VStack(spacing: 8) {
                                ZStack(alignment: .bottom) {
                                    RoundedRectangle(cornerRadius: 7).fill(.white.opacity(0.08)).frame(height: 104)
                                    RoundedRectangle(cornerRadius: 7)
                                        .fill(LinearGradient(colors: [m.glow.opacity(0.55), m.glow], startPoint: .bottom, endPoint: .top))
                                        .frame(height: max(8, 104 * d.1))
                                        .shadow(color: d.2 ? m.glow.opacity(0.8) : .clear, radius: 10)
                                }
                                Text(d.0).font(.system(size: 11.5, weight: d.2 ? .bold : .regular))
                                    .foregroundStyle(.white.opacity(d.2 ? 1 : 0.6))
                            }
                        }
                    }
                    Text("Csütörtökön ment el a legtöbb: 31 400 Ft, ebből 18 900 Ft étterem.")
                        .font(.system(size: 13)).lineSpacing(3).foregroundStyle(.white.opacity(0.65))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
                .padding(.horizontal, 16)

                VStack(alignment: .leading, spacing: 12) {
                    GLabel("AMIT TEHETSZ")
                    HStack(spacing: 10) {
                        GPill(title: "Kiadás rögzítése", glyph: "pen-sun") { onToast("Kiadás · megnyílik") }
                        GPill(title: "Keretek", primary: false) { onToast("Keretek · megnyílik") }
                    }
                    EAskRow(text: "Kérdezd meg Boopot a költésedről") { onToast("Új szál nyílik · a havi kerettel a kezében") }
                        .padding(.top, 4)
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
                .padding(.horizontal, 16)
                .padding(.bottom, 60)
            }
        }
        .scrollIndicators(.hidden)
        .background(gPageBackground(m.top).ignoresSafeArea())
        .ignoresSafeArea(edges: .top)
        .toolbar(.hidden, for: .navigationBar)
        .overlay(alignment: .topLeading) { backButton { dismiss() } }
    }

    private func fmt(_ n: Int) -> String {
        let r = String(n).reversed().enumerated().map { $0.offset > 0 && $0.offset % 3 == 0 ? " \($0.element)" : "\($0.element)" }
        return String(r.joined().reversed())
    }
}

// MARK: - Levél

struct MailItem: Identifiable {
    let id = UUID()
    let from: String, what: String, score: Int
    let price: String          // the market check, in plain words
    let goal: String           // why it matters to him, or why it does not
    let verdict: Verdict
    enum Verdict { case cheaper, usual, unknown }
    var verdictText: String { ["Olcsóbb, mint máshol", "A szokásos ára", "Nem tudtam ellenőrizni"][[Verdict.cheaper, .usual, .unknown].firstIndex(of: verdict) ?? 2] }
    var verdictHue: Color { [Color(hex: 0x5FD08A), Color(hex: 0xE8C25A), Color(hex: 0x9AA3AE)][[Verdict.cheaper, .usual, .unknown].firstIndex(of: verdict) ?? 2] }
}

extension MailItem.Verdict: Equatable {}

struct EletMailRoom: View {
    var onToast: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var showRest = false
    private let m = EMetric.all[6]

    private let worth: [MailItem] = [
        MailItem(from: "Futóbolt", what: "A kinézett futócipő 32%-kal olcsóbb", score: 9,
                 price: "30 590 Ft. Négy boltban néztem meg: a szokásos ára 38 400 Ft, a legolcsóbb máshol most 36 900 Ft.",
                 goal: "A mostani cipőd 780 km-nél jár, és a nyári célodhoz heti három futás kell.",
                 verdict: .cheaper),
        MailItem(from: "Fehérjebolt", what: "Akció a szokásos fehérjeporodra", score: 6,
                 price: "12 990 Ft 2 kg-ra. Ez pontosan ugyanannyi, mint amennyiért márciusban vetted — ez nem akció.",
                 goal: "Van még kb. három heted a jelenlegi zacskóból, nem sürgős.",
                 verdict: .usual),
    ]
    private let rest: [(String, String)] = [
        ("Hírlevelek · 14", "Elolvastam, semmi nem kötődik a céljaidhoz"),
        ("Reklám · 11", "Olyan termékek, amiket sosem nyitottál meg"),
        ("Számlák, értesítők · 4", "Rendben vannak, semmi teendő"),
        ("Belépési kódok · 2", "Ezekbe nem néztem bele, és nem is küldtem sehova"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                roomHead(m)

                VStack(alignment: .leading, spacing: 14) {
                    GLabel("A MAI POSTA")
                    HStack(spacing: 18) {
                        stat("34", "érkezett")
                        stat("31", "elintézve")
                        stat("2", "megér egy percet")
                    }
                    Text("A következő futás 15:00-kor. Reggel 08:00-kor és délután 15:00-kor nézek bele.")
                        .font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.55))
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
                .padding(.horizontal, 16)

                VStack(alignment: .leading, spacing: 14) {
                    GLabel("MEGÉR EGY PERCET")
                    ForEach(worth) { it in mailCard(it) }
                }
                .padding(.horizontal, 16)

                VStack(alignment: .leading, spacing: 0) {
                    Button { withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { showRest.toggle() } } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Amit elintéztem helyetted").font(.system(size: 15.5, weight: .medium)).foregroundStyle(.white)
                                Text("31 levél · egyikhez sem kell hozzányúlnod").font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
                            }
                            Spacer()
                            Image(systemName: showRest ? "chevron.up" : "chevron.down")
                                .font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
                        }
                        .padding(18).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    if showRest {
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(Array(rest.enumerated()), id: \.offset) { _, r in
                                HStack(alignment: .top, spacing: 12) {
                                    Circle().fill(.white.opacity(0.25)).frame(width: 6, height: 6).padding(.top, 6)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(r.0).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white.opacity(0.9))
                                        Text(r.1).font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
                                            .fixedSize(horizontal: false, vertical: true)
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 18).padding(.bottom, 18)
                        .transition(.opacity.combined(with: .offset(y: -8)))
                    }
                }
                .gCard()
                .padding(.horizontal, 16)

                VStack(alignment: .leading, spacing: 12) {
                    GLabel("AMIT TEHETSZ")
                    HStack(spacing: 10) {
                        GPill(title: "Postafiókok", glyph: "person-sage") { onToast("Postafiókok · megnyílik") }
                        GPill(title: "Mit nézzen", primary: false) { onToast("Szabályok · megnyílnak") }
                    }
                    EAskRow(text: "Kérdezd meg Boopot a mai postáról") { onToast("Új szál nyílik · a mai levelekkel") }
                        .padding(.top, 4)
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
                .padding(.horizontal, 16)
                .padding(.bottom, 60)
            }
        }
        .scrollIndicators(.hidden)
        .background(gPageBackground(m.top).ignoresSafeArea())
        .ignoresSafeArea(edges: .top)
        .toolbar(.hidden, for: .navigationBar)
        .overlay(alignment: .topLeading) { backButton { dismiss() } }
    }

    private func stat(_ n: String, _ l: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(n).font(.custom("Outfit", size: 26).weight(.light)).foregroundStyle(.white)
            Text(l).font(.system(size: 11.5)).foregroundStyle(.white.opacity(0.6))
        }
    }

    private func mailCard(_ it: MailItem) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(it.from.uppercased()).font(AuraFont.mono(11, .bold)).tracking(1.4).foregroundStyle(.white.opacity(0.6))
                    Text(it.what).font(AuraFont.serif(20)).lineSpacing(3).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 10)
                EScore(n: it.score, hue: m.glow)
            }
            HStack(spacing: 7) {
                Circle().fill(it.verdictHue).frame(width: 7, height: 7)
                Text(it.verdictText).font(.system(size: 13, weight: .semibold)).foregroundStyle(it.verdictHue)
            }
            .padding(.top, 12)
            Text(it.price).font(.system(size: 13.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.75))
                .fixedSize(horizontal: false, vertical: true).padding(.top, 5)
            HStack(alignment: .top, spacing: 10) {
                StillOrb(colors: EMetric.all[0].orb, size: 20, level: 0.85)
                Text(it.goal).font(.system(size: 13.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 12)
            HStack(spacing: 10) {
                GPill(title: "Megnyitom") { onToast("A levél megnyílik") }
                GPill(title: "Nem érdekel", primary: false) { onToast("Megjegyeztem — a márkát ezentúl szűröm") }
            }
            .padding(.top, 14)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .gCard()
    }
}

// MARK: - The five body rooms are already built; here they are only a stand-in.

struct EletPlainRoom: View {
    var metric: Int
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        let m = EMetric.all[min(metric, 6)]
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                roomHead(m)
                VStack(alignment: .leading, spacing: 10) {
                    GLabel("EZ A SZOBA MÁR MEGVAN")
                    Text("A \(m.name) szobát a napi ritmus szakaszában már megépítettük. Ebben a kíváncsiság-próbában csak azért van itt, hogy lásd: a Pénz és a Levél pontosan ugyanezt a formát kapta.")
                        .font(.system(size: 15)).lineSpacing(4).foregroundStyle(.white.opacity(0.8))
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
                .padding(.horizontal, 16)
                Spacer(minLength: 80)
            }
        }
        .scrollIndicators(.hidden)
        .background(gPageBackground(m.top).ignoresSafeArea())
        .ignoresSafeArea(edges: .top)
        .toolbar(.hidden, for: .navigationBar)
        .overlay(alignment: .topLeading) { backButton { dismiss() } }
    }
}

func backButton(_ action: @escaping () -> Void) -> some View {
    Button(action: action) {
        Image(systemName: "chevron.left").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
            .frame(width: 44, height: 44)
    }
    .buttonStyle(.plain)
    .glassEffect(.clear.interactive(), in: .circle)
    .padding(.leading, 14)
    .padding(.top, 54)
}
