import EventBus from "../events/event-bus.ts";
import type {
  ChessEvents,
  HighlightRecord,
  HighlightsConfig,
  HighlightStyle,
} from "../types/types.ts";

const LOCKED_HIGHLIGHT_CLASS = "gambix-highlight-locked";
const USER_HIGHLIGHT_CLASS = "gambix-highlight-user";

const SELECTED_CLASS = "highlight-selected-square";
const LASTMOVE_START_CLASS = "highlight-lastmove-start";
const LASTMOVE_END_CLASS = "highlight-lastmove-end";
const CHECK_CLASS = "highlight-check";
const MATE_WINNER_CLASS = "highlight-checkmate-winner";
const MATE_LOSER_CLASS = "highlight-checkmate-loser";
const SQUARE_CLASS = "highlight-square";
const LEGAL_DOT_CLASS = "highlight-legalmove-dot";
const LEGAL_RING_CLASS = "highlight-legalmove-ring";

const SQUARE_RE = /^[a-h][1-8]$/;

/**
 * Manages square highlights for selection, moves, check and user marks.
 *
 * Used by: Gambix facade, interaction event flow, UI tests.
 */
class Highlights {
  public highlightsConfig: HighlightsConfig;
  public keys: Map<string, string> = new Map();
  public activeColor: string;
  public mainColor: string;

  private eventBus: EventBus<ChessEvents>;
  private root: HTMLElement;
  private getBoardSize: () => number;
  private hasPiece: (square: string) => boolean;
  private unsubs: Array<() => void> = [];
  private dotRatio = 0.16;
  private ringRatio = 0.053;

  private highlightMap = new Map<string, HighlightRecord>();
  private lastMove: { from: string; to: string } | null = null;
  private checkSquare: string | null = null;
  private mateSquares: { winner: string; loser: string } | null = null;
  private selectedSquare: string | null = null;
  private legalMoves = new Set<string>();

  /**
   * Creates highlight state and wires it to config and events.
   *
   * @param eventBus - Shared chess event bus.
   * @param config - Highlight colors and behavior flags.
   * @param root - Board root element for queries and CSS vars.
   * @param getBoardSize - Returns the current board size in px.
   * @param hasPiece - Optional piece-presence checker per square.
   * @returns Nothing.
   * Used by: Gambix setup, test fixtures.
   */
  constructor(
    eventBus: EventBus<ChessEvents>,
    config: HighlightsConfig,
    root: HTMLElement,
    getBoardSize: () => number,
    hasPiece?: (square: string) => boolean,
  ) {
    this.eventBus = eventBus;
    this.highlightsConfig = config;
    this.root = root;
    this.getBoardSize = getBoardSize;
    this.hasPiece =
      hasPiece ??
      ((sq: string) =>
        !!this.root.querySelector(`.piece[data-square="${CSS.escape(sq)}"]`));
    this.mainColor =
      config.rightClick.find((c) => c.button === "mainColor")?.color || "";
    this.activeColor = this.mainColor;
    config.rightClick.forEach((item) => {
      if (item.button && item.button !== "mainColor")
        this.keys.set(item.button.toLowerCase(), item.color);
    });
    this.initRatios();
    this.setCSSVariables();
    this.bindEvents();
  }

  /**
   * Finds the DOM element for a board square.
   *
   * @param square - Square name such as e4.
   * @returns The square element, or null when invalid or missing.
   * Used by: highlight, last-move, check and legal-move methods.
   */
  private squareEl(square: string): HTMLElement | null {
    if (!SQUARE_RE.test(square)) return null;
    return this.root.querySelector(
      `.square[data-square="${square}"]`,
    ) as HTMLElement | null;
  }

  /**
   * Builds the internal map key for a highlight record.
   *
   * @param kind - Highlight kind such as user or lastmove.
   * @param square - Square name.
   * @returns Composite map key.
   * Used by: track, untrack.
   */
  private mapKey(kind: string, square: string): string {
    return `${kind}:${square}`;
  }

  /**
   * Stores a highlight record in the internal map.
   *
   * @param record - Highlight record to store.
   * @returns Nothing.
   * Used by: all highlight setters.
   */
  private track(record: HighlightRecord): void {
    this.highlightMap.set(this.mapKey(record.kind, record.square), record);
  }

  /**
   * Removes a highlight record from the internal map.
   *
   * @param kind - Highlight kind.
   * @param square - Square name.
   * @returns Nothing.
   * Used by: all highlight clear methods.
   */
  private untrack(kind: string, square: string): void {
    this.highlightMap.delete(this.mapKey(kind, square));
  }

