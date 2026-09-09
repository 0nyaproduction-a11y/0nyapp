/** One owner per screen/context. Every retry supersedes earlier work. */
export function createScreenRequestOwner(context?: unknown) {
  let generation = 0;
  return {
    context,
    capture() {
      const request = generation;
      return () => generation === request;
    },
    begin() {
      const request = ++generation;
      return () => generation === request;
    },
    invalidate() { generation += 1; },
  };
}

export type ScreenRequestOwner = ReturnType<typeof createScreenRequestOwner>;

/** Required content never waits for optional personalization. Both share ownership. */
export function loadScreenResources<Required, Optional>(options: {
  owner: ScreenRequestOwner;
  loadRequired: () => Promise<Required>;
  onRequired: (data: Required) => void;
  onRequiredError: (error: unknown) => void;
  onRequiredSettled: () => void;
  loadOptional?: () => Promise<Optional>;
  onOptional?: (data: Optional) => void;
  onOptionalError?: (error: unknown) => void;
}) {
  const isCurrent = options.owner.begin();
  const required = Promise.resolve().then(options.loadRequired).then(
    (data) => { if (isCurrent()) options.onRequired(data); },
    (error: unknown) => { if (isCurrent()) options.onRequiredError(error); },
  ).finally(() => { if (isCurrent()) options.onRequiredSettled(); });
  if (options.loadOptional) {
    void Promise.resolve().then(options.loadOptional).then(
      (data) => { if (isCurrent()) options.onOptional?.(data); },
      (error: unknown) => { if (isCurrent()) options.onOptionalError?.(error); },
    );
  }
  return required;
}
