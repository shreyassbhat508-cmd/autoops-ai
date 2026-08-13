import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logOut } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, PhoneCall, Receipt, Wallet, LogOut, Settings } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/booking", label: "Booking Agent", icon: PhoneCall },
  { href: "/receipts", label: "Receipts", icon: Receipt },
  { href: "/recovery", label: "Revenue Recovery", icon: Wallet },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders: middleware already enforces this, but a Server
  // Component should never trust that it was reached only via middleware.
  if (!user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/verify-email");

  const { data: business } = await supabase
    .from("businesses")
    .select("name, industry")
    .eq("owner_id", user.id)
    .single();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-64 flex-col border-r border-border bg-surface px-4 py-6">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="h-2 w-2 rounded-full bg-accent" />
          <span className="font-display text-base font-semibold tracking-tight">
            AutoOps <span className="text-accent">AI</span>
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surfaceRaised hover:text-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border pt-4">
          <p className="truncate px-2 text-sm font-medium text-foreground">
            {business?.name ?? "Your business"}
          </p>
          <p className="truncate px-2 text-xs text-muted">{user.email}</p>
          <form action={logOut} className="mt-3">
            <Button variant="ghost" type="submit" className="w-full justify-start px-2">
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
    </div>
  );
}