  /**
   * Returns a snapshot of all tracked highlight records.
   *
   * @returns List of highlight records.
   * Used by: Gambix public API, tests.
   */
  public getHighlights(): HighlightRecord[] {
    return [...this.highlightMap.values()];
  }

  /**
   * Returns the current square size in px.
   *
   * @returns Board size divided by 8, with fallback.
   * Used by: initRatios, setCSSVariables, setLegalMoveRatios.
   */
  private currentSquare(): number {
    return this.getBoardSize() / 8 || 75;
  }

  /**
   * Initializes legal-move dot and ring ratios from config.
   *
   * @returns Nothing.
   * Used by: Highlights constructor.
   */
  private initRatios(): void {
    const square = this.currentSquare();
    const cfgDot = this.highlightsConfig.legalMoves.dotSize;
    const cfgRing = this.highlightsConfig.legalMoves.ringSize;

    this.dotRatio =
      cfgDot != null ? (cfgDot > 1 ? cfgDot / square : cfgDot) : 0.16;
    this.ringRatio =
      cfgRing != null ? (cfgRing > 1 ? cfgRing / square : cfgRing) : 0.053;

    this.dotRatio = Math.max(0.02, Math.min(0.45, this.dotRatio));
    this.ringRatio = Math.max(0.01, Math.min(0.2, this.ringRatio));
  }

  /**
   * Resolves the CSS background for a highlight style.
   *
   * @param style - Highlight style with type, color and enable flag.
   * @returns CSS background value or transparent when disabled.
   * Used by: setCSSVariables.
   */
  private resolveHighlightBackground(style: HighlightStyle): string {
    if (!style.enable) return "transparent";
    if (style.type === "blink")
      return `radial-gradient(circle at center, ${style.color} 0%, ${style.color} 45%, rgba(0, 0, 0, 0) 75%)`;
    return style.color;
  }

  /**
   * Writes highlight colors and sizes to CSS variables.
   *
   * @returns Nothing.
   * Used by: constructor, updateScale, setLegalMoveRatios, refreshFromConfig.
   */
  private setCSSVariables(): void {
    const root = this.root;
    root.style.setProperty(
      "--highlight-lastmove-bg",
      this.resolveHighlightBackground(this.highlightsConfig.lastMove),
    );
    root.style.setProperty(
      "--highlight-selected-bg",
      this.resolveHighlightBackground(this.highlightsConfig.selectedPiece),
    );
    root.style.setProperty(
      "--highlight-check-bg",
      this.resolveHighlightBackground(this.highlightsConfig.inCheck),
    );
    root.style.setProperty(
      "--highlight-checkmate-winner-bg",
      this.resolveHighlightBackground(this.highlightsConfig.checkmate.winner),
    );
    root.style.setProperty(
      "--highlight-checkmate-loser-bg",
      this.resolveHighlightBackground(this.highlightsConfig.checkmate.loser),
    );
    root.style.setProperty(
      "--highlight-legalmove-color",
      this.highlightsConfig.legalMoves.color,
    );
    const square = this.currentSquare();
    root.style.setProperty(
      "--highlight-legalmove-dot-size",
      `${square * this.dotRatio}px`,
    );
    root.style.setProperty(
      "--highlight-legalmove-ring-size",
      `${square * this.ringRatio}px`,
    );
    root.style.setProperty("--highlight-color", this.activeColor);
  }

  /**
   * Updates the board-size dependent CSS variables.
   *
   * @param boardSize - New board size in px.
   * @returns Nothing.
   * Used by: Gambix resize flow, tests.
   */
  public updateScale(boardSize: number): void {
    if (boardSize) {
      const size = boardSize;
      this.getBoardSize = () => size;
    }
    this.setCSSVariables();
  }

  /**
   * Sets legal-move dot and ring ratios with clamping.
   *
   * @param dotRatio - Dot size ratio or absolute px value.
   * @param ringRatio - Ring size ratio or absolute px value.
   * @returns Nothing.
   * Used by: Gambix API, tests.
   */
  public setLegalMoveRatios(dotRatio: number, ringRatio: number): void {
    const square = this.currentSquare();
    if (dotRatio != null)
      this.dotRatio = Math.max(
        0.02,
        Math.min(0.45, dotRatio > 1 ? dotRatio / square : dotRatio),
      );
    if (ringRatio != null)
      this.ringRatio = Math.max(
        0.01,
        Math.min(0.2, ringRatio > 1 ? ringRatio / square : ringRatio),
      );
    this.highlightsConfig.legalMoves.dotSize = this.dotRatio;
    this.highlightsConfig.legalMoves.ringSize = this.ringRatio;
    this.setCSSVariables();
  }

