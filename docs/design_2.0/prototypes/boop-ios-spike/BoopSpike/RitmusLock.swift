import SwiftUI

// Throwaway spike (mezo-r36n9.13): check-in from outside the app — a MOCK of the lock screen (Boop's notification:
// tap = straight into question 1, no extra screen) and of a home-screen widget that answers in place (one tap per
// question, the widget redraws to the next one). Real push + widgets need the paid developer team: designed now,
// switched on later. Not the real iOS chrome — a stand-in for the owner to judge the flow.

struct RitmusLock: View {
    var day: RitmusDay
    var onOpenCheckin: () -> Void
    var onOpenEste: () -> Void
    var onClose: () -> Void
    @State private var mode = RArg.open == "widget" ? 1 : 0
    @State private var wIdx = 0
    @State private var wVals: [Int] = []
    private let wQs = [("ENERGIA", "Mennyi energia van benned most?"), ("FEJTISZTASÁG", "Mennyire tiszta a fejed?"), ("MOTIVÁCIÓ", "Kedv a röpihez?")]

    var body: some View {
        ZStack {
            PaintedLandscape(sky: PaintedLandscape.skies[mode == 0 ? 4 : 2]).ignoresSafeArea()
                .overlay(Color.black.opacity(0.25).ignoresSafeArea())
            VStack(spacing: 0) {
                HStack {
                    Button(action: onClose) {
                        Image(systemName: "chevron.left").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                            .frame(width: 40, height: 40).glassEffect(.clear, in: .circle)
                    }.buttonStyle(.plain)
                    Spacer()
                    HStack(spacing: 4) {
                        seg("Zárolt képernyő", 0); seg("Widget", 1)
                    }
                    .padding(4).glassEffect(.clear, in: .capsule)
                    Spacer()
                    Color.clear.frame(width: 40)
                }
                .padding(.horizontal, 16).padding(.top, 6)
                Text("MINTA · CSAK A FIZETŐS FEJLESZTŐI FIÓK UTÁN ÉLES")
                    .font(AuraFont.mono(10.5, .semibold)).tracking(1.2).foregroundStyle(.white.opacity(0.7)).padding(.top, 10)
                if mode == 0 { lock } else { widgetScreen }
                Spacer()
            }
        }
        .preferredColorScheme(.dark)
    }

    private func seg(_ t: String, _ k: Int) -> some View {
        Text(t).font(.system(size: 13, weight: .semibold)).foregroundStyle(mode == k ? gBase : .white)
            .padding(.horizontal, 12).frame(height: 30)
            .background(Capsule().fill(mode == k ? .white : .clear))
            .onTapGesture { withAnimation(.easeInOut(duration: 0.3)) { mode = k } }
    }

    // MARK: lock screen with two notifications

    private var lock: some View {
        VStack(spacing: 0) {
            Text("kedd, november 11.").font(.system(size: 19, weight: .semibold)).foregroundStyle(.white.opacity(0.9)).padding(.top, 34)
            Text("16:00").font(.system(size: 92, weight: .semibold, design: .rounded)).foregroundStyle(.white.opacity(0.95))
            VStack(spacing: 10) {
                notif(time: "most", title: "Délutáni kitöltés", body: "Mennyi energia van benned most? · 3 kérdés, 3 koppintás", action: onOpenCheckin)
                notif(time: "21:30", title: "Zárjuk le a napot", body: "Egy perc: hogy vagy, sikerült-e a prezentáció, milyen volt a nap.", action: onOpenEste, dim: true)
            }
            .padding(.horizontal, 12).padding(.top, 150)
            Text("Koppints az értesítésre: rögtön az első kérdés nyílik.").font(.system(size: 13)).foregroundStyle(.white.opacity(0.75)).padding(.top, 14)
        }
    }

    private func notif(time: String, title: String, body: String, action: @escaping () -> Void, dim: Bool = false) -> some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9, style: .continuous).fill(gBase)
                    StillOrb(colors: SunMetric.all[0].orb, size: 24, level: 0.8)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text("Boop").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                        Spacer()
                        Text(time).font(.system(size: 13)).foregroundStyle(.white.opacity(0.6))
                    }
                    Text(title).font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                    Text(body).font(.system(size: 15)).foregroundStyle(.white.opacity(0.85)).multilineTextAlignment(.leading)
                }
            }
            .padding(14)
            .glassEffect(.regular, in: .rect(cornerRadius: 24))
            .opacity(dim ? 0.8 : 1)
        }
        .buttonStyle(.plain)
    }

    // MARK: home-screen widget that answers in place

    private var widgetScreen: some View {
        VStack(spacing: 22) {
            Spacer().frame(height: 60)
            widget
            Text(wIdx < wQs.count ? "Egy koppintás = egy válasz. Az app meg sem nyílik." : "Elmentve — a pötty már ott van az energiagörbén.")
                .font(.system(size: 13)).foregroundStyle(.white.opacity(0.8)).multilineTextAlignment(.center).padding(.horizontal, 30)
            if wIdx >= wQs.count {
                Button("Újra") { withAnimation { wIdx = 0; wVals = [] } }.font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
            }
        }
    }

    private var widget: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                StillOrb(colors: SunMetric.all[0].orb, size: 20, level: 0.8)
                Text(wIdx < wQs.count ? wQs[wIdx].0 : "KÉSZ").font(AuraFont.mono(11, .semibold)).tracking(1.2).foregroundStyle(.white.opacity(0.75))
                Spacer()
                if wIdx < wQs.count { Text("\(wIdx + 1)/3").font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.55)) }
            }
            if wIdx < wQs.count {
                Text(wQs[wIdx].1).font(AuraFont.serif(19)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.8)
                    .id(wIdx).transition(.opacity)
                VStack(spacing: 8) {
                    ForEach(0..<2, id: \.self) { r in
                        HStack(spacing: 8) {
                            ForEach(1...5, id: \.self) { c in
                                let k = r * 5 + c
                                Text("\(k)").font(.custom("Outfit", size: 16).weight(.medium)).foregroundStyle(.white)
                                    .frame(maxWidth: .infinity).frame(height: 34)
                                    .background(Capsule().fill(.white.opacity(0.06 + Double(k) * 0.018)))
                                    .onTapGesture { withAnimation(.easeInOut(duration: 0.3)) { wVals.append(k); wIdx += 1 } }
                            }
                        }
                    }
                }
            } else {
                HStack(spacing: 18) {
                    ForEach(Array(zip(wQs, wVals)), id: \.0.0) { q, v in
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(v)").font(.custom("Outfit", size: 28).weight(.light)).foregroundStyle(.white)
                            Text(q.0.capitalized).font(.system(size: 11)).foregroundStyle(.white.opacity(0.6))
                        }
                    }
                    Spacer()
                }
                Text("16:02 · 3 koppintás").font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.55))
            }
        }
        .padding(16)
        .frame(width: 338, height: 170, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(gBase.opacity(0.88)))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(.white.opacity(0.12)))
    }
}
