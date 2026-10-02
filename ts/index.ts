import Board from "./src/ui/board.ts";
import Interaction from "./src/ui/interaction.ts";
import PluginManager from "./src/plugins/plugin-manager.ts";
import type { BoardAnimationOptions, GambixPlugin } from "./src/types/types.ts";
import EventBus from "./src/events/event-bus.ts";
import type { ChessEvents } from "./src/types/types.ts";
import "./src/style/style.css";
import type {
  ThemeConfig,
  InteractionConfig,
  DrawingConfig,
  HighlightsConfig,
  ChessOptions,
  PlayerControl,
  HighlightRecord,
  MoveRequestPayload,
} from "./src/types/types.ts";
import Arrows from "./src/ui/arrows.ts";
import Highlights from "./src/ui/highlights.ts";
import PromotionManager from "./src/ui/promotion.ts";
import { DEFAULT_CONFIG, STANDARD_FEN } from "./src/config/defaults.ts";
import { FenStore } from "./src/utils/fen.ts";
import { deepMerge } from "./src/utils/object.ts";

/**
 * Main chessboard UI facade: owns the board, interaction, drawing,
 * highlights, promotion flow, FEN store, and plugins.
 * Used by: library consumers via `new Gambix(selector, options)`.
 */
class Gambix {
  public rootElement: HTMLElement;

  public theme: ThemeConfig;
  public board: Board;

  public interactionSettings: InteractionConfig;
  public interaction?: Interaction;

  public drawing: DrawingConfig;
  public draw?: Arrows;

  public highlights: HighlightsConfig;
  public highlighter: Highlights;

  private fenStore: FenStore;
  private promotion: PromotionManager;

  public plugins: PluginManager;
  private eventBus: EventBus<ChessEvents>;
  private coreUnsubs: Array<() => void> = [];

  /**
   * Creates the board inside the given selector and wires all subsystems.
   * @param element - CSS selector of the container HTMLElement.
   * @param props - Optional ChessOptions (theme, fen, callbacks, plugins).
   * @returns Nothing (constructor). Throws when the selector matches nothing.
   * Used by: library consumers.
   */
  constructor(element: string, props: ChessOptions = {}) {
    const foundEl = document.querySelector(element);
    if (!foundEl || !(foundEl instanceof HTMLElement)) {
      throw new Error(
        `Gambix: element '${element}' was not found on the page.`,
      );
    }
    this.rootElement = foundEl;

    const safeProps = props || {};
    this.eventBus = new EventBus<ChessEvents>();

    this.theme = deepMerge(DEFAULT_CONFIG.theme, safeProps.theme || {});
    this.interactionSettings = deepMerge(
      DEFAULT_CONFIG.interaction,
      safeProps.interaction || {},
    );
    this.drawing = deepMerge(DEFAULT_CONFIG.drawing, safeProps.drawing || {});
    this.highlights = deepMerge(
      DEFAULT_CONFIG.highlights,
      safeProps.highlights || {},
    );

    const FEN =
      safeProps.fen === "start"
        ? STANDARD_FEN
        : (safeProps.fen ?? STANDARD_FEN);
    this.fenStore = new FenStore(FEN);

    const animationConfig = deepMerge(
      DEFAULT_CONFIG.animations,
      safeProps.animations || {},
    );

    this.board = new Board({
      element: this.rootElement,
      boardTheme: this.theme,
      position: this.fenStore.getPositionMap(),
      eventBus: this.eventBus,
      animations: animationConfig,
    });

    this.highlighter = new Highlights(
      this.eventBus,
      this.highlights,
      this.rootElement,
      () => this.theme.boardSize,
      (sq) => this.fenStore.hasPiece(sq),
    );

    if (this.interactionSettings.control !== "none") {
      this.interaction = new Interaction({
        interaction: {
          ...this.interactionSettings,
          boardType: this.theme.boardType,
        },
        board: {
          element: this.rootElement,
          getPieceCode: (sq) => this.fenStore.getPieceCode(sq),
          getBoardElement: () => this.board.getBoardElement(),
          getOrientation: () => this.board.getOrientation(),
        },
        eventBus: this.eventBus,
      });
    }

    if (this.drawing.enabled) {
      this.draw = new Arrows(
        this.drawing,
        this.eventBus,
        this.theme.orientation,
        () => this.board.getBoardElement(),
      );
    }

    this.promotion = new PromotionManager({
      eventBus: this.eventBus,
      getPiece: (sq) => this.fenStore.getPiece(sq),
      getBoardElement: () => this.board.getBoardElement(),
      getTheme: () => this.theme,
      onRejectMove: (from, to) => this.rejectMoveFrom(from, to),
    });

    this.promotion.attach();
    this.bindCoreEvents();

    this.plugins = new PluginManager({
      root: this.rootElement,
      eventBus: this.eventBus,
      board: this.board,
    });
    for (const plugin of safeProps.plugins ?? []) {
      this.plugins.use(plugin);
    }

    if (this.theme.autoResize) {
      this.enableAutoResize();
    }
    this.bindOptionCallbacks(safeProps);
  }

