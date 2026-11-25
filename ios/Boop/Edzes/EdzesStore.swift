import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The training client, handed down the view tree

private struct TrainClientKey: EnvironmentKey { static let defaultValue: TrainClient? = nil }
private struct ServerCacheKey: EnvironmentKey { static let defaultValue: ServerCache? = nil }
private struct WorkoutFolderKey: EnvironmentKey { static let defaultValue: URL? = nil }

extension EnvironmentValues {
    /// The signed-in user's training client (nil before sign-in, and in tests that have no server).
    var trainClient: TrainClient? {
        get { self[TrainClientKey.self] }
        set { self[TrainClientKey.self] = newValue }
    }

    /// The user's last-known-good read cache (nil before sign-in).
    var serverCache: ServerCache? {
        get { self[ServerCacheKey.self] }
        set { self[ServerCacheKey.self] = newValue }
    }

    /// Where a workout in progress is kept. It sits with the **outbox**, not with the cache:
    /// a half-finished workout is his own unsent work, and clearing a cache must never be
    /// able to throw it away.
    var workoutFolder: URL? {
        get { self[WorkoutFolderKey.self] }
        set { self[WorkoutFolderKey.self] = newValue }
    }
}

/// What the Edzés room reads (B5). Today's resolved session is the only read the Ma tab needs; the other three
/// tabs arrive with their own stages.
///
/// **Offline is a first-class answer, not an error state.** Every read goes to the server first and is written to
/// `ServerCache` on success; when the server cannot be reached, the room shows the **last known good** answer
/// with **how old it is**, and when there is no cache either it says so. Nothing here ever substitutes a zero for
/// a number it does not have.
@MainActor @Observable
final class EdzesStore {
    /// Today's session as the server resolved it, with the instant that answer came from.
    private(set) var today: Cached<TodayWorkout>?
    private(set) var problem: TrainFetchError?
    private(set) var loading = false
    /// The running block: its weeks, where he is in them, and each muscle's volume. Loaded on
    /// its own so a block the server cannot produce never blanks today's session, and the
    /// other way round.
    private(set) var block: Cached<BlockPlan>?
    private(set) var blockProblem: TrainFetchError?
    private(set) var blockLoaded = false
    /// Another day of this week's plan he chose to do today („Másik napot csinálok ma", mezo-r36n9.163); nil is
    /// today's own. Every read of „today" asks the server for that day until he goes back.
    private(set) var pickedDay: UUID? {
        didSet { pickedOn = pickedDay == nil ? nil : day }
    }
    /// The day the pick was made: a pick never carries over midnight.
    private var pickedOn: String?
    /// The template days done this Mon–Sun week, whatever day they were done on; nil until the history answered.
    private(set) var weekDone: Set<UUID>?
    /// The title of a workout finished today, from the week's history — after a Tuesday done on Wednesday, the Ma
    /// card says what was done, not Wednesday's plan.
    private(set) var doneTodayTitle: String?
    /// The template day of that workout.
    private(set) var doneTodayTemplate: UUID?

    /// A cached day stays usable all day — the plan for today does not change under him — but it always says its
    /// age. Older than this and it is not today's plan any more.
    static let maxAge: TimeInterval = 36 * 3600
    /// The block moves once a week, so a cached one stays usable far longer than a day's plan.
    static let blockMaxAge: TimeInterval = 8 * 86_400
    private static let endpoint = "train/today"
    private static let blockEndpoint = "train/block"

    /// The workout in progress. It is kept here, not in a view, because it must outlive the
    /// player being closed — „kis méretre" means the workout goes on.
    private(set) var session: WorkoutSession?
    /// The last workout he finished on this phone, so the day's result can be looked at again after the ceremony
    /// (owner, 2026-11-23: „megnézzem a mai eredményét"). Kept next to the running one, in the outbox folder.
    private(set) var finished: FinishedWorkout?

