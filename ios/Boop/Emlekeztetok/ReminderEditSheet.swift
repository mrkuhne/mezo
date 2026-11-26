import BoopCore
import SwiftUI
import BoopDesign

/// The edit sheet (spike shot 03): what, when, how often, how loud, a note. A first Ébresztő save makes the system ask
/// for the alarm permission (the scheduler does it on the store's change, with the one sentence from the app's
/// `NSAlarmKitUsageDescription`).
struct ReminderEditSheet: View {
    @State var draft: ReminderDraft
    let store: ReminderStore
    let onDone: () -> Void
    @State private var confirmDelete = false
    @FocusState private var focus: Field?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private enum Field { case title, note }
    private var calendar: Calendar { .current }

    init(draft: ReminderDraft, store: ReminderStore, onDone: @escaping () -> Void) {
        _draft = State(initialValue: draft)
        self.store = store
        self.onDone = onDone
    }

    var body: some View {
        NKSheetFrame(hue: .forma, eyebrow: "Emlékeztető", title: draft.isNew ? "Új emlékeztető" : "Emlékeztető") {
            VStack(alignment: .leading, spacing: 22) {
                what
                when
                if !draft.isLinked { repeats }
                strength
                note
                actions
            }
            .padding(.horizontal, 6)
        }
        .confirmationDialog("Törlöd ezt az emlékeztetőt?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Törlöm", role: .destructive) { store.delete(draft.id); onDone() }
            Button("Mégse", role: .cancel) {}
        }
    }

    // MARK: sections

    private func label(_ text: String) -> some View { NKMono(text) }

    private var what: some View {
        VStack(alignment: .leading, spacing: 8) {
            label("MIRE SZÓLJAK?")
            if draft.isLinked {
                VStack(alignment: .leading, spacing: 4) {
                    Text(draft.title).nkFont(22, design: .serif).foregroundStyle(.white)
                    Text("A kiegészítőknél szerkeszted").nkFont(13).foregroundStyle(.white.opacity(0.55))
                }
                .padding(.horizontal, 18).padding(.vertical, 14).frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.07)))
            } else {
                TextField("", text: $draft.title, prompt: Text("pl. Esti magnézium").foregroundStyle(.white.opacity(0.35)))
                    .nkFont(22, design: .serif).foregroundStyle(.white).tint(.white)
                    .focused($focus, equals: .title).submitLabel(.done).onSubmit { focus = nil }
                    .padding(.horizontal, 18).frame(minHeight: 58)
                    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.07)))
                    .accessibilityLabel("Mire szóljak?")
            }
        }
    }

    private var when: some View {
        VStack(alignment: .leading, spacing: 4) {
            label("MIKOR?")
            DatePicker("", selection: timeBinding, displayedComponents: .hourAndMinute)
                .datePickerStyle(.wheel).labelsHidden()
                .environment(\.locale, Locale(identifier: "hu_HU"))
                .frame(maxWidth: .infinity).frame(height: 150).clipped()
                .accessibilityLabel("Mikor?")
        }
    }

    private var repeats: some View {
        VStack(alignment: .leading, spacing: 10) {
            label("ISMÉTLÉS")
            HStack(spacing: 8) {
                modeChip("Egyszer", .once)
                modeChip("Minden nap", .daily)
                modeChip("Ezeken a napokon", .weekdays)
            }
            if draft.mode == .once {
                DatePicker("", selection: $draft.onceDate, in: calendar.startOfDay(for: Date())..., displayedComponents: .date)
                    .datePickerStyle(.compact).labelsHidden()
                    .environment(\.locale, Locale(identifier: "hu_HU")).tint(Hue.forma.glow)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityLabel("Melyik napon?")
            } else {
                dayChips
            }
        }
    }

    private func modeChip(_ title: String, _ mode: ReminderDraft.Mode) -> some View {
        let on = draft.mode == mode
        return Button {
            draft.mode = mode
            if mode == .weekdays, draft.days.count == 7 { draft.days = [1, 2, 3, 4, 5] }
            if mode == .daily { draft.days = Set(1...7) }
        } label: {
            Text(title).nkFont(14, .semibold).lineLimit(1).minimumScaleFactor(0.7)
                .foregroundStyle(on ? NK.ground : .white)
                .padding(.horizontal, 14).frame(height: 44)
                .background(Capsule().fill(on ? .white : .white.opacity(0.08)))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private var dayChips: some View {
        let letters = ["H", "K", "Sz", "Cs", "P", "Szo", "V"]
        return HStack(spacing: 0) {
            ForEach(1...7, id: \.self) { d in
                let on = draft.mode == .daily || draft.days.contains(d)
                Button { draft.toggle(day: d) } label: {
                    Text(letters[d - 1]).nkFont(14, .semibold)
                        .foregroundStyle(on ? NK.ground : .white.opacity(0.75))
                        .frame(width: 44, height: 44)
                        .background(Circle().fill(on ? .white : .white.opacity(0.08)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(["hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat", "vasárnap"][d - 1])
                .accessibilityAddTraits(on ? .isSelected : [])
                if d < 7 { Spacer(minLength: 0) }
            }
        }
    }

    private var strength: some View {
        VStack(alignment: .leading, spacing: 10) {
            label("MILYEN ERŐSEN?")
            strengthCard(.alarm, "Ébresztő", "Egész képernyő, némításon és alvó módon is szól. Leállítani és „Kész”-t mondani külön gomb.")
            strengthCard(.notification, "Értesítés", "Sima felugró üzenet hanggal. „Kész” vagy „10 perc múlva”.")
        }
    }

    private func strengthCard(_ s: ReminderStrength, _ title: String, _ sub: String) -> some View {
        let on = draft.strength == s
        let hue = draft.isLinked ? Hue.fuel : Hue.forma
        return Button { draft.strength = s } label: {
            HStack(alignment: .top, spacing: 14) {
                ZStack {
                    Circle().stroke(.white.opacity(on ? 0.8 : 0.45), lineWidth: 1.6).frame(width: 28, height: 28)
                    if on { Circle().fill(hue.glow).frame(width: 16, height: 16) }
                }
                .padding(.top, 1)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).nkFont(17, .semibold).foregroundStyle(.white)
                    Text(sub).nkFont(14).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(on ? 0.1 : 0.06)))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(hue.glow.opacity(on ? 0.7 : 0), lineWidth: 1.2))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private var note: some View {
        VStack(alignment: .leading, spacing: 8) {
            label("MEGJEGYZÉS")
            TextField("", text: $draft.note, prompt: Text("nem kötelező").foregroundStyle(.white.opacity(0.35)))
                .nkFont(16).foregroundStyle(.white).tint(.white)
                .focused($focus, equals: .note).submitLabel(.done).onSubmit { focus = nil }
                .padding(.horizontal, 18).frame(minHeight: 52)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.07)))
                .accessibilityLabel("Megjegyzés")
        }
    }

    private var actions: some View {
        VStack(spacing: 10) {
            NKPill("Mentem") { save() }
                .disabled(!draft.canSave).opacity(draft.canSave ? 1 : 0.4)
            if !draft.isNew, !draft.isLinked {
                Button { confirmDelete = true } label: {
                    Text("Törlöm").nkFont(16, .medium).foregroundStyle(.white.opacity(0.75))
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 4)
    }

    // MARK: logic

    private var timeBinding: Binding<Date> {
        Binding {
            calendar.date(bySettingHour: draft.hour, minute: draft.minute, second: 0, of: Date()) ?? Date()
        } set: { date in
            let c = calendar.dateComponents([.hour, .minute], from: date)
            draft.hour = c.hour ?? draft.hour
            draft.minute = c.minute ?? draft.minute
        }
    }

    private func save() {
        guard draft.canSave else { return }
        var reminder = draft.reminder(calendar: calendar)
        if case .supplement = reminder.link, let kept = store.file.reminders.first(where: { $0.id == reminder.id }) {
            reminder.title = kept.title   // a linked reminder's title is its group's
        }
        store.upsert(reminder)   // the scheduler re-arms on the change, and asks for the permission the first time
        onDone()
    }
}
