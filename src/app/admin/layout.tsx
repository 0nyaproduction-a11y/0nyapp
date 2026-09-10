"use client";

import { UnsavedChangesProvider } from "@/lib/cms/unsaved-changes";

export default function CmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UnsavedChangesProvider>{children}</UnsavedChangesProvider>;
}
