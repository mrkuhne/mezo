#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY spike page: the block builder's head, Izmok tab and bottom bar (copied from `BlockBuilderPage`), driven by
// `HianyModel` instead of the server's evaluator.

struct HianyDemoRoot: View {
    private let state = UserDefaults.standard.string(forKey: "previewHianyState") ?? "list"
    @State private var model: HianyModel
    @State private var selected: String? = "ham"
    @State private var sheet: HianyHint?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init() {
        let s = UserDefaults.standard.string(forKey: "previewHianyState") ?? "list"
        let m = HianyModel(hints: s != "none")
        if s == "added" { m.accept("ham") }
        _model = State(initialValue: m)
    }

    var body: some View {
        ZStack {
            PlanSky(height: 150)
            VStack(spacing: 0) {
                head
                HianyMusclesView(model: model, selected: $selected, whyOpen: state == "why",
                                 scrollToHint: state == "why" || state == "small", other: { sheet = $0 })
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { bar }
        .preferredColorScheme(.dark)
        .sheet(item: $sheet) { hint in
            HianyAddSheet(hint: hint) { sheet = nil }
                .presentationDetents([.large])
                .presentationBackground(NK.ground)
        }
        .task {
            guard state == "other" else { return }
            try? await Task.sleep(for: .milliseconds(600))
            sheet = HianyRules.ham
        }
    }

    private var head: some View {
        HStack(alignment: .center, spacing: 12) {
            PlanCloseButton {}
            VStack(alignment: .leading, spacing: 2) {
                Text("EGY HÉT · IZMONKÉNT").nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(.white.opacity(0.7))
                Text("Erő és forma").nkFont(22, design: .serif).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
            }
            Spacer(minLength: 8)
            HStack(spacing: 6) {
                Circle().fill(planGood).frame(width: 7, height: 7)
                Text("minden a sávban").nkFont(12, .medium).foregroundStyle(.white.opacity(0.9))
            }
            .padding(.horizontal, 11).padding(.vertical, 7)
            .background(Capsule().fill(.black.opacity(0.28)))
        }
        .padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 10)
    }

    /// The real bar: the three-way switch and the one primary button. A hint never turns on „Igazítsd a sávba":
    /// with every muscle inside its band the button stays „Nincs mit menteni" until he adds something.
    private var bar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 2) {
                ForEach(["Izmok", "Napok", "Blokk"], id: \.self) { item in
                    let on = item == "Izmok"
                    VStack(spacing: 3) {
                        NKGlyph(item == "Izmok" ? "dumbbell-ink" : item == "Napok" ? "clock-ink" : "chart-deep",
                                on ? NK.ground : .white.opacity(0.75), size: 17)
                        Text(item).nkFont(10, .semibold).foregroundStyle(on ? NK.ground : .white.opacity(0.75))
                    }
                    .frame(width: 62, height: 48)
                    .background { if on { Capsule().fill(.white) } }
                }
            }
            .padding(4)
            .background(Capsule().fill(.ultraThinMaterial).overlay(Capsule().stroke(.white.opacity(0.12), lineWidth: 1)))

            let save = model.hasChanges
            ViewThatFits(in: .horizontal) {
                Text(save ? "Mentés" : "Nincs mit menteni").nkFont(15, .semibold).lineLimit(1).fixedSize()
                Text(save ? "Mentés" : "Nincs változás").nkFont(15, .semibold).lineLimit(1).minimumScaleFactor(0.75)
            }
            .padding(.horizontal, 12)
            .foregroundStyle(NK.ground)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(Capsule().fill(planHue.glow.opacity(save ? 1 : 0.45)))
        }
        .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 4)
        .background(LinearGradient(colors: [NK.ground.opacity(0), NK.ground.opacity(0.95)], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
    }
}

extension HianyHint: Identifiable { var id: String { exercise } }

// MARK: - Izmok

