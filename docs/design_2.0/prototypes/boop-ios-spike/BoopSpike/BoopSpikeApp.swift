import SwiftUI

@main
struct BoopSpikeApp: App {
    init() { Lagy.registerFonts() }
    var body: some Scene {
        WindowGroup {
            if UserDefaults.standard.bool(forKey: "elet") { EletRoot() }
            else if UserDefaults.standard.bool(forKey: "ritmus") { RitmusRoot() }
            else if UserDefaults.standard.bool(forKey: "gerinc") { GerincRoot() }
            else if UserDefaults.standard.string(forKey: "auraFrame") != nil { AuraFrameRoot() }
            else if UserDefaults.standard.bool(forKey: "aura") { AuraRoot() }
            else if UserDefaults.standard.bool(forKey: "legacy") { RootView() } else { LagyRoot() }
        }
    }
}

/// Throwaway spike: three takes on the morning screen, switched from the top.
struct RootView: View {
    @State private var variant = UserDefaults.standard.integer(forKey: "variant")
    var body: some View {
        ZStack(alignment: .top) {
            Group {
                switch variant {
                case 0: VariantOrb()
                case 1: VariantAiry()
                default: VariantGlass()
                }
            }
            .transition(.opacity)
            Picker("Változat", selection: $variant.animation(.easeInOut(duration: 0.35))) {
                Text("A · Orb").tag(0)
                Text("B · Levegős").tag(1)
                Text("C · Üveg").tag(2)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 20)
            .padding(.top, 4)
            .glassEffect(.regular, in: .capsule)
            .padding(.horizontal, 16)
        }
    }
}
