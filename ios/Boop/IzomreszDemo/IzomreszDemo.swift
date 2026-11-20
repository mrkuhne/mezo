#if DEBUG
import SwiftUI
import BoopDesign

// THROWAWAY simulator spike (2026-11-21) — the owner's ask after trying the day editor: the muscle chips take too much
// room → a compact dropdown with checkboxes (several at once), sub-muscles everywhere, a small picture at every
// exercise. Nothing ships from here.
//
//   -previewIzomresz YES
//   -previewIzomreszState closed|open|empty|day|player|small

struct IzomreszDemoRoot: View {
    private let state = UserDefaults.standard.string(forKey: "previewIzomreszState") ?? "closed"

    var body: some View {
        ZStack {
            NK.ground.ignoresSafeArea()
            PlanSky()
            IzDayPage()
        }
        .sheet(isPresented: .constant(state != "day")) {
            Group {
                if state == "player" { IzPlayerSwapSheet() } else { IzAddSheet(state: state) }
            }
            .presentationDetents([.large])
            .presentationBackground(NK.ground)
            .interactiveDismissDisabled()
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Shared pieces

/// The exercise's small picture. In the app: the catalogue's start image; here (no network in the preview) a drawn
/// stand-in — the hue's dusk and the body with the worked part lit.
struct IzThumb: View {
    let muscle: String
    var size: CGFloat = 44
    private var legs: Bool { ["quad", "ham", "glute", "calf"].contains(muscle) }
    var body: some View {
        ZStack {
            LinearGradient(colors: [planHue.top, NK.ground], startPoint: .topLeading, endPoint: .bottomTrailing)
            RadialGradient(colors: [planHue.glow.opacity(0.35), .clear], center: .bottomTrailing, startRadius: 0, endRadius: size)
            // Zoomed onto the half of the body that works, so the lit part reads at 44 pt.
            NKBodyMark(muscle: muscle, hue: planHue, height: size * 1.7)
                .brightness(0.18)
                .offset(y: legs ? -size * 0.42 : size * 0.36)
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.27, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: size * 0.27, style: .continuous).strokeBorder(.white.opacity(0.1), lineWidth: 0.5))
        .accessibilityHidden(true)
    }
}

/// A drawn checkbox: an outline when off, the hue with a drawn tick when on, a dash when part of the group is on.
struct IzCheckbox: View {
    enum Mark { case off, on, partial }
    let mark: Mark
    var size: CGFloat = 22
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.3, style: .continuous)
                .fill(mark == .off ? Color.clear : planHue.glow)
            RoundedRectangle(cornerRadius: size * 0.3, style: .continuous)
                .strokeBorder(mark == .off ? .white.opacity(0.42) : .clear, lineWidth: 1.5)
            switch mark {
            case .on:
                Path { p in
                    p.move(to: CGPoint(x: size * 0.26, y: size * 0.52))
                    p.addLine(to: CGPoint(x: size * 0.43, y: size * 0.69))
                    p.addLine(to: CGPoint(x: size * 0.75, y: size * 0.33))
                }
                .stroke(NK.ground, style: StrokeStyle(lineWidth: size * 0.12, lineCap: .round, lineJoin: .round))
            case .partial:
                Capsule().fill(NK.ground).frame(width: size * 0.5, height: size * 0.12)
            case .off: EmptyView()
            }
        }
        .frame(width: size, height: size)
    }
}

private struct IzHeader: View {
    let text: String
    var body: some View {
        Text(text).nkFont(10, .medium, design: .monospaced).tracking(1.4)
            .foregroundStyle(.white.opacity(0.5)).padding(.top, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// An AJÁNLOM card with the picture on the left and the sub-muscle under the name.
struct IzCard: View {
    let e: IzData.Ex
    let first: Bool
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            IzThumb(muscle: e.muscle)
            VStack(alignment: .leading, spacing: 4) {
                Text(e.name).nkFont(17, .medium).foregroundStyle(.white).lineLimit(2).minimumScaleFactor(0.8)
                    .fixedSize(horizontal: false, vertical: true)
                Text(IzData.roleLine(e)).nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
                Text(e.reason).nkFont(14).foregroundStyle(.white.opacity(0.82))
                    .fixedSize(horizontal: false, vertical: true).padding(.top, 2)
                if let last = e.last {
                    Text("Legutóbb: \(last)").nkFont(12, design: .monospaced).foregroundStyle(planHue.glow)
                } else {
                    Text("Ezt még nem csináltad").nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.4))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(first ? 0.11 : 0.06)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.white.opacity(first ? 0.22 : 0), lineWidth: 0.5))
    }
}