  /**
   * Subscribes the callbacks passed via ChessOptions to internal events.
   * @param safeProps - Normalized constructor options.
   * @returns Nothing.
   * Used by: Gambix constructor.
   */
  private bindOptionCallbacks(safeProps: ChessOptions): void {
    const p = safeProps;
    if (p.onPieceSelected) this.onPieceSelected(p.onPieceSelected);
    if (p.onSquareSelected) this.onSquareSelected(p.onSquareSelected);
    if (p.onMoveRequested) this.onMoveRequested(p.onMoveRequested);
    if (p.onFenChanged) this.onFenChanged(p.onFenChanged);
    if (p.onDragStart) this.onDragStart(p.onDragStart);
    if (p.onDragEnd) this.onDragEnd(p.onDragEnd);
    if (p.onPromotionRequested)
      this.onPromotionRequested(p.onPromotionRequested);
    if (p.onPromotionSelected) this.onPromotionSelected(p.onPromotionSelected);
    if (p.onPromotionCancelled)
      this.onPromotionCancelled(p.onPromotionCancelled);
    if (p.onDrawStart) this.onDrawStart(p.onDrawStart);
    if (p.onDrawMove) this.onDrawMove(p.onDrawMove);
    if (p.onDrawEnd) this.onDrawEnd(p.onDrawEnd);
    if (p.onDrawCleared) this.onDrawCleared(p.onDrawCleared);
    if (p.onArrowAdded) this.onArrowAdded(p.onArrowAdded);
    if (p.onArrowRemoved) this.onArrowRemoved(p.onArrowRemoved);
    if (p.onArrowsCleared) this.onArrowsCleared(p.onArrowsCleared);
    if (p.onHighlightToggled) this.onHighlightToggled(p.onHighlightToggled);
    if (p.onHighlightsCleared) this.onHighlightsCleared(p.onHighlightsCleared);
    if (p.onSquareHighlight) this.onSquareHighlight(p.onSquareHighlight);
    if (p.onPiecePlaced) this.onPiecePlaced(p.onPiecePlaced);
    if (p.onPieceRemoved) this.onPieceRemoved(p.onPieceRemoved);
    if (p.onKeyPressed) this.onKeyPressed(p.onKeyPressed);
    if (p.onKeyUp) this.onKeyUp(p.onKeyUp);
    if (p.onMoveAnimatedEnd) this.onMoveAnimatedEnd(p.onMoveAnimatedEnd);
    if (p.onSnapbackTriggered) this.onSnapbackTriggered(p.onSnapbackTriggered);
  }

  /**
   * Re-initializes interaction and drawing overlays after layout changes.
   * @returns Nothing.
   * Used by: flipBoard, resize, setTheme, reStyle* methods.
   */
  private refreshOverlays(): void {
    this.interaction?.reInit();
    this.draw?.reInit();
  }

  /**
   * Forwards interaction:* events to their public board:* counterparts.
   * @returns Nothing.
   * Used by: Gambix constructor.
   */
  private bindCoreEvents(): void {
    this.coreUnsubs.push(
      this.eventBus.on("interaction:square-selected", (payload) => {
        const square = payload.square;
        const code = this.fenStore.getPieceCode(square);
        const data = { square, piece: code };
        this.eventBus.emit("board:piece-selected", data);
        this.eventBus.emit("board:square-selected", data);
      }),
      this.eventBus.on("interaction:drag-start", (p) =>
        this.eventBus.emit("board:drag-start", { ...p }),
      ),
      this.eventBus.on("interaction:drag-end", (p) =>
        this.eventBus.emit("board:drag-end", { ...p }),
      ),
      this.eventBus.on("interaction:start-draw", (p) =>
        this.eventBus.emit("board:draw-start", { ...p }),
      ),
      this.eventBus.on("interaction:draw-move", (p) =>
        this.eventBus.emit("board:draw-move", { ...p }),
      ),
      this.eventBus.on("interaction:end-draw", (p) =>
        this.eventBus.emit("board:draw-end", { ...p }),
      ),
      this.eventBus.on("interaction:clear-draw", () =>
        this.eventBus.emit("board:draw-cleared", {}),
      ),
    );
  }

