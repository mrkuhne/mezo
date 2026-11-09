import SwiftUI
import Charts

/// A — the living-orb morning: one breathing glass orb that is Boop, Boop's typed voice,
/// the day as an energy curve, then the levels and the check-in.
struct VariantOrb: View {
    @State private var mood: Mood = Mood(rawValue: UserDefaults.standard.integer(forKey: "mood")) ?? .good
    @State private var motion = OrbMotion()
    @State private var typer = Typer()
    @State private var count = 0
    @State private var sheet: String?
    @State private var crowded = UserDefaults.standard.bool(forKey: "crowded")
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ScrollView {
            VStack(spacing: 26) {
                VStack(spacing: 4) {
                    Text(Demo.dateLine).font(.subheadline).foregroundStyle(.white.opacity(0.6))
                    Text(Demo.greeting).font(.system(.title2, design: .rounded).weight(.semibold)).foregroundStyle(.white)
                }
                .padding(.top, 64)
                .entrance(0.0)

                ZStack {
                    LivingOrb(mood: mood, size: 270, motion: motion)
                    VStack(spacing: 2) {
                        Text("\(count)")
                            .font(.system(size: 76, weight: .semibold, design: .rounded))
                            .contentTransition(.numericText(value: Double(count)))
                        Text("KÉSZENLÉT").font(.caption.weight(.semibold)).tracking(2).opacity(0.85)
                    }
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.35), radius: 10, y: 3)
                    .allowsHitTesting(false)
                }
                .entrance(0.15)
                Text("Döntsd meg a telefont, vagy érintsd meg az orbot")
                    .font(.caption2).foregroundStyle(.white.opacity(0.35))
                    .entrance(0.3)

                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 8) {
                        Circle().fill(mood.colors[2]).frame(width: 8, height: 8)
                            .opacity(typer.shown < typer.total ? 1 : 0.5)
                            .scaleEffect(typer.shown < typer.total ? 1.3 : 1)
                            .animation(.easeInOut(duration: 0.5).repeatForever(), value: typer.shown < typer.total)
                        Text("BOOP").font(.caption.weight(.bold)).tracking(2).foregroundStyle(mood.colors[2])
                        Spacer()
                        Button { typer.voiceOn.toggle() } label: {
                            Image(systemName: typer.voiceOn ? "speaker.wave.2.fill" : "speaker.slash.fill")
                                .font(.caption.weight(.semibold))
                                .frame(width: 30, height: 18)
                                .padding(.vertical, 6)
                                .contentTransition(.symbolEffect(.replace))
                        }
                        .buttonStyle(.glass)
                        .accessibilityLabel(typer.voiceOn ? "Felolvasás kikapcsolása" : "Felolvasás bekapcsolása")
                        Button { speak() } label: {
                            Label("Mondd újra", systemImage: "arrow.counterclockwise")
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 10).padding(.vertical, 6)
                        }
                        .buttonStyle(.glass)
                        .opacity(typer.shown >= typer.total ? 1 : 0.35)
                        .disabled(typer.shown < typer.total)
                    }
                    Text(mood.headline)
                        .font(.system(size: 30, weight: .semibold, design: .serif))
                        .foregroundStyle(.white)
                    BoopVoice(segs: mood.verdict, shown: typer.shown)
                        .environment(\.openURL, OpenURLAction { url in
                            sheet = url.host()
                            return .handled
                        })
                    Button { } label: {
                        Label(mood == .tired ? "Edzés cseréje sétára" : "Edzés áttétele 18:30-ra",
                              systemImage: "arrow.right.circle.fill")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 16).padding(.vertical, 11)
                    }
                    .buttonStyle(.glassProminent)
                    .tint(mood.colors[0])
                    .padding(.top, 4)
                    .opacity(typer.shown >= typer.total ? 1 : 0)
                    .animation(.easeOut(duration: 0.4), value: typer.shown >= typer.total)
                }
                .padding(.horizontal, 6)
                .entrance(0.45)

                EnergyCurve(mood: mood, plan: crowded ? .ceo : .normal).entrance(0.6)

                HStack(alignment: .bottom, spacing: 30) {
                    FillCapsule(value: 0.84, color: Boop.violet, label: "Alvás", amount: Demo.sleepTotal,
                                track: .white.opacity(0.08), text: .white)
                    FillCapsule(value: 0.0, color: Boop.sun, label: "Étel · 0/\(Demo.kcalTarget)", amount: "\(Demo.kcalTarget) kcal",
                                track: .white.opacity(0.08), text: .white)
                    FillCapsule(value: 0.12, color: Boop.mint, label: "Mozgás", amount: "\(Demo.moveKcal) kcal",
                                track: .white.opacity(0.08), text: .white)
                }
                .padding(.vertical, 22).frame(maxWidth: .infinity)
                .background(RoundedRectangle(cornerRadius: 28).fill(.white.opacity(0.05)))
                .overlay(RoundedRectangle(cornerRadius: 28).stroke(.white.opacity(0.08)))
                .entrance(0.75)

                VStack(spacing: 12) {
                    SectionHead(title: "Hogy érzed magad?", color: .white.opacity(0.5))
                    CheckinChips(dark: true)
                }
                .entrance(0.85)

                // Demo-only control: see how the whole page reacts to the day's state.
                VStack(spacing: 10) {
                    SectionHead(title: "Demó · milyen a napod", color: .white.opacity(0.3))
                    Picker("Állapot", selection: $mood) {
                        ForEach(Mood.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    Toggle(isOn: $crowded.animation(.easeInOut)) {
                        Label("Zsúfolt nap (CEO, 20 esemény)", systemImage: "calendar.badge.exclamationmark")
                            .font(.subheadline).foregroundStyle(.white.opacity(0.8))
                    }
                    .tint(Boop.indigo)
                    .padding(.top, 4)
                }
                .padding(.bottom, 44)
            }
            .padding(.horizontal, 18)
        }
        .scrollIndicators(.hidden)
        .background(
            LinearGradient(colors: [mood.sky, Boop.night, Boop.night], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
                .animation(.easeInOut(duration: 1.2), value: mood)
        )
        .preferredColorScheme(.dark)
        .onAppear { speak() }
        .onChange(of: mood) { speak() }
        .onDisappear { motion.stop() }
        .sheet(item: Binding(get: { sheet.map(SheetID.init) }, set: { sheet = $0?.id })) { s in
            DetailSheet(kind: s.id, mood: mood)
                .presentationDetents([.medium])
                .presentationBackground(.ultraThinMaterial)
        }
        .sensoryFeedback(.success, trigger: typer.shown >= typer.total && typer.total > 0)
    }

    private func speak() {
        count = 0
        withAnimation(.easeOut(duration: 1.4)) { count = mood.readiness }
        typer.run(mood.verdict, motion: motion, instant: reduceMotion)
    }
}

