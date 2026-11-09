import SwiftUI

/// First launch: welcome → sign in / invite → first steps (profile) → permissions → 60-day backfill.
struct OnboardingFlow: View {
    var onFinish: () -> Void
    @State private var step = UserDefaults.standard.integer(forKey: "obStep")
    @State private var motion = OrbMotion()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            LinearGradient(colors: [Mood.good.sky, Boop.night, Boop.night], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
            Group {
                switch step {
                case 0: welcome
                case 1: AuthStep { go(2) }
                case 2: ProfileStep { go(3) }
                case 3: PermissionsStep { go(4) }
                default: BackfillStep(motion: motion) { onFinish(); dismiss() }
                }
            }
            .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity),
                                    removal: .move(edge: .leading).combined(with: .opacity)))
            VStack {
                HStack(spacing: 6) {
                    ForEach(0..<5) { i in
                        Capsule().fill(.white.opacity(i <= step ? 0.85 : 0.15)).frame(width: i == step ? 22 : 8, height: 6)
                    }
                }
                .animation(.spring, value: step)
                .padding(.top, 8)
                Spacer()
            }
        }
        .preferredColorScheme(.dark)
    }

    private func go(_ s: Int) { withAnimation(.spring(response: 0.55, dampingFraction: 0.88)) { step = s } }

    private var welcome: some View {
        VStack(spacing: 26) {
            Spacer()
            LivingOrb(mood: .good, size: 230, motion: motion)
            VStack(spacing: 12) {
                Text("Szia, én vagyok a Boop.")
                    .font(.system(size: 32, weight: .semibold, design: .serif)).foregroundStyle(.white)
                Text("Minden reggel elmondom, hogyan aludtál, mire számíthatsz, és hogyan fuss neki a napnak a terveid szerint.")
                    .font(.system(.body, design: .serif)).foregroundStyle(.white.opacity(0.7))
                    .multilineTextAlignment(.center).padding(.horizontal, 30)
            }
            Spacer()
            PrimaryButton(title: "Kezdjük") { go(1) }.padding(.horizontal, 24).padding(.bottom, 30)
        }
    }
}

private struct AuthStep: View {
    var next: () -> Void
    @State private var invite = true
    @State private var code = ""
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text(invite ? "Regisztráció" : "Bejelentkezés")
                    .font(.system(size: 32, weight: .semibold, design: .serif)).foregroundStyle(.white)
                    .padding(.top, 64)
                Picker("", selection: $invite.animation()) {
                    Text("Meghívóm van").tag(true)
                    Text("Már van fiókom").tag(false)
                }
                .pickerStyle(.segmented)
                VStack(spacing: 12) {
                    if invite {
                        field("Meghívó kód", "MEZO-XXXX-XXXX", $code, icon: "ticket")
                        field("Név", "Hogyan szólítsalak?", $name, icon: "person")
                    }
                    field("E-mail", "nev@pelda.hu", $email, icon: "envelope")
                    SecureField("", text: $password, prompt: Text(invite ? "Jelszó (min. 8 karakter)" : "Jelszó").foregroundStyle(.white.opacity(0.35)))
                        .modifier(FieldStyle(icon: "lock"))
                }
                Text(invite
                     ? "A meghívó kódot a webes Mezóban, a Beállításokban hozod létre."
                     : "Ugyanaz a fiók, mint a webes Mezóban.")
                    .font(.footnote).foregroundStyle(.white.opacity(0.45))
                PrimaryButton(title: invite ? "Fiók létrehozása" : "Belépés", action: next)
                    .padding(.top, 8)
            }
            .padding(.horizontal, 24)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func field(_ label: String, _ prompt: String, _ text: Binding<String>, icon: String) -> some View {
        TextField(label, text: text, prompt: Text(prompt).foregroundStyle(.white.opacity(0.35)))
            .modifier(FieldStyle(icon: icon))
    }
}

