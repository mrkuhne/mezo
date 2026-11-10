import SwiftUI
import BoopCore
import BoopDesign

/// First run: profile → first weight → a short Boop hello, then the shell.
struct OnboardingFlow: View {
    let me: Me
    @Environment(Session.self) private var session
    @Environment(HealthLink.self) private var link: HealthLink?
    @State private var model: OnboardingModel?
    @State private var hello = HelloGate()

    var body: some View {
        #if DEBUG
        if let step = UserDefaults.standard.string(forKey: "previewStep") {
            let m = OnboardingModel(client: session.client) {}
            switch step {
            case "weight": WeightStep(model: m)
            case "hello": HelloStep()
            case "connect": if let link { ConnectFlow(link: link) {} } else { Text("no link") }
            default: ProfileStep(model: m, name: me.name)
            }
        } else { flow }
        #else
        flow
        #endif
    }

    private var flow: some View {
        Group {
            if let model {
                switch model.step {
                case .loading: ZStack { NKGround(hue: .forma); ProgressView().tint(.white) }.preferredColorScheme(.dark)
                case .failed:
                    NKSkyScreen(hue: .alvas, onBack: nil) {
                        VStack(spacing: 14) {
                            Spacer(minLength: 220)
                            StillOrb(palette: Hue.alvas.orb, size: 110, level: 0.3).saturation(0.3)
                            Text("Most nem érem el az adataidat.").nkFont(30, design: .serif).foregroundStyle(.white).multilineTextAlignment(.center).padding(.top, 10)
                            Text(onboardingText(model.problem ?? .server)).nkFont(15.5).foregroundStyle(.white.opacity(0.75)).multilineTextAlignment(.center)
                            NKPill("Újra próbálom") { Task { await model.start() } }.padding(.top, 14)
                        }
                    }
                case .profile: ProfileStep(model: model, name: me.name)
                case .weight: WeightStep(model: model)
                case .finishing:
                    if let link, hello.connecting || !link.connected, !hello.showing {
                        // `connected` flips after the permission step; `connecting` keeps the backfill on screen.
                        ConnectFlow(link: link) { hello.showing = true }.onAppear { hello.connecting = true }
                    } else {
                        HelloStep().onAppear { hello.showing = true }
                    }
                }
            } else {
                NKGround(hue: .forma)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: model?.step)
        .onChange(of: model?.problem) { _, p in if p == .unauthorized { session.signOut() } }
        .task {
            guard model == nil else { return }
            let m = OnboardingModel(client: session.client) { [session, hello] in
                while !hello.showing { try? await Task.sleep(for: .milliseconds(200)) }   // Health + calendar first
                try? await Task.sleep(for: .seconds(2.4))     // let the hello moment breathe
                await session.markOnboarded()
            }
            model = m
            await m.start()
        }
    }
}

/// Opens once the hello shows: after the connect flow, or straight away when already connected.
@MainActor @Observable private final class HelloGate { var connecting = false; var showing = false }

private struct HelloStep: View {
    @State private var motion = OrbMotion()
    var body: some View {
        NKSkyScreen(hue: .forma, onBack: nil) {
            VStack(spacing: 0) {
                LivingOrb(palette: Hue.forma.orb, size: 220, level: 0.85, glow: true, motion: motion).allowsHitTesting(false).padding(.top, 110)
                Text("MINDEN MEGVAN").nkFont(12, .medium, design: .monospaced).tracking(1.6).foregroundStyle(.white.opacity(0.75)).padding(.top, 34)
                Text("Szia, Boop vagyok").nkFont(42, design: .serif).foregroundStyle(.white).padding(.top, 8)
                Text("Innentől én viszem a reggeleidet.").nkFont(16).foregroundStyle(.white.opacity(0.85)).padding(.top, 6)
                Text("Holnap reggeltől én kezdem a napod: az alvásodból, a naptáradból és a tervedből mondom meg, mire figyelj. Ez a gömb vagyok én: minél jobb a napod, annál magasabbra kelek.")
                    .nkFont(18, design: .serif).lineSpacing(4).foregroundStyle(.white.opacity(0.8)).multilineTextAlignment(.center).padding(.top, 20)
                ProgressView().tint(.white).padding(.top, 28)
            }
        }
        .onDisappear { motion.stop() }
    }
}
