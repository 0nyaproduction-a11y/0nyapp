import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/tokens";

type ScreenProps = PropsWithChildren<{
  onScroll?: ScrollViewProps["onScroll"];
  scroll?: boolean;
}>;

export function Screen({ children, onScroll, scroll = true }: ScreenProps) {
  // Non-scrolling screens rely on a flex:1 chain (e.g. FlatList) to fill the
  // remaining height. Without flex:1 here, this View auto-sizes to its
  // content instead of stretching, so flex:1 descendants collapse to 0.
  const content = <View style={[styles.content, !scroll && styles.contentFill]}>{children}</View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      {scroll ? <ScrollView onScroll={onScroll} scrollEventThrottle={100}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: 18,
    padding: 16,
  },
  contentFill: {
    flex: 1,
  },
});
