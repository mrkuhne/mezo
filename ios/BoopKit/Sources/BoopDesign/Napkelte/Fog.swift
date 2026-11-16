import SwiftUI

/// Fog drifting across the painted ridges (the home screen, owner 2026-11-13): three soft bands of haze in the
/// sky's own horizon colour, each sliding at its own pace, one of them against the others.
///
/// Each band is a static, pre-blurred strip twice the screen wide holding the same shapes twice, so sliding it by
/// exactly one screen width and starting over is seamless. Only a transform is animated — the blur is rasterised
/// once, not per frame.
///
/// Reduced motion keeps the haze and drops the drift.
public struct DriftingFog: View {
    let sky: NKSky
    /// Where the fog sits in its frame (share of the height) and how tall it is.
    let band: (center: Double, height: Double)
    public init(hue: Hue, center: Double = 0.68, height: Double = 0.34) {
        self.init(sky: .hue(hue), center: center, height: height)
    }
    public init(sky: NKSky, center: Double = 0.68, height: Double = 0.34) {
        self.sky = sky; self.band = (center, height)
    }

    public var body: some View {
        GeometryReader { g in
            let w = g.size.width, h = g.size.height
            ZStack {
                layer(w: w, h: h, y: band.center - band.height * 0.30, thickness: band.height * 0.42,
                      seed: 0, opacity: 0.10, blur: 22, seconds: 96, reversed: false)
                layer(w: w, h: h, y: band.center, thickness: band.height * 0.52,
                      seed: 1, opacity: 0.13, blur: 28, seconds: 150, reversed: true)
                layer(w: w, h: h, y: band.center + band.height * 0.30, thickness: band.height * 0.60,
                      seed: 2, opacity: 0.08, blur: 34, seconds: 220, reversed: false)
            }
            .frame(width: w, height: h)
            .mask(LinearGradient(stops: [.init(color: .clear, location: max(0, band.center - band.height * 0.85)),
                                         .init(color: .black, location: band.center),
                                         .init(color: .clear, location: min(1, band.center + band.height * 0.95))],
                                 startPoint: .top, endPoint: .bottom))
            .blendMode(.plusLighter)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func layer(w: CGFloat, h: CGFloat, y: Double, thickness: Double, seed: Int,
                       opacity: Double, blur: CGFloat, seconds: Double, reversed: Bool) -> some View {
        FogLayer(color: sky.colors[2], w: w, h: h, y: y, thickness: thickness, seed: seed,
                 opacity: opacity, blur: blur, seconds: seconds, reversed: reversed)
    }
}

/// One band: the strip, and the endless slide that carries it.
private struct FogLayer: View {
    let color: Color
    let w: CGFloat, h: CGFloat
    let y: Double, thickness: Double
    let seed: Int
    let opacity: Double
    let blur: CGFloat
    let seconds: Double
    let reversed: Bool
    @State private var shift: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let strip = max(1, h * thickness)
        // The strip is two screens wide and holds the same haze twice: sliding it one width left and starting over
        // is seamless. A band that drifts the other way is the same strip mirrored.
        return FogStrip(color: color, seed: seed, opacity: opacity)
            .frame(width: w * 2, height: strip)
            .blur(radius: blur)
            .scaleEffect(x: reversed ? -1 : 1, anchor: .center)
            .offset(x: shift, y: h * y - strip / 2)
            .frame(width: w, height: h, alignment: .topLeading)
            .clipped()
            .onAppear {
                guard !reduceMotion, w > 0 else { return }
                shift = 0
                withAnimation(.linear(duration: seconds).repeatForever(autoreverses: false)) { shift = -w }
            }
    }
}

/// Two identical halves of soft haze, each one screen wide: shifting by one width loops without a seam.
private struct FogStrip: View {
    let color: Color
    let seed: Int
    let opacity: Double

    var body: some View {
        Canvas { ctx, s in
            let half = s.width / 2, h = s.height
            // x (share of a half), y, width, height, strength — one recipe per band, so a band always looks the same
            let puffs: [(Double, Double, Double, Double, Double)] = [
                [(0.06, 0.52, 0.52, 0.72, 0.95), (0.38, 0.40, 0.40, 0.56, 0.70), (0.62, 0.62, 0.58, 0.84, 1.0), (0.86, 0.44, 0.34, 0.52, 0.60)],
                [(0.14, 0.58, 0.62, 0.86, 1.0), (0.46, 0.38, 0.34, 0.48, 0.62), (0.72, 0.56, 0.50, 0.74, 0.85), (0.94, 0.48, 0.44, 0.62, 0.70)],
                [(0.02, 0.46, 0.44, 0.64, 0.75), (0.30, 0.60, 0.64, 0.92, 1.0), (0.58, 0.42, 0.38, 0.54, 0.65), (0.80, 0.58, 0.56, 0.80, 0.90)],
            ][seed % 3]
            for repeatIndex in 0..<2 {
                let x0 = half * Double(repeatIndex)
                for p in puffs {
                    let rect = CGRect(x: x0 + half * (p.0 - p.2 / 2), y: h * (p.1 - p.3 / 2),
                                      width: half * p.2, height: h * p.3)
                    ctx.fill(Path(ellipseIn: rect), with: .color(color.opacity(opacity * p.4)))
                }
            }
        }
        .accessibilityHidden(true)
    }
}