  /**
   * Tears down all subsystems, listeners, and plugins.
   * @returns Nothing.
   * Used by: library consumers, test teardown.
   */
  public destroy(): void {
    this.coreUnsubs.forEach((u) => u());
    this.coreUnsubs = [];
    this.promotion?.destroy();
    this.interaction?.destroy();
    this.highlighter?.destroy();
    this.board?.destroy();
    this.plugins?.destroy();
    this.draw?.destroy();
  }

  /**
   * Installs a plugin after construction.
   * @param plugin - The GambixPlugin to install.
   * @returns Nothing. Throws when a plugin with the same name exists.
   * Used by: library consumers.
   */
  public usePlugin(plugin: GambixPlugin): void {
    this.plugins.use(plugin);
  }

  /**
   * Toggles the board orientation between white and black.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public flipBoard(): void {
    if (!this.theme) return;
    this.promotion?.hide(false);
    this.theme.orientation =
      this.theme.orientation === "white" ? "black" : "white";
    this.board.flipBoard(this.theme.orientation);
    this.draw?.setOrientation(this.theme.orientation);
    this.refreshOverlays();
  }

  /**
   * Resizes the board to the given width in pixels.
   * @param width - New board width in pixels.
   * @returns Nothing.
   * Used by: library consumers, auto-resize observer.
   */
  public resize(width: number): void {
    if (!this.theme) return;
    this.promotion?.hide(false);
    this.theme.boardSize = width;
    this.board.resize(width);
    this.highlighter?.updateScale(width);
    this.refreshOverlays();
  }

  /**
   * Deep-merges a partial theme into the current theme and re-renders.
   * @param theme - Partial ThemeConfig to apply.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public setTheme(theme: Partial<ThemeConfig>): void {
    if (!theme || typeof theme !== "object") return;
    if (!this.theme) return;
    this.promotion?.hide(false);
    this.theme = deepMerge(this.theme, theme);

    if (theme.autoResize !== undefined) {
      if (theme.autoResize) {
        this.enableAutoResize();
      } else {
        this.disableAutoResize();
      }
    }

    this.board.reStyle(this.theme);
    this.highlighter?.updateScale(this.theme.boardSize);
    this.draw?.setOrientation(this.theme.orientation);
    this.refreshOverlays();
  }

  /**
   * Updates legal-move dot/ring size ratios.
   * @param dotRatio - Dot diameter ratio. @param ringRatio - Ring thickness ratio.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public setLegalMoveRatio(dotRatio: number, ringRatio: number): void {
    this.highlighter?.setLegalMoveRatios(dotRatio, ringRatio);
  }

  /**
   * Recomputes legal-move marker scale for the current board size.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public updateLegalMoveScale(): void {
    this.highlighter?.updateScale(this.theme.boardSize);
  }

  /**
   * Returns the live theme object (kept in sync with Board.theme).
   * @returns The current ThemeConfig.
   * Used by: library consumers, PromotionManager theme lookup.
   */
  public getTheme(): ThemeConfig {
    return this.theme;
  }

  /**
   * Returns the current position as a FEN string.
   * @returns The current FEN.
   * Used by: library consumers.
   */
  public getFEN(): string {
    return this.fenStore.getFen();
  }

  /**
   * Loads a new position, diffing and animating only changed squares.
   * Reloading the current FEN is a silent no-op (no redraw, no event).
   * @param fen - The FEN string to load.
   * @returns True when the FEN is valid, false otherwise.
   * Used by: library consumers (usually after logic.move succeeds).
   */
  public loadFEN(fen: string): boolean {
    this.promotion?.hide(false);
    const diff = this.fenStore.setFen(fen);
    if (!diff) return false;

    if (diff.changed.length > 0) {
      this.board.applyFenDiff(diff);
      this.eventBus.emit("board:fen-changed", { fen: diff.newFen });
    }
    return true;
  }

  /**
   * Returns every square with its current piece code (or null).
   * @returns Array of { square, piece } entries for all 64 squares.
   * Used by: library consumers.
   */
  public getBoard(): Array<{ square: string; piece: string | null }> {
    return this.fenStore.getBoard();
  }