private struct FieldStyle: ViewModifier {
    var icon: String
    func body(content: Content) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundStyle(.white.opacity(0.5)).frame(width: 20)
            content.foregroundStyle(.white).textInputAutocapitalization(.never).autocorrectionDisabled()
        }
        .padding(.horizontal, 16).padding(.vertical, 15)
        .background(RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.07)))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.08)))
    }
}

private struct ProfileStep: View {
    var next: () -> Void
    @State private var sex = 0
    @State private var birth = Calendar.current.date(from: DateComponents(year: 1991, month: 4, day: 12))!
    @State private var height = 182
    @State private var weight = 82.6

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Első lépések").font(.system(size: 32, weight: .semibold, design: .serif)).foregroundStyle(.white)
                    Text("Ebből számolom ki a kiindulási kalóriádat. A terveidet a webes Mezóban állítod be ugyanezzel a fiókkal.")
                        .font(.system(.callout, design: .serif)).foregroundStyle(.white.opacity(0.6))
                }
                .padding(.top, 64)
                Card {
                    VStack(spacing: 18) {
                        Picker("Nem", selection: $sex) { Text("Férfi").tag(0); Text("Nő").tag(1) }
                            .pickerStyle(.segmented)
                        DatePicker("Születési dátum", selection: $birth, displayedComponents: .date)
                        Stepper(value: $height, in: 140...210) {
                            HStack { Text("Magasság"); Spacer(); Text("\(height) cm").monospacedDigit().foregroundStyle(.white.opacity(0.7)) }
                        }
                        Stepper(value: $weight, in: 40...200, step: 0.1) {
                            HStack { Text("Mai súly"); Spacer(); Text("\(hu1(weight)) kg").monospacedDigit().foregroundStyle(.white.opacity(0.7)) }
                        }
                    }
                    .foregroundStyle(.white)
                    .tint(Boop.indigo)
                }
                PrimaryButton(title: "Tovább", action: next)
            }
            .padding(.horizontal, 24)
        }
    }
}

private struct PermissionsStep: View {
    var next: () -> Void
    @State private var granted: Set<Int> = []
    private let items: [(String, String, String, Color)] = [
        ("heart.fill", "Apple Egészség", "Alvás fázisokkal (Sleep Cycle), pulzus, nyugalmi pulzus, lépés, edzések (Huawei). Csak olvasom, semmit nem írok bele.", Boop.peach),
        ("calendar", "Naptár", "Látom a Google Naptáradat, így tudom, mikor fér bele az edzés és az ebéd. A naptáradba nem írok.", Boop.sky),
        ("gyroscope", "Mozgás", "Hogy az orbom meglöttyenjen, ha megdöntöd a telefont. Ennyi.", Boop.mint),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Három engedély").font(.system(size: 32, weight: .semibold, design: .serif)).foregroundStyle(.white)
                    Text("Ezekből dolgozom, hogy ne kelljen mindent kézzel beírnod.")
                        .font(.system(.callout, design: .serif)).foregroundStyle(.white.opacity(0.6))
                }
                .padding(.top, 64)
                ForEach(items.indices, id: \.self) { i in
                    let it = items[i]
                    Card {
                        HStack(alignment: .top, spacing: 14) {
                            Image(systemName: it.0).font(.title3).foregroundStyle(it.3)
                                .frame(width: 44, height: 44).background(Circle().fill(it.3.opacity(0.15)))
                            VStack(alignment: .leading, spacing: 6) {
                                Text(it.1).font(.headline).foregroundStyle(.white)
                                Text(it.2).font(.subheadline).foregroundStyle(.white.opacity(0.6))
                                Button {
                                    withAnimation(.spring) { _ = granted.insert(i) }
                                } label: {
                                    Label(granted.contains(i) ? "Engedélyezve" : "Engedélyezem",
                                          systemImage: granted.contains(i) ? "checkmark.circle.fill" : "hand.raised")
                                        .font(.subheadline.weight(.semibold))
                                }
                                .buttonStyle(.glass)
                                .tint(granted.contains(i) ? Boop.mint : .white)
                                .disabled(granted.contains(i))
                                .padding(.top, 4)
                            }
                        }
                    }
                    .sensoryFeedback(.success, trigger: granted.contains(i))
                }
                PrimaryButton(title: granted.count == 3 ? "Tovább" : "Később is megadhatom", action: next)
                    .padding(.top, 6)
            }
            .padding(.horizontal, 24)
        }
    }
}

