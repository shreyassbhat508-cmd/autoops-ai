"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sendBookingMessage } from "@/lib/booking/actions";
import type { AgentMessage } from "@/lib/booking/agent";
import { Send, PhoneCall, CalendarClock, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Appointment {
  id: string;
  customer_name: string;
  service_type: string | null;
  scheduled_at: string;
}

const OPENING_LINE = "Thanks for calling — what can I help you get booked in for?";

export function CallSimulator({
  initialAppointments,
  className,
}: {
  initialAppointments: Appointment[];
  className?: string;
}) {
  const router = useRouter();
  const [history, setHistory] = useState<AgentMessage[]>([
    { role: "assistant", content: OPENING_LINE },
  ]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history]);

  function handleSend() {
    const message = input.trim();
    if (!message || isPending) return;

    const nextHistory: AgentMessage[] = [...history, { role: "user", content: message }];
    setHistory(nextHistory);
    setInput("");

    startTransition(async () => {
      const result = await sendBookingMessage(nextHistory);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setHistory((h) => [...h, { role: "assistant", content: result.reply }]);
      if (result.booked) {
        toast.success(`Booked for ${result.appointmentLabel}`);
        router.refresh();
      }
    });
  }

  function handleReset() {
    setHistory([{ role: "assistant", content: OPENING_LINE }]);
  }

  return (
    <div className={cn("grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]", className)}>
      {/* Transcript panel */}
      <Card className="flex h-[560px] flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium">Test AI Call Assistant</span>
          </div>
          <Button variant="ghost" className="px-2" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {history.map((msg, i) => (
            <div
              key={i}
              className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-md px-3.5 py-2.5 text-sm",
                  msg.role === "user"
                    ? "bg-accent/15 text-foreground"
                    : "bg-surfaceRaised text-foreground"
                )}
              >
                <p className="mb-0.5 text-[10px] uppercase tracking-wide text-muted">
                  {msg.role === "user" ? "Customer" : "AI Agent"}
                </p>
                {msg.content}
              </div>
            </div>
          ))}
          {isPending && (
            <div className="flex justify-start">
              <div className="rounded-md bg-surfaceRaised px-3.5 py-2.5 text-sm text-muted">
                Thinking…
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-border px-4 py-3">
          <Input
            placeholder="Type what the customer is saying…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isPending}
          />
          <Button onClick={handleSend} loading={isPending} className="px-3">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Calendar / upcoming appointments panel */}
      <Card className="flex h-[560px] flex-col">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <CalendarClock className="h-4 w-4 text-info" />
          <span className="text-sm font-medium">Upcoming appointments</span>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {initialAppointments.length === 0 ? (
            <p className="px-2 text-sm text-muted">
              No appointments booked yet — try the assistant on the left.
            </p>
          ) : (
            initialAppointments.map((appt) => (
              <div
                key={appt.id}
                className="rounded-md border border-border/60 bg-surfaceRaised px-3.5 py-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{appt.customer_name}</span>
                  <span className="text-xs text-info">
                    {new Date(appt.scheduled_at).toLocaleString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                </div>
                {appt.service_type && (
                  <p className="mt-0.5 text-xs text-muted">{appt.service_type}</p>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