    /// A finished session and when it ended.
    struct FinishedWorkout: Codable, Equatable {
        var session: WorkoutSession
        var finishedAt: Date
    }

    private let client: TrainClient?
    private let cache: ServerCache?
    /// Where the workout in progress is kept. It can arrive **after** the store is built: the
    /// per-user folders are set up when the session signs in, which may land a render later
    /// than the room's first appearance. A store that captured a nil folder at birth would
    /// silently never save a set — so the folder is attached, not injected once.
    private var folder: URL?
    private let clock: @MainActor () -> Date

    init(client: TrainClient?, cache: ServerCache?, folder: URL? = nil,
         clock: @escaping @MainActor () -> Date = { Date() }) {
        self.client = client; self.cache = cache; self.folder = folder; self.clock = clock
        self.session = Self.readSession(folder)
        self.finished = Self.readFinished(folder)
    }

    /// Point the store at the user's folder, and pick up a workout left running there.
    func attach(folder: URL?) {
        guard let folder, self.folder != folder else { return }
        self.folder = folder
        if session == nil { session = Self.readSession(folder) }
        if finished == nil { finished = Self.readFinished(folder) }
    }

    // MARK: - The workout in progress

    /// The workout in progress, as a file: present while a session is open (the Napló's gym door reads it too).
    static func sessionFile(in folder: URL) -> URL { folder.appendingPathComponent("workout.json") }
    private var sessionFile: URL? { folder.map(Self.sessionFile) }
    private var finishedFile: URL? { folder?.appendingPathComponent("workout-finished.json") }

    /// Today's finished workout on this phone, if there is one — the result „Megnézem" opens.
    var finishedToday: WorkoutSession? {
        guard let finished, Self.ymd(finished.finishedAt) == day else { return nil }
        return finished.session
    }

    /// **Is today's session done?** The server's word first (a finished instance dated today, or today among the
    /// week's done dates), then the phone's own (a workout finished here today whose write may still be queued).
    /// The brief's `done` is a third voice the room adds; none of the three invents the others.
    var doneToday: Bool {
        if let t = today?.value {
            // The day's plan done on any day of this week (a later day done early from the other-day sheet,
            // mezo-r36n9.163) — the server would refuse a second start of it.
            let week = NaploDays.week(containing: day)
            if let c = t.completed, c.status == .completed, c.date >= week.from, c.date <= week.to { return true }
            if t.weekDoneDates.contains(day) { return true }
        }
        return finishedToday != nil
    }

    /// Whether a workout was finished **today** — whichever day of the plan it was. The other-day row is offered
    /// only before that.
    var trainedToday: Bool {
        (today?.value.weekDoneDates.contains(day) ?? false) || finishedToday != nil
    }

    /// Start today's session. Returns the outbox item that tells the server it began — the
    /// caller enqueues it, so this type never has to know what an outbox is.
    @discardableResult
    func startWorkout(date: String, released: Set<UUID> = []) -> OutboxItem? {
        guard let today = today?.value, let template = today.templateSessionId else { return nil }
        // A mission he let go of on the briefing screen takes its exercise back to last week's own numbers —
        // never to an invented lighter weight (`withReleasedMissions`).
        let fresh = WorkoutSession(today.withReleasedMissions(released), startedAt: clock())
        session = fresh
        saveSession()
        return .workoutStart(WorkoutStartPayload(templateSessionId: template),
                             date: date, capturedAt: clock(), id: fresh.ref)
    }

