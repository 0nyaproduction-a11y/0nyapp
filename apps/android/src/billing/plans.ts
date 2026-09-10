import type { PlusBillingPlan, PlusPlanIdentity, StoreProduct } from "./types";

export const PLUS_BILLING_PLANS: ReadonlyArray<{
  billingPlan: PlusBillingPlan;
  billingPeriodLabel: string;
  cadenceNoun: "week" | "month" | "year";
}> = [
  { billingPlan: "weekly", billingPeriodLabel: "Per week", cadenceNoun: "week" },
  { billingPlan: "monthly", billingPeriodLabel: "Per month", cadenceNoun: "month" },
  { billingPlan: "yearly", billingPeriodLabel: "Per year", cadenceNoun: "year" },
];

export const PLUS_PLAN_IDENTITIES: readonly PlusPlanIdentity[] = [
  {
    billingPlan: "weekly",
    productCode: "0nya_plus_weekly",
    googleProductId: "0nya_plus_weekly",
    basePlanId: "weekly",
    offerPurpose: "normal",
  },
  {
    billingPlan: "monthly",
    productCode: "0nya_plus_monthly",
    googleProductId: "0nya_plus_monthly",
    basePlanId: "monthly",
    offerPurpose: "normal",
  },
  {
    billingPlan: "yearly",
    productCode: "0nya_plus_yearly",
    googleProductId: "0nya_plus_yearly",
    basePlanId: "yearly",
    offerPurpose: "normal",
  },
  {
    billingPlan: "monthly",
    productCode: "0nya_plus_referral_monthly",
    googleProductId: "0nya_plus_monthly",
    basePlanId: "monthly",
    offerPurpose: "referral_intro",
    offerTag: "referral-monthly",
  },
];

export function createUnconfiguredPlusPlanProducts(): StoreProduct[] {
  return PLUS_PLAN_IDENTITIES.map((identity) => ({
    billingPeriodLabel:
      PLUS_BILLING_PLANS.find((plan) => plan.billingPlan === identity.billingPlan)
        ?.billingPeriodLabel ?? null,
    billingPlan: identity.billingPlan,
    coinAmount: null,
    displayName: "0nya Plus",
    googleProductId: identity.googleProductId,
    kind: "subscription",
    localizedPrice: null,
    offerPurpose: identity.offerPurpose,
    productCode: identity.productCode,
    status: "not_configured",
  }));
}
