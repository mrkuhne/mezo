#if DEBUG
import SwiftUI
import BoopDesign

// Review-only simulator spike for mezo-eiux9. Every number and exercise row below is invented.
// Launch with -previewSPE YES; -previewSPEView hammer|hip|press|player|logged opens a specific state.
// The approved implementation will use the catalogue/API; this fixture never writes a workout.
private enum SPEExample: String, CaseIterable, Identifiable {
    case hammer, hip, press
    var id: String { rawValue }
    var name: String {
        switch self {
        case .hammer: "Hammer Curl"
        case .hip: "Hip Thrust · rúd"
        case .press: "Overhead Press"
        }
    }
    var detail: String {
        switch self {
        case .hammer: "Kézisúlyzó · bicepsz"
        case .hip: "Rúd és pad · farizom"
        case .press: "Rúd · váll"
        }
    }
    var allowed: Set<String> {
        switch self {
        case .hammer: ["Myo set", "Pihenős drop", "Drop set"]
        case .hip: ["Fent megtartás · 2 mp"]
        case .press: []
        }
    }
}

struct SPEPreviewRoot: View {
    @State private var picker: SPEExample?
    @State private var choices: [SPEExample: String] = [:]
    @State private var showPlayer = ["player", "logged"].contains(UserDefaults.standard.string(forKey: "previewSPEView") ?? "")
    @State private var logged = UserDefaults.standard.string(forKey: "previewSPEView") == "logged"
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            NK.ground.ignoresSafeArea()
            RadialGradient(colors: [planHue.glow.opacity(0.18), .clear], center: .top,
                           startRadius: 0, endRadius: 360).ignoresSafeArea()
            if showPlayer { player } else { plan }
        }
        .preferredColorScheme(.dark)
        .sheet(item: $picker) { exercise in pickerSheet(exercise) }
        .onAppear {
            switch UserDefaults.standard.string(forKey: "previewSPEView") {
            case "hammer": picker = .hammer
            case "hip": picker = .hip
            case "press": picker = .press
            default: break
            }
        }
    }

    private var plan: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    Text("EDZÉS  /  BLOKK  /  NAPOK")
                        .nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(planHue.glow)
                    Spacer()
                    Image(systemName: "ellipsis").foregroundStyle(.white.opacity(0.6))
                }
                Text("A nap gyakorlatai").nkFont(31, design: .serif).foregroundStyle(.white)
                Text("A technika az utolsó munkasorozathoz tartozik. Válaszd ki, melyiket szeretnéd használni.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
                ForEach(SPEExample.allCases) { example in
                    exerciseCard(example)
                }
                Button {
                    withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { showPlayer = true }
                } label: {
                    HStack {
                        Text("Hip Thrust az edzésben").nkFont(15, .semibold)
                        Spacer()
                        Image(systemName: "arrow.right")
                    }
                    .foregroundStyle(NK.ground)
                    .padding(17)
                    .background(RoundedRectangle(cornerRadius: 18).fill(planHue.glow))
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }
            .padding(.horizontal, 22).padding(.top, 30).padding(.bottom, 38)
        }
        .scrollIndicators(.hidden)
    }

    private func exerciseCard(_ exercise: SPEExample) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(exercise.name).nkFont(22, design: .serif).foregroundStyle(.white)
                    Text(exercise.detail).nkFont(12).foregroundStyle(.white.opacity(0.52))
                }
                Spacer()
                Text("3 × 8–12").nkFont(11, .semibold, design: .monospaced)
                    .foregroundStyle(.white.opacity(0.65))
            }
            Rectangle().fill(.white.opacity(0.1)).frame(height: 1)
            Button { picker = exercise } label: {
                HStack(spacing: 8) {
                    Image(systemName: "sparkle").font(.system(size: 13))
                    Text(choices[exercise] ?? (exercise.allowed.isEmpty ? "Ehhez a gyakorlathoz nincs SPE" : "Technika választása"))
                        .nkFont(13, .medium)
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 10, weight: .semibold))
                }
                .foregroundStyle(exercise.allowed.isEmpty ? .white.opacity(0.55) : planHue.glow)
                .padding(.horizontal, 13).padding(.vertical, 11)
                .background(Capsule().fill(planHue.glow.opacity(exercise.allowed.isEmpty ? 0.06 : 0.12)))
            }
            .buttonStyle(.plain)
            .accessibilityHint("A választható és nem választható technikák megtekintése")
        }
        .padding(17)
        .background(RoundedRectangle(cornerRadius: 20).fill(.white.opacity(0.055)))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(.white.opacity(0.09), lineWidth: 1))
    }

    private func pickerSheet(_ exercise: SPEExample) -> some View {
        VStack(alignment: .leading, spacing: 15) {
            Text("TECHNIKA · AZ UTOLSÓ SOROZATON")
                .nkFont(10, .semibold, design: .monospaced).tracking(1.2).foregroundStyle(planHue.glow)
            Text(exercise.name).nkFont(25, design: .serif).foregroundStyle(.white)
            Text("Csak az ehhez a mozdulathoz illő módszerek választhatók.")
                .nkFont(13).foregroundStyle(.white.opacity(0.6))
            ScrollView {
                VStack(spacing: 8) {
                    pickerRow("Sima sorozatok", example: exercise)
                    ForEach(["Myo set", "Pihenős drop", "Drop set", "Rest-pause", "Nyújtott részismétlés", "Fent megtartás · 2 mp"], id: \.self) { name in
                        pickerRow(name, example: exercise)
                    }
                }
                .padding(.top, 7)
            }
            .scrollIndicators(.hidden)
        }
        .padding(.horizontal, 22).padding(.top, 26).padding(.bottom, 12)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(NK.ground.opacity(0.97))
    }

    private func pickerRow(_ name: String, example: SPEExample) -> some View {
        let allowed = name == "Sima sorozatok" || example.allowed.contains(name)
        let selected = choices[example] == name || (name == "Sima sorozatok" && choices[example] == nil)
        return Button {
            guard allowed else { return }
            choices[example] = name == "Sima sorozatok" ? nil : name
            picker = nil
        } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: name == "Sima sorozatok" ? "circle.grid.2x2" : "sparkle")
                    .font(.system(size: 17))
                    .foregroundStyle(selected ? NK.ground : (allowed ? planHue.glow : .white.opacity(0.3)))
                    .frame(width: 36, height: 36)
                    .background(RoundedRectangle(cornerRadius: 11).fill(selected ? .white : planHue.glow.opacity(allowed ? 0.14 : 0.04)))
                VStack(alignment: .leading, spacing: 4) {
                    Text(name).nkFont(16, .semibold).foregroundStyle(.white.opacity(allowed ? 0.95 : 0.58))
                    if !allowed {
                        Text(unavailableReason(name, example: example))
                            .nkFont(12).foregroundStyle(.white.opacity(0.58))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 4)
                if selected { Image(systemName: "checkmark").foregroundStyle(planGood) }
            }
            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18).fill(.white.opacity(selected ? 0.1 : 0.05)))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(selected ? planGood.opacity(0.5) : .white.opacity(0.06), lineWidth: 1))
        }
        .buttonStyle(.plain).disabled(!allowed)
        .accessibilityHint(allowed ? "Kiválasztás" : "Ehhez a gyakorlathoz nem választható")
    }

    private func unavailableReason(_ name: String, example: SPEExample) -> String {
        switch name {
        case "Rest-pause": "Ez a módszer 20 ismétlést kíván; ehhez a sorozathoz nem illik."
        case "Nyújtott részismétlés": "Ehhez nyújtott helyzetben terhelő mozdulat kell."
        default: example == .press
            ? "A nehéz vállnyomáshoz most nem választunk SPE-t."
            : "Ehhez a mozdulathoz más technikát engedünk."
        }
    }

    private var player: some View {
        VStack(spacing: 0) {
            HStack {
                Button { withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { showPlayer = false } } label: {
                    Image(systemName: "chevron.left").frame(width: 40, height: 40)
                        .background(Circle().fill(.white.opacity(0.13)))
                }
                .accessibilityLabel("Vissza a tervhez")
                Spacer()
                Text("EDZÉS KÖZBEN").nkFont(10, .semibold, design: .monospaced).tracking(1.3)
                    .foregroundStyle(.white.opacity(0.65))
                Spacer()
                Image(systemName: "ellipsis").frame(width: 40, height: 40)
            }
            .foregroundStyle(.white).padding(.horizontal, 20).padding(.top, 16)
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Text("Hip Thrust").nkFont(34, design: .serif).foregroundStyle(.white)
                    Text(logged ? "3. sorozat kész" : "3. sorozat · utolsó munkasorozat")
                        .nkFont(12, .semibold, design: .monospaced).tracking(0.5).foregroundStyle(planHue.glow)
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 8) {
                            Image(systemName: "pause.circle.fill").foregroundStyle(planHue.glow)
                            Text("Fent megtartás · 2 mp").nkFont(16, .semibold).foregroundStyle(.white)
                        }
                        Text("Minden ismétlés tetején tartsd meg 2 másodpercig.")
                            .nkFont(14).foregroundStyle(.white.opacity(0.78))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(17).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 20).fill(planHue.glow.opacity(0.13)))
                    .overlay(RoundedRectangle(cornerRadius: 20).stroke(planHue.glow.opacity(0.32), lineWidth: 1))
                    HStack(alignment: .firstTextBaseline, spacing: 0) {
                        playerNumber("SÚLY", value: "80", unit: "kg")
                        playerNumber("ISMÉTLÉS", value: "10", unit: "db")
                        playerNumber("TARTALÉK", value: "2", unit: "RIR")
                    }
                    .padding(.vertical, 20)
                    .background(RoundedRectangle(cornerRadius: 20).fill(.white.opacity(0.06)))
                    VStack(alignment: .leading, spacing: 12) {
                        Text("SOROZATOK").nkFont(10, .semibold, design: .monospaced).tracking(1.2)
                            .foregroundStyle(.white.opacity(0.55))
                        setRow("1", text: "80 kg × 10", badge: "Kész")
                        setRow("2", text: "80 kg × 10", badge: "Kész")
                        setRow("3", text: logged ? "80 kg × 10 · fent 2 mp" : "Következik", badge: logged ? "Kész" : "Most")
                    }
                    .padding(18).background(RoundedRectangle(cornerRadius: 20).fill(.white.opacity(0.05)))
                    Button { withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { logged.toggle() } } label: {
                        Text(logged ? "Sorozat újbóli megtekintése" : "Sorozat kész")
                            .nkFont(16, .semibold).foregroundStyle(NK.ground)
                            .frame(maxWidth: .infinity).padding(17)
                            .background(RoundedRectangle(cornerRadius: 18).fill(planHue.glow))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 22).padding(.top, 28).padding(.bottom, 35)
            }
            .scrollIndicators(.hidden)
        }
    }

    private func playerNumber(_ title: String, value: String, unit: String) -> some View {
        VStack(spacing: 6) {
            Text(title).nkFont(9, .semibold, design: .monospaced).tracking(0.5).foregroundStyle(.white.opacity(0.5))
            Text(value).nkFont(31, .medium).foregroundStyle(.white)
            Text(unit).nkFont(11).foregroundStyle(.white.opacity(0.55))
        }
        .frame(maxWidth: .infinity)
    }

    private func setRow(_ number: String, text: String, badge: String) -> some View {
        HStack {
            Text(number).nkFont(12, .semibold, design: .monospaced).foregroundStyle(planHue.glow).frame(width: 22)
            Text(text).nkFont(14).foregroundStyle(.white)
            Spacer()
            Text(badge).nkFont(11, .semibold).foregroundStyle(badge == "Kész" ? planGood : planHue.glow)
        }
        .padding(.vertical, 6)
    }
}
#endif
