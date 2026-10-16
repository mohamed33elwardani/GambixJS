/**
 * GAMBIX Object Utilities
 */
/**
 * Recursively merges source properties into target object.
 * Ignores undefined properties so defaults are never overwritten by undefined.
 * Arrays and primitives from source override target.
 */
/**
 * Deep-merges source properties into a copy of target without mutating it.
 * @param target - Base object whose properties are preserved.
 * @param source - Override object merged recursively into the copy.
 * @returns New merged object typed as TTarget.
 * Used by: Gambix constructor, tests/helpers test setup.
 */
export declare function deepMerge<TTarget>(target: TTarget, source: unknown): TTarget;
