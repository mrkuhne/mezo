import SwiftUI

// Throwaway spike (mezo-r36n9.3): the detail sheets behind Boop's tappable phrases.
// Sleep, resting pulse, the day — dark glass sheet with a painted band on top.
// Launch: -aura YES -auraVariant 3 -auraSheet sleep|heart|day

private let sheetBase = Color(hex: 0x0D1218)

/// Boop's brief as segments; a segment with a link is bold, dotted-underlined and opens a sheet.
struct AuraBrief: View {
    var segs: [Seg]
    var body: some View {
        Text(build())
            .font(AuraFont.serif(19)).lineSpacing(5).foregroundStyle(.white.opacity(0.75))
            .tint(.white)
    }
    private func build() -> AttributedString {
        var out = AttributedString()
        for s in segs {
            var a = AttributedString(s.text)
            if let l = s.link {
                a.link = URL(string: "boop://\(l)")
                a.foregroundColor = .white
                a.font = AuraFont.serif(19, .semibold)
                a.underlineStyle = Text.LineStyle(pattern: .dot, color: .white.opacity(0.5))
            }
            out += a
        }
        return out
    }
}

struct AuraDetailSheet: View {
    var kind: String
    @State private var motion = OrbMotion()
    private var sky: [Color] { PaintedLandscape.skies[kind == "sleep" ? 1 : kind == "heart" ? 4 : 2] }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .bottomLeading) {
                    Color.clear.frame(height: 170)
                        .overlay { PaintedLandscape(sky: sky) }
                        .clipped()
                        .overlay(LinearGradient(colors: [.clear, sheetBase], startPoint: .center, endPoint: .bottom))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(eyebrow).font(AuraFont.mono(12)).tracking(1.6).foregroundStyle(.white.opacity(0.75))
                        Text(title).font(AuraFont.serif(34)).foregroundStyle(.white)
                    }
                    .padding(.horizontal, 22).padding(.bottom, 8)
                }
                VStack(spacing: 12) {
                    switch kind {
                    case "sleep": sleep
                    case "heart": heart
                    default: day
                    }
                }
                .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 40)
            }
        }
        .scrollIndicators(.hidden)
        .background(sheetBase)
        .preferredColorScheme(.dark)
        .onDisappear { motion.stop() }
    }

    private var eyebrow: String { ["sleep": "ALVÁS · MA ÉJJEL", "heart": "NYUGALMI PULZUS", "day": "HÉTFŐ · A NAPOD"][kind] ?? "" }
    private var title: String { ["sleep": "7ó 12p alvás", "heart": "57 ütés / perc", "day": "Szoros, de belefér"][kind] ?? "" }

    // MARK: Sleep

    @ViewBuilder private var sleep: some View {
        HStack(spacing: 12) {
            tile("MÉLY", "1ó 36p", "+18 p a heti átlaghoz", up: true)
            tile("ELALVÁS", "22:48", "12 p-cel korábban", up: true)
        }
        VStack(alignment: .leading, spacing: 4) {
            AuraMono("SZAKASZOK")
            Hypnogram().frame(height: 110).padding(.top, 14)
            HStack { Text("22:48"); Spacer(); Text("2:00"); Spacer(); Text("4:00"); Spacer(); Text("6:53") }
                .font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.45)).padding(.top, 6)
            VStack(alignment: .leading, spacing: 9) {
                stage(Color(hex: 0xF4E9E2), "Ébren", "38p", "5%", 0.12)
                stage(Color(hex: 0x9ED4F5), "REM", "1ó 44p", "24%", 0.45)
                stage(Color(hex: 0x4BA8E6), "Könnyű", "3ó 52p", "54%", 0.9)
                stage(Color(hex: 0x2A6E96), "Mély", "1ó 36p", "22%", 0.4)
            }
            .padding(.top, 16)
        }
        .padding(20).auraGlass()
        VStack(alignment: .leading, spacing: 4) {
            AuraMono("MÉLYALVÁS · 7 NAP")
            WeekBars(values: [72, 81, 64, 90, 77, 84, 96], avg: 78, unit: "p", highlightLast: true).frame(height: 140).padding(.top, 12)
        }
        .padding(20).auraGlass()
        AuraBoopCard(text: "A mélyalvás hozza helyre a szombati edzés terhelését. Ma 96 perc volt, a héten a legtöbb: ezért mondtam, hogy bírod az esti edzést.", motion: motion)
    }

    // MARK: Heart

    @ViewBuilder private var heart: some View {
        HStack(spacing: 12) {
            tile("HETI ÁTLAG", "59", "−2 ma reggel", up: true)
            tile("HRV", "64 ms", "kiegyensúlyozott", up: true)
        }
        VStack(alignment: .leading, spacing: 4) {
            AuraMono("NYUGALMI PULZUS · 7 NAP")
            WeekBars(values: [61, 60, 62, 59, 58, 59, 57], avg: 59, unit: "", highlightLast: true, lowIsGood: true).frame(height: 140).padding(.top, 12)
        }
        .padding(20).auraGlass()
        VStack(alignment: .leading, spacing: 4) {
            AuraMono("ÉJSZAKA")
            GlowLine(points: [0.7, 0.62, 0.5, 0.42, 0.36, 0.3, 0.28, 0.3, 0.27, 0.32, 0.4, 0.5], color: .white, nowAt: nil)
                .frame(height: 100).padding(.top, 12)
            HStack { Text("22:48"); Spacer(); Text("2:00"); Spacer(); Text("4:00"); Spacer(); Text("6:53") }
                .font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.45)).padding(.top, 6)
        }
        .padding(20).auraGlass()
        AuraBoopCard(text: "Ha a nyugalmi pulzusod a heti átlag alá megy, a tested kipihente a terhelést. Két ütés kevesebb jó jel: ma jöhet a keményebb edzés.", motion: motion)
    }

    // MARK: Day

    @ViewBuilder private var day: some View {
        VStack(alignment: .leading, spacing: 4) {
            AuraMono("ENERGIA ÉS NAPTÁR")
            GlowLine(points: [0.35, 0.62, 0.82, 0.78, 0.6, 0.38, 0.5, 0.66, 0.55, 0.36, 0.2], color: .white, nowAt: 0.18)
                .frame(height: 120).padding(.top, 14)
            AuraBusyRibbon().frame(height: 14).padding(.top, 8)
            HStack { ForEach(["6", "9", "12", "15", "18", "21", "24"].indices, id: \.self) { i in if i > 0 { Spacer() }; Text(["6", "9", "12", "15", "18", "21", "24"][i]) } }
                .font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.45)).padding(.top, 6)
            Text("6 esemény · Google Naptár").font(.system(size: 12)).foregroundStyle(.white.opacity(0.5)).padding(.top, 8)
        }
        .padding(20).auraGlass()

        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                AuraGlyph("clock-ink", .white, size: 16)
                AuraMono("ÜTKÖZÉS · 17:30–18:00")
            }
            Text("A hívásod 17:30-kor ér véget, az edzés 18:00-kor kezdődik. Fél óra nem elég az átöltözésre és a bemelegítésre.")
                .font(.system(size: 15.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.85))
            HStack(spacing: 10) {
                Text("Áttolom 18:30-ra").font(.system(size: 14.5, weight: .semibold)).foregroundStyle(sheetBase)
                    .padding(.horizontal, 16).padding(.vertical, 11).background(Capsule().fill(.white))
                Text("Marad így").font(.system(size: 14.5, weight: .semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 11).background(Capsule().fill(.white.opacity(0.1)))
            }
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).auraGlass()

        AuraBoopCard(text: "Délután 3 körül jön egy mélypont: oda tegyél egy rövid sétát, ne egy újabb kávét. Este 22:45-re feküdj le, hogy holnap is ilyen formában ébredj.", motion: motion)
    }

    /// Legend row: the stage's colour as a bar as long as its share, name, time, percent.
    private func stage(_ c: Color, _ n: String, _ t: String, _ pct: String, _ f: CGFloat) -> some View {
        HStack(spacing: 10) {
            Capsule().fill(c).frame(width: 14 + 80 * f, height: 7).frame(width: 96, alignment: .leading)
            Text(n).font(.system(size: 15)).foregroundStyle(.white)
            Text(t).font(.system(size: 15)).foregroundStyle(.white.opacity(0.75))
            Spacer()
            Text(pct).font(AuraFont.mono(12)).foregroundStyle(.white.opacity(0.6))
        }
    }

    private func tile(_ l: String, _ v: String, _ note: String, up: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            AuraMono(l)
            Text(v).font(.custom("Outfit", size: 28).weight(.light)).foregroundStyle(.white)
            HStack(spacing: 5) { Trend(up: up, size: 8); Text(note).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.75)) }
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).auraGlass(22)
    }
}

