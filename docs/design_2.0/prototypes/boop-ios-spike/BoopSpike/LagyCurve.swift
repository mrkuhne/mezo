import SwiftUI

/// Lágy dress of the day energy curve (white card, sage liquid, Lágy hues).
struct LagyEnergyCurve: View {
    var mood: Mood
    var plan: DayPlan

    /// One icon on the curve (or a cluster of them).
    struct Anchor: Identifiable {
        let id: String
        let hour: Double
        let items: [Item]
        let lane: Int                   // 0 = on the curve, 1 = conflicts, lifted above
        var isConflict: Bool { lane == 1 }
    }
    struct Item { let time: String; let title: String; let icon: String; let tint: Color; let note: String?; let action: String? }

    private let now = 7.2
    @State private var drawn: CGFloat = 0
    @State private var selected: String?
    @State private var scrubX: CGFloat?

    var body: some View {
        let anchors = buildAnchors()
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text("Energia és naptár").font(.manrope(13, .bold)).foregroundStyle(Lagy.ink2)
                Spacer()
                Text("\(plan.events.filter { $0.kind == .meeting }.count) esemény · Google Naptár")
                    .font(.manrope(12, .semibold)).foregroundStyle(Lagy.ink.opacity(0.4)).fixedSize()
            }

            GeometryReader { geo in
                let w = geo.size.width, h = geo.size.height
                let graphH = h - 26                       // room for the busy ribbon
                let line = curvePath(w: w, h: graphH)
                ZStack(alignment: .topLeading) {
                    area(line, w: w, h: graphH)
                        .fill(LinearGradient(colors: [Lagy.sage.opacity(0.55), Lagy.deep.opacity(0.05)],
                                             startPoint: .top, endPoint: .bottom))
                        .mask(alignment: .leading) { Rectangle().frame(width: w * drawn) }
                    line.trim(from: 0, to: drawn)
                        .stroke(LinearGradient(colors: [Lagy.sage2, Lagy.sage, Lagy.deep], startPoint: .leading, endPoint: .trailing),
                                style: StrokeStyle(lineWidth: 3, lineCap: .round))
                        

                    // Busy ribbon: darker where the calendar is denser.
                    LagyRibbon(events: plan.events, width: w)
                        .frame(width: w, height: 12)
                        .offset(y: graphH + 10)
                        .opacity(drawn > 0.3 ? 1 : 0)

                    Capsule().fill(Lagy.ink.opacity(0.35)).frame(width: 2, height: graphH).offset(x: x(now, w))
                    Text("most").font(.manrope(12, .semibold)).foregroundStyle(Lagy.ink.opacity(0.7))
                        .offset(x: x(now, w) + 5, y: -2)

                    ForEach(anchors) { a in
                        anchorButton(a)
                            .position(x: x(a.hour, w), y: a.isConflict ? max(16, y(at: a.hour, graphH) - 44) : y(at: a.hour, graphH))
                            .opacity(drawn * 1.3 > CGFloat(a.hour - 6) / 18 ? 1 : 0)
                    }

                    let debugHour = UserDefaults.standard.double(forKey: "scrubAt")   // test hook: -scrubAt 14.25
                    if let sx = scrubX ?? (debugHour > 0 ? x(debugHour, w) : nil) { lens(at: sx, w: w, h: graphH) }
                }
                .contentShape(Rectangle())
                .gesture(
                    LongPressGesture(minimumDuration: 0.2)
                        .sequenced(before: DragGesture(minimumDistance: 0))
                        .onChanged { v in
                            if case .second(true, let d?) = v { scrubX = max(0, min(w, d.location.x)) }
                        }
                        .onEnded { _ in withAnimation(.easeOut(duration: 0.2)) { scrubX = nil } }
                )
            }
            .frame(height: 196)
            .sensoryFeedback(.selection, trigger: selected)
            .sensoryFeedback(.selection, trigger: scrubX.map { Int(hour(at: $0, 1) * 4) })   // tick every 15 min

