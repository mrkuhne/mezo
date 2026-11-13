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
    @State private var motion = OrbMotion()

    private var m: EMetric { EMetric.all[min(metric, 7)] }
    private var tabs: [ETab] { EAreaContent.tabs(metric) }

    var body: some View {
        ZStack(alignment: .bottom) {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                head
                LazyVStack(alignment: .leading, spacing: EWarm.on ? 24 : 14) {
                    ForEach(Array(tabs[min(tab, tabs.count - 1)].blocks.enumerated()), id: \.offset) { _, b in
                        block(b)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 22).padding(.bottom, 124)
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
        areaBar
        }
        .onDisappear { motion.stop() }
    }

    /// Round 9 (owner, 2026-11-13): the area is its own app, so it gets its own masthead —
    /// the area's name where `boop` sits on Ma — and its own bottom bar in place of the spine's.
    private var head: some View {
        Group {
            if EWarm.on { EPhotoHead(metric: min(metric, 7), height: 356) }
            else { GHead(sky: m.sky, height: 326) }
        }
            .overlay(alignment: .top) {
                VStack(spacing: 7) {
                    EGlyph(m.glyph, .white.opacity(0.9), size: 19)
                    Text(m.name.lowercased())
                        .font(.custom("Outfit", size: 29).weight(.light))
                        .tracking(4.5)
                        .foregroundStyle(.white)
                }
                .padding(.top, 126)
            }
            .overlay(alignment: .bottomLeading) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Text(tabs[min(tab, tabs.count - 1)].name.uppercased())
                            .font(AuraFont.mono(12, .bold)).tracking(2).foregroundStyle(.white.opacity(0.65))
                        Spacer()
                        HStack(spacing: 9) {
                            Text("\(m.value)").font(.custom("Outfit", size: 26).weight(.light)).foregroundStyle(.white)
                            LivingOrb(mood: .good, size: 34, motion: motion, palette: m.orb,
                                      glow: false, level: Double(m.value) / 100)
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

    /// Each area's own bottom bar: its pages, plus one fixed way to ask Boop about this area.
    /// Icon + label, so four- and five-item bars read the same.
    private static func tabGlyph(_ name: String) -> String {
        switch name {
        case "Ma": return "sun-ink"
        case "Receptek": return "book-sage"
        case "Kamra": return "plate-deep"
        case "Gyakorlatok": return "dumbbell-ink"
        case "Check-inek": return "check-ink"
        case "Figyelt": return "search-ink"
        case "Szabályok": return "scale-ink"
        case "Fiókok": return "repeat-deep"
        case "Napirend", "Terv", "Tervezett": return "clock-ink"
        case "Mi hat rá": return "bolt-ink"
        default: return "chart-deep"
        }
    }

    private var areaBar: some View {
        GlassEffectContainer(spacing: 12) {
        HStack(spacing: 0) {
            ForEach(tabs.indices, id: \.self) { i in
                barItem(glyph: Self.tabGlyph(tabs[i].name), label: tabs[i].name,
                        badge: tabs[i].badge, on: i == tab)
                    .onTapGesture { withAnimation(.easeInOut(duration: 0.22)) { tab = i } }
            }
            barItem(glyph: "chat-ink", label: "Boop", badge: 0, on: false)
                .onTapGesture { onToast("Boop · " + m.name) }
        }
        .padding(.horizontal, 6).padding(.vertical, 7)
        .glassEffect(.regular, in: .capsule)
        }
        .padding(.horizontal, 14).padding(.bottom, 4)
    }

    private func barItem(glyph: String, label: String, badge: Int, on: Bool) -> some View {
        VStack(spacing: 4) {
            ZStack(alignment: .topTrailing) {
                EGlyph(glyph, on ? m.glow : .white.opacity(0.65), size: 19)
                if badge > 0 {
                    Text("\(badge)")
                        .font(.custom("Outfit", size: 10).weight(.semibold))
                        .foregroundStyle(gBase)
                        .frame(minWidth: 14, minHeight: 14)
                        .background(Circle().fill(m.glow))
                        .offset(x: 9, y: -6)
                }
            }
            .frame(height: 20)
            Text(label)
                .font(.system(size: 10.5, weight: on ? .semibold : .regular))
                .foregroundStyle(on ? .white : .white.opacity(0.6))
                .lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity).frame(height: 46)
        .background(
            Capsule().fill(on ? m.glow.opacity(0.16) : .clear)
        )
        .contentShape(Capsule())
    }

    // MARK: Blocks

    @ViewBuilder private func block(_ b: EBlock) -> some View {
        switch b {
        case let .highlight(label, text, sub) where EWarm.on:
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 9) {
                    StillOrb(colors: m.orb, size: 22, level: 0.85)
                    Text(label).font(AuraFont.mono(11, .bold)).tracking(1.5).foregroundStyle(m.glow)
                    Spacer()
                }
                Text(text).font(AuraFont.serif(23)).lineSpacing(3).foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true).padding(.top, 10)
                EHueText(text: sub, hue: m.glow, size: 14, opacity: 0.78).padding(.top, 7)
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(LinearGradient(colors: [m.glow.opacity(0.26), m.glow.opacity(0.04)],
                                         startPoint: .topLeading, endPoint: .bottomTrailing))
                    .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(m.glow.opacity(0.4)))
            )

        case let .highlight(label, text, sub):
            EHighlight(label: label, text: text, sub: sub, hue: m.glow, orb: m.orb)

        case let .stats(s):
            if EWarm.on { EStatRowWarm(stats: s, hue: m.glow).padding(.vertical, 2) }
            else { EStatRow(stats: s, hue: m.glow) }

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

        case let .curve(label, values, labels, target, now, note) where EWarm.on:
            EBare(label: label, hue: m.glow) {
                VStack(alignment: .leading, spacing: 12) {
                    ECurve(values: values, labels: labels, hue: m.glow, target: target, nowIndex: now, height: 150)
                    if !note.isEmpty {
                        EHueText(text: note, hue: m.glow, size: 13.5, opacity: 0.7)
                    }
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

        case let .composition(label, parts, note) where EWarm.on:
            EBare(label: label, hue: m.glow) {
                VStack(alignment: .leading, spacing: 12) {
                    EComposition(parts: parts)
                    if !note.isEmpty { EHueText(text: note, hue: m.glow, size: 13, opacity: 0.65) }
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

        case let .rowlist(label, rows, more) where EWarm.on:
            EBare(label: label, hue: m.glow) {
                VStack(alignment: .leading, spacing: 0) {
                    ERowList(rows: rows, hue: m.glow, warm: true) { onToast($0) }
                    if !more.isEmpty {
                        Button { onToast(more) } label: {
                            HStack(spacing: 7) {
                                Text(more).font(.system(size: 14, weight: .semibold)).foregroundStyle(m.glow)
                                Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)).foregroundStyle(m.glow)
                                Spacer()
                            }
                            .padding(.top, 14).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
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

        case let .list(label, items) where EWarm.on:
            EBare(label: label, hue: m.glow) {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(Array(items.enumerated()), id: \.offset) { _, it in
                        HStack(alignment: .top, spacing: 12) {
                            Capsule().fill(m.glow).frame(width: 2.5, height: 30)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(it.0).font(.system(size: 14.5, weight: .semibold)).foregroundStyle(.white)
                                EHueText(text: it.1, hue: m.glow, size: 13, opacity: 0.62)
                            }
                            Spacer(minLength: 0)
                        }
                    }
                }
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

        case let .note(label, body) where EWarm.on:
            EBare(label: label, hue: m.glow) {
                EHueText(text: body, hue: m.glow, size: 14.5, opacity: 0.8)
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
