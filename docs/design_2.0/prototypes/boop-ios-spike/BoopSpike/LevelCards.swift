import SwiftUI

// Levél spike (mezo-r36n9.38, plan Task 10) — the pieces. Throwaway; everything invented, nothing wired.

/// The proposed Levél glyph: an envelope whose flap is a soft wave, with the morning sun rising over its top edge.
struct LevelGlyph: View {
    var color: Color
    var size: CGFloat = 18
    var body: some View {
        Canvas { ctx, s in
            let k = s.width / 64
            func P(_ f: (inout Path) -> Void) -> Path { var p = Path(); f(&p); return p.applying(CGAffineTransform(scaleX: k, y: k)) }
            let st = StrokeStyle(lineWidth: 5 * k, lineCap: .round, lineJoin: .round)
            ctx.stroke(P { $0.addRoundedRect(in: CGRect(x: 7, y: 24, width: 50, height: 32), cornerSize: CGSize(width: 8, height: 8)) },
                       with: .color(color), style: st)
            ctx.stroke(P { p in p.move(to: CGPoint(x: 11, y: 30))
                           p.addCurve(to: CGPoint(x: 32, y: 43), control1: CGPoint(x: 19, y: 33), control2: CGPoint(x: 25, y: 43))
                           p.addCurve(to: CGPoint(x: 53, y: 30), control1: CGPoint(x: 39, y: 43), control2: CGPoint(x: 45, y: 33)) },
                       with: .color(color), style: st)
            ctx.stroke(P { p in p.addArc(center: CGPoint(x: 45, y: 19), radius: 6, startAngle: .degrees(180), endAngle: .degrees(360), clockwise: false) },
                       with: .color(color), style: st)
        }
        .frame(width: size, height: size).accessibilityHidden(true)
    }
}

let levelAmber = Color(hex: 0xE8C25A)

/// A date mark: "ma" / "holnap" are filled in the hue, later days are outlined.
struct LevelDueRow: View {
    var glyph: String, title: String, sub: String, mark: String, markSub: String
    var hue: Color
    var soon: Bool = false
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(soon ? hue.opacity(0.22) : .white.opacity(0.08))
                EGlyph(glyph, soon ? hue : .white.opacity(0.9), size: 16)
            }.frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white).lineLimit(1)
                Text(sub).font(.system(size: 12)).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
            }
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 4) {
                Text(mark).font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(soon ? gBase : .white.opacity(0.85))
                    .padding(.horizontal, 10).frame(height: 24)
                    .background(Capsule().fill(soon ? AnyShapeStyle(hue) : AnyShapeStyle(Color.white.opacity(0.0))))
                    .overlay(Capsule().stroke(soon ? .clear : .white.opacity(0.25)))
                if !markSub.isEmpty {
                    Text(markSub).font(.custom("Outfit", size: 14).weight(.medium)).foregroundStyle(soon ? hue : .white.opacity(0.8))
                }
            }
        }
        .padding(.vertical, 10)
    }
}

struct LevelDivider: View {
    var body: some View { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 52) }
}

/// One deal: sender, headline, score chip (or none), why it interests him, érdekel / nem érdekel, Gmail.
struct LevelDeal: Identifiable {
    let id = UUID()
    let from: String, title: String, why: String
    var score: Int? = 8
    var phishing = false
    var left: String = ""
}