  /**
   * Returns the piece on a square, if any.
   * @param square - Square name (e.g. "e4").
   * @returns { type, color } or null when the square is empty.
   * Used by: library consumers.
   */
  public getPiece(square: string): { type: string; color: string } | null {
    return this.fenStore.getPiece(square);
  }

  /**
   * Returns which side(s) the user can move pieces for.
   * @returns "white" | "black" | "both" | "none".
   * Used by: library consumers.
   */
  public getPlayer(): "white" | "black" | "both" | "none" {
    return this.interactionSettings.control;
  }

  /**
   * Snaps back any displaced piece and clears legal moves.
   * @returns Nothing.
   * Used by: library consumers, onMoveRequested rejection flow.
   */
  public rejectMove(): void {
    this.board.syncPieces();
    this.clearLegalMoves();
    this.eventBus.emit("board:snapback-triggered", { from: "", to: null });
  }

  /**
   * Snaps back the piece moved from/to the given squares.
   * @param from - Origin square. @param to - Drop square (or null).
   * @returns Nothing.
   * Used by: onMoveRequested handlers, PromotionManager cancellations.
   */
  public rejectMoveFrom(from: string, to: string | null = null): void {
    this.board.syncPieces();
    this.clearLegalMoves();
    this.eventBus.emit("board:snapback-triggered", { from, to });
  }

  /**
   * Enables board resizing that follows the parent element width.
   * @returns Nothing.
   * Used by: library consumers, constructor when theme.autoResize is set.
   */
  public enableAutoResize(): void {
    this.theme.autoResize = true;
    this.board.enableAutoResize(
      this.rootElement.parentElement || this.rootElement,
      () => this.theme.boardSize,
      (w) => this.resize(w),
    );
  }

  /**
   * Disables the parent-following auto-resize observer.
   * @returns Nothing.
   * Used by: library consumers, setTheme when autoResize is turned off.
   */
  public disableAutoResize(): void {
    this.theme.autoResize = false;
    this.board.disableAutoResize();
  }

  /**
   * Draws a persistent arrow between two squares.
   * @param start - Origin square. @param end - Target square.
   * @param color - Optional arrow color. @param width - Optional line width.
   * @returns True when the arrow was added.
   * Used by: library consumers.
   */
  public drawArrow(
    start: string,
    end: string,
    color?: string,
    width?: number,
  ): boolean {
    if (!this.draw) return false;
    return this.draw.drawArrow(start, end, color, true, width);
  }

  /**
   * Removes the arrow between two squares, if present.
   * @param start - Origin square. @param end - Target square.
   * @returns True when an arrow was removed.
   * Used by: library consumers.
   */
  public removeArrow(start: string, end: string): boolean {
    const removed = this.draw?.removeArrow(start, end) ?? false;

    if (removed) {
      this.eventBus.emit("drawing:arrow-removed", { from: start, to: end });
    }

    return removed;
  }

  /**
   * Clears non-persistent arrows from the board.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public clearArrows(): void {
    this.draw?.clearArrows();
    this.eventBus.emit("drawing:arrows-cleared", {});
  }

  /**
   * Clears all arrows, including persistent ones.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public clearArrowsAll(): void {
    this.draw?.clearArrowsAll();
    this.eventBus.emit("drawing:arrows-cleared", {});
  }

  /**
   * Returns all currently drawn arrows.
   * @returns Array of { from, to, color, persistent } records.
   * Used by: library consumers.
   */
  public getArrows(): Array<{
    from: string;
    to: string;
    color: string;
    persistent: boolean;
  }> {
    return this.draw?.getArrows() ?? [];
  }

  /**
   * Enables right-button arrow drawing.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public enableDraw(): void {
    if (!this.draw) return;
    this.drawing.enabled = true;
    this.draw.enableDraw();
  }

  /**
   * Disables right-button arrow drawing.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public disableDraw(): void {
    if (!this.draw) return;
    this.drawing.enabled = false;
    this.draw.disableDraw();
  }

  /**
   * Adds a persistent highlight to a square.
   * @param square - Square name. @param color - Optional highlight color.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public setHighlight(square: string, color?: string): void {
    this.highlighter?.highlightSquarePersistent(square, color);
  }

  /**
   * Removes the persistent highlight from a square.
   * @param square - Square name.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public removeHighlight(square: string): void {
    this.highlighter?.removeHighlightSquare(square);
  }

  /**
   * Clears non-persistent highlights.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public clearHighlights(): void {
    this.highlighter?.clearHighlights();
    this.eventBus.emit("drawing:highlights-cleared", {});
  }

  /**
   * Clears all highlights, including persistent ones.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public clearHighlightsAll(): void {
    this.highlighter?.clearHighlightsAll();
    this.eventBus.emit("drawing:highlights-cleared", {});
  }

  /**
   * Returns all active highlight records.
   * @returns Array of HighlightRecord entries.
   * Used by: library consumers.
   */
  public getHighlights(): HighlightRecord[] {
    return this.highlighter?.getHighlights() ?? [];
  }

