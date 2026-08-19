import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Screen } from "../components/Screen";
import { Body, Button, Card, ErrorText, Label, LoadingState, Title } from "../components/ui";
import { getCatalog } from "../lib/api";
import { useAuth } from "../lib/authContext";
import type { RootStackParamList } from "../navigation/types";
import type { ApiSeries } from "../types/api";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [catalog, setCatalog] = useState<ApiSeries[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getCatalog(session?.access_token)
      .then((data) => {
        if (isMounted) {
          setCatalog(data.catalog);
        }
      })
      .catch((catalogError) => {
        if (isMounted) {
          setError(catalogError instanceof Error ? catalogError.message : "Could not load catalog.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [session?.access_token]);

  return (
    <Screen>
      <Title>Home</Title>
      <Card>
        <Label>Account</Label>
        <Body>Review your account, wallet, and synced progress.</Body>
        <Button accessibilityLabel="Open account" onPress={() => navigation.navigate("Account")}>
          Account
        </Button>
        <Button accessibilityLabel="Open wallet" onPress={() => navigation.navigate("Wallet")}>
          Wallet
        </Button>
      </Card>
      {isLoading ? <LoadingState /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {catalog.map((series) => (
        <Card key={series.slug}>
          <Label>{series.genre}</Label>
          <Title>{series.title}</Title>
          <Body>{series.synopsis}</Body>
          <Button
            accessibilityLabel={`Open ${series.title}`}
            onPress={() => navigation.navigate("Series", { slug: series.slug })}
          >
            View series
          </Button>
        </Card>
      ))}
    </Screen>
  );
}
