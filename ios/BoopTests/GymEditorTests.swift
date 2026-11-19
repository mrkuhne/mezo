import Foundation
import Testing
import BoopCore
@testable import Boop

/// „Mi van a termemben": a switch that could not be saved goes back, and the store's profile stays the truth.
@MainActor
struct GymEditorTests {
    /// A stand-in for `EdzesStore.saveGym`: keeps the profile, refuses when told to.
    final class Fake {
        var gym = GymProfile()
        var loaded = true
        var refuse = false
        var saved: [GymProfile] = []
        func save(_ change: (GymProfile) -> GymProfile) -> String? {
            if refuse { return "nem" }
            gym = change(gym); saved.append(gym); return nil
        }
    }

    func editor(_ f: Fake) -> GymEditor {
        GymEditor(current: { f.gym }, ready: { f.loaded }, load: { }, save: { f.save($0) })
    }

    @Test func switchingOffSavesTheWholeProfile() async {
        let f = Fake(); let e = editor(f)
        await e.setKind(.cable, on: false)
        #expect(!e.isOn(.cable))
        #expect(f.saved.last?.offKinds == ["cable"])
        #expect(!e.failed)
    }

    @Test func aRefusedSaveTakesTheSwitchBackAndAsksForRetry() async {
        let f = Fake(); f.refuse = true; let e = editor(f)
        await e.setKind(.machine, on: false)
        #expect(e.isOn(.machine))
        #expect(e.profile == GymProfile())
        #expect(e.failed)
    }

    @Test func retryReappliesTheSameChange() async {
        let f = Fake(); f.refuse = true; let e = editor(f)
        await e.setKind(.machine, on: false)
        f.refuse = false
        await e.retry()
        #expect(!e.isOn(.machine))
        #expect(f.gym.offKinds == ["machine"])
        #expect(!e.failed)
    }

    @Test func aRefusedSwitchOnLeavesTheKindOff() async {
        let f = Fake(); f.gym = GymProfile(offKinds: ["smith"]); let e = editor(f)
        f.refuse = true
        await e.setKind(.smith, on: true)
        #expect(!e.isOn(.smith))
        #expect(e.failed)
    }

    @Test func mégisVanRemovesOnlyThatExercise() async {
        let a = UUID(), b = UUID()
        let f = Fake(); f.gym = GymProfile(offKinds: ["bench"], missing: [a, b]); let e = editor(f)
        await e.restore(a)
        #expect(e.profile.missing == [b])
        #expect(e.profile.offKinds == ["bench"])
    }

    @Test func aProfileThatWasNeverReadIsNotWrittenOver() async {
        let f = Fake(); f.loaded = false; let e = editor(f)
        await e.setKind(.dumbbell, on: false)
        #expect(f.saved.isEmpty)
        #expect(e.failed)
    }
}
