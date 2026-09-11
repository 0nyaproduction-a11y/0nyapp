// @ts-expect-error node:test resolves at runtime via tsx; the project tsconfig uses
// bundler resolution without a node lib/types condition, so the `node:` specifier
// is not statically resolvable by tsc here.
import { test } from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";
import {
  checkReferralEligibility,
  createUnconfiguredPlusPlanProducts,
  normalizePlusPlans,
} from "./plans";
import type { StoreProduct } from "./types";

test("normalizePlusPlans returns exactly 3 public plans (Weekly, Monthly, Yearly)", () => {
  const unconfigured = createUnconfiguredPlusPlanProducts();
  const plansNormal = normalizePlusPlans(unconfigured, false);
  assert.equal(plansNormal.length, 3);
  assert.equal(plansNormal[0].cadence, "weekly");
  assert.equal(plansNormal[1].cadence, "monthly");
  assert.equal(plansNormal[2].cadence, "yearly");

  const plansReferred = normalizePlusPlans(unconfigured, true);
  assert.equal(plansReferred.length, 3);
  assert.equal(plansReferred[0].cadence, "weekly");
  assert.equal(plansReferred[1].cadence, "monthly");
  assert.equal(plansReferred[2].cadence, "yearly");
});

test("for normal user, Monthly has no referral offer active and points to base product", () => {
  const mockProducts: StoreProduct[] = [
    {
      billingPeriodLabel: "Per week",
      billingPlan: "weekly",
      coinAmount: null,
      displayName: "0nya Plus Weekly",
      googleProductId: "0nya_plus_weekly",
      kind: "subscription",
      localizedPrice: "?49",
      offerPurpose: "normal",
      productCode: "0nya_plus_weekly",
      status: "available",
      offerToken: "tok-weekly",
    },
    {
      billingPeriodLabel: "Per month",
      billingPlan: "monthly",
      coinAmount: null,
      displayName: "0nya Plus Monthly",
      googleProductId: "0nya_plus_monthly",
      kind: "subscription",
      localizedPrice: "?149",
      offerPurpose: "normal",
      productCode: "0nya_plus_monthly",
      status: "available",
      offerToken: "tok-monthly-normal",
    },
    {
      billingPeriodLabel: "Per month",
      billingPlan: "monthly",
      coinAmount: null,
      displayName: "0nya Plus Referral",
      googleProductId: "0nya_plus_monthly",
      kind: "subscription",
      localizedPrice: "?99",
      offerPurpose: "referral_intro",
      productCode: "0nya_plus_referral_monthly",
      status: "available",
      offerToken: "tok-monthly-referral",
    },
    {
      billingPeriodLabel: "Per year",
      billingPlan: "yearly",
      coinAmount: null,
      displayName: "0nya Plus Yearly",
      googleProductId: "0nya_plus_yearly",
      kind: "subscription",
      localizedPrice: "?999",
      offerPurpose: "normal",
      productCode: "0nya_plus_yearly",
      status: "available",
      offerToken: "tok-yearly",
    },
  ];

  const plans = normalizePlusPlans(mockProducts, false);
  assert.equal(plans.length, 3);

  const monthly = plans[1];
  assert.equal(monthly.cadence, "monthly");
  assert.equal(monthly.hasActiveReferralOffer, false);
  assert.equal(monthly.purchasableProduct.productCode, "0nya_plus_monthly");
  assert.equal(monthly.purchasableProduct.offerToken, "tok-monthly-normal");
});

test("for referred user, Monthly activates referral offer and purchasableProduct is referral SKU", () => {
  const mockProducts: StoreProduct[] = [
    {
      billingPeriodLabel: "Per week",
      billingPlan: "weekly",
      coinAmount: null,
      displayName: "0nya Plus Weekly",
      googleProductId: "0nya_plus_weekly",
      kind: "subscription",
      localizedPrice: "?49",
      offerPurpose: "normal",
      productCode: "0nya_plus_weekly",
      status: "available",
      offerToken: "tok-weekly",
    },
    {
      billingPeriodLabel: "Per month",
      billingPlan: "monthly",
      coinAmount: null,
      displayName: "0nya Plus Monthly",
      googleProductId: "0nya_plus_monthly",
      kind: "subscription",
      localizedPrice: "?149",
      offerPurpose: "normal",
      productCode: "0nya_plus_monthly",
      status: "available",
      offerToken: "tok-monthly-normal",
    },
    {
      billingPeriodLabel: "Per month",
      billingPlan: "monthly",
      coinAmount: null,
      displayName: "0nya Plus Referral",
      googleProductId: "0nya_plus_monthly",
      kind: "subscription",
      localizedPrice: "?99",
      offerPurpose: "referral_intro",
      productCode: "0nya_plus_referral_monthly",
      status: "available",
      offerToken: "tok-monthly-referral",
    },
    {
      billingPeriodLabel: "Per year",
      billingPlan: "yearly",
      coinAmount: null,
      displayName: "0nya Plus Yearly",
      googleProductId: "0nya_plus_yearly",
      kind: "subscription",
      localizedPrice: "?999",
      offerPurpose: "normal",
      productCode: "0nya_plus_yearly",
      status: "available",
      offerToken: "tok-yearly",
    },
  ];

  const plans = normalizePlusPlans(mockProducts, true);
  assert.equal(plans.length, 3);

  const monthly = plans[1];
  assert.equal(monthly.cadence, "monthly");
  assert.equal(monthly.hasActiveReferralOffer, true);
  assert.equal(monthly.purchasableProduct.productCode, "0nya_plus_referral_monthly");
  assert.equal(monthly.purchasableProduct.offerToken, "tok-monthly-referral");
  assert.equal(monthly.referralOfferProduct?.localizedPrice, "?99");
  assert.equal(monthly.baseProduct.localizedPrice, "?149");
});

test("checkReferralEligibility recognizes route params and metadata", () => {
  assert.equal(checkReferralEligibility(null, null), false);
  assert.equal(checkReferralEligibility(null, { isReferred: false }), false);
  assert.equal(checkReferralEligibility(null, { isReferred: true }), true);
  assert.equal(checkReferralEligibility(null, { referralCode: "FRIEND123" }), true);

  assert.equal(
    checkReferralEligibility({ user: { user_metadata: { is_referred: true } } }, null),
    true,
  );
  assert.equal(
    checkReferralEligibility({ user: { user_metadata: { referral_code: "REF99" } } }, null),
    true,
  );
  assert.equal(
    checkReferralEligibility({ user: { app_metadata: { is_referred: true } } }, null),
    true,
  );
  assert.equal(
    checkReferralEligibility({ user: { user_metadata: {} } }, null),
    false,
  );
});
