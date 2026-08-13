"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { resendVerification, logOut } from "@/lib/auth-actions";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [isPending, startTransition] = useTransition();
  const [cooldown, setCooldown] = useState(false);

  function handleResend() {
    if (!email) {
      toast.error("We don't have an email on file for this session — please log in again.");
      return;
    }
    startTransition(async () => {
      const result = await resendVerification(email);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Verification email sent again.");
      setCooldown(true);
      setTimeout(() => setCooldown(false), 30_000);
    });
  }

  return (
    <Card className="p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
        <MailCheck className="h-6 w-6 text-accent" />
      </div>
      <h1 className="font-display text-xl font-semibold">Check your inbox</h1>
      <p className="mt-2 text-sm text-muted">
        {email ? (
          <>
            We sent a verification link to <span className="text-foreground">{email}</span>.
            Click it to activate your account.
          </>
        ) : (
          "We sent a verification link to your email. Click it to activate your account."
        )}
      </p>

      <div className="mt-6 flex flex-col gap-2">
        <Button variant="secondary" onClick={handleResend} loading={isPending} disabled={cooldown}>
          {cooldown ? "Sent — you can resend in 30s" : "Resend verification email"}
        </Button>
        <form action={logOut}>
          <Button variant="ghost" type="submit" className="w-full">
            Log out
          </Button>
        </form>
      </div>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
