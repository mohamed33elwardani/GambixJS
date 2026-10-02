import type Board from "./board.ts";
import type {
  AnimationCategoryConfig,
  BoardAnimationOptions,
  ChessEvents,
} from "../types/types.ts";
import type EventBus from "../events/event-bus.ts";
import { readCurrentTranslate } from "../utils/dom.ts";

/**
 * Read-only view of square to piece-code mapping.
 *
 * Used by: BoardAnimator.renderSnapshot, Board position sync.
 */
type PositionView = ReadonlyMap<string, string | null>;

/**
 * Animates piece moves, spawns and captures between board snapshots.
 *
 * Used by: Board.applyFenDiff, Board.syncPieces flow, UI tests.
 */
export default class BoardAnimator {
  private board: Board;
  private eventBus?: EventBus<ChessEvents>;
  private lastMoveTime = 0;
  private generation = 0;
  public options: BoardAnimationOptions;

  /**
   * Creates an animator bound to a board and event bus.
   *
   * @param board - Owning board instance.
   * @param options - Animation durations and behavior flags.
   * @param eventBus - Shared chess event bus.
   * @returns Nothing.
   * Used by: Board constructor.
   */
  constructor(
    board: Board,
    options: BoardAnimationOptions,
    eventBus: EventBus<ChessEvents>,
  ) {
    this.board = board;
    this.options = options;
    this.eventBus = eventBus;
  }

  /**
   * Invalidates pending delayed animation callbacks.
   *
   * @returns Nothing.
   * Used by: Board.applyFenDiff, Board.destroy, tests.
   */
  public cancelPending(): void {
    this.generation++;
  }

  /**
   * Resolves the effective animation config with auto-speed handling.
   *
   * @param type - Animation category: move, capture or spawn.
   * @returns Effective config with duration and easing.
   * Used by: animatePieceMove, spawn, discard, promotion flow.
   */
  private getEffectiveConfig(
    type: "move" | "capture" | "spawn",
  ): AnimationCategoryConfig {
    const config = this.options[type];
    const easing = config.easing ?? "ease-in-out";

    if (!this.options.enabled) {
      return { duration: 0, easing };
    }

    if (!this.options.autoSpeed) return config;

    const now = performance.now();
    const timeDelta = this.lastMoveTime > 0 ? now - this.lastMoveTime : 1000;

    if (timeDelta < 200) {
      const maxDuration = timeDelta < 50 ? 0 : Math.floor(timeDelta * 0.8);
      return {
        duration: Math.min(config.duration ?? 300, maxDuration),
        easing,
      };
    }

    return config;
  }

  /**
   * Animates one piece element from a square to another.
   *
   * @param from - Start square.
   * @param to - End square.
   * @param isCapture - Whether the move captures a piece.
   * @returns Nothing.
   * Used by: renderSnapshot move and promotion flows.
   */
  private animatePieceMove(from: string, to: string, isCapture = false): void {
    const pieceEl = this.board.getPieceElement(from);
    if (!pieceEl) return;

    pieceEl.getAnimations().forEach((a) => a.cancel());

    const startPos = this.board.getSquareCoords(from);
    const endPos = this.board.getSquareCoords(to);
    const currentPos = readCurrentTranslate(pieceEl) ?? startPos;

    pieceEl.style.translate = `${currentPos.x}px ${currentPos.y}px`;
    pieceEl.setAttribute("data-square", to);
    this.board.remapPieceElement(from, to);

    const config = this.getEffectiveConfig("move");
    this.lastMoveTime = performance.now();

    const emitEnd = (): void => {
      this.eventBus?.emit("board:move-animated-end", { from, to, isCapture });
    };

    const duration = config.duration ?? 0;
    if (duration <= 0) {
      pieceEl.style.translate = `${endPos.x}px ${endPos.y}px`;
      emitEnd();
      return;
    }

    const anim = pieceEl.animate(
      [
        { translate: `${currentPos.x}px ${currentPos.y}px` },
        { translate: `${endPos.x}px ${endPos.y}px` },
      ],
      { duration, easing: config.easing ?? "ease-in-out" },
    );

    const finalize = (): void => {
      pieceEl.style.translate = `${endPos.x}px ${endPos.y}px`;
      emitEnd();
    };

    anim.onfinish = finalize;
    anim.oncancel = () => {
      pieceEl.style.translate = `${endPos.x}px ${endPos.y}px`;
    };
  }

