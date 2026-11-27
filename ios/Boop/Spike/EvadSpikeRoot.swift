#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

/// THROWAWAY simulator spike (spec `2026-11-27-boop-evad-szoba-kezdolap-design.md`, `mezo-r36n9.196`): the barless
/// home ring with ten orbs, the Nap room, the Évad room, the Sunday review and the Étel room's weekly menu — all on
/// invented, real-looking figures. Never merged.
///
/// `-spikeEvad <screen>` opens straight into a screen:
/// `home` · `nap` · `napok` · `most` · `most-vasarnap` · `most-ures` · `het` · `terv` · `kiserlet` · `nincs-evad` ·
/// `mimirehat` · `tanult` · `atnezes1`…`atnezes5` · `etel`.
enum SpikeScreen: Equatable {
    case home
    case nap(String)
    case evad(String)
    case noSeason
    case sub(String)
    case review(Int)
    case etel

    static var initial: SpikeScreen {
        switch UserDefaults.standard.string(forKey: "spikeEvad") ?? "home" {
        case "nap": .nap("Ma")
        case "napok": .nap("Napok")
        case "most", "most-vasarnap", "most-ures": .evad("Most")
        case "het": .evad("Hét")
        case "terv": .evad("Terv")
        case "kiserlet": .evad("Kísérlet")
        case "nincs-evad": .noSeason
        case "mimirehat": .sub("mimirehat")
        case "tanult": .sub("tanult")
        case "etel": .etel
        case let s where s.hasPrefix("atnezes"): .review(Int(s.dropFirst(7)) ?? 1)
        default: .home
        }
    }
}

/// The spike's mode of the Most tab: an ordinary mid-week day, Sunday evening (the review card on top), or Monday
/// morning with nothing judged yet.
enum SpikeMostMode { case normal, sunday, early
    static var current: SpikeMostMode {
        switch UserDefaults.standard.string(forKey: "spikeEvad") {
        case "most-vasarnap": .sunday
        case "most-ures": .early
        default: .normal
        }
    }
}

struct EvadSpikeRoot: View {
    @State private var screen = SpikeScreen.initial
    @State private var evadTab: String = {
        if case .evad(let t) = SpikeScreen.initial { return t }
        return "Most"
    }()
    @State private var napTab: String = {
        if case .nap(let t) = SpikeScreen.initial { return t }
        return "Ma"
    }()
    @State private var toast: String?

    var body: some View {
        ZStack {
            content
                .transition(.opacity)
                .environment(\.nkInitialScrollY, UserDefaults.standard.object(forKey: "previewScroll") == nil
                             ? nil : CGFloat(UserDefaults.standard.double(forKey: "previewScroll")))
            if showsPlus {
                SpikePlus(raised: raisedPlus) { toast = "„Mit rögzítesz?” — a mai lap változatlanul" }
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: screen)
        .nkToast($toast)
        .preferredColorScheme(.dark)
    }

    @ViewBuilder private var content: some View {
        switch screen {
        case .home:
            SpikeHome(open: go, toast: { toast = $0 })
        case .nap:
            SpikeNapRoom(tab: $napTab, back: { go(.home) }, ask: { toast = "Boop-beszélgetés" })
        case .evad:
            SpikeEvadRoom(tab: $evadTab, mode: SpikeMostMode.current, back: { go(.home) }, open: go,
                          ask: { toast = "Boop-beszélgetés" })
        case .noSeason:
            SpikeNoSeason(back: { go(.home) })
        case .sub(let s):
            if s == "mimirehat" {
                SpikeMiMireHat(back: { go(.evad("Terv")) })
            } else {
                SpikeTanult(back: { go(.evad("Hét")) })
            }
        case .review(let page):
            SpikeReview(page: page, close: { go(.evad("Hét")) })
        case .etel:
            SpikeEtelRoom(back: { go(.home) })
        }
    }

    private func go(_ s: SpikeScreen) {
        if case .evad(let t) = s { evadTab = t }
        if case .nap(let t) = s { napTab = t }
        screen = s
    }

    /// The „+" floats on the ring and in the rooms; it steps aside on sub-pages and the full-screen review.
    private var showsPlus: Bool {
        switch screen {
        case .home, .nap, .evad, .etel, .noSeason: true
        default: false
        }
    }

    /// In a room the bar runs along the bottom, so the „+" sits just above its right end.
    private var raisedPlus: Bool { screen != .home }
}

/// The floating glass „+" (bottom-right): the bar's old „+", alone.
struct SpikePlus: View {
    let raised: Bool
    let action: () -> Void
    var body: some View {
        VStack {
            Spacer()
            HStack {
                Spacer()
                Button(action: action) {
                    NKGlyph("plus-ink", .white, size: 22).frame(width: 58, height: 58)
                }
                .buttonStyle(.plain)
                .glassEffect(.regular.interactive(), in: .circle)
                .shadow(color: .black.opacity(0.35), radius: 12, y: 4)
                .accessibilityLabel("Rögzítés")
            }
            .padding(.trailing, 20)
            .padding(.bottom, raised ? 78 : 18)
        }
    }
}

// MARK: - Home

/// The barless home: a slim title row („boop" + the avatar), ten orbs, Boop's orb in the middle (→ chat) with his
/// daily line under it, and nothing else but the floating „+".
struct SpikeHome: View {
    let open: (SpikeScreen) -> Void
    let toast: (String) -> Void
    @State private var motion = OrbMotion()

