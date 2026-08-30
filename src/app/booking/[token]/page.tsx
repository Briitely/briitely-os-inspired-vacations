import type { Metadata } from "next";
import { CustomerBookingForm } from "@/components/app/customer-booking-form";

export const metadata: Metadata = { title: "Traveller Booking Information — Inspired Vacations" };

export default async function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Inspired Vacations</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Traveller Booking Information</h1>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Let&apos;s get you ready to travel.</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">Complete the information below for everyone travelling on this trip. Anything we already have on file has been pre-filled for you to review.</p>
        </div>
        <CustomerBookingForm token={token} />
        <footer className="pb-6 pt-2 text-center text-xs text-muted-foreground">Inspired Vacations · Your information is used only to plan and book your travel.</footer>
      </main>
    </div>
  );
}