            HStack {
                ForEach([6, 9, 12, 15, 18, 21, 24], id: \.self) { hh in
                    Text("\(hh)").font(.manrope(12, .semibold)).foregroundStyle(Lagy.ink.opacity(0.35))
                    if hh != 24 { Spacer() }
                }
            }
            HStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 2).fill(Lagy.sky.opacity(0.65)).frame(width: 14, height: 8)
                Text("foglalt")
                Text("·")
                Image(systemName: "hand.tap")
                Text("tartsd lenyomva és húzd végig")
            }
            .font(.manrope(12, .semibold)).foregroundStyle(Lagy.ink.opacity(0.4))

            if let a = anchors.first(where: { $0.id == selected }) {
                VStack(spacing: 10) {
                    ForEach(Array(a.items.enumerated()), id: \.offset) { _, it in callout(it, conflict: a.isConflict) }
                }
                .id(a.id)
                .transition(.asymmetric(insertion: .scale(scale: 0.96).combined(with: .opacity), removal: .opacity))
            }
        }
        .padding(20)
        .lagyCard()
        .onAppear {
            selected = UserDefaults.standard.string(forKey: "select") ?? buildAnchors().first(where: \.isConflict)?.id   // test hook
            withAnimation(.easeInOut(duration: 2.0).delay(0.4)) { drawn = 1 }
        }
        .onChange(of: mood) { redraw() }
        .onChange(of: plan.events.count) {
            selected = buildAnchors().first(where: \.isConflict)?.id
            redraw()
        }
    }

    private func redraw() {
        drawn = 0
        withAnimation(.easeInOut(duration: 1.6)) { drawn = 1 }
    }

    // MARK: anchors + clustering

    private func buildAnchors() -> [Anchor] {
        var raw: [(hour: Double, lane: Int, item: Item)] = plan.events.compactMap { e in
            let it: Item
            switch e.kind {
            case .meeting: return nil
            case .meal:  it = Item(time: hhmm(e.start), title: e.title, icon: "fork.knife", tint: Lagy.sun, note: e.note, action: nil)
            case .train: it = Item(time: hhmm(e.start), title: e.title, icon: "figure.strengthtraining.traditional", tint: Lagy.sage, note: e.note, action: nil)
            case .sleep: it = Item(time: hhmm(e.start), title: e.title, icon: "moon.fill", tint: Lagy.berry, note: e.note, action: nil)
            }
            return (e.start, 0, it)
        }
        raw += plan.conflicts.map { c in
            (c.at, 1, Item(time: hhmm(c.at), title: c.title, icon: "exclamationmark", tint: Lagy.peach, note: c.note, action: c.action))
        }
        // Greedy clustering per lane: icons closer than ~1.4h would touch.
        var out: [Anchor] = []
        for lane in [0, 1] {
            let sorted = raw.filter { $0.lane == lane }.sorted { $0.hour < $1.hour }
            var group: [(hour: Double, lane: Int, item: Item)] = []
            func flush() {
                guard !group.isEmpty else { return }
                let hr = group.map(\.hour).reduce(0, +) / Double(group.count)
                out.append(Anchor(id: "\(lane)-\(group.first!.item.time)", hour: hr, items: group.map(\.item), lane: lane))
                group = []
            }
            for r in sorted {
                if let last = group.last, r.hour - last.hour > 1.4 { flush() }
                group.append(r)
            }
            flush()
        }
        return out
    }

    @ViewBuilder private func anchorButton(_ a: Anchor) -> some View {
        let on = selected == a.id
        let tint = a.isConflict ? Lagy.peach : (a.items.count > 1 ? Lagy.sky : a.items[0].tint)
        Button {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { selected = a.id }
        } label: {
            ZStack {
                if a.items.count > 1 {
                    Text("\(a.items.count)").font(.system(size: 13, weight: .bold, design: .rounded))
                } else {
                    Image(systemName: a.items[0].icon).font(.system(size: 11, weight: .bold))
                }
            }
            .foregroundStyle(a.isConflict ? Lagy.peachInk : .white)
            .frame(width: 28, height: 28)
            .background(Circle().fill(tint.opacity(a.isConflict ? 1 : 0.9)))
            .overlay(Circle().stroke(on ? Lagy.ink : .white, lineWidth: on ? 2.5 : 2))
            .overlay(alignment: .topTrailing) {
                if a.items.count > 1 && !a.isConflict {      // little stack hint
                    Circle().fill(Lagy.ink.opacity(0.8)).frame(width: 7, height: 7).offset(x: 2, y: -2)
                }
            }
            .scaleEffect(on ? 1.18 : 1)
            .shadow(color: tint.opacity(0.7), radius: on ? 10 : 4)
        }
        .buttonStyle(.plain)
        .background(alignment: .bottom) {
            if a.isConflict { Capsule().fill(Lagy.peach.opacity(0.6)).frame(width: 2, height: 36).offset(y: 36) }
        }
    }

    private func callout(_ it: Item, conflict: Bool) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: it.icon).font(.system(size: 13, weight: .bold))
                .foregroundStyle(conflict ? Lagy.peachInk : .white)
                .frame(width: 30, height: 30)
                .background(Circle().fill(it.tint))
            VStack(alignment: .leading, spacing: 4) {
                Text("\(it.time) · \(it.title)").font(.outfit(15)).foregroundStyle(Lagy.ink)
                if let n = it.note { Text(n).font(.manrope(14, .medium)).foregroundStyle(Lagy.ink.opacity(0.75)) }
                if let act = it.action {
                    Button { } label: { Label(act, systemImage: "arrow.right").font(.footnote.weight(.semibold)) }
                        .buttonStyle(.borderedProminent).tint(Lagy.ink).padding(.top, 4)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(conflict ? Lagy.peach2 : Lagy.paper))
    }

    // MARK: magnifier

    @ViewBuilder private func lens(at sx: CGFloat, w: CGFloat, h: CGFloat) -> some View {
        let hr = hour(at: sx, w)
        let py = y(at: hr, h)
        let here = plan.events.filter { $0.start <= hr + 0.01 && $0.end > hr }
        let energyPct = Int((1 - (py - h * 0.05) / (h * 0.9)) * 100)
        let cardW: CGFloat = 200
        ZStack(alignment: .topLeading) {
            Capsule().fill(Lagy.ink.opacity(0.5)).frame(width: 1.5, height: h).offset(x: sx)
            Circle().fill(.white).frame(width: 12, height: 12)
                .shadow(color: Lagy.sage, radius: 8)
                .offset(x: sx - 6, y: py - 6)
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(hhmm(hr)).font(.outfit(17).monospacedDigit())
                    Spacer()
                    Text("energia \(energyPct)%").font(.manrope(12.5, .bold)).foregroundStyle(Lagy.sage)
                }
                if here.isEmpty {
                    Text("Szabad idő").font(.manrope(12.5, .bold)).foregroundStyle(Lagy.ink.opacity(0.6))
                } else {
                    ForEach(here.prefix(3)) { e in
                        HStack(spacing: 6) {
                            Circle().fill(color(e.kind)).frame(width: 6, height: 6)
                            Text(e.title).font(.manrope(12.5, .bold)).lineLimit(1)
                        }
                    }
                    if here.count > 3 { Text("+\(here.count - 3) további").font(.manrope(12, .semibold)).foregroundStyle(Lagy.ink.opacity(0.5)) }
                }
            }
            .foregroundStyle(Lagy.ink)
            .padding(12)
            .frame(width: cardW, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white).shadow(color: .black.opacity(0.16), radius: 14, y: 8))
            .offset(x: min(max(0, sx - cardW / 2), w - cardW), y: -8)
        }
        .allowsHitTesting(false)
        .transition(.opacity)
    }

    // MARK: geometry helpers

    private func color(_ k: CalEvent.Kind) -> Color {
        switch k { case .meeting: Lagy.sky; case .meal: Lagy.sun; case .train: Lagy.sage; case .sleep: Lagy.berry }
    }
    private func hhmm(_ h: Double) -> String {
        let m = Int((h * 60).rounded())
        return String(format: "%02d:%02d", min(23, m / 60), m % 60)
    }
    private func energy() -> [Double] {
        let shift = [0.0, -0.08, -0.2][mood.rawValue]
        return plan.energy.map { max(0.08, min(0.95, $0 + shift)) }
    }
    private func x(_ hour: Double, _ w: CGFloat) -> CGFloat { CGFloat((hour - 6) / 18) * w }
    private func hour(at x: CGFloat, _ w: CGFloat) -> Double { 6 + Double(x / max(1, w)) * 18 }
    private func y(at hour: Double, _ h: CGFloat) -> CGFloat {
        let e = energy()
        let f = max(0, min(Double(e.count - 1), hour - 6))
        let i = Int(f), j = min(e.count - 1, i + 1)
        let v = e[i] + (e[j] - e[i]) * (f - Double(i))
        return h * CGFloat(1 - v) * 0.9 + h * 0.05
    }
    private func curvePath(w: CGFloat, h: CGFloat) -> Path {
        let e = energy()
        let pts = e.indices.map { CGPoint(x: x(Double($0) + 6, w), y: y(at: Double($0) + 6, h)) }
        var p = Path()
        p.move(to: pts[0])
        for i in 0..<(pts.count - 1) {
            let p0 = pts[max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[min(pts.count - 1, i + 2)]
            p.addCurve(to: p2,
                       control1: CGPoint(x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6),
                       control2: CGPoint(x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6))
        }
        return p
    }
    private func area(_ line: Path, w: CGFloat, h: CGFloat) -> Path {
        var p = line
        p.addLine(to: CGPoint(x: w, y: h)); p.addLine(to: CGPoint(x: 0, y: h)); p.closeSubpath()
        return p
    }
}

/// Meetings as a density strip: one cell per 15 minutes, darker = more overlapping.
struct LagyRibbon: View {
    var events: [CalEvent]
    var width: CGFloat
    var body: some View {
        Canvas { ctx, size in
            let slots = 72
            let cw = size.width / CGFloat(slots)
            for s in 0..<slots {
                let t = 6 + Double(s) / 4 + 0.125
                let n = events.filter { $0.kind == .meeting && $0.start <= t && $0.end > t }.count
                guard n > 0 else { continue }
                let r = CGRect(x: CGFloat(s) * cw + 0.5, y: 0, width: cw - 1, height: size.height)
                ctx.fill(Path(roundedRect: r, cornerRadius: 2),
                         with: .color(Lagy.sky.opacity(n == 1 ? 0.35 : (n == 2 ? 0.65 : 0.9))))
            }
        }
    }
}
