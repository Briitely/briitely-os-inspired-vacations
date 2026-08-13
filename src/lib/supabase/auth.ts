import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: "super_admin" | "admin" | "staff";
  ghlUserId: string | null;
  isActive: boolean;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function getAuthenticatedUser(): Promise<{
  user: AuthUser | null;
  error: string | null;
}> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, error: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, first_name, last_name, role, is_active, ghl_user_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { user: null, error: "We couldn't load your account details." };
  }

  if (!profile) {
    return { user: null, error: "No profile found for your account." };
  }

  if (!profile.is_active) {
    return { user: null, error: "Your account is not active. Please contact an administrator." };
  }

  const firstName = profile.first_name || "";
  const lastName = profile.last_name || "";
  const fullName = profile.full_name || [firstName, lastName].filter(Boolean).join(" ") || profile.email || user.email || "";
  const { firstName: splitFirst, lastName: splitLast } = splitName(fullName);

  return {
    user: {
      id: profile.id,
      email: profile.email || user.email || "",
      firstName: firstName || splitFirst,
      lastName: lastName || splitLast,
      fullName,
      role: profile.role,
      ghlUserId: profile.ghl_user_id,
      isActive: profile.is_active,
    },
    error: null,
  };
}

export async function requireAuthenticatedUser(): Promise<{
  user: AuthUser;
} | null> {
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) {
    return null;
  }
  return { user };
}

export async function requireAdmin(): Promise<{
  user: AuthUser;
} | null> {
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) {
    return null;
  }
  if (user.role !== "admin" && user.role !== "super_admin") {
    return null;
  }
  return { user };
}

export async function requireSuperAdmin(): Promise<{
  user: AuthUser;
} | null> {
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) {
    return null;
  }
  if (user.role !== "super_admin") {
    return null;
  }
  return { user };
}

export type { Profile };
