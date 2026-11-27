import SwiftUI
import BoopCore
import BoopDesign

/// Where the home screen sends you (`mezo-r36n9.196`): the Nap room on one of its tabs, an area's room, or Boop's chat.
enum KezdolapRoute: Equatable {
    /// The Nap room (decision #135): Ma (the day page) or Napok (the last 14 days).
    case nap(NapTab)
    /// An area's room, on the tab it asks for (nil = its own default).
    case room(RoomEntry)
    /// Boop's chat — the ring's centre orb (decision #134).
    case chat

    /// The route a destination asks for; `.home` asks for none.
    init?(_ d: BoopDestination) {
        switch d {
        case .home: return nil
        case .nap(let t): self = .nap(t)
        case .room(let e): self = .room(e)
        case .chat: self = .chat
        }
    }
}

/// **The home screen** (owner 2026-11-13): "boop" at the top, the nine life areas as living orbs laid out on a
/// circle, Boop's own orb in the middle, and behind them a photographed misty mountain ridge with fog drifting
/// across it (the cool blue world — no lilac here, owner round 2).
///
/// The orbs **fade in out of the fog** when the screen opens. Tapping one **zooms into that orb** and cross-fades to
/// its area; coming back fades the area out and the ring back in. Since the barless home (`mezo-r36n9.196`) there is no
/// bottom bar: Boop's orb in the middle opens the chat, the Nap orb the Nap room (Ma · Napok), and the floating „+"
/// opens the capture sheet. Ten areas — Évad is the tenth, its number this week's adherence.
struct KezdolapView: View {
    @Environment(MorningStore.self) private var morning: MorningStore?
    /// The Étel orb's number is the Étel room's own (the day's meal points), the Pénz orb's the week's remaining share
    /// (`mezo-r36n9.152`, `.153`): both read their own store, not the brief.
    @Environment(\.foodClient) private var food
    @Environment(PenzStore.self) private var penz: PenzStore?
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    /// Where something outside the ring asks to go (the "+" sheet's "Edzés indítása", a „Kérdezd meg Boopot" row,
    /// a restored old place): the ring opens it.
    @Environment(RitmusRouter.self) private var router: RitmusRouter?
    @Environment(\.openCapture) private var openCapture
    /// The Évad orb's number: this week's adherence (`mezo-r36n9.196`).
    @Environment(EvadStore.self) private var evad: EvadStore?
    /// The Súly orb's number is the pace score of the Súly store (`mezo-r36n9.158`).
    @Environment(SulyStore.self) private var suly: SulyStore?
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openAccount) private var openAccount
    @Environment(\.setRoomOpen) private var setRoomOpen
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var route: KezdolapRoute? = KezdolapView.initialRoute
    /// A close is running (the page is fading out); what was asked meanwhile opens once it is done.
    @State private var closing = false
    @State private var pending: KezdolapRoute?
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
                    routePage(route)
                        .environment(\.nkFloatingPlus, route != .chat)
                        .opacity(pageIn ? 1 : 0)
                        // a page on its way out takes no more taps
                        .allowsHitTesting(!closing)
                }
                // The floating „+" (decision #134): on the ring, and raised above a room's bar; never over the chat.
                if route != .chat {
                    NKFloatingPlus(raised: route != nil) { openCapture() }
                        .transition(.opacity)
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
        // The Étel, Pénz and Súly numbers: on arrival, when the app comes back, when a meal, an expense or a weigh-in lands.
        .task { await loadNumbers() }
        .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await loadNumbers(force: true) } } }
        .onChange(of: ritmus?.mealDraftsTick) { Task { await loadFood() } }
        .onChange(of: ritmus?.penzTick) { Task { await penz?.load(force: true) } }
        .onChange(of: ritmus?.weightTick) { Task { await suly?.load(force: true) } }
        // Somewhere asked for from outside the ring (the "+" sheet, a page's „Kérdezd meg Boopot", a restored old
        // place): the ring opens it once it is up.
        .onAppear { if let d = router?.takeDestination() { go(d) } }
        .onChange(of: router?.destination) { _, d in if d != nil, let d = router?.takeDestination() { go(d) } }
    }

    /// The page a route shows.
    @ViewBuilder private func routePage(_ route: KezdolapRoute) -> some View {
        switch route {
        case .nap(.napok):
            // The day list never waits for the brief or Health; Ma switches to the full room.
            NapokOnlyRoom(brief: brief, onBack: back, onMa: { self.route = .nap(.ma) })
        case .nap(let tab): NapView(initialNapTab: tab, onHome: back)
        case .room(let entry) where entry.hue == .evad:
            // The season never waited for the morning brief: Évad opens even offline or without Health.
            EvadPage().environment(\.closeRoom, back)
        case .room(let entry): NapView(initialRoom: entry.hue, onHome: back)
        case .chat: BoopTabView(onBack: back)
        }
    }

    /// The way back to the ring every route page gets.
    private var back: @MainActor @Sendable () -> Void { { closeRoute() } }

    /// The ring's own numbers: the day's meals, the week's money, the weight's pace. None blocks the ring; each shows "–" until it is here.
    /// `force` re-reads the Súly store even when it has a picture: the scale's weigh-in arrives through the Health
    /// sync, which bumps no tick, so coming forward and closing a room ask again.
    private func loadNumbers(force: Bool = false) async {
        // One after the other: an `async let` over the store's optional-chained read tripped the concurrency runtime
        // (`swift_task_dealloc` abort at launch); two small reads need no parallelism.
        await loadFood()
        await penz?.load()
        await suly?.load(force: force)
        await evad?.load()
        await evad?.loadWeek(force: force)
    }

    private func loadFood() async {
        guard let food else { return }
        await etel.loadDay(food: food, now: Date())
    }

    /// A destination asked for from outside the ring: opened from the ring's centre, or — with a page already up —
    /// after the ring has come back (two moves never overlap). `.home` just closes what is open.
    private func go(_ d: BoopDestination) {
        let centre = CGPoint(x: screen.midX, y: screen.midY)
        guard let new = KezdolapRoute(d) else {
            if closing { pending = nil } else if route != nil { closeRoute() }
            return
        }
        if closing {
            pending = new          // the latest ask wins; it opens as soon as the ring is back
        } else if route == nil {
            openRoute(new, from: centre, in: screen)
        } else if route != new {
            closeRoute(then: new)
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

    /// Back out: the page fades away and the ring settles back out of the fog; `next` opens once the ring is back.
    /// A second close while one is running (a double tap on back) only updates what opens next.
    private func closeRoute(then next: KezdolapRoute? = nil) {
        if closing { if let next { pending = next }; return }
        closing = true
        pending = next
        setRoomOpen(false)
        let k = nkMotionScale
        withAnimation(reduceMotion ? .easeInOut(duration: 0.25) : .easeIn(duration: 0.3 * k)) { pageIn = false }
        withAnimation(reduceMotion ? .easeInOut(duration: 0.3) : .easeOut(duration: 0.6 * k)) { zoomed = false }
        // The page leaves once it has faded; until then it cross-fades with the ring coming back.
        DispatchQueue.main.asyncAfter(deadline: .now() + (reduceMotion ? 0.3 : 0.34 * k)) {
            route = nil
            closing = false
            if let p = pending {
                pending = nil
                openRoute(p, from: CGPoint(x: screen.midX, y: screen.midY), in: screen)
            }
        }
        // The room may have changed what the orbs say (a meal logged, an expense typed): read the numbers again.
        Task { await loadNumbers(force: true) }
    }

    // MARK: - The ring

    private var home: some View {
        GeometryReader { geo in
            // The spike's sizes (decision #134): with no bar under it the ring takes more of the height.
            let ring = min(geo.size.width - 6, geo.size.height * (geo.size.width < 380 ? 0.60 : 0.56))
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
                        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
                    Spacer(minLength: 0)
                    ringView(side: ring)
                    boopLine
                        .padding(.top, 28)
                        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
                    Spacer(minLength: 0)
                    // room for the floating „+" in the bottom corner
                    Color.clear.frame(height: 40 + geo.safeAreaInsets.bottom)
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
        .ignoresSafeArea(edges: [.top, .bottom])
    }

    private func ringView(side: CGFloat) -> some View {
        // Ten orbs: 54 pt where the ring is wide, smaller where it is not (a short phone's ring is its height), so
        // every name keeps clear of the orb under it (`mezo-r36n9.158`, `.196`).
        NKOrbRing(items: Area.allCases.map { ringItem($0, brief: brief, foodDay: etel.day, penz: penz?.allowance,
                                                      suly: suly?.score, evad: evad?.weekScore) },
                  orbSize: side < 360 ? 44 : (side < 400 ? 50 : 54), live: route == nil) { item, point in
            open(item, at: point)
        } center: {
                boopCenter(size: side < 360 ? 104 : 122)
        }
        .frame(width: side, height: side)
        .frame(maxWidth: .infinity)
        // The names sit in fixed gaps between ten orbs: past this size they would run into their neighbours. Each
        // orb still reads its full name and number to VoiceOver.
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
    }

    /// Boop's own orb in the middle of the ring: no number, and it opens Boop's chat (decision #134).
    private func boopCenter(size: CGFloat) -> some View {
        // The orb's own gestures (slosh, ripple) would eat the tap, so the door is a circle over it.
        ZStack {
            LivingOrb(palette: boopOrb, size: size, level: 0.72, glow: true, motion: motion,
                      animated: !reduceMotion && route == nil)
                .allowsHitTesting(false)
            GeometryReader { g in
                let c = g.frame(in: .global)
                Circle().fill(.clear).contentShape(Circle())
                    .onTapGesture { openRoute(.chat, from: CGPoint(x: c.midX, y: c.midY), in: screen) }
            }
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Boop · beszélgetés megnyitása")
        .accessibilityHint(kezdolapLine(brief))
        .accessibilityAddTraits(.isButton)
    }

    /// Boop's line under the ring: the day in a few words, and the second way into Boop's chat.
    private var boopLine: some View {
        VStack(spacing: 6) {
            Text(kezdolapLine(brief))
                .nkFont(23, design: .serif)
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineLimit(2).minimumScaleFactor(0.7)
                .shadow(color: .black.opacity(0.55), radius: 10)
            Text("KÉRDEZD BOOPOT").nkFont(11, .medium, design: .monospaced).tracking(2.2)
                .foregroundStyle(.white.opacity(0.62))
        }
        .padding(.horizontal, 28)
        .contentShape(Rectangle())
        .onTapGesture { openRoute(.chat, from: CGPoint(x: screen.midX, y: screen.midY), in: screen) }
        .accessibilityHidden(true)
    }

    /// A tap in the ring: an area that is live opens its room, and an area still to be built says so instead of
    /// opening an empty page.
    private func open(_ item: NKRingItem, at point: CGPoint) {
        guard let area = Area(rawValue: Int(item.id) ?? -1) else { return }
        if area == .nap {
            openRoute(.nap(.ma), from: point, in: screen)
        } else if let world = area.world {
            // Pénz and Levél have a page before they have data (`mezo-r36n9.57`): it is the page the owner
            // approved in the spike, and every tab of it says what will be there instead of a made-up number.
            openRoute(.room(RoomEntry(world)), from: point, in: screen)
        } else {
            toast = area.soonLine
        }
    }

    /// Simulator review: `-previewHome nap|napok|chat|alvas|etel|edzes|energia|evad|suly|forma|penz|level` opens the
    /// home already moved on.
    private static var initialRoute: KezdolapRoute? {
        #if DEBUG
        switch UserDefaults.standard.string(forKey: "previewHome") {
        case "nap", "nap-oldal": return .nap(.ma)
        case "napok": return .nap(.napok)
        case "chat": return .chat
        case "alvas": return .room(RoomEntry(.alvas))
        case "etel": return .room(RoomEntry(.fuel))
        case "edzes": return .room(RoomEntry(.mozgas))
        case "energia": return .room(RoomEntry(.pulzus))
        case "evad": return .room(RoomEntry(.evad))
        case "forma": return .room(RoomEntry(.forma))
        case "penz": return .room(RoomEntry(.penz))
        case "level": return .room(RoomEntry(.level))
        case "suly": return .room(RoomEntry(.suly))
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
