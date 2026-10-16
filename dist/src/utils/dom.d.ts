/**
 * GAMBIX DOM Utilities
 */
/**
 * Reads the current 2D translate of an element from style or transform.
 * @param element - Element to inspect for translate/transform, or null.
 * @returns Current { x, y } translate in pixels, or null when absent.
 * Used by: BoardAnimator.animateMove, Interaction drag handling.
 */
export declare function readCurrentTranslate(element: HTMLElement | null): {
    x: number;
    y: number;
} | null;
