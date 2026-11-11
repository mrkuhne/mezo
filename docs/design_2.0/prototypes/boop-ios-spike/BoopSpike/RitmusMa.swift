import SwiftUI

// Throwaway spike (mezo-r36n9.13, B3 Napi ritmus): Ma with the daily loop wired in — copied from B2's GerincMa
// (spike only) and changed where B3 adds something: the goal of the day in Reggel, the energy-of-the-day curve
// with the owner's own check-in dots, check-in rows that open the 3-tap check-in, Este opening the close-out.

struct RitmusMa: View {
    @Binding var phase: DayPhase
    @Binding var path: [Int]
    @Binding var decided: [String: Bool]
    var onWhy: (Proposal) -> Void
    var onToast: (String) -> Void
    var day: RitmusDay
    var onCheckin: () -> Void
    var onEste: () -> Void
    @State private var goalDraft = ""
    @State private var curveSel: UUID? = nil

    @State private var sel = GArg.int("gerincMetric", 0, 4)
    @State private var motion = OrbMotion()
    @State private var orbKey = 0
    @State private var reminderSet = false
    @State private var planOpen = false
    @State private var planAccepted = false
    @State private var compact = false
    @State private var scrollTarget = GArg.str("ritmusScroll")
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
                        planAccepted = day.planAccepted || phase != .reggel
                        if phase != .reggel && day.goal == nil { day.goal = "Ügyfélprezentáció 14:00" }
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
                    GPill(title: day.closed ? "A nap lezárva" : "Lezárom a napot", glyph: "spark-cream") { onEste() }
                    .padding(.top, 4)
                } else {
                    AuraLensAction(sel: sel, orb: m.orb, motion: motion, breathing: false, reminderSet: $reminderSet,
                                   onPrimary: { a in
                                       if a == "bedtime" { reminderSet.toggle(); if reminderSet { onToast("Emlékeztető 22:15-re beállítva") } }
                                       else if a.hasPrefix("log:") { onToast(String(a.dropFirst(4)) + " · hozzáadva") }
                                       else if a == "checkin" { onCheckin() }
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
                            Text("07:42 · a nap célja: \(day.goal ?? "–")").lineLimit(1).font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.55))
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
            goalBlock.padding(.top, 14)
            ProposalCard(p: .pushWorkout, decided: decided[Proposal.pushWorkout.id], compact: true, onWhy: onWhy)
                .padding(.top, 12)
            if !planAccepted {
                HStack(spacing: 10) {
                    GPill(title: "Elfogadom a napot") {
                        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { planAccepted = true; planOpen = false; day.planAccepted = true }
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

    /// B3: the goal of the day — ONE thing, typed or said, or one tap on Boop's suggestion (calendar / overdue things).
    private var goalBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            GLabel("MI MA A LEGFONTOSABB?")
            if let g = day.goal {
                HStack(spacing: 12) {
                    AuraGlyph("star-sun", .white, size: 18)
                    Text(g).font(AuraFont.serif(19)).foregroundStyle(.white)
                    Spacer()
                    Text("csere").font(.system(size: 13)).foregroundStyle(.white.opacity(0.5))
                        .onTapGesture { withAnimation { day.goal = nil } }
                }
                .padding(.horizontal, 16).frame(height: 52)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.1)))
            } else {
                HStack(spacing: 10) {
                    TextField("", text: $goalDraft, prompt: Text("Egy dolog, amin ma múlik…").foregroundStyle(.white.opacity(0.45)))
                        .font(.system(size: 15)).foregroundStyle(.white)
                        .onSubmit { if !goalDraft.isEmpty { withAnimation { day.goal = goalDraft } } }
                    RMicGlyph(color: .white.opacity(0.8), size: 20)
                        .onTapGesture { withAnimation { day.goal = "Döntés a beszállítóról" } ; onToast("Bemondva: Döntés a beszállítóról") }
                }
                .padding(.horizontal, 16).frame(height: 48)
                .background(Capsule().fill(.white.opacity(0.08)))
                .overlay(Capsule().stroke(.white.opacity(0.12)))
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        goalChip("Ügyfélprezentáció 14:00", "a naptárból")
                        goalChip("Meal prep a hétre", "8 napja nem volt")
                        goalChip("Röpi 19:00", "a heti terv")
                    }
                }
                .scrollIndicators(.hidden)
            }
        }
    }

    private func goalChip(_ t: String, _ why: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(t).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
            Text(why).font(.system(size: 11.5)).foregroundStyle(.white.opacity(0.55))
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.08)))
        .onTapGesture { withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { day.goal = t } }
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
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    GLabel("AZ ENERGIÁD MA")
                    Spacer()
                    Text("\(day.checkins.count) / 3 kitöltés").font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.5))
                }
                REnergyCurve(day: day, now: phase.now, hue: SunMetric.all[2].glow, selected: $curveSel, height: 130)
                if let c = day.checkins.first(where: { $0.id == curveSel }) { RCheckinDetail(c: c).transition(.opacity) }
            }
            .padding(18).gCard()
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
                    .onTapGesture { if a == "Kitöltöm" { onCheckin(); return }; onToast(a == "Indítás" ? "Felsőtest indul · 00:00" : "Kamera nyílik") }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            switch it.kind {
            case .meal: path.append(3)
            case .train: path.append(2)
            case .wake, .sleep: path.append(1)
            case .checkin: if past { curveSel = day.checkins.last(where: { $0.t <= it.t + 0.5 })?.id } else { onCheckin() }
            default: break
            }
        }
    }

    // MARK: Este — close the day in under a minute

    private var este: some View {
        VStack(alignment: .leading, spacing: 14) {
            phaseHead(.este, "21:30 – 22:45")
            if day.closed {
                Button(action: onEste) {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 8) {
                            LivingOrb(mood: .good, size: 22, motion: motion, palette: m.orb, glow: false, level: 0.85)
                            GLabel("LEZÁRVA · 21:33")
                            Spacer()
                            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
                        }
                        Text(day.offline ? "A napod a telefonon van — Boop válasza akkor jön, ha lesz net."
                                         : "Jó nap volt: a prezentáció sikerült, a fehérje és a röpi is megvolt.")
                            .font(AuraFont.serif(19)).lineSpacing(4).foregroundStyle(.white).multilineTextAlignment(.leading)
                    }
                    .padding(20).frame(maxWidth: .infinity, alignment: .leading).gCard()
                }.buttonStyle(.plain)
            } else {
                VStack(alignment: .leading, spacing: 16) {
                    GLabel(phase == .este ? "ZÁRD LE A NAPOT · 1 PERC" : "21:30-KOR SZÓLOK · 1 PERC")
                    HStack(spacing: 10) {
                        ForEach(["Hogy vagy", "A nap célja", "Milyen volt", "Mesélj"], id: \.self) { t in
                            Text(t).font(.system(size: 12.5, weight: .medium)).foregroundStyle(.white.opacity(0.75))
                                .padding(.horizontal, 10).frame(height: 28)
                                .background(Capsule().fill(.white.opacity(0.08)))
                        }
                    }
                    GPill(title: "Lezárom a napot", glyph: "spark-cream") { onEste() }
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading).gCard()
                .opacity(phase == .este ? 1 : 0.62)
            }
        }
        .padding(.bottom, 40)
    }
}