    static let world = Hue.alvas

    var body: some View {
        GeometryReader { geo in
            let narrow = geo.size.width < 380
            let ring = min(geo.size.width - 6, geo.size.height * (narrow ? 0.60 : 0.56))
            ZStack {
                NKPhotoSky(hue: Self.world, photo: NKPhoto.hegy)
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped()
                    .ignoresSafeArea()
                DriftingFog(hue: Self.world, center: 0.58, height: 0.46)
                VStack(spacing: 0) {
                    titleRow
                        .padding(.top, narrow ? 24 : 58)
                    Spacer(minLength: 0)
                    NKOrbRing(items: spikeRingItems, orbSize: ring < 360 ? 44 : (ring < 400 ? 50 : 54)) { item, _ in
                        tap(item)
                    } center: {
                        boopCenter(size: ring < 360 ? 104 : 122)
                    }
                    .frame(width: ring, height: ring)
                    .frame(maxWidth: .infinity)
                    boopLine.padding(.top, narrow ? 14 : 30)
                    Spacer(minLength: 0)
                    Color.clear.frame(height: narrow ? 64 : 80)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .ignoresSafeArea()
    }

    private var titleRow: some View {
        HStack {
            Color.clear.frame(width: 44, height: 44)
            Spacer()
            Text("boop").font(.custom(Lagy.outfitFamily, size: 26).weight(.light)).tracking(3).foregroundStyle(.white)
            Spacer()
            Button { toast("Fiók") } label: {
                NKGlyph("person-sage", .white, size: 20).frame(width: 44, height: 44).glassEffect(.clear, in: .circle)
            }
            .buttonStyle(.plain).accessibilityLabel("Fiók")
        }
        .padding(.horizontal, 16)
    }

    private func boopCenter(size: CGFloat) -> some View {
        LivingOrb(palette: boopOrb, size: size, level: 0.72, glow: true, motion: motion, animated: true)
            .allowsHitTesting(false)
            .frame(width: size, height: size)
            .contentShape(Circle())
            .onTapGesture { toast("Boop-beszélgetés — teljes képernyőn, vissza a gyűrűre") }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Boop · beszélgetés megnyitása")
            .accessibilityAddTraits(.isButton)
    }

    private var boopLine: some View {
        VStack(spacing: 6) {
            Text("Nyugodt nap, este röplabda")
                .nkFont(23, design: .serif).foregroundStyle(.white)
                .multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.7)
                .shadow(color: .black.opacity(0.55), radius: 10)
            Text("KÉRDEZD BOOPOT").nkFont(11, .medium, design: .monospaced).tracking(2.2)
                .foregroundStyle(.white.opacity(0.62))
        }
        .padding(.horizontal, 28)
    }

    private func tap(_ item: NKRingItem) {
        switch item.id {
        case "nap": open(.nap("Ma"))
        case "evad": open(.evad("Most"))
        case "etel": open(.etel)
        default: toast("\(item.name) — a szoba változatlan")
        }
    }
}

/// Ten orbs, clockwise from the top: Nap, Alvás, Étel, Edzés, Energia, **Évad**, Súly, Forma, Pénz, Levél.
@MainActor let spikeRingItems: [NKRingItem] = {
    func item(_ id: String, _ name: String, _ hue: Hue?, _ n: Int?) -> NKRingItem {
        let palette = hue?.orb ?? [Color(hex: 0x0A2C38), Color(hex: 0x1F7A8C), Color(hex: 0x8FD9E8), Color(hex: 0xC9F0E2)]
        let glow = hue?.glow ?? Color(hex: 0x4FC3D9)
        return NKRingItem(id: id, name: name, palette: palette, glow: glow, display: n.map { "\($0)" } ?? "–",
                          level: n.map { min(1, max(0.08, Double($0) / 100)) } ?? 0.12, live: true)
    }
    return [item("nap", "Nap", nil, 46), item("alvas", "Alvás", .alvas, 71), item("etel", "Étel", .fuel, 64),
            item("edzes", "Edzés", .mozgas, 80), item("energia", "Energia", .pulzus, 58),
            item("evad", "Évad", .evad, 78), item("suly", "Súly", .suly, 84), item("forma", "Forma", .forma, 69),
            item("penz", "Pénz", .penz, 42), item("level", "Levél", .level, 7)]
}()

// MARK: - Shared spike pieces

/// A glass card with a mono head (hue tick, glyph, label, trailing word and an optional chevron) — the spike's one card.
struct SpikeCard<Content: View>: View {
    let label: String, glyph: String?, trailing: String?, hue: Hue, chevron: Bool
    let action: (() -> Void)?
    let content: Content
    init(_ label: String, glyph: String? = nil, trailing: String? = nil, hue: Hue = .evad, chevron: Bool = false,
         action: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.label = label; self.glyph = glyph; self.trailing = trailing; self.hue = hue; self.chevron = chevron
        self.action = action; self.content = content()
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Capsule().fill(hue.glow).frame(width: 3, height: 13)
                if let glyph { NKGlyph(glyph, hue.glow.opacity(0.95), size: 15) }
                NKMono(label.uppercased()).lineLimit(2)
                Spacer(minLength: 8)
                if let trailing { Text(trailing).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1) }
                if chevron {
                    Image(systemName: "chevron.right").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.45))
                }
            }
            content
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()
        .contentShape(RoundedRectangle(cornerRadius: 26))
        .onTapGesture { action?() }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(action == nil ? [] : .isButton)
    }
}

