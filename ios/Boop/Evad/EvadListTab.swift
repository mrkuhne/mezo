import SwiftUI
import BoopCore
import BoopDesign

/// **Lista** (screen 06, Évad S3): the shopping list of the approved menu — grouped by shelf, every line with its
/// amount and „mihez kell", ticked off (kept on the server), a „változott" section after a mid-week change, his staples
/// as chips that join only on his tap, plain-text sharing and the past lists.
struct EvadListTab: View {
    let menu: EvadMenuStore
    let openPast: @MainActor @Sendable () -> Void
    let openStaples: @MainActor @Sendable () -> Void
    let openMenu: @MainActor @Sendable () -> Void

    var body: some View {
        Group {
            if let l = menu.list {
                content(l)
            } else if menu.listMissing {
                NKHighlight(hue: evadHue, label: "Bevásárlólista",
                            text: "Ha jóváhagyod a heti menüt, itt lesz a bevásárlólista.",
                            sub: "Összeadom az összes hozzávalót, polcok szerint csoportosítom, és minden tétel alatt látod, melyik ételhez kell.",
                            actions: [NKHighlightAction("A menühöz", action: openMenu)])
                NKActions([NKAction(glyph: "repeat-deep", title: "Korábbi listák", action: openPast)], hue: evadHue)
            } else if let p = menu.listProblem {
                NKBare("Bevásárlólista", hue: evadHue, glyph: "check-ink", state: .failed(evadErrorText(p), {
                    Task { await menu.loadList(force: true) }
                })) { EmptyView() }
            } else {
                NKBare("Bevásárlólista", hue: evadHue, glyph: "check-ink", state: .loading) { EmptyView() }
            }
        }
        .task { await menu.loadList() }
    }

    @ViewBuilder private func content(_ l: EvadShoppingList) -> some View {
        NKBare("Bevásárlólista · \(evadWeekRange(l.weekStart))", hue: evadHue, glyph: "check-ink",
               trailing: "\(l.items.filter { $0.checked && !$0.removed }.count)/\(l.items.filter { !$0.removed }.count) a kosárban") {
            Text("A jóváhagyott menü alapján. Minden tétel alatt látod, melyik ételhez kell.")
                .nkFont(13).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
            if let age = menu.listAgeText { EvadLine(text: "Offline vagy, ez a \(age) lista.") }
            if let problem = menu.actionProblem { EvadLine(text: problem) }
        }
        let changed = evadChangedItems(l)
        if !changed.isEmpty {
            NKBare("Változott", hue: evadHue, glyph: "repeat-deep", trailing: "a hét közbeni módosítás után") {
                VStack(spacing: 0) {
                    ForEach(changed) { i in
                        HStack(spacing: 12) {
                            Text(i.name).nkFont(15, .medium).foregroundStyle(.white.opacity(i.removed ? 0.5 : 1))
                                .strikethrough(i.removed)
                            Spacer()
                            Text(i.removed ? "már nem kell" : (i.amountText ?? "")).font(.nkNumber(14))
                                .foregroundStyle(.white.opacity(0.7))
                        }
                        .padding(.vertical, 8)
                    }
                }
            }
        }
        ForEach(evadShelfGroups(l), id: \.key) { g in
            NKBare(g.title, hue: evadHue, glyph: g.glyph) {
                VStack(spacing: 0) {
                    ForEach(g.items) { item in row(item) }
                }
            }
        }
        if !l.staples.isEmpty {
            NKBare("Szokásos tételek", hue: evadHue, glyph: "star-ink", trailing: "koppints, ha kell") {
                NKFlowRow {
                    ForEach(l.staples) { chip in
                        Button { Task { await menu.toggleStaple(chip) } } label: {
                            Text(chip.onList ? chip.name : "+ \(chip.name)").nkFont(13.5, chip.onList ? .semibold : .regular)
                                .foregroundStyle(chip.onList ? NK.ground : .white.opacity(0.85))
                                .padding(.horizontal, 13).padding(.vertical, 8)
                                .background(Capsule().fill(chip.onList ? .white.opacity(0.92) : .white.opacity(0.1)))
                        }
                        .buttonStyle(.plain)
                        .disabled(menu.busy)
                        .accessibilityValue(chip.onList ? "a listán" : "nincs a listán")
                    }
                }
            }
        }
        HStack(spacing: 10) {
            ShareLink(item: evadShareText(l)) {
                HStack(spacing: 8) {
                    NKGlyph("chat-ink", NK.ground, size: 15)
                    Text("Megosztás").nkFont(15, .semibold)
                }
                .foregroundStyle(NK.ground)
                .padding(.horizontal, 18).padding(.vertical, 12)
                .background(Capsule().fill(.white.opacity(0.95)))
            }
            Spacer(minLength: 0)
        }
        NKActions([NKAction(glyph: "repeat-deep", title: "Korábbi listák", action: openPast),
                   NKAction(glyph: "star-ink", title: "Szokásos tételek", action: openStaples)], hue: evadHue)
    }

