import type { ArrowRecord, ChessEvents, DrawingConfig } from "../types/types.ts";
import type EventBus from "../events/event-bus.ts";
/**
 * Manages the SVG overlay for user-drawn and persistent analysis arrows.
 *
 * Used by: Gambix facade, interaction event flow, UI tests.
 */
export default class Arrows {
    drawConfig: DrawingConfig;
    activeColor: string;
    activeWidth: number;
    mainlineColor: string;
    mainlineWidth: number;
    keys: Map<string, string>;
    keysWidth: Map<string, number>;
    svg: SVGSVGElement;
    readonly markerBase: string;
    private eventBus;
    private getBoardElement;
    private arrowMap;
    private markerWidths;
    private activeButtonKey;
    private tempGroup;
    private orientation;
    private unsubs;
    /**
     * Creates the arrow layer and wires it to config and events.
     *
     * @param drawConfig - Drawing colors, widths and button bindings.
     * @param eventBus - Shared chess event bus.
     * @param orientation - Initial board orientation.
     * @param getBoardElement - Returns the board container element.
     * @returns Nothing.
     * Used by: Gambix setup, test fixtures.
     */
    constructor(drawConfig: DrawingConfig, eventBus: EventBus<ChessEvents>, orientation?: "white" | "black", getBoardElement?: () => HTMLElement | null);
    /**
     * Reads drawing config into active colors, widths and button maps.
     *
     * @returns Nothing.
     * Used by: Arrows constructor, refreshFromConfig.
     */
    private readConfig;
    /**
     * Creates the SVG overlay element and attaches it to the board.
     *
     * @returns Nothing.
     * Used by: Arrows constructor.
     */
    private initSvg;
    /**
     * Returns the SVG defs element, creating it when missing.
     *
     * @returns The SVG defs element.
     * Used by: upsertMarker.
     */
    private getDefs;
    /**
     * Creates or updates an SVG arrowhead marker for a width.
     *
     * @param markerId - Marker element id to create or update.
     * @param width - Requested stroke width.
     * @returns The marker id.
     * Used by: markerForButton, markerForWidth.
     */
    private upsertMarker;
    /**
     * Resolves the marker id bound to a mouse button key.
     *
     * @param buttonKey - Configured button name.
     * @returns The marker id for that button.
     * Used by: ensureMarkers, resolveMarkerAndWidth, draw preview flow.
     */
    private markerForButton;
    /**
     * Resolves the marker id for an explicit stroke width.
     *
     * @param width - Requested stroke width.
     * @returns The marker id for that width.
     * Used by: resolveMarkerAndWidth.
     */
    private markerForWidth;
    /**
     * Ensures arrowhead markers exist for all configured buttons.
     *
     * @returns Nothing.
     * Used by: Arrows constructor, refreshFromConfig, rerenderAll.
     */
    private ensureMarkers;
    /**
     * Resolves the marker and effective width for a color and width.
     *
     * @param color - Requested arrow color.
     * @param width - Optional explicit width override.
     * @returns The resolved marker id and width.
     * Used by: createArrowElement.
     */
    private resolveMarkerAndWidth;
    /**
     * Converts a square name to its center ratio coordinates.
     *
     * @param sq - Square name such as e4.
     * @returns Center coordinates in 8x8 ratio units.
     * Used by: buildArrowPath, buildKnightArrowPath, squareToCoords.
     */
    private getSquarePoint;
    /**
     * Builds SVG line markup for a straight arrow.
     *
     * @param from - Start square.
     * @param to - End square.
     * @param color - Arrow stroke color.
     * @param markerId - Arrowhead marker id.
     * @param width - Optional stroke width.
     * @param elementId - Optional SVG element id.
     * @returns SVG line markup, or empty string for zero length.
     * Used by: createArrowElement, interaction draw preview.
     */
    private buildArrowPath;
    /**
     * Builds bent SVG path markup for a knight-jump arrow.
     *
     * @param from - Start square.
     * @param to - End square.
     * @param color - Arrow stroke color.
     * @param markerId - Arrowhead marker id.
     * @param width - Optional stroke width.
     * @param elementId - Optional SVG element id.
     * @returns SVG path markup, or empty string for zero length.
     * Used by: createArrowElement, interaction draw preview.
     */
    private buildKnightArrowPath;
    /**
     * Returns center ratio coordinates for a square.
     *
     * @param square - Square name such as e4.
     * @returns Center coordinates in 8x8 ratio units.
     * Used by: external callers and coordinate helpers, tests.
     */
    squareToCoords(square: string): {
        x: number;
        y: number;
    };
    /**
     * Returns a snapshot of all stored arrows.
     *
     * @returns List of arrow records.
     * Used by: Gambix public API, tests.
     */
    getArrows(): ArrowRecord[];
    /**
     * Draws an arrow, auto-detecting knight jumps for bent paths.
     *
     * @param from - Start square.
     * @param to - End square.
     * @param color - Arrow color, defaults to active color.
     * @param persistent - Whether the arrow survives clearArrows.
     * @param width - Optional stroke width override.
     * @param markerId - Optional forced marker id.
     * @returns True when an arrow was created or updated.
     * Used by: Gambix.drawArrow, interaction end-draw flow, tests.
     */
    drawArrow(from: string, to: string, color?: string, persistent?: boolean, width?: number, markerId?: string): boolean;
    /**
     * Draws a forced bent arrow for knight moves.
     *
     * @param from - Start square.
     * @param to - End square.
     * @param color - Arrow color, defaults to active color.
     * @param persistent - Whether the arrow survives clearArrows.
     * @param width - Optional stroke width override.
     * @param markerId - Optional forced marker id.
     * @returns True when an arrow was created or updated.
     * Used by: Gambix API, tests.
     */
    drawKnightArrow(from: string, to: string, color?: string, persistent?: boolean, width?: number, markerId?: string): boolean;
    /**
     * Creates or updates one arrow element in state and SVG.
     *
     * @param from - Start square.
     * @param to - End square.
     * @param color - Arrow color.
     * @param persistent - Whether the arrow survives clearArrows.
     * @param isKnight - Whether to use the bent knight path.
     * @param width - Optional stroke width override.
     * @param forcedMarkerId - Optional forced marker id.
     * @returns True when an arrow was created or updated.
     * Used by: drawArrow, drawKnightArrow, rerenderAll, end-draw handler.
     */
    private createArrowElement;
    /**
     * Removes a single arrow by its endpoints.
     *
     * @param from - Start square.
     * @param to - End square.
     * @returns True when an arrow existed and was removed.
     * Used by: Gambix API, end-draw toggle flow, tests.
     */
    removeArrow(from: string, to: string): boolean;
    /**
     * Clears only non-persistent user arrows.
     *
     * @returns Nothing.
     * Used by: interaction clear-draw handler, Gambix API.
     */
    clearArrows(): void;
    /**
     * Clears all arrows including persistent ones.
     *
     * @returns Nothing.
     * Used by: rerenderAll, destroy, tests.
     */
    clearArrowsAll(): void;
    /**
     * Updates board orientation and re-renders all arrows.
     *
     * @param orientation - New orientation, white or black.
     * @returns Nothing.
     * Used by: Gambix orientation change, tests.
     */
    setOrientation(orientation: "white" | "black"): void;
    /**
     * Rebuilds all arrow elements for the current orientation.
     *
     * @returns Nothing.
     * Used by: setOrientation.
     */
    private rerenderAll;
    /**
     * Subscribes arrow drawing to interaction and key events.
     *
     * @returns Nothing.
     * Used by: Arrows constructor.
     */
    private bindEvents;
    /**
     * Removes the temporary in-progress drag preview arrow.
     *
     * @returns Nothing.
     * Used by: draw event handlers, clearArrows, disableDraw.
     */
    private removeTemp;
    /**
     * Re-attaches the SVG overlay to the board when detached.
     *
     * @returns Nothing.
     * Used by: createArrowElement.
     */
    private ensureAttached;
    /**
     * Re-attaches a detached SVG overlay to the board element.
     *
     * @returns Nothing.
     * Used by: Gambix lifecycle, tests.
     */
    reInit(): void;
    /**
     * Reloads colors and markers from the current drawing config.
     *
     * @returns Nothing.
     * Used by: Gambix config updates, tests.
     */
    refreshFromConfig(): void;
    /**
     * Enables interactive arrow drawing.
     *
     * @returns Nothing.
     * Used by: Gambix API, tests.
     */
    enableDraw(): void;
    /**
     * Disables drawing and clears the drag preview.
     *
     * @returns Nothing.
     * Used by: Gambix API, tests.
     */
    disableDraw(): void;
    /**
     * Unsubscribes events and removes the arrow overlay.
     *
     * @returns Nothing.
     * Used by: Gambix destroy, test teardown.
     */
    destroy(): void;
}
