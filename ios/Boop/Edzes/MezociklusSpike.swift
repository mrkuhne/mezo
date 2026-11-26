import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY SPIKE (mezo-r36n9.177) — the Mezociklus tab's card, the „Összes mezociklusom" page, the confirmations and
// the zárójelentés on invented data. Not wired to the server. Branch `spike/boop-mezociklus`.

/// The running mezociklus at the top of the tab: where he is, and what he can do with it.
struct MezoCurrentCardSpike: View {
    let block: BlockPlan
    let hue: Hue
    let onEdit: () -> Void
    let onRestart: () -> Void
    let onClose: () -> Void
    let onSaveTemplate: () -> Void

    var body: some View {
        NKBare("A MEZOCIKLUSOD", hue: hue, glyph: "cycle-ink") {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(block.title).nkFont(22, .semibold).foregroundStyle(.white)
                        Text("\(block.currentWeek). hét a \(block.weeks)-ból · \(block.split)")
                            .nkFont(13).foregroundStyle(.white.opacity(0.65))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Menu {
                        Button { onSaveTemplate() } label: { Label("Mentés a sablonba", systemImage: "square.and.arrow.down") }
                    } label: {
                        Image(systemName: "ellipsis").nkFont(16, .semibold).foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                            .background(Circle().fill(.white.opacity(0.10)).overlay(Circle().stroke(.white.opacity(0.18))))
                    }
                    .accessibilityLabel("Továbbiak")
                }
                NKLevelBar(level: Double(block.currentWeek) / Double(max(block.weeks, 1)), hue: hue)
                HStack(spacing: 8) {
                    pill("Szerkesztés", primary: true, action: onEdit)
                    pill("Újraindítás", action: onRestart)
                    pill("Lezárás", action: onClose)
                }
            }
        }
    }

    private func pill(_ title: String, primary: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(14.5, .semibold).lineLimit(1).minimumScaleFactor(0.8)
                .foregroundStyle(primary ? NK.ground : .white)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background {
                    if primary { Capsule().fill(.white) }
                    else { Capsule().fill(.white.opacity(0.10)).overlay(Capsule().stroke(.white.opacity(0.18))) }
                }
        }
        .buttonStyle(.plain)
    }
}

/// The one row on the tab that opens every mezociklus.
struct MezoAllRowSpike: View {
    let hue: Hue
    let action: () -> Void
    var body: some View {
        NKBare("ÖSSZES MEZOCIKLUSOM", hue: hue) {
            Button(action: action) {
                HStack(spacing: 10) {
                    Text("A futó, a következők, a lezártak és a sablonjaid")
                        .nkFont(13).foregroundStyle(.white.opacity(0.7))
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.45))
                }
                .frame(minHeight: 44).contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Összes mezociklusom")
        }
    }
}

// MARK: - Invented data

struct SpikeRun: Identifiable, Hashable {
    let id = UUID()
    let title: String, dates: String, line: String
    var hasReport: Bool = true
}

private let spikeNext = [SpikeRun(title: "Erő · Tél", dates: "jan. 5. – febr. 15.", line: "6 hét · felső-alsó")]
private let spikeClosed = [
    SpikeRun(title: "Hipertrófia · Nyár", dates: "júl. 7. – aug. 17.", line: "6 hét · push-pull-láb"),
    SpikeRun(title: "Hipertrófia · Nyár", dates: "jún. 23. – júl. 4.", line: "2 hétig futott · újraindítva", hasReport: true),
    SpikeRun(title: "Váll és hát", dates: "máj. 5. – jún. 15.", line: "6 hét · felső-alsó", hasReport: false),
]
private let spikeTemplates = [
    SpikeRun(title: "Hipertrófia · Ősz", dates: "", line: "6 hét · 3-szor futott"),
    SpikeRun(title: "Erő · Tél", dates: "", line: "6 hét · még nem futott"),
    SpikeRun(title: "Váll és hát", dates: "", line: "6 hét · 1-szer futott"),
]

// MARK: - Összes mezociklusom

struct MezociklusokPageSpike: View {
    let hue: Hue
    let running: BlockPlan?
    let onBack: () -> Void
    @State private var report: SpikeRun?
    @State private var startConfirm: SpikeRun?

