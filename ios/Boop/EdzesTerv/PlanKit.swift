import SwiftUI
import BoopCore
import BoopDesign

// Shared pieces of the block builder and the weekly review (mezo-r36n9.83), ported from the approved simulator spike
// (`spike/boop-blokk-epito`, rounds 1–7): the feature's own drawn marks, pills, the set stepper, the half dial, the
// sky behind a full-screen page. No emoji, no system symbols except the chevrons and the arrow.

let planHue = Hue.mozgas
let planWarn = Color(hex: 0xF2C94C)
let planGood = Color(hex: 0x9FD8A8)

/// The muscle the way he says it.
func planMuscleName(_ key: String) -> String {
    switch key {
    case "back": "Hát"
    case "biceps": "Bicepsz"
    case "shoulder": "Váll"
    case "chest": "Mellkas"
    case "triceps": "Tricepsz"
    case "quad": "Comb eleje"
    case "ham": "Comb hátulja"
    case "glute": "Fenék"
    case "calf": "Vádli"
    case "core": "Törzs"
    case "traps": "Csuklyás"
    default: "Egyéb"
    }
}

/// The sky of the Edzés area behind a full-screen page, fading into the ground.
struct PlanSky: View {
    var height: CGFloat = 420
    var body: some View {
        VStack(spacing: 0) {
            LinearGradient(colors: planHue.sky.map { $0.opacity(0.75) } + [NK.ground], startPoint: .top, endPoint: .bottom)
                .frame(height: height)
            NK.ground
        }
        .ignoresSafeArea()
    }
}

/// The round close button of a full-screen page.
struct PlanCloseButton: View {
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: "chevron.down").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                .frame(width: 40, height: 40).background(Circle().fill(.white.opacity(0.14)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Bezárás")
    }
}

struct PlanPill: View {
    let text: String
    var mono = false
    var color: Color = .white.opacity(0.78)
    var mark: PlanMark.Kind? = nil
    init(_ text: String, mono: Bool = false, color: Color = .white.opacity(0.78), mark: PlanMark.Kind? = nil) {
        self.text = text; self.mono = mono; self.color = color; self.mark = mark
    }

    var body: some View {
        HStack(spacing: 5) {
            if let mark { PlanMark(mark, color: color, size: mono ? 11 : 13) }
            Text(text)
                .nkFont(mono ? 9 : 12, mono ? .semibold : .medium, design: mono ? .monospaced : .default)
                .tracking(mono ? 1 : 0)
                .foregroundStyle(color)
                .lineLimit(1).fixedSize()
        }
        .padding(.horizontal, mono ? 8 : 10).padding(.vertical, mono ? 4 : 5)
        .background(Capsule().fill(.white.opacity(0.09)))
    }
}

struct PlanTierPill: View {
    let tier: MuscleTier
    var body: some View {
        Text(tier.hungarian.uppercased())
            .nkFont(9, .semibold, design: .monospaced).tracking(1)
            .foregroundStyle(planTierColor(tier))
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(Capsule().fill(planTierColor(tier).opacity(0.16)))
    }
}

func planTierColor(_ tier: MuscleTier) -> Color {
    switch tier {
    case .emphasize: planHue.glow
    case .grow: planGood
    case .maintain: .white.opacity(0.6)
    }
}

