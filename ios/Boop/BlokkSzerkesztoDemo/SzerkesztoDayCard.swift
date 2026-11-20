#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY spike (mezo-r36n9.116, spec §6.1): `BuilderDayCard` with ≡ handle, ⋯ menu, tap-to-settings, delete with
// undo, the add row, the empty day and the in-progress lock.

struct SzDayCard: View {
    let model: SzModel
    let index: Int
    @State private var heights: [UUID: CGFloat] = [:]
    @State private var dragBase: CGFloat = 0
    /// The screen's width, measured outside the paging view (a page could be stretched by a wide row).
    let pageWidth: CGFloat
    private var width: CGFloat { pageWidth - 84 }
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Below this the stepper goes under the name (spec §6.5: the row's fields wrap on the smallest iPhone).
    private var narrow: Bool { width < 350 }

    var body: some View {
        let day = model.days[index]
        let locked = model.locked(index)
        let techniques = day.rows.filter { $0.technique != nil }.count
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(day.name.uppercased()).nkFont(11, .semibold, design: .monospaced).tracking(1.4).foregroundStyle(planHue.glow)
                    Text(day.rows.isEmpty ? "Pihenőnap" : day.title).nkFont(28, design: .serif).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                    if !day.rows.isEmpty {
                        NKFlowRow(spacing: 6, rowSpacing: 6) {
                            PlanPill("kb. \(model.minutes(index)) perc", mark: .timer)
                            if index == 0 || index == 2 || index == 4 { PlanPill("aznap sport is", mark: .spark) }
                            if techniques > 0 { PlanPill("\(techniques) technika", color: planHue.glow, mark: .drop) }
                        }
                        .padding(.top, 2)
                    }
                }
                if locked { lockLine }
                if !day.rows.isEmpty { muscleChips(day) }
                if day.rows.isEmpty {
                    Text("Pihenőnap — ha gyakorlatot teszel rá, edzésnap lesz.")
                        .nkFont(15).foregroundStyle(.white.opacity(0.72)).fixedSize(horizontal: false, vertical: true)
                }
                VStack(spacing: 0) {
                    ForEach(Array(day.rows.enumerated()), id: \.element.id) { e, row in
                        VStack(spacing: 0) {
                            if let d = model.deleted, d.day == index, d.index == e { undoLine(d.row.name); separator }
                            if e > 0 { separator }
                            rowView(row, locked: locked)
                        }
                        .zIndex(model.dragging == row.id || model.menuRow == row.id ? 2 : 0)
                    }
                    if let d = model.deleted, d.day == index, d.index >= day.rows.count {
                        if !day.rows.isEmpty { separator }
                        undoLine(d.row.name)
                    }
                    if !locked {
                        if !day.rows.isEmpty { separator }
                        addRow
                    }
                }
                .coordinateSpace(name: "rows")
            }
            .padding(22)
            .background(RoundedRectangle(cornerRadius: 30, style: .continuous).fill(NK.ground.opacity(0.62)))
            .nkGlass(30)
            .padding(.horizontal, 20).padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .scrollDisabled(model.dragging != nil)
    }

    private var separator: some View { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }

    private var lockLine: some View {
        HStack(alignment: .top, spacing: 10) {
            PlanMark(.timer, color: planHue.glow, size: 18).padding(.top, 1)
            Text("Ezen a napon most fut az edzésed — utána szerkesztheted.")
                .nkFont(14).foregroundStyle(.white.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.08)))
    }

    private func muscleChips(_ day: SzDay) -> some View {
        NKFlowRow(spacing: 8, rowSpacing: 8) {
            ForEach(SzModel.bands.map(\.muscle).filter { model.daySets($0, day: index) > 0 }, id: \.self) { m in
                HStack(spacing: 6) {
                    Text(planMuscleName(m)).nkFont(12, .medium).foregroundStyle(.white.opacity(0.85))
                    Text("\(model.daySets(m, day: index))").nkFont(13, .semibold).foregroundStyle(planHue.glow)
                        .contentTransition(.numericText())
                }
                .padding(.horizontal, 11).padding(.vertical, 6)
                .background(Capsule().fill(.white.opacity(0.08)))
            }
        }
        .animation(.snappy, value: day.rows)
    }

    // MARK: one row

    @ViewBuilder private func rowView(_ row: SzRow, locked: Bool) -> some View {
        let lifted = model.dragging == row.id
        let menuOpen = model.menuRow == row.id
        Group {
            if narrow {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top, spacing: 8) {
                        if !locked { handle(row) }
                        texts(row, locked: locked)
                        if !locked { dots(row) }
                    }
                    stepper(row, locked: locked).padding(.leading, locked ? 0 : 28)
                }
            } else {
                HStack(spacing: 8) {
                    if !locked { handle(row) }
                    texts(row, locked: locked)
                    stepper(row, locked: locked)
                    if !locked { dots(row) }
                }
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, lifted ? 10 : 0)
        .background {
            if lifted {
                RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color(white: 0.19))
                    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.white.opacity(0.18), lineWidth: 0.5))
                    .shadow(color: .black.opacity(0.5), radius: 18, y: 10)
            }
        }
        .padding(.horizontal, lifted ? -10 : 0)
        .scaleEffect(lifted && !reduceMotion ? 1.03 : 1)
        .offset(y: lifted ? model.dragOffset : 0)
        .zIndex(lifted || menuOpen ? 2 : 0)
        .transaction { if lifted { $0.animation = nil } }
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { heights[row.id] = $0 }
        .overlay(alignment: .topTrailing) {
            if menuOpen { menu(row).offset(y: 52).transition(.opacity.combined(with: .scale(scale: 0.95, anchor: .topTrailing))) }
        }
    }

    private func texts(_ row: SzRow, locked: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(row.name).nkFont(16, .medium).foregroundStyle(.white.opacity(locked ? 0.7 : 0.95))
                .lineLimit(2).minimumScaleFactor(0.85).fixedSize(horizontal: false, vertical: true)
            Text(subtitle(row)).nkFont(12).foregroundStyle(.white.opacity(0.5))
                .fixedSize(horizontal: false, vertical: true)
            if !locked { techniqueChip(row).padding(.top, 2) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .layoutPriority(1)
        .contentShape(Rectangle())
        .onTapGesture { if !locked { model.menuRow = nil; model.sheet = .settings(row.id) } }
        .accessibilityAddTraits(locked ? [] : .isButton)
        .accessibilityHint(locked ? "" : "Beállítások")
    }

    private func subtitle(_ row: SzRow) -> String {
        let reserve = row.reserve == 0 ? "bukásig" : "\(row.reserve) tartalék"
        return "\(planMuscleName(row.coarse)) · \(row.repMin)–\(row.repMax) ism. · \(reserve)"
    }

    private func stepper(_ row: SzRow, locked: Bool) -> some View {
        PlanSetStepper(value: row.sets, name: row.name,
                       down: { model.step(row.id, by: -1) }, up: { model.step(row.id, by: 1) })
            .disabled(locked)
            .opacity(locked ? 0.4 : 1)
    }

    @ViewBuilder private func techniqueChip(_ row: SzRow) -> some View {
        if !row.stable {
            PlanPill("szabadsúly · nincs technika", color: .white.opacity(0.4), mark: .shield)
        } else {
            let color: Color = row.technique == nil ? .white.opacity(0.55) : planHue.glow
            HStack(spacing: 5) {
                PlanMark(row.technique == nil ? .keep : .timer, color: color, size: 13)
                Text(row.technique ?? "+ technika vagy kihívás").nkFont(12, .medium).foregroundStyle(color).lineLimit(1)
            }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(Capsule().fill(.white.opacity(0.09)))
        }
    }

    // MARK: ≡ handle — three drawn bars, no symbol

    private func handle(_ row: SzRow) -> some View {
        VStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { _ in Capsule().fill(.white.opacity(0.45)).frame(width: 16, height: 2) }
        }
        .frame(width: 20, height: 44)
        .contentShape(Rectangle())
        .highPriorityGesture(drag(row))
        .accessibilityLabel("Áthelyezés")
    }

    private func drag(_ row: SzRow) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .global)
            .onChanged { g in
                if model.dragging != row.id { model.dragging = row.id; dragBase = 0; model.menuRow = nil }
                var offset = g.translation.height - dragBase
                var rows = model.days[index].rows
                guard let i = rows.firstIndex(where: { $0.id == row.id }) else { return }
                if offset > 0, i + 1 < rows.count, let h = heights[rows[i + 1].id], offset > h / 2 {
                    rows.swapAt(i, i + 1); dragBase += h; offset -= h
                    withAnimation(reduceMotion ? nil : .snappy(duration: 0.22)) { model.days[index].rows = rows }
                } else if offset < 0, i > 0, let h = heights[rows[i - 1].id], -offset > h / 2 {
                    rows.swapAt(i, i - 1); dragBase -= h; offset += h
                    withAnimation(reduceMotion ? nil : .snappy(duration: 0.22)) { model.days[index].rows = rows }
                }
                model.dragOffset = offset
            }
            .onEnded { _ in
                withAnimation(reduceMotion ? nil : .snappy(duration: 0.25)) { model.dragging = nil; model.dragOffset = 0 }
                dragBase = 0
            }
    }

    // MARK: ⋯ menu — three drawn dots, no symbol

    private func dots(_ row: SzRow) -> some View {
        Button {
            withAnimation(.snappy(duration: 0.2)) { model.menuRow = model.menuRow == row.id ? nil : row.id }
        } label: {
            HStack(spacing: 3) {
                ForEach(0..<3, id: \.self) { _ in Circle().fill(.white.opacity(0.75)).frame(width: 4, height: 4) }
            }
            .frame(width: 30, height: 44)
            .background { if model.menuRow == row.id { Circle().fill(.white.opacity(0.14)).frame(width: 32, height: 32) } }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("További lehetőségek")
    }

    private func menu(_ row: SzRow) -> some View {
        VStack(spacing: 0) {
            menuItem("Csere") { model.menuRow = nil; model.sheet = .swap(row.id) }
            Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
            menuItem("Beállítások") { model.menuRow = nil; model.sheet = .settings(row.id) }
            Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
            menuItem("Törlés", color: Color(hex: 0xF2A08A)) {
                withAnimation(.snappy) { model.delete(row.id) }
            }
        }
        .frame(width: 200)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color(white: 0.16).opacity(0.97)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.white.opacity(0.14), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.45), radius: 20, y: 10)
    }

    private func menuItem(_ title: String, color: Color = .white, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(title).nkFont(16, .medium).foregroundStyle(color)
                Spacer()
            }
            .padding(.horizontal, 16).frame(minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: undo + add

    private func undoLine(_ name: String) -> some View {
        HStack(spacing: 6) {
            Text("\(name) törölve").nkFont(14).foregroundStyle(.white.opacity(0.6)).lineLimit(1).truncationMode(.middle)
            Text("·").nkFont(14).foregroundStyle(.white.opacity(0.4))
            Button("visszavonom") { withAnimation(.snappy) { model.undoDelete() } }
                .buttonStyle(.plain).font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white).underline()
            Spacer(minLength: 0)
        }
        .frame(minHeight: 48)
        .transition(.opacity)
    }

    private var addRow: some View {
        Button { model.menuRow = nil; model.sheet = .add(index) } label: {
            HStack(spacing: 12) {
                Text("+").nkFont(19, .medium).foregroundStyle(planHue.glow)
                    .frame(width: 34, height: 34)
                    .background(Circle().strokeBorder(planHue.glow.opacity(0.6), lineWidth: 1))
                Text("Gyakorlat hozzáadása").nkFont(16, .medium).foregroundStyle(.white.opacity(0.9))
                Spacer()
            }
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
#endif