/// Seven days as soft white bars, the average as a dashed waterline, today lit.
struct WeekBars: View {
    var values: [Double]
    var avg: Double
    var unit: String
    var highlightLast = true
    var lowIsGood = false
    private let days = ["K", "Sze", "Cs", "P", "Szo", "V", "H"]
    var body: some View {
        GeometryReader { g in
            let lo = (values.min() ?? 0) * 0.85, hi = (values.max() ?? 1) * 1.04
            let H = g.size.height - 22
            let y: (Double) -> CGFloat = { H * (1 - ($0 - lo) / (hi - lo)) }
            ZStack(alignment: .topLeading) {
                HStack(alignment: .bottom, spacing: 0) {
                    ForEach(values.indices, id: \.self) { i in
                        let last = i == values.count - 1
                        VStack(spacing: 6) {
                            Spacer(minLength: 0)
                            if last { Text("\(Int(values[i]))\(unit)").font(AuraFont.mono(11, .bold)).foregroundStyle(.white) }
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(.white.opacity(last && highlightLast ? 0.95 : 0.28))
                                .frame(width: 22, height: max(6, H - y(values[i])))
                            Text(days[i]).font(.system(size: 11, weight: last ? .semibold : .regular)).foregroundStyle(.white.opacity(last ? 1 : 0.5))
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                Path { p in p.move(to: CGPoint(x: 0, y: y(avg))); p.addLine(to: CGPoint(x: g.size.width, y: y(avg))) }
                    .stroke(.white.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                Text("átlag \(Int(avg))\(unit)").font(AuraFont.mono(10)).foregroundStyle(.white.opacity(0.7)).offset(y: y(avg) - 16)
            }
        }
    }
}

/// Meetings melted into 15-minute slots: brighter = busier.
struct AuraBusyRibbon: View {
    var body: some View {
        Canvas { ctx, s in
            let slots = 72   // 06:00–24:00
            let w = s.width / CGFloat(slots)
            for k in 0..<slots {
                let h = 6.0 + Double(k) / 4
                let busy: Double = (9.0..<12.0).contains(h) ? 0.6 : (13.0..<17.5).contains(h) ? (h > 15 && h < 16 ? 0.9 : 0.55) : 0
                guard busy > 0 else { continue }
                ctx.fill(Path(roundedRect: CGRect(x: CGFloat(k) * w + 0.5, y: 0, width: w - 1, height: s.height), cornerRadius: 2),
                         with: .color(.white.opacity(busy * 0.7)))
            }
            let tx = s.width * (18.0 - 6) / 18
            ctx.fill(Path(roundedRect: CGRect(x: tx, y: -2, width: w * 4, height: s.height + 4), cornerRadius: 3),
                     with: .color(Color(hex: 0xF7C27A)))
        }
    }
}
