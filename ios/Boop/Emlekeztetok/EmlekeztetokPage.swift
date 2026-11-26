import BoopCore
import SwiftUI
import BoopDesign

/// The Emlékeztetők page (spike shot 02), presented at page level by the shell: MA · ISMÉTLŐDŐ · EGYSZERI · BOOP
/// EMLÉKEZTETŐI, then the footer lines. An `NKAreaSubPage` in the page hue (Forma's violet).
struct EmlekeztetokPage: View {
    let onClose: () -> Void
    @State private var editing: ReminderDraft?
    @State private var expiry: Date?
    @Environment(\.scenePhase) private var scenePhase

    private var calendar: Calendar { .current }
    private let hue = Hue.forma

    var body: some View {
        if let store = ReminderHub.store {
            page(store)
        } else {
            NKAreaSubPage(hue: hue, crumb: "Ma", eyebrow: "Emlékeztetők", title: "Amire szólok", onBack: onClose) {
                NKNote("Az emlékeztetőid bejelentkezés után itt vannak.", hue: hue)
            }
        }
    }

    private func page(_ store: ReminderStore) -> some View {
        let now = Date()
        let sections = reminderSections(store.file, now: now, calendar: calendar)
        let today = ReminderPlanner.dayString(now, calendar: calendar)
        return NKAreaSubPage(hue: hue, crumb: "Ma", eyebrow: "Emlékeztetők", title: "Amire szólok",
                             sentence: reminderSentence(sections),
                             actions: [NKAreaAction(glyph: "plus-ink", label: "Új emlékeztető") { editing = ReminderDraft() }],
                             onBack: onClose) {
            if store.file.reminders.isEmpty {
                NKNote("Még nincs emlékeztetőd. A jobb felső + gombbal adsz hozzá egyet — ébresztőt is, ami némítva is szól.", hue: hue)
            }
            if !sections.today.isEmpty { todaySection(sections, today: today, store: store) }
            if !sections.repeating.isEmpty { repeatingSection(sections, today: today, store: store) }
            if !sections.once.isEmpty { onceSection(sections, today: today, store: store) }
            builtInSection(store)
            footer(store, now: now)
        }
        .sheet(item: $editing) { draft in
            ReminderEditSheet(draft: draft, store: store) { editing = nil }
                .presentationDetents([.large])
                .presentationBackground(NK.ground)
                .presentationCornerRadius(34)
                .presentationDragIndicator(.visible)
        }
        .task {
            expiry = InstallExpiry.date()
            #if DEBUG
            openDebugSheet(store)
            #endif
        }
        .onChange(of: scenePhase) { _, phase in if phase == .active { expiry = InstallExpiry.date() } }
    }

    // MARK: sections

    private func todaySection(_ s: ReminderSections, today: String, store: ReminderStore) -> some View {
        NKBare("Ma", hue: hue) {
            VStack(spacing: 0) {
                ForEach(Array(s.today.enumerated()), id: \.element.id) { i, row in
                    if i > 0 { hairline }
                    ReminderTodayRow(row: row, today: today, arm: reminderArmState(row.reminder), onTick: {
                        ReminderActions.toggleTick(row, store: store)
                    }, onOpen: { edit(row.reminder) })
                }
            }
        }
    }

    private func repeatingSection(_ s: ReminderSections, today: String, store: ReminderStore) -> some View {
        NKBare("Ismétlődő", hue: hue, glyph: "repeat-deep") {
            VStack(spacing: 0) {
                ForEach(Array(s.repeating.enumerated()), id: \.element.id) { i, r in
                    if i > 0 { hairline }
                    listRow(r, today: today, store: store)
                }
            }
        }
    }

    private func onceSection(_ s: ReminderSections, today: String, store: ReminderStore) -> some View {
        NKBare("Egyszeri", hue: hue, glyph: "clock-ink") {
            VStack(spacing: 0) {
                ForEach(Array(s.once.enumerated()), id: \.element.id) { i, r in
                    if i > 0 { hairline }
                    listRow(r, today: today, store: store)
                }
            }
        }
    }

