import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import appJson from "../../app.json";
import { Screen } from "../components/Screen";
import { Body, Card, Label } from "../components/ui";
import {
  getAutoplayNextPreference,
  getMarketingNotificationsPreference,
  getNewReleaseNotificationsPreference,
  setAutoplayNextPreference,
  setMarketingNotificationsPreference,
  setNewReleaseNotificationsPreference,
} from "../lib/settingsPreferences";
import { getSubtitlePreference, setSubtitlePreference, type SubtitlePreference } from "../lib/subtitles";
import type { ProfileStackScreenProps } from "../navigation/types";
import { borders, colors } from "../theme/tokens";

type Props = ProfileStackScreenProps<"Settings">;

const appVersion = appJson.expo?.version ?? "unknown";

function formatSubtitleLanguage(value: string | null) {
  if (!value) {
    return "Auto";
  }

  switch (value.toLowerCase()) {
    case "en":
      return "English";
    case "hi":
      return "Hindi";
    default:
      return value.toUpperCase();
  }
}

function SettingsRow({
  detail,
  label,
  onPress,
  value,
}: {
  detail?: string;
  label: string;
  onPress?: () => void;
  value?: string;
}) {
  const content = (
    <View style={[styles.row, styles.staticRow]}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.rowPressable, pressed && styles.rowPressablePressed]}
    >
      {content}
    </Pressable>
  );
}

function SettingsToggleRow({
  detail,
  label,
  onValueChange,
  value,
}: {
  detail?: string;
  label: string;
  onValueChange: (nextValue: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        onValueChange={onValueChange}
        thumbColor={value ? colors.accent : "#f1efe9"}
        trackColor={{ false: "#3c3a37", true: colors.accent }}
        value={value}
      />
    </View>
  );
}

export function SettingsScreen({}: Props) {
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [newReleaseNotifications, setNewReleaseNotifications] = useState(false);
  const [marketingNotifications, setMarketingNotifications] = useState(false);
  const [subtitlePreference, setSubtitlePreferenceState] = useState<SubtitlePreference>({
    enabled: false,
    preferredLanguageCode: null,
  });
  const [deviceSettingsError, setDeviceSettingsError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void Promise.all([
      getAutoplayNextPreference(),
      getNewReleaseNotificationsPreference(),
      getMarketingNotificationsPreference(),
      getSubtitlePreference(),
    ])
      .then(([nextAutoplay, newReleases, marketing, subtitle]) => {
        if (!isActive) {
          return;
        }

        setAutoplayNext(nextAutoplay);
        setNewReleaseNotifications(newReleases);
        setMarketingNotifications(marketing);
        setSubtitlePreferenceState(subtitle);
      })
      .catch(() => {
        console.warn("Unable to load settings preferences.");
      });

    return () => {
      isActive = false;
    };
  }, []);

  const updateSubtitlePreference = async (nextPreference: SubtitlePreference) => {
    setSubtitlePreferenceState(nextPreference);
    await setSubtitlePreference(nextPreference);
  };

  const openSubtitleLanguagePicker = () => {
    const subtitleLanguageOptions: Array<{ label: string; value: string | null }> = [
      { label: "Auto", value: null },
      { label: "English", value: "en" },
      { label: "Hindi", value: "hi" },
    ];

    Alert.alert(
      "Default subtitle language",
      "Choose the default subtitle language for future playback.",
      [
        { style: "cancel", text: "Cancel" },
        ...subtitleLanguageOptions.map((option) => ({
          onPress: () => {
            void updateSubtitlePreference({
              enabled: subtitlePreference.enabled,
              preferredLanguageCode: option.value,
            });
          },
          text: option.label,
        })),
      ],
    );
  };

  const handleOpenDeviceSettings = async () => {
    setDeviceSettingsError(null);

    try {
      await Linking.openSettings();
    } catch {
      setDeviceSettingsError("We couldn't open Android settings.");
    }
  };

  const handleMissingDestination = (label: string) => {
    Alert.alert("Not available yet", `${label} is not wired in this build.`);
  };

  return (
    <Screen>
      <Card>
        <Label>Playback</Label>
        <SettingsToggleRow
          detail="Resume to the next episode when the current one ends."
          label="Autoplay Next"
          onValueChange={async (nextValue) => {
            setAutoplayNext(nextValue);
            await setAutoplayNextPreference(nextValue);
          }}
          value={autoplayNext}
        />
        <SettingsRow
          detail="Adaptive streaming. Manual quality selection is not available in the current expo-video setup."
          label="Streaming Quality"
          value="Auto"
        />
      </Card>

      <Card>
        <Label>Subtitles</Label>
        <SettingsRow
          detail="Use the default subtitle language on future playback when available."
          label="Default Language"
          onPress={openSubtitleLanguagePicker}
          value={formatSubtitleLanguage(subtitlePreference.preferredLanguageCode)}
        />
      </Card>

      <Card>
        <Label>Notifications</Label>
        <SettingsToggleRow
          detail="Stored locally for later push integration."
          label="New Releases"
          onValueChange={async (nextValue) => {
            setNewReleaseNotifications(nextValue);
            await setNewReleaseNotificationsPreference(nextValue);
          }}
          value={newReleaseNotifications}
        />
        <SettingsToggleRow
          detail="Consent is stored locally and does not grant Android notification permission."
          label="Marketing"
          onValueChange={async (nextValue) => {
            setMarketingNotifications(nextValue);
            await setMarketingNotificationsPreference(nextValue);
          }}
          value={marketingNotifications}
        />
      </Card>

      <Card>
        <Label>Privacy</Label>
        <SettingsRow
          detail="Open Android app settings for app permissions and privacy controls."
          label="Data / Permissions"
          onPress={() => void handleOpenDeviceSettings()}
          value="Open"
        />
      </Card>

      <Card>
        <Label>Support & Legal</Label>
        <SettingsRow
          detail="MISSING / NOT PROVEN — no app destination was found in the repository."
          label="Help & Support"
          onPress={() => handleMissingDestination("Help & Support")}
          value="MISSING"
        />
        <SettingsRow
          detail="MISSING / NOT PROVEN — no content-issue destination was found in the repository."
          label="Report a Content Issue"
          onPress={() => handleMissingDestination("Report a Content Issue")}
          value="MISSING"
        />
        <SettingsRow
          detail="MISSING / NOT PROVEN — no grievance/contact destination was found in the repository."
          label="Grievance / Contact"
          onPress={() => handleMissingDestination("Grievance / Contact")}
          value="MISSING"
        />
        <SettingsRow
          detail="MISSING / NOT PROVEN — no legal terms destination was found in the repository."
          label="Terms"
          onPress={() => handleMissingDestination("Terms")}
          value="MISSING"
        />
        <SettingsRow
          detail="MISSING / NOT PROVEN — no privacy-policy destination was found in the repository."
          label="Privacy Policy"
          onPress={() => handleMissingDestination("Privacy Policy")}
          value="MISSING"
        />
      </Card>

      <Card>
        <Label>App</Label>
        <SettingsRow label="Version" value={appVersion} />
      </Card>

      {deviceSettingsError ? <Body>{deviceSettingsError}</Body> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowPressable: {
    borderBottomColor: borders.color,
    borderBottomWidth: borders.width,
    paddingVertical: 4,
  },
  staticRow: {
    borderBottomColor: borders.color,
    borderBottomWidth: borders.width,
    paddingVertical: 12,
  },
  rowPressablePressed: {
    opacity: 0.74,
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
  toggleRow: {
    alignItems: "center",
    borderBottomColor: borders.color,
    borderBottomWidth: borders.width,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 12,
  },
});
