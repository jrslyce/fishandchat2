/**
 * The entire GDD loop (cast lock, bite reaction, modal confirm) is driven by
 * one action intent, unified across Space, left click/tap, and Enter. Systems
 * consume `justPressed()`/`justReleased()` edges; hold duration is exposed for
 * the cast-gauge lock timing in Phase 2.
 */
export class InputController {
  private held = false;
  private pressedThisFrame = false;
  private releasedThisFrame = false;
  private pressStartedAt = 0;
  private lastHoldDuration = 0;
  public lastClickEvent: PointerEvent | null = null;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!this.isActionKey(event.code)) return;
    event.preventDefault();
    this.lastClickEvent = null;
    this.press();
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    if (!this.isActionKey(event.code)) return;
    event.preventDefault();
    this.release();
  };

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    this.lastClickEvent = event;
    this.press();
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    event.preventDefault();
    this.release();
  };

  private readonly onPointerCancel = () => {
    if (this.held) this.release();
  };

  constructor(private readonly actionSurface: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.actionSurface.addEventListener('pointerdown', this.onPointerDown);
    this.actionSurface.addEventListener('pointerup', this.onPointerUp);
    this.actionSurface.addEventListener('pointercancel', this.onPointerCancel);
    this.actionSurface.addEventListener('pointerleave', this.onPointerCancel);
  }

  /** Call once per frame after reading edges. */
  update(): void {
    this.pressedThisFrame = false;
    this.releasedThisFrame = false;
  }

  justPressed(): boolean {
    return this.pressedThisFrame;
  }
  
  consumePress(): void {
    this.pressedThisFrame = false;
    this.held = false;
  }

  /**
   * Swallows the press edge but leaves `held` intact, so the caller can claim
   * "a press happened this frame" and still measure how long the gesture runs.
   * consumePress() drops both, which is what a one-shot toggle wants but would
   * blind a hold-duration check (see Game.ts's long-press-to-walk).
   */
  consumePressEdge(): void {
    this.pressedThisFrame = false;
  }

  justReleased(): boolean {
    return this.releasedThisFrame;
  }

  isHeld(): boolean {
    return this.held;
  }

  /** Duration in seconds of the most recently completed press. */
  lastHoldSeconds(): number {
    return this.lastHoldDuration;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.actionSurface.removeEventListener('pointerdown', this.onPointerDown);
    this.actionSurface.removeEventListener('pointerup', this.onPointerUp);
    this.actionSurface.removeEventListener('pointercancel', this.onPointerCancel);
    this.actionSurface.removeEventListener('pointerleave', this.onPointerCancel);
  }

  private press(): void {
    if (this.held) return;
    this.held = true;
    this.pressedThisFrame = true;
    this.pressStartedAt = performance.now();
  }

  private release(): void {
    if (!this.held) return;
    this.held = false;
    this.releasedThisFrame = true;
    this.lastHoldDuration = (performance.now() - this.pressStartedAt) / 1000;
  }

  private isActionKey(code: string): boolean {
    return code === 'Space' || code === 'Enter';
  }
}