    private func row(_ item: EvadShoppingItem) -> some View {
        let on = item.checked
        return Button { Task { await menu.toggle(item) } } label: {
            HStack(spacing: 12) {
                EvadTick(on: on)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name).nkFont(15.5, .medium).foregroundStyle(.white.opacity(on ? 0.45 : 1)).strikethrough(on)
                    if !item.forRecipes.isEmpty {
                        Text(item.forRecipes.joined(separator: ", ")).nkFont(12).foregroundStyle(.white.opacity(0.45))
                            .lineLimit(2)
                    }
                }
                Spacer()
                if let a = item.amountText {
                    Text(a).font(.nkNumber(15)).foregroundStyle(.white.opacity(on ? 0.4 : 0.8))
                }
            }
            .padding(.vertical, 10).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityValue(on ? "megvan" : "még kell")
    }
}

/// The round check-off mark: an empty ring, or a filled one with a drawn tick (no system symbols).
struct EvadTick: View {
    let on: Bool
    var body: some View {
        ZStack {
            Circle().stroke(.white.opacity(on ? 0 : 0.4), lineWidth: 1.5)
            if on {
                Circle().fill(evadHue.glow)
                Path { p in
                    p.move(to: CGPoint(x: 6.5, y: 11.5)); p.addLine(to: CGPoint(x: 9.8, y: 14.8))
                    p.addLine(to: CGPoint(x: 15.8, y: 7.8))
                }
                .stroke(NK.ground, style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round))
            }
        }
        .frame(width: 22, height: 22)
    }
}

/// **Kiválasztott receptek**: the recipes the menu may use. A recipe his rules keep out of every menu is shown with
/// the reason and cannot be chosen. Saved with „Mentés" (no kcal effect, so no preview).
struct EvadRecipesPage: View {
    let close: @MainActor @Sendable () -> Void
    @Environment(EvadStore.self) private var store: EvadStore?
    @State private var options: [EvadRecipeOption]?
    @State private var chosen: Set<String> = []
    @State private var problem: String?
    @State private var saving = false

    private static let groups: [(String, String)] = [("breakfast", "Reggeli"), ("lunch", "Ebéd"), ("dinner", "Vacsora"),
                                                     ("snack", "Uzsonna")]

