import SwiftUI

// Throwaway spike (mezo-r36n9.14, B4 Étel, 2026-11-13): the full food room in the Napkelte look,
// built photo-first per the Képek guideline (2026-11-13-boop-kepek-design.md):
// a photo in the sky (room head), a photo on the card (meals, recipes, pantry) — nothing in between.
// Fake data, no networking.
// Launch: -etel YES [-etelTab 0–3] [-etelOpen composer|barcode|dimension|recept-import|erzekenyseg|kihagyas|kiegeszito]

enum EArg {
    static let d = UserDefaults.standard
    static func int(_ k: String, _ lo: Int, _ hi: Int, _ def: Int = 0) -> Int {
        guard d.object(forKey: k) != nil else { return def }
        return min(hi, max(lo, d.integer(forKey: k)))
    }
    static func str(_ k: String) -> String? { d.string(forKey: k).flatMap { $0.isEmpty ? nil : $0 } }
}

/// The Fuel colour world (Napkelte `Hue.fuel`).
enum EHue {
    static let sky: [Color] = [Color(hex: 0x15567A), Color(hex: 0x4FB9A2), Color(hex: 0xE9F3B4)]
    static let top = Color(hex: 0x15567A)
    static let glow = Color(hex: 0x4FB9A2)
    /// The one fixed mood photo of the Fuel world (Képek §3.2: herbs / kitchen).
    static let mood = "konyha.jpg"
}

// MARK: - Képek: the photo head and the card photo band

/// A room head built from a photo (Képek §3.3): the mood photo fills it, toned down, with the hue's own sky
/// gradient over it — dark at the top, thinning at the horizon, closing into the page at the bottom.
/// `photoName == nil` falls back to the painted landscape, so every screen is correct with no photo at all.
struct EPhotoHead: View {
    var photoName: String? = EHue.mood
    var height: CGFloat = 360
    var body: some View {
        Color.clear.frame(height: height)
            .overlay {
                ZStack {
                    if let p = photoName {
                        photo(p).resizable().scaledToFill().saturation(0.8).brightness(-0.06)
                        LinearGradient(stops: [
                            .init(color: EHue.sky[0].opacity(0.85), location: 0),
                            .init(color: EHue.sky[1].opacity(0.42), location: 0.55),
                            .init(color: EHue.sky[2].opacity(0.30), location: 0.72),
                            .init(color: gBase.opacity(0.92), location: 1),
                        ], startPoint: .top, endPoint: .bottom)
                    } else {
                        PaintedLandscape(sky: EHue.sky)
                    }
                }
            }
            .clipped()
            .mask(LinearGradient(stops: [.init(color: .black, location: height > 240 ? 0.62 : 0.34),
                                         .init(color: .clear, location: 1)],
                                 startPoint: .top, endPoint: .bottom))
    }
}

/// A photo band at the top of a card (Képek §3.3 rule 3: a dark gradient before any white type).
struct ECardPhoto: View {
    var name: String
    var height: CGFloat = 124
    var body: some View {
        photo(name).resizable().scaledToFill().saturation(0.8).brightness(-0.06)
            .frame(height: height).frame(maxWidth: .infinity).clipped()
            .overlay(alignment: .bottom) {
                LinearGradient(colors: [.clear, gBase.opacity(0.75)], startPoint: .top, endPoint: .bottom)
                    .frame(height: height * 0.6)
            }
    }
}

/// A row thumbnail in place of the glyph circle (Képek §3.1: 38–44 pt, only for a row that is a *thing*).
struct EThumb: View {
    var name: String?
    var glyph: String = "bowl-cream"
    var size: CGFloat = 42
    var body: some View {
        Group {
            if let n = name {
                photo(n).resizable().scaledToFill().saturation(0.8).brightness(-0.06)
            } else {
                ZStack { Color.white.opacity(0.08); AuraGlyph(glyph, .white, size: size * 0.42) }
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.3, style: .continuous))
    }
}

// MARK: - Fake data

struct EMeal: Identifiable {
    let id = UUID()
    let time: String, title: String, photo: String?, kcal: Int, p: Int, c: Int, f: Int
    let score: Int
    /// name, 0–100 or nil for "nincs adat"
    let dims: [(String, Int?)]
    let boop: String
    let glucose: String?
    let flags: [EFlag]

