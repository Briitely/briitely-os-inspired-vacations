import { PublicIntakeForm } from "@/components/app/public-intake-form";

export default function InquiryPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-foreground">
            Start Your Travel Journey
          </h1>
          <p className="text-muted-foreground text-lg">
            Tell us about your dream trip and one of our expert travel advisors will be in touch.
          </p>
        </div>
        <PublicIntakeForm businessName="Inspired Vacations" />
      </main>
    </div>
  );
}
