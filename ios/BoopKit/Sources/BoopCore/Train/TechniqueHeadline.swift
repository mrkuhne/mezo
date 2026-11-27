import Foundation

/// The player's head says in words what is special about an exercise (owner 2026-11-27, `mezo-r36n9.195`): the
/// challenge and the special last set today, and — on a day that leaves them out — what the mesocycle has on it
/// and why it is off. Pure text, so it is tested without a screen.
public enum TechniqueHeadline {

    /// Today's line: `nil` when the exercise has neither a technique nor a challenge today.
    /// - Parameters:
    ///   - technique: the technique today's prescription carries.
    ///   - challenge: today's challenge is live.
    ///   - best: the half-rep count to beat; `nil` when there is none yet.
    public static func today(technique: SetTechnique?, challenge: Bool, best: Int?) -> String? {
        var t = technique == SetTechnique.none ? nil : technique
        // The challenge's own technique is the half reps: said once, by the challenge.
        if challenge, t == .partials { t = nil }
        guard challenge else { return t.map { "Utolsó szett: \($0.name)" } }
        let set = t.map { "utolsó szett: \($0.name), utána félismétlések" } ?? "az utolsó szett után félismétlések"
        let record = best.map { "a csúcsod \($0) félismétlés" } ?? "most állítod be a csúcsot"
        return "Kihívás · \(set) · \(record)"
    }

    /// The dim line on a day that leaves the plan out: `nil` when nothing was left out.
    /// - Parameters:
    ///   - skipped: what the server says today left out.
    ///   - keptTechnique: the technique that still stands today (a sport day keeps the owner's own pick).
    public static func skipped(_ skipped: SkippedTechnique?, keptTechnique: SetTechnique?) -> String? {
        guard let s = skipped, s.technique != nil || s.challenge else { return nil }
        let why = "Ma kimarad, mert \(reason(s.reason))."
        let kept = keptTechnique == SetTechnique.none ? nil : keptTechnique
        // Only the challenge goes, the set itself stands: the head already says the set.
        if s.technique == nil, s.challenge, kept != nil {
            return "A mezociklusban ehhez kihívás is tartozik. \(why)"
        }
        let what: String
        switch (s.technique, s.challenge) {
        case let (t?, true) where t != .partials: what = "kihívás tartozik: \(t.name), utána félismétlések"
        case (_, true): what = "kihívás tartozik: félismétlések az utolsó szett után"
        case let (t?, false): what = "speciális utolsó szett tartozik: \(t.name)"
        case (nil, false): return nil
        }
        return "A mezociklusban ehhez \(what). \(why)"
    }

    static func reason(_ r: SkippedTechnique.Reason) -> String {
        switch r {
        case .deload: "pihenőhét van"
        case .gentle: "kímélő nap van"
        case .sport: "sportnap van"
        }
    }
}
