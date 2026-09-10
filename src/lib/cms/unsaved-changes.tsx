"use client";

import React from "react";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type UnsavedChangesContextType = {
  dirtyForms: Set<string>;
  hasUnsavedChanges: boolean;
  registerForm: (formId: string, initialValues: Record<string, unknown>) => void;
  unregisterForm: (formId: string) => void;
  markDirty: (formId: string, currentValues: Record<string, unknown>, originalValues: Record<string, unknown>) => void;
  markClean: (formId: string) => void;
  isFormDirty: (formId: string) => boolean;
  showUnsavedModal: boolean;
  pendingPath: string | null;
  attemptNavigation: (path: string) => Promise<boolean>;
  confirmLeave: () => void;
  cancelLeave: () => void;
};

export const UnsavedChangesContext = React.createContext<UnsavedChangesContextType>({
  dirtyForms: new Set<string>(),
  hasUnsavedChanges: false,
  registerForm: (_formId: string, _initialValues: Record<string, unknown>) => { void _formId; void _initialValues; },
  unregisterForm: (_formId: string) => { void _formId; },
  markDirty: (_formId: string, _currentValues: Record<string, unknown>, _originalValues: Record<string, unknown>) => { void _formId; void _currentValues; void _originalValues; },
  markClean: (_formId: string) => { void _formId; },
  isFormDirty: (_formId: string) => { void _formId; return false; },
  showUnsavedModal: false,
  pendingPath: null,
  attemptNavigation: (_path: string) => { void _path; return Promise.resolve(true); },
  confirmLeave: () => {},
  cancelLeave: () => {},
});

UnsavedChangesContext.displayName = "UnsavedChangesContext";

export function isEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== "object" || typeof b !== "object") return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => isEqual(item, b[index]));
  }
  if (!Array.isArray(a) && !Array.isArray(b)) {
    const keys = Object.keys(a as object);
    if (keys.length !== Object.keys(b as object).length) return false;
    return keys.every((key) => isEqual((a as unknown as Record<string, unknown>)[key], (b as unknown as Record<string, unknown>)[key]));
  }
  return false;
}
type UnsavedChangesProviderProps = {
  children: ReactNode;
};

type PendingNavigation = {
  path: string;
  resolve: (allow: boolean) => void;
};

export function UnsavedChangesProvider({ children }: UnsavedChangesProviderProps) {
  const router = useRouter();
  const [dirtyForms, setDirtyForms] = useState<Set<string>>(new Set());
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const pendingNavigationRef = useRef<PendingNavigation | null>(null);

  const hasUnsavedChanges = dirtyForms.size > 0;

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (dirtyForms.size > 0) {
        event.preventDefault();
        const path = window.location.pathname;
        pendingNavigationRef.current = {
          path,
          resolve: () => {},
        };
        setPendingPath(path);
        setShowUnsavedModal(true);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [dirtyForms.size]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyForms.size > 0) {
        event.preventDefault();
        event.returnValue = "You have unsaved changes. Leave without saving?";
        return "You have unsaved changes. Leave without saving?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirtyForms.size]);

  const registerForm = (formId: string, _initialValues: Record<string, unknown>) => {
    void _initialValues;
    setDirtyForms((prev) => {
      const newSet = new Set(prev);
      newSet.add(formId);
      return newSet;
    });
  };

  const unregisterForm = (formId: string) => {
    setDirtyForms((prev) => {
      const newSet = new Set(prev);
      newSet.delete(formId);
      return newSet;
    });
  };

  const markDirty = (formId: string, currentValues: Record<string, unknown>, originalValues: Record<string, unknown>) => {
    if (!isEqual(currentValues, originalValues)) {
      setDirtyForms((prev) => {
        const newSet = new Set(prev);
        newSet.add(formId);
        return newSet;
      });
    }
  };

  const markClean = (formId: string) => {
    setDirtyForms((prev) => {
      const newSet = new Set(prev);
      newSet.delete(formId);
      return newSet;
    });
  };

  const isFormDirty = useCallback(
    (formId: string) => dirtyForms.has(formId),
    [dirtyForms],
  );

  const attemptNavigation = useCallback(
    (path: string): Promise<boolean> => {
      if (dirtyForms.size === 0) {
        router.push(path);
        return Promise.resolve(true);
      }

      return new Promise<boolean>((resolve) => {
        pendingNavigationRef.current = {
          path,
          resolve,
        };
        setPendingPath(path);
        setShowUnsavedModal(true);
      });
    },
    [dirtyForms.size, router],
  );

  const confirmLeave = () => {
    setShowUnsavedModal(false);
    const pending = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    setPendingPath(null);

    if (pending) {
      const path = pending.path;
      pending.resolve(true);
      if (path) {
        router.push(path);
      }
    }
  };

  const cancelLeave = () => {
    setShowUnsavedModal(false);
    const pending = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    setPendingPath(null);

    if (pending) {
      pending.resolve(false);
    }
  };

  const value = {
    dirtyForms,
    hasUnsavedChanges,
    registerForm,
    unregisterForm,
    markDirty,
    markClean,
    isFormDirty,
    showUnsavedModal,
    pendingPath,
    attemptNavigation,
    confirmLeave,
    cancelLeave,
  };

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      {showUnsavedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-deep border border-bone/20 p-6 rounded-lg max-w-sm mx-auto">
            <h2 className="text-lg font-semibold mb-4">You have unsaved changes</h2>
            <p className="text-sm text-bone/70 mb-6">Leave without saving?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelLeave}
                className="px-4 py-2 border border-bone/20 rounded text-sm hover:bg-bone/10"
              >
                Stay
              </button>
              <button
                onClick={confirmLeave}
                className="px-4 py-2 bg-teal text-bone rounded text-sm hover:bg-teal/80"
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  );
}

