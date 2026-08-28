import type { BillingPurchaseResult, BillingRestoreResult, BillingService, StoreProduct } from "./types";

export function createGooglePlayBillingService(products: StoreProduct[] = []): BillingService {
  return {
    isHarness: false,
    async getProducts(kind) {
      const filteredProducts = kind ? products.filter((product) => product.kind === kind) : products;
      return filteredProducts.map((product) => ({
        ...product,
        status: product.googleProductId ? product.status : "not_configured",
      }));
    },
    async purchase(product): Promise<BillingPurchaseResult> {
      return {
        googleProductId: product.googleProductId,
        kind: product.kind,
        productCode: product.productCode,
        status: "not_configured",
        testOnly: false,
      };
    },
    async restore(): Promise<BillingRestoreResult> {
      return {
        purchases: [],
        status: "not_configured",
        testOnly: false,
      };
    },
  };
}
