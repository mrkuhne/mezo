import SwiftUI

/// Where a proposal stands: waiting for the owner's tap, accepted, or put aside for today (each with its quiet line).
public enum NKProposalState: Equatable, Sendable {
    case pending, accepted(String), dismissed(String)
}

/// Boop's suggestion. Nothing changes until "Elfogadom"; "Most nem" only hides it for today. Settled, it folds to one quiet row.
public struct NKProposalCard: View {
    let text: String, sub: String, state: NKProposalState, compact: Bool
    let onAccept: () -> Void, onDismiss: () -> Void, onWhy: () -> Void
    public init(text: String, sub: String, state: NKProposalState, compact: Bool = false,
                onAccept: @escaping () -> Void, onDismiss: @escaping () -> Void, onWhy: @escaping () -> Void) {
        self.text = text; self.sub = sub; self.state = state; self.compact = compact
        self.onAccept = onAccept; self.onDismiss = onDismiss; self.onWhy = onWhy
    }

    public var body: some View {
        Group {
            switch state {
            case .pending: pending
            case .accepted(let line): settled(ok: true, line: line)
            case .dismissed(let line): settled(ok: false, line: line)
            }
        }
        .transition(.opacity.combined(with: .scale(scale: 0.97)))
    }

    private var pending: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                StillOrb(palette: Hue.forma.orb, size: 20, level: 0.8)
                NKMono("BOOP JAVASOLJA")
                Spacer()
                Button(action: onWhy) {
                    Text("miért?").nkFont(14, .semibold).foregroundStyle(.white).underline(pattern: .dot)
                        .padding(.vertical, 4).padding(.leading, 8)
                }
                .buttonStyle(.plain)
            }
            Text(text).nkFont(compact ? 19 : 21, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            Text(sub).nkFont(14).lineSpacing(2).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 10) {
                pill("Elfogadom", primary: true, onAccept)
                pill("Most nem", primary: false, onDismiss)
            }
            .padding(.top, 4)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous).fill(.white.opacity(0.1))
                .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(LinearGradient(colors: [.white.opacity(0.32), .white.opacity(0.06)], startPoint: .top, endPoint: .bottom), lineWidth: 1)))
    }

    private func pill(_ title: String, primary: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(15, .semibold).lineLimit(1).minimumScaleFactor(0.7)
                .foregroundStyle(primary ? NK.ground : .white)
                .padding(.horizontal, 18).frame(minHeight: 44)
                .background(Capsule().fill(primary ? .white : .white.opacity(0.1)))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func settled(ok: Bool, line: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(ok ? .white : .white.opacity(0.1))
                NKGlyph(ok ? "check-ink" : "clock-ink", ok ? NK.ground : .white.opacity(0.7), size: 15)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 1) {
                Text(line).nkFont(14.5, .medium).foregroundStyle(.white.opacity(ok ? 1 : 0.6))
                Text(ok ? "Elfogadtad · visszavonhatod" : "Szólok, ha újra számít").nkFont(12.5).foregroundStyle(.white.opacity(0.45))
            }
            Spacer(minLength: 8)
            Button(action: onWhy) { Text("miért?").nkFont(13, .medium).foregroundStyle(.white.opacity(0.6)).padding(.vertical, 6) }
                .buttonStyle(.plain)
        }
        .padding(14)
        .nkGlass(20)
    }
}

/// The "miért?" page body: the data behind a proposal and who sees what in it, in one voice. The decision buttons are the caller's.
public struct NKWhyBody: View {
    let title: String, sub: String, closing: String
    let facts: [(value: String, unit: String, label: String)]
    let experts: [(label: String, palette: [Color], text: String, doubt: Bool)]
    public init(title: String, sub: String, facts: [(value: String, unit: String, label: String)],
                experts: [(label: String, palette: [Color], text: String, doubt: Bool)], closing: String) {
        self.title = title; self.sub = sub; self.facts = facts; self.experts = experts; self.closing = closing
    }

    public var body: some View {
        VStack(spacing: 0) {
            ZStack(alignment: .bottomLeading) {
                Color.clear.frame(height: 200)
                    .overlay { PaintedLandscape(hue: .forma) }
                    .clipped()
                    .mask(LinearGradient(stops: [.init(color: .black, location: 0.55), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom))
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        StillOrb(palette: Hue.forma.orb, size: 22, level: 0.8)
                        NKMono("MIÉRT JAVASLOM?")
                    }
                    Text(title).nkFont(32, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 22).padding(.bottom, 4)
            }
            VStack(alignment: .leading, spacing: 26) {
                Text(sub).nkFont(16).lineSpacing(3).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)

                if !facts.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        NKMono("AMIT LÁTOK")
                        HStack(alignment: .top, spacing: 10) {
                            ForEach(facts.indices, id: \.self) { i in
                                let f = facts[i]
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                                        Text(f.value).font(.nkNumber(26)).foregroundStyle(.white)
                                        Text(f.unit).nkFont(12).foregroundStyle(.white.opacity(0.6))
                                    }
                                    .lineLimit(1).minimumScaleFactor(0.7)
                                    Text(f.label).nkFont(12.5).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                                }
                                .padding(14).frame(maxWidth: .infinity, minHeight: 112, alignment: .topLeading).nkGlass(20)
                            }
                        }
                    }
                }

                if !experts.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        NKMono("KI MIT LÁT BENNE")
                        ForEach(experts.indices, id: \.self) { k in
                            let e = experts[k]
                            HStack(alignment: .top, spacing: 12) {
                                StillOrb(palette: e.palette, size: 22, level: 0.7).padding(.top, 1)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(e.label.uppercased()).nkFont(11, .semibold, design: .monospaced).tracking(1.2).foregroundStyle(.white.opacity(0.75))
                                    Text(e.text).nkFont(15).lineSpacing(2).italic(e.doubt)
                                        .foregroundStyle(.white.opacity(e.doubt ? 0.7 : 0.92)).fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            .padding(.vertical, 12)
                            if k < experts.count - 1 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 34) }
                        }
                    }
                    .padding(.horizontal, 18).padding(.vertical, 14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .nkGlass()
                }

                HStack(alignment: .top, spacing: 10) {
                    StillOrb(palette: Hue.forma.orb, size: 26, level: 0.8)
                    VStack(alignment: .leading, spacing: 4) {
                        NKMono("BOOP")
                        Text(closing).nkFont(18, design: .serif).lineSpacing(3).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(.horizontal, 20).padding(.top, 18)
        }
    }
}
