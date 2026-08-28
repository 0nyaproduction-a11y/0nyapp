import type {
  BillingHarnessScenario,
  BillingPurchaseResult,
  BillingRestoreResult,
  BillingService,
  StoreProduct,
} from "./types";

const plusProduct: StoreProduct = {
  billingPeriodLabel: "Store price not configured",
  coinAmount: null,
  displayName: "0nya Plus",
  googleProductId: null,
  kind: "subscription",
  localizedPrice: null,
  productCode: "0nya_plus",
  status: "not_configured",
};

function productFromCoinPack(product: { code: string; coinAmount: number; displayName: string }): StoreProduct {
  return {
    billingPeriodLabel: null,
    coinAmount: product.coinAmount,
    displayName: product.displayName,
    googleProductId: null,
    kind: "coin_pack",
    localizedPrice: null,
    productCode: product.code,
    status: "not_configured",
  };
}

function purchaseStatusForScenario(
  scenario: BillingHarnessScenario,
): BillingPurchaseResult["status"] {
  switch (scenario) {
    case "PURCHASE_SUCCESS":
      return "success";
    case "USER_CANCELLED":
      return "cancelled";
    case "PURCHASE_DECLINED":
      return "declined";
    case "PURCHASE_PENDING":
      return "pending";
    case "SERVICE_DISCONNECTED":
      return "service_disconnected";
    case "NETWORK_ERROR":
      return "network_error";
    case "PRODUCT_UNAVAILABLE":
      return "product_unavailable";
    case "ALREADY_PROCESSED":
      return "already_processed";
    case "INVALID_PRODUCT":
      return "invalid_product";
    default:
      return "not_configured";
  }
}

function restoreStatusForScenario(
  scenario: BillingHarnessScenario,
): BillingRestoreResult["status"] {
  switch (scenario) {
    case "RESTORE_FOUND":
      return "found";
    case "RESTORE_EMPTY":
      return "empty";
    case "SUBSCRIPTION_ACTIVE":
      return "subscription_active";
    case "SUBSCRIPTION_EXPIRED":
      return "subscription_expired";
    case "SUBSCRIPTION_CANCELLED":
      return "subscription_cancelled";
    case "SERVICE_DISCONNECTED":
      return "service_disconnected";
    case "NETWORK_ERROR":
      return "network_error";
    default:
      return "empty";
  }
}

export function createDevelopmentBillingHarness(coinProducts: StoreProduct[] = []): BillingService {
  return {
    isHarness: true,
    async getProducts(kind) {
      const products = [...coinProducts, plusProduct];
      return kind ? products.filter((product) => product.kind === kind) : products;
    },
    async purchase(product, scenario = "PURCHASE_SUCCESS") {
      return {
        googleProductId: product.googleProductId,
        kind: product.kind,
        productCode: product.productCode,
        scenario,
        status: purchaseStatusForScenario(scenario),
        testOnly: true,
      };
    },
    async restore(scenario = "RESTORE_EMPTY") {
      const status = restoreStatusForScenario(scenario);
      const shouldReturnPurchase = status === "found" || status === "subscription_active";

      return {
        purchases: shouldReturnPurchase
          ? [
              {
                googleProductId: plusProduct.googleProductId,
                kind: "subscription",
                productCode: plusProduct.productCode,
                scenario,
                status: "success",
                testOnly: true,
              },
            ]
          : [],
        scenario,
        status,
        testOnly: true,
      };
    },
  };
}

export function mapCoinProductsToStoreProducts(
  products: { code: string; coinAmount: number; displayName: string }[],
) {
  return products.map(productFromCoinPack);
}