private struct SheetID: Identifiable { let id: String }

/// What opens behind an emphasised phrase.
struct DetailSheet: View {
    var kind: String
    var mood: Mood

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            switch kind {
            case "sleep":
                Text("Az éjszakád").font(.system(.title2, design: .serif).weight(.semibold))
                Chart(Demo.stages) { s in
                    BarMark(x: .value("Perc", s.minutes), stacking: .normalized)
                        .foregroundStyle(s.color).clipShape(Capsule())
                }
                .chartXAxis(.hidden).frame(height: 22)
                ForEach(Demo.stages) { s in
                    HStack {
                        Circle().fill(s.color).frame(width: 10, height: 10)
                        Text(s.name)
                        Spacer()
                        Text("\(s.minutes / 60)ó \(s.minutes % 60)p").font(.body.monospacedDigit().weight(.semibold))
                    }
                }
                Text("Forrás: Sleep Cycle, az Apple Egészségen át").font(.caption).foregroundStyle(.secondary)
            case "heart":
                Text("Nyugalmi pulzus").font(.system(.title2, design: .serif).weight(.semibold))
                let vals: [(String, Int)] = [("K", 59), ("Sze", 60), ("Cs", 58), ("P", 59), ("Szo", 61), ("V", 59), ("H", 57)]
                Chart(vals, id: \.0) { d in
                    LineMark(x: .value("Nap", d.0), y: .value("bpm", d.1))
                        .interpolationMethod(.catmullRom).foregroundStyle(Boop.mint)
                    PointMark(x: .value("Nap", d.0), y: .value("bpm", d.1)).foregroundStyle(Boop.mint)
                }
                .chartYScale(domain: 54...64).frame(height: 150)
                Text("Forrás: Huawei óra, az Apple Egészségen át").font(.caption).foregroundStyle(.secondary)
            default:
                Text("A mai napod").font(.system(.title2, design: .serif).weight(.semibold))
                ForEach(Demo.events) { e in
                    HStack(spacing: 12) {
                        Text(e.time).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary).frame(width: 50, alignment: .leading)
                        Image(systemName: e.kind.icon).foregroundStyle(e.kind.tint).frame(width: 22)
                        Text(e.title).font(.subheadline)
                    }
                }
            }
            Spacer()
        }
        .padding(24)
    }
}

// MARK: - Choreographed entrance

private struct Entrance: ViewModifier {
    let delay: Double
    @State private var on = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func body(content: Content) -> some View {
        content
            .opacity(on ? 1 : 0)
            .offset(y: on || reduceMotion ? 0 : 26)
            .blur(radius: on || reduceMotion ? 0 : 8)
            .onAppear {
                withAnimation(.spring(response: 0.9, dampingFraction: 0.86).delay(reduceMotion ? 0 : delay)) { on = true }
            }
    }
}

extension View {
    func entrance(_ delay: Double) -> some View { modifier(Entrance(delay: delay)) }
}
