"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signUp } from "@/lib/auth-actions";

const INDUSTRIES = [
  { value: "auto_repair", label: "Auto repair / mechanic" },
  { value: "hvac", label: "HVAC contractor" },
  { value: "bakery", label: "Bakery / food business" },
  { value: "plumbing", label: "Plumbing" },
  { value: "general", label: "Other service business" },
];

export default function SignupPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signUp(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push("/verify-email?email=" + encodeURIComponent(String(formData.get("ownerEmail"))));
    });
  }

  return (
    <Card className="p-8">
      <h1 className="font-display text-xl font-semibold">Set up your business</h1>
      <p className="mt-1 text-sm text-muted">
        Create your AutoOps AI account — takes about a minute.
      </p>

      <form action={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="businessName">Business name</Label>
          <Input id="businessName" name="businessName" placeholder="Sharma Auto Works" required />
        </div>

        <div>
          <Label htmlFor="industry">Industry</Label>
          <select
            id="industry"
            name="industry"
            required
            defaultValue="auto_repair"
            className="w-full rounded-sm border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:border-accent/60 focus:outline-none"
          >
            {INDUSTRIES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="ownerEmail">Email</Label>
          <Input
            id="ownerEmail"
            name="ownerEmail"
            type="email"
            placeholder="you@business.com"
            required
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </div>

        {error && (
          <p className="rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" loading={isPending} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}
