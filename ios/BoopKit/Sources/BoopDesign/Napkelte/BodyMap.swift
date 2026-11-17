import Foundation
import SwiftUI

// MARK: - Which shapes carry which muscle

/// Which drawable shapes carry each muscle, and on which side of the body.
///
/// **The same table the web app uses** (`frontend/src/features/train/logic/bodyMapShapes.ts`),
/// so the two draw the same body from the same upstream artwork. The artwork is coarser than
/// the planner on purpose: the three biceps heads share one shape, and the mid back rides on
/// the upper back because there is no rhomboid shape upstream. **Anything unmapped is dropped,
/// never guessed** — a muscle we cannot place honestly is better left dark.
public enum NKBodyMapShapes {
    public static let tokenShapes: [String: [(NKBodyView, String)]] = [
        "chest-upper": [(.front, "upper-chest")],
        "chest-mid": [(.front, "chest")],
        "chest-lower": [(.front, "lower-chest")],
        "back-wide": [(.back, "upper-back")],
        "back-mid": [(.back, "upper-back")],
        "back-lower": [(.back, "lower-back")],
        "traps": [(.back, "trapezius")],
        "shoulder-front": [(.front, "front-deltoid")],
        "shoulder-side": [(.front, "deltoids")],
        "shoulder-rear": [(.back, "deltoids")],
        "biceps-long": [(.front, "biceps")],
        "biceps-short": [(.front, "biceps")],
        "biceps-brachialis": [(.front, "biceps")],
        "triceps-long": [(.back, "triceps")],
        "triceps-lateral": [(.back, "triceps")],
        "triceps-medial": [(.back, "triceps")],
        "quad": [(.front, "quadriceps"), (.front, "inner-quad"), (.front, "outer-quad")],
        "ham": [(.back, "hamstring")],
        "glute": [(.back, "gluteal")],
        "calf": [(.back, "calves")],
        "core": [(.front, "abs"), (.front, "upper-abs"), (.front, "lower-abs"), (.front, "obliques")],
    ]

    /// The coarse keys the training API still sends (a plan's `muscle`, the volume arc's
    /// groups), mapped to the nearest real token so an old row stays visible instead of
    /// vanishing off the body.
    static let legacy: [String: String] = [
        "chest": "chest-mid",
        "lats": "back-wide",
        "back": "back-wide",
        "shoulder": "shoulder-side",
        "shoulders": "shoulder-side",
        "rear-delt": "shoulder-rear",
        "biceps": "biceps-long",
        "triceps": "triceps-long",
        "arms": "biceps-long",
        "legs": "quad",
        "quads": "quad",
        "hamstring": "ham",
        "hams": "ham",
        "glutes": "glute",
        "calves": "calf",
        "abs": "core",
    ]

    /// The shapes a muscle lights up, legacy keys resolved. Empty for anything we cannot place.
    public static func shapes(for muscle: String) -> [(NKBodyView, String)] {
        let key = muscle.lowercased()
        if let direct = tokenShapes[key] { return direct }
        if let mapped = legacy[key], let shapes = tokenShapes[mapped] { return shapes }
        return []
    }

    /// Every muscle name the app may hand the map, for the test that proves each one lands.
    public static var allTokens: [String] { Array(tokenShapes.keys) + Array(legacy.keys) }
}

// MARK: - The map

/// How hot one muscle is, 0…1 — and `nil` for a muscle with nothing to say, which draws as the
/// faint resting outline rather than as a zero.
public struct NKBodyHeat: Equatable, Sendable {
    public let muscle: String
    public let level: Double
    public init(muscle: String, level: Double) { self.muscle = muscle; self.level = max(0, min(1, level)) }
}

/// The body with its worked muscles lit (`mezo-r36n9.15`). The same anatomy the web app draws,
/// from the same upstream geometry.
///
/// **One body, not two.** `.auto` shows whichever side carries more heat: two silhouettes side
/// by side read as decoration, one reads as *you*. `.both` is for the page that is about the
/// map itself.
///
/// Heat is a **scale, not a quantity**: where two muscles land on one shape, the shape takes
/// the hotter of the two rather than their sum, so nothing can be pushed past what the hottest
/// muscle alone would show.
public struct NKBodyMap: View {
    public enum Views: Sendable { case auto, front, back, both }

