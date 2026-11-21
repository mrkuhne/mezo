import SwiftUI
import BoopAPI
import BoopCore
import BoopDesign

// MARK: - Day capacity on Ma (B7 K2, mezo-r36n9.17; spike KapMaPreview + KapDayPage, screens 01 and 06)
//
// The morning verdict sits in the existing plan card (no new card surface, spec §5.1), and the day page (DaySheet)
// gains the capacity blocks under its curve. Every word and figure comes from the brief's capacity block through
// BoopCore's KapacitasLogic; nothing here computes a number. With no capacity block the page is exactly as before.

/// The day capacity's writes, handed down the view tree. Nil before sign-in.
private struct KapacitasClientKey: EnvironmentKey { static let defaultValue: KapacitasClient? = nil }

extension EnvironmentValues {
    var kapacitasClient: KapacitasClient? {
        get { self[KapacitasClientKey.self] }
        set { self[KapacitasClientKey.self] = newValue }
    }
}

/// The day-page blocks and the verdict orb wear the Pulzus hue (global constraint: Átrendezés + day-page blocks).
let kapacitasHue: Hue = .pulzus

/// The morning verdict as one row of the plan card: the still orb filled by the day's load, the verdict word, the
/// reason line, and a chevron that opens the day page.
struct MaVerdictRow: View {
    let capacity: Components.Schemas.BoopCapacity
    let open: () -> Void

    var body: some View {
        let line = verdictLine(capacity)
        Button(action: open) {
            HStack(spacing: 12) {
                StillOrb(palette: kapacitasHue.orb, size: 34, level: max(0.15, min(1, capacity.ratio)))
                VStack(alignment: .leading, spacing: 2) {
                    Text(line.word).nkFont(17, .semibold).foregroundStyle(.white)
                    if !line.reason.isEmpty {
                        Text(line.reason).nkFont(13).foregroundStyle(.white.opacity(0.6))
                            .lineLimit(3).fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 6)
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.5))
            }
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Megnyitja a napod")
    }
}

/// The capacity blocks under the day page's curve: *Mennyit bírsz ma*, *Mi visz el ma energiát* (a tap on an event
/// asks how it felt), *Amiből gazdálkodsz*, then the learning note. *Mit tennél át?* comes with K3.
struct DayCapacityBlocks: View {
    let capacity: Components.Schemas.BoopCapacity
    /// After a label is stored: the page reloads the brief (the server re-scored the event).
    var onLabelled: () -> Void = {}

