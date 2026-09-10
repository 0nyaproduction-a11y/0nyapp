"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const RECOVERY_DESTINATION = "/admin/reset-password";

export function RecoveryErrorGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const hash = window.location.hash;

    if (!hash) {
      return;
    }

    const isAuthError = hash.includes("error_code=") || hash.includes("error=");
    if (!isAuthError) {
      return;
    }

    if (pathname === RECOVERY_DESTINATION) {
      return;
    }

    router.replace(`${RECOVERY_DESTINATION}${hash}`);
  }, [pathname, router]);

  return <>{children}</>;
}
