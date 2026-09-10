import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState, type ReactNode } from "react";
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
  getBillingService,
  PLUS_BILLING_PLANS,
  createUnconfiguredPlusPlanProducts,
  type BillingHarnessScenario,
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

const APPROVED_PLANS: StoreProduct[] = createUnconfiguredPlusPlanProducts();

export function PlusScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [plusPlans, setPlusPlans] = useState<StoreProduct[]>([]);
  const [selectedProductCode, setSelectedProductCode] = useState("0nya_plus_weekly");
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
      void getBillingService()
        .getProducts("subscription")
        .then((products) =>
          setPlusPlans(products.filter((product) => product.kind === "subscription")),
        )
        .catch(() => setPlusPlans([]));
    }, [loadSubscription]),
  );

  async function handleSignIn() {
    await navigateToSignIn(() => navigation.navigate("SignIn"), { kind: "plus" });
  }

  const isPlus = me?.subscription.status === "active";

  const approvedPlans = APPROVED_PLANS.map((approved) => {
    const storeMatch = plusPlans.find((product) => product.productCode === approved.productCode);
    return storeMatch
      ? {
          ...approved,
          ...storeMatch,
          localizedPrice: storeMatch.localizedPrice || approved.localizedPrice,
        }
      : approved;
  });

  const selectedPlan =
    approvedPlans.find((product) => product.productCode === selectedProductCode) ??
    approvedPlans[0];
  const selectedCadence = selectedPlan?.billingPlan ?? "weekly";
  const canPurchaseSelectedPlan =
    billingService.isHarness ||
    (selectedPlan?.status === "available" && Boolean(selectedPlan.googleProductId && selectedPlan.offerToken));

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
      selectedPlan ??
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

      {/* 2. What You Get (Consolidated Benefits Card) */}
      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>WHAT YOU GET</Text>
        <View style={styles.benefitsCard}>
          <BenefitRow
            helper="Stay with the story a little longer."
            icon={<MiniPlayIcon color={colors.accent} />}
            title="More Micro Drama access"
          />
          <View style={styles.benefitDivider} />
          <BenefitRow
            helper="Let the film play without breaking the mood."
            icon={<MiniFilmIcon color={colors.accent} />}
            title="Ad-free Short Films"
          />
          <View style={styles.benefitDivider} />
          <BenefitRow
            helper="See every frame with more depth and clarity."
            icon={<MiniQualityIcon color={colors.accent} />}
            title="Up to 2K playback"
          />
          <View style={styles.benefitDivider} />
          <BenefitRow
            helper="Let the story follow you beyond the player."
            icon={<MiniPipIcon color={colors.accent} />}
            title="Picture in Picture"
          />
          <View style={styles.benefitDivider} />
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
            <Text accessibilityLabel="0nya Plus · ACTIVE" style={styles.membershipHeadline}>
              <Text style={styles.brand0}>0</Text>
              <Text style={styles.brandNya}>nya</Text>
              <Text style={styles.brandPlus}> Plus</Text>
              <Text style={styles.membershipDot}> · </Text>
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
            <Text style={styles.manageSubscriptionChevron}>›</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.membershipSection}>
          <Text style={styles.sectionEyebrow}>MEMBERSHIP</Text>
          <Text style={styles.membershipOfferTitle}>Choose your Plus plan</Text>
          <View style={styles.planList}>
            {approvedPlans.map((plan) => (
              <PlanRow
                key={plan.productCode}
                onPress={() => setSelectedProductCode(plan.productCode)}
                plan={plan}
                selected={plan.productCode === selectedPlan?.productCode}
              />
            ))}
          </View>

          <Pressable
            accessibilityLabel="Subscribe to Plus"
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
              {isPurchasing ? "Processing..." : "Subscribe to Plus"}
            </Text>
          </Pressable>

          <View style={styles.renewalDisclosure}>
            <Text style={styles.renewalDisclosureText}>
              Auto-renews {selectedCadence} until cancelled.
            </Text>
            {selectedPlan?.offerPurpose === "referral_intro" ? (
              <Text style={styles.renewalDisclosureText}>
                Referral introductory price applies for the first month; standard monthly store price applies after.
              </Text>
            ) : null}
            <Text style={styles.renewalDisclosureText}>Cancel anytime in Google Play.</Text>
          </View>

          <Text style={styles.launchStatusText}>Payments are awaiting launch.</Text>
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

