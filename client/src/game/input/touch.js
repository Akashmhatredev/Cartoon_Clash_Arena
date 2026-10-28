// Shared touch state. TouchControls.vue writes `mask`; the input manager merges it into P1.
export const touchInput = { mask: 0 };

export function resetTouch() {
  touchInput.mask = 0;
}
