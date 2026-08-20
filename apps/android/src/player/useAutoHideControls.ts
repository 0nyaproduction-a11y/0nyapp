import { useCallback, useEffect, useRef, useState } from "react";

const AUTO_HIDE_DELAY_MS = 3000;

export function useAutoHideControls(isPlaying: boolean) {
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoHideTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleAutoHide = useCallback(() => {
    clearAutoHideTimer();

    if (!isPlaying) {
      return;
    }

    timeoutRef.current = setTimeout(() => {
      setAreControlsVisible(false);
    }, AUTO_HIDE_DELAY_MS);
  }, [clearAutoHideTimer, isPlaying]);

  const revealControls = useCallback(() => {
    setAreControlsVisible(true);
    scheduleAutoHide();
  }, [scheduleAutoHide]);

  const toggleControls = useCallback(() => {
    setAreControlsVisible((current) => {
      const next = !current;

      if (next) {
        scheduleAutoHide();
      } else {
        clearAutoHideTimer();
      }

      return next;
    });
  }, [clearAutoHideTimer, scheduleAutoHide]);

  useEffect(() => {
    if (areControlsVisible) {
      scheduleAutoHide();
    }

    return clearAutoHideTimer;
  }, [areControlsVisible, clearAutoHideTimer, scheduleAutoHide]);

  return {
    areControlsVisible,
    revealControls,
    toggleControls,
  };
}