  /**
   * Subscribes highlights to selection and drawing events.
   *
   * @returns Nothing.
   * Used by: Highlights constructor.
   */
  private bindEvents(): void {
    this.unsubs.push(
      this.eventBus.on("interaction:square-selected", (payload) => {
        this.clearSelectionHighlights();
        this.highlightSelectedSquare(payload.square);
      }),
    );

    this.unsubs.push(
      this.eventBus.on("interaction:move-requested", () => {
        this.clearSelectionHighlights();
      }),
    );
    this.unsubs.push(
      this.eventBus.on("interaction:drag-end", () => {
        this.clearSelectionHighlights();
      }),
    );
    this.unsubs.push(
      this.eventBus.on("board:fen-changed", () => {
        this.clearSelectionHighlights();
      }),
    );
    this.unsubs.push(
      this.eventBus.on("interaction:highlight-square", (square: string) => {
        if (!this.isEnabledState()) return;
        this.highlightSquare(square);
      }),
    );
    this.unsubs.push(
      this.eventBus.on("interaction:clear-draw", () => {
        this.clearManualHighlights();
        this.eventBus.emit("drawing:highlights-cleared", {});
      }),
    );
    this.unsubs.push(
      this.eventBus.on("interaction:key-pressed", (key: string) => {
        const lowerKey = key.toLowerCase();
        if (this.keys.has(lowerKey)) {
          this.activeColor = this.keys.get(lowerKey)!;
          this.root.style.setProperty("--highlight-color", this.activeColor);
        }
      }),
    );
    this.unsubs.push(
      this.eventBus.on("interaction:key-up", () => {
        this.activeColor = this.mainColor;
        this.root.style.setProperty("--highlight-color", this.activeColor);
      }),
    );
  }

  /**
   * Reloads colors and key bindings from the current config.
   *
   * @returns Nothing.
   * Used by: Gambix config updates, tests.
   */
  public refreshFromConfig(): void {
    this.mainColor =
      this.highlightsConfig.rightClick.find((c) => c.button === "mainColor")
        ?.color || "";
    this.activeColor = this.mainColor;
    this.keys.clear();
    this.highlightsConfig.rightClick.forEach((item) => {
      if (item.button && item.button !== "mainColor")
        this.keys.set(item.button.toLowerCase(), item.color);
    });
    this.setCSSVariables();
  }

  /**
   * Unsubscribes events and clears highlight state.
   *
   * @returns Nothing.
   * Used by: Gambix destroy, test teardown.
   */
  public destroy(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.clearHighlightsAll();
  }

  /**
   * Highlights the selected square when it holds a piece.
   *
   * @param square - Square name to select.
   * @returns Nothing.
   * Used by: square-selected event handler, Gambix API.
   */
  highlightSelectedSquare(square: string): void {
    if (!square || !this.hasPiece(square)) return;
    const el = this.squareEl(square);
    if (!el) return;
    el.classList.add(SELECTED_CLASS);
    this.selectedSquare = square;
    this.track({ square, kind: "selected" });
  }

  /**
   * Clears the selected-square highlight.
   *
   * @returns Nothing.
   * Used by: selection and move event handlers.
   */
  private clearSelectionHighlights(): void {
    if (this.selectedSquare) {
      this.squareEl(this.selectedSquare)?.classList.remove(SELECTED_CLASS);
      this.untrack("selected", this.selectedSquare);
      this.selectedSquare = null;
    }

    this.root
      .querySelectorAll(`.${SELECTED_CLASS}`)
      .forEach((el) => el.classList.remove(SELECTED_CLASS));
  }

  /**
   * Reports whether manual highlighting is enabled.
   *
   * @returns True when highlighting is enabled.
   * Used by: highlightSquare, highlight-square event handler.
   */
  public isEnabledState(): boolean {
    return !!this.highlightsConfig.enabled;
  }

  /**
   * Enables or disables manual highlighting.
   *
   * @param v - True to enable, false to disable.
   * @returns Nothing.
   * Used by: Gambix API, tests.
   */
  public setEnabledState(v: boolean): void {
    this.highlightsConfig.enabled = v;
  }

