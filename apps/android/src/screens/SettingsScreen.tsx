import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import appJson from "../../app.json";
import { Screen } from "../components/Screen";
import { Body, Button, Card, Label } from "../components/ui";
import { useAuth } from "../lib/authContext";
import {
  clearParentalSessionUnlock,
  getParentalScope,
  loadParentalControls,
  updateParentalRestrictionSettings,
  type ParentalControlState,
  type ParentalRestrictionThreshold,
} from "../lib/parentalControls";
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

export function SettingsScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [newReleaseNotifications, setNewReleaseNotifications] = useState(false);
  const [marketingNotifications, setMarketingNotifications] = useState(false);
  const [subtitlePreference, setSubtitlePreferenceState] = useState<SubtitlePreference>({
    enabled: false,
    preferredLanguageCode: null,
  });
  const [deviceSettingsError, setDeviceSettingsError] = useState<string | null>(null);
  const [parentalControls, setParentalControls] = useState<ParentalControlState | null>(null);
  const [parentalControlsError, setParentalControlsError] = useState<string | null>(null);
  const [isSavingParentalControls, setIsSavingParentalControls] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      void loadParentalControls(session)
        .then((status) => {
          if (!isActive) {
            return;
          }

          setParentalControls(status);
          setParentalControlsError(null);
        })
        .catch(() => {
          if (isActive) {
            setParentalControlsError("We couldn't load parental controls.");
          }
        });

      return () => {
        isActive = false;
      };
    }, [session]),
  );

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
    Alert.alert("Not available yet", `${label} is not available yet.`);
  };

  const saveParentalSettings = async (
    restrictionsEnabled: boolean,
    restrictionThreshold: ParentalRestrictionThreshold | null,
  ) => {
    setIsSavingParentalControls(true);
    setParentalControlsError(null);

    try {
      const result = await updateParentalRestrictionSettings(session, {
        restrictionsEnabled,
        restrictionThreshold,
      });

      if (!result.success) {
        if (result.status === "not_configured") {
          setParentalControlsError("Set a parental PIN before turning restrictions on.");
        } else if (result.status === "invalid_threshold") {
          setParentalControlsError("Choose a restriction level first.");
        } else {
          setParentalControlsError("We couldn't save parental controls.");
        }
        return;
      }

      setParentalControls(result);
    } catch {
      setParentalControlsError("We couldn't save parental controls.");
    } finally {
      setIsSavingParentalControls(false);
    }
  };

  const handleParentalRestrictionsToggle = (enabled: boolean) => {
    if (enabled && !parentalControls?.hasPin) {
      navigation.navigate("ParentalControls", { mode: "manage" });
      return;
    }

    const threshold = parentalControls?.restrictionThreshold ?? "U/A 13+";
    void saveParentalSettings(enabled, enabled ? threshold : parentalControls?.restrictionThreshold ?? null);
  };

  const handleThresholdChange = (threshold: ParentalRestrictionThreshold) => {
    if (!parentalControls?.hasPin) {
      navigation.navigate("ParentalControls", { mode: "manage" });
      return;
    }

    void saveParentalSettings(true, threshold);
  };

  const handleLockNow = () => {
    clearParentalSessionUnlock(getParentalScope(session));
    Alert.alert("Locked", "Parental access is locked for this app session.");
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
        <Label>Parental Controls</Label>
        <SettingsToggleRow
          detail="When off, U/A content plays normally."
          label="Parental restrictions"
          onValueChange={handleParentalRestrictionsToggle}
          value={parentalControls?.restrictionsEnabled ?? false}
        />
        {parentalControls?.restrictionsEnabled ? (
          <>
            <SettingsRow
              detail="Require PIN for U/A 13+ and U/A 16+ content."
              label="U/A 13+ and above"
              onPress={() => handleThresholdChange("U/A 13+")}
              value={parentalControls.restrictionThreshold === "U/A 13+" ? "Selected" : undefined}
            />
            <SettingsRow
              detail="Allow U/A 13+ without PIN; require PIN for U/A 16+."
              label="U/A 16+ and above"
              onPress={() => handleThresholdChange("U/A 16+")}
              value={parentalControls.restrictionThreshold === "U/A 16+" ? "Selected" : undefined}
            />
          </>
        ) : null}
        <SettingsRow
          detail={parentalControls?.hasPin ? "Update your existing PIN." : "Create a PIN before enabling restrictions."}
          label={parentalControls?.hasPin ? "Change PIN" : "Set PIN"}
          onPress={() => navigation.navigate("ParentalControls", { mode: "manage" })}
          value={parentalControls?.hasPin ? "Ready" : "Required"}
        />
        <Button
          accessibilityLabel="Lock parental controls now"
          disabled={!parentalControls?.hasPin || isSavingParentalControls}
          onPress={handleLockNow}
        >
          Lock now
        </Button>
        {parentalControlsError ? <Body>{parentalControlsError}</Body> : null}
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
          detail="Support destination is not available yet."
          label="Help & Support"
          onPress={() => handleMissingDestination("Help & Support")}
          value="Coming soon"
        />
        <SettingsRow
          detail="Content issue reporting is not available yet."
          label="Report a Content Issue"
          onPress={() => handleMissingDestination("Report a Content Issue")}
          value="Coming soon"
        />
        <SettingsRow
          detail="Grievance contact is not available yet."
          label="Grievance / Contact"
          onPress={() => handleMissingDestination("Grievance / Contact")}
          value="Coming soon"
        />
        <SettingsRow
          detail="Terms destination is not available yet."
          label="Terms"
          onPress={() => handleMissingDestination("Terms")}
          value="Coming soon"
        />
        <SettingsRow
          detail="Privacy policy destination is not available yet."
          label="Privacy Policy"
          onPress={() => handleMissingDestination("Privacy Policy")}
          value="Coming soon"
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
