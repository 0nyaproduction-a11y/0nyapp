import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
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
import { getMe } from "../lib/api";
import { useAuth } from "../lib/authContext";
import type { ProfileStackScreenProps } from "../navigation/types";
import type { MeResponse } from "../types/api";

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
  const token = session?.access_token;

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
            <Body>Purchase restoration isn't available in this test build yet.</Body>
            <Button accessibilityLabel="Restore unavailable" disabled onPress={() => undefined}>
              RESTORE UNAVAILABLE
            </Button>
          </Card>
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
