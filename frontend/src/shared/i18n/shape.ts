/**
 * The shape of a message catalog: string leaves widen to `string`, function leaves keep their
 * parameter list and return `string`. Each `*.en.ts` is typed `Shape<typeof xHu>`, so a missing
 * or mis-shaped English entry is a compile error.
 */
export type Shape<T> = T extends (...args: infer A) => string
  ? (...args: A) => string
  : T extends string
    ? string
    : { [K in keyof T]: Shape<T[K]> }
