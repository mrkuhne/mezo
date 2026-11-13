import SwiftUI
import BoopCore
import BoopDesign

// Receptműhely: Boop invents a recipe from what the owner asks for, within his own rules. One stateless chat turn at a
// time (the server stores nothing); the draft it ends with goes through the same review and the same one save as an import.

/// The workshop's conversation, apart from any view.
@MainActor @Observable
final class WorkshopModel {
    private(set) var messages: [WorkshopChatMessage] = []
    private(set) var draft: WorkshopDraft?
    var input = ""
    private(set) var busy = false
    private(set) var problem: String?

    private let turn: @Sendable (String, [WorkshopChatMessage], WorkshopDraft?) async throws -> WorkshopReply

    init(turn: @escaping @Sendable (String, [WorkshopChatMessage], WorkshopDraft?) async throws -> WorkshopReply) { self.turn = turn }

    /// The server's own limits: 2000 characters a message, 20 messages of history.
    static let maxMessage = 2000
    static let maxHistory = 20

    var canSend: Bool { !busy && !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    func send(_ text: String? = nil) async {
        let said = String((text ?? input).trimmingCharacters(in: .whitespacesAndNewlines).prefix(Self.maxMessage))
        guard !busy, !said.isEmpty else { return }
        busy = true; problem = nil
        let history = Array(messages.suffix(Self.maxHistory))
        messages.append(WorkshopChatMessage(fromUser: true, text: said))
        input = ""
        defer { busy = false }
        do {
            let reply = try await turn(said, history, draft)
            messages.append(WorkshopChatMessage(fromUser: false, text: reply.reply))
            draft = reply.draft
        } catch let e as FoodFetchError {
            // the owner's words are not lost: back into the field, ready to send again
            messages.removeLast(); input = said
            problem = workshopProblemLine(e)
        } catch {
            messages.removeLast(); input = said
            problem = workshopProblemLine(.server)
        }
    }
}

func workshopProblemLine(_ e: FoodFetchError) -> String {
    switch e {
    case .offline: "Nincs net. Amit írtál, itt maradt — küldd el újra, ha van."
    case .unauthorized: "A belépésed lejárt — lépj be újra."
    case .unavailable: "Boop most nem érhető el, ezért nem tud receptet kitalálni. Próbáld újra később."
    case .rejected: "Ezt most nem tudom elküldeni. Írd át egy kicsit."
    default: "Most nem jön válasz. Amit írtál, itt maradt — próbáld újra."
    }
}

/// The workshop sheet; when the owner opens the draft for review, the same review body an import ends in takes over.
struct RecipeWorkshopSheet: View {
    @State private var model: WorkshopModel
    @State private var reviewing: RecipeImportModel?
    private let profile: SensitivityProfile?
    private let makeReview: (WorkshopDraft) -> RecipeImportModel
    let onSaved: (Recipe) -> Void
    @FocusState private var typing: Bool

    init(food: FoodClient?, profile: SensitivityProfile?, onSaved: @escaping (Recipe) -> Void) {
        _model = State(initialValue: WorkshopModel(turn: { message, history, draft in
            guard let food else { throw FoodFetchError.unauthorized }
            return try await food.workshop(message: message, history: history, draft: draft)
        }))
        makeReview = { draft in
            RecipeImportModel(mode: .text, reader: { _ in nil },
                              saver: { recipe in
                                  guard let food else { throw FoodFetchError.unauthorized }
                                  return try await food.createRecipe(recipe)
                              }, review: RecipeReview(workshop: draft), eyebrow: "RECEPTMŰHELY")
        }
        self.onSaved = onSaved
        self.profile = profile
    }

    #if DEBUG
    private func debugAsk() async {
        guard let ask = UserDefaults.standard.string(forKey: "etelWorkshopAsk"), model.messages.isEmpty else { return }
        await model.send(ask)
    }
    #endif

    private let starters = ["Magas fehérjetartalmú vacsora, 20 perc alatt", "Edzés előtti falat, könnyű", "Gyors reggeli laktózmentesen"]

    var body: some View {
        sheet
        #if DEBUG
            .task { await debugAsk() }
        #endif
    }

