import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Screen } from "../components/Screen";
import { Body, Button, Card, ErrorText, Label, LoadingState, Title } from "../components/ui";
import { getMe, getWatchProgress } from "../lib/api";
import { useAuth } from "../lib/authContext";
import type { RootStackParamList } from "../navigation/types";
import type { MeResponse, WatchProgressResponse } from "../types/api";

type Props = NativeStackScreenProps<RootStackParamList, "Account">;

export function AccountScreen({ navigation }: Props) {
  const { session, signOut } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [progress, setProgress] = useState<WatchProgressResponse["progress"]>([]);
  const [error, setError] = useState<string | null>(null);
  const token = session?.access_token;

  useEffect(() => {
    let isMounted = true;
    if (!token) {
      return undefined;
    }

    Promise.all([getMe(token), getWatchProgress(token)])
      .then(([meData, progressData]) => {
        if (isMounted) {
          setMe(meData);
          setProgress(progressData.progress);
        }
      })
      .catch((accountError) => {
        if (isMounted) {
          setError(accountError instanceof Error ? accountError.message : "Could not load account.");
        }
      })

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (token && !me && !error) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Account</Title>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {me ? (
        <Card>
          <Label>{me.identifier}</Label>
          <Title>{me.displayName}</Title>
          <Body>{me.wallet.balance} coins</Body>
          <Body>{me.subscription.label}</Body>
          <Button accessibilityLabel="Open wallet" onPress={() => navigation.navigate("Wallet")}>
            Wallet
          </Button>
        </Card>
      ) : null}
      <Card>
        <Label>Continue Watching</Label>
        {progress.length > 0 ? (
          progress.slice(0, 4).map((item) => (
            <Body key={`${item.seriesSlug}-${item.episodeNumber}`}>
              {item.seriesSlug} episode {item.episodeNumber} at {item.positionSeconds}s
            </Body>
          ))
        ) : (
          <Body>No watch progress yet.</Body>
        )}
      </Card>
      <Button accessibilityLabel="Sign out" onPress={signOut}>
        Sign out
      </Button>
    </Screen>
  );
}
