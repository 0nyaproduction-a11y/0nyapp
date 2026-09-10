import type {
  BillingProductKind,
  BillingPurchaseResult,
  BillingRestoreResult,
  BillingService,
  PlusBillingPlan,
  StoreProduct,
} from "./types";
import * as IAP from "expo-iap";
import type { PlusPlanIdentity } from "./types";
import { PLUS_PLAN_IDENTITIES } from "./plans";

// W3-A: finishTransaction is intentionally absent.
// W3-B (server verification) or a post-verification client step must call:
//   IAP.finishTransaction({ purchase, isConsumable: kind === "coin_pack" })
// only after backend confirms successful verification and entitlement grant.

type InFlightPurchase = {
  resolve: (purchase: IAP.Purchase) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

let connectionPromise: Promise<boolean> | null = null;
let listenerSubscription: { remove: () => void } | null = null;
let errorSubscription: { remove: () => void } | null = null;
let inFlightPurchase: InFlightPurchase | null = null;

function ensureListeners() {
  if (!listenerSubscription) {
    listenerSubscription = IAP.purchaseUpdatedListener((purchase) => {
      if (inFlightPurchase) {
        clearTimeout(inFlightPurchase.timeoutId);
        inFlightPurchase.resolve(purchase);
        inFlightPurchase = null;
      }
    });
    errorSubscription = IAP.purchaseErrorListener((error) => {
      if (inFlightPurchase) {
        clearTimeout(inFlightPurchase.timeoutId);
        inFlightPurchase.reject(new Error(error.message || "Purchase failed"));
        inFlightPurchase = null;
      }
    });
  }
}

async function ensureConnection(): Promise<boolean> {
  if (connectionPromise) return connectionPromise;
  ensureListeners();
  connectionPromise = IAP.initConnection();
  return connectionPromise;
}

function lookupPlanIdentity(
  productId: string,
  billingPlan?: PlusBillingPlan | null,
  productCode?: string | null,
): PlusPlanIdentity | undefined {
  if (productCode) {
    const exact = PLUS_PLAN_IDENTITIES.find((plan) => plan.productCode === productCode);
    if (exact) return exact;
  }
  return PLUS_PLAN_IDENTITIES.find(
    (p) => p.googleProductId === productId || (billingPlan != null && p.billingPlan === billingPlan),
  );
}

function resolveOfferTokenForPlan(
  subscription: IAP.ProductSubscription,
  identity: PlusPlanIdentity,
): string | null {
  const offers = subscription.subscriptionOffers;
  if (!offers || offers.length === 0) {
    return null;
  }

  if (identity.offerPurpose === "referral_intro" && identity.offerTag) {
    const matched = offers.find((o) =>
      o.basePlanIdAndroid === identity.basePlanId &&
      (o.offerTagsAndroid ?? []).includes(identity.offerTag!),
    );
    return matched?.offerTokenAndroid ?? null;
  }

  const matched = offers.find(
    (offer) =>
      offer.basePlanIdAndroid === identity.basePlanId &&
      (offer.offerTagsAndroid ?? []).length === 0,
  );
  return matched?.offerTokenAndroid ?? null;
}

function mapStoreProduct(
  item: IAP.Product | IAP.ProductSubscription,
  identity?: PlusPlanIdentity,
): StoreProduct {
  const isSubscription = item.type === "subs";
  const subscription = isSubscription ? (item as IAP.ProductSubscription) : null;
  const matchedOffer = identity
    ? subscription?.subscriptionOffers?.find((o) =>
        identity.offerPurpose === "referral_intro" && identity.offerTag
          ? o.basePlanIdAndroid === identity.basePlanId &&
            (o.offerTagsAndroid ?? []).includes(identity.offerTag!)
          : o.basePlanIdAndroid === identity.basePlanId &&
            (o.offerTagsAndroid ?? []).length === 0,
      )
    : subscription?.subscriptionOffers?.[0];

  return {
    billingPeriodLabel: identity
      ? identity.billingPlan === "weekly"
        ? "Per week"
        : identity.billingPlan === "monthly"
          ? "Per month"
          : "Per year"
      : matchedOffer?.period?.unit === "week"
        ? "Per week"
        : matchedOffer?.period?.unit === "month"
          ? "Per month"
          : matchedOffer?.period?.unit === "year"
            ? "Per year"
            : null,
    billingPlan: identity?.billingPlan ?? null,
    coinAmount: null,
    displayName: item.displayName || item.title,
    googleProductId: item.id,
    kind: isSubscription ? "subscription" : "coin_pack",
    localizedPrice: matchedOffer?.displayPrice ?? item.displayPrice,
    offerPurpose: identity?.offerPurpose,
    productCode: identity?.productCode ?? item.id,
    status: identity && !matchedOffer ? "unavailable" : "available",
    offerToken: matchedOffer?.offerTokenAndroid ?? null,
  };
}

function mapPurchase(
  purchase: IAP.Purchase,
  kind: BillingProductKind,
  offerToken: string | null,
  requiresVerification = false,
): BillingPurchaseResult {
  const androidPurchase = purchase as IAP.PurchaseAndroid;
  const billingPlan =
    kind === "subscription"
      ? (() => {
          const currentPlanId = androidPurchase.currentPlanId ?? purchase.productId;
          const identity = PLUS_PLAN_IDENTITIES.find(
            (p) => p.googleProductId === currentPlanId || p.basePlanId === currentPlanId,
          );
          return identity?.billingPlan ?? null;
        })()
      : null;

  return {
    billingPlan,
    googleProductId: purchase.productId,
    kind,
    productCode: purchase.productId,
    status: requiresVerification
      ? "purchase_received_requires_verification"
      : "success",
    testOnly: false,
    orderId: purchase.id,
    purchaseToken: purchase.purchaseToken ?? null,
    offerToken,
    acknowledged: androidPurchase.isAcknowledgedAndroid ?? false,
  };
}

function inferKind(
  purchase: IAP.Purchase,
  productKindMap: Map<string, BillingProductKind>,
): BillingProductKind {
  return productKindMap.get(purchase.productId) || "coin_pack";
}

export function createGooglePlayBillingService(
  products: StoreProduct[] = [],
): BillingService {
  const productKindMap = new Map(
    products
      .filter((p) => p.googleProductId)
      .map((p) => [p.googleProductId!, p.kind]),
  );

  return {
    isHarness: false,
    async getProducts(kind) {
      await ensureConnection();

      const filtered = kind
        ? products.filter((product) => product.kind === kind)
        : products;
      const skus = [...new Set(filtered
        .map((p) => p.googleProductId)
        .filter((id): id is string => id != null))];

      if (skus.length === 0) {
        return [];
      }

      const queryType =
        kind === "subscription"
          ? "subs"
          : kind === "coin_pack"
            ? "in-app"
            : "all";
      const result = await IAP.fetchProducts({ skus, type: queryType });

      if (!result || result.length === 0) {
        return [];
      }

      return result.flatMap((item) => {
        const identities = PLUS_PLAN_IDENTITIES.filter(
          (identity) => identity.googleProductId === item.id,
        );
        if (identities.length === 0) return [mapStoreProduct(item)];
        return identities.map((identity) => mapStoreProduct(item, identity));
      });
    },

    async purchase(product): Promise<BillingPurchaseResult> {
      if (inFlightPurchase) {
        return {
          billingPlan: product.billingPlan,
          googleProductId: product.googleProductId,
          kind: product.kind,
          productCode: product.productCode,
          status: "already_processed",
          testOnly: false,
          orderId: null,
          purchaseToken: null,
          offerToken: product.offerToken ?? null,
          acknowledged: false,
        };
      }

      await ensureConnection();

      if (!product.googleProductId) {
        return {
          billingPlan: product.billingPlan,
          googleProductId: null,
          kind: product.kind,
          productCode: product.productCode,
          status: "invalid_product",
          testOnly: false,
          orderId: null,
          purchaseToken: null,
          offerToken: product.offerToken ?? null,
          acknowledged: false,
        };
      }

      const identity = lookupPlanIdentity(
        product.googleProductId,
        product.billingPlan,
        product.productCode,
      );
      const isSubscription = product.kind === "subscription";

      if (isSubscription && !identity) {
        return {
          billingPlan: product.billingPlan,
          googleProductId: product.googleProductId,
          kind: product.kind,
          productCode: product.productCode,
          status: "invalid_product",
          testOnly: false,
          orderId: null,
          purchaseToken: null,
          offerToken: null,
          acknowledged: false,
        };
      }

      try {
        let resolve!: (value: IAP.Purchase) => void;
        let reject!: (error: Error) => void;
        const timeoutId = setTimeout(() => {
          inFlightPurchase = null;
          reject(new Error("Purchase timeout"));
        }, 10 * 60 * 1000);

        const purchasePromise = new Promise<IAP.Purchase>((res, rej) => {
          resolve = res;
          reject = rej;
        });

        inFlightPurchase = { resolve, reject, timeoutId };

        if (isSubscription) {
          const subscriptionQuery = await IAP.fetchProducts({
            skus: [product.googleProductId!],
            type: "subs",
          });
          const subscription = subscriptionQuery?.find(
            (p) => p.type === "subs",
          ) as IAP.ProductSubscription | undefined;

          if (!subscription) {
            inFlightPurchase = null;
            return {
              billingPlan: product.billingPlan,
              googleProductId: product.googleProductId,
              kind: product.kind,
              productCode: product.productCode,
              status: "invalid_product",
              testOnly: false,
              orderId: null,
              purchaseToken: null,
              offerToken: null,
              acknowledged: false,
            };
          }

          const offerToken = resolveOfferTokenForPlan(subscription, identity!);
          if (!offerToken) {
            inFlightPurchase = null;
            return {
              billingPlan: product.billingPlan,
              googleProductId: product.googleProductId,
              kind: product.kind,
              productCode: product.productCode,
              status: "invalid_product",
              testOnly: false,
              orderId: null,
              purchaseToken: null,
              offerToken: null,
              acknowledged: false,
            };
          }

          await IAP.requestPurchase({
            request: {
              google: {
                skus: [product.googleProductId!],
                subscriptionOffers: [
                  { sku: product.googleProductId, offerToken },
                ],
              },
            },
            type: "subs",
          });
        } else {
          await IAP.requestPurchase({
            request: {
              google: { skus: [product.googleProductId] },
            },
            type: "in-app",
          });
        }

        const purchase = await purchasePromise;
        const finalOfferToken = isSubscription
          ? await (async () => {
              const subscriptionQuery = await IAP.fetchProducts({
                skus: [product.googleProductId!],
                type: "subs",
              });
              const subscription = subscriptionQuery?.find(
                (p) => p.type === "subs",
              ) as IAP.ProductSubscription | undefined;
              return subscription
                ? resolveOfferTokenForPlan(subscription, identity!)
                : null;
            })()
          : null;

        return mapPurchase(
          purchase,
          product.kind,
          finalOfferToken ?? product.offerToken ?? null,
          true,
        );
      } catch (error) {
        inFlightPurchase = null;
        const err = error as Error;
        if (err.message === "Purchase timeout") {
          return {
            billingPlan: product.billingPlan,
            googleProductId: product.googleProductId,
            kind: product.kind,
            productCode: product.productCode,
            status: "network_error",
            testOnly: false,
            orderId: null,
            purchaseToken: null,
            offerToken: product.offerToken ?? null,
            acknowledged: false,
          };
        }

        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : null;
        if (
          code === "user-cancelled" ||
          code === "UserCancelled" ||
          code === "USER_CANCELLED"
        ) {
          return {
            billingPlan: product.billingPlan,
            googleProductId: product.googleProductId,
            kind: product.kind,
            productCode: product.productCode,
            status: "cancelled",
            testOnly: false,
            orderId: null,
            purchaseToken: null,
            offerToken: product.offerToken ?? null,
            acknowledged: false,
          };
        }

        return {
          billingPlan: product.billingPlan,
          googleProductId: product.googleProductId,
          kind: product.kind,
          productCode: product.productCode,
          status: "network_error",
          testOnly: false,
          orderId: null,
          purchaseToken: null,
          offerToken: product.offerToken ?? null,
          acknowledged: false,
        };
      }
    },

    async restore(): Promise<BillingRestoreResult> {
      await ensureConnection();

      try {
        const purchases = await IAP.getAvailablePurchases();
        const mapped = purchases.map((p) =>
          mapPurchase(p, inferKind(p, productKindMap), null, false),
        );

        return {
          purchases: mapped,
          scenario: mapped.length > 0 ? "RESTORE_FOUND" : "RESTORE_EMPTY",
          status: mapped.length > 0 ? "found" : "empty",
          testOnly: false,
        };
      } catch (error) {
        return {
          purchases: [],
          scenario: "NETWORK_ERROR",
          status: "network_error",
          testOnly: false,
        };
      }
    },
  };
}
