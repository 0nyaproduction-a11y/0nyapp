import { useCallback, useEffect, useRef, type PropsWithChildren } from "react";
import { useIsFocused } from "@react-navigation/native";
import { Dimensions, View, type StyleProp, type ViewStyle } from "react-native";
import { emitBehaviorEvidence, getBehaviorSessionId, type BehaviorEvidence } from "../lib/behavioralEvents";
import { advanceImpressionExposure, getMeasuredVisibilityFraction, IMPRESSION_MIN_VISIBLE_MS, type ImpressionExposureState } from "../lib/behaviorImpressionModel";

const emittedImpressions = new Set<string>();

type Props = PropsWithChildren<{
  accessToken?: string | null;
  collectionContext: string;
  evidence: Omit<BehaviorEvidence, "eventType" | "metadata">;
  enabled?: boolean;
  scrollSignal: number;
  style?: StyleProp<ViewStyle>;
}>;

export function BehaviorImpression({ accessToken, children, collectionContext, enabled = true, evidence, scrollSignal, style }: Props) {
  const isFocused = useIsFocused();
  const viewRef = useRef<View>(null);
  const measureRef = useRef<() => void>(() => undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exposureRef = useRef<ImpressionExposureState>({ emitted: false, visibleSince: null });
  const dedupeKey = `${getBehaviorSessionId()}|${evidence.sourceSurface}|${collectionContext}|${evidence.rowId ?? "-"}|${evidence.contentId}|${evidence.position ?? "-"}`;

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const measure = useCallback(() => {
    if (!enabled || !isFocused) {
      exposureRef.current = { emitted: false, visibleSince: null };
      clearTimer();
      return;
    }
    viewRef.current?.measureInWindow((x, y, width, height) => {
      if (emittedImpressions.has(dedupeKey)) return;
      const viewport = Dimensions.get("window");
      const fraction = getMeasuredVisibilityFraction({ x, y, width, height }, viewport);
      const now = Date.now();
      exposureRef.current = advanceImpressionExposure(exposureRef.current, fraction, now);
      clearTimer();
      if (exposureRef.current.emitted) {
        emittedImpressions.add(dedupeKey);
        emitBehaviorEvidence(accessToken, { ...evidence, eventType: "content_impression", metadata: { visibility_fraction: fraction, visible_duration_ms: now - (exposureRef.current.visibleSince ?? now) } });
      } else if (exposureRef.current.visibleSince !== null) {
        const remaining = Math.max(0, IMPRESSION_MIN_VISIBLE_MS - (now - exposureRef.current.visibleSince));
        timerRef.current = setTimeout(() => measureRef.current(), remaining + 1);
      }
    });
  }, [accessToken, clearTimer, dedupeKey, enabled, evidence, isFocused]);

  useEffect(() => {
    measureRef.current = measure;
    measure();
    return clearTimer;
  }, [clearTimer, measure, scrollSignal]);

  const handleLayout = useCallback(() => measure(), [measure]);
  return <View ref={viewRef} collapsable={false} onLayout={handleLayout} style={style}>{children}</View>;
}
