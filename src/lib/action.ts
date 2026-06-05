// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// runAction — the busy-flag + toast lifecycle the page components repeated by
// hand for one-shot backend calls: flip a busy flag on, run the action, show a
// success toast, or on failure show an error toast built from the backend
// message (falling back to a label). The busy flag is always cleared.
//
// Returns true on success / false on failure so callers can run follow-up logic
// (e.g. closing a confirm dialog) only when the action actually succeeded.
//
// This deliberately shows a single-message `toast.error(msg)` to match the
// existing per-page toasts. For the lower-level "invoke + error toast, no busy
// flag, returns the value" pattern used by stores, see `invokeOrToast`.
import { toast } from "sonner";
import { errMessage } from "./errors";

export async function runAction(
  setBusy: (busy: boolean) => void,
  action: () => Promise<unknown>,
  messages: { success: string; failure: string },
): Promise<boolean> {
  setBusy(true);
  try {
    await action();
    toast.success(messages.success);
    return true;
  } catch (e) {
    toast.error(errMessage(e, messages.failure));
    return false;
  } finally {
    setBusy(false);
  }
}
