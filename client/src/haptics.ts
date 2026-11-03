// Haptic feedback (Anthony's request, Nov 2, 2026): a little
// physical tap from the phone on selections — bottom-menu tabs,
// tiles, theme picks, toggles, stepper presses — and a slightly
// firmer pulse on confirmations (adding a friend, setting a price
// alert). Uses the Vibration API where the device/browser supports
// it and silently does nothing where it doesn't. Users can turn it
// off in Settings (the "Haptics" switch, default ON); the choice is
// stored on the device and respected by every call site.

const STORAGE_KEY = "vaultx-haptics";

let cached: boolean | null = null;

export function hapticsEnabled(): boolean {
  if (cached != null) return cached;
  try {
    cached = localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    cached = true;
  }
  return cached;
}

export function setHapticsEnabled(on: boolean): void {
  cached = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Storage unavailable — the in-memory choice still applies.
  }
  // A single tick when turning it ON, so the user feels what they
  // just enabled. Turning it off stays silent, out of respect for
  // the choice itself.
  if (on) buzz(18);
}

function buzz(ms: number): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(ms);
    }
  } catch {
    // No vibration support — haptics are best-effort by design.
  }
}

/** Light tick for selections: taps, tabs, toggles, steppers. */
export function hapticTick(): void {
  if (hapticsEnabled()) buzz(10);
}

/** Firmer single pulse for confirmations — never a long buzz. */
export function hapticConfirm(): void {
  if (hapticsEnabled()) buzz(28);
}