private struct HianyMusclesView: View {
    let model: HianyModel
    @Binding var selected: String?
    let whyOpen: Bool
    let scrollToHint: Bool
    let other: (HianyHint) -> Void

    var body: some View {
        let muscles = model.muscles
        let current = selected ?? muscles.first?.key ?? ""
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                NKBodyMap(muscles.map { m in
                    let fill = min(1, Double(m.sets) / Double(max(1, m.band.high)))
                    return NKBodyHeat(muscle: m.key, level: m.key == current ? 1 : fill * 0.12)
                }, hue: planHue, views: .both)
                .frame(maxWidth: .infinity).frame(height: model.hinted.isEmpty ? 200 : 176)
                .padding(.horizontal, 40).padding(.top, 10).padding(.bottom, model.hinted.isEmpty ? 10 : 2)
                .accessibilityHidden(true)
                glanceLine(current)
            }
            .background(RoundedRectangle(cornerRadius: 30, style: .continuous).fill(Color.black.opacity(0.42)).padding(.horizontal, 20))
            .animation(.smooth(duration: 0.4), value: current)

            dots(muscles, current)

            ScrollView(.horizontal) {
                LazyHStack(spacing: 14) {
                    ForEach(muscles) { m in
                        HianyMuscleCard(model: model, key: m.key, whyOpen: whyOpen && m.key == "ham",
                                        scrollToHint: scrollToHint && m.key == current, other: other)
                            .containerRelativeFrame(.horizontal)
                            .scrollTransition(.interactive, axis: .horizontal) { view, phase in
                                view.scaleEffect(phase.isIdentity ? 1 : 0.92).opacity(phase.isIdentity ? 1 : 0.55)
                            }
                            .id(m.key)
                    }
                }
                .scrollTargetLayout()
            }
            .contentMargins(.horizontal, 26, for: .scrollContent)
            .scrollTargetBehavior(.viewAligned)
            .scrollPosition(id: $selected)
            .scrollIndicators(.hidden)
        }
    }

    /// The glance: one quiet line under the body, only while a hint is open — a tap steps to the next such muscle.
    /// Not in the head's pill (that one is the band, the rule) and not on the main button.
    @ViewBuilder private func glanceLine(_ current: String) -> some View {
        let hinted = model.hinted
        if !hinted.isEmpty {
            Button {
                let next = hinted.first { $0 != current } ?? hinted[0]
                withAnimation(.smooth) { selected = next }
            } label: {
                HStack(spacing: 7) {
                    Circle().strokeBorder(.white.opacity(0.55), lineWidth: 1.3).frame(width: 8, height: 8)
                    Text(hinted.count == 1 ? "1 hiányzó kiegészítő mozgás" : "\(hinted.count) hiányzó kiegészítő mozgás")
                        .nkFont(12, .medium).foregroundStyle(.white.opacity(0.62))
                    Image(systemName: "chevron.right").font(.system(size: 9, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
                }
                .padding(.horizontal, 12).frame(minHeight: 30)
                .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .padding(.bottom, 4)
        }
    }

    /// The real strip; a muscle with an open hint wears a hollow ring instead of a filled dot (quieter than the band's
    /// yellow).
    private func dots(_ muscles: [HianyMuscle], _ current: String) -> some View {
        HStack(spacing: 6) {
            ForEach(muscles) { m in
                let hint = model.activeHint(m.key) != nil
                Button { withAnimation(.smooth) { selected = m.key } } label: {
                    Group {
                        if m.key == current {
                            Capsule().fill(Color.white).frame(width: 26, height: 9)
                        } else if hint {
                            Circle().strokeBorder(.white.opacity(0.7), lineWidth: 1.4).frame(width: 9, height: 9)
                        } else {
                            Capsule().fill(.white.opacity(0.22)).frame(width: 9, height: 9)
                        }
                    }
                    .frame(height: 30)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(SubMuscles.groupName(m.key))
            }
        }
        .padding(.vertical, 2)
        .animation(.snappy, value: current)
    }
}

// MARK: - The card (copied from `BuilderMuscleCard`), with the coverage hint

private struct HianyMuscleCard: View {
    let model: HianyModel
    let key: String
    let whyOpen: Bool
    let scrollToHint: Bool
    let other: (HianyHint) -> Void
    @State private var tier: MuscleTier?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if let m = model.muscle(key) {
            let t = tier ?? m.tier
            let inside = m.sets >= m.band.low && m.sets <= m.band.high
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 12) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(SubMuscles.groupName(key)).nkFont(26, design: .serif).foregroundStyle(.white)
                            Spacer()
                            Text(inside ? "a sávban" : "kilóg").nkFont(13, .medium).foregroundStyle(inside ? planGood : planWarn)
                        }
                        PlanTierSwitch(tier: t) { tier = $0 }

                        HianyArcGauge(value: m.sets, band: m.band, inside: inside)
                            .frame(height: 124)
                            .overlay(alignment: .bottom) {
                                VStack(spacing: 0) {
                                    Text("\(m.sets)").nkFont(44, .medium).foregroundStyle(.white).contentTransition(.numericText())
                                    Text("sorozat hetente").nkFont(11).foregroundStyle(.white.opacity(0.5))
                                }
                            }
                        bandPills(m, tier: t)

                        if let hint = model.activeHint(key) {
                            HianyHintBox(hint: hint, whyInitially: whyOpen,
                                         add: { withAnimation(reduceMotion ? nil : .snappy) { model.accept(key) } },
                                         other: { other(hint) })
                                .id("hint")
                                .transition(.opacity)
                        } else if model.added.contains(key), let hint = m.hint {
                            addedLine(hint).id("hint").transition(.opacity)
                        }
                        bandReason(m, tier: t, inside: inside)
                    }
                    .padding(20)
                }
                .scrollIndicators(.hidden)
                .scrollBounceBehavior(.basedOnSize)
                .task {
                    guard scrollToHint else { return }
                    try? await Task.sleep(for: .milliseconds(450))
                    proxy.scrollTo("hint", anchor: UserDefaults.standard.string(forKey: "previewHianyState") == "small" ? .bottom : UnitPoint(x: 0.5, y: 0.08))
                }
            }
            .frame(maxHeight: .infinity, alignment: .top)
            .nkGlass(30)
            .padding(.vertical, 8)
        }
    }

    /// After Hozzáadom: one quiet line where the hint was.
    private func addedLine(_ hint: HianyHint) -> some View {
        HStack(spacing: 8) {
            PlanMark(.check, color: planGood, size: 14)
            Text("Hozzáadva \(hint.day)höz").nkFont(13).foregroundStyle(.white.opacity(0.72))
            Text("·").nkFont(13).foregroundStyle(.white.opacity(0.4))
            Button { withAnimation(reduceMotion ? nil : .snappy) { model.undo(key) } } label: {
                Text("visszavonom").nkFont(13, .medium).foregroundStyle(planHue.glow)
            }
            .buttonStyle(.plain)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 4).frame(minHeight: 36)
    }

    private func bandPills(_ m: HianyMuscle, tier: MuscleTier) -> some View {
        let spread = m.spread.filter { $0.value > 0 }.sorted { $0.key < $1.key }
        return NKFlowRow(spacing: 6, rowSpacing: 6) {
            PlanPill("Sáv \(m.band.low)–\(m.band.high)", color: planTierColor(tier == .maintain ? .grow : tier), mark: .target)
            ForEach(spread, id: \.key) { s in
                PlanPill("\(HianyModel.days[s.key]) \(s.value)", mark: .calendar)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func bandReason(_ m: HianyMuscle, tier: MuscleTier, inside: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("MIÉRT EZ A SÁV").nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(planHue.glow)
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
            }
            Text(reasonText(m, tier: tier, inside: inside))
                .nkFont(13).foregroundStyle(.white.opacity(0.75))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.05)))
    }

    private func reasonText(_ m: HianyMuscle, tier: MuscleTier, inside: Bool) -> String {
        let low = m.band.low, high = m.band.high
        let base: String = switch tier {
        case .maintain: "Tartás szinten vagy: heti \(low)–\(high) sorozat megtartja, amit eddig felépítettél, ha a súly marad. Ennél több most nem kell, kevesebbnél már veszíthetsz belőle."
        case .grow: "Építés szinten vagy: heti \(low) sorozattól nő az izom, \(high) fölött már inkább csak fáraszt."
        case .emphasize: "Hangsúly szinten vagy: heti \(low)–\(high) sorozat — innen építjük a legtöbbet, a teteje az, amit egy héten még jól visel."
        }
        return base + (inside ? " Most rendben van; a Napok nézetben állíthatod a sorozatokat, a mérő azonnal követi." : "")
    }
}

