import SwiftUI
import BoopCore
import BoopDesign

// The weekly review (mezo-r36n9.83) — the approved spike's deck on Monday's real proposal: one card per muscle that
// changes, one tile per exercise change with its own accept / keep, a "nem változik" card, a summary card that sends
// everything at once (the undecided lines stay as they were). A proposal that already took effect opens read-only.

struct WeekReviewDeck: View {
    @State var model: WeekReviewModel
    let onClose: () -> Void
    /// DEBUG review: `-previewBlokkCard N` opens the deck on card N.
    @State private var index = UserDefaults.standard.integer(forKey: "previewBlokkCard")
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Group {
            switch model.phase {
            case .loading:
                PlanStateView(title: "Betöltöm a hetet", text: "Egy pillanat, lekérem, mi változna.", loading: true, onClose: onClose)
            case .nothing:
                PlanStateView(title: "Nincs új javaslat", text: "Ezen a héten nincs mit átnézned. Hétfőn jön a következő.", mark: .keep, onClose: onClose)
            case .failed(let e):
                PlanStateView(title: "Most nem tudom betölteni", text: planErrorText(e), mark: .shield,
                              action: ("Újra", { Task { await model.load() } }), onClose: onClose)
            case .ready:
                if let review = model.review { deck(review) }
            }
        }
        .task { if model.phase == .loading, model.review == nil { await model.load() } }
        .preferredColorScheme(.dark)
    }

    private func deck(_ review: WeekReview) -> some View {
        let muscles = review.reviewMuscles
        let count = muscles.count + 2
        return ZStack {
            PlanSky(height: 340)
            VStack(spacing: 0) {
                top(review, count: count)
                TabView(selection: $index) {
                    ForEach(Array(muscles.enumerated()), id: \.element) { i, m in
                        ReviewMuscleCard(model: model, muscle: m, position: "\(i + 1) / \(muscles.count)") {
                            withAnimation(reduceMotion ? nil : .smooth) { index = i + 1 }
                        }
                        .tag(i)
                    }
                    ReviewQuietCard(review: review) { withAnimation(reduceMotion ? nil : .smooth) { index = count - 1 } }
                        .tag(count - 2)
                    ReviewSummaryCard(model: model, onDone: onClose).tag(count - 1)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
            }
        }
        .sensoryFeedback(.selection, trigger: index)
    }

    private func top(_ review: WeekReview, count: Int) -> some View {
        VStack(spacing: 12) {
            HStack(spacing: 5) {
                ForEach(0..<count, id: \.self) { i in
                    Capsule().fill(i <= index ? Color.white : .white.opacity(0.25)).frame(height: 3)
                }
            }
            .animation(.smooth, value: index)
            .accessibilityHidden(true)
            HStack {
                PlanCloseButton(action: onClose)
                VStack(alignment: .leading, spacing: 1) {
                    Text(weekLine(review)).nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(.white.opacity(0.7))
                    Text(review.isOpen ? "Ez változna a héten" : "Ez változott a héten").nkFont(20, design: .serif).foregroundStyle(.white)
                }
                Spacer()
                if review.isOpen, index < count - 1 {
                    Button {
                        model.review?.acceptAllOpen()
                        withAnimation(reduceMotion ? nil : .smooth) { index = count - 1 }
                    } label: {
                        Text("Mind elfogadom").nkFont(13, .semibold).foregroundStyle(.white)
                            .padding(.horizontal, 13).padding(.vertical, 8).background(Capsule().fill(.black.opacity(0.28)))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 20).padding(.top, 8)
    }

    /// „3. HÉT · NOV. 30 – DEC. 6."
    private func weekLine(_ review: WeekReview) -> String {
        guard let range = reviewWeekRange(review.createdAt) else { return "\(review.week). HÉT" }
        return "\(review.week). HÉT · \(range)"
    }
}

/// The Monday–Sunday of the week a proposal was made for, „NOV. 30 – DEC. 6.".
func reviewWeekRange(_ createdAt: String) -> String? {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let date = f.date(from: createdAt) ?? ISO8601DateFormatter().date(from: createdAt)
    guard let date else { return nil }
    var cal = Calendar(identifier: .gregorian)
    cal.firstWeekday = 2
    cal.timeZone = .current
    guard let monday = cal.dateInterval(of: .weekOfYear, for: date)?.start,
          let sunday = cal.date(byAdding: .day, value: 6, to: monday) else { return nil }
    let months = ["JAN.", "FEB.", "MÁRC.", "ÁPR.", "MÁJ.", "JÚN.", "JÚL.", "AUG.", "SZEPT.", "OKT.", "NOV.", "DEC."]
    let a = cal.dateComponents([.month, .day], from: monday), b = cal.dateComponents([.month, .day], from: sunday)
    let left = "\(months[(a.month ?? 1) - 1]) \(a.day ?? 1)."
    let right = a.month == b.month ? "\(b.day ?? 1)." : "\(months[(b.month ?? 1) - 1]) \(b.day ?? 1)."
    return "\(left) – \(right)"
}

private struct ReviewMuscleCard: View {
    let model: WeekReviewModel
    let muscle: String
    let position: String
    let next: () -> Void

    var body: some View {
        if let review = model.review {
            let tier = review.muscle(muscle)?.tier ?? .grow
            let lines = review.lines(muscle)
            let open = review.open(muscle)
            VStack(spacing: 12) {
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(position) · \(tier.hungarian.uppercased())").nkFont(11, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(planHue.glow)
                        Text(SubMuscles.groupName(muscle)).nkFont(34, design: .serif).foregroundStyle(.white)
                    }
                    Spacer()
                    NKBodyMap([NKBodyHeat(muscle: muscle, level: 1)], hue: planHue, views: .auto)
                        .frame(width: 66, height: 100)
                        .accessibilityHidden(true)
                }

                // No weekly total on this card (owner, round 5): next to an exercise's own „2 → 3" the muscle's
                // „11 → 12" read as the same number and misled. The tiles say what moves.
                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(lines) { line in
                            ReviewChangeTile(line: line, decision: review.decision(line.id), editable: review.isOpen && line.serverDecision == nil) {
                                model.review?.decide(line.id, $0)
                            }
                        }
                    }
                }
                .scrollIndicators(.hidden)
                .scrollBounceBehavior(.basedOnSize)

                if !review.isOpen || open == 0 {
                    HStack(spacing: 10) {
                        let yes = lines.filter { review.decision($0.id) == .accepted }.count
                        Text(review.isOpen ? "\(yes) elfogadva · \(lines.count - yes) marad" : "\(lines.count) változás")
                            .nkFont(14, .medium).foregroundStyle(.white.opacity(0.75))
                        Spacer()
                        Button(action: next) {
                            Text("Tovább").nkFont(16, .semibold).foregroundStyle(NK.ground)
                                .padding(.horizontal, 30).frame(minHeight: 54).background(Capsule().fill(planHue.glow))
                        }
                        .buttonStyle(.plain)
                    }
                    .transition(.opacity)
                } else {
                    HStack(spacing: 10) {
                        Button { withAnimation(.snappy) { model.review?.decideAll(muscle, .kept) } } label: {
                            Text(open == lines.count ? "Marad mind" : "A többi marad").nkFont(15, .semibold).foregroundStyle(.white)
                                .frame(maxWidth: .infinity, minHeight: 54).background(Capsule().fill(.white.opacity(0.1)))
                        }
                        .buttonStyle(.plain)
                        Button { withAnimation(.snappy) { model.review?.decideAll(muscle, .accepted) } } label: {
                            Text(open == lines.count ? (lines.count == 1 ? "Elfogadom" : "Elfogadom mind") : "A többit is")
                                .nkFont(16, .semibold).foregroundStyle(NK.ground)
                                .frame(maxWidth: .infinity, minHeight: 54).background(Capsule().fill(.white))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(20)
            .frame(maxHeight: .infinity)
            .background(RoundedRectangle(cornerRadius: 34, style: .continuous).fill(NK.ground.opacity(0.62)))
            .nkGlass(34)
            .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 20)
            .sensoryFeedback(.success, trigger: open == 0)
        }
    }
}

/// One proposed change as a tile of its own: what moves, the amount as the loudest thing, the reasons as pills, and
/// its own yes / no.
private struct ReviewChangeTile: View {
    let line: BoopCore.ReviewLine
    let decision: LineDecision?
    let editable: Bool
    let decide: (LineDecision?) -> Void

    var body: some View {
        let off = decision == .kept
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                PlanMark(mark(line.kind), color: off ? .white.opacity(0.4) : planHue.glow, size: 22)
                    .frame(width: 38, height: 38)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(planHue.glow.opacity(off ? 0.05 : 0.14)))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 6) {
                    Text(line.exerciseName).nkFont(16, .semibold).foregroundStyle(.white.opacity(off ? 0.5 : 0.97))
                        .lineLimit(1).minimumScaleFactor(0.75)
                    HStack(spacing: 6) {
                        if !line.dayName.isEmpty { PlanPill(line.dayName.uppercased(), mono: true, mark: .calendar) }
                        PlanPill(line.kind.label.uppercased(), mono: true, color: planHue.glow)
                    }
                }
                Spacer(minLength: 4)
                if editable {
                    HStack(spacing: 8) {
                        choice(.keep, on: decision == .kept, tint: .white, label: "Marad") { decide(decision == .kept ? nil : .kept) }
                        choice(.check, on: decision == .accepted, tint: planGood, label: "Elfogadom") { decide(decision == .accepted ? nil : .accepted) }
                    }
                } else if let decision {
                    PlanMark(decision == .accepted ? .check : .keep, color: decision == .accepted ? planGood : .white.opacity(0.6), size: 20)
                        .accessibilityLabel(decision == .accepted ? "Elfogadva" : "Marad")
                }
            }
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(from).nkFont(19, .medium).foregroundStyle(.white.opacity(0.45))
                Image(systemName: "arrow.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
                    .accessibilityHidden(true)
                Text(to).nkFont(26, .semibold).foregroundStyle(off ? .white.opacity(0.4) : planHue.glow)
                    .strikethrough(off, color: .white.opacity(0.5))
                    .lineLimit(1).minimumScaleFactor(0.6)
                if off { Text("marad \(from)").nkFont(13, .medium).foregroundStyle(.white.opacity(0.7)).lineLimit(1) }
            }
            .accessibilityElement(children: .combine)
            if let note = line.note {
                HStack(alignment: .top, spacing: 8) {
                    PlanMark(.spark, color: planHue.glow, size: 14).padding(.top, 2)
                    Text(note).nkFont(13).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                }
            }
            if !line.reasons.isEmpty {
                NKFlowRow(spacing: 6, rowSpacing: 6) {
                    ForEach(Array(zip(line.reasons, knownCodes)), id: \.0) { text, code in
                        PlanPill(text, mark: PlanMark.Kind.forReason(code))
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(decision == .accepted ? 0.1 : 0.055)))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous)
            .stroke(decision == .accepted ? planGood.opacity(0.55) : .white.opacity(0.08), lineWidth: 1))
        .animation(.snappy, value: decision)
        .sensoryFeedback(.impact(weight: .light), trigger: decision)
    }

    /// The codes that have a pill, in the same order as `line.reasons`.
    private var knownCodes: [String] { line.reasonCodes.filter { reasonText($0) != nil } }

    private func mark(_ kind: ReviewLineKind) -> PlanMark.Kind {
        switch kind {
        case .sets: .sets
        case .weight: .weight
        case .reps: .reps
        case .technique(_, let to, let challenge): challenge ? .flag : (to == .none ? .keep : .drop)
        case .repRange: .target
        case .other: .spark
        }
    }

    private var from: String {
        switch line.kind {
        case .sets(let from, _): "\(from)"
        case .weight(let from, _): formatKg(from)
        case .reps(let from, _): "\(from)"
        case .technique(let from, _, _): from.name
        case .repRange(let from, _): from
        case .other(let from, _): Self.number(from)
        }
    }

    private var to: String {
        switch line.kind {
        case .sets(_, let to): "\(to) sorozat"
        case .weight(_, let to): formatKg(to)
        case .reps(_, let to): "\(to) ismétlés"
        case .technique(_, let to, let challenge): challenge ? "kihívás" : to.name
        case .repRange(_, let to): "\(to) ism."
        case .other(_, let to): Self.number(to)
        }
    }

    private static func number(_ v: Double) -> String {
        v.rounded() == v ? String(Int(v)) : String(format: "%.1f", v).replacingOccurrences(of: ".", with: ",")
    }

    private func choice(_ mark: PlanMark.Kind, on: Bool, tint: Color, label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            PlanMark(mark, color: on ? NK.ground : .white.opacity(0.8), size: 20)
                .frame(width: 40, height: 40)
                .background(Circle().fill(on ? tint : .white.opacity(0.1)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

private struct ReviewQuietCard: View {
    let review: WeekReview
    let next: () -> Void

    var body: some View {
        let quiet = review.quietMuscles
        VStack(alignment: .leading, spacing: 16) {
            Text("NEM VÁLTOZIK").nkFont(11, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(planHue.glow)
            Text(quiet.isEmpty ? "Minden izomnál van valami" : "\(quiet.count) izom marad, ahol volt").nkFont(30, design: .serif).foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            Text("Ezek Tartás szinten vannak, vagy most nincs okunk lépni velük. Ugyanazt csinálod, mint múlt héten.")
                .nkFont(14).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(Array(quiet.enumerated()), id: \.element.muscle) { i, m in
                        if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                        HStack {
                            Text(SubMuscles.groupName(m.muscle)).nkFont(16, .medium).foregroundStyle(.white.opacity(0.95))
                            PlanTierPill(tier: m.tier)
                            Spacer()
                            Text("\(m.setsBefore) sorozat").nkFont(15).foregroundStyle(.white.opacity(0.6))
                        }
                        .padding(.vertical, 12)
                    }
                }
            }
            .scrollIndicators(.hidden)
            .scrollBounceBehavior(.basedOnSize)
            Button(action: next) {
                Text("Tovább az összegzéshez").nkFont(16, .semibold).foregroundStyle(NK.ground)
                    .frame(maxWidth: .infinity, minHeight: 54).background(Capsule().fill(.white))
            }
            .buttonStyle(.plain)
        }
        .padding(22)
        .frame(maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 34, style: .continuous).fill(NK.ground.opacity(0.62)))
        .nkGlass(34)
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 20)
    }
}

