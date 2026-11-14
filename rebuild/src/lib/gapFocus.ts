// Which gap in scene 2 the visitor is looking at. The cards in the page text write it; the 3D scene reads it.
// pinned: chosen by click, tap, Enter or Space. hover: a passing preview from the mouse or keyboard focus.
export const gapFocus = {
  pinned: -1,
  hover: -1,
  /** The gap to show (0, 1 or 2), or -1 for none. A preview wins over the pinned one while it lasts. */
  get active() { return this.hover >= 0 ? this.hover : this.pinned; },
};
