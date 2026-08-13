import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && user.email_confirmed_at) {
    redirect("/dashboard");
  }
  if (user && !user.email_confirmed_at) {
    redirect("/verify-email");
  }
  redirect("/login");
}
