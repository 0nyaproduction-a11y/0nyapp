export type BillingProductKind = "coin_pack" | "subscription";

export type PlusBillingPlan = "weekly" | "monthly" | "yearly";

export interface PlusPlanIdentity {
  billingPlan: PlusBillingPlan;
  productCode: string;
  googleProductId: string;
  basePlanId: string;
  offerPurpose: "normal" | "referral_intro";
  offerTag?: string;
}

export type BillingHarnessScenario =
  | "PURCHASE_SUCCESS"
  | "USER_CANCELLED"
  | "PURCHASE_DECLINED"
  | "PURCHASE_PENDING"
  | "SERVICE_DISCONNECTED"
  | "NETWORK_ERROR"
  | "PRODUCT_UNAVAILABLE"
  | "ALREADY_PROCESSED"
  | "INVALID_PRODUCT"
  | "RESTORE_FOUND"
  | "RESTORE_EMPTY"
  | "SUBSCRIPTION_ACTIVE"
  | "SUBSCRIPTION_EXPIRED"
  | "SUBSCRIPTION_CANCELLED";

export type StoreProduct = {
  billingPeriodLabel: string | null;
  billingPlan?: PlusBillingPlan | null;
  coinAmount: number | null;
  displayName: string;
  googleProductId: string | null;
  kind: BillingProductKind;
  localizedPrice: string | null;
  offerPurpose?: PlusPlanIdentity["offerPurpose"];
  productCode: string;
  status: "available" | "not_configured" | "unavailable";
  offerToken?: string | null;
};

export type BillingPurchaseResult = {
  billingPlan?: PlusBillingPlan | null;
  googleProductId: string | null;
  kind: BillingProductKind;
  productCode: string;
  scenario?: BillingHarnessScenario;
  status:
    | "success"
    | "cancelled"
    | "declined"
    | "pending"
    | "service_disconnected"
    | "network_error"
    | "product_unavailable"
    | "already_processed"
    | "invalid_product"
    | "not_configured"
    | "purchase_received_requires_verification";
  testOnly: boolean;
  orderId?: string | null;
  purchaseToken?: string | null;
  offerToken?: string | null;
  acknowledged?: boolean;
};

export type BillingRestoreResult = {
  purchases: BillingPurchaseResult[];
  scenario?: BillingHarnessScenario;
  status:
    | "found"
    | "empty"
    | "service_disconnected"
    | "network_error"
    | "subscription_active"
    | "subscription_expired"
    | "subscription_cancelled"
    | "not_configured";
  testOnly: boolean;
};

export type BillingService = {
  isHarness: boolean;
  getProducts(kind?: BillingProductKind): Promise<StoreProduct[]>;
  purchase(
    product: StoreProduct,
    scenario?: BillingHarnessScenario,
  ): Promise<BillingPurchaseResult>;
  restore(scenario?: BillingHarnessScenario): Promise<BillingRestoreResult>;
};
