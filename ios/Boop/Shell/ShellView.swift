import SwiftUI
import BoopCore
import BoopDesign

/// The four places of the spine, in bar order: Ma · Terv · Napló · Boop.
enum ShellTab: Int, CaseIterable {
    case ma, terv, naplo, boop

    var storageKey: String { ["ma", "terv", "naplo", "boop"][rawValue] }
    init?(key: String) { guard let t = Self.allCases.first(where: { $0.storageKey == key }) else { return nil }; self = t }
    /// What the scene storage held: the new keys map to themselves, anything else (the old domain names) lands on Ma.
    static func restored(_ raw: String) -> ShellTab { ShellTab(key: raw) ?? .ma }
    /// The colour world the place paints until its page reports another.
    var defaultHue: Hue { [.forma, .fuel, .alvas, .forma][rawValue] }
}

/// Tells the shell that a page has a room (a domain drill-down) open over it: the bar steps aside until it closes.
private struct SetRoomOpenKey: EnvironmentKey { static let defaultValue: @MainActor @Sendable (Bool) -> Void = { _ in } }
extension EnvironmentValues {
    var setRoomOpen: @MainActor @Sendable (Bool) -> Void {
        get { self[SetRoomOpenKey.self] }
        set { self[SetRoomOpenKey.self] = newValue }
    }
}

/// One sky per place in bar order: what the page last reported, else its default colour world.
func shellPanels(_ skies: [ShellTab: NKBackdrop]) -> [NKBackdrop] {
    ShellTab.allCases.map { skies[$0] ?? NKBackdrop(hue: $0.defaultHue, heroHeight: 560, scrollY: 0) }
}

/// The four places in the floating bar, the "+" beside it, and one painted landscape behind them all: switching
/// slides it toward the tapped place while the skies blend, the page cross-fades over it, and the bar's capsule
/// glides to the new icon. The capture and account sheets are presented here, at page level.
struct ShellView: View {
    let me: Me
    @SceneStorage("tab") private var tabKey = "ma"
    /// The switch in flight: the place we came from, which side the new one sits on, and how far along (0 → 1).
    @State private var fromTab = ShellTab.ma
    @State private var direction: CGFloat = 1
    @State private var progress: Double = 1
    /// Last sky each place asked for (Ma re-colours with its orbs); unseen places use their default.
    @State private var skies: [ShellTab: NKBackdrop] = [:]
    @State private var capturing = false
    @State private var account = false
    /// The full-screen check-in (B3); Ma's rows, "+" and the notifications open it (Tasks 9, 14).
    @State private var checkingIn = false
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    @State private var toast: String?
    /// A room is open over the page: the bar is hidden.
    @State private var roomOpen = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var tab: ShellTab { ShellTab.restored(tabKey) }