    static let dimsGood: [(String, Int?)] = [("Makrók", 86), ("Feldolgozottság", 92), ("WHO", 78), ("Rost", 64),
                                             ("Zsírminőség", 81), ("Növényi változatosság", 55), ("Adag", 88), ("Napi helyzet", 90)]
    static let dimsMixed: [(String, Int?)] = [("Makrók", 71), ("Feldolgozottság", 38), ("WHO", 60), ("Rost", 42),
                                              ("Zsírminőség", 55), ("Növényi változatosság", 30), ("Adag", 74), ("Napi helyzet", nil)]

    static let reggeli = EMeal(time: "07:35", title: "Zabkása áfonyával, laktózmentes tejjel", photo: "zab-sq.jpg",
                               kcal: 523, p: 25, c: 67, f: 14, score: 82, dims: dimsGood,
                               boop: "Jó kezdés: a fehérje a helyén, a rost viszont elmarad a napi harmadától.",
                               glucose: "Legközelebb laposabb: tegyél bele egy evőkanál chiamagot.",
                               flags: [])
    static let ebed = EMeal(time: "12:40", title: "Sült lazac, barna rizs, párolt brokkoli", photo: "lazac-sq.jpg",
                            kcal: 640, p: 42, c: 55, f: 24, score: 88, dims: dimsGood,
                            boop: "Ez a nap legjobb étkezése eddig. A lazac zsírprofilja viszi fel.",
                            glucose: nil, flags: [])
    static let nasi = EMeal(time: "15:10", title: "Proteinszelet + kávé", photo: nil,
                            kcal: 280, p: 20, c: 24, f: 11, score: 54, dims: dimsMixed,
                            boop: "Belefér, de ez a nap feldolgozott csúcsa — a kalóriák nagyobbik fele innen jön.",
                            glucose: "Legközelebb laposabb: egy marék dió és egy alma ugyanennyi fehérjét ad lassabban.",
                            flags: [.nova])
}

enum EFlag: Hashable {
    case laktoz(String), nyomokban(String), nova
    var text: String {
        switch self {
        case .laktoz(let w): "Laktóz · \(w)"
        case .nyomokban(let w): "Nyomokban \(w)"
        case .nova: "Feldolgozott · 4-es"
        }
    }
    var strong: Bool { if case .laktoz = self { true } else { false } }
}

struct EWindow: Identifiable {
    let id = UUID()
    let slot: String, from: String, to: String
    let kcal: Int
    let state: EState
    let meal: EMeal?
    let suggestion: (title: String, sub: String, photo: String?)?
}

enum EState { case done, now, pending, missed, skipped }

enum EData {
    static let targetKcal = 2350, eatenKcal = 1443
    static let targetP = 165, eatenP = 87
    static let targetC = 250, eatenC = 146
    static let targetF = 78, eatenF = 49

    static let windows: [EWindow] = [
        EWindow(slot: "Reggeli", from: "07:00", to: "08:30", kcal: 560, state: .done, meal: .reggeli, suggestion: nil),
        EWindow(slot: "Ebéd", from: "12:00", to: "13:30", kcal: 700, state: .done, meal: .ebed, suggestion: nil),
        EWindow(slot: "Uzsonna", from: "15:00", to: "16:00", kcal: 300, state: .done, meal: .nasi, suggestion: nil),
        EWindow(slot: "Edzés előtt", from: "17:15", to: "17:45", kcal: 220, state: .now, meal: nil,
                suggestion: ("Banán + rizskása", "gyors szénhidrát a 18:00-s edzéshez", "gyumolcs-sq.jpg")),
        EWindow(slot: "Vacsora", from: "20:00", to: "21:00", kcal: 570, state: .pending, meal: nil,
                suggestion: ("Görög csirkesaláta", "a recepted · 46 g fehérje · laktózmentes", "gorog-sq.jpg")),
    ]

    static let tip = "Még 907 kalória és 78 g fehérje fér bele. A görög csirkesalátád ebből 46-ot hoz — a többi elfér a vacsora mellé."

    static let supplements: [(String, [String], Bool)] = [
        ("Reggel", ["D3-vitamin 4000 NE", "Omega-3 2 g", "Magnézium 200 mg", "K2 100 µg"], true),
        ("Edzés körül", ["Kreatin 5 g", "Elektrolit"], false),
        ("Este", ["Magnézium-glicinát 400 mg", "Cink 15 mg"], false),
    ]

