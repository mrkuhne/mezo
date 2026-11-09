import SwiftUI
import BoopCore
import BoopDesign

/// First run: profile → first weight → a short Boop hello, then the shell.
struct OnboardingFlow: View {
    let me: Me
    @Environment(Session.self) private var session
    @State private var model: OnboardingModel?

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
                case .finishing: HelloStep()
                }
            } else {
                Lagy.paper.ignoresSafeArea()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: model?.step)
        .onChange(of: model?.problem) { _, p in if p == .unauthorized { session.signOut() } }
        .task {
            guard model == nil else { return }
            let m = OnboardingModel(client: session.client) { [session] in
                try? await Task.sleep(for: .seconds(2.4))     // let the hello moment breathe
                await session.markOnboarded()
            }
            model = m
            await m.start()
        }
    }
}

private struct HelloStep: View {
    var body: some View {
        LagyFlowFrame(photoName: "reggelfeny.jpg", crumb: ("Első lépések › ", "Kész"), eyebrow: "Minden megvan", title: "Szia, Boop vagyok",
                      sub: "Innentől én viszem a reggeleidet.", showsBack: false) {
            BoopCard(pre: "Holnap reggeltől ", em: "én kezdem a napod", post: ": az alvásodból, a naptáradból és a tervedből mondom meg, mire figyelj.")
            ProgressView().tint(Lagy.deep).frame(maxWidth: .infinity).padding(.top, 24)
        }
    }
}
