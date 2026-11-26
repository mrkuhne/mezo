import SwiftUI
import BoopCore
import BoopDesign

// MARK: - Ma (the approved spike's order, `elet-7-level` + level-1…2b, 6a–6e)
//
// rules-only note · highlight · three counted tiles · when mail arrives · first these (people, then senders that are
// never read) · deadlines · parcels · deals · the rest · ask Boop. Every block reads from one digest; if it cannot be
// had, the blocks that need it fail where they stand, each with its own „Újra".

struct LevelMa: View {
    let store: LevelStore
    let now: Date
    var onFiokok: () -> Void
    var onAsk: () -> Void
    var toast: (String) -> Void
    @State private var openRest: Set<String> = []
    private let hue = levelHue

    var body: some View {
        switch levelMailboxMode(store.mailbox) {
        case .needsConnect, .authFailed: disconnected
        default: ready
        }
    }

    // MARK: States

    @ViewBuilder private var ready: some View {
        if let d = store.digest {
            digest(d)
        } else if case .failed(let e) = store.digestState {
            ForEach(["Határidős", "Csomagok", "Akciók és lehetőségek"], id: \.self) { label in
                NKBare(label, hue: hue, glyph: Self.glyph(label),
                       state: .failed(e == .offline ? "Nincs net, és még nincs elmentett adatom." : "A szerver most nem válaszolt.",
                                      { Task { await store.refresh() } })) { EmptyView() }
            }
            NKAskRow(hue: hue, text: "Kérdezd meg Boopot a leveleidről", action: onAsk)
        } else {
            // loading (or not yet started): the skeleton is the kit's own loading state, one per block
            ForEach(["Először ezek", "Határidős", "Csomagok"], id: \.self) { label in
                NKBare(label, hue: hue, glyph: Self.glyph(label), state: .loading) { EmptyView() }
            }
        }
    }

    private static func glyph(_ label: String) -> String {
        switch label {
        case "Először ezek": "person-sage"
        case "Határidős": "clock-ink"
        case "Csomagok": "plate-deep"
        case "Akciók és lehetőségek": "star-sun"
        default: "e-level"
        }
    }

    /// Nothing is connected: the page points to Fiókok instead of showing an empty day.
    private var disconnected: some View {
        Group {
            VStack(alignment: .leading, spacing: 12) {
                Text("A Boop még nem lát postát").nkFont(23, design: .serif).foregroundStyle(.white)
                Text("Lépj be a Google-fiókoddal: a Boop csak olvas, soha nem küld, nem töröl, és a jelszavadat nem kapja meg.")
                    .nkFont(14.5).lineSpacing(4).foregroundStyle(.white.opacity(0.8))
                    .fixedSize(horizontal: false, vertical: true)
                Button(action: onFiokok) {
                    HStack(spacing: 8) {
                        Text("Fiókok megnyitása").nkFont(14.5, .semibold)
                        Image(systemName: "arrow.right").nkFont(12, .bold)
                    }
                    .foregroundStyle(NK.ground)
                    .padding(.horizontal, 18).frame(height: 44).background(Capsule().fill(.white))
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain).padding(.top, 4)
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(LinearGradient(colors: [hue.glow.opacity(0.24), hue.glow.opacity(0.04)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(hue.glow.opacity(0.4))))
            NKAskRow(hue: hue, text: "Kérdezd meg Boopot a leveleidről", action: onAsk)
        }
    }

    // MARK: The day

    @ViewBuilder private func digest(_ d: LevelDigest) -> some View {
        let quiet = d.arrived == 0 && d.worthAMinute == 0
        VStack(alignment: .leading, spacing: 22) {
            if let note = levelRulesNote(d) { NKNote(note, hue: hue) }
            if quiet {
                emptyHighlight
            } else if let h = levelHighlight(d, now: now) {
                NKHighlight(hue: hue, label: h.eyebrow, text: levelPlain(h.title), sub: levelPlain(h.sub),
                            actions: [NKHighlightAction("Megnyitás a Gmailben", weight: .link) { levelOpen(levelGmailURLs(messageId: h.item.gmailMessageId)) }],
                            badge: levelHighlightScore(h).map { AnyView(LevelScoreChip(n: $0)) })
            }
            NKStatRow(levelStats(d), hue: hue)
            if let heat = levelHeat(d) {
                NKBare("Mikor érkezik", hue: hue, glyph: "clock-ink") { NKHeatStrip(cells: heat.cells, hue: hue, note: heat.note) }
            }
            people(d)
            deadlines(d)
            parcels(d)
            deals(d)
            rest(d)
            NKAskRow(hue: hue, text: "Kérdezd meg Boopot a leveleidről", action: onAsk)
        }
        .nkStale(levelStale(isStale: store.isStale, age: store.digestAge))
    }

    private var emptyHighlight: some View {
        HStack(spacing: 14) {
            StillOrb(palette: hue.orb, size: 34, level: 0.9)
            Text("Reggel óta nem jött levél, ami rád várna. Jó nap, nincs mit nézned.")
                .nkFont(19, design: .serif).lineSpacing(3).foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 28, style: .continuous)
            .fill(LinearGradient(colors: [hue.glow.opacity(0.2), hue.glow.opacity(0.03)], startPoint: .topLeading, endPoint: .bottomTrailing))
            .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(hue.glow.opacity(0.35))))
    }