/// A „Minden gyakorlat" row: the picture, the name, the sub-muscle, the quiet label.
struct IzListRow: View {
    let e: IzData.Ex
    var quiet: String? = nil
    var body: some View {
        HStack(spacing: 12) {
            IzThumb(muscle: e.muscle).opacity(quiet == nil ? 1 : 0.6)
            VStack(alignment: .leading, spacing: 3) {
                Text(e.name).nkFont(15).foregroundStyle(.white.opacity(quiet == nil ? 1 : 0.6)).lineLimit(1)
                Text(IzData.roleLine(e)).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45)).lineLimit(1)
            }
            Spacer(minLength: 0)
            if let quiet {
                Text(quiet).nkFont(10, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Capsule().fill(.white.opacity(0.08)))
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.05)))
    }
}

private struct IzFullListHeader: View {
    let open: Bool
    var body: some View {
        HStack {
            Text("Minden gyakorlat").nkFont(15, .medium).foregroundStyle(.white)
            Spacer()
            Image(systemName: open ? "chevron.down" : "chevron.right")
                .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.45))
        }
        .padding(.vertical, 12)
        .overlay(alignment: .top) { Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5) }
        .contentShape(Rectangle())
    }
}

private struct IzSearch: View {
    @Binding var query: String
    var body: some View {
        TextField("", text: $query, prompt: Text("Keresés").foregroundStyle(.white.opacity(0.4)))
            .font(.system(size: 15)).foregroundStyle(.white)
            .autocorrectionDisabled()
            .padding(.horizontal, 14).frame(minHeight: 44)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.08)))
    }
}

// MARK: - The add sheet with the compact muscle dropdown

struct IzAddSheet: View {
    @State private var picked: Set<String>
    @State private var open: Bool
    @State private var showAll = false
    @State private var query = ""
    @State private var rowFrame: CGRect = .zero
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(state: String) {
        switch state {
        case "open": _picked = State(initialValue: ["back-wide", "back-mid", "chest-upper", "chest-mid", "chest-lower"])
        case "empty": _picked = State(initialValue: [])
        default: _picked = State(initialValue: ["back-mid", "chest-upper"])
        }
        _open = State(initialValue: state == "open")
    }

