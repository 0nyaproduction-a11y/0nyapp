import { useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { Body, Button, Card, ErrorText, Field, Label, Title } from "../components/ui";
import { useAuth } from "../lib/authContext";
import { supabase } from "../lib/supabase";
import type { RootStackScreenProps } from "../navigation/types";

const INDIA_PHONE_PREFIX = "+91";
const OTP_LENGTH = 6;
const PHONE_LENGTH = 10;
const RESEND_SECONDS = 30;

type AuthStep = "phone" | "otp";

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function maskPhoneNumber(phoneDigits: string) {
  const lastFour = phoneDigits.slice(-4);
  return `${INDIA_PHONE_PREFIX} ${"•".repeat(Math.max(0, PHONE_LENGTH - 4))}${lastFour}`;
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

  const canSendCode = phoneDigits.length === PHONE_LENGTH && !isSendingCode && !isVerifyingCode;
  const canVerifyCode = otp.length === OTP_LENGTH && !isSendingCode && !isVerifyingCode;
  const resendAvailable = step === "otp" && resendSecondsRemaining === 0 && !isSendingCode && !isVerifyingCode;

  const maskedPhone = useMemo(() => {
    if (!pendingPhone) {
      return `${INDIA_PHONE_PREFIX} ••••••0000`;
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

      if (navigation.canGoBack()) {
        navigation.goBack();
      }
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

      if (navigation.canGoBack()) {
        navigation.goBack();
      }
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

  return (
    <Screen>
      <Title>0nya</Title>
      <Card>
        <Label>Phone sign in</Label>
        {step === "phone" ? (
          <>
            <Title>Continue with phone</Title>
            <Body>We&apos;ll send a one-time code.</Body>
            <View style={styles.phoneRow}>
              <View style={styles.prefix}>
                <Text style={styles.prefixText}>{INDIA_PHONE_PREFIX}</Text>
              </View>
              <View style={styles.inputWrap}>
                <Field
                  accessibilityLabel="Mobile number"
                  autoComplete="tel"
                  autoCapitalize="none"
                  keyboardType="phone-pad"
                  maxLength={PHONE_LENGTH}
                  onChangeText={(value) => setPhoneDigits(normalizeDigits(value))}
                  placeholder="10-digit number"
                  textContentType="telephoneNumber"
                  value={phoneDigits}
                />
              </View>
            </View>
            {message ? <Body>{message}</Body> : null}
            {error ? <ErrorText>{error}</ErrorText> : null}
            <Button
              accessibilityLabel="Send OTP"
              disabled={!canSendCode}
              onPress={() => void sendCode()}
            >
              {isSendingCode ? "Sending" : "Continue"}
            </Button>
            <Pressable
              accessibilityLabel="Back"
              accessibilityRole="button"
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.textAction, pressed && styles.textActionPressed]}
            >
              <Text style={styles.textActionText}>Back</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Title>Enter verification code</Title>
            <Body>{`Sent to ${maskedPhone}`}</Body>
            <Field
              accessibilityLabel="Verification code"
              autoComplete="one-time-code"
              autoCapitalize="none"
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              onChangeText={(value) => setOtp(normalizeDigits(value))}
              placeholder="000000"
              textContentType="oneTimeCode"
              value={otp}
            />
            {message ? <Body>{message}</Body> : null}
            {error ? <ErrorText>{error}</ErrorText> : null}
            <Button
              accessibilityLabel="Verify OTP"
              disabled={!canVerifyCode}
              onPress={() => void verifyCode()}
            >
              {isVerifyingCode ? "Verifying" : "Verify"}
            </Button>
            <Pressable
              accessibilityLabel={resendAvailable ? "Resend code" : `Resend in ${resendSecondsRemaining} seconds`}
              accessibilityRole="button"
              disabled={!resendAvailable}
              onPress={handleResend}
              style={({ pressed }) => [
                styles.textAction,
                !resendAvailable && styles.textActionDisabled,
                pressed && resendAvailable && styles.textActionPressed,
              ]}
            >
              <Text style={styles.textActionText}>
                {resendAvailable ? "Resend code" : `Resend in 00:${String(resendSecondsRemaining).padStart(2, "0")}`}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Change number"
              accessibilityRole="button"
              onPress={handleChangeNumber}
              style={({ pressed }) => [styles.textAction, pressed && styles.textActionPressed]}
            >
              <Text style={styles.textActionText}>Change number</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Back"
              accessibilityRole="button"
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.textAction, pressed && styles.textActionPressed]}
            >
              <Text style={styles.textActionText}>Back</Text>
            </Pressable>
          </>
        )}
        {__DEV__ ? (
          <View style={styles.devSection}>
            <Label>Development sign-in</Label>
            <Body>Use a local QA email/password session only in dev builds.</Body>
            <Field
              accessibilityLabel="Development email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setDevEmail}
              placeholder="androidtest@0nya.com"
              textContentType="emailAddress"
              value={devEmail}
            />
            <Field
              accessibilityLabel="Development password"
              autoCapitalize="none"
              autoComplete="password"
              onChangeText={setDevPassword}
              placeholder="Password"
              secureTextEntry
              textContentType="password"
              value={devPassword}
            />
            <Button accessibilityLabel="Development sign-in" disabled={isDevSigningIn} onPress={() => void signInWithDevAccount()}>
              {isDevSigningIn ? "Signing in" : "Development sign-in"}
            </Button>
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  phoneRow: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: 8,
  },
  prefix: {
    alignItems: "center",
    borderColor: "#2a312f",
    borderRadius: 0,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 58,
    paddingHorizontal: 12,
  },
  prefixText: {
    color: "#A8B9B6",
    fontSize: 15,
    fontWeight: "700",
  },
  inputWrap: {
    flex: 1,
  },
  devSection: {
    gap: 10,
    marginTop: 18,
    paddingTop: 18,
    borderTopColor: "#2a312f",
    borderTopWidth: 1,
  },
  textAction: {
    alignSelf: "flex-start",
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: 10,
  },
  textActionDisabled: {
    opacity: 0.45,
  },
  textActionPressed: {
    opacity: 0.76,
  },
  textActionText: {
    color: "#00E5CC",
    fontSize: 14,
    fontWeight: "700",
  },
});
