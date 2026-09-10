"use client";

import React from "react";

declare global {
  interface Window {
    __formWrapperError?: string;
    __formWrapperTargets?: number;
    __formWrapperSuccess?: string;
    __formWrapperInputCount?: number;
    __formWrapperLastInput?: { name: string; value: unknown };
  }
}

import { useState, useEffect, useContext, useRef, type FormHTMLAttributes, type ReactNode } from "react";
import { UnsavedChangesContext } from "@/lib/cms/unsaved-changes";

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
  const { registerForm, unregisterForm, markDirty, markClean } = useContext(UnsavedChangesContext);
  const [values, setValues] = useState<T>(initialValues);
  const hasRegisteredRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    console.log("[FormWrapper] MOUNT formId:", formId, "initialValues:", JSON.stringify(initialValues));
    registerForm(formId, initialValues);
    hasRegisteredRef.current = true;
    return () => {
      console.log("[FormWrapper] UNMOUNT formId:", formId);
      unregisterForm(formId);
    };
  }, [formId, initialValues, registerForm, unregisterForm]);

  useEffect(() => {
    if (!hasRegisteredRef.current) return;
    console.log("[FormWrapper] DIRTY CHECK formId:", formId, "values:", JSON.stringify(values));

    const isDirty = !isEqual(values, initialValues);
    if (isDirty) {
      markDirty(formId, values, initialValues);
      onDirtyChange?.(true);
    } else {
      markClean(formId);
      onDirtyChange?.(false);
    }
  }, [values, initialValues, formId, markDirty, markClean, onDirtyChange]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      window.__formWrapperError = `formRef null for ${formId}`;
      return;
    }

    const targets = form.querySelectorAll("input, select, textarea");
    window.__formWrapperTargets = targets.length;
    const listeners: { element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement; handler: EventListener }[] = [];

    targets.forEach((target) => {
      const el = target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const handler = () => {
        const { name, value, type } = el;
        const checked = (el as HTMLInputElement).checked;
        const newValue = type === "checkbox" ? checked : value;
        setValues((prev) => ({ ...prev, [name]: newValue }));
        window.__formWrapperInputCount = (window.__formWrapperInputCount || 0) + 1;
        window.__formWrapperLastInput = { name, value: newValue };
      };
      el.addEventListener("input", handler);
      listeners.push({ element: el, handler });
    });

    form.setAttribute("data-listeners-attached", "true");
    window.__formWrapperSuccess = `listeners attached for ${formId}`;

    return () => {
      listeners.forEach(({ element, handler }) => {
        element.removeEventListener("input", handler);
      });
      form.removeAttribute("data-listeners-attached");
    };
  }, [formId]);

  const handleChange = (_e: React.FormEvent<HTMLFormElement>) => {
    const target = _e.target as unknown as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const { name, value, type } = target;
    const checked = (target as HTMLInputElement).checked;
    const newValue = type === "checkbox" ? checked : value;
    setValues((prev) => ({ ...prev, [name]: newValue }));
  };

  return (
    <form ref={formRef} {...props} onInput={handleChange}>
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