    // MARK: Blocks

    @ViewBuilder private func people(_ d: LevelDigest) -> some View {
        let rows = levelPeopleRows(d)
        if !rows.isEmpty {
            NKBare("Először ezek", hue: hue, glyph: "person-sage") {
                VStack(spacing: 0) {
                    ForEach(Array(rows.enumerated()), id: \.element.id) { i, r in
                        if i > 0 { LevelHairline() }
                        Button { levelOpen(levelGmailURLs(messageId: r.item.gmailMessageId)) } label: {
                            HStack(spacing: 12) {
                                ZStack {
                                    Circle().fill(r.hot ? hue.glow.opacity(0.22) : .white.opacity(0.08))
                                    NKGlyph(r.glyph, r.hot ? hue.glow : .white.opacity(0.9), size: 16)
                                }
                                .frame(width: 40, height: 40)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(r.title).nkFont(14.5, .medium).foregroundStyle(.white).lineLimit(1)
                                    Text(r.sub).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
                                }
                                Spacer(minLength: 6)
                                if !r.right.isEmpty {
                                    Text(r.right).nkFont(12, .medium).foregroundStyle(.white.opacity(0.5))
                                }
                                Image(systemName: "arrow.up.right").nkFont(11, .semibold).foregroundStyle(.white.opacity(0.4))
                            }
                            .padding(.vertical, 10).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain).accessibilityElement(children: .combine)
                    }
                }
            }
        }
    }

    private func deadlines(_ d: LevelDigest) -> some View {
        let rows = levelDueMarkRows(d.deadlines, now: now)
        return NKBare("Határidős", hue: hue, glyph: "clock-ink") {
            if rows.isEmpty {
                Text("Nincs közelgő határidő.").nkFont(14.5).foregroundStyle(.white.opacity(0.65))
            } else {
                markRows(rows)
            }
        }
    }

    @ViewBuilder private func parcels(_ d: LevelDigest) -> some View {
        let rows = levelParcelRows(d.parcels)
        if !rows.isEmpty { NKBare("Csomagok", hue: hue, glyph: "plate-deep") { markRows(rows) } }
    }

    private func markRows(_ rows: [LevelMarkRow]) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { i, r in
                if i > 0 { LevelHairline() }
                LevelMarkRowView(row: r) { levelOpen(levelGmailURLs(messageId: r.item.gmailMessageId)) }
            }
        }
    }

    @ViewBuilder private func deals(_ d: LevelDigest) -> some View {
        let items = levelDealsOrdered(d)
        if !items.isEmpty {
            NKBare("Akciók és lehetőségek", hue: hue, glyph: "star-sun") {
                VStack(spacing: 12) {
                    ForEach(items) { item in
                        LevelDealCard(face: levelDealFace(item, now: now), pick: store.verdicts[item.id],
                                      onVerdict: { v in send(item, v) },
                                      onOpen: { levelOpen(levelGmailURLs(messageId: item.gmailMessageId)) })
                    }
                }
            }
        }
    }

    @ViewBuilder private func rest(_ d: LevelDigest) -> some View {
        let groups = d.rest.filter { $0.count > 0 }
        if !groups.isEmpty {
            NKBare("A többi", hue: hue, glyph: "e-level") {
                VStack(spacing: 0) {
                    ForEach(Array(groups.enumerated()), id: \.offset) { i, g in
                        if i > 0 { LevelHairline(inset: 0) }
                        LevelRestRow(category: levelPlain(g.category), count: g.count, lines: g.items,
                                     open: openRest.contains(g.category)) {
                            withAnimation(.easeInOut(duration: 0.2)) { openRest = levelToggleFold(openRest, g.category) }
                        }
                    }
                    Text("Elolvastam és elrendeztem őket — egyik sem kötődik a céljaidhoz.")
                        .nkFont(12.5).foregroundStyle(.white.opacity(0.5)).padding(.top, 6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func send(_ item: LevelItem, _ verdict: LevelVerdict) {
        // Tapping the pick he already made changes nothing: the server has no "take it back".
        guard store.verdicts[item.id] != verdict else { return }
        Task {
            switch await store.feedback(item: item.id, verdict: verdict) {
            case .failed(let e): toast(levelErrorText(e))
            default: break   // .done / .ignored (a tap already in flight) / .cooldown — nothing to say
            }
        }
    }
}
