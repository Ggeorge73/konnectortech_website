// Shared between the page markup (reveal thresholds) and the 3D scene, so text and scene stay in step.
// Each value is a scene's local progress, 0 at its start and 1 at its end (measured at the viewport's midline).
// The story is about eleven screen heights: scenes 1 to 5 and 7 are 100, 150, 200, 250, 100 and 150 svh.
// A panel is pinned for the middle part of its scene, so every reveal below falls inside that pinned part.
export const GAP_AT = [0.5, 0.55, 0.6] as const; // scene 2 (pinned 0.33 to 0.67): the three gap labels appear
export const SERVICE_AT = [0.28, 0.4, 0.52, 0.64] as const; // scene 3 (pinned 0.25 to 0.75): service panels dock onto the line
export const GATE_AT = [0.24, 0.36, 0.5, 0.62, 0.74] as const; // scene 4 (pinned 0.2 to 0.8): each gate locks as the sphere passes
export const BLOCK_AT = 0.43; // scene 4: the amber block has risen between gates 2 and 3
export const ACCEPTED_AT = GATE_AT[3]; // the Accepted dial turns green at gate 4
