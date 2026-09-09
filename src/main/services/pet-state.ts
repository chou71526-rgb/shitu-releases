export type PetState = "idle" | "drag-near" | "drag-valid" | "ingesting" | "saved" | "analyzing" | "completed" | "failed";
export type PetEvent = "DRAG_NEAR" | "DRAG_VALID" | "DROP" | "LOCAL_SAVED" | "AI_STARTED" | "AI_DONE" | "FAIL" | "RESET";

const transitions: Record<PetState, Partial<Record<PetEvent, PetState>>> = {
  idle: { DRAG_NEAR: "drag-near", DRAG_VALID: "drag-valid", RESET: "idle" },
  "drag-near": { DRAG_VALID: "drag-valid", RESET: "idle" },
  "drag-valid": { DROP: "ingesting", RESET: "idle" },
  ingesting: { LOCAL_SAVED: "saved", FAIL: "failed" },
  saved: { AI_STARTED: "analyzing", AI_DONE: "completed", RESET: "idle" },
  analyzing: { AI_DONE: "completed", FAIL: "failed" },
  completed: { RESET: "idle" },
  failed: { RESET: "idle" },
};

export function transitionPet(state: PetState, event: PetEvent): PetState { return transitions[state][event] ?? state; }
