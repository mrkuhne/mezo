import SwiftUI
import Charts

/// First meal: photo or a few words → Boop looks → editable draft → verdict on the food and on
/// the food inside today's and this week's plan.
struct MealFlow: View {
    var mood: Mood
    var onDone: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    enum Stage: Int { case capture, looking, draft, verdict }
    @State private var stage = Stage(rawValue: UserDefaults.standard.integer(forKey: "mealStage")) ?? .capture
    @State private var text = ""

    struct Item: Identifiable {
        let id = UUID(); let name: String; var grams: Double; let kcal100, p100, c100, f100: Double
        var kcal: Double { grams * kcal100 / 100 }
        var p: Double { grams * p100 / 100 }; var c: Double { grams * c100 / 100 }; var f: Double { grams * f100 / 100 }
    }
    @State private var items: [Item] = [
        .init(name: "Zabpehely", grams: 60, kcal100: 375, p100: 13, c100: 60, f100: 7),
        .init(name: "Görög joghurt 2%", grams: 150, kcal100: 73, p100: 10, c100: 4, f100: 2),
        .init(name: "Áfonya", grams: 80, kcal100: 57, p100: 0.7, c100: 14, f100: 0.3),
        .init(name: "Méz", grams: 15, kcal100: 304, p100: 0.3, c100: 82, f100: 0),
        .init(name: "Dió", grams: 15, kcal100: 654, p100: 15, c100: 14, f100: 65),
    ]
    private var total: (k: Double, p: Double, c: Double, f: Double) {
        items.reduce((0, 0, 0, 0)) { ($0.0 + $1.kcal, $0.1 + $1.p, $0.2 + $1.c, $0.3 + $1.f) }
    }

    var body: some View {
        FlowScaffold(eyebrow: "Reggeli · 07:35", title: title, mood: mood) {
            VStack(alignment: .leading, spacing: 18) {
                switch stage {
                case .capture: capture
                case .looking: looking
                case .draft: draft
                case .verdict: verdict
                }
            }
            .animation(.spring(response: 0.5, dampingFraction: 0.86), value: stage)
        }
        .sensoryFeedback(.success, trigger: stage == .verdict)
    }

    private var title: String {
        switch stage {
        case .capture: "Mit eszel?"
        case .looking: "Megnézem…"
        case .draft: "Zabkása bogyókkal"
        case .verdict: "Remek edzés előtti üzemanyag"
        }
    }