private struct ReviewSummaryCard: View {
    let model: WeekReviewModel
    let onDone: () -> Void
    @State private var drawn = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if let review = model.review {
            let yes = review.acceptedCount, no = review.keptCount, open = review.openCount
            let added = review.addedSets
            VStack(spacing: 14) {
                ScrollView {
                    VStack(spacing: 16) {
                        HStack(alignment: .center, spacing: 18) {
                            ZStack {
                                Circle().stroke(.white.opacity(0.1), lineWidth: 9)
                                Circle().trim(from: 0, to: drawn ? CGFloat(yes + no) / CGFloat(max(1, review.lines.count)) : 0)
                                    .stroke(AngularGradient(colors: [planHue.glow, planWarn, planHue.glow], center: .center),
                                            style: StrokeStyle(lineWidth: 9, lineCap: .round))
                                    .rotationEffect(.degrees(-90))
                                VStack(spacing: 0) {
                                    Text("\(review.setsBefore + added)").nkFont(40, .medium).foregroundStyle(.white).contentTransition(.numericText())
                                    Text("sorozat").nkFont(11).foregroundStyle(.white.opacity(0.55))
                                }
                            }
                            .frame(width: 124, height: 124)
                            .onAppear {
                                if reduceMotion { drawn = true } else { withAnimation(.smooth(duration: 0.9).delay(0.15)) { drawn = true } }
                            }
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel("A héten \(review.setsBefore + added) sorozat")
                            VStack(alignment: .leading, spacing: 6) {
                                Text(headline(review, open: open)).nkFont(26, design: .serif).foregroundStyle(.white)
                                    .fixedSize(horizontal: false, vertical: true)
                                Text("múlt héten \(review.setsBefore) sorozat volt").nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                                HStack(spacing: 6) {
                                    PlanPill("\(yes) elfogadva", color: planGood, mark: .check)
                                    PlanPill("\(no) marad", mark: .keep)
                                }
                            }
                        }

                        HStack(spacing: 10) {
                            tile(.sets, added > 0 ? "+\(added)" : "\(added)", "sorozat")
                            tile(.weight, "\(review.acceptedCount { if case .weight = $0 { true } else { false } })", "súlyemelés")
                            tile(.reps, "\(review.acceptedCount { if case .reps = $0 { true } else { false } })", "ismétlés")
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            label("Izmonként")
                            VStack(spacing: 0) {
                                ForEach(Array(review.reviewMuscles.enumerated()), id: \.element) { i, m in
                                    if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                                    muscleRow(review, m)
                                }
                            }
                        }

                        if !review.days.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                label("Hol érzed a héten")
                                HStack(spacing: 8) {
                                    ForEach(review.days, id: \.0) { index, name in
                                        let n = review.acceptedOn(day: index)
                                        VStack(spacing: 6) {
                                            Text(String(name.prefix(3)).uppercased())
                                                .nkFont(10, .semibold, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                                            ZStack {
                                                Circle().fill(n > 0 ? planHue.glow.opacity(0.9) : .white.opacity(0.08)).frame(width: 34, height: 34)
                                                if n > 0 {
                                                    Text("\(n)").nkFont(15, .semibold).foregroundStyle(NK.ground)
                                                } else {
                                                    PlanMark(.keep, color: .white.opacity(0.35), size: 14)
                                                }
                                            }
                                        }
                                        .frame(maxWidth: .infinity)
                                        .accessibilityElement(children: .ignore)
                                        .accessibilityLabel("\(name): \(n) változás")
                                    }
                                }
                            }
                        }

                        if let error = model.sendError {
                            Text(planErrorText(error)).nkFont(13).foregroundStyle(planWarn).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .scrollIndicators(.hidden)
                .scrollBounceBehavior(.basedOnSize)

                Button {
                    if review.isOpen {
                        Task { if await model.submitFinal() { onDone() } }
                    } else {
                        onDone()
                    }
                } label: {
                    HStack(spacing: 8) {
                        if model.sending { ProgressView().tint(NK.ground) } else {
                            PlanMark(.spark, color: NK.ground, size: 18)
                            Text(!review.isOpen ? "Rendben" : (open == 0 ? "Indulhat a hét" : "Így is indulhat, a többi marad"))
                                .nkFont(16, .semibold).foregroundStyle(NK.ground).lineLimit(1).minimumScaleFactor(0.8)
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 56).background(Capsule().fill(planHue.glow))
                }
                .buttonStyle(.plain)
                .disabled(model.sending)
            }
            .padding(22)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(RoundedRectangle(cornerRadius: 34, style: .continuous).fill(NK.ground.opacity(0.62)))
            .nkGlass(34)
            .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 20)
        }
    }

    private func headline(_ review: WeekReview, open: Int) -> String {
        if !review.isOpen { return review.wasAppliedAutomatically ? "Magától életbe lépett" : "Ez lépett életbe" }
        return open == 0 ? "Kész a heted" : "Még \(open) döntés vár"
    }

    private func label(_ text: String) -> some View {
        Text(text.uppercased()).nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(planHue.glow)
    }

    private func tile(_ mark: PlanMark.Kind, _ value: String, _ name: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            PlanMark(mark, color: planHue.glow, size: 22)
            Text(value).nkFont(26, .semibold).foregroundStyle(.white).contentTransition(.numericText())
            Text(name).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1).minimumScaleFactor(0.8)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(0.07)))
        .accessibilityElement(children: .combine)
    }

    private func muscleRow(_ review: WeekReview, _ muscle: String) -> some View {
        let lines = review.lines(muscle)
        let yes = lines.filter { review.decision($0.id) == .accepted }
        let kept = lines.filter { review.decision($0.id) == .kept }.count
        let open = lines.count - yes.count - kept
        return HStack(spacing: 10) {
            if NKBodyMark.canDraw(muscle) { NKBodyMark(muscle: muscle, hue: planHue, height: 40).frame(width: 26).accessibilityHidden(true) }
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 7) {
                    Text(SubMuscles.groupName(muscle)).nkFont(15, .medium).foregroundStyle(.white.opacity(0.95))
                    PlanTierPill(tier: review.muscle(muscle)?.tier ?? .grow)
                }
                NKFlowRow(spacing: 6, rowSpacing: 6) {
                    ForEach(yes) { line in PlanPill(short(line.kind), color: planHue.glow, mark: markOf(line.kind)) }
                    if yes.isEmpty { PlanPill(open > 0 ? "még nem döntöttél" : "marad a múlt heti", mark: .keep) }
                }
            }
            Spacer(minLength: 4)
            if kept > 0 && !yes.isEmpty { PlanPill("\(kept) marad", mark: .keep) }
        }
        .padding(.vertical, 10)
    }

    private func markOf(_ kind: ReviewLineKind) -> PlanMark.Kind {
        switch kind {
        case .sets: .sets
        case .weight: .weight
        case .reps: .reps
        case .technique: .drop
        case .repRange: .target
        case .other: .spark
        }
    }

    private func short(_ kind: ReviewLineKind) -> String {
        switch kind {
        case .sets(let from, let to): "\(to > from ? "+" : "−")\(abs(to - from))"
        case .weight(_, let to): formatKg(to)
        case .reps(let from, let to): "\(to > from ? "+" : "−")\(abs(to - from)) ism."
        case .technique(_, let to, let challenge): challenge ? "kihívás" : to.name
        case .repRange(_, let to): to
        case .other: "változás"
        }
    }
}

