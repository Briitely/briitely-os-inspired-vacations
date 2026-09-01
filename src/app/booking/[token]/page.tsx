import type { Metadata } from "next";
import { CustomerBookingForm } from "@/components/app/customer-booking-form";

export const metadata: Metadata = { title: "Traveller Booking Information — Inspired Vacations" };

export default async function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-[#f5f2ff] text-foreground">
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Inspired Vacations</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Traveller Booking Information</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Complete the information below for everyone in your immediate family travelling on this trip. Anything we already have on file has been pre-filled for you to review.</p>
          </div>
        </div>
        <CustomerBookingForm token={token} />
        <footer className="py-7 text-center text-xs text-muted-foreground">Inspired Vacations · Your information is used only to plan and book your travel.</footer>
      </main>
    </div>
  );
}