  /**
   * Enables square highlights.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public enableHighlights(): void {
    if (this.highlighter) this.highlighter.highlightsConfig.enabled = true;
  }

  /**
   * Disables square highlights.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public disableHighlights(): void {
    if (this.highlighter) this.highlighter.highlightsConfig.enabled = false;
  }

  /**
   * Marks the last-move squares (or clears them when null).
   * @param from - Origin square or null. @param to - Target square or null.
   * @returns Nothing.
   * Used by: library consumers (usually after loadFEN).
   */
  public setLastMove(from: string | null, to: string | null): void {
    if (from && to) {
      this.highlighter?.setLastMove(from, to);
    } else {
      this.highlighter?.clearLastMove();
    }
  }

  /**
   * Returns the currently marked last-move squares.
   * @returns { from, to } or null when none is marked.
   * Used by: library consumers.
   */
  public getLastMove(): { from: string; to: string } | null {
    return this.highlighter?.getLastMove() ?? null;
  }

  /**
   * Marks the king square currently in check.
   * @param square - King square or null to clear.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public setCheck(square: string | null): void {
    this.highlighter?.setCheck(square);
  }

  /**
   * Clears the in-check marker.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public clearCheck(): void {
    this.highlighter?.clearCheck();
  }

  /**
   * Marks the checkmate winner/loser squares.
   * @param winnerSquare - Winner king square or null.
   * @param loserSquare - Loser king square or null.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public setCheckmate(
    winnerSquare: string | null,
    loserSquare: string | null,
  ): void {
    this.highlighter?.setCheckmate(winnerSquare, loserSquare);
  }

  /**
   * Clears the checkmate markers.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public clearCheckmate(): void {
    this.highlighter?.clearCheckmate();
  }

  /**
   * Enables move animations.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public enableAnimations(): void {
    if (this.board?.animator) this.board.animator.options.enabled = true;
  }

  /**
   * Disables move animations.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public disableAnimations(): void {
    if (this.board?.animator) this.board.animator.options.enabled = false;
  }

  /**
   * Merges animation options (and snapback options) into the live config.
   * @param cfg - Partial BoardAnimationOptions to apply.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public updateAnimationConfig(cfg: BoardAnimationOptions): void {
    if (!cfg || typeof cfg !== "object") return;
    const { snapback, ...animatorCfg } = cfg;
    if (this.board?.animator) {
      Object.assign(this.board.animator.options, animatorCfg);
    }
    if (snapback && this.interaction) {
      const merged = {
        ...(this.interactionSettings.snapback ?? {}),
        ...snapback,
      };
      this.interactionSettings.snapback = merged;
      this.interaction.updateConfig({ snapback: merged });
    }
  }

  /**
   * Restyles light/dark square colors and re-syncs the live theme.
   * @param whiteSquareColor - New light-square color.
   * @param blackSquareColor - New dark-square color.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public reStyleBoard(
    whiteSquareColor: string,
    blackSquareColor: string,
  ): void {
    this.board?.reStyle({
      squares: {
        type: "color",
        light: whiteSquareColor,
        dark: blackSquareColor,
      },
    });
    if (this.board) this.theme = this.board.theme;
    this.refreshOverlays();
  }

  /**
   * Restyles board coordinates and re-syncs the live theme.
   * @param cfg - Partial coordinate theme to apply.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public reStyleCoords(cfg: Partial<ThemeConfig["coord"]>): void {
    this.board?.reStyle({ coord: cfg });
    if (this.board) this.theme = this.board.theme;
    this.refreshOverlays();
  }

  /**
   * Restyles pieces and re-syncs the live theme.
   * @param cfg - Partial pieces theme to apply.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public reStylePiece(cfg: Partial<ThemeConfig["pieces"]>): void {
    this.board?.reStyle({ pieces: cfg });
    if (this.board) this.theme = this.board.theme;
    this.refreshOverlays();
  }

  /**
   * Returns the current board orientation.
   * @returns "white" or "black".
   * Used by: library consumers.
   */
  public getOrientation(): "white" | "black" {
    return this.board?.getOrientation() ?? this.theme.orientation;
  }