    private var capture: some View {
        VStack(spacing: 14) {
            Button { go(.looking) } label: {
                VStack(spacing: 14) {
                    Image(systemName: "camera.fill").font(.system(size: 34))
                    Text("Lefotózom").font(.headline)
                    Text("A tányérról megmondom, mi van rajta").font(.caption).foregroundStyle(.white.opacity(0.5))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity).frame(height: 210)
                .background(RoundedRectangle(cornerRadius: 28).fill(LinearGradient(colors: [mood.colors[0].opacity(0.5), mood.colors[1].opacity(0.25)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                .overlay(RoundedRectangle(cornerRadius: 28).stroke(.white.opacity(0.15)))
            }
            .buttonStyle(.plain)
            HStack(spacing: 10) {
                TextField("", text: $text, prompt: Text("…vagy írd le: zabkása joghurttal, áfonya, kis méz").foregroundStyle(.white.opacity(0.35)), axis: .vertical)
                    .lineLimit(1...3).foregroundStyle(.white)
                    .padding(14)
                    .background(RoundedRectangle(cornerRadius: 18).fill(.white.opacity(0.06)))
                Button { go(.looking) } label: { Image(systemName: "arrow.up").font(.headline).frame(width: 30, height: 30) }
                    .buttonStyle(.glassProminent).tint(mood.colors[0])
            }
            HStack(spacing: 8) {
                ForEach(["Ugyanaz, mint tegnap", "Kedvencek", "Recept"], id: \.self) { s in
                    Text(s).font(.caption.weight(.semibold)).padding(.horizontal, 12).padding(.vertical, 8)
                        .background(Capsule().fill(.white.opacity(0.07))).foregroundStyle(.white.opacity(0.75))
                }
            }
        }
    }

    private var looking: some View {
        VStack(spacing: 22) {
            ZStack {
                PlateIllustration().frame(width: 240, height: 240)
                    .overlay(Circle().stroke(mood.colors[2].opacity(0.6), lineWidth: 2).scaleEffect(1.04))
                ScanSweep(color: mood.colors[2]).frame(width: 240, height: 240).clipShape(Circle())
            }
            .frame(maxWidth: .infinity)
            Text("Felismerem az ételeket és megbecsülöm a mennyiségeket…")
                .font(.system(.callout, design: .serif)).foregroundStyle(.white.opacity(0.7))
                .frame(maxWidth: .infinity)
            VStack(spacing: 10) { ForEach(0..<3) { _ in RoundedRectangle(cornerRadius: 12).fill(.white.opacity(0.06)).frame(height: 44) } }
        }
        .task {
            try? await Task.sleep(for: .seconds(2.4))
            go(.draft)
        }
    }

    private var draft: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 14) {
                PlateIllustration().frame(width: 74, height: 74)
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(Int(total.k)) kcal").font(.system(.title, design: .rounded).weight(.semibold)).foregroundStyle(.white)
                        .contentTransition(.numericText(value: total.k))
                    Text("F \(Int(total.p)) g · Sz \(Int(total.c)) g · Zs \(Int(total.f)) g").font(.subheadline).foregroundStyle(.white.opacity(0.6))
                    Label("86%-ban biztos vagyok", systemImage: "checkmark.seal").font(.caption.weight(.semibold)).foregroundStyle(Boop.mint)
                }
            }
            Card {
                VStack(spacing: 0) {
                    ForEach($items) { $it in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(it.name).font(.body).foregroundStyle(.white)
                                Text("\(Int(it.kcal)) kcal · F \(String(format: "%.0f", it.p)) g").font(.caption).foregroundStyle(.white.opacity(0.45))
                            }
                            Spacer()
                            Stepper(value: $it.grams, in: 0...500, step: 10) {
                                Text("\(Int(it.grams)) g").font(.body.monospacedDigit().weight(.semibold)).foregroundStyle(.white)
                            }
                            .fixedSize()
                        }
                        .padding(.vertical, 10)
                        if it.id != items.last?.id { Divider().overlay(.white.opacity(0.08)) }
                    }
                }
            }
            .sensoryFeedback(.selection, trigger: total.k)
            Text("Állíts a mennyiségeken, ha nem stimmel. Ebből tanulok.").font(.footnote).foregroundStyle(.white.opacity(0.4))
            PrimaryButton(title: "Rögzítem reggelinek", icon: "checkmark", tint: mood.colors[0]) { go(.verdict) }
        }
    }

    @ViewBuilder private var verdict: some View {
        HStack(alignment: .center, spacing: 16) {
            ScoreVial(score: 0.78, color: Boop.mint)
            VStack(alignment: .leading, spacing: 4) {
                Text("0,78 · jó választás").font(.headline).foregroundStyle(.white)
                Text("lassú szénhidrát, rost, kevés hozzáadott cukor").font(.subheadline).foregroundStyle(.white.opacity(0.6))
            }
        }
        BoopSays(segs: [
            .init("Lassan felszívódó szénhidrát és rost: ez kitart a délelőtti workshopon. A fehérje csak 25 g, ez "),
            .init("kevés a 165 g-os napi célodhoz", "protein"),
            .init(". Ma este Push nap van, ezért az ebédnél legyen legalább 45 g. A mézből elég lett volna a fele."),
        ], mood: mood)
        SectionHead(title: "Ha legközelebb javítanál", color: .white.opacity(0.5))
        HStack(spacing: 8) {
            chip("+20 g fehérje", "bolt.fill", Boop.mint)
            chip("fele annyi méz", "drop.fill", Boop.sun)
        }
        Card {
            VStack(alignment: .leading, spacing: 14) {
                Text("A napod most").font(.headline).foregroundStyle(.white)
                HStack(alignment: .bottom) {
                    FillCapsule(value: total.k / 2350, color: Boop.sun, label: "kcal", amount: "\(Int(total.k)) / 2350", height: 90, track: .white.opacity(0.08), text: .white)
                    Spacer()
                    FillCapsule(value: total.p / 165, color: Boop.peach, label: "fehérje", amount: "\(Int(total.p)) / 165 g", height: 90, track: .white.opacity(0.08), text: .white)
                    Spacer()
                    FillCapsule(value: 75.0 / 620, color: Boop.mint, label: "mozgás", amount: "75 / 620", height: 90, track: .white.opacity(0.08), text: .white)
                }
                Divider().overlay(.white.opacity(0.08))
                Text("A heted").font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.8))
                let week: [(String, Double)] = [("K", 2280), ("Sze", 2510), ("Cs", 2190), ("P", 2400), ("Szo", 2780), ("V", 2300), ("H", total.k)]
                Chart {
                    ForEach(week, id: \.0) { d in
                        BarMark(x: .value("Nap", d.0), y: .value("kcal", d.1))
                            .foregroundStyle(d.0 == "H" ? Boop.sun : .white.opacity(0.25))
                            .clipShape(RoundedRectangle(cornerRadius: 5))
                    }
                    RuleMark(y: .value("Cél", 2350)).foregroundStyle(Boop.mint.opacity(0.7)).lineStyle(.init(lineWidth: 1.5, dash: [5, 4]))
                }
                .chartYAxis(.hidden)
                .chartXAxis { AxisMarks { _ in AxisValueLabel().foregroundStyle(.white.opacity(0.5)) } }
                .frame(height: 110)
                Text("A hét átlaga 2 410 kcal, 60-nal a cél felett: a szombati vacsora miatt. Ma nincs mit pótolni.")
                    .font(.system(.footnote, design: .serif)).foregroundStyle(.white.opacity(0.6))
            }
        }
        PrimaryButton(title: "Kész", icon: "checkmark", tint: mood.colors[0]) {
            onDone("Zabkása · \(Int(total.k)) kcal · 0,78")
            dismiss()
        }
    }

    private func chip(_ t: String, _ icon: String, _ c: Color) -> some View {
        Label(t, systemImage: icon).font(.caption.weight(.semibold))
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(Capsule().fill(c.opacity(0.16))).foregroundStyle(c)
    }

    private func go(_ s: Stage) { withAnimation(.spring(response: 0.5, dampingFraction: 0.86)) { stage = s } }
}