    let heat: [NKBodyHeat]
    let hue: Hue
    let views: Views

    public init(_ heat: [NKBodyHeat], hue: Hue, views: Views = .auto) {
        self.heat = heat; self.hue = hue; self.views = views
    }

    public var body: some View {
        HStack(spacing: 10) {
            ForEach(shown, id: \.self) { view in
                NKBodySide(view: view, opacity: opacities(view), hue: hue)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
    }

    /// `.auto` shows **one** body — two side by side read as decoration — unless the session
    /// really works both sides, which a push-pull day does. Then hiding one would hide half of
    /// what he did, and two bodies are the honest picture.
    private var shown: [NKBodyView] {
        switch views {
        case .front: return [.front]
        case .back: return [.back]
        case .both: return [.front, .back]
        case .auto:
            let frontHeat = total(.front), backHeat = total(.back)
            let weaker = min(frontHeat, backHeat), whole = frontHeat + backHeat
            if whole > 0, weaker / whole >= 0.3 { return [.front, .back] }
            return [frontHeat >= backHeat ? .front : .back]
        }
    }

    /// Opacity per shape slug: the resting outline unless a muscle lights it.
    private func opacities(_ view: NKBodyView) -> [String: Double] {
        var out: [String: Double] = [:]
        for h in heat where h.level > 0 {
            for (shapeView, slug) in NKBodyMapShapes.shapes(for: h.muscle) where shapeView == view {
                out[slug] = max(out[slug] ?? 0, 0.2 + 0.8 * h.level)
            }
        }
        return out
    }

    private func total(_ view: NKBodyView) -> Double {
        heat.reduce(0) { sum, h in
            sum + (NKBodyMapShapes.shapes(for: h.muscle).contains { $0.0 == view } ? h.level : 0)
        }
    }

    private var label: String {
        let worked = heat.filter { $0.level > 0 }.map(\.muscle)
        return worked.isEmpty ? "Izomtérkép · ma nincs terhelés" : "Izomtérkép · \(worked.count) izomcsoport terhelve"
    }
}

/// The parsed geometry, once per run. ~90 kB of path strings turned into `Path`s on every
/// frame would make the page stutter — and the owner has already rejected one stuttery pass.
enum NKBodyPaths {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var cache: [NKBodyView: [(slug: String, path: Path)]] = [:]

    static func shapes(_ view: NKBodyView) -> [(slug: String, path: Path)] {
        lock.withLock {
            if let hit = cache[view] { return hit }
            let built = NKBodyGeometry.shapes(view)
                .sorted { $0.key < $1.key }
                .map { (slug: $0.key, path: NKPath.parse($0.value)) }
            cache[view] = built
            return built
        }
    }

    /// The box the view's own body occupies, **measured** from its paths. Upstream draws the
    /// front and back bodies side by side in one canvas, so the back body does not start at the
    /// origin; a written-down box would clip it, and the clip would look like a design choice.
    static func viewBox(_ view: NKBodyView) -> CGRect {
        shapes(view).reduce(CGRect.null) { $0.union($1.path.boundingRect) }
    }
}

/// One side of the body: the faint whole-body outline, then the lit shapes over it.
private struct NKBodySide: View {
    let view: NKBodyView
    let opacity: [String: Double]
    let hue: Hue

    var body: some View {
        let box = NKBodyPaths.viewBox(view)
        Canvas { context, size in
            let scale = min(size.width / box.width, size.height / box.height)
            let dx = (size.width - box.width * scale) / 2 - box.minX * scale
            let dy = (size.height - box.height * scale) / 2 - box.minY * scale
            let transform = CGAffineTransform(translationX: dx, y: dy).scaledBy(x: scale, y: scale)

            for (slug, parsed) in NKBodyPaths.shapes(view) {
                // The body's own outline is barely there; the worked muscles are the picture.
                let lit = opacity[slug]
                let path = parsed.applying(transform)
                context.fill(path, with: .color(.white.opacity(lit == nil ? 0.08 : 0)))
                if let lit {
                    context.fill(path, with: .color(hue.glow.opacity(lit)))
                }
            }
        }
        .aspectRatio(box.width / box.height, contentMode: .fit)
    }
}