// MARK: - The hint box

/// The coverage hint: quieter than the band proposal (no yellow, a hairline instead of a tint), one verdict line,
/// „miért?", one exercise as the familiar small card with its day, Hozzáadom · Mást választok.
private struct HianyHintBox: View {
    let hint: HianyHint
    let add: () -> Void
    let other: () -> Void
    @State private var why: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(hint: HianyHint, whyInitially: Bool, add: @escaping () -> Void, other: @escaping () -> Void) {
        self.hint = hint; self.add = add; self.other = other
        _why = State(initialValue: whyInitially)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center) {
                Text("KIEGÉSZÍTŐ MOZGÁS").nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(.white.opacity(0.5))
                Spacer(minLength: 8)
                whyToggle
            }
            (Text(hint.verdictHead + " — ").foregroundStyle(.white) + Text(hint.verdictTail).foregroundStyle(.white.opacity(0.72)))
                .nkFont(14)
                .fixedSize(horizontal: false, vertical: true)
            if why {
                Text(hint.why).nkFont(13).foregroundStyle(.white.opacity(0.72))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.leading, 12)
                    .overlay(alignment: .leading) { Capsule().fill(.white.opacity(0.18)).frame(width: 2) }
                    .transition(.opacity)
            }
            HianyExerciseCard(hint: hint)
            HStack(spacing: 18) {
                Button(action: add) {
                    Text("Hozzáadom").nkFont(14, .semibold).foregroundStyle(NK.ground)
                        .padding(.horizontal, 18).padding(.vertical, 9).background(Capsule().fill(.white))
                }
                .buttonStyle(.plain)
                Button(action: other) {
                    Text("Mást választok").nkFont(14, .medium).foregroundStyle(.white.opacity(0.8))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.035)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.white.opacity(0.13), lineWidth: 0.75))
    }

    private var whyToggle: some View {
        Button { withAnimation(reduceMotion ? nil : .snappy) { why.toggle() } } label: {
            HStack(spacing: 5) {
                Text("miért?").nkFont(13, .medium).foregroundStyle(planHue.glow)
                Image(systemName: why ? "chevron.up" : "chevron.down").font(.system(size: 10, weight: .semibold)).foregroundStyle(planHue.glow)
            }
            .frame(minHeight: 28).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// `ExercisePickCard`'s look, with the day it would go on in place of the last top set.
private struct HianyExerciseCard: View {
    let hint: HianyHint
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            NKRemoteThumb(nil, size: 44, corner: 12)
            VStack(alignment: .leading, spacing: 4) {
                Text(hint.exercise).nkFont(17, .medium).foregroundStyle(.white).lineLimit(2).minimumScaleFactor(0.8)
                    .fixedSize(horizontal: false, vertical: true)
                Text(hint.role).nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
                Text(hint.reason).nkFont(14).foregroundStyle(.white.opacity(0.82))
                    .fixedSize(horizontal: false, vertical: true).padding(.top, 2)
                Text("\(hint.day) · \(hint.sets) × \(hint.reps)").nkFont(12, design: .monospaced).foregroundStyle(planHue.glow)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.07)))
        .accessibilityElement(children: .combine)
    }
}

