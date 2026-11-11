import SwiftUI

// Throwaway spike (mezo-r36n9.12): "Ma" — the one home. The S3 Mai hero (orb + five lens orbs + verdict + lens
// action) on top, then the day as one scroll in three phases: Reggel (the plan to accept or tweak), Napközben
// (the timeline with Boop's proposal cards at "most"), Este (the close-out under a minute).

struct TItem: Identifiable {
    enum Kind { case wake, checkin, meal, calendar, train, close, sleep }
    let id = UUID()
    let t: Double, time: String, glyph: String, title: String, sub: String, kind: Kind
    var action: String? = nil

    static let day: [TItem] = [
        TItem(t: 6.88, time: "06:53", glyph: "sun-ink", title: "Ébredés", sub: "7ó 12p alvás · 1ó 36p mély", kind: .wake),
        TItem(t: 7.33, time: "07:20", glyph: "pen-sun", title: "Reggeli check-in", sub: "Energia 7 · hangulat 8 · feszültség 4", kind: .checkin),
        TItem(t: 8.0, time: "08:00", glyph: "bowl-cream", title: "Reggeli", sub: "Zabkása áfonyával · 32 g fehérje", kind: .meal),
        TItem(t: 9.0, time: "09:00", glyph: "clock-ink", title: "Megbeszélések · 4 esemény", sub: "9:00–12:00 · legsűrűbb 10:30-kor", kind: .calendar),
        TItem(t: 12.67, time: "12:40", glyph: "bowl-cream", title: "Ebéd", sub: "Csirke rizzsel, salátával · 46 g fehérje", kind: .meal),
        TItem(t: 14.0, time: "14:00", glyph: "clock-ink", title: "Megbeszélések · 3 esemény", sub: "14:00–17:30 · ügyfélhívás csúszhat", kind: .calendar),
        TItem(t: 16.0, time: "16:00", glyph: "pen-sun", title: "Délutáni check-in", sub: "3 kérdés · fél perc", kind: .checkin, action: "Kitöltöm"),
        TItem(t: 18.5, time: "18:30", glyph: "dumbbell-ink", title: "Felsőtest edzés", sub: "75 perc · 5 gyakorlat", kind: .train, action: "Indítás"),
        TItem(t: 19.75, time: "19:45", glyph: "bowl-cream", title: "Vacsora", sub: "Boop: legalább 50 g fehérje", kind: .meal, action: "Lefotózom"),
        TItem(t: 21.5, time: "21:30", glyph: "spark-cream", title: "Esti zárás", sub: "Kevesebb mint egy perc", kind: .close),
        TItem(t: 22.75, time: "22:45", glyph: "moon-cream", title: "Lefekvés", sub: "Emlékeztetlek 22:15-kor", kind: .sleep),
    ]
}

struct GerincMa: View {
    @Binding var phase: DayPhase
    @Binding var path: [Int]
    @Binding var decided: [String: Bool]
    var onWhy: (Proposal) -> Void
    var onToast: (String) -> Void

    @State private var sel = GArg.int("gerincMetric", 0, 4)
    @State private var motion = OrbMotion()
    @State private var orbKey = 0
    @State private var reminderSet = false
    @State private var planOpen = false
    @State private var planAccepted = false
    @State private var compact = false
    @State private var rating = 0
    @State private var closed = false
    @State private var line = ""
    @State private var scrollTarget = GArg.str("gerincScroll")
    private var m: SunMetric { SunMetric.all[sel] }

