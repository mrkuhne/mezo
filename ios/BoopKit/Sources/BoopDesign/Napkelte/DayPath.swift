import SwiftUI

/// One station on the day's path.
public struct PathStation: Identifiable, Sendable {
    public let id: String, time: String, glyph: String, title: String, sub: String
    public let done: Bool, isNow: Bool, opens: Bool
    public init(id: String, time: String, glyph: String, title: String, sub: String, done: Bool, isNow: Bool, opens: Bool = false) {
        self.id = id; self.time = time; self.glyph = glyph; self.title = title; self.sub = sub; self.done = done; self.isNow = isNow; self.opens = opens
    }
}

/// Which line segments (below each station) are lit: from a reached station (done or now) to the next reached one.
public func pathLit(_ stations: [PathStation]) -> [Bool] {
    stations.indices.map { i in
        guard i + 1 < stations.count else { return false }
        let a = stations[i], b = stations[i + 1]
        return (a.done || a.isNow) && (b.done || b.isNow)
    }
}

/// The day as one glowing line (spec §5.1b): lit up to MOST, past stations solid with a check, future stations ringed;
/// stations that `opens` get a brighter ring, a glow and the caller's card hanging off the line.
public struct DayPath<Card: View>: View {
    let stations: [PathStation], hue: Hue
    let card: (PathStation) -> Card
    /// A tap on a station's row (MOST excepted, its card has its own buttons); nil = the rows are not tappable.
    let onTap: ((PathStation) -> Void)?
    public init(stations: [PathStation], hue: Hue, onTap: ((PathStation) -> Void)? = nil,
                @ViewBuilder card: @escaping (PathStation) -> Card) {
        self.stations = stations; self.hue = hue; self.onTap = onTap; self.card = card
    }

    public var body: some View {
        let lit = pathLit(stations)
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(stations.enumerated()), id: \.element.id) { i, st in
                row(st, first: i == 0, last: i == stations.count - 1, litBelow: lit[i], litAbove: i > 0 && lit[i - 1])
                    .scrollTransition(.animated(.spring(response: 0.5, dampingFraction: 0.85))) { c, phase in
                        c.opacity(phase.isIdentity ? 1 : 0.35)
                            .scaleEffect(phase.isIdentity ? 1 : 0.94, anchor: .leading)
                            .rotation3DEffect(.degrees(phase.value * -10), axis: (x: 1, y: 0, z: 0), anchor: .center, perspective: 0.6)
                    }
            }
        }
    }

    private func row(_ st: PathStation, first: Bool, last: Bool, litBelow: Bool, litAbove: Bool) -> some View {
        let top: CGFloat = st.isNow ? 8 : 14
        return HStack(alignment: .top, spacing: 12) {
            Text(st.time).nkFont(11.5, .medium, design: .monospaced).foregroundStyle(.white.opacity(st.isNow ? 1 : (st.done ? 0.45 : 0.7)))
                .frame(width: 42, alignment: .trailing).padding(.top, st.isNow ? 4 : 12)
            ZStack(alignment: .top) {
                VStack(spacing: 0) {
                    segment(lit: litAbove).frame(height: top).opacity(first ? 0 : 1)
                    Spacer(minLength: 0)
                }
                VStack(spacing: 0) {
                    Color.clear.frame(height: top)
                    node(st)
                    segment(lit: litBelow).frame(maxHeight: .infinity).opacity(last ? 0 : 1)
                }
            }
            .frame(width: 24)
            VStack(alignment: .leading, spacing: 10) {
                if st.isNow {
                    Text("MOST").nkFont(11, .bold, design: .monospaced).tracking(1.4).foregroundStyle(.white).padding(.top, 4)
                    Color.clear.frame(height: 6)
                    if st.opens { card(st) }
                } else {
                    Text(st.title).nkFont(st.opens ? 17 : 15.5, st.opens && !st.done ? .semibold : .regular)
                        .foregroundStyle(.white.opacity(st.done ? 0.6 : (st.opens ? 1 : 0.8))).padding(.top, 10)
                    if !st.sub.isEmpty {
                        Text(st.sub).nkFont(13).foregroundStyle(.white.opacity(st.done ? 0.4 : 0.6)).padding(.top, -6)
                    }
                    if st.opens { card(st).padding(.top, 2) }
                }
            }
            .padding(.bottom, st.opens ? 18 : 10)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .stationTap(onTap.flatMap { tap in st.isNow ? nil : { tap(st) } })
        .accessibilityElement(children: st.opens ? .contain : .combine)
        .accessibilityAddTraits(onTap != nil && !st.isNow ? .isButton : [])
    }

    private func segment(lit: Bool) -> some View {
        ZStack {
            if lit {
                Rectangle().fill(hue.glow).frame(width: 6).blur(radius: 5).opacity(0.8)
                Rectangle().fill(.white).frame(width: 2)
            } else {
                Rectangle().fill(.white.opacity(0.16)).frame(width: 2)
            }
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder private func node(_ st: PathStation) -> some View {
        if st.isNow {
            NowPulse(hue: hue)
        } else {
            ZStack {
                Circle().fill(st.done ? Color.white : (st.opens ? Color.white.opacity(0.14) : NK.ground))
                Circle().stroke(.white.opacity(st.done ? 0 : (st.opens ? 0.9 : 0.35)), lineWidth: 1.2)
                NKGlyph(st.done ? "check-ink" : st.glyph, st.done ? NK.ground : .white.opacity(st.opens ? 1 : 0.7), size: 11)
            }
            .frame(width: 22, height: 22)
            .shadow(color: st.opens && !st.done ? hue.glow.opacity(0.8) : .clear, radius: 8)
        }
    }
}

/// The "now" node: a white dot with a breathing halo in the page hue.
public struct NowPulse: View {
    let hue: Hue
    @State private var on = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    public init(hue: Hue) { self.hue = hue }
    public var body: some View {
        ZStack {
            Circle().fill(hue.glow.opacity(0.5)).frame(width: on ? 30 : 14).blur(radius: 4).opacity(on ? 0.2 : 0.9)
            Circle().fill(.white).frame(width: 12, height: 12)
        }
        .frame(width: 24, height: 16)
        .onAppear { if !reduceMotion { withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) { on = true } } }
    }
}

private extension View {
    /// A station takes taps only when the path has a tap handler (and it is not the "MOST" marker): a read-only path
    /// leaves the gesture off entirely, so it never swallows a tap meant for the card or the scroll view.
    @ViewBuilder func stationTap(_ action: (() -> Void)?) -> some View {
        if let action {
            contentShape(Rectangle()).onTapGesture(perform: action)
        } else {
            self
        }
    }
}
