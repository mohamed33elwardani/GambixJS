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
export function deepMerge<TTarget>(target: TTarget, source: unknown): TTarget {
  const output: Record<string, unknown> = { ...(target as object) };
  if (!source || typeof source !== "object") return output as TTarget;

  for (const key of Object.keys(source as object)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype")
      continue;
    const value = (source as Record<string, unknown>)[key];
    if (value === undefined) continue;

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof output[key] === "object" &&
      output[key] !== null &&
      !Array.isArray(output[key])
    ) {
      output[key] = deepMerge(output[key] as object, value);
    } else {
      output[key] = value;
    }
  }

  return output as TTarget;
}
