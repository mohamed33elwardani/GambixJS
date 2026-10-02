/**
 * GAMBIX DOM Utilities
 */

/**
 * Reads the current 2D translate of an element from style or transform.
 * @param element - Element to inspect for translate/transform, or null.
 * @returns Current { x, y } translate in pixels, or null when absent.
 * Used by: BoardAnimator.animateMove, Interaction drag handling.
 */
export function readCurrentTranslate(
  element: HTMLElement | null,
): { x: number; y: number } | null {
  if (!element) return null;
  const parse = (val: string | null): { x: number; y: number } | null => {
    if (!val || val === "none") return null;
    const [xStr, yStr] = val.trim().split(/\s+/);
    const x = parseFloat(xStr ?? "");
    const y = parseFloat(yStr ?? "");
    return Number.isNaN(x) || Number.isNaN(y) ? null : { x, y };
  };

  const inline = parse(element.style.translate);
  if (inline) return inline;

  const styles = window.getComputedStyle(element);
  const computed = parse(styles.translate);
  if (computed) return computed;

  if (styles.transform && styles.transform !== "none") {
    const isMatrix3d = styles.transform.startsWith("matrix3d");
    const values = styles.transform
      .slice(styles.transform.indexOf("(") + 1, -1)
      .split(",");
    const x = parseFloat((isMatrix3d ? values[12] : values[4]) ?? "");
    const y = parseFloat((isMatrix3d ? values[13] : values[5]) ?? "");

    if (!Number.isNaN(x) && !Number.isNaN(y)) return { x, y };
  }

  return null;
}
