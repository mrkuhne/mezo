import SwiftUI
import Charts

/// B — Oura-ish: light, airy, three small orbs as the day's scores, calm white cards.
struct VariantAiry: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(Demo.dateLine).font(.subheadline).foregroundStyle(Boop.mute)
                    Text(Demo.greeting).font(.system(size: 34, weight: .semibold, design: .serif)).foregroundStyle(Boop.ink)
                }
                .padding(.top, 64)

                // Three score orbs
                HStack(spacing: 0) {
                    scoreOrb(84, "Alvás", [Boop.violet, Boop.indigo, Boop.sky])
                    scoreOrb(Demo.readiness, "Készenlét", [Boop.mint, Boop.sky, Boop.sun])
                    scoreOrb(12, "Mozgás", [Boop.peach, Boop.sun, Boop.mint])
                }

                // Companion verdict
                card {
                    HStack(alignment: .top, spacing: 12) {
                        Orb(colors: [Boop.indigo, Boop.violet, Boop.mint], size: 34, level: 0.65, glow: false)
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Boop szerint").font(.caption.weight(.semibold)).foregroundStyle(Boop.mute)
                            Text(Demo.verdict).font(.callout).foregroundStyle(Boop.ink)
                            HStack {
                                Button("Told 18:30-ra") { }.buttonStyle(.borderedProminent).tint(Boop.indigo)
                                Button("Maradjon") { }.buttonStyle(.bordered).tint(Boop.mute)
                            }
                            .font(.subheadline.weight(.semibold)).padding(.top, 4)
                        }
                    }
                }

                // Sleep stages
                card {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(alignment: .firstTextBaseline) {
                            Text("Alvás").font(.headline)
                            Spacer()
                            Text(Demo.sleepTotal).font(.system(.title3, design: .rounded).weight(.semibold))
                        }
                        Chart(Demo.stages) { s in
                            BarMark(x: .value("Perc", s.minutes), stacking: .normalized)
                                .foregroundStyle(s.color)
                                .clipShape(Capsule())
                        }
                        .chartXAxis(.hidden)
                        .frame(height: 18)
                        LazyVGrid(columns: [GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading)], spacing: 8) {
                            ForEach(Demo.stages) { s in
                                HStack(spacing: 6) {
                                    Circle().fill(s.color).frame(width: 8, height: 8)
                                    Text(s.name).font(.caption).foregroundStyle(Boop.mute)
                                    Text("\(s.minutes / 60)ó \(s.minutes % 60)p").font(.caption.weight(.semibold)).foregroundStyle(Boop.ink)
                                }
                            }
                        }
                        Divider()
                        HStack {
                            Label("Nyugalmi pulzus \(Demo.restingHR)", systemImage: "heart")
                            Spacer()
                            Text(Demo.hrDelta).foregroundStyle(Boop.mint)
                        }
                        .font(.subheadline)
                    }
                }

                // Today's fuel + move as filling levels
                card {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Mai keret").font(.headline)
                        HStack(alignment: .bottom) {
                            FillCapsule(value: 0.0, color: Boop.sun, label: "kcal", amount: "0 / \(Demo.kcalTarget)", height: 90)
                            Spacer()
                            FillCapsule(value: 0.0, color: Boop.peach, label: "fehérje", amount: "0 / \(Demo.proteinTarget) g", height: 90)
                            Spacer()
                            FillCapsule(value: 0.12, color: Boop.mint, label: "mozgás", amount: "75 / \(Demo.moveKcal)", height: 90)
                            Spacer()
                            FillCapsule(value: 0.62, color: Boop.sky, label: "súlycél", amount: "\(String(format: "%.1f", Demo.weight)) kg", height: 90)
                        }
                    }
                }

                card {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Hogy érzed magad?").font(.headline)
                        CheckinChips()
                    }
                }
                .padding(.bottom, 40)
            }
            .padding(.horizontal, 20)
        }
        .scrollIndicators(.hidden)
        .background(Boop.paper.ignoresSafeArea())
        .preferredColorScheme(.light)
    }

    private func scoreOrb(_ v: Int, _ label: String, _ colors: [Color]) -> some View {
        VStack(spacing: 8) {
            ZStack {
                Orb(colors: colors, size: 92, level: Double(v) / 100, glow: false)
                Text("\(v)").font(.system(.title2, design: .rounded).weight(.semibold)).foregroundStyle(.white)
            }
            Text(label).font(.footnote.weight(.medium)).foregroundStyle(Boop.mute)
        }
        .frame(maxWidth: .infinity)
    }

    private func card<C: View>(@ViewBuilder _ c: () -> C) -> some View {
        c().padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 26).fill(.white))
            .shadow(color: .black.opacity(0.05), radius: 18, y: 8)
    }
}
