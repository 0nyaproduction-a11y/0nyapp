import { getMobileEnv } from "../config/env";
import type { WalletResponse } from "../types/api";
import { createDevelopmentBillingHarness, mapCoinProductsToStoreProducts } from "./devHarness";
import { createGooglePlayBillingService } from "./googlePlay";
import { createUnconfiguredPlusPlanProducts } from "./plans";

export function getBillingService(wallet?: WalletResponse | null) {
  const coinProducts = mapCoinProductsToStoreProducts(wallet?.coinProducts ?? []);
  const plusProducts = createUnconfiguredPlusPlanProducts();
  const { devBillingHarnessEnabled } = getMobileEnv();

  if (__DEV__ && devBillingHarnessEnabled) {
    return createDevelopmentBillingHarness([...coinProducts, ...plusProducts]);
  }

  return createGooglePlayBillingService([...coinProducts, ...plusProducts]);
}

export { PLUS_BILLING_PLANS, createUnconfiguredPlusPlanProducts } from "./plans";

export type {
  BillingHarnessScenario,
  BillingProductKind,
  BillingPurchaseResult,
  BillingRestoreResult,
  BillingService,
  PlusBillingPlan,
  StoreProduct,
} from "./types";