    var body: some View {
        NKAreaSubPage(hue: hue, crumb: "Edzés · Mezociklus", eyebrow: "Összes mezociklusom",
                      title: "\(spikeClosed.count + (running == nil ? 0 : 1) + spikeNext.count) mezociklus eddig",
                      sentence: "Innen indítasz, újrafuttatsz, vagy visszanézed, hogy sikerült egy-egy.",
                      onBack: onBack) {
            if let running {
                NKBare("MOST FUT", hue: hue, glyph: "cycle-ink") {
                    NKRowList([NKAreaRow(glyph: "bolt-sun", title: running.title,
                                         sub: "\(running.currentWeek). hét a \(running.weeks)-ból · \(running.split)",
                                         level: Double(running.currentWeek) / Double(running.weeks), hot: true) { onBack() }], hue: hue)
                }
            }
            NKBare("KÖVETKEZIK", hue: hue, glyph: "clock-ink") {
                NKRowList(spikeNext.map { r in
                    NKAreaRow(glyph: "clock-ink", title: r.title, sub: "\(r.dates) · \(r.line)", value: "Indítás",
                              state: .future) { startConfirm = r }
                }, hue: hue)
            }
            NKBare("LEZÁRTAK", hue: hue, glyph: "check-ink") {
                NKRowList(spikeClosed.map { r in
                    NKAreaRow(id: r.id.uuidString, glyph: "check-ink", title: r.title, sub: "\(r.dates) · \(r.line)",
                              state: .done, chips: r.hasReport ? [] : ["nincs jelentés"]) { if r.hasReport { report = r } }
                }, hue: hue)
            }
            NKBare("SABLONJAIM", hue: hue, glyph: "book-sage") {
                NKRowList(spikeTemplates.map { r in
                    NKAreaRow(id: r.id.uuidString, glyph: "book-sage", title: r.title, sub: r.line, value: "Indítás") { startConfirm = r }
                }, hue: hue)
            }
            NKNote("A sablon a terv, amiből indulsz. Ha egy futó mezociklusban átírsz valamit, a Továbbiak menüben elmentheted a sablonba is.", hue: hue)
        }
        .confirmationDialog("Elindítod: \(startConfirm?.title ?? "")?", isPresented: Binding(
            get: { startConfirm != nil }, set: { if !$0 { startConfirm = nil } }), titleVisibility: .visible) {
            Button("Indítás ma") { startConfirm = nil }
            Button("Mégse", role: .cancel) { startConfirm = nil }
        } message: {
            if let running { Text("A most futó „\(running.title)\" lezárul, és zárójelentéssel a lezártak közé kerül.") }
            else { Text("Ma indul, az 1. héttől.") }
        }
        .fullScreenCover(item: $report) { r in MezoReportSpike(run: r, hue: hue) { report = nil } }
    }
}

// MARK: - Újraindítás

struct MezoRestartSheetSpike: View {
    let block: BlockPlan
    let hue: Hue
    let onDone: () -> Void
    @State private var updateTemplate = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("MEZOCIKLUS · ÚJRAINDÍTÁS").nkFont(11, .semibold, design: .monospaced).foregroundStyle(hue.glow)
            Text("Újrakezded ma az 1. héttől?").nkFont(24, .semibold).foregroundStyle(.white)
            Text("A „\(block.title)\" a mostani állapotával, minden módosításoddal együtt indul újra. A mostani futam lezárul, és zárójelentéssel megmarad a lezártak között.")
                .nkFont(15).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            NKStatRow([NKStat(value: "\(block.currentWeek)", target: "\(block.weeks)", label: "hétnél tartasz"),
                       NKStat(value: "5", label: "edzés kész"),
                       NKStat(value: "3", label: "maradt ki", hot: true)], hue: hue)
            Toggle(isOn: $updateTemplate) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("A sablont is frissítem").nkFont(15, .semibold).foregroundStyle(.white)
                    Text("A későbbi indítások is a módosításaiddal jönnek").nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                }
            }
            .tint(hue.glow)
            Spacer(minLength: 0)
            Button(role: .destructive) { onDone() } label: {
                Text("Újraindítás ma").nkFont(16, .semibold).foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 52).background(Capsule().fill(Color(hex: 0xC2414B)))
            }
            .buttonStyle(.plain)
            Button { onDone() } label: {
                Text("Mégse").nkFont(15, .semibold).foregroundStyle(.white.opacity(0.8)).frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.plain)
        }
        .padding(24)
    }
}

