"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/core/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { useState } from "react";

export function DeleteTestFileButton({ travelFileId }: { travelFileId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this test Travel File? This will also delete all related actions, payments, and consultations.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/travel-files/${travelFileId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete Travel File.");
        setDeleting(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      alert("Something went wrong deleting the Travel File.");
      setDeleting(false);
    }
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      Delete Test Travel File
    </Button>
  );
}
