import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import appJson from "../../app.json";
import { Screen } from "../components/Screen";
import { Body, Button, Card, Label } from "../components/ui";
import { useAuth } from "../lib/authContext";
import { useAppLanguage } from "../lib/appLanguage";
import {
  buildGrievanceUrl,
  buildHelpUrl,
  buildPrivacyUrl,
  buildReportContentUrl,
  buildTermsUrl,
} from "../lib/content-links";
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
import { borders, colors, radii, spacing, typography } from "../theme/tokens";

type Props = ProfileStackScreenProps<"Settings">;

const appVersion = appJson.expo?.version ?? "unknown";

function formatSubtitleLanguage(value: string | null, t?: (key: string, fallback: string) => string) {
  if (!value) {
    return t ? t("settings.auto", "Auto") : "Auto";
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
  valueVariant = "accent",
}: {
  detail?: string;
  label: string;
  onPress?: () => void;
  value?: string;
  valueVariant?: "accent" | "muted";
}) {
  const isMuted = valueVariant === "muted" || value === "Coming soon";
  const content = (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {value ? (
        <Text style={[styles.rowValue, isMuted && styles.rowValueMuted]}>{value}</Text>
      ) : null}
    </View>
  );

  if (!onPress) {
    return <View style={styles.rowWrapper}>{content}</View>;
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
        thumbColor={value ? colors.accent : colors.muted}
        trackColor={{ false: colors.borderStrong, true: "rgba(43, 126, 125, 0.4)" }}
        value={value}
      />
    </View>
  );
}

export function SettingsScreen({ navigation }: Props) {
  const { session } = useAuth();
  const { setLanguage, t } = useAppLanguage();
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
    // Hindi subtitle option hidden for now.
    const subtitleLanguageOptions: Array<{ label: string; value: string | null }> = [
      { label: "Auto", value: null },
      { label: "English", value: "en" },
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

  const openCanonicalLink = useCallback(async (url: string | null, label: string) => {
    if (!url) {
      handleMissingDestination(label);
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      handleMissingDestination(label);
    }
  }, []);

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
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("settings.section_app", "App Interface")}</Text>
        {/* Hindi app-language option hidden for now; interface stays English-only. */}
        <SettingsRow
          detail={t("settings.app_language_detail", "Choose app interface language.")}
          label={t("settings.app_language", "App Language")}
          onPress={() => {
            Alert.alert(
              t("settings.app_language", "App Language"),
              t("settings.app_language_detail", "Choose app interface language."),
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "English",
                  onPress: () => setLanguage("en"),
                },
              ],
            );
          }}
          value="English"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("settings.section_playback", "Playback")}</Text>
        <SettingsToggleRow
          detail={t("settings.autoplay_next_detail", "Resume to the next episode when the current one ends.")}
          label={t("settings.autoplay_next", "Autoplay Next")}
          onValueChange={async (nextValue) => {
            setAutoplayNext(nextValue);
            await setAutoplayNextPreference(nextValue);
          }}
          value={autoplayNext}
        />
        <SettingsRow
          detail={t("settings.streaming_quality_detail", "Automatically adjusts during playback.")}
          label={t("settings.streaming_quality", "Streaming Quality")}
          value={t("settings.auto", "Auto")}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("settings.section_subtitles", "Subtitles")}</Text>
        <SettingsRow
          detail={t("settings.default_subtitle_detail", "Preferred subtitle language when available.")}
          label={t("settings.default_subtitle_language", "Default Language")}
          onPress={openSubtitleLanguagePicker}
          value={formatSubtitleLanguage(subtitlePreference.preferredLanguageCode, t)}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("settings.section_notifications", "Notifications")}</Text>
        <SettingsToggleRow
          detail={t("settings.new_releases_detail", "Get notified when new episodes and films drop.")}
          label={t("settings.new_releases", "New Releases")}
          onValueChange={async (nextValue) => {
            setNewReleaseNotifications(nextValue);
            await setNewReleaseNotificationsPreference(nextValue);
          }}
          value={newReleaseNotifications}
        />
        <SettingsToggleRow
          detail={t("settings.marketing_detail", "Updates on featured releases and special offers.")}
          label={t("settings.marketing", "Marketing")}
          onValueChange={async (nextValue) => {
            setMarketingNotifications(nextValue);
            await setMarketingNotificationsPreference(nextValue);
          }}
          value={marketingNotifications}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("settings.section_parental_controls", "Parental Controls")}</Text>
        <SettingsToggleRow
          detail={t("settings.parental_restrictions_detail", "When off, all content plays normally.")}
          label={t("settings.parental_restrictions", "Parental restrictions")}
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
          style={styles.lockButton}
          variant="secondary"
        >
          Lock now
        </Button>
        {parentalControlsError ? <Body style={styles.errorText}>{parentalControlsError}</Body> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("settings.section_privacy", "Privacy")}</Text>
        <SettingsRow
          detail="Open Android settings for app permissions and privacy controls."
          label={t("settings.data_permissions", "Data / Permissions")}
          onPress={() => void handleOpenDeviceSettings()}
          value="Open"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("settings.section_support_legal", "Support & Legal")}</Text>
        <SettingsRow
          label={t("settings.help_support", "Help & Support")}
          onPress={() => openCanonicalLink(buildHelpUrl(), "Help & Support")}
          value="Open"
        />
        <SettingsRow
          label={t("settings.report_content", "Report a Content Issue")}
          onPress={() => openCanonicalLink(buildReportContentUrl(), "Report a Content Issue")}
          value="Open"
        />
        <SettingsRow
          label={t("settings.grievance", "Grievance / Contact")}
          onPress={() => openCanonicalLink(buildGrievanceUrl(), "Grievance / Contact")}
          value="Open"
        />
        <SettingsRow
          label={t("settings.terms", "Terms")}
          onPress={() => openCanonicalLink(buildTermsUrl(), "Terms")}
          value="Open"
        />
        <SettingsRow
          label={t("settings.privacy_policy", "Privacy Policy")}
          onPress={() => openCanonicalLink(buildPrivacyUrl(), "Privacy Policy")}
          value="Open"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("settings.section_app", "App")}</Text>
        <SettingsRow label={t("settings.version", "Version")} value={appVersion} />
      </View>

      {deviceSettingsError ? <Body style={styles.errorText}>{deviceSettingsError}</Body> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    ...typography.micro,
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  rowWrapper: {
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 48,
    paddingVertical: 12,
  },
  rowPressable: {
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressablePressed: {
    backgroundColor: colors.surfacePressed,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  rowLabel: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.label.fontFamily,
    fontWeight: "500",
  },
  rowDetail: {
    ...typography.caption,
    color: colors.muted,
  },
  rowValue: {
    ...typography.caption,
    color: colors.accent,
    fontFamily: typography.label.fontFamily,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  rowValueMuted: {
    color: colors.textMuted,
  },
  toggleRow: {
    alignItems: "center",
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 48,
    paddingVertical: 12,
  },
  lockButton: {
    marginTop: 12,
  },
  errorText: {
    marginTop: 8,
  },
});
