import SwiftUI

// Throwaway spike (mezo-r36n9.15, B5 Edzés, 2026-11-13): the full training room in the Napkelte look,
// built photo-first per the Képek guideline (2026-11-13-boop-kepek-design.md):
// a photo in the sky (room head), a photo on the card (the session, an exercise, a past day) — nothing in between.
// Fake data, no networking. Owner decisions carried in: phone only (no Watch), the full room incl. the plan
// builder, sport in / running out.
// Launch: -edzes YES [-edzesTab 0–3] [-edzesOpen player|csere|kihagyas|kimelo|varazslo|gyakorlat|jelentes|osszehasonlit|terkep|sport]
//         [-edzesOffline YES] [-edzesPlayerStep 0–4]

enum WArg {
    static let d = UserDefaults.standard
    static func int(_ k: String, _ lo: Int, _ hi: Int, _ def: Int = 0) -> Int {
        guard d.object(forKey: k) != nil else { return def }
        return min(hi, max(lo, d.integer(forKey: k)))
    }
    static func str(_ k: String) -> String? { d.string(forKey: k).flatMap { $0.isEmpty ? nil : $0 } }
    static func on(_ k: String) -> Bool { d.bool(forKey: k) }
}

/// The Mozgás colour world (Napkelte `Hue.mozgas`) — Edzés lives in it.
enum WHue {
    static let sky: [Color] = [Color(hex: 0x2F57B0), Color(hex: 0xF09A55), Color(hex: 0xFFD98C)]
    static let orb: [Color] = [Color(hex: 0x6B2A0E), Color(hex: 0xE0702E), Color(hex: 0xF7C27A), Color(hex: 0xF0508C)]
    static let top = Color(hex: 0x4A2810)
    static let glow = Color(hex: 0xF29A4A)
    /// The one fixed mood photo of the Mozgás world (Képek §3.2: lake / trail). CC0.
    static let mood = "aura-hegy.jpg"
}

// MARK: - Képek: the photo head, the card band, the row thumbnail