    var body: some View {
        NKAreaSubPage(hue: evadHue, crumb: "Évad", eyebrow: "Heti menü", title: "Kiválasztott receptek",
                      sentence: "A heti menü *csak ezekből* áll össze. Minél többet választasz, annál változatosabb lesz.",
                      onBack: close) {
            if let problem { EvadLine(text: problem) }
            if let options {
                let usable = options.filter(\.usable)
                NKBare("Kijelölve", hue: evadHue, glyph: "book-sage", trailing: "\(chosen.count) / \(usable.count)") {
                    HStack(spacing: 10) {
                        smallButton("Mind") { chosen = Set(usable.map(\.id)) }
                        smallButton("Egyik sem") { chosen = [] }
                    }
                }
                ForEach(Self.groups, id: \.0) { key, title in
                    let rows = options.filter { $0.category == key }
                    if !rows.isEmpty {
                        NKBare(title, hue: evadHue, glyph: "bowl-sage") {
                            VStack(spacing: 0) { ForEach(rows) { recipeRow($0) } }
                        }
                    }
                }
                NKActions([NKAction(glyph: "check-ink", title: saving ? "Mentem…" : "Mentés", primary: true, action: save),
                           NKAction(title: "Mégsem", action: close)], hue: evadHue)
            } else if problem == nil {
                NKBare("Receptek", hue: evadHue, glyph: "book-sage", state: .loading) { EmptyView() }
            }
        }
        .evadReviewAnchor()
        .task {
            guard options == nil, let menu = store?.menu else { return }
            do throws(PlanFetchError) {
                let o = try await menu.recipes()
                options = o
                chosen = Set(o.filter { $0.allowed && $0.usable }.map(\.id))
            } catch { problem = evadErrorText(error) }
        }
    }

    private func recipeRow(_ r: EvadRecipeOption) -> some View {
        let on = chosen.contains(r.id)
        return Button {
            guard r.usable else { return }
            if on { chosen.remove(r.id) } else { chosen.insert(r.id) }
        } label: {
            HStack(spacing: 12) {
                EvadTick(on: on).opacity(r.usable ? 1 : 0.3)
                VStack(alignment: .leading, spacing: 2) {
                    Text(r.name).nkFont(15, .medium).foregroundStyle(.white.opacity(r.usable ? 1 : 0.45))
                    if let reason = r.reason {
                        Text(reason).nkFont(12).foregroundStyle(.white.opacity(0.45))
                    }
                }
                Spacer()
                if let k = r.kcal { Text("\(k)").font(.nkNumber(14)).foregroundStyle(.white.opacity(0.6)) }
            }
            .padding(.vertical, 9).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!r.usable)
    }

    private func smallButton(_ title: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(13.5).foregroundStyle(.white.opacity(0.9))
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(Capsule().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
    }

    private func save() {
        guard let store, let id = store.overview?.season.id, !saving else { return }
        saving = true
        let ids = (options ?? []).filter { chosen.contains($0.id) }.map(\.id)
        Task {
            defer { saving = false }
            do throws(PlanFetchError) {
                try await store.menu.putRecipes(seasonId: id, ids)
                await store.load(force: true)
                close()
            } catch { problem = evadErrorText(error) }
        }
    }
}

/// **Korábbi listák**: every list of his, newest week first; a tap opens that week's list (read only).
struct EvadPastListsPage: View {
    let close: @MainActor @Sendable () -> Void
    @Environment(EvadStore.self) private var store: EvadStore?
    @State private var lists: [EvadShoppingListSummary]?
    @State private var open: EvadShoppingList?
    @State private var problem: String?

    var body: some View {
        NKAreaSubPage(hue: evadHue, crumb: "Évad", eyebrow: "Bevásárlás", title: "Korábbi listák",
                      sentence: "Minden jóváhagyott hét listája megmarad.", onBack: close) {
            if let problem { EvadLine(text: problem) }
            if let lists {
                if lists.isEmpty {
                    NKNote("Még nincs korábbi listád. Az első a heti menü jóváhagyásakor készül.", hue: evadHue)
                } else {
                    NKBare("Hetek", hue: evadHue, glyph: "check-ink") {
                        NKRowList(lists.map { s in
                            NKAreaRow(id: s.id, glyph: "check-ink", title: evadWeekRange(s.weekStart),
                                      sub: "\(s.itemCount) tétel, \(s.checkedCount) megvéve",
                                      action: { show(s.weekStart) })
                        }, hue: evadHue)
                    }
                }
            } else if problem == nil {
                NKBare("Hetek", hue: evadHue, glyph: "check-ink", state: .loading) { EmptyView() }
            }
            if let l = open {
                ForEach(evadShelfGroups(l), id: \.key) { g in
                    NKBare("\(evadWeekRange(l.weekStart)) · \(g.title)", hue: evadHue, glyph: g.glyph) {
                        VStack(spacing: 0) {
                            ForEach(g.items) { i in
                                HStack(spacing: 12) {
                                    EvadTick(on: i.checked)
                                    Text(i.name).nkFont(15).foregroundStyle(.white.opacity(i.checked ? 0.5 : 0.9))
                                    Spacer()
                                    if let a = i.amountText { Text(a).font(.nkNumber(14)).foregroundStyle(.white.opacity(0.6)) }
                                }
                                .padding(.vertical, 8)
                            }
                        }
                    }
                }
            }
        }
        .task {
            guard lists == nil, let menu = store?.menu else { return }
            do throws(PlanFetchError) { lists = try await menu.pastLists() } catch { problem = evadErrorText(error) }
        }
    }

