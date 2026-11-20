#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY spike (mezo-r36n9.113): the new-block flow (S2), the per-muscle „miért?" (S1), the year plan (S3) and the
// „Következik" card (S4) on fixtures, for the owner's look OK before anything real is built. No network, no BoopCore
// change. Launch with `-previewEvesTerv YES`; `-evesTervScreen 1…7` (or `6b`) opens one screen directly and
// `-evesTervScroll Y` opens a long screen scrolled down by Y points (for the screenshots).

enum ETScreen: String, CaseIterable, Identifiable {
    case ures = "1", alapok = "2", keret = "2b", jeloltek = "3", nemFer = "3b", miert = "4", izmok = "4b", letrehozas = "5", terkep = "6", blokk = "6b", kovetkezik = "7"
    var id: String { rawValue }

    var title: String {
        switch self {
        case .ures: "Nincs futó blokk"
        case .alapok: "Új blokk · Alapok"
        case .keret: "Alapok · a keret tele"
        case .jeloltek: "Új blokk · Jelöltek"
        case .nemFer: "Jelöltek · semmi sem fér bele"
        case .miert: "Izom „miért?”"
        case .izmok: "A blokk izmai · heti keret"
        case .letrehozas: "Éves terv létrehozása"
        case .terkep: "Éves térkép"
        case .blokk: "Éves térkép · egy blokk"
        case .kovetkezik: "Következik kártya"
        }
    }
}

/// Where the flow is, and what the intake holds.
@MainActor @Observable final class ETFlow {
    var screen: ETScreen?
    var intake = ETIntake.fresh
    var chosen = 0
    var sheetMuscle: String?
    var sheetBlock: Int?
    /// The raise he just tried that the budget or the Hangsúly cap does not allow.
    var blocked: ETBlocked?
    /// Screen 3b: no candidate passes every rule.
    var nothingFits = false

    init(screen: ETScreen?) {
        self.screen = screen
        switch screen {
        case .miert: sheetMuscle = "back"
        case .izmok: self.screen = .miert
        case .nemFer:
            self.screen = .jeloltek
            nothingFits = true
            intake.minutes = 45
            intake.tiers["chest"] = .emphasize
        case .keret:
            self.screen = .alapok
            intake = .full
            blocked = ETBlocked(muscle: "calf", text: intake.blockReason("calf", to: .grow) ?? "")
        case .blokk: self.screen = .terkep; sheetBlock = 5
        default: break
        }
    }

    func go(_ s: ETScreen?) { screen = s }

    /// „Indítás" on the Következik card: the intake pre-filled from the year map.
    func startFromMap() {
        intake = .fromMap
        blocked = nil
        screen = .alapok
    }
}

struct EvesTervDemoRoot: View {
    @State private var flow: ETFlow
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init() {
        let s = UserDefaults.standard.string(forKey: "evesTervScreen").flatMap(ETScreen.init(rawValue:))
        _flow = State(initialValue: ETFlow(screen: s))
    }

    var body: some View {
        Group {
            switch flow.screen {
            case nil: index
            case .ures: ETEmptyState(flow: flow)
            case .alapok, .keret: ETAlapokPage(flow: flow)
            case .jeloltek, .nemFer: ETJeloltekPage(flow: flow)
            case .miert, .izmok: ETMusclesPage(flow: flow)
            case .letrehozas: ETCreateYearPage(flow: flow)
            case .terkep, .blokk: ETYearMapPage(flow: flow)
            case .kovetkezik: ETKovetkezikRoom(flow: flow)
            }
        }
        .animation(reduceMotion ? nil : .smooth(duration: 0.3), value: flow.screen)
        .preferredColorScheme(.dark)
    }

    private var index: some View {
        ZStack {
            PlanSky(height: 300)
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text("ÉVES TERV · SPIKE").nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(.white.opacity(0.7))
                    Text("Képernyők").nkFont(30, design: .serif).foregroundStyle(.white).padding(.bottom, 8)
                    ForEach(ETScreen.allCases) { s in
                        Button { flow = ETFlow(screen: s) } label: {
                            HStack(spacing: 12) {
                                Text(s.rawValue).nkFont(12, .semibold, design: .monospaced).foregroundStyle(planHue.glow).frame(width: 26, alignment: .leading)
                                Text(s.title).nkFont(16).foregroundStyle(.white)
                                Spacer(minLength: 6)
                                Image(systemName: "chevron.right").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.4))
                            }
                            .padding(.horizontal, 16).frame(minHeight: 52)
                            .nkGlass(18)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20).padding(.top, 24).padding(.bottom, 40)
            }
        }
    }
}