struct LevelDealCard: View {
    var deal: LevelDeal
    var hue: Color
    var scoreless: Bool = false
    @State private var pick = 0   // 0 none · 1 érdekel · 2 nem érdekel
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(deal.from.uppercased()).font(AuraFont.mono(11, .bold)).tracking(1.4).foregroundStyle(.white.opacity(0.6))
                    Text(deal.title).font(AuraFont.serif(20)).lineSpacing(3).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 10)
                if deal.phishing {
                    Text("nem pontoztam").font(.system(size: 11, weight: .semibold)).foregroundStyle(levelAmber)
                        .padding(.horizontal, 10).frame(height: 30)
                        .background(Capsule().fill(levelAmber.opacity(0.14))).overlay(Capsule().stroke(levelAmber.opacity(0.5)))
                } else if scoreless || deal.score == nil {
                    Text("nincs pontszám").font(.system(size: 11)).foregroundStyle(.white.opacity(0.55))
                        .padding(.horizontal, 10).frame(height: 30)
                        .overlay(Capsule().stroke(.white.opacity(0.2)))
                } else if let s = deal.score {
                    EScore(n: s, hue: hue)
                }
            }
            if !deal.left.isEmpty {
                Text(deal.left).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(hue).padding(.top, 8)
            }
            if deal.phishing {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "exclamationmark.triangle").font(.system(size: 14, weight: .semibold)).foregroundStyle(levelAmber)
                    Text(deal.why).font(.system(size: 13.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.88))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(12).padding(.trailing, 2)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(levelAmber.opacity(0.1)))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(levelAmber.opacity(0.4)))
                .padding(.top, 12)
            } else {
                HStack(alignment: .top, spacing: 10) {
                    StillOrb(colors: EMetric.all[0].orb, size: 20, level: 0.85)
                    Text(deal.why).font(.system(size: 13.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 12)
            }
            if !deal.phishing {
                HStack(spacing: 8) {
                    Button { pick = pick == 1 ? 0 : 1 } label: {
                        Text(pick == 1 ? "Érdekel, megjegyeztem" : "Érdekel").font(.system(size: 14.5, weight: .semibold))
                            .lineLimit(1).fixedSize()
                            .foregroundStyle(pick == 1 ? .white : gBase).padding(.horizontal, 15).frame(height: 40)
                            .background(Capsule().fill(pick == 1 ? AnyShapeStyle(hue.opacity(0.4)) : AnyShapeStyle(Color.white)))
                            .overlay(Capsule().stroke(pick == 1 ? hue : .clear))
                    }.buttonStyle(.plain)
                    Button { pick = pick == 2 ? 0 : 2 } label: {
                        Text(pick == 2 ? "Nem érdekel, elteszem" : "Nem érdekel").font(.system(size: 14.5, weight: .semibold))
                            .lineLimit(1).fixedSize().foregroundStyle(.white).padding(.horizontal, 15).frame(height: 40)
                            .background(Capsule().fill(.white.opacity(pick == 2 ? 0.2 : 0.1)))
                    }.buttonStyle(.plain)
                    Spacer(minLength: 0)
                }.padding(.top, 14)
            }
            Button {} label: {
                HStack(spacing: 6) {
                    Text("Megnyitás a Gmailben").font(.system(size: 13.5, weight: .semibold))
                    Image(systemName: "arrow.up.right").font(.system(size: 11, weight: .bold))
                }
                .foregroundStyle(deal.phishing ? .white.opacity(0.55) : hue)
                .padding(.top, 14).contentShape(Rectangle())
            }.buttonStyle(.plain)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard(22)
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(deal.phishing ? levelAmber.opacity(0.0) : .clear))
    }
}

/// A block that could not load — per block, with "Újra".
struct LevelFailed: View {
    var text: String
    var hue: Color
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark").font(.system(size: 15, weight: .semibold)).foregroundStyle(levelAmber)
            Text(text).font(.system(size: 13.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.8))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 6)
            Button {} label: {
                Text("Újra").font(.system(size: 14, weight: .semibold)).foregroundStyle(gBase)
                    .padding(.horizontal, 16).frame(height: 36).background(Capsule().fill(.white))
            }.buttonStyle(.plain)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.06)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(.white.opacity(0.12)))
    }
}

/// Loading skeleton bars (static — no motion to keep).
struct LevelSkeleton: View {
    var rows: Int = 3
    var body: some View {
        VStack(spacing: 0) {
            ForEach(0..<rows, id: \.self) { i in
                HStack(spacing: 12) {
                    Circle().fill(.white.opacity(0.08)).frame(width: 40, height: 40)
                    VStack(alignment: .leading, spacing: 8) {
                        Capsule().fill(.white.opacity(0.1)).frame(width: 150 + CGFloat(i % 2) * 30, height: 11)
                        Capsule().fill(.white.opacity(0.06)).frame(width: 100, height: 9)
                    }
                    Spacer()
                    Capsule().fill(.white.opacity(0.08)).frame(width: 52, height: 22)
                }.padding(.vertical, 10)
            }
        }
    }
}

/// One folded row per category. Tap to unfold its short list.
struct LevelFold: View {
    var title: String, count: Int, hue: Color
    var lines: [(String, String)]
    @State var open: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button { withAnimation(.easeInOut(duration: 0.2)) { open.toggle() } } label: {
                HStack(spacing: 12) {
                    Text(title).font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                    Spacer()
                    Text("\(count)").font(.custom("Outfit", size: 17).weight(.medium)).foregroundStyle(.white)
                    Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
                        .rotationEffect(.degrees(open ? 90 : 0))
                }
                .padding(.vertical, 14).contentShape(Rectangle())
            }.buttonStyle(.plain)
            if open {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(Array(lines.enumerated()), id: \.offset) { _, l in
                        HStack(alignment: .top, spacing: 12) {
                            Capsule().fill(hue.opacity(0.7)).frame(width: 2.5, height: 28)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(l.0).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                                Text(l.1).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.6))
                            }
                        }
                    }
                    Text("Elolvastam és elrendeztem őket — egyik sem kötődik a céljaidhoz.")
                        .font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.5)).padding(.top, 2)
                }
                .padding(.bottom, 14).padding(.leading, 4)
            }
        }
    }
}
