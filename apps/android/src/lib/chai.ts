import { submitShortFilmChaiTip } from "./api";

export function createChaiIdempotencyKey() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function sendShortFilmChaiTip(
  accessToken: string,
  shortFilmSlug: string,
  coinAmount: number,
  idempotencyKey: string,
) {
  return submitShortFilmChaiTip(accessToken, shortFilmSlug, coinAmount, idempotencyKey);
}