// MARK: - The entrance on the Blokk tab

/// The zoom sources: the builder grows out of its button, the deck out of the week's card (owner, 2026-11-19 —
/// not slid up from the bottom; a full page zooms out of what was tapped, like the home ring's orbs).
enum PlanZoom: String { case builder, review }

/// The card on Edzés → Blokk: the week waiting for approval (Átnézem / Elfogadom átnézés nélkül), what took effect,
/// and the way into the builder. Shows nothing for the week when there is no proposal.
struct WeekReviewEntrance: View {
    let model: WeekReviewModel
    let hue: Hue
    /// The namespace the builder and the deck zoom out of.
    let zoom: Namespace.ID
    let openReview: @MainActor @Sendable () -> Void
    let openBuilder: @MainActor @Sendable () -> Void
    @State private var accepting = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if model.phase == .ready, let review = model.review {
                if review.isOpen {
                    let n = review.reviewMuscles.count
                    NKHighlight(hue: hue, label: "Új hét · jóváhagyásra vár",
                                text: n == 0 ? "Ezen a héten nem változna semmi" : "\(n) izomnál változna valami",
                                sub: "\(summary(review)) Amíg nem hagyod jóvá, a múlt heti számok maradnak.",
                                actions: [NKHighlightAction("Átnézem", action: openReview),
                                          NKHighlightAction(accepting ? "Elfogadom…" : "Elfogadom átnézés nélkül", weight: .secondary) {
                                              guard !accepting else { return }
                                              accepting = true
                                              Task { await model.acceptEverything(); accepting = false }
                                          }])
                    .matchedTransitionSource(id: PlanZoom.review, in: zoom)
                    if let e = model.sendError { Text(planErrorText(e)).nkFont(13).foregroundStyle(planWarn) }
                } else if review.status == "applied" || review.status == "auto_applied" {
                    NKHighlight(hue: hue, label: "A \(review.week). hét",
                                text: review.status == "auto_applied" ? "Magától életbe lépett" : "Indulhat, a hét számai élnek",
                                sub: "\(review.lines.filter { review.decision($0.id) != .kept }.count) változás lépett életbe.",
                                actions: [NKHighlightAction("Megnézem", weight: .secondary, action: openReview)])
                    .matchedTransitionSource(id: PlanZoom.review, in: zoom)
                }
            }
            NKActions([NKAction(glyph: "dumbbell-ink", title: "Blokk szerkesztése", primary: true, action: openBuilder)], hue: hue)
                .matchedTransitionSource(id: PlanZoom.builder, in: zoom)
        }
    }

    /// „Egy-egy sorozattal több a hátra, két gyakorlatnál nő a súly."
    private func summary(_ review: WeekReview) -> String {
        let sets = review.lines.filter { if case .sets = $0.kind { true } else { false } }.count
        let weight = review.lines.filter { if case .weight = $0.kind { true } else { false } }.count
        let reps = review.lines.filter { if case .reps = $0.kind { true } else { false } }.count
        var parts: [String] = []
        if sets > 0 { parts.append("\(sets) sorozatváltozás") }
        if weight > 0 { parts.append("\(weight) gyakorlatnál nő a súly") }
        if reps > 0 { parts.append("\(reps) ismétlésváltozás") }
        return parts.isEmpty ? "" : parts.joined(separator: ", ").prefix(1).uppercased() + parts.joined(separator: ", ").dropFirst() + "."
    }
}
