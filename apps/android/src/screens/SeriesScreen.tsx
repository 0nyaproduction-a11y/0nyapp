import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Screen } from "../components/Screen";
import { Body, Button, Card, ErrorText, Label, LoadingState, Title } from "../components/ui";
import { getSeries } from "../lib/api";
import { useAuth } from "../lib/authContext";
import type { RootStackParamList } from "../navigation/types";
import type { SeriesResponse } from "../types/api";

type Props = NativeStackScreenProps<RootStackParamList, "Series">;

export function SeriesScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const [data, setData] = useState<SeriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getSeries(route.params.slug, session?.access_token)
      .then((seriesData) => {
        if (isMounted) {
          setData(seriesData);
          setError(null);
        }
      })
      .catch((seriesError) => {
        if (isMounted) {
          setError(seriesError instanceof Error ? seriesError.message : "Could not load series.");
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
  }, [route.params.slug, session?.access_token]);

  if (isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <ErrorText>{error ?? "Series not found."}</ErrorText>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{data.series.title}</Title>
      <Body>{data.series.synopsis}</Body>
      {data.series.episodes.map((episode) => {
        const access = data.episodeAccess[String(episode.number)];

        return (
          <Card key={episode.number}>
            <Label>{access?.label ?? "Locked"}</Label>
            <Title>{episode.title}</Title>
            <Body>{episode.description}</Body>
            <Button
              accessibilityLabel={
                access?.canWatch ? `Watch ${episode.title}` : `${episode.title} is locked`
              }
              disabled={!access?.canWatch}
              onPress={() =>
                navigation.navigate("Watch", {
                  access,
                  episode,
                  series: data.series,
                })
              }
            >
              {access?.canWatch ? "Watch" : "Locked"}
            </Button>
          </Card>
        );
      })}
    </Screen>
  );
}
