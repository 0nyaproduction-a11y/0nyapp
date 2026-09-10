import { useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen } from "../components/Screen";
import { BrandWordmark, Button, ErrorText } from "../components/ui";
import { useAuth } from "../lib/authContext";
import { useAppLanguage } from "../lib/appLanguage";
import { buildPrivacyUrl, buildTermsUrl } from "../lib/content-links";
import { supabase } from "../lib/supabase";
import type { RootStackScreenProps } from "../navigation/types";
import { borders, colors, radii, spacing, surfaces, typography } from "../theme/tokens";

const INDIA_PHONE_PREFIX = "+91";
const OTP_LENGTH = 6;
const PHONE_LENGTH = 10;
const RESEND_SECONDS = 45;

type AuthStep = "phone" | "otp";

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function maskPhoneNumber(phoneDigits: string) {
  const lastFour = phoneDigits.slice(-4);
  const hiddenDigits = "\u2022".repeat(Math.max(0, PHONE_LENGTH - 4));
  return `${INDIA_PHONE_PREFIX} ${hiddenDigits}${lastFour}`;
}

function getSafeAuthErrorMessage(error: { code?: string; message: string }, action: "send" | "verify") {
  const errorText = `${error.code ?? ""} ${error.message}`.toLowerCase();
  const providerUnavailable =
    errorText.includes("phone_provider_disabled") ||
    errorText.includes("provider") ||
    errorText.includes("sms") ||
    errorText.includes("twilio") ||
    errorText.includes("not enabled") ||
    errorText.includes("not configured");

  if (providerUnavailable) {
    return "Phone verification is not available in this build right now.";
  }

  if (action === "verify") {
    return "That code did not work. Please try again.";
  }

  return "We couldn't send a code right now. Please try again.";
}

