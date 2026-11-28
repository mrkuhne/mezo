import SwiftUI
import BoopDesign

// MARK: - Cards that move nothing (Edzés redesign step 5, mezo-r36n9.197.5, spec 2026-11-27 §5.5)

// The workout screens get the redesign's visual rank — one card per logical unit — under one hard rule from the
// owner: **no control moves** (decision #129, plan Task 5). Every button, scale, stepper and sheet entry keeps its
// size and its place on the screen. So these cards are drawn *behind* a group and reach a few points past its frame
// into the gaps that were already there: the layout does not know they exist, and the frame dump
// (`-previewFrameDump`) proves it before and after.

/// How loud a card is: a normal section, the quieter „what comes next" one, or the result hero.
enum WorkoutCardTone { case card, quiet, hero }

extension View {
    /// A card behind this group, `h` / `v` points past its frame — never a layout change.
    /// Anything inside that had its own glass switches to `nkInnerCard` (no glass on glass).
    func workoutCard(_ tone: WorkoutCardTone = .card, h: CGFloat = 10, v: CGFloat = 8, hue: Hue? = nil) -> some View {
        background {
            WorkoutCardShape(tone: tone, hue: hue)
                .padding(.horizontal, -h).padding(.vertical, -v)
                .accessibilityHidden(true)
        }
    }
}

private struct WorkoutCardShape: View {
    let tone: WorkoutCardTone
    let hue: Hue?

    var body: some View {
        let radius: CGFloat = tone == .hero ? 28 : 24
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        switch tone {
        case .card, .hero:
            // The kit's glass (`nkGlass`), with the hero's faint hue wash from the top.
            shape.fill(.white.opacity(0.07))
                .overlay {
                    if tone == .hero, let hue {
                        shape.fill(LinearGradient(colors: [hue.glow.opacity(0.14), .clear],
                                                  startPoint: .top, endPoint: .center))
                    }
                }
                .overlay(shape.stroke(LinearGradient(colors: [.white.opacity(0.16), .white.opacity(0.03)],
                                                     startPoint: .top, endPoint: .bottom), lineWidth: 1))
        case .quiet:
            shape.fill(.white.opacity(0.035)).overlay(shape.stroke(.white.opacity(0.07)))
        }
    }
}

// MARK: - The frame dump (DEBUG review only)

// `-previewFrameDump <name>`: every probed control writes its window frame to `Documents/frames-<name>.json` in
// the app container, so a before and an after run can be diffed point by point (plan Task 5 gate: „control-frame
// diff empty"). Release builds compile the probe away.

#if DEBUG
@MainActor
enum FrameProbe {
    static let name = UserDefaults.standard.string(forKey: "previewFrameDump")
    private static var frames: [String: [Double]] = [:]

    static func record(_ id: String, _ r: CGRect) {
        guard let name else { return }
        frames[id] = [r.minX, r.minY, r.width, r.height].map { (Double($0) * 2).rounded() / 2 }
        guard let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
              let data = try? JSONSerialization.data(withJSONObject: frames, options: [.sortedKeys, .prettyPrinted])
        else { return }
        try? data.write(to: dir.appendingPathComponent("frames-\(name).json"))
    }
}
#endif

extension View {
    /// Marks a control for the frame dump; nothing at all outside a `-previewFrameDump` DEBUG run.
    @ViewBuilder func frameProbe(_ id: String) -> some View {
        #if DEBUG
        if FrameProbe.name != nil {
            onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { FrameProbe.record(id, $0) }
        } else {
            self
        }
        #else
        self
        #endif
    }
}
