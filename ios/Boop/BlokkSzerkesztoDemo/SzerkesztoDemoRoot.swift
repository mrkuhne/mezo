#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY spike (mezo-r36n9.116): the builder's screen around the editable day card. The head, the day strip and
// the bottom bar are copied from `BlockBuilderPage` so it looks exactly like the app.

struct SzerkesztoDemoRoot: View {
    @State private var model: SzModel
    @State private var day: Int
    @State private var pageWidth: CGFloat = 440
    private let launch = SzState.launch
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init() {
        let m = SzModel()
        let state = SzState.launch
        let fallback: Int = switch state {
        case .empty: 5
        case .locked: 4
        default: 0
        }
        let d = UserDefaults.standard.object(forKey: "previewSzerkesztoDay") != nil
            ? max(0, min(6, UserDefaults.standard.integer(forKey: "previewSzerkesztoDay"))) : fallback
        switch state {
        case .menu: m.menuRow = m.days[d].rows[safeIndex: 1]?.id
        case .undo:
            if let id = m.days[d].rows[safeIndex: 2]?.id { m.delete(id) }
        case .locked: m.workoutRunning = true
        case .dragging:
            m.dragging = m.days[d].rows[safeIndex: 2]?.id
            m.dragOffset = 34
        case .confirm:
            // A structural change on a day with a pending proposal line: the first two rows swapped.
            if m.days[0].rows.count > 1 { m.days[0].rows.swapAt(0, 1) }
        default: break
        }
        _model = State(initialValue: m)
        _day = State(initialValue: d)
    }

    var body: some View {
        ZStack {
            PlanSky(height: 150)
            VStack(spacing: 0) {
                head
                days
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { bar }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { pageWidth = $0 }
        .preferredColorScheme(.dark)
        .sheet(item: $model.sheet) { s in
            Group {
                switch s {
                case .settings(let id): SzSettingsSheet(model: model, rowId: id)
                case .add(let d): SzAddSheet(model: model, day: d, preset: launch == .add ? "back" : nil)
                case .swap(let id): SzSwapSheet(model: model, rowId: id)
                }
            }
            .presentationDetents([.large])
            .presentationBackground(NK.ground)
        }
        .alert("Függő heti javaslat", isPresented: $model.confirm) {
            Button("Előbb átnézem", role: .cancel) {}
            Button("Mentem") { withAnimation(.snappy) { model.save() } }
        } message: {
            Text("A heti javaslatban ennél a napnál függő döntés van; a módosított gyakorlatoknál a régi szám marad. Mentsem így?")
        }
        .task {
            // Sheets and the dialog open after the page is on screen.
            try? await Task.sleep(for: .milliseconds(500))
            let d = day
            switch launch {
            case .settings: if let id = model.days[d].rows.first?.id { model.sheet = .settings(id) }
            case .add: model.sheet = .add(d)
            case .swap: if let id = model.days[d].rows.first?.id { model.sheet = .swap(id) }
            case .confirm: model.confirm = true
            default: break
            }
        }
    }

    // MARK: head (BlockBuilderPage.head)

    private var head: some View {
        HStack(alignment: .center, spacing: 12) {
            PlanCloseButton {}
            VStack(alignment: .leading, spacing: 2) {
                Text("EGY HÉT · NAPONKÉNT").nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(.white.opacity(0.7))
                Text("V-forma és kar").nkFont(22, design: .serif).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
            }
            Spacer(minLength: 8)
            let out = model.outsideCount
            HStack(spacing: 6) {
                Circle().fill(out == 0 ? planGood : planWarn).frame(width: 7, height: 7)
                Text(out == 0 ? "minden a sávban" : "\(out) izom kilóg")
                    .nkFont(12, .medium).foregroundStyle(.white.opacity(0.9))
                    .contentTransition(.numericText())
            }
            .padding(.horizontal, 11).padding(.vertical, 7)
            .background(Capsule().fill(.black.opacity(0.28)))
        }
        .padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 10)
    }

    // MARK: day strip + pages (BuilderDaysView)

    private var days: some View {
        VStack(spacing: 10) {
            HStack(spacing: 6) {
                ForEach(model.days) { item in
                    let on = item.id == day
                    let minutes = model.minutes(item.id)
                    Button { withAnimation(.snappy) { day = item.id } } label: {
                        VStack(spacing: 5) {
                            Text(String(item.name.prefix(3)).uppercased())
                                .nkFont(11, .semibold, design: .monospaced).foregroundStyle(on ? NK.ground : .white.opacity(0.75))
                                .lineLimit(1).minimumScaleFactor(0.7)
                            Text(minutes == 0 ? "–" : "\(minutes)'").nkFont(15, .medium)
                                .foregroundStyle(on ? NK.ground : .white.opacity(minutes == 0 ? 0.45 : 1))
                                .lineLimit(1).minimumScaleFactor(0.7)
                                .contentTransition(.numericText())
                            Capsule().fill(on ? NK.ground.opacity(0.5) : planHue.glow.opacity(minutes == 0 ? 0.0 : 0.8))
                                .frame(width: CGFloat(min(34, 8 + minutes / 2)), height: 3)
                        }
                        .frame(maxWidth: .infinity, minHeight: 62)
                        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(on ? Color.white : .white.opacity(0.1)))
                        .overlay(alignment: .top) {
                            if item.id == model.todayIndex {
                                Circle().fill(on ? NK.ground : planHue.glow).frame(width: 4, height: 4).padding(.top, 4)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(minutes == 0 ? "\(item.name), pihenőnap" : "\(item.name), kb. \(minutes) perc")
                }
            }
            .padding(.horizontal, 16)

            TabView(selection: $day) {
                ForEach(model.days) { item in
                    SzDayCard(model: model, index: item.id, pageWidth: pageWidth).tag(item.id)
                        .frame(width: pageWidth)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .sensoryFeedback(.selection, trigger: day)
        }
    }

    // MARK: bottom bar (BlockBuilderPage.bar)

    private var bar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 2) {
                ForEach(["Izmok", "Napok", "Blokk"], id: \.self) { item in
                    let on = item == "Napok"
                    VStack(spacing: 3) {
                        NKGlyph(item == "Izmok" ? "dumbbell-ink" : (item == "Napok" ? "clock-ink" : "chart-deep"),
                                on ? NK.ground : .white.opacity(0.75), size: 17)
                        Text(item).nkFont(10, .semibold).foregroundStyle(on ? NK.ground : .white.opacity(0.75))
                    }
                    .frame(width: 62, height: 48)
                    .background { if on { Capsule().fill(.white) } }
                }
            }
            .padding(4)
            .background(Capsule().fill(.ultraThinMaterial).overlay(Capsule().stroke(.white.opacity(0.12), lineWidth: 1)))

            let can = model.hasChanges
            Button {
                if model.needsReviewConfirm { model.confirm = true } else { withAnimation(.snappy) { model.save() } }
            } label: {
                Text(can ? "Mentés" : (model.savedFlash ? "Elmentve" : "Nincs mit menteni"))
                    .nkFont(15, .semibold).lineLimit(1).minimumScaleFactor(0.8)
                    .foregroundStyle(NK.ground)
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .background(Capsule().fill(planHue.glow.opacity(can ? 1 : 0.45)))
            }
            .buttonStyle(.plain)
            .disabled(!can)
        }
        .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 4)
        .background(LinearGradient(colors: [NK.ground.opacity(0), NK.ground.opacity(0.95)], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
    }
}

extension Array {
    subscript(safeIndex i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}
#endif
