$lines = Get-Content src/lib/cms/form-wrapper.tsx
$lines[4] = 'import React from "react";'
$lines = @(
  '"use client";'
  ''
  'import React from "react";'
  'import { useState, useEffect, useContext, useRef, type FormHTMLAttributes, type ReactNode } from "react";'
  'import { UnsavedChangesContext } from "@/lib/cms/unsaved-changes";'
  ''
  'declare global {'
  '  interface Window {'
  '    __formWrapperRendered?: boolean;'
  '    __formWrapperError?: string;'
  '    __formWrapperTargets?: number;'
  '    __formWrapperSuccess?: string;'
  '  }'
  '}'
  ''
  'type FormWrapperProps<T> = FormHTMLAttributes<HTMLFormElement> & {'
  '  formId: string;'
  '  initialValues: T;'
  '  onDirtyChange?: (isDirty: boolean) => void;'
  '  children: ReactNode;'
  '};'
) + ($lines | Select-Object -Skip 13)
Set-Content src/lib/cms/form-wrapper.tsx $lines
$content = Get-Content src/lib/cms/form-wrapper.tsx -Raw
$content = $content -replace '}: FormWrapperProps<T>) => {', '}: FormWrapperProps<T>) => {\n  (window as any).__formWrapperRendered = true;'
Set-Content src/lib/cms/form-wrapper.tsx $content