    /// The parts of the groups under their band this week.
    private var lowSubs: Set<String> { Set(IzData.groups.filter(\.low).flatMap(\.subs).map(\.id)) }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                ScrollView {
                    VStack(spacing: 0) {
                        ZStack(alignment: .bottomLeading) {
                            Color.clear.frame(height: 170).overlay { PaintedLandscape(hue: planHue) }.clipped()
                                .overlay(LinearGradient(colors: [.clear, NK.ground], startPoint: .center, endPoint: .bottom))
                            VStack(alignment: .leading, spacing: 4) {
                                Text("1. NAP · HÁT ÉS BICEPSZ").nkFont(12, .medium, design: .monospaced).tracking(1.6).foregroundStyle(.white.opacity(0.75))
                                Text("Mit tegyünk a napra?").nkFont(34, design: .serif).foregroundStyle(.white)
                            }
                            .padding(.horizontal, 22).padding(.bottom, 8)
                        }
                        VStack(spacing: 12) { content }.padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 40)
                    }
                }
                .scrollIndicators(.hidden)
                .scrollDisabled(open)

                if open {
                    Color.black.opacity(0.45).ignoresSafeArea()
                        .onTapGesture { animate { open = false } }
                        .transition(.opacity)
                    // The row stays lit above the dim, the panel hangs under it.
                    dropdownRow
                        .frame(width: rowFrame.width)
                        .offset(x: rowFrame.minX, y: rowFrame.minY)
                    IzMusclePanel(picked: $picked, low: lowSubs, done: { animate { open = false } })
                        .frame(width: rowFrame.width)
                        .frame(maxHeight: max(200, geo.size.height - rowFrame.maxY - 20))
                        .fixedSize(horizontal: false, vertical: true)
                        .offset(x: rowFrame.minX, y: rowFrame.maxY + 8)
                        .transition(.opacity.combined(with: .scale(scale: 0.97, anchor: .top)))
                }
            }
            .coordinateSpace(.named("izsheet"))
        }
        .background(NK.ground)
    }

    @ViewBuilder private var content: some View {
        dropdownRow
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("izsheet")) } action: { rowFrame = $0 }
            .opacity(open ? 0 : 1)

        if picked.isEmpty {
            Text("Válassz izmot, és ajánlok hozzá. Addig a hét kevés izmaira ajánlok.")
                .nkFont(14).foregroundStyle(.white.opacity(0.6))
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            IzHeader(text: "AJÁNLOM · A HÉT KEVÉS IZMAIRA")
            ForEach(Array(IzData.suggestions(for: ["back-wide", "back-mid", "biceps-long"]).prefix(3).enumerated()), id: \.element.id) { i, e in
                IzCard(e: e, first: i == 0)
            }
        } else {
            IzHeader(text: "AJÁNLOM")
            ForEach(Array(IzData.suggestions(for: picked).enumerated()), id: \.element.id) { i, e in
                IzCard(e: e, first: i == 0)
            }
        }
        Button { animate { showAll.toggle() } } label: { IzFullListHeader(open: showAll) }.buttonStyle(.plain)
        if showAll {
            IzSearch(query: $query)
            let items = query.isEmpty ? IzData.list(for: picked)
                : IzData.catalogue.filter { $0.name.localizedCaseInsensitiveContains(query) }
            ForEach(items) { e in IzListRow(e: e, quiet: e.id == "5" ? "nincs hozzá eszközöd" : nil) }
        }
        Text("Az új gyakorlat a nap végére kerül, az edzésmód szerinti sorozatokkal. A döntés a tiéd — a teljes listából bármit választhatsz.")
            .nkFont(12).foregroundStyle(.white.opacity(0.45))
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// „Izmok: Hát · középső, Mell · felső ▾" — one line; too long → „Hát · középső +2".
    private var dropdownRow: some View {
        let parts = IzData.summary(picked)
        let ordered = IzData.groups.flatMap(\.subs).map(\.id).filter { picked.contains($0) }
        return Button { animate { open.toggle() } } label: {
            HStack(spacing: 10) {
                Text("Izmok").nkFont(14).foregroundStyle(.white.opacity(0.55))
                Group {
                    if parts.isEmpty {
                        Text("Minden izom").foregroundStyle(.white.opacity(0.9))
                    } else {
                        ViewThatFits(in: .horizontal) {
                            Text(parts.joined(separator: ", ")).lineLimit(1).fixedSize()
                            if parts.count > 1 {
                                Text("\(parts[0]) +\(parts.count - 1)").lineLimit(1).fixedSize()
                            }
                            Text("\(IzData.name(ordered[0])) +\(ordered.count - 1)").lineLimit(1)
                        }
                        .foregroundStyle(.white)
                    }
                }
                .nkFont(15, .medium)
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.down")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.6))
                    .rotationEffect(.degrees(open ? 180 : 0))
            }
            .padding(.horizontal, 16).frame(minHeight: 50)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(white: open ? 0.17 : 0.12)))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(.white.opacity(open ? 0.3 : 0.16), lineWidth: 0.5))
            .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Izmok: \(parts.isEmpty ? "minden izom" : parts.joined(separator: ", "))")
    }

    private func animate(_ change: () -> Void) {
        if reduceMotion { change() } else { withAnimation(.snappy(duration: 0.22)) { change() } }
    }
}

