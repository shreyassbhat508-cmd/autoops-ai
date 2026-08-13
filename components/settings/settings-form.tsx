"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateTwilioNumber } from "@/lib/settings/actions";

export function SettingsForm({
  currentNumber,
  className,
}: {
  currentNumber: string;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateTwilioNumber(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast.success("Saved.");
    });
  }

  return (
    <Card className="p-6">
      <form action={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="twilioPhoneNumber">Twilio phone number</Label>
          <Input
            id="twilioPhoneNumber"
            name="twilioPhoneNumber"
            placeholder="+14155551234"
            defaultValue={currentNumber}
          />
          <p className="mt-1.5 text-xs text-muted">
            E.164 format (starts with +, country code, no spaces). This must match a number you&apos;ve
            purchased in your Twilio console, with its Voice webhook pointed at{" "}
            <code className="rounded-sm bg-surfaceRaised px-1 py-0.5 text-[11px]">
              {process.env.NEXT_PUBLIC_SITE_URL || "https://yourapp.com"}/api/voice/incoming
            </code>
          </p>
        </div>

        {error && (
          <p className="rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" loading={isPending}>
          Save
        </Button>
      </form>
    </Card>
  );
}
