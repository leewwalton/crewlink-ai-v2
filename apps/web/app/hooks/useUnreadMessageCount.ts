"use client";

import { useCallback, useEffect, useState } from "react";
import { listConversations, resolveUnreadCount } from "../utils/messaging-client";

const POLL_INTERVAL_MS = 30_000;

export function useUnreadMessageCount(enabled: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }

    try {
      const result = await listConversations();
      setUnreadCount(
        result.unreadCount ??
          (await resolveUnreadCount(result.conversations, result.currentUser.id)),
      );
    } catch {
      setUnreadCount(0);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
    if (!enabled) return;

    const intervalId = window.setInterval(refresh, POLL_INTERVAL_MS);
    const onFocus = () => {
      refresh();
    };

    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, refresh]);

  return { unreadCount, refreshUnreadCount: refresh };
}

/** @deprecated Use useUnreadMessageCount */
export function useUnansweredMessageCount(enabled: boolean) {
  const { unreadCount, refreshUnreadCount } = useUnreadMessageCount(enabled);
  return { unansweredCount: unreadCount, refreshUnansweredCount: refreshUnreadCount };
}
