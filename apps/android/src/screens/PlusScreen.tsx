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
import { getBillingService, type BillingHarnessScenario, type StoreProduct } from "../billing";
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
    }, [loadSubscription]),
  );

  function handleSignIn() {
    navigation.navigate("SignIn");
  }

  async function handlePlusPurchase(scenario?: BillingHarnessScenario) {
    if (!token || isPurchasing) {
      return;
    }

    setIsPurchasing(true);
    setBillingMessage(null);

    const [product] = await billingService.getProducts("subscription");
    const plusProduct: StoreProduct =
      product ?? {
        billingPeriodLabel: "Store price not configured",
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

  const isPlus = me?.subscription.status === "active";
  const membershipHeadline = isPlus ? (me?.subscription.label ?? "0nya Plus") : "Weekly membership";
  const membershipBody =
    isPlus && me?.subscription.endsAt ? `Active until ${formatDate(me.subscription.endsAt)}` : null;
  const membershipStatusText = isPlus ? "Active" : "Unavailable in this build";

  return (
    <Screen>
      <View style={styles.hero}>
        <BrandWordmark plus style={styles.brand} />
        <Body>Weekly membership</Body>
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

      <View style={styles.disclosure}>
        <Body>Auto-renews weekly until cancelled.</Body>
        <Body>Cancel anytime in Google Play.</Body>
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
          <View style={styles.membership}>
            <Label>Membership</Label>
            <Text style={styles.membershipHeadline}>{membershipHeadline}</Text>
            {membershipBody ? <Body>{membershipBody}</Body> : null}
            {!isPlus ? (
              <Body>Purchasing needs Google Play product configuration before production use.</Body>
            ) : null}
            {!isPlus ? (
              <Button
                accessibilityLabel="Continue with 0nya Plus"
                disabled={isPurchasing}
                onPress={() => void handlePlusPurchase()}
              >
                Continue
              </Button>
            ) : null}
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
        ) : null
      ) : (
        <Card>
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
    borderColor: "rgba(13, 209, 188, 0.24)",
    borderWidth: borders.width,
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  harnessChipPressed: {
    backgroundColor: "rgba(13, 209, 188, 0.10)",
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
