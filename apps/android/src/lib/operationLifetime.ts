// Each screen/focus generation owns its asynchronous effects independently.
export function createOperationLifetime(initiallyActive: boolean) {
  let active = initiallyActive;
  return {
    activate() { active = true; },
    cancel() { active = false; },
    isActive() { return active; },
  };
}
