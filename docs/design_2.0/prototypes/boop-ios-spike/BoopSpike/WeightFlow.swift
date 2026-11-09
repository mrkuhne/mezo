import SwiftUI
import Charts

/// Weigh-in: a scale-like ruler dial, then the trend against the goal waterline and Boop's read
/// (fine / daily fluctuation / real drift).
struct WeightFlow: View {
    var mood: Mood
    var onDone: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var kg = 82.4
    @State private var saved = UserDefaults.standard.bool(forKey: "weightSaved")

    var body: some View {
        FlowScaffold(eyebrow: "Mérlegelés · reggel", title: saved ? "Napi ingadozás" : "Mennyi ma?", mood: mood) {
            VStack(alignment: .leading, spacing: 20) {
                if !saved {
                    WeightDial(kg: $kg)
                    Text("Tegnap 82,6 kg · ébredés után, mosdó után mérj").font(.footnote).foregroundStyle(.white.opacity(0.45))
                        .frame(maxWidth: .infinity)
                    PrimaryButton(title: "Rögzítem", icon: "checkmark", tint: mood.colors[0]) {
                        withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) { saved = true }
                    }
                } else {
                    result
                }
            }
        }
        .sensoryFeedback(.success, trigger: saved)
    }

    private struct Pt: Identifiable { let id = UUID(); let day: Int; let raw: Double; let trend: Double }
    private var series: [Pt] {
        let noise: [Double] = [0.3, -0.2, 0.5, -0.4, 0.1, 0.6, -0.3, 0.2, -0.5, 0.4, 0.0, -0.2, 0.3, -0.4, 0.5, 0.1, -0.3, 0.2, -0.1, 0.4, 0.3]
        return (0..<21).map { d in
            let t = 83.6 - Double(d) * 0.072
            return Pt(day: d, raw: d == 20 ? kg : t + noise[d], trend: t)
        }
    }

    @ViewBuilder private var result: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(hu1(kg)).font(.system(size: 56, weight: .semibold, design: .rounded)).foregroundStyle(.white)
            Text("kg").font(.title3).foregroundStyle(.white.opacity(0.6))
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("trend 82,2 kg").font(.subheadline.weight(.semibold)).foregroundStyle(mood.colors[2])
                Text("heti −0,5 kg").font(.caption).foregroundStyle(.white.opacity(0.5))
            }
        }
        Card {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Label("Jó úton haladsz", systemImage: "checkmark.seal.fill").font(.subheadline.weight(.semibold)).foregroundStyle(Boop.mint)
                    Spacer()
                    Text("3 hét").font(.caption).foregroundStyle(.white.opacity(0.45))
                }
                Chart {
                    ForEach(series) { p in
                        AreaMark(x: .value("Nap", p.day), yStart: .value("alap", 78), yEnd: .value("Trend", p.trend))
                            .foregroundStyle(LinearGradient(colors: [mood.colors[2].opacity(0.45), mood.colors[0].opacity(0.02)], startPoint: .top, endPoint: .bottom))
                            .interpolationMethod(.catmullRom)
                        LineMark(x: .value("Nap", p.day), y: .value("Trend", p.trend))
                            .foregroundStyle(mood.colors[2]).lineStyle(.init(lineWidth: 3)).interpolationMethod(.catmullRom)
                        PointMark(x: .value("Nap", p.day), y: .value("Mérés", p.raw))
                            .foregroundStyle(p.day == 20 ? .white : .white.opacity(0.35))
                            .symbolSize(p.day == 20 ? 70 : 22)
                    }
                    RuleMark(y: .value("Cél", 79))
                        .foregroundStyle(Boop.mint.opacity(0.7))
                        .lineStyle(.init(lineWidth: 1.5, dash: [5, 4]))
                        .annotation(position: .top, alignment: .leading) {
                            Text("cél 79 kg").font(.caption2.weight(.semibold)).foregroundStyle(Boop.mint)
                        }
                }
                .chartYScale(domain: 78...84.5)
                .chartXAxis(.hidden)
                .chartYAxis { AxisMarks(position: .trailing, values: [79, 81, 83]) { _ in AxisValueLabel().foregroundStyle(.white.opacity(0.4)) } }
                .frame(height: 170)
                HStack {
                    stat("hátravan", "3,2 kg")
                    stat("várható", "dec. 28.")
                    stat("haladás", "52%")
                }
            }
        }
        BoopSays(segs: [
            .init("A mai 82,4 kg "), .init("0,2-vel több a tegnapinál", "raw"),
            .init(", de ez csak napi ingadozás: a tegnapi vacsora sósabb volt, és vizet tartasz. Ami számít, a "),
            .init("trendérték: 82,2 kg, hetente −0,5 kg", "trend"),
            .init(". Ezzel a tempóval december végére eléred a 79 kg-ot. Nincs teendő, maradj a terven."),
        ], mood: mood)
        PrimaryButton(title: "Kész", icon: "checkmark", tint: mood.colors[0]) {
            onDone("\(hu1(kg)) kg · trend 82,2 · jó úton")
            dismiss()
        }
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.system(.headline, design: .rounded)).foregroundStyle(.white)
            Text(label).font(.caption).foregroundStyle(.white.opacity(0.45))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A horizontal ruler like a bathroom scale's dial: drag to set, 0.1 kg per tick, haptic per tick.
