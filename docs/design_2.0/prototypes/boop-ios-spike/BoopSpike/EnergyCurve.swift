import SwiftUI

// MARK: - The day's data

struct CalEvent: Identifiable {
    enum Kind { case meeting, meal, train, sleep }
    let id = UUID()
    let start: Double, end: Double     // hours, e.g. 13.5 = 13:30
    let title: String
    let kind: Kind
    var note: String? = nil
}

struct Conflict {
    let at: Double
    let title: String
    let note: String
    let action: String
}

struct DayPlan {
    let energy: [Double]               // hourly 06:00 → 24:00 (19 values)
    let events: [CalEvent]
    let conflicts: [Conflict]

    static let normal = DayPlan(
        energy: [0.50, 0.66, 0.78, 0.84, 0.88, 0.86, 0.78, 0.64, 0.58, 0.64, 0.68, 0.64, 0.58, 0.66, 0.56, 0.48, 0.40, 0.31, 0.24],
        events: [
            .init(start: 9, end: 9.5, title: "Napi egyeztetés", kind: .meeting),
            .init(start: 10.5, end: 12, title: "Termék workshop", kind: .meeting),
            .init(start: 12.5, end: 13.25, title: "Ebéd", kind: .meal, note: "45 g fehérje kell, hogy az esti edzésre maradjon erőd."),
            .init(start: 14, end: 17, title: "Fejlesztés · fókusz blokk", kind: .meeting),
            .init(start: 17.5, end: 18, title: "Ügyfélhívás", kind: .meeting),
            .init(start: 18, end: 19, title: "Edzés · Push nap", kind: .train, note: "Az edzés ad egy kis energialöketet, utána szépen leeresztesz."),
            .init(start: 22.75, end: 23, title: "Lefekvés", kind: .sleep, note: "7ó 30p alvás → holnap is 75 felett ébredsz."),
        ],
        conflicts: [
            .init(at: 17.75, title: "Hívás → edzés: csak 30 perc", note: "Csak 30 perced marad a hívás után. Told az edzést 18:30-ra, és egyél előtte egy banánt.", action: "Edzés 18:30-ra"),
        ])

    static let ceo = DayPlan(
        energy: [0.55, 0.70, 0.78, 0.80, 0.76, 0.70, 0.62, 0.55, 0.50, 0.52, 0.48, 0.44, 0.40, 0.42, 0.36, 0.30, 0.26, 0.22, 0.18],
        events: [
            .init(start: 7.5, end: 8, title: "Befektetői hívás (USA)", kind: .meeting),
            .init(start: 8, end: 8.5, title: "Vezetői standup", kind: .meeting),
            .init(start: 8.5, end: 9.5, title: "Board előkészítés", kind: .meeting),
            .init(start: 9.5, end: 10, title: "HR egyeztetés", kind: .meeting),
            .init(start: 9.75, end: 10.5, title: "Termékstratégia", kind: .meeting),
            .init(start: 10.5, end: 11, title: "1:1 · pénzügyi igazgató", kind: .meeting),
            .init(start: 11, end: 12, title: "Ügyféltárgyalás", kind: .meeting),
            .init(start: 12, end: 12.5, title: "Sajtóinterjú", kind: .meeting),
            .init(start: 12.5, end: 13, title: "Gyors ebéd", kind: .meal, note: "Fehérjedús, gyors ebéd kell: a Board előtt ne maradj éhes."),
            .init(start: 13, end: 14, title: "Board meeting", kind: .meeting),
            .init(start: 14, end: 14.5, title: "1:1 · technológiai igazgató", kind: .meeting),
            .init(start: 14.5, end: 15.5, title: "Felvételi interjú", kind: .meeting),
            .init(start: 15, end: 15.5, title: "Jogi egyeztetés", kind: .meeting),
            .init(start: 15.5, end: 16, title: "Marketing", kind: .meeting),
            .init(start: 16, end: 17, title: "Negyedéves áttekintés", kind: .meeting),
            .init(start: 17, end: 17.5, title: "1:1 · értékesítés", kind: .meeting),
            .init(start: 17.5, end: 18, title: "Összvállalati előkészítés", kind: .meeting),
            .init(start: 18, end: 19.25, title: "Befektetői hívás (Ázsia)", kind: .meeting),
            .init(start: 19, end: 20, title: "Edzés · Pull nap", kind: .train, note: "Ma a rövidített, 45 perces változat elég."),
            .init(start: 20.25, end: 21, title: "Vacsora", kind: .meal, note: "Késő vacsora: könnyű legyen, hogy jól aludj."),
            .init(start: 23.5, end: 24, title: "Lefekvés", kind: .sleep, note: "Csak 6ó 30p fér bele. Holnap reggel ne tegyél semmit 8 elé."),
        ],
        conflicts: [
            .init(at: 12.75, title: "Ebéd: 30 perc két meeting között", note: "Nincs időd rendesen enni. Rendelj előre egy fehérjedús ebédet 12:30-ra, hogy ne a Boardon legyél éhes.", action: "Ebéd előrendelése"),
            .init(at: 19.1, title: "A hívás belelóg az edzésbe", note: "Az ázsiai hívás 19:15-ig tart. Csinálj rövidített, 45 perces edzést 19:30-tól, vagy tedd át holnap reggel 7-re.", action: "Edzés 19:30-ra, 45 perc"),
        ])
}