    /// Swap one exercise of the running workout. **This one write needs a connection** (see `changeExercise`):
    /// the server mints the replacement row's id and every later set is addressed by it. Returns the error to
    /// show when it could not be done, `nil` on success.
    func swapExercise(_ id: UUID, for replacement: CatalogExercise, forWholeBlock: Bool) async -> String? {
        guard let client, let session else { return "Most nincs futó edzés." }
        guard let plan = today?.value.exercises.first(where: { $0.id == id }) ?? today?.value.exercises.first
        else { return "A mai tervet nem érem el, így nem tudom lecserélni." }
        // The server's own id for this workout. It may not be known yet: the start goes through the outbox, and
        // the queue may not have drained. The server's start is **idempotent on the template day** — it returns
        // the open instance rather than making a second one — so asking for it here is safe and is the only way
        // a swap works on the first exercise of a session.
        guard let workoutId = await serverWorkoutId(client, session) else {
            return "Az edzés még nem ért fel a szerverre. Próbáld újra, amint van net."
        }
        let old = session.exercises[id]
        do {
            let result = try await client.changeExercise(
                workoutId: workoutId, replacing: id, with: replacement,
                // The app never holds warm-ups, so the server's own count goes back untouched.
                warmupSets: plan.warmupCount,
                workingSets: max(1, old?.planned.filter { $0.kind == .working }.count ?? plan.workingCount),
                repMin: plan.repMin, repMax: plan.repMax, targetRIR: plan.targetRIR,
                forWholeBlock: forWholeBlock)
            today = Cached(value: result.today, fetchedAt: clock(), age: 0)
            if let fresh = result.today.exercises.first(where: { $0.id == result.exerciseId }) {
                var updated = self.session ?? session
                updated.swap(id, for: fresh)
                update(updated)
            }
            return nil
        } catch TrainFetchError.offline {
            return "A csere internetet kér, és most nincs. Hagyd ki a gyakorlatot, vagy írd a jegyzetbe, mit csináltál helyette."
        } catch {
            return "A cserét a szerver most nem fogadta el."
        }
    }

    /// The server's own id for the running workout, asking for it when the queue has not learned it yet. The
    /// start is idempotent on the template day, so asking is safe (see `swapExercise`).
    private func serverWorkoutId(_ client: TrainClient, _ session: WorkoutSession) async -> UUID? {
        var workoutId = await client.knownWorkoutId(for: session.ref) ?? today?.value.open?.id
        if workoutId == nil, let template = session.templateSessionId ?? today?.value.templateSessionId {
            workoutId = try? await client.startWorkout(templateSessionId: template, ref: session.ref).id
        }
        return workoutId
    }

    // MARK: - The reasoned swap (mezo-r36n9.66, spec §6.2)

    /// „Mi van a termemben": what his gym lacks. Everything counts as available until the server says otherwise.
    private(set) var gym = GymProfile()
    private(set) var gymLoaded = false
    /// Exercises of today's workout he said „nem esik jól" about. Read from the session, which is saved with every
    /// change, so the chip stays true across the sheet reopening and the app relaunching.
    var discomforts: Set<UUID> {
        Set(session?.exercises.values.filter { $0.discomfort == true }.map(\.id) ?? [])
    }
    /// Gym writes run one after another: each re-reads the profile first, and two overlapping ones would each
    /// write back a profile missing the other's change.
    private var gymWrite: Task<String?, Never>?

    func loadGym() async {
        guard let client, !gymLoaded else { return }
        if let fresh = try? await client.gymProfile() { gym = fresh; gymLoaded = true }
    }

    /// Ranked, reasoned alternatives for one exercise of the running workout; nil when they cannot be fetched
    /// (the sheet then falls back to the plain same-muscle list).
    func substitutes(for exerciseId: UUID) async -> Substitutes? {
        guard let client, let session, let workoutId = await serverWorkoutId(client, session) else { return nil }
        return try? await client.substitutes(workoutId: workoutId, exerciseId: exerciseId)
    }

    /// „Ehhez nincs eszközöm": switch one kind off or mark one machine missing, at once on the phone and then on
    /// the server. Returns the sentence to show when it could not be saved (the change is then taken back), nil
    /// on success. `.ask` is a question for the sheet, never saved.
    func markMissing(_ edit: MissingEdit) async -> String? {
        if case .ask = edit { return nil }
        return await saveGym { $0.applying(edit) }
    }

