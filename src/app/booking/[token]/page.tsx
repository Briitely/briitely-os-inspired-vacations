import type { Metadata } from "next";
import { CustomerBookingForm } from "@/components/app/customer-booking-form";

export const metadata: Metadata = { title: "Retainer & Booking Information — Inspired Vacations" };

export default async function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-[#f5f2ff] text-foreground">
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Inspired Vacations</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Let&apos;s get your trip underway</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">First, review and accept your Retainer Agreement. Then confirm the booking information for everyone in your immediate family travelling on this trip. Anything we already have on file will be pre-filled for you to review.</p>
        </div>
        <CustomerBookingForm token={token} />
        <footer className="py-7 text-center text-xs text-muted-foreground">Inspired Vacations · Your information is used only to plan and book your travel.</footer>
      </main>
    </div>
  );
}
