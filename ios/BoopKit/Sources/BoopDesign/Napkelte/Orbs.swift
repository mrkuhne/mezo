import SwiftUI
import CoreMotion
import Observation

/// The orb shader needs exactly four colours (three crash it): pad with the last colour (white when empty), drop extras.
public func orbPalette(_ c: [Color]) -> [Color] {
    let base = c.isEmpty ? [Color.white] : c
    return Array((base + Array(repeating: base.last!, count: 4)).prefix(4))
}

/// Where the hero orb's centre sits in its frame of height `height`: on the horizon, the same spot for every metric
/// and every score (owner, 2026-11-12: "mindegyik legyen ott ahol a Fuel-nak van" — Fuel at 0 sat there). The
/// score no longer moves the orb; its fill level still shows it.
public func heroOrbCenterY(height: CGFloat) -> CGFloat { height - 8 }

/// How far above the orb's centre the number and caption sit, so they stay in the half above the horizon.
public func heroLabelLift(orbSize: CGFloat) -> CGFloat { orbSize * 0.26 }

/// What VoiceOver says for an orb value: the no-data dash is "nincs adat".
public func orbSpoken(_ display: String) -> String { display == "–" ? "nincs adat" : display }

/// The hero number's size: numbers and the no-data dash are big (58); a learning label ("9 / 14") is smaller (34).
public func risingDisplaySize(score: Int?, display: String) -> CGFloat { score != nil || display == "–" ? 58 : 34 }

/// Physics and sensors behind a living orb: tilt spring (device gravity or drag), speech surge, tap ripple.
@MainActor @Observable public final class OrbMotion {
    public var tilt: Double = 0
    public var speak: Double = 0
    public var talking = false
    public var rippleX: Double = 0
    public var rippleDate = Date.distantPast
    public var dragTarget: Double?

    @ObservationIgnored private var vel: Double = 0
    @ObservationIgnored private var gravityTarget: Double = 0
    @ObservationIgnored private let manager = CMMotionManager()
    @ObservationIgnored private var timer: Timer?

    public init() {}

    public func start() {
        guard timer == nil else { return }
        if manager.isDeviceMotionAvailable {
            manager.deviceMotionUpdateInterval = 1.0 / 60
            manager.startDeviceMotionUpdates(to: .main) { [weak self] m, _ in
                guard let g = m?.gravity else { return }
                MainActor.assumeIsolated { self?.gravityTarget = max(-0.55, min(0.55, g.x * 0.8)) }
            }
        }
        let t = Timer(timeInterval: 1.0 / 60, repeats: true) { [weak self] _ in MainActor.assumeIsolated { self?.step() } }
        RunLoop.main.add(t, forMode: .common)
        timer = t
    }

    public func stop() { timer?.invalidate(); timer = nil; manager.stopDeviceMotionUpdates() }
    public func tap(atX x: Double) { rippleX = x; rippleDate = Date() }
    /// A spoken word: a small surge in the liquid.
    public func kick() { speak = min(1.4, speak + 0.45) }

    private func step() {
        let target = dragTarget ?? gravityTarget
        let acc = 34 * (target - tilt) - 2.6 * vel
        vel += acc / 60
        tilt += vel / 60
        speak += ((talking ? 0.7 : 0) - speak) * 0.07
    }
}

extension View {
    /// The shared call into `Orb.metal`.
    func orbEffect(size: CGFloat, time: Double, palette: [Color], fill: Double, tilt: Double, rippleX: Double, rippleAge: Double, speak: Double) -> some View {
        let c = orbPalette(palette)
        return colorEffect(ShaderLibrary.bundle(.module).orb(
            .float2(size, size), .float(Float(time)),
            .color(c[0]), .color(c[1]), .color(c[2]), .color(c[3]),
            .float(Float(fill)), .float(Float(tilt)), .float(Float(rippleX)), .float(Float(rippleAge)), .float(Float(speak))))
    }
}

/// The living glass orb: marbled liquid filled to `level`, idle waves, slosh on tilt, ripple on tap, surge on speech.
/// `animated == false` (or reduced motion) renders the end state, still.
public struct LivingOrb: View {
    let palette: [Color], size: CGFloat, level: Double, glow: Bool, motion: OrbMotion, animated: Bool
    @State private var start = Date()
    @State private var taps = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(palette: [Color], size: CGFloat, level: Double, glow: Bool, motion: OrbMotion, animated: Bool = true) {
        self.palette = palette; self.size = size; self.level = level; self.glow = glow; self.motion = motion; self.animated = animated
    }

    public var body: some View {
        let live = animated && !reduceMotion
        TimelineView(.animation(paused: !live)) { tl in
            let e = live ? tl.date.timeIntervalSince(start) : 7.3
            let p = live ? min(1.0, e / 1.8) : 1
            let c = orbPalette(palette)
            Rectangle()
                .frame(width: size, height: size)
                .orbEffect(size: size, time: e, palette: c, fill: level * (1 - pow(1 - p, 3)),
                           tilt: live ? motion.tilt : 0, rippleX: motion.rippleX,
                           rippleAge: live ? tl.date.timeIntervalSince(motion.rippleDate) : 9, speak: live ? motion.speak : 0)
                .scaleEffect(live ? 1 + 0.012 * sin(e * 1.9) + 0.02 * motion.speak : 1)
                .background {
                    if glow {
                        Circle()
                            .fill(RadialGradient(colors: [c[2].opacity(0.55), c[0].opacity(0.25), .clear], center: .center,
                                                 startRadius: size * 0.2, endRadius: size * 0.75))
                            .frame(width: size * 1.5, height: size * 1.5)
                            .blur(radius: size * 0.12)
                            .opacity(0.7 + (live ? 0.2 * sin(e * 1.1) + 0.25 * motion.speak : 0))
                    }
                }
        }
        .frame(width: size, height: size)
        .contentShape(Circle())
        .gesture(DragGesture(minimumDistance: 6)
            .onChanged { v in motion.dragTarget = max(-0.55, min(0.55, v.translation.width / size * 1.1)) }
            .onEnded { _ in motion.dragTarget = nil })
        .simultaneousGesture(SpatialTapGesture().onEnded { v in
            motion.tap(atX: Double(v.location.x / size) * 2 - 1)
            taps += 1
        })
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: taps)
        .onChange(of: level) { start = Date() }
        .onAppear { if live { motion.start() } }
        .accessibilityHidden(true)
    }
}