    /// *Visszavonom*. The sentence to show when it could not be saved, nil on success.
    func undoMissing(_ edit: MissingEdit) async -> String? {
        if case .ask = edit { return nil }
        return await saveGym { $0.reverting(edit) }
    }

    /// `change` is applied to the profile **as the server has it right now** — re-read before every write, so an
    /// edit made on another device or in an earlier run is never written over. A refused save leaves the profile as
    /// the server last said it. Writes are serialised (`gymWrite`).
    func saveGym(_ change: @escaping (GymProfile) -> GymProfile) async -> String? {
        let previous = gymWrite
        let write = Task { @MainActor [weak self] () -> String? in
            _ = await previous?.value
            guard let self else { return nil }
            return await self.writeGym(change)
        }
        gymWrite = write
        return await write.value
    }

    private func writeGym(_ change: (GymProfile) -> GymProfile) async -> String? {
        guard let client else { return "Most nem érem el a termed beállításait." }
        let fresh: GymProfile
        do {
            fresh = try await client.gymProfile()
        } catch TrainFetchError.offline {
            return "Ehhez internet kell, és most nincs."
        } catch {
            return "Most nem érem el a termed beállításait."
        }
        gymLoaded = true
        let next = change(fresh)
        gym = next
        do {
            gym = try await client.saveGymProfile(next)
            return nil
        } catch TrainFetchError.offline {
            gym = fresh
            return "Ehhez internet kell, és most nincs."
        } catch {
            gym = fresh
            return "A termed beállítását most nem sikerült elmenteni."
        }
    }

    /// „Nem esik jól" on (or off again) for one exercise of today's workout. True when the server took it.
    func setDiscomfort(_ on: Bool, exerciseId: UUID) async -> Bool {
        guard let client, let session, let workoutId = await serverWorkoutId(client, session) else { return false }
        do {
            if on { try await client.markDiscomfort(workoutId: workoutId, exerciseId: exerciseId) }
            else { try await client.clearDiscomfort(workoutId: workoutId, exerciseId: exerciseId) }
        } catch { return false }
        if var updated = self.session {
            updated.setDiscomfort(on, for: exerciseId)
            update(updated)
        }
        return true
    }

    /// Put the session back where it was — used when the player closes and when the app
    /// comes back. Saving on every change is deliberate: a set he did is never lost to a
    /// crash, and the file is tiny.
    func update(_ session: WorkoutSession) {
        self.session = session
        saveSession()
    }

    /// The workout is over: the session leaves the phone's memory and its file — and stays, as the day's result,
    /// in the finished file until the next one replaces it.
    /// What the server says this finished workout burned (mezo-r36n9.170): its estimate at once, the watch's figure
    /// once the watch's workout has synced. Only today's completed instance of the same plan day counts — never a
    /// number from another workout.
    func energy(for session: WorkoutSession) -> WorkoutEnergy? {
        guard let c = today?.value.completed, c.status == .completed, c.date == day else { return nil }
        if let mine = session.templateSessionId, let theirs = c.templateSessionId, mine != theirs { return nil }
        return c.energy
    }

    func endWorkout() {
        if let session {
            finished = FinishedWorkout(session: session, finishedAt: clock())
            saveFinished()
        }
        session = nil
        if let sessionFile { try? FileManager.default.removeItem(at: sessionFile) }
    }

