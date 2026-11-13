import SwiftUI
import BoopCore
import BoopDesign

/// What the hero pill shows. `speaks` = the Forma check-in is done: the pill is *Boop elmondja* and the voice circle hides.
struct MaiPill: Equatable { let glyph: String?, title: String, speaks: Bool }

func lensPill(_ action: LensAction?) -> MaiPill {
    guard let action else { return MaiPill(glyph: nil, title: MaiText.speak, speaks: true) }
    return MaiPill(glyph: action.glyph, title: action.title, speaks: false)
}

/// Fuel's quick actions under the pills. Each one does its thing (B4): the composer open, the composer with a coffee
/// already typed, or a glass of water straight onto the day.
struct FuelChip: Equatable {
    enum Action: Equatable { case compose, coffee, water(Int) }
    let title, glyph: String
    let action: Action
}
let fuelChips = [FuelChip(title: "Étel rögzítése", glyph: "bowl-cream", action: .compose),
                 FuelChip(title: "Kávé", glyph: "drop-sky", action: .coffee),
                 FuelChip(title: "Víz +250 ml", glyph: "drop-sky", action: .water(250))]

/// Mozgás pill's long-press menu.
func workoutMenu(sessionTitle: String?) -> [String] {
    [sessionTitle.map { "Mai edzés · \($0)" } ?? "Mai edzés", "Futás", "Séta"]
}

/// The toast of an action that arrives in a later slice.
func soonToast(_ what: String) -> String { "\(what) · hamarosan" }

/// The short name of a lens action for its "hamarosan" toast.
func soonName(_ kind: LensKind) -> String {
    switch kind {
    case .checkin: "Check-in"
    case .eveningCheckin: "Esti check-in"
    case .bedtime: "Emlékeztető"
    case .windDown: "Esti levezetés"
    case .workout: "Edzés"
    case .photo: "Fotózás"
    case .breath: "Légzés"
    }
}

/// Fixed words of the Mai hero.
enum MaiText {
    static let speak = "Boop elmondja"
    static let mute = "Némítás"
    static let unmute = "Hang bekapcsolása"
    static let replay = "Mondd újra"
    static let breathDone = "Kész"
    static let inhale = "Belégzés"
    static let exhale = "Kilégzés"
    static let breathLine = "Kövesd a gömböt: négy másodperc be, négy másodperc ki."
    static let breathEnded = "Egy perc légzés · kész"
    static let learning = "még tanulom"
    static let problemCaps = "MEGAKADTAM"
    static let problemTitle = "Most nem jött meg a reggeled"
    static let problemSentence = "Az adataid megvannak, csak az összefoglalóm akadt el útközben. Próbáljuk újra."
    static let retry = "Újra próbálom"
}

/// The hero action (spec §5.1a): one white pill that melts into the next metric's action, and the glass circle with
/// Boop's tiny orb (tap = speak, long press = mute / replay). Fuel adds its quick-log chips.
struct LensActionRow: View {
    let hue: Hue
    let action: LensAction?
    let breathing: Bool
    let sessionTitle: String?
    let motion: OrbMotion
    let muted: Bool
    let onPrimary: () -> Void
    let onMenu: (String) -> Void
    let onChip: (FuelChip) -> Void
    let onSpeak: () -> Void
    let onToggleMute: () -> Void
    @Namespace private var ns

    private var pill: MaiPill {
        breathing ? MaiPill(glyph: "check-ink", title: MaiText.breathDone, speaks: false) : lensPill(action)
    }

    var body: some View {
        VStack(spacing: 12) {
            GlassEffectContainer(spacing: 10) {
                HStack(spacing: 10) {
                    primary
                    if !pill.speaks {
                        // tap = speak, long press = mute / replay
                        Menu { voiceMenu } label: {
                            LivingOrb(palette: hue.orb, size: 24, level: 0.85, glow: false, motion: motion)
                                .allowsHitTesting(false)
                                .frame(width: 50, height: 50)
                                .contentShape(Circle())
                        } primaryAction: { onSpeak() }
                        .menuStyle(.button).buttonStyle(.plain)
                        .glassEffect(.clear.interactive(), in: .circle)
                        .glassEffectID("voice", in: ns)
                        .accessibilityLabel(MaiText.speak)
                    }
                }
            }
            if hue == .fuel && !breathing {
                HStack(spacing: 8) { ForEach(fuelChips, id: \.title) { chip($0) } }
                    .transition(.opacity.combined(with: .offset(y: 8)))
            }
        }
        .animation(.spring(response: 0.5, dampingFraction: 0.85), value: hue)
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: breathing)
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: pill)
    }

    private var pillLabel: some View {
        HStack(spacing: 8) {
            if pill.speaks {
                StillOrb(palette: hue.orb, size: 20, level: 0.85)
            } else if let g = pill.glyph {
                NKGlyph(g, NK.ground, size: 17)
            }
            Text(pill.title).nkFont(16, .semibold).foregroundStyle(NK.ground)
                .lineLimit(1).minimumScaleFactor(0.7)
                .contentTransition(.interpolate)
        }
        .padding(.horizontal, 22).frame(minHeight: 50)
        .contentShape(Capsule())
    }

    /// Tap = the action; long press opens a menu where the pill has one (Boop elmondja: mute / replay; Mozgás: what to start).
    @ViewBuilder private var primary: some View {
        Group {
            if pill.speaks {
                Menu { voiceMenu } label: { pillLabel } primaryAction: { onPrimary() }
                    .menuStyle(.button)
            } else if hue == .mozgas && !breathing {
                Menu {
                    ForEach(workoutMenu(sessionTitle: sessionTitle), id: \.self) { item in
                        Button(item) { onMenu(item) }
                    }
                } label: { pillLabel } primaryAction: { onPrimary() }
                    .menuStyle(.button)
            } else {
                Button(action: onPrimary) { pillLabel }
            }
        }
        .buttonStyle(.plain)
        .glassEffect(.regular.tint(.white).interactive(), in: .capsule)
        .glassEffectID("primary", in: ns)
    }

    @ViewBuilder private var voiceMenu: some View {
        // text only: menus cannot draw the kit glyphs, and SF Symbols are limited to arrows and chevrons
        Button(muted ? MaiText.unmute : MaiText.mute, action: onToggleMute)
        Button(action: onSpeak) { Label(MaiText.replay, systemImage: "arrow.counterclockwise") }
    }

    private func chip(_ c: FuelChip) -> some View {
        Button { onChip(c) } label: {
            HStack(spacing: 5) {
                NKGlyph(c.glyph, .white, size: 13)
                Text(c.title).nkFont(13, .semibold).foregroundStyle(.white).lineLimit(1)
            }
            .padding(.horizontal, 12).frame(minHeight: 36)
        }
        .buttonStyle(.plain)
        .glassEffect(.clear.interactive(), in: .capsule)
    }
}
