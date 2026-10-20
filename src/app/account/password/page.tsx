import { redirect } from "next/navigation";

// Password changes now live on My Profile; keep old links working.
export default function ChangePasswordPage() {
  redirect("/account");
}
