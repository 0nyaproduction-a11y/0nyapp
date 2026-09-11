"use client";

import React from "react";
import Link from "next/link";
import { useContext } from "react";
import { UnsavedChangesContext } from "@/lib/cms/unsaved-changes";

type DirtyLinkProps = React.ComponentProps<typeof Link> & {
  children: React.ReactNode;
  className?: string;
};

export function DirtyLink({ href, children, className, ...props }: DirtyLinkProps) {
  const { attemptNavigation, hasUnsavedChanges } = useContext(UnsavedChangesContext);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (hasUnsavedChanges) {
      event.preventDefault();
      // CMS-C08B-05: preserve full list context (query string) through the
      // dirty guard so context is never dropped when the guard intercepts.
      const targetPath =
        typeof href === "string"
          ? href
          : href.pathname
            ? `${href.pathname}${href.search ?? ""}`
            : "/";
      attemptNavigation(targetPath);
    }
  };

  return (
    <Link href={href} className={className} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