  /**
   * Creates a piece element with an optional fade-in.
   *
   * @param pieceCode - Piece code such as wq.
   * @param square - Target square.
   * @returns Nothing.
   * Used by: renderSnapshot spawn and promotion flows.
   */
  private spawn(pieceCode: string, square: string): void {
    if (this.board.getPieceElement(square)) return;
    const el = this.board.createAndAppendPieceElement(pieceCode, square);
    if (!el) return;

    const config = this.getEffectiveConfig("spawn");
    const duration = config.duration ?? 0;

    if (duration > 0) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration,
        easing: config.easing ?? "ease-in",
      });
    }
  }

  /**
   * Removes a piece element with an optional fade-out.
   *
   * @param square - Square holding the piece to discard.
   * @returns Nothing.
   * Used by: renderSnapshot capture and discard flows.
   */
  private discard(square: string): void {
    const el = this.board.getPieceElement(square);
    if (!el) return;

    el.getAnimations().forEach((a) => a.finish());
    const config = this.getEffectiveConfig("capture");

    this.board.removePieceElement(square);
    el.removeAttribute("data-square");

    const duration = config.duration ?? 0;
    if (duration <= 0) {
      el.remove();
      return;
    }

    const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration,
      easing: config.easing ?? "ease-out",
    });

    const remove = (): void => {
      if (el.parentNode) el.remove();
    };

    anim.onfinish = remove;
    anim.oncancel = remove;
  }

  /**
   * Diffs two positions and animates moves, captures and promotions.
   *
   * @param oldMap - Position before the change.
   * @param newMap - Position after the change.
   * @returns Nothing.
   * Used by: Board.applyFenDiff, tests.
   */
  public renderSnapshot(oldMap: PositionView, newMap: PositionView): void {
    const gen = ++this.generation;

    const oldRemaining = new Map<string, string>();
    const newRemaining = new Map<string, string>();

    for (const [sq, piece] of oldMap) {
      if (piece) oldRemaining.set(sq, piece);
    }

    for (const [sq, piece] of newMap) {
      if (!piece) continue;
      if (oldRemaining.get(sq) === piece) {
        oldRemaining.delete(sq);
      } else {
        newRemaining.set(sq, piece);
      }
    }

    const matchedOld = new Set<string>();
    const matchedNew = new Set<string>();

    for (const [newSq, newPiece] of newRemaining) {
      for (const [oldSq, oldPiece] of oldRemaining) {
        if (matchedOld.has(oldSq)) continue;

        if (oldPiece === newPiece) {
          const capturedInTarget = oldRemaining.get(newSq);
          const hasTargetEl = !!this.board.getPieceElement(newSq);
          const hasCapture =
            !!(capturedInTarget && capturedInTarget !== newPiece) ||
            hasTargetEl;

          if (hasCapture) this.discard(newSq);
          if (capturedInTarget && capturedInTarget !== newPiece)
            matchedOld.add(newSq);

          this.animatePieceMove(oldSq, newSq, hasCapture);
          matchedOld.add(oldSq);
          matchedNew.add(newSq);
          break;
        }
      }
    }

    const promoTypes = new Set(["q", "r", "b", "n"]);
    for (const [newSq, newPiece] of newRemaining) {
      if (matchedNew.has(newSq)) continue;

      const newColor = newPiece[0];
      const newType = newPiece[1];
      if (!promoTypes.has(newType!)) continue;

      const rankNew = newSq[1];
      if (
        (newColor === "w" && rankNew !== "8") ||
        (newColor === "b" && rankNew !== "1")
      ) {
        continue;
      }

      for (const [oldSq, oldPiece] of oldRemaining) {
        if (matchedOld.has(oldSq) || oldPiece !== `${newColor}p`) continue;
        if (Math.abs(oldSq.charCodeAt(0) - newSq.charCodeAt(0)) > 1) continue;

        const promoCapture = !!this.board.getPieceElement(newSq);
        if (promoCapture) this.discard(newSq);

        this.animatePieceMove(oldSq, newSq, promoCapture);
        const dur = this.getEffectiveConfig("move").duration ?? 300;

        const replacePromo = (): void => {
          if (gen !== this.generation) return;
          const el = this.board.getPieceElement(newSq);
          if (!el || el.getAttribute("data-piece") !== `${newColor}p`) return;

          this.board.removePieceElement(newSq);
          el.remove();
          this.spawn(newPiece, newSq);
        };

        if (dur <= 0) {
          replacePromo();
        } else {
          window.setTimeout(replacePromo, dur);
        }

        matchedOld.add(oldSq);
        matchedNew.add(newSq);
        break;
      }
    }

    for (const [oldSq] of oldRemaining) {
      if (!matchedOld.has(oldSq)) this.discard(oldSq);
    }

    for (const [newSq, newPiece] of newRemaining) {
      if (matchedNew.has(newSq)) continue;
      if (this.board.getPieceElement(newSq)) this.discard(newSq);
      this.spawn(newPiece, newSq);
    }
  }
}