/// A plain one-line explanation in white 70 %.
struct SpikeLine: View {
    let text: String
    var size: CGFloat = 14
    var opacity: Double = 0.72
    init(_ text: String, size: CGFloat = 14, opacity: Double = 0.72) { self.text = text; self.size = size; self.opacity = opacity }
    var body: some View {
        Text(text).nkFont(size).foregroundStyle(.white.opacity(opacity))
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A labelled horizontal bar: name, the fill, and „3 / 4 nap" at the end.
struct SpikeBar: View {
    let glyph: String, name: String, done: Int, of: Int, unit: String, hue: Hue
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            // Large text: the name on its own line, the count and its unit under it — never a word broken mid-way.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) {
                    title
                    Spacer(minLength: 6)
                    count
                }
                VStack(alignment: .leading, spacing: 4) {
                    title
                    count
                }
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.10))
                    Capsule().fill(LinearGradient(colors: [hue.orb[1], hue.glow], startPoint: .leading, endPoint: .trailing))
                        .frame(width: max(8, g.size.width * Double(done) / Double(max(1, of))))
                }
            }
            .frame(height: 8)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(name): \(done) a \(of)-ből, \(unit)")
    }

    private var title: some View {
        HStack(spacing: 8) {
            NKGlyph(glyph, .white.opacity(0.85), size: 15)
            Text(name).nkFont(15, .medium).foregroundStyle(.white).fixedSize()
        }
    }

    private var count: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text("\(done) / \(of)").font(.custom(Lagy.outfitFamily, size: 18).weight(.light)).foregroundStyle(.white).fixedSize()
            Text(unit).nkFont(12).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// How one day of the week went.
