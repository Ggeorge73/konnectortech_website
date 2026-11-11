// Shared between the page markup (reveal thresholds) and the 3D engine, so text and scene stay in step.
// Each value is a scene's local progress, 0 at its start and 1 at its end.
export const GAP_AT = [0.5, 0.6, 0.7] as const; // scene 2: the three gap labels appear
export const SERVICE_AT = [0.2, 0.38, 0.56, 0.74] as const; // scene 3: service panels dock onto the line
export const GATE_AT = [0.16, 0.31, 0.52, 0.67, 0.82] as const; // scene 4: each gate locks as the sphere passes
export const BLOCK_AT = 0.4; // scene 4: the amber block rises between gates 2 and 3
export const ACCEPTED_AT = GATE_AT[3]; // the Accepted dial turns green at gate 4
