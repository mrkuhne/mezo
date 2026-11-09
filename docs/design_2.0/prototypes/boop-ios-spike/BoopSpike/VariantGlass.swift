import SwiftUI

/// C — iOS 26 Liquid Glass: soft moving dawn mesh behind, glass panels, a filling energy tank.
struct VariantGlass: View {
    @State private var fill = 0.0

    var body: some View {
        ZStack {
            DawnMesh().ignoresSafeArea()
            ScrollView {
                VStack(spacing: 18) {
                    VStack(spacing: 4) {
                        Text(Demo.dateLine).font(.subheadline).foregroundStyle(Boop.ink.opacity(0.6))
                        Text(Demo.readinessWord).font(.system(size: 32, weight: .semibold, design: .rounded)).foregroundStyle(Boop.ink)
                    }
                    .padding(.top, 64)

                    // Energy tank
                    HStack(spacing: 22) {
                        ZStack(alignment: .bottom) {
                            RoundedRectangle(cornerRadius: 30).fill(.white.opacity(0.35))
                            TimelineView(.animation) { tl in
                                let ph = tl.date.timeIntervalSinceReferenceDate * 1.6
                                ZStack(alignment: .bottom) {
                                    Wave(phase: ph + 1.4, level: fill * 1.02)
                                        .fill(Boop.sky.opacity(0.35))
                                    Wave(phase: ph, level: fill)
                                        .fill(LinearGradient(colors: [Boop.mint, Boop.sky], startPoint: .top, endPoint: .bottom))
                                }
                            }
                            Text("\(Int(fill * 100))")
                                .font(.system(size: 44, weight: .semibold, design: .rounded))
                                .foregroundStyle(.white)
                                .contentTransition(.numericText(value: fill))
                                .padding(.bottom, 18)
                        }
                        .frame(width: 120, height: 200)
                        .clipShape(RoundedRectangle(cornerRadius: 30))
                        VStack(alignment: .leading, spacing: 12) {
                            stat("moon.zzz", "Alvás", Demo.sleepTotal)
                            stat("heart", "Nyugalmi pulzus", "\(Demo.restingHR) /perc")
                            stat("flame", "Mai keret", "\(Demo.kcalTarget) kcal")
                            stat("figure.run", "Mozgás terv", "\(Demo.moveKcal) kcal")
                        }
                    }
                    .padding(18)
                    .glassEffect(.regular, in: .rect(cornerRadius: 32))
                    .onAppear { withAnimation(.spring(response: 1.6, dampingFraction: 0.8).delay(0.2)) { fill = Double(Demo.readiness) / 100 } }

                    VStack(alignment: .leading, spacing: 10) {
                        Label("Boop", systemImage: "sparkles").font(.caption.weight(.semibold)).foregroundStyle(Boop.indigo)
                        Text(Demo.verdict).font(.callout).foregroundStyle(Boop.ink)
                        Button { } label: { Text("Told 18:30-ra").frame(maxWidth: .infinity) }
                            .buttonStyle(.glassProminent).tint(Boop.indigo).controlSize(.large)
                    }
                    .padding(18)
                    .glassEffect(.regular, in: .rect(cornerRadius: 28))

                    VStack(spacing: 0) {
                        SectionHead(title: "A napod").padding(.bottom, 8)
                        ForEach(Demo.events) { e in
                            HStack(spacing: 12) {
                                Image(systemName: e.kind.icon)
                                    .frame(width: 34, height: 34)
                                    .background(Circle().fill(e.kind.tint.opacity(0.25)))
                                    .foregroundStyle(Boop.ink)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(e.title).font(.subheadline.weight(.medium))
                                    Text(e.time).font(.caption).foregroundStyle(Boop.mute)
                                }
                                Spacer()
                                if e.kind == .conflict { Image(systemName: "exclamationmark.circle.fill").foregroundStyle(Boop.peach) }
                            }
                            .padding(.vertical, 7)
                        }
                    }
                    .padding(18)
                    .glassEffect(.regular, in: .rect(cornerRadius: 28))

                    VStack(spacing: 12) {
                        SectionHead(title: "Hogy érzed magad?")
                        CheckinChips()
                    }
                    .padding(18)
                    .glassEffect(.regular, in: .rect(cornerRadius: 28))
                    .padding(.bottom, 40)
                }
                .padding(.horizontal, 18)
            }
            .scrollIndicators(.hidden)
        }
        .preferredColorScheme(.light)
    }

    private func stat(_ icon: String, _ label: String, _ value: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon).frame(width: 20).foregroundStyle(Boop.indigo)
            VStack(alignment: .leading, spacing: 0) {
                Text(label).font(.caption).foregroundStyle(Boop.mute)
                Text(value).font(.system(.subheadline, design: .rounded).weight(.semibold)).foregroundStyle(Boop.ink)
            }
        }
    }
}

/// A slow, living dawn background.
struct DawnMesh: View {
    var body: some View {
        TimelineView(.animation) { tl in
            let t = Float(tl.date.timeIntervalSinceReferenceDate)
            MeshGradient(width: 3, height: 3, points: [
                [0, 0], [0.5, 0], [1, 0],
                [0, 0.5], [0.5 + 0.12 * sin(t * 0.3), 0.45 + 0.1 * cos(t * 0.25)], [1, 0.5],
                [0, 1], [0.5, 1], [1, 1],
            ], colors: [
                Color(red: 1.0, green: 0.86, blue: 0.78), Color(red: 0.98, green: 0.80, blue: 0.86), Color(red: 0.80, green: 0.82, blue: 1.0),
                Color(red: 1.0, green: 0.93, blue: 0.85), Color(red: 0.92, green: 0.90, blue: 1.0), Color(red: 0.78, green: 0.90, blue: 1.0),
                Color(red: 0.90, green: 0.97, blue: 0.94), Color(red: 0.95, green: 0.95, blue: 1.0), Color(red: 0.86, green: 0.95, blue: 1.0),
            ])
        }
    }
}

/// Liquid with a moving wave on top; `level` 0...1.
struct Wave: Shape {
    var phase: Double
    var level: Double
    var animatableData: Double { get { level } set { level = newValue } }
    func path(in r: CGRect) -> Path {
        var p = Path()
        let y0 = r.maxY - r.height * level
        p.move(to: CGPoint(x: r.minX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX, y: y0))
        for x in stride(from: 0, through: r.width, by: 2) {
            let y = y0 + 5 * sin((x / r.width) * .pi * 2 + phase)
            p.addLine(to: CGPoint(x: r.minX + x, y: y))
        }
        p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
        p.closeSubpath()
        return p
    }
}