enum SpikeDay { case inPlan, out, kimelo, today, future }

/// Seven day dots, Monday to Sunday.
struct SpikeDayDots: View {
    let days: [SpikeDay]
    var hue: Hue = .evad
    static let names = ["H", "K", "Sze", "Cs", "P", "Szo", "V"]
    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 0) {
                ForEach(0..<7, id: \.self) { i in
                    VStack(spacing: 8) {
                        dot(days[i])
                        Text(Self.names[i]).nkFont(11, .medium, design: .monospaced)
                            .foregroundStyle(.white.opacity(days[i] == .future ? 0.4 : 0.75))
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            HStack(spacing: 14) {
                legend(.inPlan, "tervben"); legend(.out, "kicsúszott"); legend(.kimelo, "kímélő")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("A hét napjai: hétfő tervben, kedd tervben, szerda kicsúszott, csütörtök kímélő, péntek ma")
    }

    @ViewBuilder private func dot(_ d: SpikeDay, size: CGFloat = 30) -> some View {
        switch d {
        case .inPlan:
            Circle().fill(LinearGradient(colors: [hue.orb[2], hue.orb[1]], startPoint: .top, endPoint: .bottom))
                .frame(width: size, height: size).shadow(color: hue.glow.opacity(0.6), radius: 6)
        case .out:
            Circle().stroke(NK.under.opacity(0.85), lineWidth: 2.5).frame(width: size - 3, height: size - 3)
        case .kimelo:
            Circle().fill(Color(hex: 0x6E8FA0).opacity(0.55)).frame(width: size, height: size)
                .overlay(Capsule().fill(.white.opacity(0.7)).frame(width: size * 0.45, height: 2.5))
        case .today:
            Circle().stroke(.white, lineWidth: 2.5).frame(width: size - 3, height: size - 3)
                .overlay(Circle().fill(.white).frame(width: 7, height: 7))
        case .future:
            Circle().stroke(.white.opacity(0.22), style: StrokeStyle(lineWidth: 1.5, dash: [3, 3])).frame(width: size - 4, height: size - 4)
        }
    }

    private func legend(_ d: SpikeDay, _ word: String) -> some View {
        HStack(spacing: 6) {
            dot(d, size: 11)
            Text(word).nkFont(11.5).foregroundStyle(.white.opacity(0.6))
        }
    }
}

/// A navigable row inside a card: glyph, title + sub, and a chevron.
struct SpikeRow: View {
    let glyph: String, title: String, sub: String
    var value: String? = nil
    var hue: Hue = .evad
    var body: some View {
        HStack(spacing: 12) {
            NKGlyph(glyph, hue.glow, size: 18)
                .frame(width: 38, height: 38)
                .background(Circle().fill(.white.opacity(0.07)))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).nkFont(15, .medium).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                if !sub.isEmpty {
                    Text(sub).nkFont(12.5).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 6)
            if let value { Text(value).nkFont(13, .medium).foregroundStyle(.white.opacity(0.8)) }
            Image(systemName: "chevron.right").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.35))
        }
        .accessibilityElement(children: .combine)
    }
}
#endif
