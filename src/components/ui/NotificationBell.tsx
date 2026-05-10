// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { Bell } from "lucide-react";

export interface NotificationBellProps {
  /** Number of unread notifications. 0 hides the dot. */
  unread?: number;
  /** Click handler — typically opens a notification panel / drops to the
   *  WhatsNew modal / drift toast list. */
  onClick?: () => void;
  className?: string;
}

/**
 * Bell icon button with unread-count indicator. Lives in the title bar's
 * right cluster (mockup-1 top-right shows it next to min/max/close).
 *
 * Visual recipe:
 *   - 28×28 hit target, bell icon centred
 *   - Magenta dot with white-text count overlaid top-right when unread > 0
 *   - Subtle hover background like the other titlebar widgets
 */
export function NotificationBell({
  unread = 0,
  onClick,
  className = "",
}: NotificationBellProps) {
  const hasUnread = unread > 0;
  const display = unread > 9 ? "9+" : String(unread);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center justify-center w-7 h-7 rounded-md text-text-secondary hover:text-text-primary hover:bg-[var(--titlebar-btn-hover)] transition-colors active:scale-[0.95] ${className}`}
      aria-label={
        hasUnread
          ? `Notifications (${unread} unread)`
          : "Notifications"
      }
    >
      <Bell className="w-4 h-4" aria-hidden="true" />
      {hasUnread && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-[var(--accent-magenta)] text-white text-[9px] font-bold leading-[14px] text-center"
          style={{
            boxShadow: "0 0 8px var(--accent-magenta-glow)",
          }}
        >
          {display}
        </span>
      )}
    </button>
  );
}
