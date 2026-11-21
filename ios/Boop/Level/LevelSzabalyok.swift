import SwiftUI
import BoopCore
import BoopDesign

// MARK: - Szabályok (level-3-szabalyok)
//
// The seed categories are the server's and cannot be touched; the owner's own senders are added and taken off here;
// a proposal is one tap. Every change goes out as the owner's whole rule set (`LevelRules.ownerRequest`), and the
// server answers with the rules as they now are.

struct LevelSzabalyok: View {
    let store: LevelStore
    var toast: (String) -> Void
    @State private var newSender = ""
    @State private var busy = false
    private let hue = levelHue

    var body: some View {
        switch store.rulesState {
        case .loaded: loaded
        case .failed(let e):
            NKBare("Amit gép soha nem olvas", hue: hue, glyph: "scale-ink",
                   state: .failed(levelErrorText(e), { Task { await store.loadRules() } })) { EmptyView() }
        case .idle, .loading:
            if store.rules != nil { loaded } else {
                NKBare("Amit gép soha nem olvas", hue: hue, glyph: "scale-ink", state: .loading) { EmptyView() }
            }
        }
    }

    @ViewBuilder private var loaded: some View {
        let rules = store.rules ?? LevelRules()
        NKBare("Amit gép soha nem olvas", hue: hue, glyph: "scale-ink") {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(rules.sensitive.filter { $0.origin == .seed }.enumerated()), id: \.offset) { _, r in
                    HStack(spacing: 12) {
                        Image(systemName: "lock").nkFont(13, .semibold).foregroundStyle(.white.opacity(0.6)).frame(width: 24)
                        Text(levelPlain(r.pattern)).nkFont(15).foregroundStyle(.white)
                        Spacer()
                        Text("mindig").nkFont(12).foregroundStyle(.white.opacity(0.4))
                    }
                    .padding(.vertical, 11).accessibilityElement(children: .combine)
                    LevelHairline(inset: 36)
                }
                ForEach(Array(rules.sensitive.filter { $0.origin != .seed }.enumerated()), id: \.offset) { _, r in
                    removable(r.pattern, sub: "te tetted ide") { await change(levelRulesRemoving(rules, .sensitive, pattern: r.pattern)) }
                }
                HStack(spacing: 10) {
                    TextField("", text: $newSender, prompt: Text("Feladó, akit se olvassak").foregroundStyle(.white.opacity(0.4)))
                        .nkFont(14.5).foregroundStyle(.white)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                        .padding(.horizontal, 14).frame(height: 44)
                        .background(Capsule().fill(.white.opacity(0.08))).overlay(Capsule().stroke(.white.opacity(0.14)))
                        .onSubmit { addSender(rules) }
                    Button { addSender(rules) } label: {
                        Text("Ezt se olvasd").nkFont(14, .semibold).foregroundStyle(NK.ground)
                            .lineLimit(1).fixedSize().padding(.horizontal, 14).frame(height: 44).background(Capsule().fill(.white))
                            .opacity(levelRulesAdding(rules, .sensitive, pattern: newSender) == nil ? 0.5 : 1)
                    }
                    .buttonStyle(.plain).disabled(busy || levelRulesAdding(rules, .sensitive, pattern: newSender) == nil)
                }
                .padding(.top, 14)
            }
        }
        let always = rules.always.filter { $0.origin != .seed }
        if !always.isEmpty {
            NKBare("Amit mindig megmutatok", hue: hue, glyph: "star-sun") {
                VStack(spacing: 0) {
                    ForEach(Array(always.enumerated()), id: \.offset) { _, r in
                        removable(r.pattern, sub: "érdekel volt") { await change(levelRulesRemoving(rules, .always, pattern: r.pattern)) }
                    }
                }
            }
        }
        let silent = rules.silent.filter { $0.origin != .seed }
        if !silent.isEmpty {
            NKBare("Amit csendben eltészek", hue: hue, glyph: "plate-deep") {
                VStack(spacing: 0) {
                    ForEach(Array(silent.enumerated()), id: \.offset) { _, r in
                        removable(r.pattern, sub: "nem érdekel volt") { await change(levelRulesRemoving(rules, .silent, pattern: r.pattern)) }
                    }
                }
            }
        }
        ForEach(Array(rules.proposals.enumerated()), id: \.offset) { _, p in proposal(p, rules) }
        NKBare("Mikor csenget a telefon", hue: hue, glyph: "clock-ink") {
            NKNote("Csak akkor szólok, ha valami *ma vagy holnap lejár*. Naponta legfeljebb egy-két értesítést küldök, és ezen a Boop többi része is osztozik — nem lesz tőlem több.",
                   hue: hue)
        }
    }

    private func proposal(_ p: LevelSilentProposal, _ rules: LevelRules) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 9) {
                StillOrb(palette: hue.orb, size: 22, level: 0.85)
                NKMono("JAVASLAT")
            }
            Text("\(levelPlain(p.fromAddress)) leveleit \(levelTimesWord(p.nopes)) dobtad el — tegyem csendben félre?")
                .nkFont(20, design: .serif).lineSpacing(3).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            Button { Task { await change(levelRulesAdding(rules, .silent, pattern: p.fromAddress)) } } label: {
                Text("Igen, tedd félre").nkFont(14.5, .semibold).foregroundStyle(NK.ground)
                    .padding(.horizontal, 18).frame(height: 44).background(Capsule().fill(.white)).contentShape(Capsule())
            }
            .buttonStyle(.plain).disabled(busy)
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 26, style: .continuous)
            .fill(LinearGradient(colors: [hue.glow.opacity(0.24), hue.glow.opacity(0.04)], startPoint: .topLeading, endPoint: .bottomTrailing))
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(hue.glow.opacity(0.4))))
    }

    private func removable(_ name: String, sub: String, remove: @escaping () async -> Void) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                ZStack { Circle().fill(.white.opacity(0.08)); NKGlyph("person-sage", .white.opacity(0.9), size: 14) }.frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(levelPlain(name)).nkFont(15).foregroundStyle(.white)
                    Text(sub).nkFont(12).foregroundStyle(.white.opacity(0.5))
                }
                Spacer()
                Button { Task { await remove() } } label: {
                    Text("Töröl").nkFont(12.5, .semibold).foregroundStyle(.white.opacity(0.8))
                        .padding(.horizontal, 12).frame(height: 36).background(Capsule().fill(.white.opacity(0.1)))
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain).disabled(busy)
            }
            .padding(.vertical, 10)
            LevelHairline(inset: 44)
        }
    }

    private func addSender(_ rules: LevelRules) {
        guard let req = levelRulesAdding(rules, .sensitive, pattern: newSender) else { return }
        Task {
            if await save(req) { newSender = "" }
        }
    }

    private func change(_ request: LevelRulesRequest?) async {
        guard let request else { return }
        _ = await save(request)
    }

    private func save(_ request: LevelRulesRequest) async -> Bool {
        guard !busy else { return false }
        busy = true
        defer { busy = false }
        switch await store.saveRules(request) {
        case .done: return true
        case .failed(let e): toast(levelErrorText(e)); return false
        default: return false
        }
    }
}
