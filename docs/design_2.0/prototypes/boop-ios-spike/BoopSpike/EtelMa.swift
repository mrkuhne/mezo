import SwiftUI

// B4 Étel spike — the `Ma` tab: the remaining budget, the day's windows (each with its own photo),
// the next-meal tip, water, and the supplement groups.

struct EtelMa: View {
    let onOpen: (String) -> Void
    let onDimension: ((String, Int?)) -> Void
    let onToast: (String) -> Void
    @State private var water = 1500
    @State private var ticked: Set<String> = []

    var body: some View {
        VStack(spacing: 14) {
            ESection(n: 1, label: "AMI MÉG BELEFÉR") { budget }
            ESection(n: 2, label: "A MAI TERVED") { windows }
            ESection(n: 3, label: "MIT EGYÉL LEGKÖZELEBB") { tip }
            ESection(n: 4, label: "VÍZ") { waterRow }
            ESection(n: 5, label: "KIEGÉSZÍTŐK") { supplements }
        }
    }

    // MARK: 1 — the budget (adherence-neutral: a number, never a red state)

    private var budget: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("907").font(.custom("Outfit", size: 52).weight(.light)).foregroundStyle(.white)
                Text("kcal").font(AuraFont.mono(14)).foregroundStyle(.white.opacity(0.6))
                Spacer()
                Text("\(EData.eatenKcal) / \(EData.targetKcal)").font(AuraFont.mono(13)).foregroundStyle(.white.opacity(0.55))
            }
            VStack(spacing: 10) {
                macro("Fehérje", EData.eatenP, EData.targetP, "g")
                macro("Szénhidrát", EData.eatenC, EData.targetC, "g")
                macro("Zsír", EData.eatenF, EData.targetF, "g")
            }
        }
    }

    private func macro(_ name: String, _ eaten: Int, _ target: Int, _ unit: String) -> some View {
        HStack(spacing: 12) {
            Text(name).font(.system(size: 14)).foregroundStyle(.white.opacity(0.8)).frame(width: 92, alignment: .leading)
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.08))
                    Capsule().fill(.white.opacity(0.85))
                        .frame(width: g.size.width * min(1, Double(eaten) / Double(target)))
                }
            }
            .frame(height: 6)
            Text("még \(target - eaten) \(unit)").font(AuraFont.mono(12.5)).foregroundStyle(.white.opacity(0.75))
                .frame(width: 78, alignment: .trailing)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: 2 — the day's windows

    private var windows: some View {
        VStack(spacing: 12) {
            ForEach(EData.windows) { w in
                if let m = w.meal {
                    EMealCard(meal: m, slot: w.slot, onDimension: onDimension, onToast: onToast)
                } else {
                    EOpenWindow(window: w, onOpen: onOpen, onToast: onToast)
                }
            }
        }
    }

    // MARK: 3 — the tip

    private var tip: some View {
        HStack(alignment: .top, spacing: 12) {
            StillOrb(colors: EHue.sky, size: 30, level: 0.6).padding(.top, 2)
            VStack(alignment: .leading, spacing: 10) {
                Text(EData.tip).font(AuraFont.serif(16)).lineSpacing(3).foregroundStyle(.white)
                HStack(spacing: 8) {
                    Button { onToast("Megnyitom a receptet") } label: {
                        Text("Megnézem a receptet").font(.system(size: 14, weight: .semibold)).foregroundStyle(gBase)
                            .padding(.horizontal, 16).frame(height: 38)
                            .background(Capsule().fill(.white.opacity(0.95)))
                    }
                    .buttonStyle(.plain)
                    Button { onToast("Rendben, most nem ajánlok mást") } label: {
                        Text("Most nem").font(.system(size: 14)).foregroundStyle(.white.opacity(0.8))
                            .padding(.horizontal, 16).frame(height: 38)
                            .background(Capsule().fill(.white.opacity(0.1)))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: 4 — water

    private var waterRow: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("\(water)").font(.custom("Outfit", size: 34).weight(.light)).foregroundStyle(.white)
                Text("ml a 3 000-ből").font(.system(size: 14)).foregroundStyle(.white.opacity(0.6))
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.08))
                    Capsule().fill(LinearGradient(colors: [EHue.sky[0], EHue.sky[1]], startPoint: .leading, endPoint: .trailing))
                        .frame(width: g.size.width * min(1, Double(water) / 3000))
                }
            }
            .frame(height: 10)
            HStack(spacing: 8) {
                ForEach([250, 500], id: \.self) { ml in
                    Button {
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { water += ml }
                        onToast("Víz +\(ml) ml")
                    } label: {
                        Text("+\(ml) ml").font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                            .padding(.horizontal, 16).frame(height: 38)
                            .background(Capsule().fill(.white.opacity(0.1)))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: 5 — supplements

    private var supplements: some View {
        VStack(spacing: 0) {
            ForEach(Array(EData.supplements.enumerated()), id: \.offset) { k, group in
                let done = ticked.contains(group.0) || (group.2 && !ticked.contains("un-" + group.0))
                HStack(spacing: 12) {
                    EThumb(name: nil, glyph: done ? "check-sage" : "spark-cream", size: 42)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("\(group.0) · \(group.1.count)").font(.system(size: 15.5, weight: .medium)).foregroundStyle(.white)
                        Text(group.1.joined(separator: " · ")).font(.system(size: 12.5))
                            .foregroundStyle(.white.opacity(0.55)).lineLimit(1)
                    }
                    Spacer()
                    Button {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                            if done { ticked.remove(group.0); ticked.insert("un-" + group.0) }
                            else { ticked.insert(group.0); ticked.remove("un-" + group.0) }
                        }
                        onToast(done ? "Visszavontam" : "\(group.0): mind a \(group.1.count) bevéve")
                    } label: {
                        Text(done ? "Bevéve" : "Bevettem").font(.system(size: 13.5, weight: .semibold))
                            .foregroundStyle(done ? .white.opacity(0.7) : gBase)
                            .padding(.horizontal, 14).frame(height: 34)
                            .background(Capsule().fill(done ? .white.opacity(0.12) : .white.opacity(0.95)))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.vertical, 11)
                .contentShape(Rectangle())
                .onTapGesture { onOpen("kiegeszito") }
                if k < EData.supplements.count - 1 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
            }
            Button { onOpen("kiegeszito") } label: {
                HStack(spacing: 8) {
                    AuraGlyph("plus-ink", .white.opacity(0.8), size: 14)
                    Text("Lista szerkesztése").font(.system(size: 14)).foregroundStyle(.white.opacity(0.8))
                    Spacer()
                }
                .padding(.top, 14).contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - A logged meal: the photo, the numbers, all eight dimensions

struct EMealCard: View {
    let meal: EMeal
    let slot: String
    let onDimension: ((String, Int?)) -> Void
    let onToast: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let p = meal.photo { ECardPhoto(name: p) }
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Text("\(slot.uppercased()) · \(meal.time)").font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.55))
                    Spacer()
                    Text("\(meal.score)").font(.custom("Outfit", size: 19).weight(.medium)).foregroundStyle(.white)
                    Text("/100").font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.45))
                }
                Text(meal.title).font(AuraFont.serif(19)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                Text("\(meal.kcal) kcal · F \(meal.p) g · Sz \(meal.c) g · Zs \(meal.f) g")
                    .font(AuraFont.mono(12.5)).foregroundStyle(.white.opacity(0.7))
                if !meal.flags.isEmpty {
                    HStack(spacing: 6) { ForEach(meal.flags, id: \.self) { EFlagBadge(flag: $0) } }
                }
                dimensionGrid
                Text(meal.boop).font(.system(size: 14)).lineSpacing(2).foregroundStyle(.white.opacity(0.85))
                if let g = meal.glucose {
                    HStack(alignment: .top, spacing: 8) {
                        AuraGlyph("bolt-sun", Color(hex: 0xF4C860), size: 14).padding(.top, 1)
                        Text(g).font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.75))
                    }
                }
            }
            .padding(18)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .gCard()
        .onTapGesture { onToast("Az étkezés szerkesztése") }
    }

    /// All eight dimensions, always (owner decision 12). Tapping one opens its own explanation.
    private var dimensionGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
            ForEach(Array(meal.dims.enumerated()), id: \.offset) { _, d in
                Button { onDimension(d) } label: {
                    VStack(spacing: 5) {
                        Text(d.1.map(String.init) ?? "–")
                            .font(.custom("Outfit", size: 17).weight(.medium))
                            .foregroundStyle(d.1 == nil ? .white.opacity(0.45) : .white)
                        GeometryReader { g in
                            ZStack(alignment: .leading) {
                                Capsule().fill(.white.opacity(0.1))
                                Capsule().fill(.white.opacity(0.75)).frame(width: g.size.width * Double(d.1 ?? 0) / 100)
                            }
                        }
                        .frame(height: 3)
                        Text(d.0).font(.system(size: 9.5)).foregroundStyle(.white.opacity(0.55))
                            .lineLimit(1).minimumScaleFactor(0.7)
                    }
                    .padding(.vertical, 9).padding(.horizontal, 6)
                    .frame(maxWidth: .infinity)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(.white.opacity(0.06)))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - An open window: budget, suggestion, two buttons

struct EOpenWindow: View {
    let window: EWindow
    let onOpen: (String) -> Void
    let onToast: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Text("\(window.slot.uppercased()) · \(window.from)–\(window.to)")
                    .font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.55))
                if window.state == .now {
                    Text("MOST").font(AuraFont.mono(10, .semibold)).foregroundStyle(gBase)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(Capsule().fill(.white.opacity(0.9)))
                }
                Spacer()
                Text("\(window.kcal) kcal keret").font(AuraFont.mono(11.5)).foregroundStyle(.white.opacity(0.6))
            }
            if let s = window.suggestion {
                HStack(spacing: 12) {
                    EThumb(name: s.photo, size: 44)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(s.title).font(.system(size: 15.5, weight: .medium)).foregroundStyle(.white)
                        Text(s.sub).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.55))
                    }
                    Spacer()
                }
            } else {
                Text("Ehhez az ablakhoz most nincs receptem, ami átmegy a szabályaidon — 150 g csirkemell és egy marék rizs belefér.")
                    .font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.7))
            }
            HStack(spacing: 8) {
                Button { onOpen("composer") } label: {
                    Text("Megeszem").font(.system(size: 14, weight: .semibold)).foregroundStyle(gBase)
                        .padding(.horizontal, 16).frame(height: 38).background(Capsule().fill(.white.opacity(0.95)))
                }
                .buttonStyle(.plain)
                Button { onOpen("kihagyas") } label: {
                    Text("Kihagyom").font(.system(size: 14)).foregroundStyle(.white.opacity(0.8))
                        .padding(.horizontal, 16).frame(height: 38).background(Capsule().fill(.white.opacity(0.1)))
                }
                .buttonStyle(.plain)
                Spacer()
                Button { onOpen("composer") } label: {
                    AuraGlyph("camera-ink", .white, size: 18).frame(width: 38, height: 38)
                        .background(Circle().fill(.white.opacity(0.1)))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
    }
}

