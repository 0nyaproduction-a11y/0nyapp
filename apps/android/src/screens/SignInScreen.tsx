import { useState } from "react";
import { Screen } from "../components/Screen";
import { Body, Button, Card, ErrorText, Field, Title } from "../components/ui";
import { useAuth } from "../lib/authContext";

export function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);

    try {
      await signIn(email.trim(), password);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Sign in failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <Title>0nya</Title>
      <Card>
        <Body>Sign in to sync wallet, account, and episode access.</Body>
        <Field
          accessibilityLabel="Email"
          autoCapitalize="none"
          onChangeText={setEmail}
          placeholder="Email"
          value={email}
        />
        <Field
          accessibilityLabel="Password"
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          value={password}
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          accessibilityLabel="Sign in"
          disabled={isSubmitting || !email.trim() || !password}
          onPress={handleSubmit}
        >
          {isSubmitting ? "Signing in" : "Sign in"}
        </Button>
      </Card>
    </Screen>
  );
}
