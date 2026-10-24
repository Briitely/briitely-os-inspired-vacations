import { FlaskConical } from "lucide-react";
import { canChangeBriitely, isBriitelyTestAccount, isTestEnvironment } from "@/lib/environment";

/** A slim bar on every page of a test build, so nobody mistakes Test for Live (lib/environment.ts). */
export function TestEnvironmentBanner() {
  if (!isTestEnvironment()) return null;
  return (
    <div role="note" className="border-b border-amber-300 bg-amber-100 px-4 py-1.5 text-center text-xs font-semibold text-amber-950">
      <FlaskConical className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
      Test environment · fake data only
      {!canChangeBriitely() && <span className="font-normal"> · Briitely is read-only here (not connected to a test account)</span>}
      {canChangeBriitely() && !isBriitelyTestAccount() && <span className="font-normal"> · Briitely isn&apos;t locked here: changes reach the Briitely account this build uses</span>}
    </div>
  );
}