  /**
   * Enables piece interaction for the given side(s), creating it if needed.
   * @param player - "white" | "black" | "both".
   * @returns Nothing.
   * Used by: library consumers.
   */
  public enableInteractionFor(player: "white" | "black" | "both"): void {
    this.interactionSettings.control = player;
    if (this.interaction) {
      this.interaction.updateConfig({
        control: player as PlayerControl,
        moveMechanic: this.interactionSettings.moveMechanic,
        boardType: this.theme.boardType,
      });
      return;
    }
    if (this.board && this.rootElement) {
      this.interaction = new Interaction({
        interaction: {
          ...this.interactionSettings,
          boardType: this.theme.boardType,
        },
        board: {
          element: this.rootElement,
          getPieceCode: (sq) => this.fenStore.getPieceCode(sq),
          getBoardElement: () => this.board.getBoardElement(),
          getOrientation: () => this.board.getOrientation(),
        },
        eventBus: this.eventBus,
      });
    }
  }

  /**
   * Disables all piece interaction (control becomes "none").
   * @returns Nothing.
   * Used by: library consumers.
   */
  public disableInteractionFor(): void {
    this.interactionSettings.control = "none";
    if (this.interaction) {
      this.interaction.updateConfig({
        control: "none",
        moveMechanic: this.interactionSettings.moveMechanic,
        boardType: this.theme.boardType,
      });
    }
  }

  /**
   * Returns the live interaction settings.
   * @returns The current InteractionConfig.
   * Used by: library consumers.
   */
  public getInteractionSettings(): InteractionConfig {
    return this.interactionSettings;
  }

  /**
   * Subscribes to piece selection; returning squares shows them as legal moves.
   * @param cb - Callback receiving { square, piece }, may return string[].
   * @returns Unsubscribe function.
   * Used by: library consumers (usually wired to chess.js moves).
   */
  public onPieceSelected(
    cb: (data: { square: string; piece: string | null }) => string[] | void,
  ): () => void {
    return this.eventBus.on("board:piece-selected", (p) => {
      const result = cb(p);
      if (Array.isArray(result)) this.setLegalMoves(result);
    });
  }

  /**
   * Subscribes to square selection events.
   * @param cb - Callback receiving { square, piece }.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onSquareSelected(
    cb: (data: { square: string; piece: string | null }) => void,
  ): () => void {
    return this.eventBus.on("board:square-selected", (p) => cb(p));
  }

  /**
   * Subscribes to move requests; return false (or Promise<false>) to snap back.
   * A rejected/thrown async handler is logged and treated as a rejection.
   * @param cb - Callback receiving { from, to, promotion? }.
   * @returns Unsubscribe function.
   * Used by: library consumers (game-logic validation layer).
   */
  public onMoveRequested(
    cb: (data: MoveRequestPayload) => boolean | void | Promise<boolean | void>,
  ): () => void {
    return this.eventBus.on("board:move-requested", (p) => {
      const res = cb(p) as unknown;
      if (res === false) this.rejectMoveFrom(p.from, p.to);
      if (res && typeof (res as Promise<unknown>).then === "function") {
        (res as Promise<unknown>)
          .then((v: unknown) => {
            if (v === false) this.rejectMoveFrom(p.from, p.to);
          })
          .catch((err: unknown) => {
            console.error("[Gambix] onMoveRequested handler failed:", err);
            this.rejectMoveFrom(p.from, p.to);
          });
      }
    });
  }

  /**
   * Subscribes to FEN changes applied via loadFEN.
   * @param cb - Callback receiving the new FEN string.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onFenChanged(cb: (fen: string) => void): () => void {
    return this.eventBus.on("board:fen-changed", (p) => cb(p.fen));
  }

  /**
   * Subscribes to piece drag-start events.
   * @param cb - Callback receiving { square, piece }.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onDragStart(
    cb: (data: { square: string; piece: string | null }) => void,
  ): () => void {
    return this.eventBus.on("board:drag-start", (p) => cb(p));
  }

  /**
   * Subscribes to piece drag-end events.
   * @param cb - Callback receiving { from, to, piece }.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onDragEnd(
    cb: (data: {
      from: string;
      to: string | null;
      piece: string | null;
    }) => void,
  ): () => void {
    return this.eventBus.on("board:drag-end", (p) => cb(p));
  }

  /**
   * Subscribes to promotion requests; return a piece ("q"|"r"|"b"|"n") to
   * auto-pick, false to reject, or nothing to show the picker UI.
   * @param cb - Callback receiving { from, to, color, piece }.
   * @returns Unsubscribe function.
   * Used by: library consumers, PromotionManager intercept flow.
   */
  public onPromotionRequested(
    cb: (data: {
      from: string;
      to: string;
      color: string;
      piece: string | null;
    }) => string | false | void | Promise<string | false | void>,
  ): () => void {
    return this.promotion.onPromotionRequested(cb);
  }