/// The same orb frozen in one frame: inactive metrics, summaries, tiles.
public struct StillOrb: View {
    let palette: [Color], size: CGFloat, level: Double
    public init(palette: [Color], size: CGFloat, level: Double) { self.palette = palette; self.size = size; self.level = level }
    public var body: some View {
        Rectangle()
            .frame(width: size, height: size)
            .orbEffect(size: size, time: 7.3, palette: palette, fill: level, tilt: 0, rippleX: 0, rippleAge: 9, speak: 0)
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// The hero: the metric's orb as the morning sun, half risen on the horizon at one fixed spot for every metric
/// (`heroOrbCenterY`); the number rides in the visible upper half. A nil score is "még tanulom": a calm,
/// half-saturated still orb at the same spot.
/// `orbScale` scales the orb alone (Pulzus breathing: 1.22 in, 0.84 out); the number and the glow stay put.
public struct RisingOrb: View {
    let hue: Hue, score: Int?, display: String, caption: String?, motion: OrbMotion, orbScale: CGFloat
    public init(hue: Hue, score: Int?, display: String, caption: String? = nil, motion: OrbMotion, orbScale: CGFloat = 1) {
        self.hue = hue; self.score = score; self.display = display; self.caption = caption; self.motion = motion
        self.orbScale = orbScale
    }

    public var body: some View {
        GeometryReader { g in
            let H = g.size.height, size: CGFloat = 156
            let cy = heroOrbCenterY(height: H)
            ZStack {
                Circle().fill(hue.glow.opacity(0.18)).frame(width: size * 1.7).blur(radius: 60)
                if score == nil {
                    StillOrb(palette: hue.orb, size: size, level: 0.5).saturation(0.6)
                } else {
                    LivingOrb(palette: hue.orb, size: size, level: Double(score ?? 0) / 100, glow: true, motion: motion)
                        .id(hue)
                        .scaleEffect(orbScale)
                }
                VStack(spacing: 2) {
                    // a display like "7ó 12p" or "3 240" must stay inside the orb
                    Text(display).font(.nkNumber(risingDisplaySize(score: score, display: display))).foregroundStyle(.white).monospacedDigit()
                        .fontWeight(display == "–" ? .medium : nil)       // the light dash alone reads as a hairline
                        .lineLimit(1).minimumScaleFactor(0.4).frame(maxWidth: size - 20)
                        .contentTransition(.numericText())
                    if let caption { Text(caption).nkFont(12).foregroundStyle(.white.opacity(0.75)) }
                }
                .shadow(color: .black.opacity(0.35), radius: 10)
                .offset(y: -heroLabelLift(orbSize: size))
                .allowsHitTesting(false)
            }
            .frame(width: g.size.width, height: size * 2)
            .position(x: g.size.width / 2, y: cy)
            .mask(alignment: .top) {
                LinearGradient(stops: [.init(color: .black, location: 0), .init(color: .black, location: 0.93), .init(color: .clear, location: 1)],
                               startPoint: .top, endPoint: .bottom)
                    .frame(height: H + 6)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(hue.name): \(orbSpoken(display))")
    }
}

/// Five mini orbs in five equal columns. Only the selected one is alive and in full colour; the rest are still and
/// muted (~25 % saturation). No rings. Tap selects (the orbs themselves don't take the tap).
public struct MiniOrbRow: View {
    let items: [(Hue, String)]
    @Binding var selected: Hue
    let motion: OrbMotion
    public init(items: [(Hue, String)], selected: Binding<Hue>, motion: OrbMotion) {
        self.items = items; self._selected = selected; self.motion = motion
    }

    public var body: some View {
        HStack(spacing: 0) {
            ForEach(items, id: \.0) { item in
                let on = item.0 == selected
                VStack(spacing: 7) {
                    ZStack {
                        if on {
                            LivingOrb(palette: item.0.orb, size: 46, level: miniLevel(item.1), glow: false, motion: motion)
                        } else {
                            StillOrb(palette: item.0.orb, size: 46, level: miniLevel(item.1)).saturation(0.25).opacity(0.75)
                        }
                        Text(item.1).font(.custom(Lagy.outfitFamily, size: 17).weight(.medium)).foregroundStyle(.white)
                            .shadow(color: .black.opacity(0.45), radius: 4)
                            .minimumScaleFactor(0.6).lineLimit(1).frame(width: 42)
                    }
                    .allowsHitTesting(false)
                    Text(item.0.name).nkFont(13, on ? .semibold : .regular)
                        .foregroundStyle(.white.opacity(on ? 1 : 0.6)).lineLimit(1).minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
                .onTapGesture { withAnimation(.spring(response: 0.7, dampingFraction: 0.82)) { selected = item.0 } }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(item.0.name) \(orbSpoken(item.1))")
                .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
            }
        }
        .sensoryFeedback(.selection, trigger: selected)
        .padding(.horizontal, 12)
    }

    private func miniLevel(_ display: String) -> Double {
        guard let v = Double(display) else { return 0.5 }
        return min(1, max(0.05, v / 100))
    }
}
