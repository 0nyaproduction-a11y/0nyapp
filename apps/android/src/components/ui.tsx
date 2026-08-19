import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export function Title({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Label({ children }: PropsWithChildren) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Body({ children }: PropsWithChildren) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

type ButtonProps = PropsWithChildren<{
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
}>;

export function Button({ accessibilityLabel, children, disabled, onPress }: ButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={styles.buttonText}>{children}</Text>
    </Pressable>
  );
}

type FieldProps = {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  accessibilityLabel: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
};

export function Field(props: FieldProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#8a8a8a"
      style={styles.field}
    />
  );
}

export function LoadingState() {
  return <ActivityIndicator color="#f3c969" size="large" />;
}

export function ErrorText({ children }: PropsWithChildren) {
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: {
    color: "#f7f2e8",
    fontSize: 28,
    fontWeight: "800",
  },
  label: {
    color: "#f3c969",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  body: {
    color: "#d8d3ca",
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    gap: 10,
    borderColor: "#2c2924",
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#11100e",
    padding: 16,
  },
  button: {
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#f3c969",
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonDisabled: {
    backgroundColor: "#3a3834",
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonText: {
    color: "#11100e",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  field: {
    borderColor: "#3a3834",
    borderRadius: 8,
    borderWidth: 1,
    color: "#f7f2e8",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  error: {
    color: "#ff8d76",
    fontSize: 14,
    lineHeight: 20,
  },
});
