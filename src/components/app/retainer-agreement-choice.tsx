"use client";

export type RetainerAgreementChoiceValue = "" | "send" | "confirmed";

/**
 * Shown when a manual jump (Override / Reopen) targets Collect Retainer Payment,
 * which normally requires the client to have signed the Retainer Agreement online.
 */
export function RetainerAgreementChoice({ value, onChange }: { value: RetainerAgreementChoiceValue; onChange: (value: RetainerAgreementChoiceValue) => void }) {
  const options: { value: Exclude<RetainerAgreementChoiceValue, "">; title: string; text: string }[] = [
    { value: "send", title: "Send retainer agreement", text: "Move to Prepare Retainer Email so the client receives and signs the agreement in the dashboard." },
    { value: "confirmed", title: "Agreement already confirmed", text: "The client signed outside the dashboard. Move to Collect Retainer Payment and record the agreement as confirmed." },
  ];
  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/30">
      <p className="font-medium">Going to this stage skips the Retainer Agreement. Has the client already confirmed it?</p>
      <div className="space-y-2">
        {options.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3">
            <input type="radio" name="retainer-agreement-choice" className="mt-1" checked={value === option.value} onChange={() => onChange(option.value)} />
            <span>
              <span className="block font-medium">{option.title}</span>
              <span className="block text-muted-foreground">{option.text}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Resolve the step to submit and the confirmation flag from the selected choice. */
export function resolveRetainerChoice(actionCode: string, choice: RetainerAgreementChoiceValue) {
  if (actionCode !== "collect_tmf_payment") return { actionCode, retainerAgreementConfirmed: false, error: null };
  if (!choice) return { actionCode, retainerAgreementConfirmed: false, error: "Choose whether to send the retainer agreement or mark it already confirmed." };
  if (choice === "send") return { actionCode: "send_tmf_agreement", retainerAgreementConfirmed: false, error: null };
  return { actionCode, retainerAgreementConfirmed: true, error: null };
}