    private func saveFinished() {
        guard let finishedFile, let finished else { return }
        try? FileManager.default.createDirectory(at: finishedFile.deletingLastPathComponent(),
                                                 withIntermediateDirectories: true)
        if let data = try? JSONEncoder().encode(finished) {
            try? data.write(to: finishedFile, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
    }

    private static func readFinished(_ folder: URL?) -> FinishedWorkout? {
        guard let url = folder?.appendingPathComponent("workout-finished.json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(FinishedWorkout.self, from: data)
    }

    private func saveSession() {
        guard let sessionFile, let session else { return }
        try? FileManager.default.createDirectory(at: sessionFile.deletingLastPathComponent(),
                                                 withIntermediateDirectories: true)
        // Readable after the first unlock, so a workout survives the phone locking mid-set.
        if let data = try? JSONEncoder().encode(session) {
            try? data.write(to: sessionFile, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
    }

    private static func readSession(_ folder: URL?) -> WorkoutSession? {
        guard let url = folder?.appendingPathComponent("workout.json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(WorkoutSession.self, from: data)
    }

    /// `yyyy-MM-dd` of the day this store is about, in the device's own calendar.
    private var day: String { Self.ymd(clock()) }

    private static func ymd(_ date: Date) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .autoupdatingCurrent
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Load today's session. Already-loaded days are not re-fetched unless `force` is set, so moving between the
    /// room's tabs costs nothing.
    func load(force: Bool = false) async {
        guard let client else {
            // No client at all (not signed in, or a test): nothing to say, and nothing invented.
            if today == nil { problem = .unauthorized }
            return
        }
        guard force || (today == nil && problem == nil) else { return }
        loading = true
        defer { loading = false }
        let date = day
        if pickedOn != date { pickedDay = nil }
        // The day on the card: the one he picked, else the one running on the phone (a picked day started, the room
        // closed and opened again — mezo-r36n9.163), else today's own.
        let asked = pickedDay ?? session?.templateSessionId
        do {
            let fresh = try await client.todayWorkout(templateSessionId: asked)
            guard asked == (pickedDay ?? session?.templateSessionId) else { return }  // a pick landed meanwhile
            today = Cached(value: fresh, fetchedAt: clock(), age: 0)
            problem = nil
            // Another weekday's plan is kept under its own key: the offline fallback must never show it as today's.
            try? await cache?.put(fresh, endpoint: cacheKey(for: fresh), date: date)
            // A workout running on a plan that has since changed (he edited the block, or started from a stale
            // cache): the fresh order, set counts and technique go into the running session, nothing logged is
            // lost (`WorkoutSession.apply`, mezo-r36n9.147).
            if var running = session {
                running.apply(plan: fresh)
                if running != session { update(running) }
            }
        } catch {
            let failure = (error as? TrainFetchError) ?? .server
            // A picked or running other day already on screen stays as it is.
            if failure == .offline, asked != nil, today?.value.templateSessionId == asked { return }
            // Only the network sends us to the cache. A refusal or a server fault is not "here is an old answer":
            // it is a problem the room reports.
            if failure == .offline, let hit = await cachedPlan(asked, date: date) {
                today = hit
                problem = nil
            } else {
                problem = failure
            }
        }
    }

    /// Today he does another day of the week (`id`), or his own again (nil). The other day's plan needs the server;
    /// without it nothing changes and the sentence to show comes back.
    func pick(_ id: UUID?) async -> String? {
        guard let id else {
            pickedDay = nil
            await load(force: true)
            return nil
        }
        guard let client else { return "A másik nap tervét most nem érem el." }
        do {
            let fresh = try await client.todayWorkout(templateSessionId: id)
            pickedDay = id
            today = Cached(value: fresh, fetchedAt: clock(), age: 0)
            problem = nil
            try? await cache?.put(fresh, endpoint: cacheKey(for: fresh), date: day)
            return nil
        } catch TrainFetchError.offline {
            return "Most nem érem el a szervert, a másik nap tervét nem tudom letölteni."
        } catch {
            return "A szerver most nem adta oda annak a napnak a tervét."
        }
    }

    /// The week's done template days and today's done title, from the week's history plus the Napló bookings still
    /// in the queue. A failed read leaves them unknown, never empty.
    func loadWeek(queued: [WorkoutAsPlannedPayload]) async {
        guard let client else { return }
        let week = NaploDays.week(containing: day)
        let finishedHere = finished.flatMap { f in Self.ymd(f.finishedAt) >= week.from ? f.session.templateSessionId : nil }
        guard let from = Self.noon(week.from), let to = Self.noon(week.to),
              let history = try? await client.history(from: from, to: to) else {
            if let t = finishedHere, weekDone != nil { weekDone?.insert(t) }
            return
        }
        var done = weekDoneTemplates(history: history, week: week, queued: queued)
        // A workout finished on this phone whose write is still queued counts too.
        if let t = finishedHere { done.insert(t) }
        weekDone = done
        let doneToday = history.last { $0.date == day && $0.status == .completed }
        doneTodayTitle = doneToday?.title
        doneTodayTemplate = doneToday?.templateSessionId
    }

    /// `train/today` for today's own plan, `train/today/<template day>` for another weekday's.
    private func cacheKey(for plan: TodayWorkout) -> String {
        guard let i = todayIndex, isAnotherDay(plan, todayIndex: i), let id = plan.templateSessionId else { return Self.endpoint }
        return "\(Self.endpoint)/\(id.uuidString)"
    }

    /// The cached plan for the day asked (nil = today's own): its own key first, then today's when it is that day.
    private func cachedPlan(_ asked: UUID?, date: String) async -> Cached<TodayWorkout>? {
        guard let cache else { return nil }
        if let asked, let hit = await cache.get(TodayWorkout.self, endpoint: "\(Self.endpoint)/\(asked.uuidString)",
                                                date: date, maxAge: Self.maxAge) { return hit }
        guard let hit = await cache.get(TodayWorkout.self, endpoint: Self.endpoint, date: date, maxAge: Self.maxAge)
        else { return nil }
        return asked == nil || hit.value.templateSessionId == asked ? hit : nil
    }

    /// Today's weekday, Monday = 0, in the device's calendar.
    var todayIndex: Int? { TrainWeekdays.index(ofDate: day, calendar: Self.calendar) }

    private static var calendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .autoupdatingCurrent
        return cal
    }

    private static func noon(_ ymd: String) -> Date? {
        let p = ymd.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12))
    }

    /// The running block. Same rule as the day: the server first, the cache only when there is
    /// no network, and the age always said.
    func loadBlock(force: Bool = false) async {
        guard let client else { blockLoaded = true; return }
        guard force || !blockLoaded else { return }
        blockLoaded = true
        let key = "current"
        do {
            let fresh = try await client.blockPlan()
            if let fresh {
                block = Cached(value: fresh, fetchedAt: clock(), age: 0)
                try? await cache?.put(fresh, endpoint: Self.blockEndpoint, date: key)
            } else {
                // No running block at all. That is an answer, and the tab says it in words —
                // it is not a failure and it must not show a stale block instead.
                block = nil
            }
            blockProblem = nil
        } catch {
            let failure = (error as? TrainFetchError) ?? .server
            if failure == .offline, let hit = await cache?.get(BlockPlan.self, endpoint: Self.blockEndpoint,
                                                               date: key, maxAge: Self.blockMaxAge) {
                block = hit
                blockProblem = nil
            } else {
                blockProblem = failure
            }
        }
    }

    /// What he has ever done, per exercise — the one thing that can say „ez rekordkísérlet" truthfully. Loaded
    /// once per run and never substituted: with no records at all, no mission is called a record attempt.
    private(set) var records: [ExerciseRecord] = []
    private var recordsLoaded = false
    /// Every exercise he can pick from, for the swap sheet. Loaded only when that sheet is first opened.
    private(set) var catalog: [CatalogExercise] = []
    private var catalogLoaded = false

    func loadRecords() async {
        guard let client, !recordsLoaded else { return }
        recordsLoaded = true
        records = (try? await client.records()) ?? []
    }

    func loadCatalog() async {
        guard let client, !catalogLoaded else { return }
        catalogLoaded = true
        catalog = (try? await client.catalog()) ?? []
    }

    /// Today's missions: the steps the engine actually took, with his records deciding which of them is a
    /// record attempt.
    var missions: [TrainMission] { trainMissions(today?.value, records: records) }

    var blockAgeText: String? { Self.ageText(block?.age) }

    /// How old what the room shows is, in his words — nil when it came from the server just now.
    var ageText: String? { Self.ageText(today?.age) }

    /// „2 napos terv" / „5 órás terv"; nothing under a quarter of an hour, because a fresh read is not news.
    static func ageText(_ age: TimeInterval?) -> String? {
        guard let age, age >= 900 else { return nil }
        let hours = Int(age / 3600)
        if hours < 24 { return "\(max(1, hours)) órás terv" }
        return "\(hours / 24) napos terv"
    }
}

// MARK: - What today's session asks of the body

/// Today's load per muscle, for the body map: **relative to the hardest-worked muscle today**,
/// because one session has no meaning against a weekly landmark — a single day cannot be "over
/// MRV". The hardest-worked muscle is fully lit and the rest are read against it.
///
/// Only the working sets count. Warmups are not load, and counting them would make a long
/// warm-up look like volume.
func edzesBodyHeat(_ workout: TodayWorkout?) -> [NKBodyHeat] {
    guard let workout else { return [] }
    var sets: [String: Int] = [:]
    for e in workout.exercises {
        let working = e.sets.filter { $0.kind == .working }.count
        sets[e.muscle, default: 0] += working > 0 ? working : e.workingCount
    }
    guard let top = sets.values.max(), top > 0 else { return [] }
    return sets.map { NKBodyHeat(muscle: $0.key, level: Double($0.value) / Double(top)) }
        .sorted { $0.muscle < $1.muscle }
}

/// Today's session in three numbers: how many exercises, how many working sets, and roughly how
/// long. Each is `nil` when the plan does not say — the room prints a dash, never a 0.
struct EdzesSummary: Equatable {
    var exercises: Int?
    var workingSets: Int?
    var minutes: Int?
}

func edzesSummary(_ workout: TodayWorkout?, brief: Brief?) -> EdzesSummary {
    var out = EdzesSummary()
    if let workout, !workout.exercises.isEmpty {
        out.exercises = workout.exercises.count
        let sets = workout.exercises.reduce(0) { sum, e in
            let working = e.sets.filter { $0.kind == .working }.count
            return sum + (working > 0 ? working : e.workingCount)
        }
        out.workingSets = sets > 0 ? sets : nil
    } else if let e = brief?.day.session?.exercises, !e.isEmpty {
        out.exercises = e.count
        let sets = e.reduce(0) { $0 + $1.sets }
        out.workingSets = sets > 0 ? sets : nil
    }
    out.minutes = brief?.day.session?.minutes ?? workout?.durationEst
    return out
}

/// The block's weeks for the timeline: the phase curve as height, and where he is now.
func edzesTimeline(_ block: BlockPlan?) -> [NKBlockWeek] {
    guard let block, block.weeks > 0 else { return [] }
    return (1...block.weeks).map { week in
        let phase = block.phaseCurve.indices.contains(week - 1) ? block.phaseCurve[week - 1] : .mav
        let state: NKBlockWeek.State = week < block.currentWeek ? .past
            : (week == block.currentWeek ? .current : .future)
        return NKBlockWeek(week: week, load: phaseLoad(phase), phase: phase.hungarian,
                           state: state, isDeload: phase == .deload)
    }
}

/// How hard a phase asks you to work, as a height. A deload is drawn low **and** hollow, so it
/// reads as the planned easy week rather than as a week that went wrong.
private func phaseLoad(_ phase: BlockPhase) -> Double {
    switch phase {
    case .mev: 0.45
    case .mav: 0.72
    case .mrv: 1.0
    case .deload: 0.3
    }
}
