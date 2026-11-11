import SwiftUI
import BoopCore
import BoopDesign

// MARK: - PathStep (BoopCore) → PathStation (kit), one to one

func pathStations(_ steps: [PathStep]) -> [PathStation] {
    steps.map { PathStation(id: $0.id, time: $0.time, glyph: $0.glyph, title: $0.title, sub: $0.sub,
                            done: $0.done, isNow: $0.isNow, opens: $0.opens) }
}

// MARK: - What the hero hands to the content below it

/// The selected orb, Boop's voice and the page's toast, shared by the hero (`MaiView`) with what sits under it.
@MainActor
struct MaiContext {
    let hue: Hue
    let motion: OrbMotion
    let voice: BoopVoice?
    let speak: () -> Void
    let toast: (String) -> Void
    /// A toast with an undo action at its end.
    let undoToast: (String, @escaping () -> Void) -> Void
    /// The clock the page reads (simulator review can move it) and whether it is evening (hour ≥ 18).
    let now: Date
    let evening: Bool
    /// Alvás's bedtime reminder and its tap (the bedtime card carries the same switch as the hero pill).
    let reminder: BedtimeReminder
    let toggleReminder: () -> Void
    /// Opens an orb's room (the domain drill-down) on top of Ma.
    let drill: (Hue) -> Void
}

// MARK: - An orb's short path (spec §5.1b; a room's section 4 since B2)

/// The orb's short path with the cards hanging off it (check-in, intention, observations, night, bedtime, walk,
/// session with move + undo, breath, busy block, meals). Lives in the orb's room, under "Mit tehetsz".
struct OrbPathCards: View {
    let hue: Hue
    let brief: Brief
    let store: MorningStore
    let ctx: MaiContext

    private var key: MetricKey { metricKey(for: hue) }

    var body: some View {
        let steps = withReminder(PathBuilder.steps(for: key, brief: brief, now: ctx.now, evening: ctx.evening),
                                 time: ctx.reminder.isOn ? ctx.reminder.time : nil)
        DayPath(stations: pathStations(steps), hue: hue) { st in card(st) }
    }

    // MARK: cards that hang off the path

    @ViewBuilder private func card(_ st: PathStation) -> some View {
        let d = brief.day
        switch st.id {
        case "checkin-morning":
            checkinCard("Hogy vagy ma reggel? Öt alap és a nap kérdése.")
        case "checkin-midday":
            checkinCard("Hogy telik a nap? Energia és fókusz, három kérdés.")
        case "checkin-afternoon":
            checkinCard("Feszültség és éhség, három gyors kérdés.")
        case "checkin-evening":
            checkinCard("Napzárás: hogy ment ma, és mi a nap kérdése.")
        case "intention":
            intentionCard(d.intention)
        case "observations":
            ObservationStack(observations: d.observations, hue: hue, motion: ctx.motion,
                             decide: { id, verdict in
                                 await store.decide(observation: id, true: verdict)
                                 return store.problem == nil
                             },
                             toast: ctx.toast)
        case "sleep-night":
            nightCard(d.sleep)
        case "bedtime", "wind-down":
            bedtimeCard
        case "dip-walk", "easy-walk":
            walkCard(easy: st.id == "easy-walk")
        case "session":
            if let s = d.session {
                SessionCard(session: s, conflict: brief.conflict, store: store, toast: ctx.toast, undoToast: ctx.undoToast)
            }
        case "breath":
            textCard(orb: .pulzus, "Egy perc lassú légzés, mielőtt belefutsz. Fent a gömb vezeti a ritmust.")
        case "busy-block":
            busyCard(d, past: st.done)
        default:
            if st.id.hasPrefix("meal-"), let i = Int(st.id.dropFirst(5)), d.meals.indices.contains(i) {
                mealCard(d.meals[i])
            }
        }
    }

    private func checkinCard(_ text: String) -> some View {
        HStack(spacing: 12) {
            StillOrb(palette: Hue.mozgas.orb, size: 40, level: 0.5)
            Text(text).nkFont(14).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            pill("Kitöltöm") { ctx.toast(soonToast("Check-in")) }
        }
        .padding(14).nkGlass(20)
    }