// MARK: - Lezárás

struct MezoCloseSheetSpike: View {
    let block: BlockPlan
    let hue: Hue
    let onClosed: () -> Void
    let onCancel: () -> Void
    @State private var note = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("MEZOCIKLUS · LEZÁRÁS").nkFont(11, .semibold, design: .monospaced).foregroundStyle(hue.glow)
            Text("Lezárod a „\(block.title)\"-t?").nkFont(24, .semibold).foregroundStyle(.white)
            Text("Most a \(block.currentWeek). hétnél tartasz a \(block.weeks)-ból. A zárójelentés a mostani állapotot rögzíti, Boop pár perc múlva hozzáírja az értékelését.")
                .nkFont(15).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 8) {
                Text("SAJÁT ÉRTÉKELÉS · NEM KÖTELEZŐ").nkFont(11, .semibold, design: .monospaced).foregroundStyle(.white.opacity(0.55))
                TextField("Hogy sikerült?", text: $note, axis: .vertical)
                    .lineLimit(3...6).nkFont(15).foregroundStyle(.white)
                    .padding(14).background(RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.08)))
            }
            Spacer(minLength: 0)
            Button(role: .destructive) { onClosed() } label: {
                Text("Lezárás").nkFont(16, .semibold).foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 52).background(Capsule().fill(Color(hex: 0xC2414B)))
            }
            .buttonStyle(.plain)
            Button { onCancel() } label: {
                Text("Mégse").nkFont(15, .semibold).foregroundStyle(.white.opacity(0.8)).frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.plain)
        }
        .padding(24)
    }
}

// MARK: - Zárójelentés

struct MezoReportSpike: View {
    let run: SpikeRun
    let hue: Hue
    let onBack: () -> Void
    var pending = false

    var body: some View {
        NKAreaSubPage(hue: hue, crumb: "Edzés · Mezociklus", eyebrow: "Zárójelentés · \(run.dates)",
                      title: run.title, sentence: "6 hétből 6, 17 edzésből 15 kész. Négy gyakorlatban erősebb lettél.",
                      onBack: onBack) {
            NKBare("EGY PILLANTÁSRA", hue: hue) {
                NKStatRow([NKStat(value: "88", unit: "%", label: "edzés kész", hot: true),
                           NKStat(value: "4", label: "új rekord"),
                           NKStat(value: "+12", unit: "%", label: "volumen", trend: 1)], hue: hue)
            }
            NKBare("ERŐ", hue: hue, glyph: "dumbbell-ink") {
                NKRowList([
                    NKAreaRow(glyph: "dumbbell-ink", title: "Fekvenyomás", sub: "például 80 → 85 kg × 8", value: "+5 kg"),
                    NKAreaRow(glyph: "dumbbell-ink", title: "Guggolás", sub: "például 100 → 107,5 kg × 6", value: "+7,5 kg"),
                    NKAreaRow(glyph: "dumbbell-ink", title: "Evezés", sub: "például 70 → 72,5 kg × 10", value: "+2,5 kg"),
                ], hue: hue)
            }
            NKBare("A TE ÉRTÉKELÉSED", hue: hue, glyph: "pen-sun") {
                Text("Jól ment, a harmadik héten fáradt voltam.").nkFont(15).foregroundStyle(.white.opacity(0.85))
            }
            NKBare("BOOP ÉRTÉKELÉSE", hue: hue, glyph: "chat-ink") {
                if pending {
                    HStack(spacing: 10) { ProgressView().tint(.white); Text("Boop még írja, pár perc…").nkFont(14).foregroundStyle(.white.opacity(0.7)) }
                } else {
                    Text("A felsőtest szépen nőtt, a láb lemaradt a terv mögött: a következő mezociklusban érdemes ott eggyel több sorozat.")
                        .nkFont(15).foregroundStyle(.white.opacity(0.85))
                }
            }
            NKActions([NKAction(glyph: "repeat-deep", title: "Újrafuttatás", primary: true) {}], hue: hue)
                .padding(.horizontal, 20)
        }
    }
}