/// A small vial filled to the meal score (0–1).
struct ScoreVial: View {
    var score: Double
    var color: Color
    @State private var shown = false
    var body: some View {
        ZStack(alignment: .bottom) {
            Capsule().fill(.white.opacity(0.08))
            Capsule().fill(LinearGradient(colors: [color.opacity(0.7), color], startPoint: .top, endPoint: .bottom))
                .frame(height: shown ? 96 * score : 0)
        }
        .frame(width: 40, height: 96)
        .clipShape(Capsule())
        .onAppear { withAnimation(.spring(response: 1.0, dampingFraction: 0.75).delay(0.2)) { shown = true } }
    }
}

/// A drawn breakfast bowl so the spike needs no photo asset.
struct PlateIllustration: View {
    var body: some View {
        Canvas { ctx, size in
            let r = min(size.width, size.height) / 2
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r)), with: .color(Color(white: 0.92)))
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - r * 0.8, y: c.y - r * 0.8, width: 1.6 * r, height: 1.6 * r)), with: .color(Color(red: 0.86, green: 0.76, blue: 0.6)))
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - r * 0.45, y: c.y - r * 0.5, width: 0.9 * r, height: 0.7 * r)), with: .color(Color(white: 0.97)))
            let berries: [(Double, Double)] = [(-0.5, 0.2), (-0.35, 0.4), (-0.15, 0.5), (0.1, 0.45), (0.35, 0.35), (0.5, 0.15), (-0.55, -0.05), (0.2, 0.25)]
            for (bx, by) in berries {
                let p = CGPoint(x: c.x + r * bx, y: c.y + r * by)
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - r * 0.08, y: p.y - r * 0.08, width: r * 0.16, height: r * 0.16)), with: .color(Color(red: 0.28, green: 0.3, blue: 0.62)))
            }
            let nuts: [(Double, Double)] = [(0.35, -0.35), (0.5, -0.15), (0.15, -0.55)]
            for (nx, ny) in nuts {
                let p = CGPoint(x: c.x + r * nx, y: c.y + r * ny)
                ctx.fill(Path(roundedRect: CGRect(x: p.x - r * 0.1, y: p.y - r * 0.07, width: r * 0.2, height: r * 0.14), cornerRadius: r * 0.05), with: .color(Color(red: 0.6, green: 0.42, blue: 0.25)))
            }
            var honey = Path()
            honey.move(to: CGPoint(x: c.x - r * 0.3, y: c.y - r * 0.1))
            honey.addCurve(to: CGPoint(x: c.x + r * 0.3, y: c.y - r * 0.05), control1: CGPoint(x: c.x - r * 0.1, y: c.y - r * 0.35), control2: CGPoint(x: c.x + r * 0.1, y: c.y + r * 0.2))
            ctx.stroke(honey, with: .color(Color(red: 0.95, green: 0.72, blue: 0.25)), lineWidth: r * 0.05)
        }
        .clipShape(Circle())
        .shadow(color: .black.opacity(0.4), radius: 12, y: 6)
    }
}

/// A light band sweeping across the photo while Boop "looks".
struct ScanSweep: View {
    var color: Color
    var body: some View {
        TimelineView(.animation) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            GeometryReader { g in
                let y = (sin(t * 2.2) * 0.5 + 0.5) * g.size.height
                LinearGradient(colors: [.clear, color.opacity(0.55), .clear], startPoint: .top, endPoint: .bottom)
                    .frame(height: 70).offset(y: y - 35)
                    .blendMode(.plusLighter)
            }
        }
    }
}
