"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { logIn } from "@/lib/auth-actions";

function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const urlError = searchParams.get("error");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(urlError);

  function handleSubmit(formData: FormData) {
    setError(null);
    if (nextPath) formData.set("next", nextPath);
    startTransition(async () => {
      const result = await logIn(formData);
      // logIn redirects on success via next/navigation's redirect(), which
      // throws internally — so we only ever reach here on failure.
      if (result && "error" in result) {
        setError(result.error);
      }
    });
  }

  return (
    <Card className="p-8">
      <h1 className="font-display text-xl font-semibold">Log in</h1>
      <p className="mt-1 text-sm text-muted">Welcome back — pick up where you left off.</p>

      <form action={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@business.com" required />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" placeholder="••••••••" required />
        </div>

        {error && (
          <p className="rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" loading={isPending} className="w-full">
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Set up your business
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  // useSearchParams() opts the tree into client-side rendering for that
  // part of the page, which Next.js requires be wrapped in Suspense so it
  // doesn't block/break static generation of the rest of the route.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