  /**
   * Subscribes to promotion choices (exactly one emit per choice).
   * @param cb - Callback receiving { from, to, promotion }.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onPromotionSelected(
    cb: (data: { from: string; to: string; promotion: string }) => void,
  ): () => void {
    return this.eventBus.on("board:promotion-selected", (p) =>
      cb(p as { from: string; to: string; promotion: string }),
    );
  }

  /**
   * Subscribes to promotion cancellations.
   * @param cb - Callback receiving { from, to }.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onPromotionCancelled(
    cb: (data: { from: string; to: string }) => void,
  ): () => void {
    return this.eventBus.on("board:promotion-cancelled", (p) => cb(p));
  }

  /**
   * Programmatically answers a pending promotion (or a real candidate move).
   * Non-promotion moves are ignored with a dev warning.
   * @param from - Origin square. @param to - Target square.
   * @param promotion - "q" | "r" | "b" | "n" (case-insensitive).
   * @returns Nothing.
   * Used by: library consumers.
   */
  public choosePromotion(from: string, to: string, promotion: string): void {
    this.promotion.choose(from, to, promotion);
  }

  /**
   * Cancels the pending promotion picker, if any, with a snapback.
   * @returns Nothing.
   * Used by: library consumers.
   */
  public cancelPromotion(): void {
    this.promotion.cancel();
  }

  /**
   * Returns the currently pending promotion, if any.
   * @returns { from, to, color } or null when no picker is open.
   * Used by: library consumers.
   */
  public getPromotionPending(): {
    from: string;
    to: string;
    color: string;
  } | null {
    return this.promotion.getPending();
  }

  /**
   * Subscribes to arrow-drawing start events.
   * @param cb - Callback receiving { from, to }.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onDrawStart(
    cb: (data: { from: string; to: string }) => void,
  ): () => void {
    return this.eventBus.on("board:draw-start", (p) => cb(p));
  }

  /**
   * Subscribes to arrow-drawing move events.
   * @param cb - Callback receiving { from, to }.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onDrawMove(
    cb: (data: { from: string; to: string }) => void,
  ): () => void {
    return this.eventBus.on("board:draw-move", (p) => cb(p));
  }

  /**
   * Subscribes to arrow-drawing end events.
   * @param cb - Callback receiving { from, to }.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onDrawEnd(
    cb: (data: { from: string; to: string }) => void,
  ): () => void {
    return this.eventBus.on("board:draw-end", (p) => cb(p));
  }

  /**
   * Subscribes to drawing-cleared events.
   * @param cb - Callback receiving no payload.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onDrawCleared(cb: () => void): () => void {
    return this.eventBus.on("board:draw-cleared", () => cb());
  }

  /**
   * Subscribes to arrow-added events.
   * @param cb - Callback receiving { from, to, color }.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onArrowAdded(
    cb: (data: { from: string; to: string; color: string }) => void,
  ): () => void {
    return this.eventBus.on("drawing:arrow-added", (p) =>
      cb(p as { from: string; to: string; color: string }),
    );
  }

  /**
   * Subscribes to arrow-removed events.
   * @param cb - Callback receiving { from, to }.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onArrowRemoved(
    cb: (data: { from: string; to: string }) => void,
  ): () => void {
    return this.eventBus.on("drawing:arrow-removed", (p) => cb(p));
  }

  /**
   * Subscribes to arrows-cleared events.
   * @param cb - Callback receiving no payload.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onArrowsCleared(cb: () => void): () => void {
    return this.eventBus.on("drawing:arrows-cleared", () => cb());
  }

  /**
   * Subscribes to highlight-toggled events.
   * @param cb - Callback receiving { square, active, color? }.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onHighlightToggled(
    cb: (data: { square: string; active: boolean; color?: string }) => void,
  ): () => void {
    return this.eventBus.on("drawing:highlight-toggled", (p) => cb(p));
  }

  /**
   * Subscribes to highlights-cleared events.
   * @param cb - Callback receiving no payload.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onHighlightsCleared(cb: () => void): () => void {
    return this.eventBus.on("drawing:highlights-cleared", () => cb());
  }

  /**
   * Subscribes to right-click square-highlight intents.
   * @param cb - Callback receiving the square name.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onSquareHighlight(cb: (square: string) => void): () => void {
    return this.eventBus.on("interaction:highlight-square", (p) => cb(p));
  }

  /**
   * Subscribes to piece-placed events (customizable board editing).
   * @param cb - Callback receiving { to, piece }.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onPiecePlaced(
    cb: (data: { to: string; piece: string }) => void,
  ): () => void {
    return this.eventBus.on("interaction:piece-placed", (p) => cb(p));
  }

  /**
   * Subscribes to piece-removed events (dropping a piece off the board).
   * @param cb - Callback receiving { from }.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onPieceRemoved(cb: (data: { from: string }) => void): () => void {
    return this.eventBus.on("interaction:piece-removed", (p) => cb(p));
  }

  /**
   * Subscribes to key-pressed events while interacting with the board.
   * @param cb - Callback receiving the pressed key.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onKeyPressed(cb: (key: string) => void): () => void {
    return this.eventBus.on("interaction:key-pressed", (p) => cb(p));
  }

  /**
   * Subscribes to key-up events while interacting with the board.
   * @param cb - Callback receiving the released key.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onKeyUp(cb: (key: string) => void): () => void {
    return this.eventBus.on("interaction:key-up", (p) => cb(p));
  }

  /**
   * Subscribes to move-animation completion events.
   * @param cb - Callback receiving { from, to, isCapture }.
   * @returns Unsubscribe function.
   * Used by: library consumers.
   */
  public onMoveAnimatedEnd(
    cb: (data: { from: string; to: string; isCapture: boolean }) => void,
  ): () => void {
    return this.eventBus.on("board:move-animated-end", (p) => cb(p));
  }

