"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useContext } from "react";
import { UnsavedChangesContext } from "@/lib/cms/unsaved-changes";

export function useNavigationGuard() {
  const router = useRouter();
  const { dirtyForms, confirmLeave, cancelLeave, markClean } =
    useContext(UnsavedChangesContext);
  const pendingNavigation = useRef<string | null>(null);
  const isNavigating = useRef(false);

  const attemptNavigation = useCallback(
    (targetPath: string) => {
      if (isNavigating.current) return Promise.resolve();

      if (dirtyForms.size === 0) {
        router.push(targetPath);
        return Promise.resolve();
      }

      return new Promise<void>(() => {
        isNavigating.current = true;
        pendingNavigation.current = targetPath;
      });
    },
    [dirtyForms.size, router],
  );

  return { attemptNavigation, isNavigating, pendingNavigation, confirmLeave, cancelLeave, markClean };
}
