import SwiftUI

/// Simulator review: `-previewSlow 5` runs the home screen's arrivals and transitions five times slower, so a
/// screenshot can catch them mid-flight. One everywhere else.
public var nkMotionScale: Double {
    #if DEBUG
    let v = UserDefaults.standard.double(forKey: "previewSlow")
    return v > 0 ? min(60, v) : 1
    #else
    return 1
    #endif
}

/// One orb in the home screen's ring: its colour world, its name, the number inside it, how full it is, and whether
/// the area behind it is live yet (an area still to be built sits faint and says so on tap).
public struct NKRingItem: Identifiable, Equatable {
    public let id: String
    public let name: String
    public let palette: [Color]
    public let glow: Color
    /// What stands inside the orb — a score, or "–" when there is nothing to say.
    public let display: String
    /// 0–1, how far the liquid rises.
    public let level: Double
    public let live: Bool
    public init(id: String, name: String, palette: [Color], glow: Color, display: String, level: Double, live: Bool) {
        self.id = id; self.name = name; self.palette = palette; self.glow = glow
        self.display = display; self.level = level; self.live = live
    }
    public static func == (a: NKRingItem, b: NKRingItem) -> Bool {
        a.id == b.id && a.name == b.name && a.display == b.display && a.level == b.level && a.live == b.live
    }
}

/// The home screen's ring (owner 2026-11-13): the areas as living orbs laid out on a circle, Boop's own orb in the
/// middle. They **fade in out of the fog** one after the other when the screen opens, each breathes on its own
/// phase, and a tap reports where that orb sits on the screen, so the page can zoom into it.
///
/// The first item sits at the top and the rest follow clockwise. Reduced motion renders them still and arriving all
/// at once.
public struct NKOrbRing<Center: View>: View {
    let items: [NKRingItem]
    let orbSize: CGFloat
    /// False freezes every orb on its current frame: during a transition the ring must not keep eight shaders
    /// running while it is being scaled and faded, or the zoom stutters.
    let live: Bool
    /// The tapped orb and where its centre is on the screen (global coordinates).
    let onTap: (NKRingItem, CGPoint) -> Void
    let center: Center
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(items: [NKRingItem], orbSize: CGFloat = 64, live: Bool = true,
                onTap: @escaping (NKRingItem, CGPoint) -> Void, @ViewBuilder center: () -> Center) {
        self.items = items; self.orbSize = orbSize; self.live = live; self.onTap = onTap; self.center = center()
    }

    public var body: some View {
        GeometryReader { g in
            let side = min(g.size.width, g.size.height)
            // The ring has to leave room for the orb and its name under it on both sides.
            let radius = side / 2 - orbSize / 2 - 20
            let box = g.frame(in: .global)
            ZStack {
                center
                    .frame(width: max(0, radius * 2 - orbSize - 24), height: max(0, radius * 2 - orbSize - 24))
                    .modifier(FogArrival(shown: shown, delay: 0, reduceMotion: reduceMotion))
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    let angle = -Double.pi / 2 + Double(index) / Double(max(1, items.count)) * 2 * .pi
                    let dx = radius * cos(angle), dy = radius * sin(angle)
                    orb(item, phase: Double(index), at: CGPoint(x: box.midX + dx, y: box.midY + dy))
                        .offset(x: dx, y: dy)
                        .modifier(FogArrival(shown: shown, delay: 0.22 + 0.09 * Double(index), reduceMotion: reduceMotion))
                }
            }
            .frame(width: g.size.width, height: g.size.height)
        }
        .onAppear { shown = true }
    }

    private func orb(_ item: NKRingItem, phase: Double, at point: CGPoint) -> some View {
        VStack(spacing: 6) {
            ZStack {
                Circle().fill(item.glow.opacity(item.live ? 0.35 : 0.14))
                    .frame(width: orbSize * 1.5, height: orbSize * 1.5).blur(radius: orbSize * 0.3)
                BreathingOrb(palette: item.palette, size: orbSize, level: item.level, phase: phase,
                             animated: item.live && live && !reduceMotion)
                    .saturation(item.live ? 1 : 0.3)
                    .opacity(item.live ? 1 : 0.5)
                Text(item.display)
                    .font(.custom(Lagy.outfitFamily, size: orbSize * 0.36).weight(.medium))
                    .foregroundStyle(.white.opacity(item.live ? 1 : 0.6))
                    .shadow(color: .black.opacity(0.45), radius: 4)
                    .monospacedDigit()
                    .minimumScaleFactor(0.5).lineLimit(1).frame(width: orbSize * 0.78)
            }
            Text(item.name).nkFont(13, item.live ? .medium : .regular)
                .foregroundStyle(.white.opacity(item.live ? 0.95 : 0.55))
                .lineLimit(1).minimumScaleFactor(0.7).frame(width: orbSize + 26)
                .shadow(color: .black.opacity(0.5), radius: 6)
        }
        .contentShape(Rectangle())
        .onTapGesture { onTap(item, point) }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(item.live ? "\(item.name) \(orbSpoken(item.display))" : "\(item.name), még nem él")
        .accessibilityAddTraits(.isButton)
    }
}

/// Coming out of the fog: an orb arrives blurred, small and invisible, and settles into place. Reduced motion skips
/// the drift and just turns it on.
private struct FogArrival: ViewModifier {
    let shown: Bool, delay: Double, reduceMotion: Bool
    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .scaleEffect(shown || reduceMotion ? 1 : 0.82)
            .blur(radius: shown || reduceMotion ? 0 : 14)
            .animation(reduceMotion ? .easeOut(duration: 0.2)
                       : .smooth(duration: 1.1 * nkMotionScale).delay(delay * nkMotionScale), value: shown)
    }
}

/// An orb that only breathes: the ring's seven never slosh or ripple (they are doors, not the hero), so they need no
/// motion manager — just the shader's own time, lifted a little by a slow breath on its own phase.
public struct BreathingOrb: View {
    let palette: [Color], size: CGFloat, level: Double, phase: Double, animated: Bool
    @State private var start = Date()
    public init(palette: [Color], size: CGFloat, level: Double, phase: Double = 0, animated: Bool = true) {
        self.palette = palette; self.size = size; self.level = level; self.phase = phase; self.animated = animated
    }

    public var body: some View {
        // A paused timeline holds its last date, so freezing the orb (a transition, a dead area, reduced motion)
        // keeps exactly the frame it was on instead of jumping to another point of the wave.
        TimelineView(.animation(paused: !animated)) { tl in
            let t = tl.date.timeIntervalSince(start)
            let e = (animated ? t : max(t, 7.3)) + phase * 1.7
            let p = animated ? min(1.0, t / 1.6) : 1
            Rectangle()
                .frame(width: size, height: size)
                .orbEffect(size: size, time: e, palette: orbPalette(palette), fill: level * (1 - pow(1 - p, 3)),
                           tilt: 0.10 * sin(e * 0.55), rippleX: 0, rippleAge: 9, speak: 0)
                .scaleEffect(1 + 0.022 * sin(e * 0.9))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