    static let recipes: [(String, String, Int, Int, Int, [EFlag])] = [
        ("Görög csirkesaláta", "gorog-sq.jpg", 2, 480, 46, []),
        ("Sült lazac barna rizzsel", "lazac-sq.jpg", 2, 640, 42, []),
        ("Túrós zabkása áfonyával", "zab-sq.jpg", 1, 523, 25, [.laktoz("túró")]),
        ("Rántotta avokádóval", "omlett-sq.jpg", 1, 410, 28, []),
        ("Csirkés rizstál", "csirke-sq.jpg", 3, 590, 44, []),
        ("Zöld smoothie", "smoothie-sq.jpg", 1, 240, 12, []),
        ("Görög joghurtos bowl", "joghurt-sq.jpg", 1, 320, 24, [.laktoz("görög joghurt")]),
        ("Vegyes saláta tonhallal", "salata-sq.jpg", 2, 380, 34, []),
    ]

    static let pantry: [(String, String?, String, Int, Int, [EFlag])] = [
        ("Csirkemell filé", "csirke-sq.jpg", "Hús · 412 g", 1, 165, []),
        ("Zabpehely", "zab-sq.jpg", "Gabona · 1,2 kg", 1, 375, [.nyomokban("glutén")]),
        ("Görög joghurt 2%", "joghurt-sq.jpg", "Tejtermék · 900 g", 1, 73, [.laktoz("tej")]),
        ("Lazacfilé", "lazac-sq.jpg", "Hal · 600 g", 1, 208, []),
        ("Proteinszelet · karamell", nil, "Snack · 6 db", 4, 367, [.laktoz("tejsavófehérje"), .nova]),
        ("Olívaolaj extra szűz", nil, "Zsiradék · 750 ml", 1, 884, []),
    ]

    static let week: [Double] = [2280, 2410, 2150, 2390, 2620, 2200, 1443]
    static let weekDays = ["H", "K", "Sze", "Cs", "P", "Szo", "V"]
}

// MARK: - Root

struct EtelRoot: View {
    @State private var tab = ["Ma", "Receptek", "Kamra", "Hét"][EArg.int("etelTab", 0, 3)]
    @State private var sheet: String? = EArg.str("etelOpen")
    @State private var dimension: (String, Int?)?
    @State private var toast: String?

    var body: some View {
        ZStack(alignment: .bottom) {
            EtelRoom(tab: $tab, onOpen: { sheet = $0 }, onDimension: { dimension = $0 }, onToast: show)
            if let t = toast {
                Text(t).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white)
                    .padding(.horizontal, 18).padding(.vertical, 12)
                    .background(Capsule().fill(.white.opacity(0.14))).glassEffect(.regular, in: .capsule)
                    .padding(.bottom, 36).transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .sheet(item: Binding(get: { sheet.map { ESheetID(id: $0) } }, set: { sheet = $0?.id })) { s in
            ESheetHost(kind: s.id, onToast: show, onOpen: { sheet = $0 })
        }
        .sheet(item: Binding(get: { dimension.map { EDimID(name: $0.0, value: $0.1) } }, set: { _ in dimension = nil })) { d in
            EDimensionSheet(name: d.name, value: d.value)
        }
        .preferredColorScheme(.dark)
    }

    private func show(_ t: String) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { toast = t }
        Task { try? await Task.sleep(for: .seconds(2.4)); withAnimation { toast = nil } }
    }
}

struct ESheetID: Identifiable { let id: String }
struct EDimID: Identifiable { var id: String { name }; let name: String; let value: Int? }

struct ESheetHost: View {
    let kind: String
    let onToast: (String) -> Void
    let onOpen: (String?) -> Void
    var body: some View {
        switch kind {
        case "composer": EComposer(onToast: onToast, onOpen: onOpen)
        case "barcode": EBarcode(onToast: onToast, onOpen: onOpen)
        case "adag": EServingConfirm(onToast: onToast)
        case "recept-import": ERecipeImport(onToast: onToast)
        case "erzekenyseg": ESensitivitySettings()
        case "kihagyas": ESkipSheet(onToast: onToast)
        case "kiegeszito": ESupplementEdit(onToast: onToast)
        case "dimenzio": EDimensionSheet(name: "Feldolgozottság", value: 38)
        default: EComposer(onToast: onToast, onOpen: onOpen)
        }
    }
}

// MARK: - The room frame (NKDrillPage with inner tabs, in spike form)