struct PlanSetStepper: View {
    let value: Int
    let name: String
    let down: () -> Void
    let up: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            round("−", "Egy sorozattal kevesebb", down)
            Text("\(value)").nkFont(21, .medium).foregroundStyle(.white)
                .frame(minWidth: 24).contentTransition(.numericText())
            round("+", "Egy sorozattal több", up)
        }
        .sensoryFeedback(.impact(weight: .light), trigger: value)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(name), \(value) sorozat")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: up()
            case .decrement: down()
            @unknown default: break
            }
        }
    }

    private func round(_ symbol: String, _ label: String, _ action: @escaping () -> Void) -> some View {
        Button { withAnimation(.snappy) { action() } } label: {
            Text(symbol).nkFont(19, .medium).foregroundStyle(.white.opacity(0.9))
                .frame(width: 38, height: 38)
                .background(Circle().fill(.white.opacity(0.11)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// A half dial: the whole scale as the track, the tier's band lit on it, his number as the bead.
struct PlanArcGauge: View {
    let value: Int
    let band: WireBand
    let inside: Bool

    var body: some View {
        let top = Double(max(band.limit, value) + 2)
        GeometryReader { geo in
            let radius = min(geo.size.width / 2 - 14, geo.size.height - 14)
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height - 4)
            ZStack {
                PlanArc(from: 0, to: 1, radius: radius, center: center)
                    .stroke(.white.opacity(0.09), style: StrokeStyle(lineWidth: 12, lineCap: .round))
                PlanArc(from: Double(band.low) / top, to: Double(band.high) / top, radius: radius, center: center)
                    .stroke(LinearGradient(colors: [planHue.glow.opacity(0.55), planHue.glow], startPoint: .leading, endPoint: .trailing),
                            style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .shadow(color: planHue.glow.opacity(0.45), radius: 8)
                Text("\(band.low)").nkFont(10, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.55))
                    .position(point(Double(band.low) / top, radius + 20, center))
                Text("\(band.high)").nkFont(10, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.55))
                    .position(point(Double(band.high) / top, radius + 20, center))
                Circle().fill(inside ? Color.white : planWarn)
                    .frame(width: 20, height: 20)
                    .overlay(Circle().stroke(NK.ground.opacity(0.6), lineWidth: 3))
                    .shadow(color: (inside ? Color.white : planWarn).opacity(0.6), radius: 7)
                    .position(point(Double(value) / top, radius, center))
            }
        }
        .animation(.snappy(duration: 0.45), value: value)
        .animation(.snappy(duration: 0.45), value: band)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Heti \(value) sorozat, a sáv \(band.low)–\(band.high)")
    }

    private func point(_ fraction: Double, _ radius: CGFloat, _ center: CGPoint) -> CGPoint {
        let angle = Double.pi + Double.pi * max(0, min(1, fraction))
        return CGPoint(x: center.x + radius * CGFloat(cos(angle)), y: center.y + radius * CGFloat(sin(angle)))
    }
}

private struct PlanArc: Shape {
    var from: Double
    var to: Double
    let radius: CGFloat
    let center: CGPoint

    var animatableData: AnimatablePair<Double, Double> {
        get { AnimatablePair(from, to) }
        set { from = newValue.first; to = newValue.second }
    }

    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.addArc(center: center, radius: radius, startAngle: .degrees(180 + 180 * from), endAngle: .degrees(180 + 180 * to), clockwise: false)
        return path
    }
}

/// A quiet full-screen state (loading, nothing to show, failure) in the area's sky.
struct PlanStateView: View {
    let title: String
    let text: String
    var mark: PlanMark.Kind = .keep
    var action: (String, () -> Void)? = nil
    var loading = false
    let onClose: () -> Void

    var body: some View {
        ZStack {
            PlanSky(height: 340)
            VStack(alignment: .leading, spacing: 14) {
                PlanCloseButton(action: onClose)
                Spacer()
                if loading {
                    ProgressView().tint(.white).controlSize(.large).frame(maxWidth: .infinity)
                } else {
                    PlanMark(mark, color: planHue.glow, size: 34)
                }
                Text(title).nkFont(28, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                Text(text).nkFont(15).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
                if let action {
                    Button(action: action.1) {
                        Text(action.0).nkFont(16, .semibold).foregroundStyle(NK.ground)
                            .padding(.horizontal, 28).frame(minHeight: 52).background(Capsule().fill(.white))
                    }
                    .buttonStyle(.plain)
                }
                Spacer(); Spacer()
            }
            .padding(.horizontal, 24).padding(.top, 8)
        }
    }
}

/// The failure in his words.
func planErrorText(_ error: PlanFetchError) -> String {
    switch error {
    case .offline: "Most nincs net. Amint visszajön, újra megpróbálhatod."
    case .unauthorized: "Lejárt a bejelentkezésed. Lépj be újra."
    case .notFound: "Ezt a blokkot már nem találom."
    case .rejected: "A szerver ezt így nem fogadta el."
    case .conflict("SEASON_REQUIRED"): "Edzésblokk csak évadhoz indulhat. Az Évad oldalon indíthatsz egyet."
    case .conflict: "Ez közben lezárult, ezért nem változott."
    case .dayWorkoutRunning: "Ezen a napon most fut az edzésed — utána szerkesztheted."
    case .server: "Valami elakadt a szerveren. Próbáld újra kicsit később."
    }
}
/// The feature's own marks, drawn on the kit's 64-unit grid with the same round 5-unit stroke as the outlined
/// `NKGlyph`s — so nothing here is an emoji or a system symbol.
struct PlanMark: View {
    enum Kind {
        case sets, weight, reps, calendar, check, keep, spark, target, feather, shield, flame, drop, myo, partials, flag, timer

        /// The mark a reason pill wears, by its reason code.
        static func forReason(_ code: String) -> Kind {
            switch code {
            case "deficit_pace", "deficit_allowance", "joint_pain": .shield
            case "felt_easy": .feather
            case "reserve_left", "room_in_band", "top_of_rep_range", "above_band", "at_ceiling", "no_slot", "emphasis": .target
            case "next_plate": .weight
            case "grind", "too_much", "soreness", "soreness_cleared", "stalled": .flame
            case "tier_maintain", "deload", "deload_restore": .keep
            case "technique_week": .drop
            case "challenge": .flag
            case "sport_day": .calendar
            case "ai_suggested", "tier_change": .spark
            default: .check
            }
        }
    }

    let kind: Kind
    let color: Color
    let size: CGFloat
    init(_ kind: Kind, color: Color, size: CGFloat = 18) { self.kind = kind; self.color = color; self.size = size }

    var body: some View {
        Canvas { ctx, s in
            let k = s.width / 64
            func P(_ f: (inout Path) -> Void) -> Path { var p = Path(); f(&p); return p.applying(CGAffineTransform(scaleX: k, y: k)) }
            let st = StrokeStyle(lineWidth: 5 * k, lineCap: .round, lineJoin: .round)
            let ink = GraphicsContext.Shading.color(color)
            switch kind {
            case .drop:
                // steps going down: the weight comes off
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 8, y: 16)); $0.addLine(to: CGPoint(x: 24, y: 16)); $0.addLine(to: CGPoint(x: 24, y: 32))
                    $0.addLine(to: CGPoint(x: 40, y: 32)); $0.addLine(to: CGPoint(x: 40, y: 48)); $0.addLine(to: CGPoint(x: 56, y: 48))
                }, with: ink, style: st)
            case .myo:
                // one big effort, then small ones
                ctx.fill(P { $0.addEllipse(in: CGRect(x: 6, y: 20, width: 24, height: 24)) }, with: ink)
                for x in [36.0, 46.0, 56.0] {
                    ctx.fill(P { $0.addEllipse(in: CGRect(x: x - 3.5, y: 28.5, width: 7, height: 7)) }, with: ink)
                }
            case .partials:
                // half of the way: a full arc, and the lower half of it drawn heavy
                ctx.stroke(P { $0.addArc(center: CGPoint(x: 32, y: 34), radius: 20, startAngle: .degrees(180), endAngle: .degrees(360), clockwise: false) },
                           with: .color(color.opacity(0.35)), style: st)
                ctx.stroke(P { $0.addArc(center: CGPoint(x: 32, y: 34), radius: 20, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false) }, with: ink, style: st)
                ctx.stroke(P { $0.move(to: CGPoint(x: 8, y: 50)); $0.addLine(to: CGPoint(x: 56, y: 50)) }, with: ink, style: st)
            case .flag:
                ctx.stroke(P { $0.move(to: CGPoint(x: 16, y: 8)); $0.addLine(to: CGPoint(x: 16, y: 56)) }, with: ink, style: st)
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 16, y: 12)); $0.addLine(to: CGPoint(x: 50, y: 20)); $0.addLine(to: CGPoint(x: 16, y: 34))
                }, with: ink, style: st)
            case .timer:
                ctx.stroke(P { $0.addEllipse(in: CGRect(x: 11, y: 15, width: 42, height: 42)) }, with: ink, style: st)
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 32, y: 36)); $0.addLine(to: CGPoint(x: 32, y: 24))
                    $0.move(to: CGPoint(x: 25, y: 7)); $0.addLine(to: CGPoint(x: 39, y: 7))
                }, with: ink, style: st)
            case .sets:
                // three stacked bars: a set, a set, a set
                for (i, y) in [16.0, 32.0, 48.0].enumerated() {
                    ctx.stroke(P { $0.move(to: CGPoint(x: 12, y: y)); $0.addLine(to: CGPoint(x: CGFloat(52 - i * 8), y: y)) }, with: ink, style: st)
                }
            case .weight:
                // a barbell seen from the side
                ctx.stroke(P { $0.move(to: CGPoint(x: 6, y: 32)); $0.addLine(to: CGPoint(x: 58, y: 32)) }, with: ink, style: st)
                ctx.stroke(P { $0.addRoundedRect(in: CGRect(x: 13, y: 14, width: 9, height: 36), cornerSize: CGSize(width: 4, height: 4)) }, with: ink, style: st)
                ctx.stroke(P { $0.addRoundedRect(in: CGRect(x: 42, y: 14, width: 9, height: 36), cornerSize: CGSize(width: 4, height: 4)) }, with: ink, style: st)
            case .reps:
                // a loop that comes back on itself
                ctx.stroke(P { $0.addArc(center: CGPoint(x: 32, y: 32), radius: 19, startAngle: .degrees(-40), endAngle: .degrees(210), clockwise: false) }, with: ink, style: st)
                ctx.stroke(P { $0.move(to: CGPoint(x: 39, y: 8)); $0.addLine(to: CGPoint(x: 47, y: 19)); $0.addLine(to: CGPoint(x: 34, y: 23)) }, with: ink, style: st)
            case .calendar:
                ctx.stroke(P { $0.addRoundedRect(in: CGRect(x: 10, y: 14, width: 44, height: 40), cornerSize: CGSize(width: 9, height: 9)) }, with: ink, style: st)
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 10, y: 27)); $0.addLine(to: CGPoint(x: 54, y: 27))
                    $0.move(to: CGPoint(x: 22, y: 8)); $0.addLine(to: CGPoint(x: 22, y: 18))
                    $0.move(to: CGPoint(x: 42, y: 8)); $0.addLine(to: CGPoint(x: 42, y: 18))
                }, with: ink, style: st)
            case .check:
                ctx.stroke(P { $0.move(to: CGPoint(x: 13, y: 34)); $0.addLine(to: CGPoint(x: 26, y: 47)); $0.addLine(to: CGPoint(x: 51, y: 18)) }, with: ink, style: st)
            case .keep:
                // two level lines: nothing moves
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 14, y: 24)); $0.addLine(to: CGPoint(x: 50, y: 24))
                    $0.move(to: CGPoint(x: 14, y: 40)); $0.addLine(to: CGPoint(x: 50, y: 40))
                }, with: ink, style: st)
            case .spark:
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 32, y: 8)); $0.addLine(to: CGPoint(x: 32, y: 56))
                    $0.move(to: CGPoint(x: 8, y: 32)); $0.addLine(to: CGPoint(x: 56, y: 32))
                    $0.move(to: CGPoint(x: 16, y: 16)); $0.addLine(to: CGPoint(x: 48, y: 48))
                    $0.move(to: CGPoint(x: 48, y: 16)); $0.addLine(to: CGPoint(x: 16, y: 48))
                }, with: ink, style: StrokeStyle(lineWidth: 4 * k, lineCap: .round))
            case .target:
                ctx.stroke(P { $0.addEllipse(in: CGRect(x: 9, y: 9, width: 46, height: 46)) }, with: ink, style: st)
                ctx.fill(P { $0.addEllipse(in: CGRect(x: 25, y: 25, width: 14, height: 14)) }, with: ink)
            case .feather:
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 12, y: 54)); $0.addLine(to: CGPoint(x: 42, y: 22))
                    $0.move(to: CGPoint(x: 22, y: 43))
                    $0.addQuadCurve(to: CGPoint(x: 52, y: 10), control: CGPoint(x: 20, y: 14))
                    $0.addQuadCurve(to: CGPoint(x: 22, y: 43), control: CGPoint(x: 52, y: 42))
                }, with: ink, style: st)
            case .shield:
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 32, y: 8)); $0.addLine(to: CGPoint(x: 52, y: 16))
                    $0.addQuadCurve(to: CGPoint(x: 32, y: 56), control: CGPoint(x: 54, y: 44))
                    $0.addQuadCurve(to: CGPoint(x: 12, y: 16), control: CGPoint(x: 10, y: 44))
                    $0.closeSubpath()
                }, with: ink, style: st)
            case .flame:
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 32, y: 8))
                    $0.addQuadCurve(to: CGPoint(x: 48, y: 38), control: CGPoint(x: 50, y: 22))
                    $0.addQuadCurve(to: CGPoint(x: 32, y: 56), control: CGPoint(x: 48, y: 56))
                    $0.addQuadCurve(to: CGPoint(x: 16, y: 38), control: CGPoint(x: 16, y: 56))
                    $0.addQuadCurve(to: CGPoint(x: 32, y: 8), control: CGPoint(x: 18, y: 24))
                }, with: ink, style: st)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