// MARK: - One dimension, explained

struct EDimensionSheet: View {
    let name: String
    let value: Int?
    @Environment(\.dismiss) private var dismiss

    private var detail: (String, String, String) {
        switch name {
        case "Makrók": ("A fehérje, a szénhidrát és a zsír aránya ebben az étkezésben, a mai célodhoz mérve.",
                        "42 g fehérje · 55 g szénhidrát · 24 g zsír. Az ebédre jutó keretedhez képest a fehérje pont jó, a zsír kicsit sok.",
                        "Egy kanállal kevesebb olaj, és 90 fölé megy.")
        case "Feldolgozottság": ("Mennyire természetes az étel: 1-es a nyers alapanyag, 4-es az ultra-feldolgozott.",
                                 "A tányér kalóriáinak 61%-a 4-es szintű termékből jön — ezért szólok. Egyetlen kis feldolgozott összetevőnél nem szólnék.",
                                 "Egy marék dió és egy alma ugyanezt a fehérjét hozza 1-es szinten.")
        case "Rost": ("Az étkezés rosttartalma a napi 35 grammos célodhoz mérve.",
                      "7 g rost. Ez a napi cél ötöde egy olyan étkezésben, ami a kalóriák harmadát adja.",
                      "Egy evőkanál chiamag vagy egy adag hüvelyes +6 g.")
        case "Napi helyzet": ("Hogyan illik ez az étkezés a nap többi részébe: mennyi maradt, és mi jön még.",
                              "Ehhez még nincs elég adatom a mai napról — ezért nincs pontszáma, és nem is rontja le az összesítést.",
                              "Rögzítsd a vacsorát, és visszamenőleg is kiszámolom.")
        default: ("Ez a szempont azt méri, mennyire szolgálja ez az étkezés a célodat.",
                  "A pontszám a tányéron lévő alapanyagokból jön, nem becslésből.",
                  "A javaslatom: tarts meg mindent, csak a rostot told feljebb.")
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .bottomLeading) {
                    EPhotoHead(height: 170)
                    VStack(alignment: .leading, spacing: 6) {
                        GLabel("EGY SZEMPONT")
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text(name).font(AuraFont.serif(28)).foregroundStyle(.white)
                            Text(value.map { "\($0)" } ?? "nincs adat")
                                .font(.custom("Outfit", size: value == nil ? 15 : 26).weight(.light))
                                .foregroundStyle(.white.opacity(value == nil ? 0.6 : 1))
                        }
                    }
                    .padding(.horizontal, 22).padding(.bottom, 18)
                }
                VStack(alignment: .leading, spacing: 18) {
                    block("MIT MÉR", detail.0)
                    block("MIÉRT ENNYI", detail.1)
                    block("MI VINNÉ FELJEBB", detail.2)
                    Button { dismiss() } label: {
                        Text("Kész").font(.system(size: 15, weight: .semibold)).foregroundStyle(gBase)
                            .frame(maxWidth: .infinity).frame(height: 48)
                            .background(Capsule().fill(.white.opacity(0.95)))
                    }
                    .buttonStyle(.plain).padding(.top, 6)
                }
                .padding(20).padding(.bottom, 30)
            }
        }
        .scrollIndicators(.hidden)
        .background(gPageBackground(EHue.top).ignoresSafeArea())
        .ignoresSafeArea(edges: .top)
        .preferredColorScheme(.dark)
    }

    private func block(_ label: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            GLabel(label)
            Text(text).font(.system(size: 15)).lineSpacing(3).foregroundStyle(.white.opacity(0.88))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
