// logic/rir.ts — the ONE mirror of the contract bound (train.yml rir: 0..5).
/** Every value the RIR picker offers, in render order. */
export const RIR_VALUES = [0, 1, 2, 3, 4, 5] as const
export const RIR_MAX = RIR_VALUES[RIR_VALUES.length - 1]