// MARK: - The curve

/// The day as a liquid energy curve. Only what touches the body sits on it (meals, training,
/// sleep, conflicts); meetings melt into a busy ribbon underneath. Press and drag to see any moment.
struct EnergyCurve: View {
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
                SectionHead(title: "A nap energiája", color: .white.opacity(0.5))
                Text("\(plan.events.filter { $0.kind == .meeting }.count) esemény · Google Naptár")
                    .font(.caption2.weight(.medium)).foregroundStyle(.white.opacity(0.4)).fixedSize()
            }

            GeometryReader { geo in
                let w = geo.size.width, h = geo.size.height
                let graphH = h - 26                       // room for the busy ribbon
                let line = curvePath(w: w, h: graphH)
                ZStack(alignment: .topLeading) {
                    area(line, w: w, h: graphH)
                        .fill(LinearGradient(colors: [mood.colors[2].opacity(0.55), mood.colors[0].opacity(0.05)],
                                             startPoint: .top, endPoint: .bottom))
                        .mask(alignment: .leading) { Rectangle().frame(width: w * drawn) }
                    line.trim(from: 0, to: drawn)
                        .stroke(LinearGradient(colors: mood.colors, startPoint: .leading, endPoint: .trailing),
                                style: StrokeStyle(lineWidth: 3, lineCap: .round))
                        .shadow(color: mood.colors[2].opacity(0.6), radius: 8)

                    // Busy ribbon: darker where the calendar is denser.
                    BusyRibbon(events: plan.events, width: w)
                        .frame(width: w, height: 12)
                        .offset(y: graphH + 10)
                        .opacity(drawn > 0.3 ? 1 : 0)

                    Capsule().fill(.white.opacity(0.7)).frame(width: 2, height: graphH).offset(x: x(now, w))
                    Text("most").font(.caption2.weight(.semibold)).foregroundStyle(.white.opacity(0.7))
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
                    Text("\(hh)").font(.caption2.monospacedDigit()).foregroundStyle(.white.opacity(0.35))
                    if hh != 24 { Spacer() }
                }
            }
            HStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 2).fill(Boop.sky.opacity(0.65)).frame(width: 14, height: 8)
                Text("foglalt")
                Text("·")
                Image(systemName: "hand.tap")
                Text("tartsd lenyomva és húzd végig")
            }
            .font(.caption2).foregroundStyle(.white.opacity(0.4))

            if let a = anchors.first(where: { $0.id == selected }) {
                VStack(spacing: 10) {
                    ForEach(Array(a.items.enumerated()), id: \.offset) { _, it in callout(it, conflict: a.isConflict) }
                }
                .id(a.id)
                .transition(.asymmetric(insertion: .scale(scale: 0.96).combined(with: .opacity), removal: .opacity))
            }
        }
        .padding(20)
        .background(RoundedRectangle(cornerRadius: 28).fill(.white.opacity(0.05)))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(.white.opacity(0.08)))
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
            case .meal:  it = Item(time: hhmm(e.start), title: e.title, icon: "fork.knife", tint: Boop.sun, note: e.note, action: nil)
            case .train: it = Item(time: hhmm(e.start), title: e.title, icon: "figure.strengthtraining.traditional", tint: Boop.mint, note: e.note, action: nil)
            case .sleep: it = Item(time: hhmm(e.start), title: e.title, icon: "moon.fill", tint: Boop.violet, note: e.note, action: nil)
            }
            return (e.start, 0, it)
        }
        raw += plan.conflicts.map { c in
            (c.at, 1, Item(time: hhmm(c.at), title: c.title, icon: "exclamationmark", tint: Boop.peach, note: c.note, action: c.action))
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
        let tint = a.isConflict ? Boop.peach : (a.items.count > 1 ? Boop.sky : a.items[0].tint)
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
            .foregroundStyle(a.isConflict ? .black : .white)
            .frame(width: 28, height: 28)
            .background(Circle().fill(tint.opacity(a.isConflict ? 1 : 0.9)))
            .overlay(Circle().stroke(.white.opacity(on ? 0.95 : 0.25), lineWidth: on ? 2.5 : 1))
            .overlay(alignment: .topTrailing) {
                if a.items.count > 1 && !a.isConflict {      // little stack hint
                    Circle().fill(.white.opacity(0.8)).frame(width: 7, height: 7).offset(x: 2, y: -2)
                }
            }
            .scaleEffect(on ? 1.18 : 1)
            .shadow(color: tint.opacity(0.7), radius: on ? 10 : 4)
        }
        .buttonStyle(.plain)
        .background(alignment: .bottom) {
            if a.isConflict { Capsule().fill(Boop.peach.opacity(0.6)).frame(width: 2, height: 36).offset(y: 36) }
        }
    }

    private func callout(_ it: Item, conflict: Bool) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: it.icon).font(.system(size: 13, weight: .bold))
                .foregroundStyle(conflict ? .black : .white)
                .frame(width: 30, height: 30)
                .background(Circle().fill(it.tint))
            VStack(alignment: .leading, spacing: 4) {
                Text("\(it.time) · \(it.title)").font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                if let n = it.note { Text(n).font(.system(.callout, design: .serif)).foregroundStyle(.white.opacity(0.75)) }
                if let act = it.action {
                    Button { } label: { Label(act, systemImage: "arrow.right").font(.footnote.weight(.semibold)) }
                        .buttonStyle(.glassProminent).tint(Boop.peach).padding(.top, 4)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 20).fill(.white.opacity(conflict ? 0.09 : 0.06)))
    }

    // MARK: magnifier

    @ViewBuilder private func lens(at sx: CGFloat, w: CGFloat, h: CGFloat) -> some View {
        let hr = hour(at: sx, w)
        let py = y(at: hr, h)
        let here = plan.events.filter { $0.start <= hr + 0.01 && $0.end > hr }
        let energyPct = Int((1 - (py - h * 0.05) / (h * 0.9)) * 100)
        let cardW: CGFloat = 200
        ZStack(alignment: .topLeading) {
            Capsule().fill(.white).frame(width: 1.5, height: h).offset(x: sx)
            Circle().fill(.white).frame(width: 12, height: 12)
                .shadow(color: mood.colors[2], radius: 8)
                .offset(x: sx - 6, y: py - 6)
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(hhmm(hr)).font(.system(.headline, design: .rounded).monospacedDigit())
                    Spacer()
                    Text("energia \(energyPct)%").font(.caption.weight(.semibold)).foregroundStyle(mood.colors[2])
                }
                if here.isEmpty {
                    Text("Szabad idő").font(.caption).foregroundStyle(.white.opacity(0.6))
                } else {
                    ForEach(here.prefix(3)) { e in
                        HStack(spacing: 6) {
                            Circle().fill(color(e.kind)).frame(width: 6, height: 6)
                            Text(e.title).font(.caption).lineLimit(1)
                        }
                    }
                    if here.count > 3 { Text("+\(here.count - 3) további").font(.caption2).foregroundStyle(.white.opacity(0.5)) }
                }
            }
            .foregroundStyle(.white)
            .padding(12)
            .frame(width: cardW, alignment: .leading)
            .glassEffect(.regular.tint(.black.opacity(0.3)), in: .rect(cornerRadius: 16))
            .offset(x: min(max(0, sx - cardW / 2), w - cardW), y: -8)
        }
        .allowsHitTesting(false)
        .transition(.opacity)
    }

    // MARK: geometry helpers

    private func color(_ k: CalEvent.Kind) -> Color {
        switch k { case .meeting: Boop.sky; case .meal: Boop.sun; case .train: Boop.mint; case .sleep: Boop.violet }
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
struct BusyRibbon: View {
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
                         with: .color(Boop.sky.opacity(n == 1 ? 0.35 : (n == 2 ? 0.65 : 0.9))))
            }
        }
    }
}