  /**
   * Subscribes to snapback events fired after move rejections.
   * @param cb - Callback receiving { from, to }.
   * @returns Unsubscribe function.
   * Used by: library consumers, rejection-flow tests.
   */
  public onSnapbackTriggered(
    cb: (data: { from: string; to: string | null }) => void,
  ): () => void {
    return this.eventBus.on("board:snapback-triggered", (p) => cb(p));
  }

  /**
   * Generic subscription to any typed ChessEvents event.
   * @param event - Event name. @param cb - Callback receiving the payload.
   * @returns Unsubscribe function.
   * Used by: library consumers, plugins.
   */
  public on<T extends keyof ChessEvents>(
    event: T,
    cb: (payload: ChessEvents[T]) => void,
  ): () => void {
    return this.eventBus.on(event, cb);
  }

  /**
   * Removes a previously registered event handler.
   * @param event - Event name. @param cb - The exact callback to remove.
   * @returns Nothing.
   * Used by: library consumers, plugins.
   */
  public off<T extends keyof ChessEvents>(
    event: T,
    cb: (payload: ChessEvents[T]) => void,
  ): void {
    this.eventBus.off(event, cb);
  }

  /**
   * Subscribes a one-shot handler that auto-removes after the first emit.
   * @param event - Event name. @param cb - Callback receiving the payload.
   * @returns Unsubscribe function that cancels before the first emit.
   * Used by: library consumers, plugins.
   */
  public once<T extends keyof ChessEvents>(
    event: T,
    cb: (payload: ChessEvents[T]) => void,
  ): () => void {
    return this.eventBus.once(event, cb);
  }

  /**
   * Shows the given squares as legal-move markers.
   * @param squares - Square names to highlight.
   * @returns Nothing.
   * Used by: onPieceSelected flow, library consumers.
   */
  public setLegalMoves(squares: string[]): void {
    this.highlighter?.setLegalMoves(squares, (sq) =>
      this.fenStore.hasPiece(sq),
    );
  }

  /**
   * Clears all legal-move markers.
   * @returns Nothing.
   * Used by: rejectMove/rejectMoveFrom, library consumers.
   */
  public clearLegalMoves(): void {
    this.highlighter?.clearLegalMoves();
  }
}

export { PluginManager };
export type { GambixPlugin, GambixPluginContext } from "./src/types/types.ts";
export default Gambix;
