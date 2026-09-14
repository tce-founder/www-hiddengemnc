import { useCallback, useEffect } from 'react';

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? '';

/**
 * grecaptcha.execute() with a bad or missing key never settles, which would
 * leave the submit button spinning forever. The timeout turns that into a
 * visible error. Submissions still never go out without a token in a
 * deployed build (fail closed).
 */
const EXECUTE_TIMEOUT_MS = 10_000;

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (!SITE_KEY) return Promise.reject(new Error('Verification unavailable'));
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(SITE_KEY)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load verification'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * reCAPTCHA v3 (invisible, score-based). Returns a token for `action` that the
 * API verifies server-side.
 *
 * Local development has no site key: `getToken` resolves to undefined and the
 * local API accepts the submission without verification. Deployed builds
 * without a key reject, so a misconfiguration is visible rather than silent.
 */
export function useRecaptcha() {
  useEffect(() => {
    // Warm up so the first submit isn't slowed by the script download.
    if (SITE_KEY) loadScript().catch(() => undefined);
  }, []);

  const getToken = useCallback(async (action: string): Promise<string | undefined> => {
    if (!SITE_KEY && import.meta.env.DEV) return undefined;

    await loadScript();
    const grecaptcha = window.grecaptcha;
    if (!grecaptcha) throw new Error('Verification unavailable');

    const token = new Promise<string>((resolve, reject) => {
      grecaptcha.ready(() => {
        grecaptcha.execute(SITE_KEY, { action }).then(resolve, reject);
      });
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Verification timed out')), EXECUTE_TIMEOUT_MS),
    );
    return Promise.race([token, timeout]);
  }, []);

  return { getToken };
}
