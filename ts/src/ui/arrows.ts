import type {
  ArrowRecord,
  ChessEvents,
  DrawingConfig,
} from "../types/types.ts";
import type EventBus from "../events/event-bus.ts";
import {
  isValidSquare,
  isKnightJump,
  squareToCenterRatioCoords,
} from "../utils/coords.ts";

const LOCKED_ARROW_CLASS = "gambix-arrow-locked";
const USER_ARROW_CLASS = "gambix-arrow-user";

let arrowsUidCounter = 0;

/**
 * Clamps a requested arrow stroke width into the valid range.
 *
 * @param w - Requested stroke width.
 * @returns Clamped width between 0.5 and 10.
 * Used by: getHeadLength, Arrows marker and width resolution.
 */
function clampWidth(w: number): number {
  if (!Number.isFinite(w)) return 2.5;
  return Math.max(0.5, Math.min(10, Math.round(w * 10) / 10));
}

/**
 * Checks whether an arrow color is safe to inject into SVG markup.
 *
 * @param color - Requested arrow color.
 * @returns True when the color contains no markup-breaking characters.
 * Used by: createArrowElement.
 */
function isSafeColor(color: string): boolean {
  return (
    typeof color === "string" && color.length > 0 && !/["'<>`]/.test(color)
  );
}

/**
 * Computes the arrowhead length for a given stroke width.
 *
 * @param width - Arrow stroke width.
 * @returns Arrowhead length in board units.
 * Used by: buildArrowPath, buildKnightArrowPath, upsertMarker.
 */
function getHeadLength(width: number): number {
  return 0.3 + clampWidth(width) * 0.065;
}

/**
 * Computes the arrowhead width for a given stroke width.
 *
 * @param width - Arrow stroke width.
 * @returns Arrowhead width in board units.
 * Used by: upsertMarker.
 */
function getHeadWidth(width: number): number {
  return getHeadLength(width) * 1.4;
}

/**
 * Manages the SVG overlay for user-drawn and persistent analysis arrows.
 *
 * Used by: Gambix facade, interaction event flow, UI tests.
 */
export default class Arrows {
  public drawConfig: DrawingConfig;
  public activeColor!: string;
  public activeWidth!: number;
  public mainlineColor!: string;
  public mainlineWidth!: number;

  public keys = new Map<string, string>();
  public keysWidth = new Map<string, number>();
  public svg!: SVGSVGElement;
  public readonly markerBase: string;

  private eventBus: EventBus<ChessEvents>;
  private getBoardElement: () => HTMLElement | null;
  private arrowMap = new Map<string, ArrowRecord>();
  private markerWidths = new Map<string, number>();
  private activeButtonKey = "";
  private tempGroup: SVGGElement | null = null;
  private orientation: "white" | "black" = "white";
  private unsubs: Array<() => void> = [];

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
  constructor(
    drawConfig: DrawingConfig,
    eventBus: EventBus<ChessEvents>,
    orientation: "white" | "black" = "white",
    getBoardElement?: () => HTMLElement | null,
  ) {
    this.drawConfig = drawConfig;
    this.eventBus = eventBus;
    this.orientation = orientation;
    this.getBoardElement = getBoardElement ?? (() => null);
    this.markerBase = `gambix-arrow-head-${++arrowsUidCounter}`;

    this.readConfig();
    this.initSvg();
    this.ensureMarkers();
    this.bindEvents();
  }

  // ==========================================
  // Configuration & Initialization
  // ==========================================

  /**
   * Reads drawing config into active colors, widths and button maps.
   *
   * @returns Nothing.
   * Used by: Arrows constructor, refreshFromConfig.
   */
  private readConfig(): void {
    const fallbackColor =
      this.drawConfig.lineColor ??
      this.drawConfig.buttons?.[0]?.color ??
      "rgba(255, 170, 0, 0.8)";
    const fallbackWidth =
      this.drawConfig.lineWidth ??
      this.drawConfig.buttons?.[0]?.lineWidth ??
      2.5;

    this.drawConfig.lineColor = this.drawConfig.lineColor ?? fallbackColor;
    this.drawConfig.lineWidth = this.drawConfig.lineWidth ?? fallbackWidth;

    this.activeColor = this.drawConfig.lineColor;
    this.activeWidth = this.drawConfig.lineWidth;
    this.mainlineColor = `${this.drawConfig.lineColor}`;
    this.mainlineWidth = this.drawConfig.lineWidth;

    this.keys.clear();
    this.keysWidth.clear();

    for (const btn of this.drawConfig.buttons || []) {
      if (!btn.button) continue;
      const key = btn.button.toLowerCase();
      this.keys.set(key, btn.color);
      if (btn.lineWidth != null) {
        this.keysWidth.set(key, btn.lineWidth);
      }
    }

    const mainBtn = this.drawConfig.buttons?.find(
      (b) => b.button?.toLowerCase() === "maincolor",
    );

    this.activeButtonKey = (
      mainBtn?.button ??
      this.drawConfig.buttons?.[0]?.button ??
      "maincolor"
    ).toLowerCase();
  }

  /**
   * Creates the SVG overlay element and attaches it to the board.
   *
   * @returns Nothing.
   * Used by: Arrows constructor.
   */
  private initSvg(): void {
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("viewBox", "0 0 8 8");
    this.svg.setAttribute("class", "arrows-overlay");
    this.svg.setAttribute("preserveAspectRatio", "none");
    this.svg.style.pointerEvents = "none";
    this.svg.innerHTML = "<defs></defs>";

    const board = this.getBoardElement();
    if (board) {
      this.svg.style.position = "absolute";
      this.svg.style.inset = "0";
      this.svg.style.zIndex = "3";
      this.svg.style.width = "100%";
      this.svg.style.height = "100%";
      board.appendChild(this.svg);
    }
  }

  // ==========================================
  // Markers Management
  // ==========================================

  /**
   * Returns the SVG defs element, creating it when missing.
   *
   * @returns The SVG defs element.
   * Used by: upsertMarker.
   */
  private getDefs(): SVGDefsElement {
    let defs = this.svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      this.svg.insertBefore(defs, this.svg.firstChild);
    }
    return defs;
  }

  /**
   * Creates or updates an SVG arrowhead marker for a width.
   *
   * @param markerId - Marker element id to create or update.
   * @param width - Requested stroke width.
   * @returns The marker id.
   * Used by: markerForButton, markerForWidth.
   */
  private upsertMarker(markerId: string, width: number): string {
    const w = clampWidth(width);
    const defs = this.getDefs();
    let marker = defs.querySelector(
      `#${CSS.escape(markerId)}`,
    ) as SVGMarkerElement | null;

    if (!marker) {
      marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
      marker.setAttribute("id", markerId);
      marker.setAttribute("viewBox", "0 0 10 10");
      marker.setAttribute("refX", "0");
      marker.setAttribute("refY", "5");
      marker.setAttribute("markerUnits", "strokeWidth");
      marker.setAttribute("orient", "auto");
      marker.innerHTML =
        '<path d="M 0 0 L 10 5 L 0 10 Z" fill="context-stroke"/>';
      defs.appendChild(marker);
    }

    const stroke = w / 10;
    marker.setAttribute(
      "markerWidth",
      `${Math.max(0.6, Math.min(15, getHeadLength(w) / stroke))}`,
    );
    marker.setAttribute(
      "markerHeight",
      `${Math.max(0.6, Math.min(15, getHeadWidth(w) / stroke))}`,
    );
    this.markerWidths.set(markerId, w);

    return markerId;
  }

  /**
   * Resolves the marker id bound to a mouse button key.
   *
   * @param buttonKey - Configured button name.
   * @returns The marker id for that button.
   * Used by: ensureMarkers, resolveMarkerAndWidth, draw preview flow.
   */
  private markerForButton(buttonKey: string): string {
    const sanitized =
      buttonKey.toLowerCase().replace(/[^a-z0-9_-]/g, "_") || "btn";
    const markerId = `${this.markerBase}-${sanitized}`;
    const width =
      this.keysWidth.get(buttonKey.toLowerCase()) ??
      this.drawConfig.lineWidth ??
      2.5;
    return this.upsertMarker(markerId, width);
  }

  /**
   * Resolves the marker id for an explicit stroke width.
   *
   * @param width - Requested stroke width.
   * @returns The marker id for that width.
   * Used by: resolveMarkerAndWidth.
   */
  private markerForWidth(width: number): string {
    const w = clampWidth(width);
    const markerId = `${this.markerBase}-w-${String(w).replace(".", "_")}`;
    return this.upsertMarker(markerId, w);
  }

  /**
   * Ensures arrowhead markers exist for all configured buttons.
   *
   * @returns Nothing.
   * Used by: Arrows constructor, refreshFromConfig, rerenderAll.
   */
  private ensureMarkers(): void {
    if (!this.svg) return;
    for (const btn of this.drawConfig.buttons || []) {
      if (btn.button) this.markerForButton(btn.button);
    }
    this.markerForButton(this.activeButtonKey || "maincolor");
  }

  /**
   * Resolves the marker and effective width for a color and width.
   *
   * @param color - Requested arrow color.
   * @param width - Optional explicit width override.
   * @returns The resolved marker id and width.
   * Used by: createArrowElement.
   */
  private resolveMarkerAndWidth(
    color: string,
    width?: number,
  ): { markerId: string; width: number } {
    if (width != null) {
      const w = clampWidth(width);
      return { markerId: this.markerForWidth(w), width: w };
    }
    if (color === this.activeColor) {
      const markerId = this.markerForButton(this.activeButtonKey);
      return {
        markerId,
        width: this.markerWidths.get(markerId) ?? this.activeWidth,
      };
    }
    const matchingBtn = this.drawConfig.buttons?.find((b) => b.color === color);
    if (matchingBtn?.button) {
      const markerId = this.markerForButton(matchingBtn.button);
      return {
        markerId,
        width:
          this.markerWidths.get(markerId) ?? this.drawConfig.lineWidth ?? 2.5,
      };
    }
    const fallbackW = this.drawConfig.lineWidth ?? 2.5;
    return { markerId: this.markerForWidth(fallbackW), width: fallbackW };
  }

  // ==========================================
  // Arrow Geometry & SVG Path Building
  // ==========================================

  /**
   * Converts a square name to its center ratio coordinates.
   *
   * @param sq - Square name such as e4.
   * @returns Center coordinates in 8x8 ratio units.
   * Used by: buildArrowPath, buildKnightArrowPath, squareToCoords.
   */
  private getSquarePoint(sq: string): { x: number; y: number } {
    return squareToCenterRatioCoords(sq, this.orientation);
  }

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
  private buildArrowPath(
    from: string,
    to: string,
    color: string,
    markerId: string,
    width?: number,
    elementId?: string,
  ): string {
    const p1 = this.getSquarePoint(from);
    const p2 = this.getSquarePoint(to);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) return "";

    const effWidth = clampWidth(width ?? this.activeWidth);
    const stroke = effWidth / 10;
    const headLen = getHeadLength(effWidth);
    const startOffset = 0.3;
    const endOffset = headLen * 0.9;

    const sx = p1.x + (dx / dist) * startOffset;
    const sy = p1.y + (dy / dist) * startOffset;
    const ex = p2.x - (dx / dist) * endOffset;
    const ey = p2.y - (dy / dist) * endOffset;
    const idAttr = elementId ? ` id="${elementId}"` : "";

    return `<line stroke="${color}" stroke-width="${stroke}" fill="none"${idAttr} marker-end="url(#${markerId})" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" />`;
  }

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
  private buildKnightArrowPath(
    from: string,
    to: string,
    color: string,
    markerId: string,
    width?: number,
    elementId?: string,
  ): string {
    const p1 = this.getSquarePoint(from);
    const p2 = this.getSquarePoint(to);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return "";

    const effWidth = clampWidth(width ?? this.activeWidth);
    const stroke = effWidth / 10;
    const headLen = getHeadLength(effWidth);

    const mx = Math.abs(dx) > Math.abs(dy) ? p2.x : p1.x;
    const my = Math.abs(dx) > Math.abs(dy) ? p1.y : p2.y;

    const dx1 = mx - p1.x;
    const dy1 = my - p1.y;
    const dx2 = p2.x - mx;
    const dy2 = p2.y - my;
    const d1 = Math.hypot(dx1, dy1);
    const d2 = Math.hypot(dx2, dy2);

    const startOffset = 0.3;
    const endOffset = headLen * 0.9;

    const sx = d1 > 0 ? p1.x + (dx1 / d1) * startOffset : p1.x;
    const sy = d1 > 0 ? p1.y + (dy1 / d1) * startOffset : p1.y;
    const ex = d2 > 0 ? p2.x - (dx2 / d2) * endOffset : p2.x;
    const ey = d2 > 0 ? p2.y - (dy2 / d2) * endOffset : p2.y;

    let qx = mx;
    let qy = my;
    if (dy1 === 0 && dx1 !== 0) qy = my + (dy2 > 0 ? 1 : -1) * 0.15;
    else if (dx1 === 0 && dy1 !== 0) qx = mx + (dx2 > 0 ? 1 : -1) * 0.15;

    const idAttr = elementId ? ` id="${elementId}"` : "";
    return `<path stroke="${color}" stroke-width="${stroke}" fill="none"${idAttr} marker-end="url(#${markerId})" d="M ${sx} ${sy} L ${mx} ${my} Q ${qx} ${qy}, ${ex} ${ey}" />`;
  }

  // ==========================================
  // Public Arrow Operations
  // ==========================================

  /**
   * Returns center ratio coordinates for a square.
   *
   * @param square - Square name such as e4.
   * @returns Center coordinates in 8x8 ratio units.
   * Used by: external callers and coordinate helpers, tests.
   */
  public squareToCoords(square: string): { x: number; y: number } {
    return this.getSquarePoint(square);
  }

  /**
   * Returns a snapshot of all stored arrows.
   *
   * @returns List of arrow records.
   * Used by: Gambix public API, tests.
   */
  public getArrows(): ArrowRecord[] {
    return [...this.arrowMap.values()];
  }

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
  public drawArrow(
    from: string,
    to: string,
    color: string = this.activeColor,
    persistent = false,
    width?: number,
    markerId?: string,
  ): boolean {
    const isKnight =
      isValidSquare(from) && isValidSquare(to) && isKnightJump(from, to);
    return this.createArrowElement(
      from,
      to,
      color,
      persistent,
      isKnight,
      width,
      markerId,
    );
  }

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
  public drawKnightArrow(
    from: string,
    to: string,
    color: string = this.activeColor,
    persistent = false,
    width?: number,
    markerId?: string,
  ): boolean {
    return this.createArrowElement(
      from,
      to,
      color,
      persistent,
      true,
      width,
      markerId,
    );
  }

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
  private createArrowElement(
    from: string,
    to: string,
    color: string,
    persistent: boolean,
    isKnight: boolean,
    width?: number,
    forcedMarkerId?: string,
  ): boolean {
    if (!isValidSquare(from) || !isValidSquare(to) || from === to) return false;
    if (!isSafeColor(color)) return false;
    this.ensureAttached();

    const key = `${from}->${to}`;
    const elemId = `${from}-${to}`;

    let effMarkerId: string;
    let effWidth: number;
    if (forcedMarkerId) {
      effMarkerId = forcedMarkerId;
      effWidth =
        width ??
        this.markerWidths.get(forcedMarkerId) ??
        this.resolveMarkerAndWidth(color).width;
    } else {
      const resolved = this.resolveMarkerAndWidth(color, width);
      effMarkerId = resolved.markerId;
      effWidth = resolved.width;
    }

    const existing = this.arrowMap.get(key);
    if (existing) {
      if (existing.color === color) return false;
      existing.color = color;
      existing.markerId = effMarkerId;
      existing.width = effWidth;
      existing.persistent = existing.persistent || persistent;

      const el = this.svg.querySelector(
        `#${CSS.escape(elemId)}`,
      ) as SVGElement | null;
      if (el) {
        el.setAttribute("stroke", color);
        el.setAttribute("marker-end", `url(#${effMarkerId})`);
        el.setAttribute("stroke-width", `${effWidth / 10}`);
      }
      return true;
    }

    const markup = isKnight
      ? this.buildKnightArrowPath(
          from,
          to,
          color,
          effMarkerId,
          effWidth,
          elemId,
        )
      : this.buildArrowPath(from, to, color, effMarkerId, effWidth, elemId);
    if (!markup) return false;

    this.arrowMap.set(key, {
      from,
      to,
      color,
      persistent,
      markerId: effMarkerId,
      width: effWidth,
    });

    this.svg.insertAdjacentHTML("beforeend", markup);
    const el = this.svg.querySelector(
      `#${CSS.escape(elemId)}`,
    ) as HTMLElement | null;
    if (el) {
      if (persistent) {
        el.dataset.persistent = "true";
        el.classList.add(LOCKED_ARROW_CLASS);
      } else {
        el.classList.add(USER_ARROW_CLASS);
      }
    }

    if (persistent) {
      this.eventBus.emit("drawing:arrow-added", {
        from,
        to,
        color,
        persistent,
      });
    }
    return true;
  }

  /**
   * Removes a single arrow by its endpoints.
   *
   * @param from - Start square.
   * @param to - End square.
   * @returns True when an arrow existed and was removed.
   * Used by: Gambix API, end-draw toggle flow, tests.
   */
  public removeArrow(from: string, to: string): boolean {
    const key = `${from}->${to}`;
    const existed = this.arrowMap.delete(key);
    this.svg.querySelector(`#${CSS.escape(`${from}-${to}`)}`)?.remove();
    return existed;
  }

  /**
   * Clears only non-persistent user arrows.
   *
   * @returns Nothing.
   * Used by: interaction clear-draw handler, Gambix API.
   */
  public clearArrows(): void {
    for (const [key, record] of [...this.arrowMap]) {
      if (record.persistent) continue;
      this.svg
        .querySelector(`#${CSS.escape(`${record.from}-${record.to}`)}`)
        ?.remove();
      this.arrowMap.delete(key);
    }
    this.removeTemp();
  }

  /**
   * Clears all arrows including persistent ones.
   *
   * @returns Nothing.
   * Used by: rerenderAll, destroy, tests.
   */
  public clearArrowsAll(): void {
    this.arrowMap.clear();
    this.svg
      .querySelectorAll(":scope > line, :scope > path, :scope > g")
      .forEach((el) => el.remove());
    this.removeTemp();
  }

  /**
   * Updates board orientation and re-renders all arrows.
   *
   * @param orientation - New orientation, white or black.
   * @returns Nothing.
   * Used by: Gambix orientation change, tests.
   */
  public setOrientation(orientation: "white" | "black"): void {
    if (this.orientation === orientation) return;
    this.orientation = orientation;
    this.rerenderAll();
  }

  /**
   * Rebuilds all arrow elements for the current orientation.
   *
   * @returns Nothing.
   * Used by: setOrientation.
   */
  private rerenderAll(): void {
    const snapshot = [...this.arrowMap.values()];
    this.ensureMarkers();
    this.clearArrowsAll();
    for (const a of snapshot) {
      const isKnight = isKnightJump(a.from, a.to);
      this.createArrowElement(
        a.from,
        a.to,
        a.color,
        a.persistent,
        isKnight,
        a.width,
        a.markerId,
      );
    }
  }

  // ==========================================
  // Event Binding & Helpers
  // ==========================================

  /**
   * Subscribes arrow drawing to interaction and key events.
   *
   * @returns Nothing.
   * Used by: Arrows constructor.
   */
  private bindEvents(): void {
    const on = <T extends keyof ChessEvents>(
      event: T,
      handler: (p: ChessEvents[T]) => void,
    ): void => {
      this.unsubs.push(this.eventBus.on(event, handler));
    };

    on("interaction:start-draw", () => {
      if (this.drawConfig.enabled) this.removeTemp();
    });

    on("interaction:draw-move", (payload) => {
      if (!this.drawConfig.enabled) return;
      this.removeTemp();
      if (payload.from && payload.to && payload.from !== payload.to) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.svg.appendChild(g);
        const marker = this.markerForButton(this.activeButtonKey);
        g.innerHTML = isKnightJump(payload.from, payload.to)
          ? this.buildKnightArrowPath(
              payload.from,
              payload.to,
              this.activeColor,
              marker,
            )
          : this.buildArrowPath(
              payload.from,
              payload.to,
              this.activeColor,
              marker,
            );
        this.tempGroup = g;
      }
    });

    on("interaction:end-draw", (payload) => {
      if (!this.drawConfig.enabled) return;
      this.removeTemp();
      if (payload.from && payload.to && payload.from !== payload.to) {
        const key = `${payload.from}->${payload.to}`;
        const existing = this.arrowMap.get(key);
        if (existing) {
          if (existing.persistent) return;
          this.removeArrow(payload.from, payload.to);
          this.eventBus.emit("drawing:arrow-removed", {
            from: payload.from,
            to: payload.to,
          });
        } else {
          const isKnight = isKnightJump(payload.from, payload.to);
          const created = this.createArrowElement(
            payload.from,
            payload.to,
            this.activeColor,
            false,
            isKnight,
          );
          if (created) {
            this.eventBus.emit("drawing:arrow-added", {
              from: payload.from,
              to: payload.to,
              color: this.activeColor,
            });
          }
        }
      }
    });

    on("interaction:clear-draw", () => {
      this.clearArrows();
      this.eventBus.emit("drawing:arrows-cleared", {});
    });

    on("interaction:key-pressed", (key: string) => {
      const lower = key.toLowerCase();
      if (this.keys.has(lower)) {
        this.activeButtonKey = lower;
        this.activeColor = this.keys.get(lower)!;
      }
      if (this.keysWidth.has(lower)) {
        this.activeWidth = this.keysWidth.get(lower)!;
        this.markerForButton(this.activeButtonKey);
      }
    });

    on("interaction:key-up", () => {
      this.activeColor = this.mainlineColor;
      this.activeWidth = this.mainlineWidth;
      const mainBtn = this.drawConfig.buttons?.find(
        (b) => b.button?.toLowerCase() === "maincolor",
      );
      this.activeButtonKey = (
        mainBtn?.button ??
        this.drawConfig.buttons?.[0]?.button ??
        "maincolor"
      ).toLowerCase();
      this.markerForButton(this.activeButtonKey);
    });
  }

  /**
   * Removes the temporary in-progress drag preview arrow.
   *
   * @returns Nothing.
   * Used by: draw event handlers, clearArrows, disableDraw.
   */
  private removeTemp(): void {
    if (this.tempGroup) {
      this.tempGroup.remove();
      this.tempGroup = null;
    }
  }

  /**
   * Re-attaches the SVG overlay to the board when detached.
   *
   * @returns Nothing.
   * Used by: createArrowElement.
   */
  private ensureAttached(): void {
    const board = this.getBoardElement();
    if (board && !board.contains(this.svg)) board.appendChild(this.svg);
  }

  /**
   * Re-attaches a detached SVG overlay to the board element.
   *
   * @returns Nothing.
   * Used by: Gambix lifecycle, tests.
   */
  public reInit(): void {
    const board = this.getBoardElement();
    if (!board || board.contains(this.svg)) return;
    board.appendChild(this.svg);
  }

  /**
   * Reloads colors and markers from the current drawing config.
   *
   * @returns Nothing.
   * Used by: Gambix config updates, tests.
   */
  public refreshFromConfig(): void {
    this.readConfig();
    this.ensureMarkers();
  }

  /**
   * Enables interactive arrow drawing.
   *
   * @returns Nothing.
   * Used by: Gambix API, tests.
   */
  public enableDraw(): void {
    this.drawConfig.enabled = true;
  }

  /**
   * Disables drawing and clears the drag preview.
   *
   * @returns Nothing.
   * Used by: Gambix API, tests.
   */
  public disableDraw(): void {
    this.drawConfig.enabled = false;
    this.removeTemp();
  }

  /**
   * Unsubscribes events and removes the arrow overlay.
   *
   * @returns Nothing.
   * Used by: Gambix destroy, test teardown.
   */
  public destroy(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.clearArrowsAll();
    this.markerWidths.clear();
    this.svg.remove();
  }
}