// MARK: - The gauge (a copy of `PlanArcGauge` on the spike's band)

private struct HianyArcGauge: View {
    let value: Int
    let band: HianyBand
    let inside: Bool

    var body: some View {
        let top = Double(max(band.limit, value) + 2)
        GeometryReader { geo in
            let radius = min(geo.size.width / 2 - 14, geo.size.height - 14)
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height - 4)
            ZStack {
                arc(0, 1, radius, center).stroke(.white.opacity(0.09), style: StrokeStyle(lineWidth: 12, lineCap: .round))
                arc(Double(band.low) / top, Double(band.high) / top, radius, center)
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
    }

    private func arc(_ from: Double, _ to: Double, _ radius: CGFloat, _ center: CGPoint) -> Path {
        var p = Path()
        p.addArc(center: center, radius: radius, startAngle: .radians(Double.pi + Double.pi * from),
                 endAngle: .radians(Double.pi + Double.pi * to), clockwise: false)
        return p
    }

    private func point(_ fraction: Double, _ radius: CGFloat, _ center: CGPoint) -> CGPoint {
        let angle = Double.pi + Double.pi * max(0, min(1, fraction))
        return CGPoint(x: center.x + radius * CGFloat(cos(angle)), y: center.y + radius * CGFloat(sin(angle)))
    }
}

// MARK: - Mást választok: the add sheet, pre-filtered to the sub-muscle

private struct HianyAddSheet: View {
    let hint: HianyHint
    let close: () -> Void