/// The dropdown panel: one block per group (a group checkbox, then its parts as checkbox pills), Törlés · Kész below.
struct IzMusclePanel: View {
    @Binding var picked: Set<String>
    let low: Set<String>
    let done: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            ViewThatFits(in: .vertical) {
                groupsList
                ScrollView { groupsList }.scrollIndicators(.hidden)
            }
            Rectangle().fill(.white.opacity(0.1)).frame(height: 0.5)
            HStack {
                Button { picked = [] } label: {
                    Text("Törlés").nkFont(15, .medium).foregroundStyle(.white.opacity(picked.isEmpty ? 0.35 : 0.85))
                        .padding(.horizontal, 6).frame(minHeight: 44)
                }
                .buttonStyle(.plain).disabled(picked.isEmpty)
                Spacer()
                Button(action: done) {
                    Text("Kész").nkFont(15, .semibold).foregroundStyle(NK.ground)
                        .padding(.horizontal, 26).frame(minHeight: 40)
                        .background(Capsule().fill(.white))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 14).padding(.vertical, 8)
        }
        .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color(white: 0.115)))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(.white.opacity(0.16), lineWidth: 0.5))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: .black.opacity(0.55), radius: 24, y: 12)
    }

    private var groupsList: some View {
        VStack(spacing: 0) {
            ForEach(Array(IzData.groups.enumerated()), id: \.element.id) { i, g in
                if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 50) }
                groupBlock(g)
            }
        }
        .padding(.vertical, 6)
    }

    private func mark(_ g: IzGroup) -> IzCheckbox.Mark {
        let n = g.subs.filter { picked.contains($0.id) }.count
        return n == 0 ? .off : n == g.subs.count ? .on : .partial
    }

    private func groupBlock(_ g: IzGroup) -> some View {
        let m = mark(g)
        let single = g.subs.count == 1
        return VStack(alignment: .leading, spacing: 8) {
            Button {
                if m == .on { picked.subtract(g.subs.map(\.id)) } else { picked.formUnion(g.subs.map(\.id)) }
            } label: {
                HStack(spacing: 12) {
                    IzCheckbox(mark: m)
                    Text(g.name).nkFont(16, .medium).foregroundStyle(.white)
                    if single, low.contains(g.subs[0].id) { lowMark }
                    Spacer(minLength: 0)
                    if !single, m != .off {
                        Text("\(g.subs.filter { picked.contains($0.id) }.count)/\(g.subs.count)")
                            .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                    }
                }
                .frame(minHeight: 36)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(g.name), egész csoport")
            if !single {
                NKFlowRow(spacing: 7, rowSpacing: 7) {
                    ForEach(g.subs) { s in subPill(s) }
                }
                .padding(.leading, 34)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 8)
    }

    private var lowMark: some View {
        Text("kevés").nkFont(10, .semibold, design: .monospaced).foregroundStyle(planHue.glow)
    }

    private func subPill(_ s: IzSub) -> some View {
        let on = picked.contains(s.id)
        return Button {
            if on { picked.remove(s.id) } else { picked.insert(s.id) }
        } label: {
            HStack(spacing: 7) {
                IzCheckbox(mark: on ? .on : .off, size: 18)
                Text(s.long).nkFont(14).foregroundStyle(.white.opacity(on ? 1 : 0.85)).lineLimit(1)
                if low.contains(s.id) { lowMark }
            }
            .padding(.leading, 8).padding(.trailing, 11).frame(minHeight: 36)
            .background(Capsule().fill(.white.opacity(on ? 0.13 : 0.06)))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

// MARK: - The day card with sub-muscle subtitles

struct IzDayPage: View {
    private struct Row: Identifiable {
        let id: Int
        let name: String, muscle: String, reps: String, rir: String, sets: Int
        var technique = false
    }
    private let rows: [Row] = [
        Row(id: 1, name: "Széles fogású lehúzás", muscle: "back-wide", reps: "8–10", rir: "1 tartalék", sets: 3, technique: true),
        Row(id: 2, name: "Mellre támasztott evezés", muscle: "back-mid", reps: "8–10", rir: "1 tartalék", sets: 3),
        Row(id: 3, name: "Ferde pados bicepsz", muscle: "biceps-long", reps: "10–12", rir: "1 tartalék", sets: 3, technique: true),
        Row(id: 4, name: "Kalapács bicepsz", muscle: "biceps-brachialis", reps: "10–12", rir: "bukásig", sets: 2),
        Row(id: 5, name: "Fordított tárogatás gépen", muscle: "shoulder-rear", reps: "12–15", rir: "1 tartalék", sets: 3),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("BLOKK · NAPOK").nkFont(11, .medium, design: .monospaced).tracking(1.4).foregroundStyle(.white.opacity(0.7))
                    Text("V-forma és kar").nkFont(30, design: .serif).foregroundStyle(.white)
                }
                .padding(.horizontal, 22)
                card
            }
            .padding(.top, 20)
        }
        .scrollIndicators(.hidden)
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("1. NAP").nkFont(11, .semibold, design: .monospaced).tracking(1.4).foregroundStyle(planHue.glow)
                Text("Hát és bicepsz").nkFont(28, design: .serif).foregroundStyle(.white)
                NKFlowRow(spacing: 6, rowSpacing: 6) {
                    PlanPill("kb. 64 perc", mark: .timer)
                    PlanPill("2 technika", color: planHue.glow, mark: .drop)
                }
                .padding(.top, 2)
            }
            NKFlowRow(spacing: 8, rowSpacing: 8) {
                chip("Hát", 6); chip("Bicepsz", 5); chip("Váll", 3)
            }
            VStack(spacing: 0) {
                ForEach(rows) { r in
                    if r.id > 1 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                    row(r)
                }
                Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5)
                HStack(spacing: 12) {
                    Text("+").nkFont(19, .medium).foregroundStyle(planHue.glow)
                        .frame(width: 34, height: 34)
                        .background(Circle().strokeBorder(planHue.glow.opacity(0.6), lineWidth: 1))
                    Text("Gyakorlat hozzáadása").nkFont(16, .medium).foregroundStyle(.white.opacity(0.9))
                    Spacer()
                }
                .padding(.vertical, 12)
            }
        }
        .padding(.horizontal, 18).padding(.vertical, 22)
        .background(RoundedRectangle(cornerRadius: 30, style: .continuous).fill(NK.ground.opacity(0.62)))
        .nkGlass(30)
        .padding(.horizontal, 14).padding(.bottom, 24)
    }

    private func chip(_ name: String, _ sets: Int) -> some View {
        HStack(spacing: 6) {
            Text(name).nkFont(12, .medium).foregroundStyle(.white.opacity(0.85))
            Text("\(sets)").nkFont(13, .semibold).foregroundStyle(planHue.glow)
        }
        .padding(.horizontal, 11).padding(.vertical, 6)
        .background(Capsule().fill(.white.opacity(0.08)))
    }

    private func row(_ r: Row) -> some View {
        HStack(spacing: 8) {
            VStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { _ in Capsule().fill(.white.opacity(0.45)).frame(width: 16, height: 2) }
            }
            .frame(width: 20, height: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(r.name).nkFont(16, .medium).foregroundStyle(.white.opacity(0.95))
                    .lineLimit(2).minimumScaleFactor(0.85).fixedSize(horizontal: false, vertical: true)
                // One line when it fits; otherwise the muscle above the numbers, never a break inside „10–12 ism.".
                ViewThatFits(in: .horizontal) {
                    Text("\(IzData.name(r.muscle)) · \(r.reps) ism. · \(r.rir)").lineLimit(1).fixedSize()
                    VStack(alignment: .leading, spacing: 1) {
                        Text(IzData.name(r.muscle))
                        Text("\(r.reps) ism. · \(r.rir)")
                    }
                }
                .nkFont(12).foregroundStyle(.white.opacity(0.5))
                if r.technique {
                    Text("+ technika vagy kihívás").nkFont(12, .medium).foregroundStyle(planHue.glow).lineLimit(1)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(Capsule().fill(.white.opacity(0.09)))
                        .padding(.top, 2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .layoutPriority(1)
            PlanSetStepper(value: r.sets, name: r.name, down: {}, up: {})
            HStack(spacing: 3) {
                ForEach(0..<3, id: \.self) { _ in Circle().fill(.white.opacity(0.75)).frame(width: 4, height: 4) }
            }
            .frame(width: 30, height: 44)
        }
        .padding(.vertical, 12)
    }
}

// MARK: - The workout player's swap sheet with sub-muscle labels and pictures

struct IzPlayerSwapSheet: View {
    @State private var query = ""
    private let outgoing = "back-mid"

    var body: some View {
        NKSheetFrame(hue: planHue, eyebrow: "Mellre támasztott evezés", title: "Mire cseréljük?") {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) { chip("ehhez nincs eszközöm"); chip("nem esik jól") }
                IzHeader(text: "AJÁNLOM")
                let picks = IzData.suggestions(for: [outgoing], taken: ["2"]).prefix(2)
                ForEach(Array(picks.enumerated()), id: \.element.id) { i, e in IzCard(e: e, first: i == 0) }
                IzFullListHeader(open: true)
                IzSearch(query: $query)
                let same = IzData.catalogue.filter { $0.muscle == outgoing && $0.id != "2" }
                let rest = IzData.catalogue.filter { ["back-wide", "traps", "shoulder-rear", "back-lower"].contains($0.muscle) }
                ForEach(same + rest) { e in IzListRow(e: e, quiet: e.id == "5" ? "nincs hozzá eszközöd" : nil) }
                Text("A csere a mai edzésre szól. A döntés a tiéd — a teljes listából bármit választhatsz.")
                    .nkFont(12).foregroundStyle(.white.opacity(0.45))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func chip(_ title: String) -> some View {
        Text(title).nkFont(13, .medium).lineLimit(1).minimumScaleFactor(0.8)
            .foregroundStyle(.white)
            .padding(.horizontal, 14).frame(minHeight: 38)
            .background(Capsule().fill(.white.opacity(0.1)))
            .overlay(Capsule().strokeBorder(.white.opacity(0.18), lineWidth: 0.5))
    }
}
#endif
