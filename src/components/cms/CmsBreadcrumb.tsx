"use client";

import { DirtyLink } from "@/components/cms/DirtyLink";

type BreadcrumbItem = {
  label: string;
  href?: string;
  isCurrent?: boolean;
};

interface CmsBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function CmsBreadcrumb({ items, className = "" }: CmsBreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center space-x-2 text-sm ${className}`}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} className="flex items-center">
            {index > 0 && (
              <span className="mx-2 text-bone/40" aria-hidden="true">/</span>
            )}
            {isLast || !item.href ? (
              <span
                className="text-bone/60 font-medium"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <DirtyLink
                href={item.href}
                className="text-teal hover:text-teal/80 transition-colors"
              >
                {item.label}
              </DirtyLink>
            )}
          </div>
        );
      })}
    </nav>
  );
}