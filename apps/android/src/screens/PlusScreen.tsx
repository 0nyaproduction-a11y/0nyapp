import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import {
  Body,
  BrandWordmark,
  Button,
  Card,
  Label,
  LoadingState,
  RecoveryState,
  Title,
} from "../components/ui";
import { getMe } from "../lib/api";
import { useAuth } from "../lib/authContext";
import type { RootStackScreenProps } from "../navigation/types";
import type { MeResponse } from "../types/api";
import { borders, colors, radii } from "../theme/tokens";

type Props = RootStackScreenProps<"Plus">;

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateString));
}

export function PlusScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const token = session?.access_token;

  const loadSubscription = useCallback(async () => {
    if (!token) {
      setMe(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const meData = await getMe(token);
      setMe(meData);
      setError(null);
    } catch {
      setMe(null);
      setError("We couldn't load this right now.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadSubscription();
    }, [loadSubscription]),
  );

  function handleSignIn() {
    navigation.navigate("SignIn");
  }

  const isPlus = me?.subscription.status === "active";
  const membershipHeadline = isPlus ? (me?.subscription.label ?? "0nya Plus") : "Weekly membership";
  const membershipBody =
    isPlus && me?.subscription.endsAt ? `Active until ${formatDate(me.subscription.endsAt)}` : null;
  const membershipStatusText = isPlus ? "Active" : "Unavailable in this build";

  return (
    <Screen>
      <View style={styles.hero}>
        <BrandWordmark plus style={styles.brand} />
        <Body>Weekly membership</Body>
      </View>

      <View style={styles.benefits}>
        <BenefitRow
          title="Access Plus-enabled Micro Drama episodes"
          body="Watch released micro-drama episodes included when they are enabled for 0nya Plus access."
        />
        <BenefitRow
          title="Ad-free Short Films"
          body="Enjoy Short Films without mid-roll or post-roll ads when you are an active Plus member."
        />
        <BenefitRow
          title="Higher-quality playback"
          body="A premium viewing experience is part of the approved Plus experience direction."
        />
        <BenefitRow
          title="Coins remain separate"
          body="Coins stay in the wallet and remain independent from the Plus membership."
        />
      </View>

      {isLoading && !me && !error ? <LoadingState /> : null}
      {error ? (
        <RecoveryState
          body={error}
          onPrimaryAction={() => void loadSubscription()}
          primaryActionLabel="Retry"
          title="We couldn't load this right now."
        />
      ) : null}
      {token ? (
        me ? (
          <View style={styles.membership}>
            <Label>Membership</Label>
            <Text style={styles.membershipHeadline}>{membershipHeadline}</Text>
            {membershipBody ? <Body>{membershipBody}</Body> : null}
           {!isPlus ? (
             <Body>Purchasing is not available in this build.</Body>
           ) : null}
           <View
             accessibilityLabel={membershipStatusText}
             accessibilityRole="text"
             style={[styles.statusPill, isPlus ? styles.statusPillActive : null]}
           >
             <View style={[styles.statusDot, isPlus ? styles.statusDotActive : null]} />
             <Text style={[styles.statusText, isPlus ? styles.statusTextActive : null]}>
               {membershipStatusText}
             </Text>
           </View>
         </View>
       ) : null
      ) : (
        <Card>
          <Label>Guest</Label>
          <Title>Sign in to view 0nya Plus</Title>
          <Body>Sign in first, then return here to view your membership state.</Body>
          <Button accessibilityLabel="Sign in to view Plus" onPress={handleSignIn}>
            Sign in
          </Button>
        </Card>
      )}
    </Screen>
  );
}

type BenefitRowProps = {
  body: ReactNode;
  title: string;
};

function BenefitRow({ body, title }: BenefitRowProps) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitMarker} />
      <View style={styles.benefitCopy}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Body>{body}</Body>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 8,
  },
  brand: {
    fontSize: 34,
    lineHeight: 38,
  },
  benefits: {
    gap: 14,
  },
  benefitRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  benefitMarker: {
    backgroundColor: colors.accent,
    borderRadius: radii.none,
    height: 6,
    marginTop: 7,
    width: 6,
  },
  benefitCopy: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  inlineBrandAccent: {
    color: colors.accent,
  },
  inlineBrandText: {
    color: colors.text,
  },
  membership: {
    gap: 6,
  },
  membershipHeadline: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  statusPill: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: borders.color,
    borderRadius: 999,
    borderWidth: borders.width,
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillActive: {
    borderColor: colors.accent,
  },
  statusDot: {
    backgroundColor: colors.muted,
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  statusDotActive: {
    backgroundColor: colors.accent,
  },
  statusText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  statusTextActive: {
    color: colors.text,
  },
});