struct EtelRoom: View {
    @Binding var tab: String
    let onOpen: (String) -> Void
    let onDimension: ((String, Int?)) -> Void
    let onToast: (String) -> Void
    private let tabs = ["Ma", "Receptek", "Kamra", "Hét"]

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .top) {
                    EPhotoHead()
                    VStack(spacing: 0) {
                        HStack(spacing: 10) {
                            Button { onToast("Vissza a Ma oldalra") } label: {
                                Image(systemName: "chevron.left").font(.system(size: 17, weight: .semibold))
                                    .foregroundStyle(.white).frame(width: 44, height: 44)
                            }
                            .buttonStyle(.plain).glassEffect(.clear.interactive(), in: .circle)
                            Text("Ma · Étel").font(.system(size: 15, weight: .medium)).foregroundStyle(.white.opacity(0.85))
                            Spacer()
                        }
                        .padding(.horizontal, 16).padding(.top, 58)
                        VStack(spacing: 8) {
                            StillOrb(colors: EHue.sky, size: 64, level: 0.61)
                                .shadow(color: EHue.glow.opacity(0.6), radius: 20)
                                // Képek §3.3 rule 5: no photo detail behind the orb — it stays the one focal point.
                                .background(
                                    RadialGradient(colors: [gBase.opacity(0.85), gBase.opacity(0)],
                                                   center: .center, startRadius: 10, endRadius: 86)
                                        .frame(width: 180, height: 180)
                                        .blur(radius: 12)
                                )
                            GLabel("ÉTKEZÉS · MA").padding(.top, 6)
                            Text("907 kalória van még hátra").font(AuraFont.serif(34)).foregroundStyle(.white)
                                .multilineTextAlignment(.center)
                            Text("A fehérje van a legmesszebb: 87 g a 165-ből. Az edzés előtti falat és a vacsora bőven behozza.")
                                .font(.system(size: 15.5)).lineSpacing(3).multilineTextAlignment(.center)
                                .foregroundStyle(.white.opacity(0.85)).padding(.horizontal, 26)
                            ETabStrip(tabs: tabs, selected: $tab).padding(.top, 20)
                        }
                        .padding(.top, 28)
                    }
                }
                Group {
                    switch tab {
                    case "Receptek": EtelReceptek(onOpen: onOpen, onToast: onToast)
                    case "Kamra": EtelKamra(onOpen: onOpen, onToast: onToast)
                    case "Hét": EtelHet(onToast: onToast)
                    default: EtelMa(onOpen: onOpen, onDimension: onDimension, onToast: onToast)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 44)
                .background(FloatingLights(hue: EHue.glow).padding(.vertical, -100))
                MirroredLand(sky: EHue.sky).padding(.top, -20)
            }
        }
        .scrollIndicators(.hidden)
        .ignoresSafeArea(edges: .top)
        .background(gPageBackground(EHue.top).ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
    }
}

struct ETabStrip: View {
    let tabs: [String]
    @Binding var selected: String
    var body: some View {
        HStack(spacing: 6) {
            ForEach(tabs, id: \.self) { t in
                let on = t == selected
                Button { withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { selected = t } } label: {
                    Text(t).font(.system(size: 14, weight: on ? .semibold : .regular))
                        .foregroundStyle(on ? gBase : .white.opacity(0.85))
                        .padding(.horizontal, 15).padding(.vertical, 9)
                        .background(Capsule().fill(on ? .white.opacity(0.95) : .white.opacity(0.1)))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 10)
    }
}

/// A numbered white-label section, as in the shipped room skeleton.
struct ESection<C: View>: View {
    let n: Int, label: String
    @ViewBuilder let content: () -> C
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Text("\(n)").font(.custom("Outfit", size: 15).weight(.medium)).foregroundStyle(.white.opacity(0.6))
                GLabel(label)
            }
            content()
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).gCard()
    }
}

/// The quiet badge of a sensitivity or a processed item.
struct EFlagBadge: View {
    let flag: EFlag
    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(flag.strong ? Color(hex: 0xF4C860) : .white.opacity(0.5)).frame(width: 5, height: 5)
            Text(flag.text).font(.system(size: 11.5, weight: .medium)).foregroundStyle(.white.opacity(flag.strong ? 0.9 : 0.6))
        }
        .padding(.horizontal, 9).padding(.vertical, 4)
        .background(Capsule().fill(.white.opacity(0.08)))
    }
}