/// A room head built from a photo (Képek §3.3): the mood photo fills it, toned down, with the hue's own sky
/// gradient over it. `photoName == nil` falls back to the painted landscape — every screen must be right with
/// no photo at all.
struct WPhotoHead: View {
    var photoName: String? = WHue.mood
    var height: CGFloat = 360
    var body: some View {
        Color.clear.frame(height: height)
            .overlay {
                ZStack {
                    if let p = photoName {
                        photo(p).resizable().scaledToFill().saturation(0.8).brightness(-0.06)
                        LinearGradient(stops: [
                            .init(color: WHue.sky[0].opacity(0.85), location: 0),
                            .init(color: WHue.sky[1].opacity(0.42), location: 0.55),
                            .init(color: WHue.sky[2].opacity(0.30), location: 0.72),
                            .init(color: gBase.opacity(0.92), location: 1),
                        ], startPoint: .top, endPoint: .bottom)
                    } else {
                        PaintedLandscape(sky: WHue.sky)
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
struct WCardPhoto: View {
    var name: String
    var height: CGFloat = 124
    var body: some View {
        photo(name).resizable().scaledToFill().saturation(0.8).brightness(-0.06)
            .frame(height: height).frame(maxWidth: .infinity).clipped()
            .overlay(alignment: .bottom) {
                LinearGradient(colors: [.clear, gBase.opacity(0.78)], startPoint: .top, endPoint: .bottom)
                    .frame(height: height * 0.6)
            }
    }
}

/// A row thumbnail in place of the glyph circle (Képek §3.1): only for a row that is a *thing* — an exercise,
/// a session. A row that is a moment (a check-in, "Boop észrevette") keeps its glyph.
struct WThumb: View {
    var name: String?
    var glyph: String = "dumbbell-ink"
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

/// One prescribed set: what the engine says to do. `done` carries what was actually logged.
struct WSet: Identifiable {
    let id = UUID()
    let kind: WSetKind
    let kg: Double
    let reps: Int
    let rir: Int
    var doneKg: Double?
    var doneReps: Int?
    var doneRir: Int?
    var isDone: Bool { doneReps != nil }
}

enum WSetKind { case warmup, working
    var label: String { self == .warmup ? "Bemelegítő" : "Munka" }
}

struct WExercise: Identifiable {
    let id = UUID()
    let name: String
    let photo: String?
    let zone: String
    /// The engine's own sentence about why this weight (`progression.rationale`).
    let why: String
    /// What the same exercise did last time, for the reference line.
    let last: String
    let note: String?
    var sets: [WSet]
    var doneCount: Int { sets.filter(\.isDone).count }
    var workingCount: Int { sets.filter { $0.kind == .working }.count }
}

enum WData {
    // The owner's live plan shape: an 8-week block in week 2, five days a week.
    static let mesoTitle = "Back & Bicep Heavy All Body"
    static let mesoWeeks = 8
    static let mesoWeek = 2
    static let phaseCurve = ["MEV", "MEV", "MAV", "MAV", "MAV", "MAV", "MRV", "Deload"]
    static let split = "Upper / Lower / Push / Pull / Legs · 5×/hét"

    static let todayTitle = "Push"
    static let todayTime = "18:00"
    static let todayPhoto = "edz-sulyzo.jpg"

    static func exercises() -> [WExercise] {
        [
            WExercise(name: "Barbell Bench Press", photo: "gyak-barbell-bench-press.jpg", zone: "Mell · Tricepsz",
                      why: "+2,5 kg: múlt héten 8 ismétlés ment RIR 2-vel, a sáv tetején.",
                      last: "Múlt kedden 67,5 kg × 8 · RIR 2", note: "Lapockát hátra, a rúd a mellcsont alsó harmadára.",
                      sets: [WSet(kind: .warmup, kg: 40, reps: 10, rir: 5, doneKg: 40, doneReps: 10, doneRir: 5),
                             WSet(kind: .warmup, kg: 55, reps: 6, rir: 4, doneKg: 55, doneReps: 6, doneRir: 4),
                             WSet(kind: .working, kg: 70, reps: 8, rir: 2, doneKg: 70, doneReps: 8, doneRir: 2),
                             WSet(kind: .working, kg: 70, reps: 8, rir: 2),
                             WSet(kind: .working, kg: 70, reps: 8, rir: 2)]),
            WExercise(name: "Incline Dumbbell Press", photo: "gyak-incline-db-press.jpg", zone: "Mell felső",
                      why: "Tartjuk: múlt héten 9 ismétlés ment, a sáv közepén vagyunk.",
                      last: "Múlt kedden 2 × 26 kg × 9 · RIR 2", note: nil,
                      sets: [WSet(kind: .working, kg: 26, reps: 10, rir: 2),
                             WSet(kind: .working, kg: 26, reps: 10, rir: 2),
                             WSet(kind: .working, kg: 26, reps: 10, rir: 2)]),
            WExercise(name: "Overhead Press", photo: "gyak-overhead-press.jpg", zone: "Váll",
                      why: "+1 ismétlés: múlt héten 7 ment, a sáv alján.",
                      last: "Múlt kedden 42,5 kg × 7 · RIR 1", note: "Bordakosarat lezárni, ne hátradőlni.",
                      sets: [WSet(kind: .warmup, kg: 25, reps: 8, rir: 5),
                             WSet(kind: .working, kg: 42.5, reps: 8, rir: 2),
                             WSet(kind: .working, kg: 42.5, reps: 8, rir: 2),
                             WSet(kind: .working, kg: 42.5, reps: 8, rir: 2)]),
            WExercise(name: "Cable Lateral Raise", photo: "gyak-lateral-raise.jpg", zone: "Váll közép",
                      why: "Egy sorozattal több: a váll heti mennyisége most lépett 14-ről 16-ra.",
                      last: "Múlt kedden 12 kg × 14 · RIR 1", note: nil,
                      sets: [WSet(kind: .working, kg: 12, reps: 14, rir: 1),
                             WSet(kind: .working, kg: 12, reps: 14, rir: 1),
                             WSet(kind: .working, kg: 12, reps: 14, rir: 1),
                             WSet(kind: .working, kg: 12, reps: 14, rir: 1)]),
            WExercise(name: "Tricep Pushdown", photo: "gyak-tricep-pushdown.jpg", zone: "Tricepsz",
                      why: "Tartjuk: az utolsó sorozat múlt héten megküzdött, RIR 0 lett 2 helyett.",
                      last: "Múlt kedden 32 kg × 11 · RIR 0", note: nil,
                      sets: [WSet(kind: .working, kg: 32, reps: 12, rir: 2),
                             WSet(kind: .working, kg: 32, reps: 12, rir: 2),
                             WSet(kind: .working, kg: 32, reps: 12, rir: 2)]),
        ]
    }

    /// The briefing: what the engine changed since the last Push day, in Boop's voice.
    static let briefing = [
        ("A váll többet kap", "A heti mennyiség 14-ről 16 sorozatra lépett — a múlt hét produktív volt, nem volt megküzdés."),
        ("A fekvenyomás nehezebb", "70 kg jön 67,5 helyett. A sáv tetején voltál RIR 2-vel, ez a jutalma."),
        ("A tricepsz marad", "Az utolsó sorozat múlt héten elfogyott. Ugyanannyi súly, és most legyen meg a 12."),
    ]

    static let weekDone = [true, true, false, false, false]
    static let weekDays = ["Upper", "Lower", "Push", "Pull", "Legs"]

    /// Per-muscle weekly set volume: current vs the landmarks the engine ramps between.
    static let volume: [(String, Int, Int, Int, Int)] = [
        ("Mell", 14, 10, 18, 22), ("Hát", 18, 12, 20, 25), ("Váll", 16, 10, 18, 22),
        ("Bicepsz", 12, 8, 14, 18), ("Tricepsz", 11, 8, 14, 18), ("Láb", 14, 12, 20, 24),
    ]

    static let history: [(String, String, String, String?, Int)] = [
        ("11. 12.", "Lower", "6 gyakorlat · 19 sorozat · 1 ó 12 p", "edz-sulyzo.jpg", 2),
        // No photo on this one on purpose: the row must be right with the glyph alone (Képek §3.3 rule 6).
        ("11. 10.", "Upper", "5 gyakorlat · 17 sorozat · 1 ó 04 p", nil, 1),
        ("11. 06.", "Push", "5 gyakorlat · 16 sorozat · 58 p", "edz-oltozo.jpg", 0),
        ("11. 04.", "Pull", "6 gyakorlat · 18 sorozat · 1 ó 08 p", nil, 1),
        ("11. 02.", "Röplabda", "2 szett · 1 ó 30 p · nehézség 7", "edz-ropi-terem-sq.jpg", 0),
    ]

    static let records: [(String, String, String)] = [
        ("Barbell Bench Press", "becsült 1 ismétlés maximum", "88,4 kg"),
        ("Overhead Press", "becsült 1 ismétlés maximum", "54,1 kg"),
        ("Barbell Row", "legnagyobb munkasúly", "85,0 kg"),
        ("Pull-up", "legtöbb ismétlés", "13"),
    ]

    static let catalog: [(String, String?, String)] = [
        ("Barbell Bench Press", "gyak-barbell-bench-press.jpg", "Mell · Tricepsz"),
        ("Incline Dumbbell Press", "gyak-incline-db-press.jpg", "Mell felső"),
        ("Overhead Press", "gyak-overhead-press.jpg", "Váll"),
        ("Cable Lateral Raise", "gyak-lateral-raise.jpg", "Váll közép"),
        ("Tricep Pushdown", "gyak-tricep-pushdown.jpg", "Tricepsz"),
        ("Chest-Supported T-Bar Row", nil, "Hát közép"),
        ("Seated Cable Row · Neutral", nil, "Hát közép"),
        ("Barbell Shrug", nil, "Csuklyás"),
        ("Zottman Curl", nil, "Bicepsz · Alkar"),
        ("Spider Curl", nil, "Bicepsz"),
        ("Skullcrusher", nil, "Tricepsz"),
        ("45° Back Extension", nil, "Derék · Farizom"),
        ("Glute Bridge", nil, "Farizom"),
        ("Ab-Wheel Rollout", nil, "Törzs"),
        ("Dead Bug", nil, "Törzs"),
        ("Landmine Press", nil, "Váll · Mell"),
    ]
}

// MARK: - Root

struct EdzesRoot: View {
    @State private var tab = ["Ma", "Terv", "Gyakorlatok", "Előzmények"][WArg.int("edzesTab", 0, 3)]
    // "player" opens the full-screen cover; everything else opens a sheet. Never both at once — two
    // presentations racing on one page is the §9 trap, and here it simply showed nothing.
    // Both start closed and are opened from .task: a presentation whose binding is ALREADY true on the
    // first render does not fire (the same trap boop-ios.md §9 describes). The shipped room will need
    // the same deferral when it is opened from a notification or a deep link.
    @State private var sheet: String?
    @State private var player = false
    @State private var toast: String?
    /// The offline state is a first-class state here, not an afterthought: the gym has no signal.
    @State private var offline = WArg.on("edzesOffline")

    var body: some View {
        // `-edzesOpen player` renders the player AS the root. Presenting it over the room from a launch
        // argument is unreliable in the simulator (the cover does not fire when its binding is already
        // true, and deferring it to .task did not help either) — and for screenshots the root is honest:
        // in the app the player is reached by tapping "Kezdjük el", which works.
        if WArg.str("edzesOpen") == "player" {
            WPlayer(offline: offline, onToast: show)
        } else {
            room
        }
    }

    private var room: some View {
        ZStack(alignment: .bottom) {
            EdzesRoom(tab: $tab, offline: $offline,
                      onOpen: { if $0 == "player" { player = true } else { sheet = $0 } },
                      onToast: show)
            if let t = toast {
                Text(t).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white)
                    .padding(.horizontal, 18).padding(.vertical, 12)
                    .background(Capsule().fill(.white.opacity(0.14))).glassEffect(.regular, in: .capsule)
                    .padding(.bottom, 36).transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        // Page-level presentations only (boop-ios.md §9): a player is a full-screen cover, never a push.
        .fullScreenCover(isPresented: $player) {
            WPlayer(offline: offline, onToast: show)
        }
        .sheet(item: Binding(get: { sheet.map { WSheetID(id: $0) } }, set: { sheet = $0?.id })) { s in
            WSheetHost(kind: s.id, onToast: show, onOpen: { sheet = $0 })
        }
        .task {
            guard let open = WArg.str("edzesOpen") else { return }
            try? await Task.sleep(for: .milliseconds(350))
            if open == "player" { player = true } else { sheet = open }
        }
        .preferredColorScheme(.dark)
    }

    private func show(_ t: String) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { toast = t }
        Task { try? await Task.sleep(for: .seconds(2.4)); withAnimation { toast = nil } }
    }
}

struct WSheetID: Identifiable { let id: String }

struct WSheetHost: View {
    let kind: String
    let onToast: (String) -> Void
    let onOpen: (String?) -> Void
    var body: some View {
        switch kind {
        case "csere": WSwapSheet(onToast: onToast)
        case "kihagyas": WSkipSheet(onToast: onToast)
        case "kimelo": WKimeloSheet(onToast: onToast)
        case "varazslo": WMesoWizard(onToast: onToast)
        case "gyakorlat": WExerciseSheet(onToast: onToast)
        case "jelentes": WMesoReport(onToast: onToast)
        case "osszehasonlit": WCompareSheet()
        case "terkep": WMuscleMapSheet()
        case "sport": WSportSheet(onToast: onToast)
        default: WExerciseSheet(onToast: onToast)
        }
    }
}

// MARK: - The room frame (NKDrillPage with inner capsule tabs, in spike form)

struct EdzesRoom: View {
    @Binding var tab: String
    @Binding var offline: Bool
    let onOpen: (String) -> Void
    let onToast: (String) -> Void
    private let tabs = ["Ma", "Terv", "Gyakorlatok", "Előzmények"]

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .top) {
                    WPhotoHead()
                    VStack(spacing: 0) {
                        HStack(spacing: 10) {
                            Button { onToast("Vissza a Ma oldalra") } label: {
                                Image(systemName: "chevron.left").font(.system(size: 17, weight: .semibold))
                                    .foregroundStyle(.white).frame(width: 44, height: 44)
                            }
                            .buttonStyle(.plain).glassEffect(.clear.interactive(), in: .circle)
                            Text("Ma · Edzés").font(.system(size: 15, weight: .medium)).foregroundStyle(.white.opacity(0.85))
                            Spacer()
                            // The spike's own switch, so the owner can see the no-signal state on every tab.
                            Button { withAnimation { offline.toggle() } } label: {
                                Text(offline ? "Nincs net" : "Van net")
                                    .font(.system(size: 12, weight: .medium)).foregroundStyle(.white.opacity(0.8))
                                    .padding(.horizontal, 11).padding(.vertical, 6)
                                    .background(Capsule().fill(.white.opacity(0.12)))
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 16).padding(.top, 58)
                        VStack(spacing: 8) {
                            StillOrb(colors: WHue.orb, size: 64, level: 0.68)
                                .shadow(color: WHue.glow.opacity(0.6), radius: 20)
                                // Képek §3.3 rule 5: no photo detail behind the orb.
                                .background(
                                    RadialGradient(colors: [gBase.opacity(0.85), gBase.opacity(0)],
                                                   center: .center, startRadius: 10, endRadius: 86)
                                        .frame(width: 180, height: 180).blur(radius: 12)
                                )
                            GLabel("EDZÉS · MA").padding(.top, 6)
                            Text("Ma Push nap van, 18:00-kor")
                                .font(AuraFont.serif(34)).foregroundStyle(.white).multilineTextAlignment(.center)
                            Text("Öt gyakorlat, tizenhat sorozat, körülbelül egy óra. A váll ezen a héten egy sorozattal többet kap.")
                                .font(.system(size: 15.5)).lineSpacing(3).multilineTextAlignment(.center)
                                .foregroundStyle(.white.opacity(0.85)).padding(.horizontal, 26)
                            WTabStrip(tabs: tabs, selected: $tab).padding(.top, 20)
                        }
                        .padding(.top, 28)
                    }
                }
                Group {
                    switch tab {
                    case "Terv": EdzesTerv(onOpen: onOpen, onToast: onToast)
                    case "Gyakorlatok": EdzesGyakorlatok(onOpen: onOpen, onToast: onToast)
                    case "Előzmények": EdzesElozmenyek(onOpen: onOpen, onToast: onToast)
                    default: EdzesMa(offline: offline, onOpen: onOpen, onToast: onToast)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 44)
                .background(FloatingLights(hue: WHue.glow).padding(.vertical, -100))
                MirroredLand(sky: WHue.sky).padding(.top, -20)
            }
        }
        .scrollIndicators(.hidden)
        .ignoresSafeArea(edges: .top)
        .background(gPageBackground(WHue.top).ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
    }
}

struct WTabStrip: View {
    let tabs: [String]
    @Binding var selected: String
    var body: some View {
        HStack(spacing: 6) {
            ForEach(tabs, id: \.self) { t in
                let on = t == selected
                Button { withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { selected = t } } label: {
                    Text(t).font(.system(size: 14, weight: on ? .semibold : .regular))
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .foregroundStyle(on ? gBase : .white.opacity(0.85))
                        .padding(.horizontal, 13).padding(.vertical, 9)
                        .background(Capsule().fill(on ? .white.opacity(0.95) : .white.opacity(0.1)))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 8)
    }
}

/// A numbered white-label section, as in the shipped room skeleton.
struct WSection<C: View>: View {
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

/// How old the plan on screen is. On a prescription this is loud on purpose: training against a two-day-old
/// target is a real decision, not a cosmetic degradation (agreed with B4, issue mezo-vxjj9).
struct WStaleChip: View {
    var text: String
    var loud = false
    var body: some View {
        HStack(spacing: 6) {
            AuraGlyph("clock-ink", loud ? Color(hex: 0xF4C860) : .white.opacity(0.55), size: 12)
            Text(text).font(.system(size: 12, weight: loud ? .semibold : .medium))
                .foregroundStyle(loud ? Color(hex: 0xF4C860) : .white.opacity(0.6))
        }
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(Capsule().fill(loud ? Color(hex: 0xF4C860).opacity(0.14) : .white.opacity(0.08)))
    }
}

/// One row of the "what the engine changed" briefing.
struct WBriefRow: View {
    let title: String, text: String
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack { Circle().fill(.white.opacity(0.08)); AuraGlyph("bolt-sun", .white, size: 16) }
                .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                Text(text).font(.system(size: 13.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.7))
            }
            Spacer(minLength: 0)
        }
    }
}

/// A muscle's weekly set count against the landmarks the engine ramps between (MEV → MAV → MRV).
struct WVolumeBar: View {
    let name: String, current: Int, mev: Int, mav: Int, mrv: Int
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(name).font(.system(size: 14, weight: .medium)).foregroundStyle(.white.opacity(0.9))
                Spacer()
                Text("\(current) sorozat").font(.custom("Outfit", size: 14).weight(.medium))
                    .foregroundStyle(.white)
                Text("/ \(mrv)").font(.system(size: 12)).foregroundStyle(.white.opacity(0.45))
            }
            GeometryReader { g in
                let w = g.size.width
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.1))
                    Capsule().fill(LinearGradient(colors: [WHue.glow.opacity(0.8), WHue.sky[2].opacity(0.9)],
                                                  startPoint: .leading, endPoint: .trailing))
                        .frame(width: w * min(1, Double(current) / Double(mrv)))
                    // the two landmarks, as thin ticks
                    ForEach([mev, mav], id: \.self) { m in
                        Rectangle().fill(.white.opacity(0.5)).frame(width: 1.5, height: 12)
                            .offset(x: w * min(1, Double(m) / Double(mrv)) - 0.75)
                    }
                }
            }
            .frame(height: 12)
        }
    }
}
