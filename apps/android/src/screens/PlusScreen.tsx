import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import {
  Body,
  BrandWordmark,
  Button,
  Card,
  Label,
  LoadingState,
  RecoveryState,
  Title,
} from "../components/ui";
import { getMe, submitGooglePlayBillingBoundary } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { navigateToSignIn } from "../lib/authReturnIntentStorage";
import {
  getBillingService,
  PLUS_BILLING_PLANS,
  type BillingHarnessScenario,
  type PlusBillingPlan,
  type StoreProduct,
} from "../billing";
import type { RootStackScreenProps } from "../navigation/types";
import type { MeResponse } from "../types/api";
import { borders, colors, radii } from "../theme/tokens";

type Props = RootStackScreenProps<"Plus">;

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateString));
}

export function PlusScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [plusPlans, setPlusPlans] = useState<StoreProduct[]>([]);
  const [selectedBillingPlan, setSelectedBillingPlan] = useState<PlusBillingPlan>("weekly");
  const token = session?.access_token;
  const billingService = getBillingService();

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

  // 0nya Plus is ONE entitlement; weekly/monthly/yearly are its billing
  // choices. One selection at a time; every choice resolves to the same
  // entitlement through the billing boundary (server/store verified).
  const isPlus = me?.subscription.status === "active";
  const selectedPlan =
    plusPlans.find((product) => product.billingPlan === selectedBillingPlan) ??
    plusPlans[0] ??
    null;
  const selectedCadence = selectedPlan?.billingPlan ?? "weekly";

  async function handlePlusPurchase(scenario?: BillingHarnessScenario) {
    if (!token || isPurchasing) {
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

  const membershipHeadline = isPlus ? (me?.subscription.label ?? "0nya Plus") : "0nya Plus";
  const membershipBody =
    isPlus && me?.subscription.endsAt ? `Active until ${formatDate(me.subscription.endsAt)}` : null;
  const membershipStatusText = isPlus ? "Active" : "Unavailable in this build";

  return (
    <Screen>
      <View style={styles.hero}>
        <BrandWordmark plus style={styles.brand} />
        <Body>Watch more without interruption.</Body>
      </View>

      <View style={styles.benefits}>
        <BenefitRow
          title="Access Plus-enabled Micro Drama episodes"
          body="Watch released micro-drama episodes included when they are enabled for 0nya Plus access."
        />
        <BenefitRow
          title="Ad-free Short Films"
          body="Enjoy Short Films without mid-roll or post-roll ads when you are an active Plus member."
        />
        <BenefitRow
          title="Higher-quality playback"
          body="A premium viewing experience is part of the approved Plus experience direction."
        />
        <BenefitRow
          title="Coins remain separate"
          body="Coins stay in the wallet and remain independent from the Plus membership."
        />
      </View>

      {isLoading && !me && !error ? <LoadingState /> : null}
      {error ? (
        <RecoveryState
          body={error}
          onPrimaryAction={() => void loadSubscription()}
          primaryActionLabel="Retry"
          title="We couldn't load this right now."
        />
      ) : null}
      {token ? (
        me ? (
          <>
            <View style={styles.membership}>
              <Label>Membership</Label>
              <Text style={styles.membershipHeadline}>{membershipHeadline}</Text>
              {membershipBody ? <Body>{membershipBody}</Body> : null}
              <View
                accessibilityLabel={membershipStatusText}
                accessibilityRole="text"
                style={[styles.statusPill, isPlus ? styles.statusPillActive : null]}
              >
                <View style={[styles.statusDot, isPlus ? styles.statusDotActive : null]} />
                <Text style={[styles.statusText, isPlus ? styles.statusTextActive : null]}>
                  {membershipStatusText}
                </Text>
              </View>
            </View>
            {!isPlus && plusPlans.length > 0 ? (
              <View style={styles.plansSection}>
                <Label>Choose your plan</Label>
                <View style={styles.planList}>
                  {plusPlans.map((plan) => (
                    <PlanRow
                      key={plan.billingPlan ?? plan.productCode}
                      onPress={() =>
                        plan.billingPlan ? setSelectedBillingPlan(plan.billingPlan) : undefined
                      }
                      plan={plan}
                      selected={plan.billingPlan === selectedCadence}
                    />
                  ))}
                </View>
                <View style={styles.disclosure}>
                  <Body>Auto-renews {selectedCadence} until cancelled.</Body>
                  <Body>Cancel anytime in Google Play.</Body>
                </View>
                <Body>Purchasing needs Google Play product configuration before production use.</Body>
                <Button
                  accessibilityLabel="Continue with 0nya Plus"
                  disabled={isPurchasing || !selectedPlan}
                  onPress={() => void handlePlusPurchase()}
                >
                  Continue
                </Button>
              </View>
            ) : null}
          </>
        ) : null
      ) : (        <Card>
          <Label>Guest</Label>
          <Title>Sign in to view 0nya Plus</Title>
          <Body>Sign in first, then return here to view your membership state.</Body>
          <Button accessibilityLabel="Sign in to view Plus" onPress={handleSignIn}>
            Sign in
          </Button>
        </Card>
      )}
      {__DEV__ && token && billingService.isHarness ? (
        <Card>
          <Label>Development billing harness</Label>
          <Body>Exercise Plus billing outcomes without Google UI or production entitlement changes.</Body>
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
      {billingMessage ? (
        <Card>
          <Label>Billing status</Label>
          <Body>{billingMessage}</Body>
        </Card>
      ) : null}
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
  body: ReactNode;
  title: string;
};

function BenefitRow({ body, title }: BenefitRowProps) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitMarker} />
      <View style={styles.benefitCopy}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Body>{body}</Body>
      </View>
    </View>
  );
}
function cadenceNounFor(plan: StoreProduct) {
  return (
    PLUS_BILLING_PLANS.find((entry) => entry.billingPlan === plan.billingPlan)?.cadenceNoun ?? null
  );
}

function planTitle(plan: StoreProduct) {
  if (!plan.billingPlan) {
    return plan.displayName;
  }

  const cadence = plan.billingPlan;
  return `${cadence.charAt(0).toUpperCase()}${cadence.slice(1)}`;
}

type PlanRowProps = {
  onPress: () => void;
  plan: StoreProduct;
  selected: boolean;
};

function PlanRow({ onPress, plan, selected }: PlanRowProps) {
  const noun = cadenceNounFor(plan);
  const priceText = plan.localizedPrice
    ? noun
      ? `${plan.localizedPrice} / ${noun}`
      : plan.localizedPrice
    : "Price not configured";

  return (
    <Pressable
      accessibilityLabel={`${planTitle(plan)}. ${priceText}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.planRow,
        pressed && styles.planRowPressed,
        selected && styles.planRowSelected,
      ]}
    >
      <Text style={styles.planName}>{planTitle(plan)}</Text>
      <Text style={[styles.planPrice, selected ? styles.planPriceSelected : null]}>{priceText}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 8,
  },
  brand: {
    fontSize: 34,
    lineHeight: 38,
  },
  benefits: {
    gap: 14,
  },
  disclosure: {
    gap: 2,
  },
  benefitRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  benefitMarker: {
    backgroundColor: colors.accent,
    borderRadius: radii.none,
    height: 6,
    marginTop: 7,
    width: 6,
  },
  benefitCopy: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  inlineBrandAccent: {
    color: colors.accent,
  },
  inlineBrandText: {
    color: colors.text,
  },
  membership: {
    gap: 6,
  },
  plansSection: {
    gap: 10,
  },
  planList: {
    gap: 8,
  },
  planRow: {
    alignItems: "center",
    borderColor: borders.color,
    borderWidth: borders.width,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  planRowPressed: {
    backgroundColor: "rgba(43, 126, 125, 0.12)",
  },
  planRowSelected: {
    borderColor: colors.accent,
  },
  planName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  planPrice: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  planPriceSelected: {
    color: colors.text,
  },
  membershipHeadline: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  statusPill: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: borders.color,
    borderRadius: 999,
    borderWidth: borders.width,
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillActive: {
    borderColor: colors.accent,
  },
  statusDot: {
    backgroundColor: colors.muted,
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  statusDotActive: {
    backgroundColor: colors.accent,
  },
  statusText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  statusTextActive: {
    color: colors.text,
  },
  harnessGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  harnessChip: {
    borderColor: "rgba(43, 126, 125, 0.24)",
    borderWidth: borders.width,
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    fontWeight: "800",
  },
});