"use client";

import React from "react";
import { useState, useEffect, useContext, useRef, type FormHTMLAttributes, type ReactNode } from "react";
import { UnsavedChangesContext } from "@/lib/cms/unsaved-changes";

declare global {
  interface Window {
    __formWrapperRendered?: boolean;
    __formWrapperError?: string;
    __formWrapperTargets?: number;
    __formWrapperSuccess?: string;
  }
}

type FormWrapperProps<T> = FormHTMLAttributes<HTMLFormElement> & {
  formId: string;
  initialValues: T;
  onDirtyChange?: (isDirty: boolean) => void;
  children: ReactNode;
};
export function FormWrapper<T extends Record<string, unknown> = Record<string, unknown>>({
  formId,
  initialValues,
  onDirtyChange,
  children,
  ...props
}: FormWrapperProps<T>) {
  (window as any).__formWrapperRendered = true;
  const { registerForm, unregisterForm, markDirty, markClean } = useContext(UnsavedChangesContext);
  const [values, setValues] = useState<T>(initialValues);
  const hasRegisteredRef = useRef(false);

  useEffect(() => {
    registerForm(formId, initialValues);
    hasRegisteredRef.current = true;
    return () => {
      unregisterForm(formId);
    };
  }, [formId, initialValues, registerForm, unregisterForm]);

  useEffect(() => {
    if (!hasRegisteredRef.current) return;

    const isDirty = !isEqual(values, initialValues);
    if (isDirty) {
      markDirty(formId, values, initialValues);
      onDirtyChange?.(true);
    } else {
      markClean(formId);
      onDirtyChange?.(false);
    }
  }, [values, initialValues, formId, markDirty, markClean, onDirtyChange]);

  const handleChange = (e: React.ChangeEvent<HTMLFormElement>) => {
    const target = e.target as unknown as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const { name, value, type } = target;
    const checked = (target as HTMLInputElement).checked;
    const newValue = type === "checkbox" ? checked : value;
    setValues((prev) => ({ ...prev, [name]: newValue }));
  };

  return (
    <form {...props} onChange={handleChange}>
      {children}
    </form>
  );
}

function isEqual<T>(a: T, b: T): boolean {
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
    return keys.every((key) => isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
  }
  return false;
}


