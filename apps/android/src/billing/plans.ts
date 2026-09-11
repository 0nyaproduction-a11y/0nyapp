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

export type NormalizedPlusPlan = {
  cadence: PlusBillingPlan;
  title: string;
  baseProduct: StoreProduct;
  referralOfferProduct?: StoreProduct | null;
  purchasableProduct: StoreProduct;
  hasActiveReferralOffer: boolean;
};

export function checkReferralEligibility(
  session?: { user?: { user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } } | null,
  routeParams?: { isReferred?: boolean; referralCode?: string } | null,
): boolean {
  if (routeParams?.isReferred === true || Boolean(routeParams?.referralCode)) {
    return true;
  }
  const userMeta = session?.user?.user_metadata;
  if (userMeta?.is_referred === true || Boolean(userMeta?.referral_code) || Boolean(userMeta?.referred_by)) {
    return true;
  }
  const appMeta = session?.user?.app_metadata;
  if (appMeta?.is_referred === true || Boolean(appMeta?.referral_code) || Boolean(appMeta?.referred_by)) {
    return true;
  }
  return false;
}

export function normalizePlusPlans(
  products: StoreProduct[],
  isReferredUser: boolean,
): NormalizedPlusPlan[] {
  const unconfigured = createUnconfiguredPlusPlanProducts();
  const mergedProducts = unconfigured.map((fallback) => {
    const matched = products.find((p) => p.productCode === fallback.productCode);
    return matched
      ? {
          ...fallback,
          ...matched,
          localizedPrice: matched.localizedPrice || fallback.localizedPrice,
        }
      : fallback;
  });

  const weeklyProduct =
    mergedProducts.find((p) => p.productCode === "0nya_plus_weekly") ??
    mergedProducts.find((p) => p.billingPlan === "weekly")!;

  const monthlyNormalProduct =
    mergedProducts.find((p) => p.productCode === "0nya_plus_monthly") ??
    mergedProducts.find((p) => p.billingPlan === "monthly" && p.offerPurpose === "normal")!;

  const yearlyProduct =
    mergedProducts.find((p) => p.productCode === "0nya_plus_yearly") ??
    mergedProducts.find((p) => p.billingPlan === "yearly")!;

  const monthlyReferralProduct =
    mergedProducts.find((p) => p.productCode === "0nya_plus_referral_monthly") ??
    mergedProducts.find((p) => p.billingPlan === "monthly" && p.offerPurpose === "referral_intro") ??
    null;

  const hasActiveReferralOffer = Boolean(isReferredUser && monthlyReferralProduct);

  const weeklyPlan: NormalizedPlusPlan = {
    cadence: "weekly",
    title: "Weekly",
    baseProduct: weeklyProduct,
    purchasableProduct: weeklyProduct,
    hasActiveReferralOffer: false,
  };

  const monthlyPlan: NormalizedPlusPlan = {
    cadence: "monthly",
    title: "Monthly",
    baseProduct: monthlyNormalProduct,
    referralOfferProduct: monthlyReferralProduct,
    purchasableProduct:
      hasActiveReferralOffer && monthlyReferralProduct
        ? monthlyReferralProduct
        : monthlyNormalProduct,
    hasActiveReferralOffer,
  };

  const yearlyPlan: NormalizedPlusPlan = {
    cadence: "yearly",
    title: "Yearly",
    baseProduct: yearlyProduct,
    purchasableProduct: yearlyProduct,
    hasActiveReferralOffer: false,
  };

  return [weeklyPlan, monthlyPlan, yearlyPlan];
}
