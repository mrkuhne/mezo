import SwiftUI

// Round 4 (owner, 2026-11-13): an area is its own app. Each page = painted head → its own top tabs →
// a composed dashboard (highlight · stat tiles · a real curve · composition · detailed rows · a menu grid
// of what else the area can do). One data-driven component, so all seven areas are real.

enum EBlock {
    case highlight(label: String, text: String, sub: String)
    case stats([EStat])
    case level(label: String, big: String, unit: String, right: String, note: String, value: Double, marker: Double?)
    case curve(label: String, values: [Double], labels: [String], target: Double?, now: Int?, note: String)
    case composition(label: String, parts: [EPart], note: String)
    case rowlist(label: String, rows: [ERow], more: String)
    case heat(label: String, cells: [(String, Double)], note: String)
    case menu(label: String, items: [EMenuItem])
    case list(label: String, items: [(String, String)])
    case note(label: String, body: String)
    case mail(label: String, items: [MailItem])
    case ask(String)
}

struct ETab { let name: String; var badge: Int = 0; let blocks: [EBlock] }

struct MailItem: Identifiable {
    let id = UUID()
    let from: String, what: String, score: Int
    let price: String, goal: String
    let verdict: Int          // 0 cheaper · 1 usual · 2 unknown
    var verdictText: String { ["Olcsóbb, mint máshol", "A szokásos ára", "Nem tudtam ellenőrizni"][verdict] }
    var verdictHue: Color { [Color(hex: 0x5FD08A), Color(hex: 0xE8C25A), Color(hex: 0x9AA3AE)][verdict] }
}

// MARK: - The page

struct EletAreaPage: View {
    var metric: Int
    var onToast: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var tab = 0

