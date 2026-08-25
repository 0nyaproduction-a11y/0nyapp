import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { Body, Button, Card, ErrorText, Label, Title } from "../components/ui";
import { useAdMob } from "../lib/adMob";
import { useAuth } from "../lib/authContext";
import { useEpisodeRewardedUnlockAd } from "../lib/episodeRewardedUnlockAd";
import { getSubtitlePreference, type SubtitlePreference } from "../lib/subtitles";
import { colors, borders } from "../theme/tokens";
import type { ProfileStackScreenProps } from "../navigation/types";

type Props = ProfileStackScreenProps<"Settings">;

function SettingsRow({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function SettingsScreen({ navigation }: Props) {
  const [deviceSettingsError, setDeviceSettingsError] = useState<string | null>(null);
  const [subtitlePreference, setSubtitlePreference] = useState<SubtitlePreference | null>(null);
  const [rewardedTestAdError, setRewardedTestAdError] = useState<string | null>(null);
  const { session } = useAuth();
  const adMob = useAdMob();
  const rewardedTestAd = useEpisodeRewardedUnlockAd({
    enabled: __DEV__,
  });
  const rootNavigation = navigation.getParent()?.getParent();

  const openDeviceSettings = useCallback(async () => {
    setDeviceSettingsError(null);

    try {
      await Linking.openSettings();
    } catch {
      setDeviceSettingsError("We couldn't open settings.");
    }
  }, []);

  useEffect(() => {
    let active = true;

    void getSubtitlePreference().then((preference) => {
      if (active) {
        setSubtitlePreference(preference);
      }
    }).catch(() => {
      console.warn("Unable to load subtitle preference.");
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen>
      <Title>Settings</Title>

      <Card>
        <Label>Playback</Label>
        <SettingsRow
          detail="No persisted V04 setting exists yet, so this reflects the current player behavior."
          label="Autoplay Next"
          value="On in player"
        />
        <SettingsRow
          detail="Adaptive streaming. Manual quality selection is not available yet."
          label="Streaming Quality"
          value="Auto"
        />
      </Card>

      <Card>
        <Label>Subtitles</Label>
        <SettingsRow
          detail="The player remembers the last subtitle on/off choice locally."
          label="Captions"
          value={subtitlePreference?.enabled ? "ON" : "OFF"}
        />
        <SettingsRow
          detail="Preferred language is matched on the next video when available."
          label="Preferred language"
          value={subtitlePreference?.preferredLanguageCode ?? "Unset"}
        />
      </Card>

      <Card>
        <Label>Notifications</Label>
        <SettingsRow
          detail="Push permission and backend notification infrastructure are not wired in this build."
          label="New Releases"
          value="Unavailable"
        />
        <SettingsRow
          detail="Marketing consent must stay off by default; explicit opt-in is not saved yet."
          label="Marketing"
          value="OFF"
        />
      </Card>

      <Card>
        <Label>Privacy / Data</Label>
        <Body>No Android Terms, Privacy, Help, or Grievance routes are wired yet.</Body>
        {adMob.privacyOptionsRequired ? (
          <Button accessibilityLabel="Open privacy choices" onPress={() => void adMob.showPrivacyChoices()}>
            Privacy choices
          </Button>
        ) : null}
        {__DEV__ ? (
          <>
            <Body>Development only: Google&apos;s TEST rewarded ad.</Body>
            <Body>
              {adMob.isInitialized
                ? "Consent prep finished. The test rewarded ad can be requested."
                : "Waiting for consent prep before requesting the test rewarded ad."}
            </Body>
            {rewardedTestAdError ? <ErrorText>{rewardedTestAdError}</ErrorText> : null}
            <Body>
              {rewardedTestAd.status === "failed"
                ? rewardedTestAd.error ?? "The test rewarded ad could not be prepared."
                : rewardedTestAd.lastEvent
                  ? `Last ad event: ${rewardedTestAd.lastEvent}`
                  : "No test ad event yet."}
            </Body>
            <Button
              accessibilityLabel="Show rewarded test ad"
              disabled={
                !adMob.canRequestAds ||
                !adMob.isInitialized ||
                rewardedTestAd.status === "loading" ||
                rewardedTestAd.status === "showing"
              }
              onPress={() => {
                setRewardedTestAdError(null);
                try {
                  rewardedTestAd.show();
                } catch (error) {
                  setRewardedTestAdError(
                    error instanceof Error ? error.message : "Unable to show rewarded test ad.",
                  );
                }
              }}
            >
              {rewardedTestAd.status === "loading"
                ? "Loading rewarded test ad"
                : rewardedTestAd.status === "showing"
                  ? "Rewarded test ad open"
                  : rewardedTestAd.status === "failed"
                    ? "Retry rewarded test ad"
                    : "Show rewarded test ad"}
            </Button>
          </>
        ) : null}
        <Button
          accessibilityLabel="Open parental controls"
          onPress={() => {
            rootNavigation?.navigate("ParentalControls", { mode: "manage" });
          }}
        >
          Parental Controls
        </Button>
        <Button accessibilityLabel="Open device settings" onPress={() => void openDeviceSettings()}>
          Data / Permissions
        </Button>
        {session?.access_token ? (
          <Button
            accessibilityLabel="Delete account"
            onPress={() => navigation.navigate("DeleteAccount")}
          >
            Delete Account
          </Button>
        ) : (
          <Body>Sign in to access account deletion.</Body>
        )}
        <Pressable
          accessibilityLabel="Back to profile"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.textAction, pressed && styles.textActionPressed]}
        >
          <Text style={styles.textActionText}>Back</Text>
        </Pressable>
      </Card>

      {adMob.bootstrapError ? <ErrorText>{adMob.bootstrapError}</ErrorText> : null}
      {deviceSettingsError ? <ErrorText>{deviceSettingsError}</ErrorText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "flex-start",
    borderBottomColor: borders.color,
    borderBottomWidth: borders.width,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  rowDetail: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  rowValue: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  textAction: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 6,
  },
  textActionPressed: {
    opacity: 0.72,
  },
  textActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