  /**
   * Toggles a user or locked highlight on a square.
   *
   * @param square - Square name to highlight.
   * @param persistent - True for a locked highlight surviving clears.
   * @returns Nothing.
   * Used by: highlight-square event, highlightSquarePersistent, tests.
   */
  highlightSquare(square: string, persistent = false): void {
    if (!persistent && !this.isEnabledState()) return;
    const el = this.squareEl(square);
    if (!el) return;
    let active = false;
    if (el.classList.contains(SQUARE_CLASS)) {
      if (
        (el.dataset.persistent === "true" ||
          el.classList.contains(LOCKED_HIGHLIGHT_CLASS)) &&
        !persistent
      )
        return;
      if (el.style.getPropertyValue("--highlight-color") === this.activeColor) {
        if (el.classList.contains(LOCKED_HIGHLIGHT_CLASS) && !persistent)
          return;
        el.classList.remove(
          SQUARE_CLASS,
          LOCKED_HIGHLIGHT_CLASS,
          USER_HIGHLIGHT_CLASS,
        );
        delete el.dataset.persistent;
        this.untrack("user", square);
        this.untrack("locked", square);
      } else {
        if (
          el.classList.contains(LOCKED_HIGHLIGHT_CLASS) ||
          el.dataset.persistent === "true"
        )
          return;
        el.style.setProperty("--highlight-color", this.activeColor);
        if (persistent) {
          el.dataset.persistent = "true";
          el.classList.add(LOCKED_HIGHLIGHT_CLASS);
          el.classList.remove(USER_HIGHLIGHT_CLASS);
          this.track({ square, kind: "locked", color: this.activeColor });
        } else {
          el.classList.add(USER_HIGHLIGHT_CLASS);
          this.track({ square, kind: "user", color: this.activeColor });
        }
        active = true;
      }
    } else {
      el.style.setProperty("--highlight-color", this.activeColor);
      el.classList.add(SQUARE_CLASS);
      if (persistent) {
        el.dataset.persistent = "true";
        el.classList.add(LOCKED_HIGHLIGHT_CLASS);
        this.track({ square, kind: "locked", color: this.activeColor });
      } else {
        el.classList.add(USER_HIGHLIGHT_CLASS);
        this.track({ square, kind: "user", color: this.activeColor });
      }
      active = true;
    }
    this.eventBus.emit("drawing:highlight-toggled", {
      square,
      color: this.activeColor,
      active,
      persistent,
    });
  }

  /**
   * Applies a persistent highlight with an optional color override.
   *
   * @param square - Square name to highlight.
   * @param color - Optional color replacing the active color.
   * @returns Nothing.
   * Used by: Gambix API, tests.
   */
  highlightSquarePersistent(square: string, color?: string): void {
    if (color) {
      const prev = this.activeColor;
      this.activeColor = color;
      this.root.style.setProperty("--highlight-color", color);
      this.highlightSquare(square, true);
      this.activeColor = prev;
      this.root.style.setProperty("--highlight-color", this.activeColor);
      return;
    }
    this.highlightSquare(square, true);
  }

  /**
   * Marks the last-move start and end squares.
   *
   * @param from - Start square.
   * @param to - End square.
   * @returns Nothing.
   * Used by: Gambix move flow, tests.
   */
  public setLastMove(from: string, to: string): void {
    this.clearLastMove();
    if (!this.highlightsConfig.lastMove.enable) return;
    if (!SQUARE_RE.test(from) || !SQUARE_RE.test(to)) return;
    this.lastMove = { from, to };
    if (from === to) {
      this.squareEl(from)?.classList.add(LASTMOVE_START_CLASS);
      this.track({ square: from, kind: "lastmove" });
      return;
    }
    this.squareEl(from)?.classList.add(LASTMOVE_START_CLASS);
    this.squareEl(to)?.classList.add(LASTMOVE_END_CLASS);
    this.track({ square: from, kind: "lastmove" });
    this.track({ square: to, kind: "lastmove" });
  }

  /**
   * Removes the last-move highlight.
   *
   * @returns Nothing.
   * Used by: setLastMove, Gambix move flow, tests.
   */
  public clearLastMove(): void {
    if (this.lastMove) {
      this.squareEl(this.lastMove.from)?.classList.remove(LASTMOVE_START_CLASS);
      this.squareEl(this.lastMove.to)?.classList.remove(LASTMOVE_END_CLASS);
      this.untrack("lastmove", this.lastMove.from);
      this.untrack("lastmove", this.lastMove.to);
      this.lastMove = null;
    }
    this.root
      .querySelectorAll(`.${LASTMOVE_START_CLASS}, .${LASTMOVE_END_CLASS}`)
      .forEach((el) => {
        el.classList.remove(LASTMOVE_START_CLASS, LASTMOVE_END_CLASS);
      });
  }