private struct BackfillStep: View {
    var motion: OrbMotion
    var finish: () -> Void
    @State private var day = 0
    @State private var started = Date()

    var body: some View {
        VStack(spacing: 26) {
            Spacer()
            ZStack {
                ProgressOrb(level: Double(day) / 60, size: 220)
                VStack(spacing: 0) {
                    Text("\(day)").font(.system(size: 64, weight: .semibold, design: .rounded))
                        .contentTransition(.numericText(value: Double(day)))
                    Text("/ 60 NAP").font(.caption.weight(.semibold)).tracking(2).opacity(0.8)
                }
                .foregroundStyle(.white).shadow(color: .black.opacity(0.35), radius: 8)
            }
            VStack(spacing: 10) {
                Text(day < 60 ? "Megismerlek…" : "Megvagy.")
                    .font(.system(size: 30, weight: .semibold, design: .serif)).foregroundStyle(.white)
                Text(day < 60 ? "Beolvasom az elmúlt 60 napod az Apple Egészségből, hogy legyen mihez mérnem a reggeleidet."
                              : "60 nap beolvasva. Holnap reggeltől már a te alapvonaladhoz mérem az éjszakáidat.")
                    .font(.system(.body, design: .serif)).foregroundStyle(.white.opacity(0.7))
                    .multilineTextAlignment(.center).padding(.horizontal, 30)
            }
            HStack(spacing: 12) {
                counter("\(Int(Double(day) / 60 * 57))", "éjszaka")
                counter("\(Int(Double(day) / 60 * 9_412).formatted())", "pulzusmérés")
                counter("\(Int(Double(day) / 60 * 41))", "edzés")
            }
            .padding(.horizontal, 24)
            Spacer()
            PrimaryButton(title: "Irány a reggelem", icon: "sun.horizon.fill", action: finish)
                .opacity(day >= 60 ? 1 : 0.3).disabled(day < 60)
                .padding(.horizontal, 24).padding(.bottom, 30)
        }
        .task {
            while day < 60 {
                try? await Task.sleep(for: .milliseconds(70))
                withAnimation(.easeOut(duration: 0.1)) { day += 1 }
            }
        }
        .sensoryFeedback(.success, trigger: day >= 60)
    }

    private func counter(_ v: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(v).font(.system(.title3, design: .rounded).weight(.semibold)).monospacedDigit()
                .contentTransition(.numericText())
            Text(label).font(.caption).foregroundStyle(.white.opacity(0.5))
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity).padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 18).fill(.white.opacity(0.06)))
    }
}

/// The orb shader with an externally driven level (backfill progress, scores).
struct ProgressOrb: View {
    var level: Double
    var size: CGFloat
    var mood: Mood = .good
    @State private var start = Date()
    var body: some View {
        TimelineView(.animation) { tl in
            let e = tl.date.timeIntervalSince(start)
            let c = mood.colors
            Rectangle()
                .frame(width: size, height: size)
                .colorEffect(ShaderLibrary.orb(
                    .float2(size, size), .float(Float(e)),
                    .color(c[0]), .color(c[1]), .color(c[2]), .color(c[3]),
                    .float(Float(level)), .float(0), .float(0), .float(9), .float(0)))
        }
        .frame(width: size, height: size)
        .animation(.easeOut(duration: 0.3), value: level)
    }
}
