import { AuthForm } from "@/components/auth/AuthForm";
import { devTestLogin } from "@/app/login/actions";

type LoginPageProps = {
  searchParams: Promise<{ devError?: string; next?: string }>;
};

function getSafeRedirect(next?: string) {
  if (!next?.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { devError, next } = await searchParams;
  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <AuthForm
      devError={devError}
      devTestLoginAction={isDevelopment ? devTestLogin : undefined}
      isDevelopment={isDevelopment}
      redirectTo={getSafeRedirect(next)}
    />
  );
}