    private func intentionCard(_ i: Brief.Intention) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if i.creed != nil {
                // the creed itself is the station's line above the card; the card carries the foci
                if i.foci.isEmpty {
                    Text("Még nincs mai fókuszod.").nkFont(13.5).foregroundStyle(.white.opacity(0.65))
                }
                ForEach(Array(i.foci.prefix(3).enumerated()), id: \.offset) { k, f in
                    HStack(spacing: 10) {
                        Text("\(k + 1)").font(.nkNumber(16)).foregroundStyle(.white.opacity(0.6))
                        Text(f).nkFont(14).foregroundStyle(.white.opacity(0.9))
                    }
                }
                HStack {
                    Spacer()
                    pill("Szerkesztem", primary: false) { ctx.toast(soonToast("Mai szándék")) }
                }
            } else {
                Text("Mi legyen ma a fókuszod?").nkFont(18, design: .serif).foregroundStyle(.white)
                HStack {
                    Text("Még nincs mai szándékod.").nkFont(13.5).foregroundStyle(.white.opacity(0.65))
                    Spacer()
                    pill("Megírom") { ctx.toast(soonToast("Mai szándék")) }
                }
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(20)
    }

    @ViewBuilder private func nightCard(_ s: Brief.Sleep?) -> some View {
        if let s {
            VStack(alignment: .leading, spacing: 6) {
                if s.hypnogram.isEmpty {
                    Text("Az alvásszakaszaidat erről az éjszakáról nem látom.").nkFont(13.5).foregroundStyle(.white.opacity(0.7))
                } else {
                    Hypnogram(segments: s.hypnogram.map { (stage: $0.stage, minutes: Double($0.minutes)) }).frame(height: 64)
                    HStack { Text(s.bedtime ?? "–"); Spacer(); Text(s.wakeup ?? "–") }
                        .nkFont(10, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                }
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(20)
        }
    }

    /// Tonight's tip and the bedtime reminder's switch (the same one as Alvás's hero pill).
    private var bedtimeCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                NKGlyph("moon-cream", .white, size: 18).frame(width: 40, height: 40).background(Circle().fill(.white.opacity(0.1)))
                Text(brief.tonightTip).nkFont(14, .medium).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            }
            if reminderTarget(brief) != nil {
                HStack {
                    Spacer()
                    if ctx.reminder.isOn, let time = ctx.reminder.time {
                        pill(reminderPillTitle(time), primary: false, ctx.toggleReminder)
                    } else {
                        pill("Emlékeztess", ctx.toggleReminder)
                    }
                }
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(20)
    }

    private func walkCard(easy: Bool) -> some View {
        HStack(spacing: 12) {
            GlowLine(points: brief.energy.hourly).frame(width: 90, height: 40)
            Text(easy ? "Lassan, a saját tempódban. Ha nem esik jól, hagyd ki nyugodtan."
                      : "Egy tízperces séta frissebb délutánt ad, mint egy újabb kávé.")
                .nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(20)
    }

    private func busyCard(_ d: Brief.Day, past: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            BusyRibbon(slots: d.calendar.busySlots.map { $0 ? 1 : 0 }, trainingSlot: trainingSlot(d.session)).frame(height: 12)
            Text("Ma \(d.calendar.count) esemény a naptáradban." + (past ? "" : " A sáv közben két perc nyújtás is sokat segít."))
                .nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(20)
    }

    private func mealCard(_ m: Brief.Meal) -> some View {
        HStack(spacing: 12) {
            NKGlyph("bowl-cream", .white, size: 22).frame(width: 52, height: 52)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(m.logged ? 0.14 : 0.08)))
            VStack(alignment: .leading, spacing: 6) {
                if !m.logged, let tip = brief.nextMealTip {
                    Text(tip).nkFont(13.5).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
                } else {
                    Text("\(m.proteinG) g fehérje · \(grouped(m.kcal)) kcal").nkFont(13.5).foregroundStyle(.white.opacity(0.85))
                }
            }
            Spacer(minLength: 0)
            if !m.logged {
                Button { ctx.toast(soonToast("Fotózás")) } label: {
                    NKGlyph("camera-ink", NK.ground, size: 15).frame(width: 34, height: 34).background(Circle().fill(.white))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Lefotózom")
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(20)
    }

    private func textCard(orb: Hue, _ text: String) -> some View {
        HStack(spacing: 12) {
            StillOrb(palette: orb.orb, size: 40, level: 0.6)
            Text(text).nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(20)
    }

    private func pill(_ t: String, primary: Bool = true, _ act: @escaping () -> Void) -> some View {
        Button(action: act) {
            Text(t).nkFont(13.5, .semibold).foregroundStyle(primary ? NK.ground : .white).lineLimit(1)
                .padding(.horizontal, 13).padding(.vertical, 8)
                .background(Capsule().fill(primary ? .white : .white.opacity(0.14)))
        }
        .buttonStyle(.plain)
    }
}

/// The session's quarter-hour slot on the 06:00–24:00 ribbon.
func trainingSlot(_ s: Brief.Session?) -> Int? {
    guard let t = s?.time ?? s?.plannedTime else { return nil }
    let p = t.split(separator: ":")
    guard p.count == 2, let h = Int(p[0]), let m = Int(p[1]) else { return nil }
    let slot = (h * 60 + m - 360) / 15
    return (0..<72).contains(slot) ? slot : nil
}

// MARK: - Boop mondja (spec §5.1a, §9.5, §10.2)

/// The longer brief in serif; linked phrases white semibold with a dotted underline, tappable. While Boop speaks the
/// text reveals word by word in step with the voice. Replay and mute sit at the bottom.
struct BoopSaysCard: View {
    let lines: [Brief.Line]
    let hue: Hue
    let motion: OrbMotion
    let voice: BoopVoice?
    let speak: () -> Void
    let onLink: (Brief.Link) -> Void

    var body: some View {
        let speaking = voice?.isSpeaking ?? false
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                LivingOrb(palette: hue.orb, size: 22, level: 0.85, glow: false, motion: motion).allowsHitTesting(false)
                NKMono("BOOP MONDJA")
                Spacer()
            }
            Text(boopSaysText(lines, revealed: speaking ? voice?.shown.count : nil))
                .nkFont(19, design: .serif).lineSpacing(5).foregroundStyle(.white.opacity(0.75))
                .tint(.white)
                .fixedSize(horizontal: false, vertical: true)
                .environment(\.openURL, OpenURLAction { url in
                    if let link = url.host().flatMap(Brief.Link.init(rawValue:)) { onLink(link) }
                    return .handled
                })
            HStack(spacing: 8) {
                Button { if voice?.shown.isEmpty ?? true { speak() } else { voice?.replay() } } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.counterclockwise").font(.system(size: 12, weight: .bold))
                        Text(MaiText.replay)
                    }
                    .nkFont(13.5, .semibold).foregroundStyle(.white)
                    .padding(.horizontal, 13).padding(.vertical, 8)
                    .background(Capsule().fill(.white.opacity(0.14)))
                }
                .buttonStyle(.plain)
                Button { voice?.muted.toggle() } label: {
                    Text((voice?.muted ?? false) ? MaiText.unmute : MaiText.mute)
                        .nkFont(13.5, .semibold).foregroundStyle(.white.opacity(0.8))
                        .padding(.horizontal, 13).padding(.vertical, 8)
                        .background(Capsule().stroke(.white.opacity(0.2), lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()
    }
}

/// The brief as one attributed text, links as `boop://sleep|heart|day`, joined exactly like the spoken text
/// (`BoopVoice.spokenText`). `revealed` = how many characters of the spoken text are shown while Boop speaks (nil = all);
/// the joining spaces count, so the card stays in step with `voice.shown`.
func boopSaysText(_ lines: [Brief.Line], revealed: Int?) -> AttributedString {
    var out = AttributedString()
    var left = revealed ?? Int.max
    var joined = ""
    for line in lines {
        guard left > 0 else { break }
        if !joined.isEmpty, !(joined.last?.isWhitespace ?? true), !(line.text.first?.isWhitespace ?? true) {
            out += AttributedString(" "); joined += " "; left -= 1
            guard left > 0 else { break }
        }
        let text = String(line.text.prefix(left))
        left -= line.text.count
        joined += line.text
        var a = AttributedString(text)
        if let link = line.link {
            a.link = URL(string: "boop://\(link.rawValue)")
            a.foregroundColor = .white
            a.inlinePresentationIntent = .stronglyEmphasized
            a.underlineStyle = Text.LineStyle(pattern: .dot, color: .white.opacity(0.5))
        }
        out += a
    }
    return out
}
