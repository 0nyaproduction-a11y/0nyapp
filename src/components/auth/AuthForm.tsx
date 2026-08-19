"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandName } from "@/components/brand/BrandName";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const phoneProviderMessage =
  "Phone verification is not enabled in this development build yet.";

type AuthFormProps = {
  redirectTo: string;
};

function getAuthErrorMessage(error: { code?: string; message: string }) {
  const errorText = `${error.code ?? ""} ${error.message}`.toLowerCase();
  const isPhoneProviderError =
    errorText.includes("phone_provider_disabled") ||
    errorText.includes("provider") ||
    errorText.includes("sms") ||
    errorText.includes("twilio") ||
    errorText.includes("not enabled") ||
    errorText.includes("not configured");

  return isPhoneProviderError ? phoneProviderMessage : error.message;
}

export function AuthForm({ redirectTo }: AuthFormProps) {
  const router = useRouter();
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isPhoneStep = step === "phone";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();

    if (isPhoneStep) {
      if (!/^\d{10}$/.test(mobileNumber)) {
        setIsSubmitting(false);
        setError("Enter a valid 10-digit Indian mobile number.");
        return;
      }

      const nextPhone = `+91${mobileNumber}`;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: nextPhone,
      });

      setIsSubmitting(false);

      if (otpError) {
        // Production phone auth requires an enabled Supabase SMS provider.
        setError(getAuthErrorMessage(otpError));
        return;
      }

      setPhone(nextPhone);
      setStep("otp");
      setMessage("Enter the 6-digit OTP sent to your phone.");
      return;
    }

    if (!phone || !/^\d{6}$/.test(otp)) {
      setIsSubmitting(false);
      setError("Enter the 6-digit OTP.");
      return;
    }

    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });

    setIsSubmitting(false);

    if (verifyError) {
      // Production phone auth requires an enabled Supabase SMS provider.
      setError(getAuthErrorMessage(verifyError));
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-deep px-4 py-6 text-bone sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] max-w-xl flex-col">
        <Link
          href="/"
          className="w-fit text-[2.25rem] text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
        >
          <BrandName />
        </Link>
        <section className="grid flex-1 place-items-center py-10">
          <div className="w-full border border-bone/10 bg-background px-5 py-8 shadow-[0_0_70px_rgba(13,209,188,0.07)] sm:px-8">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-teal">
              Phone sign in
            </p>
            <h1 className="mt-3 font-display text-5xl font-light leading-none text-bone">
              Continue with 0nya.
            </h1>
            <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
              {isPhoneStep ? (
                <label className="grid gap-2">
                  <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/62">
                    Mobile number
                  </span>
                  <div className="grid grid-cols-[4rem_1fr] border border-bone/10 bg-surface focus-within:border-teal">
                    <span className="grid h-12 place-items-center border-r border-bone/10 font-mono text-[0.72rem] text-bone/70">
                      +91
                    </span>
                    <input
                      autoComplete="tel-national"
                      className="h-12 bg-transparent px-3 text-base font-light text-bone outline-none placeholder:text-bone/28"
                      inputMode="numeric"
                      maxLength={10}
                      onChange={(event) =>
                        setMobileNumber(event.target.value.replace(/\D/g, ""))
                      }
                      pattern="[0-9]{10}"
                      placeholder="10-digit number"
                      required
                      type="tel"
                      value={mobileNumber}
                    />
                  </div>
                </label>
              ) : (
                <label className="grid gap-2">
                  <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/62">
                    One-time password
                  </span>
                  <input
                    autoComplete="one-time-code"
                    className="h-12 border border-bone/10 bg-surface px-3 text-center font-mono text-xl tracking-[0.24em] text-bone outline-none transition placeholder:text-bone/28 focus:border-teal"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, ""))
                    }
                    pattern="[0-9]{6}"
                    placeholder="000000"
                    required
                    type="text"
                    value={otp}
                  />
                </label>
              )}
              {error ? (
                <p className="border border-bone/10 bg-bone/[0.03] px-3 py-2 text-sm leading-6 text-bone/80">
                  {error}
                </p>
              ) : null}
              {message ? (
                <p className="border border-teal/30 bg-teal/10 px-3 py-2 text-sm leading-6 text-teal">
                  {message}
                </p>
              ) : null}
              <Button disabled={isSubmitting}>
                {isSubmitting ? "Please wait" : isPhoneStep ? "Send OTP" : "Verify OTP"}
              </Button>
            </form>
            <p className="mt-5 text-sm leading-6 text-muted">
              Browse freely. Episodes 1, 2 and 3 stay open without signing in.
            </p>
            {!isPhoneStep ? (
              <button
                className="mt-4 border-b border-teal/50 text-sm text-teal transition hover:border-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setOtp("");
                  setStep("phone");
                }}
                type="button"
              >
                Change mobile number
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
