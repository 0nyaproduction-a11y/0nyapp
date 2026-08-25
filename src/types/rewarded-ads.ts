export type RewardedAdAttemptStatus =
  | "pending"
  | "granted"
  | "expired"
  | "failed"
  | "unsupported_pending_policy"
  | "already_accessible"
  | "rewarded_disabled"
  | "not_found";

export type RewardedAdAttemptResponse = {
  customData: string | null;
  expiresAt: string | null;
  status: RewardedAdAttemptStatus;
};