    private func show(_ weekStart: String) {
        guard let menu = store?.menu else { return }
        Task {
            do throws(PlanFetchError) { open = try await menu.list(weekStart: weekStart) } catch { problem = evadErrorText(error) }
        }
    }
}

/// **Szokásos tételek**: his always-at-home items. They are offered as chips on every list and join it only on his tap.
struct EvadStaplesPage: View {
    let close: @MainActor @Sendable () -> Void
    @Environment(EvadStore.self) private var store: EvadStore?
    @State private var names: [String]?
    @State private var draft = ""
    @State private var problem: String?

    var body: some View {
        NKAreaSubPage(hue: evadHue, crumb: "Évad", eyebrow: "Bevásárlás", title: "Szokásos tételek",
                      sentence: "Ami mindig kell itthonra. A listán koppintással kerül fel, magától soha.", onBack: close) {
            if let problem { EvadLine(text: problem) }
            if var list = names {
                NKBare("A tételeid", hue: evadHue, glyph: "star-ink", trailing: "koppints a törléshez") {
                    if list.isEmpty { EvadLine(text: "Még nincs szokásos tételed.") }
                    NKFlowRow {
                        ForEach(list, id: \.self) { n in
                            Button { list.removeAll { $0 == n }; names = list } label: {
                                Text("\(n)  ×").nkFont(13.5).foregroundStyle(.white.opacity(0.9))
                                    .padding(.horizontal, 13).padding(.vertical, 8)
                                    .background(Capsule().fill(.white.opacity(0.1)))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(n) törlése")
                        }
                    }
                    HStack(spacing: 10) {
                        TextField("Új tétel", text: $draft)
                            .nkFont(15).foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 10)
                            .background(Capsule().fill(.white.opacity(0.08)))
                            .submitLabel(.done)
                            .onSubmit(add)
                        Button(action: add) {
                            NKGlyph("plus-ink", .white, size: 18).frame(width: 40, height: 40)
                                .background(Circle().fill(.white.opacity(0.1)))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Hozzáadás")
                    }
                }
                NKActions([NKAction(glyph: "check-ink", title: "Mentés", primary: true, action: save),
                           NKAction(title: "Mégsem", action: close)], hue: evadHue)
            } else if problem == nil {
                NKBare("A tételeid", hue: evadHue, glyph: "star-ink", state: .loading) { EmptyView() }
            }
        }
        .task {
            guard names == nil, let menu = store?.menu else { return }
            do throws(PlanFetchError) { names = try await menu.staples().names } catch { problem = evadErrorText(error) }
        }
    }

    private func add() {
        let n = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !n.isEmpty, n.count <= 80, var list = names,
              !list.contains(where: { $0.lowercased() == n.lowercased() }) else { draft = ""; return }
        list.append(n); names = list; draft = ""
    }

    private func save() {
        guard let menu = store?.menu, let names else { return }
        Task {
            do throws(PlanFetchError) { try await menu.putStaples(names); close() } catch { problem = evadErrorText(error) }
        }
    }
}