export function SignInScreen() {
  const navigation = useNavigation<RootStackScreenProps<"SignIn">["navigation"]>();
  const { signIn } = useAuth();
  const { t } = useAppLanguage();
  const [step, setStep] = useState<AuthStep>("phone");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [otp, setOtp] = useState("");
  const [devEmail, setDevEmail] = useState("");
  const [devPassword, setDevPassword] = useState("");
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isDevSigningIn, setIsDevSigningIn] = useState(false);
  const [resendSecondsRemaining, setResendSecondsRemaining] = useState(0);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);

  // Ensure no header right element is shown
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => null,
    });
  }, [navigation]);

  const canSendCode = phoneDigits.length === PHONE_LENGTH && !isSendingCode && !isVerifyingCode;
  const canVerifyCode = otp.length === OTP_LENGTH && !isSendingCode && !isVerifyingCode;
  const resendAvailable = step === "otp" && resendSecondsRemaining === 0 && !isSendingCode && !isVerifyingCode;

  const maskedPhone = useMemo(() => {
    if (!pendingPhone) {
      return `${INDIA_PHONE_PREFIX} ${"\u2022".repeat(6)}0000`;
    }

    const digits = pendingPhone.replace(`${INDIA_PHONE_PREFIX}`, "");
    return maskPhoneNumber(normalizeDigits(digits));
  }, [pendingPhone]);

  useEffect(() => {
    if (step !== "otp" || resendSecondsRemaining <= 0) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setResendSecondsRemaining((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [resendSecondsRemaining, step]);

  async function sendCode(nextDigits = phoneDigits) {
    const normalized = normalizeDigits(nextDigits);

    if (normalized.length !== PHONE_LENGTH) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    setIsSendingCode(true);
    setError(null);
    setMessage(null);

    try {
      const phone = `${INDIA_PHONE_PREFIX}${normalized}`;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone,
      });
      if (otpError) {
        setError(getSafeAuthErrorMessage(otpError, "send"));
        return;
      }

      setPendingPhone(phone);
      setPhoneDigits(normalized);
      setOtp("");
      setStep("otp");
      setResendSecondsRemaining(RESEND_SECONDS);
      setMessage("Enter the 6-digit code sent to your phone.");
    } catch {
      setError("We couldn't send a code right now. Please try again.");
    } finally {
      setIsSendingCode(false);
    }
  }

  async function verifyCode() {
    if (!pendingPhone || otp.length !== OTP_LENGTH) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setIsVerifyingCode(true);
    setError(null);
    setMessage(null);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: pendingPhone,
        token: otp,
        type: "sms",
      });

      if (verifyError) {
        setError(getSafeAuthErrorMessage(verifyError, "verify"));
        return;
      }

      navigation.replace("AgeDeclaration");
    } catch {
      setError("We couldn't verify that code right now. Please try again.");
    } finally {
      setIsVerifyingCode(false);
    }
  }

  async function signInWithDevAccount() {
    const email = devEmail.trim();

    if (!email || !devPassword) {
      setError("Enter the development email and password.");
      return;
    }

    setIsDevSigningIn(true);
    setError(null);
    setMessage(null);

    try {
      await signIn(email, devPassword);

      navigation.replace("AgeDeclaration");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Development sign-in failed.");
    } finally {
      setIsDevSigningIn(false);
    }
  }

  function handleChangeNumber() {
    setStep("phone");
    setOtp("");
    setMessage(null);
    setError(null);
    setResendSecondsRemaining(0);
  }

  function handleResend() {
    if (!resendAvailable || !pendingPhone) {
      return;
    }

    void sendCode(phoneDigits);
  }

  async function handleOpenLink(url: string | null) {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      // Graceful fallback
    }
  }

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Main content */}
          <View style={styles.mainContent}>
            <View style={styles.brandRow}>
              <BrandWordmark style={styles.brand} />
            </View>

            {step === "phone" ? (
              <View style={styles.formContent}>
                <Text style={styles.title}>{t("signin.header", "Enter your mobile number")}</Text>
                <Text style={styles.subtitle}>
                  {t(
                    "signin.subtitle",
                    "We'll send a 6-digit verification code to sign in or create your account."
                  )}
                </Text>

                <View
                  style={[
                    styles.phoneInputContainer,
                    isPhoneFocused && styles.phoneInputContainerFocused,
                  ]}
                >
                  <Text style={styles.phonePrefix}>{INDIA_PHONE_PREFIX}</Text>
                  <View style={styles.phoneDivider} />
                  <TextInput
                    accessibilityLabel={t("signin.phone_label", "Mobile number")}
                    autoCapitalize="none"
                    autoComplete="tel"
                    keyboardType="phone-pad"
                    maxLength={PHONE_LENGTH}
                    onBlur={() => setIsPhoneFocused(false)}
                    onChangeText={(value) => setPhoneDigits(normalizeDigits(value))}
                    onFocus={() => setIsPhoneFocused(true)}
                    placeholder={t("signin.phone_placeholder", "10-digit number")}
                    placeholderTextColor={colors.textDisabled}
                    style={styles.phoneInput}
                    textContentType="telephoneNumber"
                    value={phoneDigits}
                  />
                </View>

                {message ? <Text style={styles.messageText}>{message}</Text> : null}
                {error ? <ErrorText>{error}</ErrorText> : null}

                <Pressable
                  accessibilityLabel={t("signin.get_otp", "Send OTP")}
                  accessibilityRole="button"
                  disabled={!canSendCode}
                  onPress={() => void sendCode()}
                  style={({ pressed }) => [
                    styles.ctaButton,
                    canSendCode ? styles.ctaButtonActive : styles.ctaButtonResting,
                    pressed && canSendCode && styles.ctaButtonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.ctaButtonText,
                      canSendCode ? styles.ctaButtonTextActive : styles.ctaButtonTextResting,
                    ]}
                  >
                    {isSendingCode ? "Sending..." : t("signin.get_otp", "Send OTP")}
                  </Text>
                </Pressable>

                <Text style={styles.disclaimerText}>
                  {t("signin.help_text", "Your number is used to verify your 0nya account.")}
                </Text>
              </View>
            ) : (
              <View style={styles.formContent}>
                <Text style={styles.title}>{t("signin.enter_code", "Enter OTP")}</Text>
                <Text style={styles.subtitle}>
                  {`We've sent a 6-digit code to ${maskedPhone}`}
                </Text>

                <View style={styles.otpInputWrap}>
                  <View pointerEvents="none" style={styles.otpBoxes}>
                    {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                      <View
                        key={`otp-box-${index}`}
                        style={[
                          styles.otpBox,
                          otp[index] ? styles.otpBoxFilled : null,
                          otp.length === index ? styles.otpBoxActive : null,
                        ]}
                      >
                        <Text style={styles.otpBoxText}>{otp[index] ?? ""}</Text>
                      </View>
                    ))}
                  </View>
                  <TextInput
                    accessibilityLabel="Verification code"
                    autoCapitalize="none"
                    autoComplete="one-time-code"
                    keyboardType="number-pad"
                    maxLength={OTP_LENGTH}
                    onChangeText={(value) => setOtp(normalizeDigits(value))}
                    style={styles.otpInputOverlay}
                    textContentType="oneTimeCode"
                    value={otp}
                  />
                </View>

                {message ? <Text style={styles.messageText}>{message}</Text> : null}
                {error ? <ErrorText>{error}</ErrorText> : null}

                <Pressable
                  accessibilityLabel={t("signin.continue", "Verify & Continue")}
                  accessibilityRole="button"
                  disabled={!canVerifyCode}
                  onPress={() => void verifyCode()}
                  style={({ pressed }) => [
                    styles.ctaButton,
                    canVerifyCode ? styles.ctaButtonActive : styles.ctaButtonResting,
                    pressed && canVerifyCode && styles.ctaButtonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.ctaButtonText,
                      canVerifyCode ? styles.ctaButtonTextActive : styles.ctaButtonTextResting,
                    ]}
                  >
                    {isVerifyingCode ? "Verifying..." : t("signin.continue", "Verify & Continue")}
                  </Text>
                </Pressable>

                <View style={styles.otpActionRow}>
                  <Pressable
                    accessibilityLabel={
                      resendAvailable
                        ? t("signin.resend_code", "Resend code")
                        : `Resend in ${resendSecondsRemaining} seconds`
                    }
                    accessibilityRole="button"
                    disabled={!resendAvailable}
                    onPress={handleResend}
                    style={({ pressed }) => [
                      styles.linkAction,
                      !resendAvailable && styles.linkActionDisabled,
                      pressed && resendAvailable && styles.linkActionPressed,
                    ]}
                  >
                    <Text style={styles.linkActionText}>
                      {resendAvailable
                        ? t("signin.resend_code", "Resend code")
                        : `Resend in ${resendSecondsRemaining}s`}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityLabel="Change mobile number"
                    accessibilityRole="button"
                    onPress={handleChangeNumber}
                    style={({ pressed }) => [styles.linkAction, pressed && styles.linkActionPressed]}
                  >
                    <Text style={styles.linkActionText}>Change number</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* Bottom section */}
          <View style={styles.bottomSection}>
            <View style={styles.legalRow}>
              <Pressable
                accessibilityLabel={t("settings.terms", "Terms")}
                accessibilityRole="link"
                onPress={() => void handleOpenLink(buildTermsUrl())}
                style={({ pressed }) => [styles.legalLink, pressed && styles.legalLinkPressed]}
              >
                <Text style={styles.legalLinkText}>
                  {t("settings.terms", "Terms")}
                </Text>
              </Pressable>
              <Text style={styles.legalDot}>{"\u2022"}</Text>
              <Pressable
                accessibilityLabel={t("settings.privacy_policy", "Privacy")}
                accessibilityRole="link"
                onPress={() => void handleOpenLink(buildPrivacyUrl())}
                style={({ pressed }) => [styles.legalLink, pressed && styles.legalLinkPressed]}
              >
                <Text style={styles.legalLinkText}>
                  {t("settings.privacy_policy", "Privacy")}
                </Text>
              </Pressable>
            </View>

            {/* Dev sign-in section: collapsible and dev-only */}
            {__DEV__ ? (
              <View style={styles.devWrapper}>
                <Pressable
                  accessibilityLabel="Toggle developer sign-in options"
                  accessibilityRole="button"
                  onPress={() => setShowDevPanel((prev) => !prev)}
                  style={styles.devToggle}
                >
                  <Text style={styles.devToggleText}>
                    {showDevPanel ? "\u25B2 Hide Development Sign-In" : "\u25BC Development Sign-In"}
                  </Text>
                </Pressable>

                {showDevPanel ? (
                  <View style={styles.devSection}>
                    <Text style={styles.devHeading}>Development Sign-In</Text>
                    <Text style={styles.devHelper}>
                      Sign in with a Supabase developer or test account.
                    </Text>
                    <TextInput
                      accessibilityLabel="Development email"
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      onChangeText={setDevEmail}
                      placeholder="Email"
                      placeholderTextColor={colors.textDisabled}
                      style={styles.devInput}
                      textContentType="emailAddress"
                      value={devEmail}
                    />
                    <TextInput
                      accessibilityLabel="Development password"
                      autoCapitalize="none"
                      autoComplete="password"
                      onChangeText={setDevPassword}
                      placeholder="Password"
                      placeholderTextColor={colors.textDisabled}
                      secureTextEntry
                      style={styles.devInput}
                      textContentType="password"
                      value={devPassword}
                    />
                    <Button
                      accessibilityLabel="Development sign-in"
                      disabled={isDevSigningIn}
                      onPress={() => void signInWithDevAccount()}
                      style={styles.devButton}
                      variant="secondary"
                    >
                      {isDevSigningIn ? "Signing in..." : "Development sign-in"}
                    </Button>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
  },
  mainContent: {
    paddingTop: spacing.xs,
  },
  brandRow: {
    paddingBottom: spacing.base,
  },
  brand: {
    fontSize: 20,
    lineHeight: 24,
  },
  formContent: {
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  phoneInputContainer: {
    alignItems: "center",
    backgroundColor: surfaces.s2,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
    flexDirection: "row",
    height: 52,
    marginTop: spacing.xs,
    paddingHorizontal: 16,
  },
  phoneInputContainerFocused: {
    backgroundColor: "rgba(43, 126, 125, 0.06)",
    borderColor: colors.accent,
  },
  phonePrefix: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.label.fontFamily,
    fontSize: 15,
    fontWeight: "600",
  },
  phoneDivider: {
    backgroundColor: colors.borderSubtle,
    height: 22,
    marginHorizontal: 14,
    width: 1,
  },
  phoneInput: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    fontSize: 16,
    letterSpacing: 0.6,
    paddingVertical: 0,
  },
  ctaButton: {
    alignItems: "center",
    borderRadius: radii.cta,
    height: 48,
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  ctaButtonResting: {
    backgroundColor: "rgba(43, 126, 125, 0.16)",
    borderColor: "rgba(43, 126, 125, 0.28)",
    borderWidth: 1,
  },
  ctaButtonActive: {
    backgroundColor: colors.accent,
    borderColor: "transparent",
    borderWidth: 0,
  },
  ctaButtonPressed: {
    opacity: 0.86,
  },
  ctaButtonText: {
    ...typography.label,
    fontSize: 15,
    fontWeight: "600",
  },
  ctaButtonTextResting: {
    color: "rgba(254, 253, 253, 0.45)",
  },
  ctaButtonTextActive: {
    color: colors.accentOnPrimary,
  },
  disclaimerText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  messageText: {
    ...typography.caption,
    color: colors.accent,
    lineHeight: 18,
  },
  otpInputWrap: {
    minHeight: 52,
    marginTop: spacing.xs,
  },
  otpBoxes: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  otpBox: {
    alignItems: "center",
    backgroundColor: surfaces.s2,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
    flex: 1,
    height: 52,
    justifyContent: "center",
  },
  otpBoxFilled: {
    backgroundColor: "rgba(43, 126, 125, 0.12)",
    borderColor: colors.accent,
  },
  otpBoxActive: {
    borderColor: colors.accentHighlight,
  },
  otpBoxText: {
    ...typography.h2,
    color: colors.text,
  },
  otpInputOverlay: {
    bottom: 0,
    color: "transparent",
    left: 0,
    opacity: 0.02,
    position: "absolute",
    right: 0,
    top: 0,
  },
  otpActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  linkAction: {
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: 8,
  },
  linkActionDisabled: {
    opacity: 0.45,
  },
  linkActionPressed: {
    opacity: 0.76,
  },
  linkActionText: {
    ...typography.caption,
    color: colors.accent,
    fontFamily: typography.label.fontFamily,
    fontWeight: "600",
  },
  bottomSection: {
    gap: 12,
    marginTop: spacing.lg,
  },
  legalRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: spacing.xs,
  },
  legalLink: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 8,
  },
  legalLinkPressed: {
    opacity: 0.6,
  },
  legalLinkText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
  },
  legalDot: {
    color: colors.textDisabled,
    fontSize: 12,
    marginHorizontal: 4,
  },
  devWrapper: {
    alignItems: "center",
    marginTop: spacing.xs,
    width: "100%",
  },
  devToggle: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  devToggleText: {
    ...typography.caption,
    color: colors.textDisabled,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  devSection: {
    borderTopColor: colors.borderSubtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    marginTop: spacing.sm,
    paddingTop: spacing.base,
    width: "100%",
  },
  devHeading: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  devHelper: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  devInput: {
    backgroundColor: surfaces.s2,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
    color: colors.text,
    height: 48,
    paddingHorizontal: 14,
  },
  devButton: {
    marginTop: 2,
  },
});