    /// A reminder in a list: time · title and its second line · strength mark · the on/off switch.
    private func listRow(_ r: Reminder, today: String, store: ReminderStore) -> some View {
        let rowHue = ReminderLook.hue(r)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                Button { edit(r) } label: {
                    ReminderLine(reminder: r, sub: reminderSubtitle(r, today: today), dim: !r.enabled)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Toggle("", isOn: Binding(get: { r.enabled }, set: { on in var n = r; n.enabled = on; store.upsert(n) }))
                    .labelsHidden().tint(rowHue.glow)
                    .accessibilityLabel("\(r.title) be- és kikapcsolva")
            }
            if r.enabled { ReminderArmLine(state: reminderArmState(r), reminder: r) }
        }
        .padding(.vertical, 10)
        .accessibilityElement(children: .contain)
    }

    private var hairline: some View { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }

    // MARK: Boop's own

    private func builtInSection(_ store: ReminderStore) -> some View {
        let b = store.file.builtIn
        func set(_ change: (inout BoopReminderSettings) -> Void) { var n = store.file.builtIn; change(&n); store.setBuiltIn(n) }
        return NKBare("Boop emlékeztetői", hue: hue, glyph: "spark-cream") {
            VStack(spacing: 0) {
                builtInSlot("Reggeli kitöltés", "check-in", b.morning) { s in set { $0.morning = s } }
                hairline
                builtInSlot("Déli kitöltés", "check-in", b.noon) { s in set { $0.noon = s } }
                hairline
                builtInSlot("Délutáni kitöltés", "check-in", b.afternoon) { s in set { $0.afternoon = s } }
                hairline
                builtInLead("Zárjuk le a napot", before: "lefekvés előtt", unit: "perccel", on: b.closeEnabled,
                            minutes: b.closeMinutesBeforeBed, range: 15...180, step: 5,
                            setOn: { on in set { $0.closeEnabled = on } }, setMinutes: { m in set { $0.closeMinutesBeforeBed = m } })
                hairline
                builtInLead("Lefekvés", before: "a célidő előtt", unit: "perccel", on: b.bedtimeEnabled,
                            minutes: b.bedtimeMinutesBefore, range: 5...120, step: 5,
                            setOn: { on in set { $0.bedtimeEnabled = on } }, setMinutes: { m in set { $0.bedtimeMinutesBefore = m } })
            }
        }
    }

    private func builtInSlot(_ title: String, _ sub: String, _ slot: BoopReminderSettings.Slot,
                             _ change: @escaping (BoopReminderSettings.Slot) -> Void) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).nkFont(16, .medium).foregroundStyle(.white)
                Text(sub).nkFont(12.5).foregroundStyle(.white.opacity(0.5))
            }
            .opacity(slot.enabled ? 1 : 0.5)
            Spacer(minLength: 4)
            DatePicker("", selection: Binding(get: { clockDate(slot.hour, slot.minute) },
                                              set: { d in
                                                  let c = calendar.dateComponents([.hour, .minute], from: d)
                                                  var n = slot; n.hour = c.hour ?? n.hour; n.minute = c.minute ?? n.minute; change(n)
                                              }),
                       displayedComponents: .hourAndMinute)
                .labelsHidden().tint(hue.glow).environment(\.locale, Locale(identifier: "hu_HU"))
                .opacity(slot.enabled ? 1 : 0.4)
                .accessibilityLabel("\(title) ideje")
            Toggle("", isOn: Binding(get: { slot.enabled }, set: { on in var n = slot; n.enabled = on; change(n) }))
                .labelsHidden().tint(hue.glow)
                .accessibilityLabel("\(title) be- és kikapcsolva")
        }
        .padding(.vertical, 10)
    }

    private func builtInLead(_ title: String, before: String, unit: String, on: Bool, minutes: Int, range: ClosedRange<Int>, step: Int,
                             setOn: @escaping (Bool) -> Void, setMinutes: @escaping (Int) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).nkFont(16, .medium).foregroundStyle(.white)
                    Text("\(before) \(minutes) \(unit)").nkFont(12.5).foregroundStyle(.white.opacity(0.5))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .opacity(on ? 1 : 0.5)
                Spacer(minLength: 4)
                Toggle("", isOn: Binding(get: { on }, set: setOn)).labelsHidden().tint(hue.glow)
                    .accessibilityLabel("\(title) be- és kikapcsolva")
            }
            if on {
                Stepper(value: Binding(get: { minutes }, set: setMinutes), in: range, step: step) {
                    Text("\(minutes) perc").nkFont(14).foregroundStyle(.white.opacity(0.75))
                }
                .accessibilityLabel("\(title): hány perccel korábban")
            }
        }
        .padding(.vertical, 10)
    }

    // MARK: footer

    private func footer(_ store: ReminderStore, now: Date) -> some View {
        let f = ReminderFooter.build(expiry: expiry, horizon: armedHorizon(now: now),
                                     todayOverflow: ReminderHub.scheduler?.todayOverflow ?? false, now: now, calendar: calendar)
        return VStack(alignment: .leading, spacing: 6) {
            if let warning = f.warning {
                Text(warning).nkFont(13).foregroundStyle(NK.gold.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
            }
            ForEach(f.lines, id: \.self) { line in
                Text(line).nkFont(13).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// How far ahead alarms and notifications are set right now (each kind its own day).
    private func armedHorizon(now: Date) -> ArmHorizon {
        #if DEBUG
        if UserDefaults.standard.string(forKey: "reminders") != nil || UserDefaults.standard.bool(forKey: "previewMaReminders") {
            return ArmHorizon(alarms: calendar.date(byAdding: .day, value: 6, to: now), notifications: nil)
        }
        #endif
        return ReminderHub.scheduler?.horizon ?? ArmHorizon()
    }

    // MARK: helpers

    private func edit(_ r: Reminder) { editing = ReminderDraft(r, calendar: calendar) }

    private func clockDate(_ h: Int, _ m: Int) -> Date {
        calendar.date(bySettingHour: h, minute: m, second: 0, of: Date()) ?? Date()
    }

    #if DEBUG
    /// Simulator review: `-reminders edit` opens a new reminder filled as in the spike, `edit-linked` the supplement one.
    private func openDebugSheet(_ store: ReminderStore) {
        switch UserDefaults.standard.string(forKey: "reminders") {
        case "edit":
            var d = ReminderDraft()
            d.title = "Esti magnézium"; d.hour = 21; d.minute = 0; d.note = "Lefekvés előtt, egy pohár vízzel"
            editing = d
        case "edit-linked":
            if let r = store.file.reminders.first(where: { $0.link != .none }) { editing = ReminderDraft(r, calendar: calendar) }
        default: break
        }
    }
    #endif
}
