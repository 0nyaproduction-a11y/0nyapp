import { AuthForm } from "@/components/auth/AuthForm";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

function getSafeRedirect(next?: string) {
  if (!next?.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  return <AuthForm redirectTo={getSafeRedirect(next)} />;
}
