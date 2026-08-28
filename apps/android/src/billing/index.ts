import { getMobileEnv } from "../config/env";
import type { WalletResponse } from "../types/api";
import { createDevelopmentBillingHarness, mapCoinProductsToStoreProducts } from "./devHarness";
import { createGooglePlayBillingService } from "./googlePlay";

export function getBillingService(wallet?: WalletResponse | null) {
  const coinProducts = mapCoinProductsToStoreProducts(wallet?.coinProducts ?? []);
  const { devBillingHarnessEnabled } = getMobileEnv();

  if (__DEV__ && devBillingHarnessEnabled) {
    return createDevelopmentBillingHarness(coinProducts);
  }

  return createGooglePlayBillingService(coinProducts);
}

export type {
  BillingHarnessScenario,
  BillingProductKind,
  BillingPurchaseResult,
  BillingRestoreResult,
  BillingService,
  StoreProduct,
} from "./types";
