// Required public configuration (EXPO_PUBLIC_*): read it, or fail with a clear message. There is
// deliberately no default and no fallback: a build or a Metro run without the value must not
// quietly talk to another environment (the app used to fall back to production).
//
// Callers pass the literal `process.env.EXPO_PUBLIC_NAME` expression: Expo inlines those at bundle
// time, and dynamic lookups (`process.env[name]`) are not inlined. Metro caches transformed files
// without keying on these values, so after changing .env.local restart with `npx expo start --clear`.
//
// Messages name the variable and never include its value. Where each environment gets its values:
// docs/release-configuration.md.

export class MissingConfigError extends Error {
  constructor(readonly variable: string) {
    super(
      `${variable} is not set. For development copy .env.example to .env.local and restart Metro with ` +
        '`npx expo start --clear`; EAS builds take it from eas.json or the EAS environment ' +
        '(see docs/release-configuration.md). The app has no default and will not guess an environment.'
    );
    this.name = 'MissingConfigError';
  }
}

export class InvalidConfigError extends Error {
  constructor(readonly variable: string, expectation: string) {
    super(
      `${variable} is ${expectation}. Check .env.local (development) or eas.json and the EAS environment ` +
        '(builds), then restart Metro with `npx expo start --clear` (see docs/release-configuration.md).'
    );
    this.name = 'InvalidConfigError';
  }
}

/** The trimmed value, or a MissingConfigError naming the variable. */
export function requireEnv(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new MissingConfigError(name);
  return trimmed;
}

// http is allowed so a developer can point at an API on their own machine; release builds are held
// to the exact approved https URLs by scripts/validate-release-config.js.
const HTTP_URL = /^https?:\/\/[^\s/?#]+[^\s]*$/i;

/** The trimmed value as an http(s) URL, or an error naming the variable (never the value). */
export function requireHttpUrlEnv(name: string, value: string | undefined): string {
  const trimmed = requireEnv(name, value);
  if (!HTTP_URL.test(trimmed)) throw new InvalidConfigError(name, 'not a valid http(s) URL');
  return trimmed;
}
