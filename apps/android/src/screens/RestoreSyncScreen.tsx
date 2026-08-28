import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import {
  Body,
  Button,
  Card,
  Label,
  LoadingState,
  RecoveryState,
  Title,
} from "../components/ui";
import { getMe, submitGooglePlayBillingBoundary } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { getBillingService, type BillingHarnessScenario } from "../billing";
import type { ProfileStackScreenProps } from "../navigation/types";
import type { MeResponse } from "../types/api";
import { borders, colors } from "../theme/tokens";

type Props = ProfileStackScreenProps<"RestoreSync">;

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateString));
}

export function RestoreSyncScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const token = session?.access_token;
  const billingService = getBillingService();

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
      {token ? (
        <>
          {me ? (
            <Card>
              <Label>Current status</Label>
              <Title>{me.subscription.status === "active" ? "0nya Plus active" : "No active 0nya Plus plan"}</Title>
              {me.subscription.planCode ? <Body>{`Plan code: ${me.subscription.planCode}`}</Body> : null}
              {me.subscription.endsAt ? <Body>{`Ends on ${formatDate(me.subscription.endsAt)}`}</Body> : null}
            </Card>
          ) : null}
          <Card>
            <Label>Restore purchases</Label>
            <Body>Restore sends device purchase state to the trusted backend boundary before account state changes.</Body>
            <Button
              accessibilityLabel="Restore and sync purchases"
              disabled={isSyncing}
              onPress={() => void handleRestore()}
            >
              Restore / Sync
            </Button>
          </Card>
          {__DEV__ && billingService.isHarness ? (
            <Card>
              <Label>Development billing harness</Label>
              <Body>Exercise restore outcomes without trusting device purchase state.</Body>
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
            </Card>
          ) : null}
          {syncMessage ? (
            <Card>
              <Label>Sync status</Label>
              <Body>{syncMessage}</Body>
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          <Label>Guest</Label>
          <Title>Sign in to view your status</Title>
          <Body>Sign in first, then return here to check your account status.</Body>
          <Button accessibilityLabel="Sign in to restore purchases" onPress={() => navigation.navigate("SignIn")}>
            Sign in
          </Button>
        </Card>
      )}
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
