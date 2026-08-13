"use server";

import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const signupSchema = z.object({
  businessName: z.string().min(2, "Business name is too short").max(120),
  ownerEmail: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  industry: z.string().min(1),
});

export type ActionResult = { error: string } | { success: true };

export async function signUp(formData: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    businessName: formData.get("businessName"),
    ownerEmail: formData.get("ownerEmail"),
    password: formData.get("password"),
    industry: formData.get("industry"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { businessName, ownerEmail, password, industry } = parsed.data;
  const supabase = createClient();

  // 1. Create the auth user. Supabase sends the verification email
  //    automatically (Auth > Email Templates > Confirm signup in your
  //    Supabase dashboard), and email_confirmed_at stays null until they click it.
  const { data, error } = await supabase.auth.signUp({
    email: ownerEmail,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      data: { business_name: businessName }, // stashed on the user for the callback step
    },
  });

  if (error) {
    return { error: error.message };
  }
  if (!data.user) {
    return { error: "Signup did not return a user — please try again." };
  }

  // 2. Create the business row using the admin client (service role), so this
  //    write succeeds even before the user's session/RLS context is fully live.
  //    This keeps "one auth user -> one business" atomic at signup time.
  const admin = createAdminClient();
  const { error: bizError } = await admin.from("businesses").insert({
    owner_id: data.user.id,
    name: businessName,
    owner_email: ownerEmail,
    industry,
  });

  if (bizError) {
    // Don't leave an orphaned auth user with no business record.
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: "Could not create your business profile. Please try again." };
  }

  return { success: true };
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export async function logIn(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Supabase returns "Invalid login credentials" for both wrong password
    // and unknown email — intentionally vague so we don't leak which emails exist.
    return { error: error.message };
  }

  if (data.user && !data.user.email_confirmed_at) {
    redirect("/verify-email");
  }

  redirect("/dashboard");
}

export async function logOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function resendVerification(email: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });

  if (error) return { error: error.message };
  return { success: true };
}
