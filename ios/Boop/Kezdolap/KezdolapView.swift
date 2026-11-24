import SwiftUI
import BoopCore
import BoopDesign

/// Where the home screen sends you.
enum KezdolapRoute: Equatable {
    /// Today's Nap page as it is (the morning brief, the day, the proposals).
    case nap
    /// The Nap page with that area's room already open.
    case room(Hue)
    /// The day's own page — the eighth orb (owner, 2026-11-16, decision #41). Since the day page itself became
    /// the Élet spike's Ma screen (`mezo-r36n9.56`), this orb and the ring's centre land on the **same** page;
    /// the full list of the day is one fold inside it.
    case day

    var room: Hue? { if case .room(let h) = self { h } else { nil } }
}

/// **The home screen** (owner 2026-11-13): "boop" at the top, the nine life areas as living orbs laid out on a
/// circle, Boop's own orb in the middle, and behind them a photographed misty mountain ridge with fog drifting
/// across it (the cool blue world — no lilac here, owner round 2).
///
/// The orbs **fade in out of the fog** when the screen opens. Tapping one **zooms into that orb** and cross-fades to
/// its area; coming back fades the area out and the ring back in. Tapping Boop opens today's Nap page, which is not
/// replaced — it moves one level in. Nine areas since 2026-11-24 (Súly, `mezo-r36n9.158`); every one is live.
struct KezdolapView: View {
    @Environment(MorningStore.self) private var morning: MorningStore?
    /// The Étel orb's number is the Étel room's own (the day's meal points), the Pénz orb's the week's remaining share
    /// (`mezo-r36n9.152`, `.153`): both read their own store, not the brief.
    @Environment(\.foodClient) private var food
    @Environment(PenzStore.self) private var penz: PenzStore?
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    /// The "+" sheet's "Edzés indítása" asks the ring to open the Edzés room (`mezo-r36n9.154`).
    @Environment(RitmusRouter.self) private var router: RitmusRouter?
    @Environment(\.openPick) private var openPick
    /// The Súly orb's number is the pace score of the Súly store (`mezo-r36n9.158`).
    @Environment(SulyStore.self) private var suly: SulyStore?
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openAccount) private var openAccount
    @Environment(\.setRoomOpen) private var setRoomOpen
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.kezdolapHomeReset) private var homeResetTick
    @State private var route: KezdolapRoute? = KezdolapView.initialRoute
    /// The ring is zoomed into the tapped orb and faded out; the area page is up over it.
    @State private var zoomed = false
    @State private var pageIn = false
    /// Where the tapped orb sat, as a point of the screen: the zoom grows out of exactly that spot.
    @State private var anchor: UnitPoint = .center
    @State private var toast: String?
    /// Boop's own orb: it slooshes and ripples under a finger like the hero's does.
    @State private var motion = OrbMotion()
    /// The screen's own rectangle in global coordinates: a tapped orb's point becomes the zoom's anchor in it.
    @State private var screen: CGRect = .zero
    /// The day's meals, for the Étel orb (a light read: the day alone).
    @State private var etel = EtelStore()

    /// The home's colour world: the cool blue of the mountain photo.
    private static let world = Hue.alvas

    private var brief: Brief? { morning?.brief }

    var body: some View {
        GeometryReader { geo in
            let box = geo.frame(in: .global)
            ZStack {
                home
                    .allowsHitTesting(route == nil)
                    .accessibilityHidden(route != nil)
                if let route {
                    NapView(initialRoom: route.room, onHome: closeRoute)
                        .opacity(pageIn ? 1 : 0)
                }
            }
            .onAppear { screen = box }
            .onChange(of: geo.size) { screen = geo.frame(in: .global) }
        }
        .nkToast($toast)
        // A route that is already set when the screen first appears (a simulator preview, and tomorrow a
        // notification opening an area) never ran the transition, so the page sat mounted at zero opacity behind
        // the ring: arrive already there.
        .onAppear { if route != nil { zoomed = true; pageIn = true } }
        // The home is Ma's root now, so the brief is fetched and kept fresh from here.
        .background { if let morning { MorningTriggers(store: morning) } }
        // The bottom bar's "Ma" tapped again while a page is open: back to the ring.
        .onChange(of: homeResetTick) { if route != nil { closeRoute() } }
        // The Étel, Pénz and Súly numbers: on arrival, when the app comes back, when a meal, an expense or a weigh-in lands.
        .task { await loadNumbers() }
        .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await loadNumbers() } } }
        .onChange(of: ritmus?.mealDraftsTick) { Task { await loadFood() } }
        .onChange(of: ritmus?.penzTick) { Task { await penz?.load(force: true) } }
        .onChange(of: ritmus?.weightTick) { Task { await suly?.load(force: true) } }
        // The "+" sheet asked for a room (from any place of the bar): the ring opens it once it is up.
        .onAppear { if let hue = router?.takeRoom() { openArea(hue) } }
        .onChange(of: router?.room) { _, hue in if let hue { router?.room = nil; openArea(hue) } }
    }

    /// The ring's own numbers: the day's meals, the week's money, the weight's pace. None blocks the ring; each shows "–" until it is here.
    private func loadNumbers() async {
        // One after the other: an `async let` over the store's optional-chained read tripped the concurrency runtime
        // (`swift_task_dealloc` abort at launch); two small reads need no parallelism.
        await loadFood()
        await penz?.load()
        await suly?.load()
    }

    private func loadFood() async {
        guard let food else { return }
        await etel.loadDay(food: food, now: Date())
    }

    /// A room asked for from outside the ring: opened from the ring's centre, or — with a page already up — after the
    /// ring has come back (two moves never overlap).
    private func openArea(_ hue: Hue) {
        let centre = CGPoint(x: screen.midX, y: screen.midY)
        if route == nil {
            openRoute(.room(hue), from: centre, in: screen)
        } else {
            closeRoute()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { openRoute(.room(hue), from: centre, in: screen) }
        }
    }

    // MARK: - Going in and coming back

    /// Into an area (or the Nap page): the ring grows out of the tapped orb and dissolves, the page arrives over it.
    private func openRoute(_ new: KezdolapRoute, from point: CGPoint, in screen: CGRect) {
        guard route == nil else { return }
        anchor = screen.width > 0 && screen.height > 0
            ? UnitPoint(x: (point.x - screen.minX) / screen.width, y: (point.y - screen.minY) / screen.height)
            : .center
        route = new
        pageIn = false
        // One frame for the page to be built before anything moves: starting the zoom in the same pass as the
        // page's first layout is what made the first half of it stutter.
        DispatchQueue.main.async {
            if reduceMotion {
                withAnimation(.easeInOut(duration: 0.3)) { zoomed = true; pageIn = true }
            } else {
                let k = nkMotionScale
                withAnimation(.easeIn(duration: 0.55 * k)) { zoomed = true }
                withAnimation(.easeOut(duration: 0.45 * k).delay(0.28 * k)) { pageIn = true }
            }
        }
    }

    /// Back out: the page fades away and the ring settles back out of the fog.
    private func closeRoute() {
        setRoomOpen(false)
        let k = nkMotionScale
        withAnimation(reduceMotion ? .easeInOut(duration: 0.25) : .easeIn(duration: 0.3 * k)) { pageIn = false }
        withAnimation(reduceMotion ? .easeInOut(duration: 0.3) : .easeOut(duration: 0.6 * k)) { zoomed = false }
        // The page leaves once it has faded; until then it cross-fades with the ring coming back.
        DispatchQueue.main.asyncAfter(deadline: .now() + (reduceMotion ? 0.3 : 0.34 * k)) { route = nil }
        // The room may have changed what the orbs say (a meal logged, an expense typed): read the numbers again.
        Task { await loadNumbers() }
    }

    // MARK: - The ring

    private var home: some View {
        GeometryReader { geo in
            let ring = min(geo.size.width - 10, geo.size.height * 0.50)
            ZStack {
                // The backdrop never takes part in the zoom: a blurred fog canvas scaled six times over is what the
                // phone could not keep up with. It only fades, while the ring alone grows out of the tapped orb.
                // The frame + clip matter: a scaledToFill photo without them inflates the stack and pushes the
                // title row's bell and avatar off the screen edges.
                NKPhotoSky(hue: Self.world, photo: NKPhoto.hegy)
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped()
                    .ignoresSafeArea()
                if route == nil || !zoomed {
                    DriftingFog(hue: Self.world, center: 0.58, height: 0.46)
                        .transition(.opacity)
                }
                VStack(spacing: 0) {
                    NKTitleRow(bellCount: 0, onBell: { toast = soonToast("Értesítések") }, onPlus: nil,
                               onAvatar: openAccount)
                        .padding(.top, 54)
                    Spacer(minLength: 0)
                    ringView(side: ring)
                    boopLine
                        .padding(.top, 34)
                    quickDoors
                        .padding(.top, 26).padding(.horizontal, 22)
                    Spacer(minLength: 0)
                    Color.clear.frame(height: 112)
                }
                // Only the ring and its words dive into the orb; everything is frozen first, so the whole layer is
                // one unchanging picture the phone can simply scale.
                .scaleEffect(zoomed && !reduceMotion ? 3.4 : 1, anchor: anchor)
                .opacity(zoomed ? 0 : 1)
            }
            .opacity(zoomed && reduceMotion ? 0 : 1)
            .frame(width: geo.size.width, height: geo.size.height)
            // The shell paints the shared sky behind the places: here it is the same cool world.
            .preference(key: NKBackdropKey.self,
                        value: NKBackdrop(hue: Self.world, heroHeight: geo.size.height + geo.safeAreaInsets.top,
                                          scrollY: 0))
        }
        .ignoresSafeArea(edges: .top)
    }

    private func ringView(side: CGFloat) -> some View {
        // Nine orbs: 56 pt where the ring is wide, smaller where it is not (a short phone's ring is its height), so
        // every name keeps clear of the orb under it (`mezo-r36n9.158`).
        NKOrbRing(items: Area.allCases.map { ringItem($0, brief: brief, foodDay: etel.day, penz: penz?.allowance, suly: suly?.score) },
                  orbSize: side < 360 ? 46 : (side < 400 ? 52 : 56), live: route == nil) { item, point in
            open(item, at: point)
        } center: {
            boopCenter
        }
        .frame(width: side, height: side)
        .frame(maxWidth: .infinity)
    }

    /// Boop's own orb in the middle of the ring: no number, and it opens today's Nap page.
    private var boopCenter: some View {
        // The orb's own gestures (slosh, ripple) would eat the tap, so the door is a circle over it.
        ZStack {
            LivingOrb(palette: boopOrb, size: 122, level: 0.72, glow: true, motion: motion,
                      animated: !reduceMotion && route == nil)
                .allowsHitTesting(false)
            GeometryReader { g in
                let c = g.frame(in: .global)
                Circle().fill(.clear).contentShape(Circle())
                    .onTapGesture { openRoute(.nap, from: CGPoint(x: c.midX, y: c.midY), in: screen) }
            }
        }
        .frame(width: 122, height: 122)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Boop · \(kezdolapLine(brief)). A napod megnyitása")
        .accessibilityAddTraits(.isButton)
    }

    /// The quick log's own doors on the home screen (owner 2026-11-24, `mezo-r36n9.157`): the five he records most,
    /// each one tap from the ring — a glass circle with a glyph and a quiet mono name, the ring's own vocabulary at a
    /// smaller size. The bar's "+" keeps every other door.
    private var quickDoors: some View {
        HStack(spacing: 0) {
            ForEach(Self.doors, id: \.label) { d in
                Button { openPick(d.pick) } label: {
                    VStack(spacing: 7) {
                        NKGlyph(d.glyph, .white, size: 19)
                            .frame(width: 46, height: 46)
                            .glassEffect(.regular.interactive(), in: .circle)
                        Text(d.label).nkFont(10, .medium, design: .monospaced).tracking(1.1)
                            .foregroundStyle(.white.opacity(0.72)).lineLimit(1).minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(d.name) rögzítése")
            }
        }
    }

    /// The five doors, in the order he reaches for them.
    static let doors: [(glyph: String, label: String, name: String, pick: CapturePick)] = [
        ("bowl-cream", "ÉTKEZÉS", "Étkezés", .meal(.pick, text: "")),
        ("drop-sky", "VÍZ", "Víz", .quick(.water)),
        ("scale-ink", "SÚLY", "Súly", .quick(.weight)),
        ("spark-cream", "CHECK-IN", "Check-in", .cover(.checkin)),
        ("book-sage", "NAPLÓ", "Napló", .quick(.journal)),
    ]

    /// Boop's line under the ring: the day in a few words, and the second way into the Nap page.
    private var boopLine: some View {
        VStack(spacing: 6) {
            Text(kezdolapLine(brief))
                .nkFont(23, design: .serif)
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineLimit(2).minimumScaleFactor(0.7)
                .shadow(color: .black.opacity(0.55), radius: 10)
            Text("A NAPOD").nkFont(11, .medium, design: .monospaced).tracking(2.2)
                .foregroundStyle(.white.opacity(0.62))
        }
        .padding(.horizontal, 28)
        .contentShape(Rectangle())
        .onTapGesture { openRoute(.nap, from: CGPoint(x: screen.midX, y: screen.midY), in: screen) }
        .accessibilityHidden(true)
    }

    /// A tap in the ring: an area that is live opens its room, and an area still to be built says so instead of
    /// opening an empty page.
    private func open(_ item: NKRingItem, at point: CGPoint) {
        guard let area = Area(rawValue: Int(item.id) ?? -1) else { return }
        if area == .nap {
            openRoute(.day, from: point, in: screen)
        } else if let world = area.world {
            // Pénz and Levél have a page before they have data (`mezo-r36n9.57`): it is the page the owner
            // approved in the spike, and every tab of it says what will be there instead of a made-up number.
            openRoute(.room(world), from: point, in: screen)
        } else {
            toast = area.soonLine
        }
    }

    /// Simulator review: `-previewHome nap|alvas|etel|edzes|energia|suly|forma|penz|level|nap-oldal` opens the home
    /// already moved on.
    private static var initialRoute: KezdolapRoute? {
        #if DEBUG
        switch UserDefaults.standard.string(forKey: "previewHome") {
        case "nap": return .nap
        case "alvas": return .room(.alvas)
        case "etel": return .room(.fuel)
        case "edzes": return .room(.mozgas)
        case "energia": return .room(.pulzus)
        case "forma": return .room(.forma)
        case "penz": return .room(.penz)
        case "level": return .room(.level)
        case "suly": return .room(.suly)
        case "nap-oldal": return .day
        default: return nil
        }
        #else
        return nil
        #endif
    }
}

/// Boop's own orb in the middle: a pale, luminous pearl — the sun through the mist. Brighter and quieter than the
/// seven coloured ones, so it reads as Boop and not as an eighth area.
let boopOrb: [Color] = [Color(hex: 0x264663), Color(hex: 0x8FB8CE), Color(hex: 0xDCEEF8), Color(hex: 0xFFFFFF)]

// MARK: - Environment

private struct CloseRoomKey: EnvironmentKey { static let defaultValue: (@MainActor @Sendable () -> Void)? = nil }
extension EnvironmentValues {
    /// The way out of a room the home screen's ring opened: back to the ring, with no navigation pop under it.
    /// nil means the room sits in a navigation stack and closes itself the usual way.
    var closeRoom: (@MainActor @Sendable () -> Void)? {
        get { self[CloseRoomKey.self] }
        set { self[CloseRoomKey.self] = newValue }
    }
}

private struct KezdolapHomeResetKey: EnvironmentKey { static let defaultValue = 0 }
extension EnvironmentValues {
    /// Bumped by the shell when the bar's "Ma" is tapped while Ma is already the place: the home screen comes back.
    var kezdolapHomeReset: Int {
        get { self[KezdolapHomeResetKey.self] }
        set { self[KezdolapHomeResetKey.self] = newValue }
    }
}
