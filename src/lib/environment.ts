/*
 * Test or Live (docs/new-client-setup.md). Every client dashboard runs twice:
 * Live (Vercel Production: Supabase main branch, the client's Briitely
 * sub-account) and Test (Vercel Preview and local development: the Supabase
 * development branch, the client's Briitely test sub-account).
 *
 * BRIITELY_ACCOUNT=test (Vercel → Preview only) says the Briitely key points
 * at a test sub-account. Without it, a test build can read from Briitely but
 * never change anything there, so a live client's key copied into Test by
 * mistake can't touch their real contacts.
 *
 * The lock is features.briitelyTestLock in client.config.ts: on for every
 * dashboard, except while a live client waits for its TEST sub-account.
 */

import { clientConfig } from "@/config/client.config";

/** Live = Vercel Production (or APP_ENVIRONMENT=live on other hosting). Everything else is Test. */
export function isLiveEnvironment(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.APP_ENVIRONMENT === "live";
}

export function isTestEnvironment(): boolean {
  return !isLiveEnvironment();
}

/** True when this build's Briitely key is for a test sub-account (BRIITELY_ACCOUNT=test). */
export function isBriitelyTestAccount(): boolean {
  return process.env.BRIITELY_ACCOUNT?.trim().toLowerCase() === "test";
}

/** Whether this dashboard has the Briitely test lock switched on (client.config.ts). */
export function isBriitelyTestLockOn(): boolean {
  return clientConfig.features.briitelyTestLock.enabled;
}

/** Live always may change Briitely; Test only when connected to a test sub-account (or the lock is off). */
export function canChangeBriitely(): boolean {
  return isLiveEnvironment() || isBriitelyTestAccount() || !isBriitelyTestLockOn();
}

/**
 * Sign In for Testing: a one-click sign-in on test builds, as the test
 * account in TEST_SIGN_IN_EMAIL / TEST_SIGN_IN_PASSWORD (Vercel → Preview
 * only). Never on Live. Previews are behind Vercel Authentication, so only
 * members of the Briitely Vercel team can reach the button.
 */
export function isTestSignInAvailable(): boolean {
  return isTestEnvironment() && Boolean(process.env.TEST_SIGN_IN_EMAIL?.trim() && process.env.TEST_SIGN_IN_PASSWORD);
}