  /**
   * Returns the current last-move squares.
   *
   * @returns Last-move from/to pair, or null when none.
   * Used by: Gambix API, tests.
   */
  public getLastMove(): { from: string; to: string } | null {
    return this.lastMove ? { ...this.lastMove } : null;
  }

  /**
   * Marks the square of the king in check.
   *
   * @param square - Checked king square, or null to clear.
   * @returns Nothing.
   * Used by: Gambix check flow, tests.
   */
  public setCheck(square: string | null): void {
    this.clearCheck();
    if (!square) return;
    if (!this.highlightsConfig.inCheck.enable) return;
    if (!SQUARE_RE.test(square)) return;
    this.checkSquare = square;
    this.squareEl(square)?.classList.add(CHECK_CLASS);
    this.track({ square, kind: "check" });
  }

  /**
   * Removes the in-check highlight.
   *
   * @returns Nothing.
   * Used by: setCheck, Gambix check flow, tests.
   */
  public clearCheck(): void {
    if (this.checkSquare) {
      this.squareEl(this.checkSquare)?.classList.remove(CHECK_CLASS);
      this.untrack("check", this.checkSquare);
      this.checkSquare = null;
    }
    this.root
      .querySelectorAll(`.${CHECK_CLASS}`)
      .forEach((el) => el.classList.remove(CHECK_CLASS));
  }

  /**
   * Returns the currently checked square.
   *
   * @returns Checked square, or null when none.
   * Used by: Gambix API, tests.
   */
  public getCheck(): string | null {
    return this.checkSquare;
  }

  /**
   * Marks checkmate winner and loser squares.
   *
   * @param winnerSquare - Winner square or null.
   * @param loserSquare - Loser square or null.
   * @returns Nothing.
   * Used by: Gambix checkmate flow, tests.
   */
  public setCheckmate(
    winnerSquare: string | null,
    loserSquare: string | null,
  ): void {
    this.clearCheckmate();
    if (!winnerSquare && !loserSquare) return;
    const cfg = this.highlightsConfig.checkmate;
    if (winnerSquare && SQUARE_RE.test(winnerSquare) && cfg.winner.enable) {
      this.squareEl(winnerSquare)?.classList.add(MATE_WINNER_CLASS);
      this.track({ square: winnerSquare, kind: "checkmate-winner" });
    }
    if (loserSquare && SQUARE_RE.test(loserSquare) && cfg.loser.enable) {
      this.squareEl(loserSquare)?.classList.add(MATE_LOSER_CLASS);
      this.track({ square: loserSquare, kind: "checkmate-loser" });
    }
    if (winnerSquare || loserSquare) {
      this.mateSquares = {
        winner: winnerSquare ?? "",
        loser: loserSquare ?? "",
      };
    }
  }

  /**
   * Removes checkmate winner and loser highlights.
   *
   * @returns Nothing.
   * Used by: setCheckmate, Gambix checkmate flow, tests.
   */
  public clearCheckmate(): void {
    if (this.mateSquares) {
      if (this.mateSquares.winner) {
        this.squareEl(this.mateSquares.winner)?.classList.remove(
          MATE_WINNER_CLASS,
        );
        this.untrack("checkmate-winner", this.mateSquares.winner);
      }
      if (this.mateSquares.loser) {
        this.squareEl(this.mateSquares.loser)?.classList.remove(
          MATE_LOSER_CLASS,
        );
        this.untrack("checkmate-loser", this.mateSquares.loser);
      }
      this.mateSquares = null;
    }
    this.root
      .querySelectorAll(`.${MATE_WINNER_CLASS}, .${MATE_LOSER_CLASS}`)
      .forEach((el) => {
        el.classList.remove(MATE_WINNER_CLASS, MATE_LOSER_CLASS);
      });
  }

  /**
   * Shows legal-move dots or rings for the given squares.
   *
   * @param squares - Candidate destination squares.
   * @param hasPiece - Optional occupancy checker override.
   * @returns Nothing.
   * Used by: Gambix selection flow, tests.
   */
  public setLegalMoves(
    squares: string[],
    hasPiece?: (sq: string) => boolean,
  ): void {
    this.clearLegalMoves();
    if (!this.highlightsConfig.legalMoves.enable) return;
    const occupied = hasPiece ?? this.hasPiece;
    for (const sq of squares) {
      if (!SQUARE_RE.test(sq)) continue;
      const el = this.squareEl(sq);
      if (!el) continue;
      const cls = occupied(sq) ? LEGAL_RING_CLASS : LEGAL_DOT_CLASS;
      el.classList.add(cls);
      this.legalMoves.add(sq);
      this.track({
        square: sq,
        kind: occupied(sq) ? "legal-ring" : "legal-dot",
      });
    }
  }

