import SwiftUI
import BoopCore
import BoopDesign

/// Sport → Hét (`mezo-r36n9.204`, spec §5.3, spike `SportHet` + `SportBeosztas`): the week's totals and its two lanes
/// (filled = done, outlined = planned, today in coral), the six-week load, then the weekly rhythm — the recurring
/// slots, the one-off events and the eleven kinds he can enter. The week comes from `SportStore`, the rest from its
/// `schedule`; every sheet is presented by the room (page level).
struct SportHet: View {
    let week: SportOverview
    let schedule: SportScheduleStore
    let open: (SportHetSheet) -> Void
    let restore: () -> Void

    var body: some View {
        hero
        SportGlassCard("TERHELÉS · 6 HÉT", trailing: "megterhelés × perc") { loadCard }
        VStack(alignment: .leading, spacing: 4) {
            NKMono("A HETI REND")
            Text("Itt állítod, mikor sportolsz. A kondi napjait az Évadban, a sportot itt — a kettő együtt adja a hetet.")
                .nkFont(13).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4).padding(.top, 10)
        .accessibilityElement(children: .combine)
        SportGlassCard("RENDSZERES ALKALMAK", trailing: schedule.slots.map { "\($0.count)" }) { slotsCard }
        SportGlassCard("EGYSZERI ESEMÉNYEK", trailing: schedule.events.map { "\($0.count)" }) { eventsCard }
        SportGlassCard("MILYEN SPORTOT ÍRHATSZ BE") {
            let used = Set((schedule.slots ?? []).map(\.sportKind))
            NKFlowRow {
                ForEach(SportKind.chips, id: \.self) { k in
                    SportChipView(text: k == .other ? "Egyéb" : k.name, on: used.contains(k))
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Beírható sportok: " + SportKind.chips.map { $0 == .other ? "egyéb" : $0.name.lowercased() }.joined(separator: ", "))
        }
    }

    // MARK: - Hero

    private var hero: some View {
        VStack(alignment: .leading, spacing: 14) {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 22) { figures }
                VStack(alignment: .leading, spacing: 10) { figures }
            }
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(sportLanes(week)) { d in
                    VStack(spacing: 5) {
                        lane(d.gymShare, color: sportGymColor, done: d.gymDone)
                        lane(d.sportShare, color: Hue.sport.glow, done: d.sportDone)
                        Text(d.name).nkFont(11.5, d.today ? .semibold : .regular)
                            .foregroundStyle(d.today ? Hue.sport.glow : .white.opacity(0.65))
                            .lineLimit(1).minimumScaleFactor(0.5)
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(d.label)
                }
            }
            .frame(minHeight: 130)
            NKFlowRow(spacing: 16) {
                legend(Circle().fill(sportGymColor), "kondi")
                legend(Circle().fill(Hue.sport.glow), "sport")
                legend(RoundedRectangle(cornerRadius: 2).stroke(.white.opacity(0.6), lineWidth: 1), "tervben")
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Jelmagyarázat: kitöltött sáv kész, körvonalas tervben; felül kondi, alul sport.")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18).nkGlass(28)
    }

    @ViewBuilder private var figures: some View {
        ForEach(Array(sportWeekFigures(week).enumerated()), id: \.offset) { _, f in
            VStack(alignment: .leading, spacing: 1) {
                Text(f.value).font(.custom(Lagy.outfitFamily, size: 24, relativeTo: .title2).weight(.medium))
                    .foregroundStyle(f.lit ? Hue.sport.glow : .white).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
                Text(f.label).nkFont(12.5, .medium).foregroundStyle(.white.opacity(0.75))
            }
            .accessibilityElement(children: .combine)
        }
    }

    private func lane(_ share: Double, color: Color, done: Bool) -> some View {
        ZStack(alignment: .bottom) {
            RoundedRectangle(cornerRadius: 6).fill(.white.opacity(0.05)).frame(height: 52)
            if share > 0 {
                RoundedRectangle(cornerRadius: 6).fill(done ? color : color.opacity(0.18))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(color, lineWidth: done ? 0 : 1.2))
                    .frame(height: max(8, CGFloat(share) * 52))
            }
        }
    }

    private func legend<S: View>(_ swatch: S, _ text: String) -> some View {
        HStack(spacing: 6) {
            swatch.frame(width: 9, height: 8)
            Text(text).nkFont(12.5).foregroundStyle(.white.opacity(0.8))
        }
    }

    // MARK: - Terhelés · 6 hét

    @ViewBuilder private var loadCard: some View {
        if let load = schedule.weeksLoad, !load.weeks.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .bottom, spacing: 10) {
                    ForEach(sportLoadBars(load)) { w in
                        VStack(spacing: 4) {
                            VStack(spacing: 2) {
                                if w.sport > 0 { RoundedRectangle(cornerRadius: 4).fill(Hue.sport.glow).frame(height: max(3, CGFloat(w.sportShare) * 110)) }
                                if w.gym > 0 { RoundedRectangle(cornerRadius: 4).fill(sportGymColor).frame(height: max(3, CGFloat(w.gymShare) * 110)) }
                            }
                            .frame(height: 114, alignment: .bottom)
                            Text(w.label).nkFont(10.5, w.current ? .semibold : .regular)
                                .foregroundStyle(.white.opacity(w.current ? 0.95 : 0.55)).lineLimit(1).minimumScaleFactor(0.5)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(sportLoadSummary(load))
                if let note = sportLoadUnknownNote(load) {
                    Text(note).nkFont(12.5).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                }
            }
        } else if schedule.weeksLoad != nil {
            quiet("Még nincs terhelési adat — az első rögzített alkalom után itt lesz.")
        } else if schedule.problem != nil || schedule.offline {
            quiet(schedule.offline ? "Nincs net — a terhelést később mutatom." : "A terhelést most nem érem el.")
        } else {
            RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.06)).frame(height: 130)
                .accessibilityLabel("Töltöm")
        }
    }

    // MARK: - Rendszeres alkalmak

    @ViewBuilder private var slotsCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let slots = schedule.slots {
                if slots.isEmpty {
                    quiet("Még nincs rendszeres alkalmad. Vedd fel, mikor sportolsz, és mellé teszem a kondit.")
                        .padding(.vertical, 6)
                }
                ForEach(slots, id: \.self.listID) { sl in
                    Button { open(.slot(sl)) } label: {
                        row(title: sportSlotTitle(sl), line: sportSlotLine(sl))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(sportSlotTitle(sl)), \(sportSlotLine(sl))")
                    .accessibilityHint("Megnyitja a szerkesztést")
                }
            } else if schedule.problem != nil {
                quiet(schedule.problem == .offline ? "Nincs net, és még nincs elmentett heti rended." : "A heti rendedet most nem érem el.")
                    .padding(.vertical, 6)
            } else {
                RoundedRectangle(cornerRadius: 12).fill(.white.opacity(0.06)).frame(height: 54).padding(.vertical, 6)
                    .accessibilityLabel("Töltöm")
            }
            if let gone = schedule.removed {
                HStack(alignment: .firstTextBaseline) {
                    Text("Kitöröltem: \(sportSlotTitle(gone))").nkFont(13).foregroundStyle(.white.opacity(0.7))
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 8)
                    Button(action: restore) { Text("Visszavonás").nkFont(14, .semibold).foregroundStyle(Hue.sport.glow) }.buttonStyle(.plain)
                        .frame(minHeight: 44)
                }
                .padding(.top, 4)
            }
            NKPill("Új rendszeres alkalom", glyph: "plus-ink", primary: false) { open(.newSlot) }
                .padding(.top, 8)
                .disabled(schedule.slots == nil)
        }
    }

    // MARK: - Egyszeri események

    @ViewBuilder private var eventsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let events = schedule.events {
                if events.isEmpty {
                    quiet("Nincs előtted egyszeri esemény. Ide jön például egy torna vagy egy hétvégi túra.")
                }
                ForEach(events) { e in
                    Button { open(.event(e)) } label: { eventRow(e) }
                        .buttonStyle(.plain)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(sportEventDateLabel(e.date)) \(sportEventTitle(e)), \(sportEventLine(e))")
                        .accessibilityHint("Megnyitja, itt törölheted")
                }
            } else if schedule.problem != nil {
                quiet("Az eseményeidet most nem érem el.")
            } else {
                RoundedRectangle(cornerRadius: 12).fill(.white.opacity(0.06)).frame(height: 54).accessibilityLabel("Töltöm")
            }
            NKPill("Új esemény", glyph: "plus-ink", primary: false) { open(.newEvent) }
        }
    }

    private func eventRow(_ e: SportEvent) -> some View {
        let tile = sportEventTile(e.date)
        return HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 0) {
                Text(tile.month).font(.nkMono(10, .semibold)).foregroundStyle(Hue.sport.glow)
                Text(tile.day).font(.nkNumber(26)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.6)
            }
            .frame(width: 50, height: 54).background(RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.08)))
            VStack(alignment: .leading, spacing: 2) {
                Text(sportEventTitle(e)).nkFont(15, .medium).foregroundStyle(.white)
                Text(sportEventLine(e)).nkFont(12.5).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                Text(sportEventEffect).nkFont(12.5).foregroundStyle(Hue.sport.glow).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
                .padding(.top, 4)
        }
        .contentShape(Rectangle())
    }

    // MARK: - Bits

    private func row(title: String, line: String) -> some View {
        HStack(spacing: 12) {
            NKGlyph("ball-sun", .white, size: 18).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).nkFont(15, .medium).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                Text(line).nkFont(12.5).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
        }
        .padding(.vertical, 10).frame(minHeight: 44).contentShape(Rectangle())
    }

    private func quiet(_ text: String) -> some View {
        Text(text).nkFont(13.5).foregroundStyle(.white.opacity(0.72)).fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The Hét tab's sheets, presented by the room.
enum SportHetSheet: Identifiable {
    case slot(SportSlot), newSlot, event(SportEvent), newEvent
    var id: String {
        switch self {
        case .slot(let s): "slot-\(s.listID)"
        case .newSlot: "slot-new"
        case .event(let e): "event-\(e.id)"
        case .newEvent: "event-new"
        }
    }
}

extension SportSlot {
    /// A stable list identity (a slot read from the server always has its id).
    var listID: String { id ?? "\(dayOfWeek)-\(time)-\(sport)" }
}
