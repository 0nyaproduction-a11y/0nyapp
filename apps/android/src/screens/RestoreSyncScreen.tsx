import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import {
  Button,
  LoadingState,
  RecoveryState,
} from "../components/ui";
import { getMe, submitGooglePlayBillingBoundary } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { navigateToSignIn } from "../lib/authReturnIntentStorage";
import { getBillingService, type BillingHarnessScenario } from "../billing";
import type { ProfileStackScreenProps } from "../navigation/types";
import type { MeResponse } from "../types/api";
import { borders, colors, radii, spacing, surfaces, typography } from "../theme/tokens";

type Props = ProfileStackScreenProps<"RestoreSync">;

function formatDate(dateString: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

export function RestoreSyncScreen({ navigation }: Props) {
  const { historySyncStatus, retryGuestHistoryMerge, session } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isRetryingHistorySync, setIsRetryingHistorySync] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const token = session?.access_token;
  const billingService = getBillingService();
  const isPlus = me?.subscription.status === "active";

  const loadStatus = useCallback(async () => {
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
      void loadStatus();
    }, [loadStatus]),
  );

  async function handleRetryHistorySync() {
    if (!session || isRetryingHistorySync) {
      return;
    }

    setIsRetryingHistorySync(true);

    try {
      await retryGuestHistoryMerge();
    } finally {
      setIsRetryingHistorySync(false);
    }
  }

  async function handleRestore(scenario?: BillingHarnessScenario) {
    if (!token || isSyncing) {
      return;
    }

    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const result = await billingService.restore(scenario);
      const boundary = await submitGooglePlayBillingBoundary(token, {
        mode: "restore",
        scenario: result.scenario ?? result.status,
        testOnly: result.testOnly,
      });
      const meData = await getMe(token);

      setMe(meData);
      setSyncMessage(
        boundary.testOnly
          ? `Test-only ${result.status.replace(/_/g, " ")}. Server reconciliation did not grant wallet or Plus changes.`
          : "Google Play restore is not configured yet. No account state was changed.",
      );
    } catch {
      setSyncMessage("We couldn't complete restore/sync. Your account state was not changed.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <Screen>
      {isLoading && !me && !error ? <LoadingState /> : null}
      {error ? (
        <RecoveryState
          body={error}
          onPrimaryAction={() => void loadStatus()}
          primaryActionLabel="Retry"
          title="We couldn't load this right now."
        />
      ) : null}

      {token && historySyncStatus.status !== "idle" ? (
        <View style={styles.card}>
          <Text style={styles.sectionEyebrow}>WATCH HISTORY</Text>
          <Text style={styles.cardTitle}>{"Watch history couldn't fully sync."}</Text>
          <Text style={styles.cardBody}>
            {historySyncStatus.errorMessage ?? "Retry to finish syncing your watch history."}
          </Text>
          <Button
            accessibilityLabel="Retry watch history sync"
            disabled={isRetryingHistorySync || historySyncStatus.status === "retrying"}
            onPress={() => void handleRetryHistorySync()}
            variant="secondary"
          >
            {isRetryingHistorySync || historySyncStatus.status === "retrying" ? "Retrying..." : "Retry"}
          </Button>
        </View>
      ) : null}

      {/* 1. CURRENT ACCOUNT */}
      <View style={styles.card}>
        <Text style={styles.sectionEyebrow}>CURRENT ACCOUNT</Text>
        {token ? (
          <>
            <Text style={styles.accountHeading}>
              {isPlus ? (
                <>
                  <Text style={{ color: colors.accent }}>0</Text>
                  <Text style={{ color: colors.text }}>nya</Text>
                  <Text style={{ color: "#955E61", fontWeight: "700" }}> Plus</Text>
                </>
              ) : (
                "Free account"
              )}
            </Text>
            {isPlus && me?.subscription.endsAt ? (
              <Text style={styles.accountSubtext}>
                {`Active until ${formatDate(me.subscription.endsAt)}`}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.accountHeading}>Guest account</Text>
            <Text style={styles.accountSubtext}>
              Sign in to keep your watch history, unlocked episodes, and coins synced across devices.
            </Text>
            <Button
              accessibilityLabel="Sign in to restore purchases"
              onPress={async () => {
                await navigateToSignIn(() => navigation.navigate("SignIn"), { kind: "restoreSync" });
              }}
              style={styles.guestSignInBtn}
              variant="secondary"
            >
              Sign in
            </Button>
          </>
        )}
      </View>

      {/* 2. RESTORE ACTION */}
      <View style={styles.restoreCard}>
        <Text style={styles.restoreCardBody}>
          Restore purchases, unlocked episodes and Coins{"\n"}from your existing 0nya account and device purchases.
        </Text>
        <Pressable
          accessibilityLabel="Restore and sync purchases"
          accessibilityRole="button"
          disabled={isSyncing || !token}
          onPress={() => void handleRestore()}
          style={({ pressed }) => [
            styles.restoreBtn,
            (!token || isSyncing) && styles.restoreBtnDisabled,
            pressed && !isSyncing && token && styles.restoreBtnPressed,
          ]}
        >
          <Text style={[styles.restoreBtnText, (!token || isSyncing) && styles.restoreBtnTextDisabled]}>
            {isSyncing ? "Syncing..." : "Restore / Sync"}
          </Text>
        </Pressable>
      </View>

      {/* 3. WHAT GETS SYNCED */}
      <View style={styles.card}>
        <Text style={styles.sectionEyebrow}>WHAT GETS SYNCED</Text>
        <View style={styles.syncItemList}>
          <View style={styles.syncItemRow}>
            <Text style={styles.syncItemText}>Purchases</Text>
          </View>
          <View style={styles.syncItemDivider} />
          <View style={styles.syncItemRow}>
            <Text style={styles.syncItemText}>Unlocked episodes</Text>
          </View>
          <View style={styles.syncItemDivider} />
          <View style={styles.syncItemRow}>
            <Text style={styles.syncItemText}>Coins</Text>
          </View>
          <View style={styles.syncItemDivider} />
          <View style={styles.syncItemRow}>
            <Text style={styles.syncItemText}>Plus status, if applicable</Text>
          </View>
        </View>
      </View>

      {/* 4. DEVELOPMENT BILLING HARNESS */}
      {__DEV__ && billingService.isHarness && token ? (
        <View style={styles.card}>
          <Text style={styles.sectionEyebrow}>DEVELOPMENT BILLING HARNESS</Text>
          <Text style={styles.harnessHelper}>
            Exercise restore outcomes without trusting device purchase state.
          </Text>
          <View style={styles.harnessGrid}>
            {restoreHarnessScenarios.map((scenario) => (
              <Pressable
                accessibilityLabel={`Run ${scenario}`}
                accessibilityRole="button"
                disabled={isSyncing}
                key={scenario}
                onPress={() => void handleRestore(scenario)}
                style={({ pressed }) => [
                  styles.harnessChip,
                  pressed && styles.harnessChipPressed,
                  isSyncing && styles.harnessChipDisabled,
                ]}
              >
                <Text style={styles.harnessChipText}>{scenario}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* 5. SYNC MESSAGE FEEDBACK */}
      {syncMessage ? (
        <View style={styles.card}>
          <Text style={styles.sectionEyebrow}>SYNC STATUS</Text>
          <Text style={styles.cardBodyNoMargin}>{syncMessage}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const restoreHarnessScenarios: BillingHarnessScenario[] = [
  "RESTORE_FOUND",
  "RESTORE_EMPTY",
  "SERVICE_DISCONNECTED",
  "NETWORK_ERROR",
  "SUBSCRIPTION_ACTIVE",
  "SUBSCRIPTION_EXPIRED",
  "SUBSCRIPTION_CANCELLED",
];

const styles = StyleSheet.create({
  card: {
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
    marginBottom: spacing.md,
    padding: spacing.cardPadding,
  },
  sectionEyebrow: {
    ...typography.micro,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  accountHeading: {
    ...typography.h2,
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
  },
  accountSubtext: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  guestSignInBtn: {
    marginTop: 12,
  },
  restoreCard: {
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.cardPadding,
    paddingVertical: 14,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  cardBody: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14.5,
    lineHeight: 21,
    marginBottom: 16,
  },
  restoreCardBody: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14.5,
    lineHeight: 21,
    marginBottom: 12,
  },
  cardBodyNoMargin: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14.5,
    lineHeight: 21,
  },
  restoreBtn: {
    alignItems: "center",
    backgroundColor: surfaces.s2,
    borderColor: "rgba(43, 126, 125, 0.40)",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: "100%",
  },
  restoreBtnPressed: {
    backgroundColor: "rgba(43, 126, 125, 0.20)",
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  restoreBtnDisabled: {
    backgroundColor: surfaces.s2,
    borderColor: "rgba(254, 253, 253, 0.08)",
    opacity: 0.5,
  },
  restoreBtnText: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  restoreBtnTextDisabled: {
    color: "rgba(254, 253, 253, 0.35)",
  },
  syncItemList: {
    marginTop: 2,
  },
  syncItemRow: {
    paddingVertical: 10,
  },
  syncItemText: {
    ...typography.body,
    color: colors.text,
    fontSize: 14.5,
    fontWeight: "500",
  },
  syncItemDivider: {
    backgroundColor: colors.borderSubtle,
    height: StyleSheet.hairlineWidth,
  },
  harnessHelper: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
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
