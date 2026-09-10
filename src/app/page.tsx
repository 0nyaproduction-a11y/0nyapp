import { HomePage } from "@/components/home/HomePage";
import { RecoveryErrorGuard } from "@/components/auth/RecoveryErrorGuard";

export default function Home() {
  return (
    <RecoveryErrorGuard>
      <HomePage />
    </RecoveryErrorGuard>
  );
}