// MARK: - Shared spike pieces

/// The head of a full-screen step: a round button, the scope line, the serif title, an optional sentence.
struct ETHead: View {
    let eyebrow: String
    let title: String
    var sentence: String? = nil
    var back = false
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Button(action: onClose) {
                    Image(systemName: back ? "chevron.left" : "chevron.down").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                        .frame(width: 40, height: 40).background(Circle().fill(.white.opacity(0.14)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(back ? "Vissza" : "Bezárás")
                Text(eyebrow).nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(.white.opacity(0.75))
                    .lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 0)
            }
            Text(title).nkFont(30, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            if let sentence {
                Text(sentence).nkFont(15).foregroundStyle(.white.opacity(0.72)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A section label: the area's tick and mono caps.
struct ETLabel: View {
    let text: String
    var trailing: String? = nil
    init(_ text: String, trailing: String? = nil) { self.text = text; self.trailing = trailing }
    var body: some View {
        HStack(spacing: 8) {
            Capsule().fill(planHue.glow).frame(width: 3, height: 13)
            Text(text.uppercased()).nkFont(11, .medium, design: .monospaced).tracking(1.4).foregroundStyle(.white.opacity(0.6))
                .lineLimit(1).minimumScaleFactor(0.8)
            Spacer(minLength: 6)
            if let trailing { Text(trailing).nkFont(12).foregroundStyle(.white.opacity(0.5)) }
        }
    }
}

/// The one primary button at the bottom of a step, over a fade into the ground.
struct ETBottomBar: View {
    let title: String
    var enabled = true
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title).nkFont(16, .semibold).foregroundStyle(NK.ground).lineLimit(1).minimumScaleFactor(0.75)
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(Capsule().fill(planHue.glow.opacity(enabled ? 1 : 0.45)))
                .contentShape(Capsule())
        }
        .buttonStyle(PressStyle())
        .disabled(!enabled)
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 4)
        .background(LinearGradient(colors: [NK.ground.opacity(0), NK.ground.opacity(0.95)], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
    }
}

/// A choice pill (weeks, minutes): white when chosen.
struct ETChoice: View {
    let text: String
    let on: Bool
    var sub: String? = nil
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(spacing: 1) {
                Text(text).nkFont(17, .medium).foregroundStyle(on ? NK.ground : .white)
                if let sub { Text(sub).nkFont(10, design: .monospaced).foregroundStyle(on ? NK.ground.opacity(0.7) : .white.opacity(0.5)) }
            }
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(on ? Color.white : .white.opacity(0.09)))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// A muscle chip (year emphasis, block focus): lit when on.
struct ETChip: View {
    let text: String
    let on: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if on { PlanMark(.check, color: NK.ground, size: 11) }
                Text(text).nkFont(14, .medium).foregroundStyle(on ? NK.ground : .white.opacity(0.85)).lineLimit(1).fixedSize()
            }
            .padding(.horizontal, 14).frame(minHeight: 38)
            .background(Capsule().fill(on ? planHue.glow : .white.opacity(0.09)))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// One „why" line: a drawn mark in the tone's colour and the sentence.
struct ETWhyLine: View {
    let line: ETWhy
    var body: some View {
        HStack(alignment: .top, spacing: 9) {
            PlanMark(line.tone.mark, color: line.tone.color, size: 14).padding(.top, 2)
            Text(line.text).nkFont(13.5).foregroundStyle(line.tone == .warn ? planWarn : .white.opacity(line.tone == .good ? 0.88 : 0.68))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Opens a long screen scrolled (`-evesTervScroll Y`), for the screenshots.
struct ETInitialScroll: ViewModifier {
    @Binding var position: ScrollPosition
    func body(content: Content) -> some View {
        content.task {
            let y = UserDefaults.standard.double(forKey: "evesTervScroll")
            guard y > 0 else { return }
            try? await Task.sleep(for: .milliseconds(350))
            position.scrollTo(y: y)
        }
    }
}
#endif