  /**
   * Removes all legal-move dots and rings.
   *
   * @returns Nothing.
   * Used by: setLegalMoves, Gambix selection flow, tests.
   */
  public clearLegalMoves(): void {
    for (const sq of this.legalMoves) {
      this.squareEl(sq)?.classList.remove(LEGAL_DOT_CLASS, LEGAL_RING_CLASS);
      this.untrack("legal-dot", sq);
      this.untrack("legal-ring", sq);
    }
    this.legalMoves.clear();
    this.root
      .querySelectorAll(`.${LEGAL_DOT_CLASS}, .${LEGAL_RING_CLASS}`)
      .forEach((el) => el.classList.remove(LEGAL_DOT_CLASS, LEGAL_RING_CLASS));
  }

  /**
   * Clears manual highlights for the clear-draw event.
   *
   * @returns Nothing.
   * Used by: clear-draw event handler.
   */
  private clearManualHighlights(): void {
    this.clearUserHighlights();
  }

  /**
   * Clears non-persistent user highlights.
   *
   * @returns Nothing.
   * Used by: Gambix API, tests.
   */
  clearHighlights(): void {
    this.clearUserHighlights();
  }

  /**
   * Removes user highlights while keeping locked ones.
   *
   * @returns Nothing.
   * Used by: clearManualHighlights, clearHighlights.
   */
  private clearUserHighlights(): void {
    this.root.querySelectorAll(`.${SQUARE_CLASS}`).forEach((element) => {
      const el = element as HTMLElement;
      if (
        el.dataset.persistent === "true" ||
        el.classList.contains(LOCKED_HIGHLIGHT_CLASS)
      )
        return;
      el.classList.remove(SQUARE_CLASS, USER_HIGHLIGHT_CLASS);
      delete el.dataset.persistent;
    });
    for (const [key, record] of [...this.highlightMap]) {
      if (record.kind === "user") this.highlightMap.delete(key);
    }
  }

  /**
   * Clears every highlight including locked and game state marks.
   *
   * @returns Nothing.
   * Used by: Gambix API, tests.
   */
  clearHighlightsAll(): void {
    this.root
      .querySelectorAll(
        `.${LASTMOVE_START_CLASS}, .${LASTMOVE_END_CLASS}, .${SELECTED_CLASS}, .${CHECK_CLASS}, .${MATE_WINNER_CLASS}, .${MATE_LOSER_CLASS}, .${SQUARE_CLASS}, .${LEGAL_DOT_CLASS}, .${LEGAL_RING_CLASS}`,
      )
      .forEach((element) => {
        const el = element as HTMLElement;
        el.classList.remove(
          LASTMOVE_START_CLASS,
          LASTMOVE_END_CLASS,
          SELECTED_CLASS,
          CHECK_CLASS,
          MATE_WINNER_CLASS,
          MATE_LOSER_CLASS,
          SQUARE_CLASS,
          LEGAL_DOT_CLASS,
          LEGAL_RING_CLASS,
          LOCKED_HIGHLIGHT_CLASS,
          USER_HIGHLIGHT_CLASS,
        );
        delete el.dataset.persistent;
      });
    this.highlightMap.clear();
    this.legalMoves.clear();
    this.lastMove = null;
    this.checkSquare = null;
    this.mateSquares = null;
    this.selectedSquare = null;
  }

  /**
   * Removes any highlight from one square and emits a toggle event.
   *
   * @param square - Square name to clear.
   * @returns Nothing.
   * Used by: Gambix API, tests.
   */
  removeHighlightSquare(square: string): void {
    const el = this.squareEl(square);
    if (!el) return;
    el.classList.remove(
      SQUARE_CLASS,
      LOCKED_HIGHLIGHT_CLASS,
      USER_HIGHLIGHT_CLASS,
    );
    delete el.dataset.persistent;
    this.untrack("user", square);
    this.untrack("locked", square);
    this.eventBus.emit("drawing:highlight-toggled", {
      square,
      color: "",
      active: false,
      persistent: false,
    });
  }
}

export default Highlights;
