import { StyleSheet, Text, View } from "react-native";
import { borders, colors } from "../theme/tokens";
import { Body, Button, Card, Label, Title } from "./ui";

type ContentRatingSlateProps = {
  contentDescriptors: string[];
  contentRating: string;
  onBack: () => void;
  onContinue: () => void;
};

export function ContentRatingSlate({
  contentDescriptors,
  contentRating,
  onBack,
  onContinue,
}: ContentRatingSlateProps) {
  return (
    <Card>
      <Label>Content rating</Label>
      <Title>{contentRating}</Title>
      {contentDescriptors.length > 0 ? (
        <View style={styles.descriptorWrap}>
          {contentDescriptors.map((descriptor) => (
            <View key={descriptor} style={styles.descriptorPill}>
              <Text style={styles.descriptorText}>{descriptor}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Body>No descriptors.</Body>
      )}
      <Button accessibilityLabel="Continue" onPress={onContinue}>
        Continue
      </Button>
      <Button accessibilityLabel="Back" onPress={onBack}>
        Back
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  descriptorWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  descriptorPill: {
    borderColor: borders.color,
    borderRadius: 999,
    borderWidth: borders.width,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  descriptorText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