struct WeightDial: View {
    @Binding var kg: Double
    @State private var base: Double?
    private let spacing: CGFloat = 12      // points per 0.1 kg

    var body: some View {
        VStack(spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(hu1(kg))
                    .font(.system(size: 84, weight: .semibold, design: .rounded))
                    .contentTransition(.numericText(value: kg))
                    .monospacedDigit()
                Text("kg").font(.title2).foregroundStyle(.white.opacity(0.6))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)

            Canvas { ctx, size in
                let mid = size.width / 2
                let ticks = Int(size.width / spacing) / 2 + 2
                let center = (kg * 10).rounded()
                for k in -ticks...ticks {
                    let v = center + Double(k)
                    let x = mid + CGFloat(k) * spacing
                    let major = Int(v) % 10 == 0, half = Int(v) % 5 == 0
                    let len: CGFloat = major ? 34 : (half ? 22 : 13)
                    let fade = max(0.1, 1 - abs(Double(k)) / Double(ticks))
                    var p = Path(); p.move(to: CGPoint(x: x, y: 8)); p.addLine(to: CGPoint(x: x, y: 8 + len))
                    ctx.stroke(p, with: .color(.white.opacity(0.55 * fade)), lineWidth: major ? 2 : 1)
                    if major {
                        ctx.draw(Text("\(Int(v / 10))").font(.caption2.weight(.semibold)).foregroundColor(.white.opacity(0.6 * fade)),
                                 at: CGPoint(x: x, y: 58))
                    }
                }
            }
            .frame(height: 70)
            .overlay {
                Capsule().fill(Boop.mint).frame(width: 3, height: 52).offset(y: -6).shadow(color: Boop.mint, radius: 6)
            }
            .mask(LinearGradient(colors: [.clear, .black, .black, .clear], startPoint: .leading, endPoint: .trailing))
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0)
                .onChanged { g in
                    if base == nil { base = kg }
                    let v = (base ?? kg) - Double(g.translation.width / spacing) * 0.1
                    kg = (max(40, min(200, v)) * 10).rounded() / 10
                }
                .onEnded { _ in base = nil })
            .sensoryFeedback(.selection, trigger: kg)
            .accessibilityElement()
            .accessibilityLabel("\(hu1(kg)) kilogramm")
            .accessibilityAdjustableAction { d in kg = ((kg + (d == .increment ? 0.1 : -0.1)) * 10).rounded() / 10 }
        }
        .padding(.vertical, 16)
        .background(RoundedRectangle(cornerRadius: 28).fill(.white.opacity(0.05)))
    }
}

func hu1(_ v: Double) -> String {
    v.formatted(.number.precision(.fractionLength(1)).locale(Locale(identifier: "hu_HU")))
}