    var body: some View {
        ZStack(alignment: .bottom) {
            NKBackdropPanorama(from: sky(fromTab), to: sky(tab), direction: direction, progress: progress,
                               travel: reduceMotion ? 0 : 0.5)
            ZStack {
                page(tab)
                    .id(tab)
                    .onPreferenceChange(NKBackdropKey.self) { [tab] sky in if let sky { skies[tab] = sky } }
                    // The old page leaves quickly and the new one arrives just after, so text never doubles up.
                    .transition(.asymmetric(insertion: .opacity.animation(.easeOut(duration: 0.5).delay(0.3)),
                                            removal: .opacity.animation(.easeIn(duration: 0.22))))
            }
            .environment(\.nkBackdropHosted, true)
            .environment(\.setRoomOpen, { open in withAnimation(.smooth(duration: 0.35)) { roomOpen = open } })
            NKSpineBar(selected: Binding(get: { tab.rawValue }, set: { select(ShellTab(rawValue: $0) ?? .ma) }),
                       onPlus: { capturing = true })
                .offset(y: roomOpen ? 140 : 0)
                .opacity(roomOpen ? 0 : 1)
                .allowsHitTesting(!roomOpen)
                .accessibilityHidden(roomOpen)
        }
        .environment(\.openAccount, { account = true })
        .nkToast($toast)
        .preferredColorScheme(.dark)
        // page-level presentations (boop-ios.md §9)
        .sheet(isPresented: $capturing) {
            CaptureSheet { name in capturing = false; toast = soonToast(name) }
                .presentationDetents([.height(560), .large])
                .presentationBackground(NK.ground)
                .presentationCornerRadius(34)
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $account) {
            AccountSheet(me: me)
                .presentationDetents([.medium, .large])
                .presentationBackground(NK.ground)
                .presentationCornerRadius(34)
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $checkingIn) {
            if let ritmus {
                CheckinView(env: ritmus) { checkingIn = false }
            } else {
                // No daily loop yet (signing in or out): never an empty cover, always a way back.
                ZStack(alignment: .topLeading) {
                    NKGround(hue: .mozgas)
                    Button { checkingIn = false } label: {
                        Image(systemName: "chevron.down").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                            .frame(width: 44, height: 44).glassEffect(.clear, in: .circle)
                    }
                    .buttonStyle(.plain).accessibilityLabel("Bezárom")
                    .padding(.leading, 16).padding(.top, 8)
                }
                .preferredColorScheme(.dark)
            }
        }
        .onAppear {
            fromTab = tab
            #if DEBUG
            // Simulator review: `-previewTab ma|terv|naplo|boop` opens that place, `-previewOpen capture|account` a sheet,
            // `-previewOpen checkin|checkinDone` the check-in (its first item / its payoff).
            if let t = UserDefaults.standard.string(forKey: "previewTab").flatMap(ShellTab.init(key:)) { tabKey = t.storageKey; fromTab = t }
            switch UserDefaults.standard.string(forKey: "previewOpen") {
            case "capture": capturing = true
            case "account": account = true
            case "checkin", "checkinDone": checkingIn = true
            default: break
            }
            #endif
        }
        #if DEBUG
        // `-previewScroll 900` opens the pages scrolled; `-previewSwitch terv|naplo|boop` switches to that place
        // after 3 s and back to Ma 3 s later (records the backdrop slide + blend without taps).
        .environment(\.nkInitialScrollY, UserDefaults.standard.object(forKey: "previewScroll") == nil
                     ? nil : CGFloat(UserDefaults.standard.double(forKey: "previewScroll")))
        .task {
            guard let to = UserDefaults.standard.string(forKey: "previewSwitch").flatMap(ShellTab.init(key:)) else { return }
            try? await Task.sleep(for: .seconds(3)); select(to)
            try? await Task.sleep(for: .seconds(3)); select(.ma)
        }
        #endif
    }

    @ViewBuilder private func page(_ tab: ShellTab) -> some View {
        switch tab {
        case .ma: NapView()
        case .terv: TervView()
        case .naplo: NaploView()
        case .boop: BoopTabView()
        }
    }

    private func sky(_ tab: ShellTab) -> NKBackdrop { shellPanels(skies)[tab.rawValue] }

    /// The old land starts from where it is now (no jump), then the blend runs to the new one.
    private func select(_ new: ShellTab) {
        guard new != tab else { return }
        var still = Transaction(); still.disablesAnimations = true
        withTransaction(still) {
            fromTab = tab
            direction = new.rawValue >= tab.rawValue ? 1 : -1
            progress = 0
        }
        DispatchQueue.main.async {
            withAnimation(.smooth(duration: 0.95)) {
                tabKey = new.storageKey
                progress = 1
            }
        }
    }
}

/// "hétfő, 06:50" from the device clock, Hungarian.
func hungarianNow(_ date: Date = Date()) -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "hu_HU")
    f.dateFormat = "EEEE, HH:mm"
    return f.string(from: date)
}

/// Time-of-day greeting: reggel 5–10, napközben 10–18, este 18–5.
func greeting(_ date: Date = Date(), calendar: Calendar = .current) -> String {
    switch calendar.component(.hour, from: date) {
    case 5..<10: "Jó reggelt"
    case 10..<18: "Szép napot"
    default: "Jó estét"
    }
}
