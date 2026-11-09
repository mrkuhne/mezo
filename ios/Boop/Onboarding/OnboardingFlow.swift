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
        Group {
            if let model {
                switch model.step {
                case .loading: ZStack { Lagy.paper.ignoresSafeArea(); ProgressView().tint(Lagy.deep) }
                case .failed:
                    ZStack {
                        Lagy.paper.ignoresSafeArea()
                        ErrorCard(title: "Most nem érem el az adataidat.", text: onboardingText(model.problem ?? .server)) {
                            Task { await model.start() }
                        }
                        .padding(.horizontal, 16)
                    }
                    .environment(\.colorScheme, .light)
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
                Lagy.paper.ignoresSafeArea()
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
    var body: some View {
        LagyFlowFrame(photoName: "reggelfeny.jpg", crumb: ("Első lépések › ", "Kész"), eyebrow: "Minden megvan", title: "Szia, Boop vagyok",
                      sub: "Innentől én viszem a reggeleidet.", showsBack: false) {
            BoopCard(pre: "Holnap reggeltől ", em: "én kezdem a napod", post: ": az alvásodból, a naptáradból és a tervedből mondom meg, mire figyelj.")
            ProgressView().tint(Lagy.deep).frame(maxWidth: .infinity).padding(.top, 24)
        }
    }
}