    private let picks: [(String, String, String)] = [
        ("Seated Leg Curl", "combhajlító · izolált", "Térdből hajlít, ülve: a combhajlítót nyújtott helyzetből terheli."),
        ("Lying Leg Curl", "combhajlító · izolált", "Térdből hajlít, hason fekve: gépen, stabilan."),
        ("Nordic Hamstring Curl", "combhajlító · izolált", "Térdből hajlít, gép nélkül: lassan, a saját súlyoddal."),
        ("Single-Leg Curl", "combhajlító · izolált", "Térdből hajlít, egy lábbal: a két oldalt külön."),
    ]

    var body: some View {
        NKSheetFrame(hue: planHue, eyebrow: "Csütörtök", title: "Mit tegyünk a napra?") {
            dropdownRow
            Text("A lábhajlításokat teszem előre — ilyen most nincs a hetedben.")
                .nkFont(14).foregroundStyle(.white.opacity(0.6))
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("AJÁNLOM · LÁBHAJLÍTÁS").nkFont(10, .medium, design: .monospaced).tracking(1.4)
                .foregroundStyle(.white.opacity(0.5)).padding(.top, 4)
                .frame(maxWidth: .infinity, alignment: .leading)
            ForEach(Array(picks.enumerated()), id: \.offset) { i, p in
                ExercisePickCard(name: p.0, image: nil, role: p.1, reason: p.2, last: nil, first: i == 0, hue: planHue)
            }
            HStack {
                Text("Minden gyakorlat").nkFont(15, .medium).foregroundStyle(.white)
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.45))
            }
            .padding(.vertical, 12)
            .overlay(alignment: .top) { Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5) }
            Text("Az új gyakorlat a nap végére kerül, az edzésmód szerinti sorozatokkal. A döntés a tiéd — a teljes listából bármit választhatsz.")
                .nkFont(12).foregroundStyle(.white.opacity(0.45))
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var dropdownRow: some View {
        HStack(spacing: 10) {
            Text("Izmok").nkFont(14).foregroundStyle(.white.opacity(0.55))
            Text(SubMuscles.name(hint.subMuscle)).nkFont(15, .medium).foregroundStyle(.white)
                .frame(maxWidth: .infinity, alignment: .leading)
            Image(systemName: "chevron.down").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.6))
        }
        .padding(.horizontal, 16).frame(minHeight: 50)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(white: 0.12)))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(.white.opacity(0.16), lineWidth: 0.5))
    }
}
#endif