    private var m: EMetric { EMetric.all[min(metric, 6)] }
    private var tabs: [ETab] { EAreaContent.tabs(metric) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                head
                tabBar.padding(.top, 14)
                LazyVStack(alignment: .leading, spacing: 14) {
                    ForEach(Array(tabs[min(tab, tabs.count - 1)].blocks.enumerated()), id: \.offset) { _, b in
                        block(b)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 80)
                .id(tab)
                .transition(.opacity)
            }
        }
        .scrollIndicators(.hidden)
        .background(gPageBackground(m.top).ignoresSafeArea())
        .ignoresSafeArea(edges: .top)
        .toolbar(.hidden, for: .navigationBar)
        .overlay(alignment: .topLeading) { backButton { dismiss() } }
        .overlay(alignment: .topTrailing) {
            HStack(spacing: 8) {
                Button { onToast("Keresés · " + m.name) } label: {
                    AuraGlyph("search-ink", .white, size: 17).frame(width: 40, height: 40)
                }
                .buttonStyle(.plain).glassEffect(.clear.interactive(), in: .circle)
                Button { onToast(m.name + " beállításai") } label: {
                    AuraGlyph("repeat-deep", .white, size: 17).frame(width: 40, height: 40)
                }
                .buttonStyle(.plain).glassEffect(.clear.interactive(), in: .circle)
            }
            .padding(.trailing, 14).padding(.top, 56)
        }
    }

    private var head: some View {
        GHead(sky: m.sky, height: 300)
            .overlay(alignment: .bottomLeading) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        EGlyph(m.glyph, .white, size: 20)
                        Text(m.name.uppercased()).font(AuraFont.mono(12, .bold)).tracking(2).foregroundStyle(.white.opacity(0.8))
                        Spacer()
                        HStack(spacing: 9) {
                            Text("\(m.value)").font(.custom("Outfit", size: 26).weight(.light)).foregroundStyle(.white)
                            StillOrb(colors: m.orb, size: 34, level: Double(m.value) / 100)
                        }
                    }
                    Text(m.headline).font(AuraFont.serif(34)).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(m.sentence).font(.system(size: 15.5)).lineSpacing(4).foregroundStyle(.white.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 20).padding(.bottom, 6)
            }
    }

    private var tabBar: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(tabs.indices, id: \.self) { i in
                    let on = i == tab
                    HStack(spacing: 7) {
                        Text(tabs[i].name)
                            .font(.system(size: 14.5, weight: on ? .semibold : .regular))
                            .foregroundStyle(on ? gBase : .white.opacity(0.75))
                        if tabs[i].badge > 0 {
                            Text("\(tabs[i].badge)")
                                .font(.custom("Outfit", size: 12).weight(.semibold))
                                .foregroundStyle(on ? gBase.opacity(0.8) : m.glow)
                                .frame(minWidth: 18, minHeight: 18)
                                .background(Circle().fill(on ? gBase.opacity(0.13) : m.glow.opacity(0.25)))
                        }
                    }
                    .padding(.horizontal, 15).frame(height: 38)
                    .background(Capsule().fill(on ? .white : .white.opacity(0.1)))
                    .contentShape(Capsule())
                    .onTapGesture { withAnimation(.easeInOut(duration: 0.22)) { tab = i } }
                }
            }
            .padding(.horizontal, 16)
        }
        .scrollIndicators(.hidden)
    }

    // MARK: Blocks

    @ViewBuilder private func block(_ b: EBlock) -> some View {
        switch b {
        case let .highlight(label, text, sub):
            EHighlight(label: label, text: text, sub: sub, hue: m.glow, orb: m.orb)

        case let .stats(s):
            EStatRow(stats: s, hue: m.glow)

        case let .level(label, big, unit, right, note, value, marker):
            card {
                GLabel(label)
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(big).font(.custom("Outfit", size: 38).weight(.light)).foregroundStyle(.white)
                    Text(unit).font(.system(size: 15)).foregroundStyle(.white.opacity(0.6))
                    Spacer()
                    Text(right).font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
                }
                .padding(.top, 10)
                ELevelBar(level: value, hue: m.glow, marker: marker).padding(.top, 10)
                if !note.isEmpty {
                    Text(note).font(.system(size: 12.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.55))
                        .fixedSize(horizontal: false, vertical: true).padding(.top, 8)
                }
            }

        case let .curve(label, values, labels, target, now, note):
            card {
                HStack(alignment: .firstTextBaseline) {
                    GLabel(label)
                    Spacer()
                    if target != nil {
                        HStack(spacing: 6) {
                            Rectangle().fill(.white.opacity(0.55)).frame(width: 14, height: 1)
                            Text("a cél").font(.system(size: 11)).foregroundStyle(.white.opacity(0.5))
                        }
                    }
                }
                ECurve(values: values, labels: labels, hue: m.glow, target: target, nowIndex: now)
                    .padding(.top, 14)
                if !note.isEmpty {
                    Text(note).font(.system(size: 13)).lineSpacing(3).foregroundStyle(.white.opacity(0.65))
                        .fixedSize(horizontal: false, vertical: true).padding(.top, 12)
                }
            }

        case let .composition(label, parts, note):
            card {
                GLabel(label)
                EComposition(parts: parts).padding(.top, 14)
                if !note.isEmpty {
                    Text(note).font(.system(size: 12.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.6))
                        .fixedSize(horizontal: false, vertical: true).padding(.top, 12)
                }
            }

        case let .rowlist(label, rows, more):
            card {
                GLabel(label)
                ERowList(rows: rows, hue: m.glow) { onToast($0) }.padding(.top, 6)
                if !more.isEmpty {
                    Button { onToast(more) } label: {
                        HStack {
                            Text(more).font(.system(size: 14, weight: .medium)).foregroundStyle(.white.opacity(0.85))
                            Spacer()
                            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.45))
                        }
                        .padding(.top, 12).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }

        case let .heat(label, cells, note):
            card {
                GLabel(label)
                EHeat(cells: cells, hue: m.glow, note: note).padding(.top, 14)
            }

        case let .menu(label, items):
            VStack(alignment: .leading, spacing: 12) {
                GLabel(label).padding(.leading, 2)
                EMenuGrid(items: items, hue: m.glow) { onToast($0 + " · megnyílik") }
            }

        case let .list(label, items):
            card {
                GLabel(label)
                VStack(alignment: .leading, spacing: 13) {
                    ForEach(Array(items.enumerated()), id: \.offset) { _, it in
                        HStack(alignment: .top, spacing: 12) {
                            Circle().fill(m.glow.opacity(0.7)).frame(width: 6, height: 6).padding(.top, 6)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(it.0).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white.opacity(0.95))
                                Text(it.1).font(.system(size: 13)).lineSpacing(3).foregroundStyle(.white.opacity(0.6))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer(minLength: 0)
                        }
                    }
                }
                .padding(.top, 14)
            }

        case let .note(label, body):
            card {
                GLabel(label)
                Text(body).font(.system(size: 14.5)).lineSpacing(4).foregroundStyle(.white.opacity(0.82))
                    .fixedSize(horizontal: false, vertical: true).padding(.top, 10)
            }

        case let .mail(label, items):
            VStack(alignment: .leading, spacing: 12) {
                GLabel(label).padding(.leading, 2)
                ForEach(items) { mailCard($0) }
            }

        case let .ask(text):
            EAskRow(text: text) { onToast("Új szál nyílik · a terület adataival") }
        }
    }

    @ViewBuilder private func card<C: View>(@ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 0) { c() }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard(22)
    }

    private func mailCard(_ it: MailItem) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(it.from.uppercased()).font(AuraFont.mono(11, .bold)).tracking(1.4).foregroundStyle(.white.opacity(0.6))
                    Text(it.what).font(AuraFont.serif(20)).lineSpacing(3).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 10)
                EScore(n: it.score, hue: m.glow)
            }
            HStack(spacing: 7) {
                Circle().fill(it.verdictHue).frame(width: 7, height: 7)
                Text(it.verdictText).font(.system(size: 13, weight: .semibold)).foregroundStyle(it.verdictHue)
            }
            .padding(.top, 12)
            Text(it.price).font(.system(size: 13.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.75))
                .fixedSize(horizontal: false, vertical: true).padding(.top, 5)
            HStack(alignment: .top, spacing: 10) {
                StillOrb(colors: EMetric.all[0].orb, size: 20, level: 0.85)
                Text(it.goal).font(.system(size: 13.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 12)
            HStack(spacing: 8) {
                EPill(title: "Megnyitom") { onToast("A levél megnyílik") }
                EPill(title: "Nem érdekel", primary: false) { onToast("Megjegyeztem — a márkát ezentúl szűröm") }
                Spacer(minLength: 0)
            }
            .padding(.top, 14)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard(22)
    }
}

func backButton(_ action: @escaping () -> Void) -> some View {
    Button(action: action) {
        Image(systemName: "chevron.left").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
            .frame(width: 44, height: 44)
    }
    .buttonStyle(.plain)
    .glassEffect(.clear.interactive(), in: .circle)
    .padding(.leading, 14)
    .padding(.top, 54)
}
