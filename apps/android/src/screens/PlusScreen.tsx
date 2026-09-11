import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { SubscriptionManagementModal } from "../components/SubscriptionManagementModal";
import {
  Card,
  Label,
  LoadingState,
  PlayTriangleIcon,
  RecoveryState,
} from "../components/ui";
import { getMe, submitGooglePlayBillingBoundary } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { navigateToSignIn } from "../lib/authReturnIntentStorage";
import {
  checkReferralEligibility,
  getBillingService,
  normalizePlusPlans,
  type BillingHarnessScenario,
  type NormalizedPlusPlan,
  type PlusBillingPlan,
  type StoreProduct,
} from "../billing";
import type { RootStackScreenProps } from "../navigation/types";
import type { MeResponse } from "../types/api";
import { borders, colors, radii, surfaces } from "../theme/tokens";

type Props = RootStackScreenProps<"Plus">;

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateString));
}

export function PlusScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBillingLoading, setIsBillingLoading] = useState(true);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [plusPlans, setPlusPlans] = useState<StoreProduct[]>([]);
  const [selectedCadence, setSelectedCadence] = useState<PlusBillingPlan>("weekly");
  const [isManagementSheetOpen, setIsManagementSheetOpen] = useState(false);
  const token = session?.access_token;
  const billingService = getBillingService();

  // Ensure clean header with standard back navigation
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => null,
      title: "",
    });
  }, [navigation]);

  const loadSubscription = useCallback(async () => {
    if (!token) {
      setMe(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const meData = await getMe(token);
      setMe(meData);
      setError(null);
    } catch {
      setMe(null);
      setError("We couldn't load this right now.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadSubscription();
      setIsBillingLoading(true);
      void getBillingService()
        .getProducts("subscription")
        .then((products) => {
          setPlusPlans(products.filter((product) => product.kind === "subscription"));
        })
        .catch(() => setPlusPlans([]))
        .finally(() => setIsBillingLoading(false));
    }, [loadSubscription]),
  );

  async function handleSignIn() {
    await navigateToSignIn(() => navigation.navigate("SignIn"), { kind: "plus" });
  }

  const isPlus = me?.subscription.status === "active";

  const isReferredUser = checkReferralEligibility(session, route.params);

  const normalizedPlans = useMemo(
    () => normalizePlusPlans(plusPlans, isReferredUser),
    [plusPlans, isReferredUser],
  );

  const selectedPlan =
    normalizedPlans.find((plan) => plan.cadence === selectedCadence) ?? normalizedPlans[0];
  const purchasableProduct = selectedPlan.purchasableProduct;

  const canPurchaseSelectedPlan =
    billingService.isHarness ||
    (purchasableProduct?.status === "available" &&
      Boolean(purchasableProduct.googleProductId && purchasableProduct.offerToken));

  // True only when at least one Google Play offer is fully loaded and available.
  // Used to gate the prelaunch UI path without touching purchase/entitlement logic.
  const hasValidOffers =
    billingService.isHarness ||
    normalizedPlans.some(
      (plan) =>
        plan.purchasableProduct.status === "available" &&
        Boolean(plan.purchasableProduct.googleProductId && plan.purchasableProduct.offerToken),
    );

  async function handlePlusPurchase(scenario?: BillingHarnessScenario) {
    if (!token) {
      await handleSignIn();
      return;
    }

    if (isPurchasing) {
      return;
    }

    setIsPurchasing(true);
    setBillingMessage(null);

    const plusProduct: StoreProduct =
      purchasableProduct ??
      (await billingService.getProducts("subscription"))[0] ?? {
        billingPeriodLabel: "Store price not configured",
        billingPlan: "weekly",
        coinAmount: null,
        displayName: "0nya Plus",
        googleProductId: null,
        kind: "subscription",
        localizedPrice: null,
        productCode: "0nya_plus",
        status: "not_configured",
      };

    try {
      const result = await billingService.purchase(plusProduct, scenario);
      const boundary = await submitGooglePlayBillingBoundary(token, {
        billingPlan: result.billingPlan,
        googleProductId: result.googleProductId,
        kind: "subscription",
        mode: "purchase",
        productCode: result.productCode,
        scenario: result.scenario ?? result.status,
        testOnly: result.testOnly,
      });
      const meData = await getMe(token);

      setMe(meData);
      setBillingMessage(
        boundary.testOnly
          ? `Test-only ${result.status.replace(/_/g, " ")}. Google verification was not performed; Plus state remains ${boundary.subscription.status}.`
          : "Google Play Billing is not configured yet. No Plus entitlement was changed.",
      );
    } catch {
      setBillingMessage("We couldn't complete the billing check. Your Plus state was not changed.");
    } finally {
      setIsPurchasing(false);
    }
  }

  const expiryText =
    isPlus && me?.subscription.endsAt
      ? `Your Plus access is active until ${formatDate(me.subscription.endsAt)}.`
      : "Your Plus access is active.";

  const ctaLabel = isPurchasing
    ? "Processing..."
    : hasValidOffers
      ? "Continue with Plus"
      : "Coming soon";

  return (
    <Screen>
      {/* 1. Hero / Brand Block */}
      <View style={styles.hero}>
        <View style={styles.brandRow}>
          <Text accessibilityLabel="0nya Plus" style={styles.brandTitle}>
            <Text style={styles.brand0}>0</Text>
            <Text style={styles.brandNya}>nya</Text>
            <Text style={styles.brandPlus}> Plus</Text>
          </Text>
        </View>
        <Text style={styles.heroTagline}>More story. Less interruption.</Text>
      </View>

      {/* 2. Included with Plus (Refined Benefits Section) */}
      <View style={styles.benefitsSection}>
        <Text style={styles.sectionEyebrow}>Included with Plus</Text>
        <View style={styles.benefitsList}>
          <BenefitRow
            helper="Stay with the story a little longer."
            icon={<MiniPlayIcon color={colors.accent} />}
            title="More Micro Drama access"
          />
          <BenefitRow
            helper="Let the film play without breaking the mood."
            icon={<MiniFilmIcon color={colors.accent} />}
            title="Ad-free Short Films"
          />
          <BenefitRow
            helper="See every frame with more depth and clarity."
            icon={<MiniQualityIcon color={colors.accent} />}
            title="Up to 2K playback"
          />
          <BenefitRow
            helper="Let the story follow you beyond the player."
            icon={<MiniPipIcon color={colors.accent} />}
            title="Picture in Picture"
          />
          <BenefitRow
            helper="Your Coins remain yours, separate from Plus."
            icon={<MiniCoinsIcon color={colors.accent} />}
            title="Coins stay yours"
          />
        </View>
      </View>

      {/* Loading / Error States */}
      {isLoading && !me && !error ? <LoadingState /> : null}
      {error ? (
        <RecoveryState
          body={error}
          onPrimaryAction={() => void loadSubscription()}
          primaryActionLabel="Retry"
          title="We couldn't load this right now."
        />
      ) : null}

      {/* 3. Membership Section */}
      {isPlus ? (
        <View style={styles.membershipCard}>
          <Text style={styles.sectionEyebrow}>MEMBERSHIP</Text>
          <View style={styles.membershipTitleRow}>
            <Text accessibilityLabel={"0nya Plus \u00B7 ACTIVE"} style={styles.membershipHeadline}>
              <Text style={styles.brand0}>0</Text>
              <Text style={styles.brandNya}>nya</Text>
              <Text style={styles.brandPlus}> Plus</Text>
              <Text style={styles.membershipDot}>{" \u00B7 "}</Text>
              <Text style={styles.membershipActiveText}>ACTIVE</Text>
            </Text>
          </View>
          <Text style={styles.membershipExpiry}>{expiryText}</Text>
          <Pressable
            accessibilityLabel="Manage subscription"
            accessibilityRole="button"
            onPress={() => setIsManagementSheetOpen(true)}
            style={({ pressed }) => [
              styles.manageSubscriptionRow,
              pressed && styles.manageSubscriptionRowPressed,
            ]}
          >
            <Text style={styles.manageSubscriptionText}>Manage subscription</Text>
            <Text style={styles.manageSubscriptionChevron}>{"\u203A"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.membershipSection}>
          <Text style={styles.sectionEyebrow}>MEMBERSHIP</Text>
          <Text style={styles.membershipOfferTitle}>Choose your Plus plan</Text>
          <View style={styles.planList}>
            {normalizedPlans.map((plan) => (
              <PlanRow
                hasValidOffers={hasValidOffers}
                isBillingLoading={isBillingLoading}
                key={plan.cadence}
                onPress={() => setSelectedCadence(plan.cadence)}
                plan={plan}
                selected={plan.cadence === selectedCadence}
              />
            ))}
          </View>

          <Pressable
            accessibilityLabel={ctaLabel}
            accessibilityRole="button"
            disabled={isPurchasing || !canPurchaseSelectedPlan}
            onPress={() => void handlePlusPurchase()}
            style={({ pressed }) => [
              styles.payButton,
              (isPurchasing || !canPurchaseSelectedPlan) && styles.payButtonDisabled,
              pressed && !isPurchasing && styles.payButtonPressed,
            ]}
          >
            <Text
              style={[
                styles.payButtonText,
                (isPurchasing || !canPurchaseSelectedPlan) && styles.payButtonTextDisabled,
              ]}
            >
              {ctaLabel}
            </Text>
          </Pressable>

          {hasValidOffers && canPurchaseSelectedPlan ? (
            <View style={styles.renewalDisclosure}>
              <Text style={styles.renewalDisclosureText}>
                Auto-renews {selectedCadence} until cancelled.
              </Text>
              {selectedPlan.hasActiveReferralOffer ? (
                <Text style={styles.renewalDisclosureText}>
                  Referral introductory price applies for the first month; standard monthly store price applies after.
                </Text>
              ) : null}
              <Text style={styles.renewalDisclosureText}>Cancel anytime in Google Play.</Text>
            </View>
          ) : (
            <Text style={styles.launchStatusText}>
              Plus subscriptions are coming soon.{"\n"}Payments will be available through Google Play.
            </Text>
          )}
        </View>
      )}

      {/* 4. Development Harness */}
      {__DEV__ && token && billingService.isHarness ? (
        <Card>
          <Label>Development billing harness</Label>
          <Text style={styles.harnessBody}>Exercise Plus billing outcomes without Google UI or production entitlement changes.</Text>
          <View style={styles.harnessGrid}>
            {plusHarnessScenarios.map((scenario) => (
              <Pressable
                accessibilityLabel={`Run ${scenario}`}
                accessibilityRole="button"
                disabled={isPurchasing}
                key={scenario}
                onPress={() => void handlePlusPurchase(scenario)}
                style={({ pressed }) => [
                  styles.harnessChip,
                  pressed && styles.harnessChipPressed,
                  isPurchasing && styles.harnessChipDisabled,
                ]}
              >
                <Text style={styles.harnessChipText}>{scenario}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      {/* Billing Status */}
      {billingMessage ? (
        <Card>
          <Label>Billing status</Label>
          <Text style={styles.harnessBody}>{billingMessage}</Text>
        </Card>
      ) : null}

      <SubscriptionManagementModal
        endsAt={me?.subscription.endsAt}
        onClose={() => setIsManagementSheetOpen(false)}
        onNavigateToRestoreSync={() =>
          navigation.navigate("MainTabs", {
            screen: "Profile",
            params: { screen: "RestoreSync" },
          })
        }
        status={me?.subscription.status}
        visible={isManagementSheetOpen}
      />
    </Screen>
  );
}

const plusHarnessScenarios: BillingHarnessScenario[] = [
  "PURCHASE_SUCCESS",
  "USER_CANCELLED",
  "PURCHASE_DECLINED",
  "PURCHASE_PENDING",
  "SERVICE_DISCONNECTED",
  "NETWORK_ERROR",
  "PRODUCT_UNAVAILABLE",
  "ALREADY_PROCESSED",
  "INVALID_PRODUCT",
  "SUBSCRIPTION_ACTIVE",
  "SUBSCRIPTION_EXPIRED",
  "SUBSCRIPTION_CANCELLED",
];

type BenefitRowProps = {
  helper: string;
  icon: ReactNode;
  title: string;
};

function BenefitRow({ helper, icon, title }: BenefitRowProps) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitIconWrap}>{icon}</View>
      <View style={styles.benefitCopy}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitHelper}>{helper}</Text>
      </View>
    </View>
  );
}

function MiniPlayIcon({ color }: { color: string }) {
  return (
    <View style={glyphStyles.iconContainer}>
      <PlayTriangleIcon color={color} size={8} />
    </View>
  );
}

function MiniFilmIcon({ color }: { color: string }) {
  return (
    <View style={glyphStyles.filmWrap}>
      <View style={[glyphStyles.filmFrame, { borderColor: color }]}>
        <View style={[glyphStyles.filmBar, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function MiniQualityIcon({ color }: { color: string }) {
  return (
    <View style={glyphStyles.sparkleWrap}>
      <View style={[glyphStyles.sparkleDiamond, { borderColor: color }]} />
    </View>
  );
}

function MiniPipIcon({ color }: { color: string }) {
  return (
    <View style={glyphStyles.pipWrap}>
      <View style={[glyphStyles.pipFrame, { borderColor: color }]}>
        <View style={[glyphStyles.pipWindow, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function MiniCoinsIcon({ color }: { color: string }) {
  return (
    <View style={[glyphStyles.coinCircle, { borderColor: color }]}>
      <Text style={[glyphStyles.coinText, { color }]}>C</Text>
    </View>
  );
}

const glyphStyles = StyleSheet.create({
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  filmWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  filmFrame: {
    alignItems: "center",
    borderRadius: 2,
    borderWidth: 1.2,
    height: 12,
    justifyContent: "center",
    width: 15,
  },
  filmBar: {
    height: 1.2,
    width: 9,
  },
  sparkleWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  sparkleDiamond: {
    borderRadius: 2,
    borderWidth: 1.2,
    height: 11,
    transform: [{ rotate: "45deg" }],
    width: 11,
  },
  pipWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  pipFrame: {
    borderRadius: 2,
    borderWidth: 1.2,
    height: 12,
    position: "relative",
    width: 15,
  },
  pipWindow: {
    borderRadius: 1,
    bottom: 1.5,
    height: 4.5,
    position: "absolute",
    right: 1.5,
    width: 5.5,
  },
  coinCircle: {
    alignItems: "center",
    borderRadius: 7,
    borderWidth: 1.2,
    height: 14,
    justifyContent: "center",
    width: 14,
  },
  coinText: {
    fontSize: 8.5,
    fontWeight: "800",
    lineHeight: 10,
    marginTop: -0.5,
  },
});

/** Approved informational prelaunch prices — shown when Google Play offers are not yet loaded.
 *  Live billing prices from Google Play override these when hasValidOffers is true. */
const PRELAUNCH_PRICES: Record<string, string> = {
  weekly: "₹49 / week",
  monthly: "₹149 / month",
  yearly: "₹999 / year",
};

type PlanRowProps = {
  hasValidOffers: boolean;
  isBillingLoading: boolean;
  onPress: () => void;
  plan: NormalizedPlusPlan;
  selected: boolean;
};

function PlanRow({ hasValidOffers, isBillingLoading, onPress, plan, selected }: PlanRowProps) {
  const isMonthlyReferred = plan.hasActiveReferralOffer && Boolean(plan.referralOfferProduct);

  // Selection state is independent of billing availability.
  // hasValidOffers only gates purchase and CTA — not the row highlight.
  const showSelectedStyle = selected;

  const renderPrice = () => {
    if (isBillingLoading) {
      return <View style={styles.priceSkeleton} />;
    }

    if (isMonthlyReferred) {
      const referralPrice = plan.referralOfferProduct?.localizedPrice;
      const basePrice = plan.baseProduct.localizedPrice;

      // Live Google Play referral price is present — show it.
      if (referralPrice && plan.referralOfferProduct?.status !== "unavailable") {
        return (
          <View style={styles.referralPriceBlock}>
            <Text style={[styles.planPrice, showSelectedStyle && styles.planPriceSelected]}>
              {`${referralPrice} first month`}
            </Text>
            {basePrice ? (
              <Text style={styles.planPriceSub}>
                {`then ${basePrice}/month`}
              </Text>
            ) : null}
          </View>
        );
      }

      // Prelaunch: no live referral price yet — show informational prices.
      return (
        <View style={styles.referralPriceBlock}>
          <Text style={styles.planPrice}>{"₹99 first month"}</Text>
          <Text style={styles.planPriceSub}>{"then ₹149/month"}</Text>
        </View>
      );
    }

    const price = plan.baseProduct.localizedPrice;
    const isLivePrice =
      price &&
      plan.baseProduct.status !== "unavailable" &&
      plan.baseProduct.status !== "not_configured";

    if (isLivePrice) {
      const noun =
        plan.cadence === "weekly"
          ? "week"
          : plan.cadence === "monthly"
            ? "month"
            : "year";

      return (
        <Text style={[styles.planPrice, showSelectedStyle && styles.planPriceSelected]}>
          {`${price}/${noun}`}
        </Text>
      );
    }

    // Prelaunch: no live price — show approved informational price.
    const prelunchPrice = PRELAUNCH_PRICES[plan.cadence];
    return (
      <Text style={styles.planPrice}>{prelunchPrice ?? ""}</Text>
    );
  };

  return (
    <Pressable
      accessibilityLabel={`${plan.title} plan`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.planRow,
        pressed && styles.planRowPressed,
        showSelectedStyle && styles.planRowSelected,
      ]}
    >
      <View style={styles.planRowLeft}>
        <View style={[styles.planRadio, showSelectedStyle && styles.planRadioSelected]}>
          {showSelectedStyle ? <View style={styles.planRadioDot} /> : null}
        </View>
        <View style={styles.planTitleBlock}>
          <Text style={[styles.planName, showSelectedStyle && styles.planNameSelected]}>{plan.title}</Text>
          {isMonthlyReferred ? (
            <Text style={styles.referralWelcomeTagline}>A little welcome from 0nya</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.planRowRight}>{renderPrice()}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 4,
    marginTop: -14,
    paddingTop: 0,
    paddingBottom: 2,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  brand0: {
    color: "#2B7E7D",
  },
  brandNya: {
    color: "#FEFDFD",
  },
  brandPlus: {
    color: "#955E61",
    fontWeight: "500",
  },
  heroTagline: {
    color: colors.textSecondary,
    fontSize: 14.5,
    fontWeight: "400",
    lineHeight: 21,
  },
  benefitsSection: {
    gap: 6,
    marginTop: 2,
    marginBottom: 2,
  },
  sectionEyebrow: {
    color: "rgba(254, 253, 253, 0.48)",
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  benefitsList: {
    backgroundColor: "rgba(254, 253, 253, 0.015)",
    borderColor: "rgba(254, 253, 253, 0.06)",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 7,
  },
  benefitRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 9,
  },
  benefitIconWrap: {
    alignItems: "center",
    height: 20,
    justifyContent: "center",
    marginTop: 1,
    width: 20,
  },
  benefitCopy: {
    flex: 1,
    gap: 1.5,
  },
  benefitTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  benefitHelper: {
    color: "rgba(254, 253, 253, 0.52)",
    fontSize: 11.5,
    fontWeight: "400",
    lineHeight: 15.5,
  },
  membershipSection: {
    gap: 8,
    paddingBottom: 24,
  },
  membershipOfferTitle: {
    color: colors.text,
    fontSize: 15.5,
    fontWeight: "600",
  },
  membershipCard: {
    backgroundColor: surfaces.s2,
    borderColor: "rgba(254, 253, 253, 0.08)",
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 16,
    marginBottom: 20,
  },
  membershipTitleRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  membershipHeadline: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  membershipDot: {
    color: "rgba(254, 253, 253, 0.35)",
    fontSize: 13,
    fontWeight: "400",
  },
  membershipActiveText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  membershipExpiry: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
  manageSubscriptionRow: {
    alignItems: "center",
    borderTopColor: "rgba(254, 253, 253, 0.06)",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 10,
  },
  manageSubscriptionRowPressed: {
    opacity: 0.7,
  },
  manageSubscriptionText: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: "500",
  },
  manageSubscriptionChevron: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "600",
  },
  planList: {
    gap: 8,
  },
  planRow: {
    alignItems: "center",
    backgroundColor: "rgba(254, 253, 253, 0.02)",
    borderColor: "rgba(254, 253, 253, 0.07)",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  planRowPressed: {
    backgroundColor: "rgba(254, 253, 253, 0.05)",
  },
  planRowSelected: {
    backgroundColor: "rgba(43, 126, 125, 0.07)",
    borderColor: "#2B7E7D",
    borderWidth: 1.2,
  },
  planRowLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    flex: 1,
  },
  planTitleBlock: {
    gap: 2,
  },
  planName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  planNameSelected: {
    color: colors.text,
  },
  referralWelcomeTagline: {
    color: "rgba(43, 126, 125, 0.92)",
    fontSize: 11.5,
    fontWeight: "400",
    letterSpacing: -0.1,
  },
  planRowRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  planRadio: {
    alignItems: "center",
    borderColor: "rgba(254, 253, 253, 0.22)",
    borderRadius: 999,
    borderWidth: 1,
    height: 16,
    justifyContent: "center",
    width: 16,
  },
  planRadioSelected: {
    borderColor: "#2B7E7D",
  },
  planRadioDot: {
    backgroundColor: "#2B7E7D",
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  planPrice: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  planPriceSelected: {
    color: colors.text,
    fontWeight: "600",
  },
  planPriceSub: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "400",
    marginTop: 1,
  },
  planPriceUnavailable: {
    color: "rgba(254, 253, 253, 0.35)",
    fontSize: 12.5,
    fontWeight: "500",
  },
  referralPriceBlock: {
    alignItems: "flex-end",
  },
  priceSkeleton: {
    backgroundColor: "rgba(254, 253, 253, 0.08)",
    borderRadius: 4,
    height: 12,
    width: 58,
  },
  payButton: {
    alignItems: "center",
    backgroundColor: "rgba(43, 126, 125, 0.14)",
    borderColor: "rgba(43, 126, 125, 0.40)",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    marginTop: 6,
  },
  payButtonDisabled: {
    backgroundColor: "rgba(254, 253, 253, 0.03)",
    borderColor: "rgba(254, 253, 253, 0.08)",
    borderWidth: 1,
  },
  payButtonPressed: {
    backgroundColor: "rgba(43, 126, 125, 0.22)",
    opacity: 0.9,
  },
  payButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  payButtonTextDisabled: {
    color: "rgba(254, 253, 253, 0.28)",
  },
  launchStatusText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 8,
    textAlign: "center",
  },
  renewalDisclosure: {
    gap: 2,
    marginTop: 4,
  },
  renewalDisclosureText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  harnessBody: {
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 8,
  },
  harnessGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  harnessChip: {
    borderColor: "rgba(43, 126, 125, 0.24)",
    borderRadius: 6,
    borderWidth: borders.width,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  harnessChipPressed: {
    backgroundColor: "rgba(43, 126, 125, 0.14)",
  },
  harnessChipDisabled: {
    opacity: 0.5,
  },
  harnessChipText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
  },
});