function cadenceNounFor(plan: StoreProduct) {
  return (
    PLUS_BILLING_PLANS.find((entry) => entry.billingPlan === plan.billingPlan)?.cadenceNoun ?? null
  );
}

function planTitle(plan: StoreProduct) {
  if (plan.offerPurpose === "referral_intro") {
    return "Referral Monthly";
  }
  if (!plan.billingPlan) {
    return plan.displayName;
  }

  const cadence = plan.billingPlan;
  return `${cadence.charAt(0).toUpperCase()}${cadence.slice(1)}`;
}

function formatPlanPriceText(plan: StoreProduct): string {
  const noun = plan.billingPlan === "weekly" ? "week" : cadenceNounFor(plan);

  const price = plan.localizedPrice;
  if (price && noun) {
    return `${price} / ${noun}`;
  }
  if (price) {
    return price;
  }
  return "Price not configured";
}

type PlanRowProps = {
  onPress: () => void;
  plan: StoreProduct;
  selected: boolean;
};

function PlanRow({ onPress, plan, selected }: PlanRowProps) {
  const priceText = formatPlanPriceText(plan);
  const title = planTitle(plan);

  return (
    <Pressable
      accessibilityLabel={`${title}. ${priceText}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.planRow,
        pressed && styles.planRowPressed,
        selected && styles.planRowSelected,
      ]}
    >
      <View style={styles.planRowContent}>
        <View style={[styles.planRadio, selected && styles.planRadioSelected]}>
          {selected ? <View style={styles.planRadioDot} /> : null}
        </View>
        <Text style={[styles.planName, selected && styles.planNameSelected]}>{title}</Text>
      </View>
      <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>{priceText}</Text>
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
  section: {
    gap: 8,
  },
  sectionEyebrow: {
    color: "rgba(254, 253, 253, 0.45)",
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  benefitsCard: {
    backgroundColor: "rgba(254, 253, 253, 0.02)",
    borderColor: "rgba(254, 253, 253, 0.08)",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  benefitRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
  },
  benefitDivider: {
    backgroundColor: "rgba(254, 253, 253, 0.06)",
    height: 1,
  },
  benefitIconWrap: {
    alignItems: "center",
    backgroundColor: "rgba(43, 126, 125, 0.12)",
    borderColor: "rgba(43, 126, 125, 0.28)",
    borderRadius: 8,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    marginTop: 1,
    width: 28,
  },
  benefitCopy: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  benefitHelper: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 16.5,
  },
  membershipSection: {
    gap: 8,
    paddingBottom: 24,
  },
  membershipOfferTitle: {
    color: colors.text,
    fontSize: 16,
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
    gap: 6,
  },
  planRow: {
    alignItems: "center",
    backgroundColor: "rgba(254, 253, 253, 0.02)",
    borderColor: "rgba(254, 253, 253, 0.08)",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  planRowPressed: {
    backgroundColor: "rgba(254, 253, 253, 0.05)",
  },
  planRowSelected: {
    backgroundColor: "rgba(43, 126, 125, 0.08)",
    borderColor: colors.accent,
  },
  planRowContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  planRadio: {
    alignItems: "center",
    borderColor: "rgba(254, 253, 253, 0.25)",
    borderRadius: 999,
    borderWidth: 1,
    height: 16,
    justifyContent: "center",
    width: 16,
  },
  planRadioSelected: {
    borderColor: colors.accent,
  },
  planRadioDot: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  planName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  planNameSelected: {
    color: colors.text,
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
  payButton: {
    alignItems: "center",
    backgroundColor: "rgba(43, 126, 125, 0.12)",
    borderColor: "rgba(43, 126, 125, 0.38)",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    marginTop: 4,
  },
  payButtonDisabled: {
    backgroundColor: "rgba(254, 253, 253, 0.03)",
    borderColor: "rgba(254, 253, 253, 0.08)",
    borderWidth: 1,
  },
  payButtonPressed: {
    backgroundColor: "rgba(43, 126, 125, 0.20)",
    opacity: 0.88,
  },
  payButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  payButtonTextDisabled: {
    color: "rgba(254, 253, 253, 0.32)",
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
