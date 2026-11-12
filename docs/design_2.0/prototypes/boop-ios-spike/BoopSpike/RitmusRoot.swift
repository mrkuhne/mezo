import SwiftUI

// Throwaway spike (mezo-r36n9.13, B3 Napi ritmus): B2's spine (GerincTabBar, proposal cards, "+", drill-down)
// with the daily loop wired in. Ma = RitmusMa; Boop tab = RitmusChat; the check-in and the evening close are
// full-screen covers so a notification can open them directly. A debug "Kívülről" door on the "+" sheet opens the
// lock-screen / widget mock.

struct RitmusRoot: View {
    @State private var day = RitmusDay()
    @State private var tab = GArg.int("ritmusTab", 0, 3)
    @State private var phase = DayPhase(rawValue: GArg.int("ritmusPhase", 0, 2, 1)) ?? .napkozben
    @State private var maPath: [Int] = []
    @State private var decided: [String: Bool] = [:]
    @State private var why: Proposal? = nil
    @State private var plus = false
    @State private var checkin = ["checkin", "checkinDone"].contains(RArg.open ?? "")
    @State private var este = ["este", "esteDone"].contains(RArg.open ?? "")
    @State private var lock = ["lock", "widget"].contains(RArg.open ?? "")
    @State private var toast: String?

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch tab {
                case 1: GerincPlaceholder(kind: 1)
                case 2: GerincPlaceholder(kind: 2)
                case 3: RitmusChat(day: day)
                default:
                    RitmusMa(phase: $phase, path: $maPath, decided: $decided, onWhy: { why = $0 }, onToast: show,
                             day: day, onCheckin: { checkin = true }, onEste: { este = true })
                }
            }
            .transition(.opacity)
            if maPath.isEmpty || tab != 0 {
                GerincTabBar(tab: $tab, onPlus: { plus = true }).padding(.bottom, 4)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.85), value: maPath.isEmpty)
        .ignoresSafeArea(.keyboard)
        .preferredColorScheme(.dark)
        .overlay(alignment: .top) {
            if let t = toast {
                HStack(spacing: 8) {
                    AuraGlyph("check-ink", .white, size: 15)
                    Text(t).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                }
                .padding(.horizontal, 16).frame(height: 42)
                .glassEffect(.regular, in: .capsule).padding(.top, 6)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .overlay(alignment: .bottomLeading) {
            // spike-only: flip the network to see the offline path
            Button { day.offline.toggle(); show(day.offline ? "Nincs net (próba)" : "Van net") } label: {
                ROfflineGlyph(color: .white.opacity(day.offline ? 1 : 0.45), size: 16).frame(width: 34, height: 34)
            }
            .buttonStyle(.plain).glassEffect(.clear, in: .circle).padding(.leading, 22).padding(.bottom, 92)
            .opacity(tab == 0 && maPath.isEmpty ? 1 : 0)
        }
        .sheet(isPresented: $plus) {
            RitmusPlus(onPick: { k in
                plus = false
                switch k {
                case "checkin": checkin = true
                case "este": este = true
                case "lock": lock = true
                default: show(k)
                }
            })
            .presentationDetents([.height(520)])
            .presentationBackground(gBase).presentationCornerRadius(34).presentationDragIndicator(.visible)
        }
        .sheet(item: $why) { p in
            GerincWhySheet(p: p, decided: decided[p.id]) { ok in decided[p.id] = ok; why = nil }
                .presentationDetents([.large]).presentationBackground(gBase).presentationCornerRadius(34)
        }
        .fullScreenCover(isPresented: $checkin) {
            RitmusCheckin(day: day, onClose: { checkin = false })
        }
        .fullScreenCover(isPresented: $este) {
            RitmusEste(day: day, onClose: { este = false })
        }
        .fullScreenCover(isPresented: $lock) {
            RitmusLock(day: day,
                       onOpenCheckin: { lock = false; DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { checkin = true } },
                       onOpenEste: { lock = false; DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { phase = .este; este = true } },
                       onClose: { lock = false })
        }
        .environment(\.gDecide, { p, ok in decided[p.id] = ok })
    }

    private func show(_ t: String) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { toast = t }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { if toast == t { withAnimation { toast = nil } } }
    }
}

/// The "+" sheet with B3's two doors live (check-in, journal line → the evening voice) + the spike's outside-the-app mock.
struct RitmusPlus: View {
    var onPick: (String) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Rögzítés").font(AuraFont.serif(28)).foregroundStyle(.white).padding(.top, 26)
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                tile("pen-sun", "Kitöltés", "6 kérdés · fél perc", "checkin")
                tile("spark-cream", "Esti zárás", "egy perc", "este")
                tile("bowl-cream", "Étkezés", "B4-ben jön", "Étkezés · B4")
                tile("dumbbell-ink", "Edzés", "B5-ben jön", "Edzés · B5")
                tile("scale-ink", "Súly", "B4-ben jön", "Súly · B4")
                tile("bell-cream", "Kívülről", "értesítés · widget (minta)", "lock")
            }
            HStack(spacing: 10) {
                RMicGlyph(color: .white, size: 20)
                Text("Mondd be, mi történt…").font(.system(size: 15)).foregroundStyle(.white.opacity(0.6))
                Spacer()
            }
            .padding(.horizontal, 18).frame(height: 52)
            .background(Capsule().fill(.white.opacity(0.08)))
            Spacer()
        }
        .padding(.horizontal, 18)
        .preferredColorScheme(.dark)
    }
    private func tile(_ g: String, _ t: String, _ s: String, _ k: String) -> some View {
        Button { onPick(k) } label: {
            VStack(alignment: .leading, spacing: 8) {
                AuraGlyph(g, .white, size: 22)
                Text(t).font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                Text(s).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.55))
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading).gCard(20)
        }
        .buttonStyle(.plain)
    }
}