    @Environment(\.kapacitasClient) private var client
    /// What he said this session, by event key (the row shows it at once; the next brief carries the re-score).
    @State private var labels: [String: KapacitasEffect] = [:]
    @State private var picking: KapPick?
    @State private var sending = false
    @State private var failure: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 26) {
            NKBare("Mennyit bírsz ma", hue: kapacitasHue, glyph: "bolt-ink", trailing: "teher a bírásodhoz") {
                NKLevelBar(level: capacityLevel(capacity.ratio), hue: kapacitasHue,
                           // unlabelled, as the approved spike: the two marks sit 8 % apart and their words collide
                           ticks: capacityTicks.map { NKLevelTick(at: $0.at, label: $0.label) })
                Text(capacitySentence(capacity.verdict))
                    .nkFont(13.5).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            }
            demandBlock
            let factors = factorRows(capacity)
            if !factors.isEmpty {
                NKBare("Amiből gazdálkodsz", hue: kapacitasHue, glyph: "heart-cream") {
                    NKRowList(factors.enumerated().map { i, r in
                        NKAreaRow(id: "f\(i)", glyph: r.glyph, title: r.title, sub: r.sub, value: r.value, hot: r.hot)
                    }, hue: kapacitasHue)
                }
            }
            if let learning = verdictLine(capacity).learning {
                NKNote(learning + " Az esti „milyen volt a nap?” válaszaidból tudom meg, mennyire találtam el.", hue: kapacitasHue)
            }
            // „Mit tennél át?" stays hidden until the proposals ship (K3).
        }
        .onAppear {
            #if DEBUG
            // Simulator review: `-previewCapacityPick YES` opens the first event's „Hogy hat rád?" sheet.
            if UserDefaults.standard.bool(forKey: "previewCapacityPick"), picking == nil,
               let r = demandRows(capacity).first(where: { $0.eventKey != nil }), let key = r.eventKey {
                picking = KapPick(eventKey: key, title: r.title, sub: r.sub)
            }
            #endif
        }
        .sheet(item: $picking) { p in
            KapFeedbackSheet(pick: p, current: labels[p.eventKey], sending: sending) { effect in send(effect, for: p) }
                .presentationDetents([.height(300)])
                .presentationBackground(NK.ground).presentationCornerRadius(34).presentationDragIndicator(.visible)
        }
    }

    @ViewBuilder private var demandBlock: some View {
        let rows = demandRows(capacity)
        NKBare("Mi visz el ma energiát", hue: kapacitasHue, glyph: "clock-ink") {
            if rows.isEmpty {
                Text(capacity.calendarKnown ? "Ma nincs olyan programod, ami sokat kérne tőled."
                     : "A naptáradat nem látom, ezért most csak a tested jelei számítanak.")
                    .nkFont(13.5).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            } else {
                NKRowList(rows.enumerated().map { i, r in
                    let said = r.eventKey.flatMap { labels[$0] }
                    return NKAreaRow(id: "d\(i)", glyph: r.glyph, title: r.title, sub: r.sub, value: r.value,
                                     valueSub: said.map { "te: \($0.label.lowercased())" } ?? "",
                                     hot: r.hot && said == nil,
                                     action: action(for: r))
                }, hue: kapacitasHue)
                if let failure {
                    Text(failure).nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                }
            }
        }
    }

    /// Only a calendar event can be labelled (a training session carries no key), and only signed in.
    private func action(for r: KapacitasRow) -> (@MainActor @Sendable () -> Void)? {
        guard let key = r.eventKey, client != nil else { return nil }
        let pick = KapPick(eventKey: key, title: r.title, sub: r.sub)
        return { picking = pick }
    }

    private func send(_ effect: KapacitasEffect, for p: KapPick) {
        guard let client, !sending else { return }
        sending = true
        Task { @MainActor in
            defer { sending = false }
            do {
                try await client.feedback(eventKey: p.eventKey, effect: effect)
                labels[p.eventKey] = effect
                failure = nil
                picking = nil
                onLabelled()
            } catch {
                failure = (error as? PlanFetchError) == .offline ? "Most nincs net, nem tudtam elküldeni. Próbáld újra később."
                    : "Nem sikerült elküldeni. Próbáld újra."
                picking = nil
            }
        }
    }
}

/// The event he tapped.
struct KapPick: Identifiable, Equatable {
    let eventKey: String, title: String, sub: String
    var id: String { eventKey }
}

/// „Merít · Semleges · Feltölt": how the event felt to him. One tap stores it.
private struct KapFeedbackSheet: View {
    let pick: KapPick
    let current: KapacitasEffect?
    let sending: Bool
    let choose: (KapacitasEffect) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            NKMono("HOGY HAT RÁD?")
            VStack(alignment: .leading, spacing: 4) {
                Text(pick.title).nkFont(24, design: .serif).foregroundStyle(.white)
                    .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                Text(pick.sub).nkFont(13).foregroundStyle(.white.opacity(0.55))
            }
            HStack(spacing: 8) {
                ForEach(KapacitasEffect.allCases) { e in
                    NKPill(e.label, primary: e == current, wide: false) { choose(e) }
                }
            }
            .disabled(sending)
            .opacity(sending ? 0.6 : 1)
            Text("Megjegyzem, és ennél az eseménynél legközelebb is így számolok.")
                .nkFont(12.5).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 24).padding(.top, 28)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