    private var sheet: some View {
        NKSheetFrame(hue: .fuel, eyebrow: "RECEPTMŰHELY", title: reviewing == nil ? "Mit főzzünk?" : (reviewing?.review?.name ?? "Recept")) {
            if let reviewing {
                Button { self.reviewing = nil } label: {
                    HStack(spacing: 6) { Image(systemName: "chevron.left"); Text("Vissza a beszélgetéshez") }
                        .nkFont(14).foregroundStyle(.white.opacity(0.8)).frame(minHeight: 40)
                }
                .buttonStyle(.plain).frame(maxWidth: .infinity, alignment: .leading)
                ReviewBody(model: reviewing, profile: profile, onSaved: onSaved)
            } else {
                conversation
            }
        }
    }

    @ViewBuilder private var conversation: some View {
        VStack(alignment: .leading, spacing: 14) {
            if model.messages.isEmpty {
                Text("Írd le, mit szeretnél — Boop a szabályaid és a kamrád szerint kitalál egy receptet. Ami nincs a kamrádban, azt megjelöli, és nem kerül a mentett receptbe.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
                FlowRow { ForEach(starters, id: \.self) { s in
                    Button { Task { await model.send(s) } } label: {
                        Text(s).nkFont(13).foregroundStyle(.white.opacity(0.9)).multilineTextAlignment(.leading)
                            .padding(.horizontal, 12).padding(.vertical, 8).background(Capsule().fill(.white.opacity(0.1)))
                    }
                    .buttonStyle(.plain)
                } }
            }
            ForEach(Array(model.messages.enumerated()), id: \.offset) { _, m in bubble(m) }
            if model.busy {
                HStack(spacing: 10) { ProgressView().tint(.white); Text("Boop gondolkodik…").nkFont(14).foregroundStyle(.white.opacity(0.7)) }
                    .accessibilityElement(children: .combine)
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()

        if let draft = model.draft { draftCard(draft) }

        VStack(alignment: .leading, spacing: 10) {
            if let problem = model.problem {
                Text(problem).nkFont(13.5).foregroundStyle(Color(hex: 0xF7A8C4)).fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 10) {
                TextField("", text: $model.input, prompt: Text(model.draft == nil ? "Mit szeretnél enni?" : "Mit változtassak?").foregroundStyle(.white.opacity(0.4)), axis: .vertical)
                    .lineLimit(1...4).nkFont(15).foregroundStyle(.white).focused($typing).submitLabel(.send)
                    .onSubmit { Task { await model.send() } }
                    .padding(.horizontal, 16).padding(.vertical, 12).background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(.white.opacity(0.08)))
                    .accessibilityLabel("Üzenet Boopnak")
                Button { typing = false; Task { await model.send() } } label: {
                    Image(systemName: "arrow.up").nkFont(16, .bold).foregroundStyle(NK.ground).frame(width: 44, height: 44)
                        .background(Circle().fill(.white.opacity(model.canSend ? 0.95 : 0.3)))
                }
                .buttonStyle(.plain).disabled(!model.canSend).accessibilityLabel("Küldés")
            }
        }
    }

    private func bubble(_ m: WorkshopChatMessage) -> some View {
        Text(m.text).nkFont(15).lineSpacing(2).foregroundStyle(.white.opacity(m.fromUser ? 0.7 : 0.95))
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: m.fromUser ? .trailing : .leading)
            .multilineTextAlignment(m.fromUser ? .trailing : .leading)
            .accessibilityLabel((m.fromUser ? "Te: " : "Boop: ") + m.text)
    }

    private func draftCard(_ d: WorkshopDraft) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            NKMono("A TERV")
            Text(d.name).nkFont(20, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            Text("\(d.servings) adag · \(d.lines.count) hozzávaló · \(d.steps.count) lépés").nkFont(12.5, design: .monospaced).foregroundStyle(.white.opacity(0.6))
            ForEach(Array(d.lines.enumerated()), id: \.offset) { _, l in
                HStack(spacing: 8) {
                    Text(l.name).nkFont(14.5).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 4)
                    Text("\(l.amount == l.amount.rounded() ? "\(Int(l.amount))" : String(format: "%.1f", l.amount)) \(l.unit)")
                        .nkFont(12.5, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                    if l.source != "pantry" {
                        Text("nincs a kamrádban").nkFont(10.5, .medium).foregroundStyle(.white.opacity(0.65))
                            .padding(.horizontal, 7).padding(.vertical, 3).background(Capsule().fill(.white.opacity(0.1)))
                    }
                }
            }
            NKPill("Átnézem és mentem") { reviewing = makeReview(d) }.padding(.top, 4)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }
}
