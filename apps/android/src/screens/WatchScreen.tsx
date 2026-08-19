import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Body, Card, Label, Title } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Watch">;

export function WatchScreen({ route }: Props) {
  const { access, episode, series } = route.params;

  return (
    <Screen>
      <Title>{series.title}</Title>
      <Card>
        <Label>{access.label}</Label>
        <Title>{episode.title}</Title>
        <Body>
          Native playback will be added later. This screen is a guarded placeholder for
          accessible episodes only.
        </Body>
      </Card>
    </Screen>
  );
}