    var body: some View {
        NavigationStack(path: $path) {
            GeometryReader { geo in
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 0) {
                            hero(height: geo.size.height + geo.safeAreaInsets.top - 30, proxy: proxy)
                            VStack(spacing: 34) {
                                lensStrip
                                reggel.background(alignment: .top) { Color.clear.frame(height: 120).id("reggel").padding(.top, -120) }
                                napkozben.background(alignment: .top) { Color.clear.frame(height: 120).id("napkozben").padding(.top, -120) }
                                este.background(alignment: .top) { Color.clear.frame(height: 120).id("este").padding(.top, -120) }
                            }
                            .padding(.horizontal, 16)
                            .padding(.bottom, 40)
                            .background(FloatingLights(hue: m.glow).padding(.vertical, -120))
                            MirroredLand(sky: PaintedLandscape.skies[sel]).padding(.top, -20).padding(.bottom, 60)
                        }
                    }
                    .scrollIndicators(.hidden)
                    .ignoresSafeArea(edges: .top)
                    .background(gPageBackground(m.top).animation(.easeInOut(duration: 0.6), value: sel).ignoresSafeArea())
                    .onScrollGeometryChange(for: Bool.self) { $0.contentOffset.y > geo.size.height - 120 } action: { _, v in
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { compact = v }
                    }
                    .overlay(alignment: .top) { if compact { compactHeader } }
                    .onAppear {
                        planAccepted = phase != .reggel
                        if let s = scrollTarget {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { proxy.scrollTo(s, anchor: .top) }
                            scrollTarget = nil
                        }
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Int.self) { i in
                GerincDrill(metric: i, onWhy: onWhy, onToast: onToast)
            }
        }
        .onDisappear { motion.stop() }
    }

    // MARK: Hero (S3 Mai, re-homed)

    private func hero(height: CGFloat, proxy: ScrollViewProxy) -> some View {
        ZStack(alignment: .top) {
            Color.clear.frame(height: height)
                .overlay { PaintedLandscape(sky: PaintedLandscape.skies[sel]) }
                .clipped()
                .overlay(LinearGradient(stops: [.init(color: .clear, location: 0.68), .init(color: gBase.opacity(0.4), location: 0.86),
                                                .init(color: gBase.opacity(0), location: 1)], startPoint: .top, endPoint: .bottom))
                .mask(LinearGradient(stops: [.init(color: .black, location: 0.8), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom))

            VStack(spacing: 0) {
                header(proxy: proxy)
                metricRow.padding(.top, 10)
                sun.frame(height: 270).padding(.bottom, 16)
                Text(m.name.uppercased()).font(.system(size: 14, weight: .semibold)).tracking(2.6)
                    .foregroundStyle(.white.opacity(0.85)).contentTransition(.opacity)
                Text(m.headline).font(AuraFont.serif(42)).foregroundStyle(.white).padding(.top, 10).contentTransition(.opacity)
                Text(m.sentence)
                    .font(.system(size: 17)).lineSpacing(4).multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.85)).padding(.horizontal, 30).padding(.top, 10)
                    .frame(height: 96, alignment: .top)
                    .contentTransition(.opacity)
                if phase == .este {
                    GPill(title: "Lezárom a napot", glyph: "spark-cream") {
                        withAnimation(.easeInOut(duration: 0.5)) { proxy.scrollTo("este", anchor: .top) }
                    }
                    .padding(.top, 4)
                } else {
                    AuraLensAction(sel: sel, orb: m.orb, motion: motion, breathing: false, reminderSet: $reminderSet,
                                   onPrimary: { a in
                                       if a == "bedtime" { reminderSet.toggle(); if reminderSet { onToast("Emlékeztető 22:15-re beállítva") } }
                                       else if a.hasPrefix("log:") { onToast(String(a.dropFirst(4)) + " · hozzáadva") }
                                       else { onToast(["checkin": "Check-in nyílik", "workout": "Felsőtest indul · 00:00", "meal": "Kamera nyílik", "breath": "Egy perc légzés"][a] ?? a) }
                                   }, onSpeak: { onToast("Boop beszél…") })
                        .padding(.top, 4)
                }
                Spacer(minLength: 0)
            }
            .frame(height: height)
        }
    }

    /// Title row + the three phases as thin text tabs. The phase the clock is in carries the dot; a tap scrolls there.
    private func header(proxy: ScrollViewProxy) -> some View {
        VStack(spacing: 10) {
            HStack {
                // spike-only control: the "clock" — tap to see the day at another time
                Button { withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) {
                    phase = DayPhase(rawValue: (phase.rawValue + 1) % 3)!
                    planAccepted = phase != .reggel
                } } label: {
                    Text(phase.nowLabel).font(AuraFont.mono(13, .semibold)).foregroundStyle(.white)
                        .padding(.horizontal, 12).frame(height: 34)
                }
                .buttonStyle(.plain)
                .glassEffect(.clear.interactive(), in: .capsule)
                .frame(width: 80, alignment: .leading)
                Spacer()
                Text("boop").font(.custom("Outfit", size: 26).weight(.light)).tracking(3).foregroundStyle(.white)
                Spacer()
                AuraGlyph("person-sage", .white, size: 20).frame(width: 44, height: 44)
                    .glassEffect(.clear, in: .circle)
                    .frame(width: 80, alignment: .trailing)
            }
            .padding(.horizontal, 16)
            HStack(spacing: 0) {
                ForEach(DayPhase.allCases, id: \.rawValue) { p in
                    let on = p == phase
                    VStack(spacing: 7) {
                        HStack(spacing: 5) {
                            Text(p.name).font(.system(size: 15, weight: on ? .semibold : .regular))
                        }
                        .foregroundStyle(.white.opacity(on ? 1 : 0.62))
                        Capsule().fill(.white).frame(height: 1).opacity(on ? 1 : 0).padding(.horizontal, 6)
                    }
                    .fixedSize()
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                    .onTapGesture { withAnimation(.easeInOut(duration: 0.5)) { proxy.scrollTo(["reggel", "napkozben", "este"][p.rawValue], anchor: .top) } }
                }
            }
            .padding(.horizontal, 40)
        }
        .padding(.top, 58)
    }

    private var metricRow: some View {
        HStack(spacing: 0) {
            ForEach(SunMetric.all.indices, id: \.self) { i in
                let x = SunMetric.all[i]
                let on = i == sel
                VStack(spacing: 7) {
                    ZStack {
                        if on {
                            LivingOrb(mood: .good, size: 46, motion: motion, palette: x.orb, glow: false, level: Double(x.value) / 100).id(orbKey)
                        } else {
                            StillOrb(colors: x.orb, size: 46, level: Double(x.value) / 100).saturation(0.25).opacity(0.75)
                        }
                        Text("\(x.value)").font(.custom("Outfit", size: 17).weight(.medium)).foregroundStyle(.white)
                            .shadow(color: .black.opacity(0.45), radius: 4)
                    }
                    .allowsHitTesting(false)
                    Text(x.name).font(.system(size: 13, weight: on ? .semibold : .regular)).foregroundStyle(.white.opacity(on ? 1 : 0.6))
                }
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
                .onTapGesture {
                    guard i != sel else { return }
                    withAnimation(.spring(response: 0.7, dampingFraction: 0.82)) { sel = i }
                    orbKey += 1
                }
                .accessibilityAddTraits(.isButton)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
    }

    private var sun: some View {
        GeometryReader { g in
            let H = g.size.height, size: CGFloat = 150
            let t = min(1, max(0, (CGFloat(m.value) - 40) / 60))
            let cy = H - 8 - t * (H - 8 - size / 2 - 6)
            ZStack {
                Circle().fill(m.glow.opacity(0.18)).frame(width: size * 1.7).blur(radius: 60)
                LivingOrb(mood: .good, size: size, motion: motion, palette: m.orb, glow: true, level: Double(m.value) / 100).id(orbKey)
                Text("\(m.value)").font(.custom("Outfit", size: 56).weight(.light)).foregroundStyle(.white)
                    .monospacedDigit().contentTransition(.numericText(value: Double(m.value)))
                    .shadow(color: .black.opacity(0.35), radius: 10).allowsHitTesting(false)
            }
            .frame(width: g.size.width, height: size * 2)
            .position(x: g.size.width / 2, y: cy)
            .mask(alignment: .top) {
                LinearGradient(stops: [.init(color: .black, location: 0), .init(color: .black, location: 0.93), .init(color: .clear, location: 1)],
                               startPoint: .top, endPoint: .bottom).frame(height: H - 8 + 14)
            }
            .contentShape(Rectangle())
            .onTapGesture { path.append(sel) }
        }
    }

    private var compactHeader: some View {
        HStack(spacing: 10) {
            LivingOrb(mood: .good, size: 26, motion: motion, palette: m.orb, glow: false, level: Double(m.value) / 100).allowsHitTesting(false)
            Text(phase.name).font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
            Text(phase.nowLabel).font(.custom("Outfit", size: 17).weight(.light)).foregroundStyle(.white.opacity(0.8))
            Text("· \(m.name) \(m.value)").font(.system(size: 14)).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
        }
        .padding(.leading, 8).padding(.trailing, 16).frame(height: 44)
        .glassEffect(.regular, in: .capsule)
        .padding(.top, 2)
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    // MARK: The lens strip: the selected orb's tiles + the door to its drill-down

    private var lensStrip: some View {
        VStack(spacing: 10) {
            LensTiles(lens: sel)
            Button { path.append(sel) } label: {
                HStack {
                    Text("\(m.name) részletesen").font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                    Spacer()
                    Text("a napok mögötte").font(.system(size: 13)).foregroundStyle(.white.opacity(0.5))
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
                }
                .padding(.horizontal, 18).frame(height: 50)
                .gCard(18)
            }
            .buttonStyle(.plain)
        }
        .id(sel)
        .transition(.asymmetric(insertion: .opacity.combined(with: .offset(y: 28)), removal: .opacity))
    }

    // MARK: Reggel — the plan of the day, accept or tweak

    private func phaseHead(_ p: DayPhase, _ range: String) -> some View {
        HStack(spacing: 10) {
            Text(p.name).font(AuraFont.serif(28)).foregroundStyle(.white)
            Text(range).font(AuraFont.mono(12)).foregroundStyle(.white.opacity(0.5)).padding(.top, 6)
            Spacer()
            if p == phase {
                HStack(spacing: 6) {
                    NowPulse(hue: m.glow).frame(width: 18)
                    Text("MOST").font(AuraFont.mono(11, .bold)).foregroundStyle(.white)
                }
            }
        }
    }

    private var reggel: some View {
        VStack(alignment: .leading, spacing: 14) {
            phaseHead(.reggel, "06:53 – 09:00")
            if planAccepted && !planOpen {
                Button { withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { planOpen = true } } label: {
                    HStack(spacing: 14) {
                        ZStack { Circle().fill(.white.opacity(0.9)); AuraGlyph("check-ink", gBase, size: 18) }.frame(width: 38, height: 38)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("A nap terve elfogadva").font(.system(size: 16, weight: .medium)).foregroundStyle(.white)
                            Text("07:42 · 5 pont · az edzés 18:30-kor").font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.55))
                        }
                        Spacer()
                        Image(systemName: "chevron.down").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
                    }
                    .padding(16).gCard()
                }
                .buttonStyle(.plain)
            } else {
                planCard
            }
        }
    }

    private var planCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                LivingOrb(mood: .good, size: 22, motion: motion, palette: m.orb, glow: false, level: 0.85)
                GLabel("A MAI TERVED")
                Spacer()
                if planAccepted {
                    Button { withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { planOpen = false } } label: {
                        Image(systemName: "chevron.up").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
                    }.buttonStyle(.plain)
                }
            }
            Text("Délelőtt fókusz, délután sok megbeszélés, este edzés.")
                .font(AuraFont.serif(20)).lineSpacing(3).foregroundStyle(.white).padding(.top, 12).padding(.bottom, 8)
            ForEach(Array(planRows.enumerated()), id: \.offset) { k, r in
                HStack(spacing: 14) {
                    Text(r.0).font(AuraFont.mono(13)).foregroundStyle(.white.opacity(0.7)).frame(width: 46, alignment: .leading)
                    AuraGlyph(r.1, .white, size: 17).frame(width: 22)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(r.2).font(.system(size: 15.5, weight: .medium)).foregroundStyle(.white)
                        Text(r.3).font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
                    }
                    Spacer()
                }
                .padding(.vertical, 9)
                if k < planRows.count - 1 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 60) }
            }
            ProposalCard(p: .pushWorkout, decided: decided[Proposal.pushWorkout.id], compact: true, onWhy: onWhy)
                .padding(.top, 12)
            if !planAccepted {
                HStack(spacing: 10) {
                    GPill(title: "Elfogadom a napot") {
                        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { planAccepted = true; planOpen = false }
                        onToast("A nap terve elfogadva")
                    }
                    GPill(title: "Módosítom", primary: false) { onToast("Mit változtassunk? — Boop megkérdezi") }
                }
                .padding(.top, 16)
            }
        }
        .padding(20)
        .gCard()
    }

    private var planRows: [(String, String, String, String)] {
        let pushed = decided[Proposal.pushWorkout.id] == true
        return [("07:20", "pen-sun", "Reggeli check-in", "fél perc"),
                ("12:30", "bowl-cream", "Ebéd · legalább 45 g fehérje", "a mai keret 2 350 kcal"),
                (pushed ? "18:30" : "18:00", "dumbbell-ink", "Felsőtest edzés", pushed ? "75 perc · áttéve 18:30-ra" : "75 perc"),
                ("21:30", "spark-cream", "Esti zárás", "egy perc"),
                ("22:45", "moon-cream", "Lefekvés", "7 és fél óra alvásért")]
    }

    // MARK: Napközben — the timeline, proposals at "most"

    private var napkozben: some View {
        VStack(alignment: .leading, spacing: 14) {
            phaseHead(.napkozben, "09:00 – 21:30")
            VStack(spacing: 0) {
                let items = TItem.day.filter { $0.t >= 8.5 && $0.t < 21.4 }
                let nowIdx = items.firstIndex { $0.t > phase.now } ?? items.count
                ForEach(Array(items.enumerated()), id: \.element.id) { k, it in
                    if k == nowIdx && phase == .napkozben { nowRow; proposals }
                    row(it, past: it.t <= phase.now, first: k == 0, last: k == items.count - 1 && !(nowIdx == items.count && phase == .napkozben))
                }
                if nowIdx == items.count && phase == .napkozben { nowRow; proposals }
            }
            .padding(.vertical, 8).padding(.horizontal, 6)
        }
    }

    private var nowRow: some View {
        HStack(spacing: 10) {
            Text(phase.nowLabel).font(AuraFont.mono(13, .bold)).foregroundStyle(.white).frame(width: 48, alignment: .trailing)
            NowPulse(hue: m.glow).frame(width: 24)
            Text("MOST").font(AuraFont.mono(11, .bold)).tracking(1.2).foregroundStyle(.white)
            Spacer()
        }
        .padding(.vertical, 8)
        .background(alignment: .leading) { line(lit: true).padding(.leading, 58) }
    }

    private var proposals: some View {
        HStack(alignment: .top, spacing: 10) {
            Color.clear.frame(width: 48)
            line(lit: false).frame(width: 24)
            ProposalCard(p: .moreFood, decided: decided[Proposal.moreFood.id], compact: false, onWhy: onWhy)
                .padding(.vertical, 8)
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    private func line(lit: Bool) -> some View {
        Rectangle().fill(lit ? .white : .white.opacity(0.16)).frame(width: lit ? 2 : 1.5)
            .shadow(color: lit ? m.glow.opacity(0.9) : .clear, radius: 5)
            .frame(width: 24)
    }

    private func row(_ it: TItem, past: Bool, first: Bool, last: Bool) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Text(it.time).font(AuraFont.mono(13)).foregroundStyle(.white.opacity(past ? 0.45 : 0.85)).frame(width: 48, alignment: .trailing)
            ZStack {
                VStack(spacing: 0) {
                    line(lit: past).opacity(first ? 0 : 1)
                    line(lit: past && !last).opacity(last ? 0 : 1)
                }
                ZStack {
                    Circle().fill(past ? .white : gBase)
                    if !past { Circle().stroke(.white.opacity(it.action != nil ? 0.8 : 0.3), lineWidth: 1.2) }
                    AuraGlyph(past ? "check-ink" : it.glyph, past ? gBase : .white, size: 13)
                }
                .frame(width: 26, height: 26)
                .shadow(color: !past && it.action != nil ? m.glow.opacity(0.7) : .clear, radius: 8)
            }
            .frame(width: 24)
            VStack(alignment: .leading, spacing: 3) {
                Text(it.title).font(.system(size: 15.5, weight: .medium)).foregroundStyle(.white.opacity(past ? 0.55 : 1))
                Text(it.sub).font(.system(size: 13)).foregroundStyle(.white.opacity(past ? 0.4 : 0.6))
                if it.kind == .calendar {
                    GBusy(from: it.t).frame(height: 6).opacity(past ? 0.5 : 1).padding(.top, 4).padding(.trailing, 20)
                }
            }
            .padding(.vertical, 12)
            Spacer(minLength: 4)
            if let a = it.action, !past {
                Text(a).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(a == "Kitöltöm" ? gBase : .white)
                    .padding(.horizontal, 13).frame(height: 34)
                    .background(Capsule().fill(a == "Kitöltöm" ? .white : .white.opacity(0.1)))
                    .onTapGesture { onToast(a == "Kitöltöm" ? "Check-in nyílik" : a == "Indítás" ? "Felsőtest indul · 00:00" : "Kamera nyílik") }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            switch it.kind {
            case .meal: path.append(3)
            case .train: path.append(2)
            case .wake, .sleep: path.append(1)
            case .checkin: path.append(0)
            default: break
            }
        }
    }

    // MARK: Este — close the day in under a minute

    private var este: some View {
        VStack(alignment: .leading, spacing: 14) {
            phaseHead(.este, "21:30 – 22:45")
            if closed {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        LivingOrb(mood: .good, size: 22, motion: motion, palette: m.orb, glow: false, level: 0.85)
                        GLabel("LEZÁRVA · 21:34")
                    }
                    Text("Jó nap volt. A fehérje és az edzés is megvolt — holnap 22:15-kor szólok a lefekvés miatt.")
                        .font(AuraFont.serif(19)).lineSpacing(4).foregroundStyle(.white)
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading).gCard()
            } else {
                closeCard
            }
        }
        .padding(.bottom, 40)
    }

    private var closeCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                GLabel(phase == .este ? "ZÁRD LE A NAPOT · 1 PERC" : "21:30-KOR NYÍLIK · 1 PERC")
                Spacer()
            }
            VStack(alignment: .leading, spacing: 12) {
                Text("Milyen volt a nap?").font(AuraFont.serif(22)).foregroundStyle(.white)
                HStack(spacing: 0) {
                    ForEach(1...5, id: \.self) { k in
                        let on = k <= rating
                        VStack(spacing: 6) {
                            StillOrb(colors: m.orb, size: 34, level: Double(k) / 5)
                                .saturation(on ? 1 : 0.15).opacity(on ? 1 : 0.55)
                                .scaleEffect(k == rating ? 1.12 : 1)
                            Text(["Nehéz", "", "Rendben", "", "Remek"][k - 1]).font(.system(size: 11)).foregroundStyle(.white.opacity(0.55)).frame(height: 12)
                        }
                        .frame(maxWidth: .infinity)
                        .contentShape(Rectangle())
                        .onTapGesture { withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) { rating = k } }
                    }
                }
                .sensoryFeedback(.selection, trigger: rating)
            }
            VStack(alignment: .leading, spacing: 10) {
                GLabel("A REGGELI TERVBŐL")
                goal("45 g fehérje ebédre", "46 g lett", true)
                goal("Felsőtest edzés 18:30", "75 perc, kész", true)
                goal("Lefekvés 22:45", "még előtted", false)
            }
            HStack(spacing: 10) {
                TextField("", text: $line, prompt: Text("Egy mondat a napról…").foregroundStyle(.white.opacity(0.45)))
                    .font(.system(size: 15)).foregroundStyle(.white)
                AuraGlyph("chat-ink", .white.opacity(0.7), size: 18)
            }
            .padding(.horizontal, 18).frame(height: 50)
            .background(Capsule().fill(.white.opacity(0.08)))
            .overlay(Capsule().stroke(.white.opacity(0.12)))
            HStack {
                GPill(title: "Lezárom") {
                    withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { closed = true }
                    onToast("A nap lezárva")
                }
                .opacity(rating > 0 ? 1 : 0.5)
                .disabled(rating == 0)
                Spacer()
                Text("Ma kihagyom").font(.system(size: 14)).foregroundStyle(.white.opacity(0.55))
            }
        }
        .padding(20)
        .gCard()
        .opacity(phase == .este ? 1 : 0.62)
    }

    private func goal(_ t: String, _ s: String, _ done: Bool) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(done ? .white : .clear)
                Circle().stroke(.white.opacity(done ? 0 : 0.35), lineWidth: 1.2)
                if done { AuraGlyph("check-ink", gBase, size: 14) }
            }
            .frame(width: 24, height: 24)
            Text(t).font(.system(size: 15)).foregroundStyle(.white)
            Spacer()
            Text(s).font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
        }
    }
}

/// The meetings of one calendar block melted into 15-minute slots (brighter = busier). White only.
struct GBusy: View {
    var from: Double
    var body: some View {
        Canvas { ctx, s in
            let slots = from < 12 ? 12 : 14
            let w = s.width / CGFloat(slots)
            for k in 0..<slots {
                let busy = [0.5, 0.7, 0.9, 0.6, 0.3][(k * 7 + Int(from)) % 5]
                ctx.fill(Path(roundedRect: CGRect(x: CGFloat(k) * w + 0.5, y: 0, width: w - 1.5, height: s.height), cornerRadius: 2),
                         with: .color(.white.opacity(busy * 0.7)))
            }
        }
    }
}
