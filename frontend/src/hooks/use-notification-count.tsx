"use client";

import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type NotificationCountContextValue = {
  unreadCount: number;
  setUnreadCount: Dispatch<SetStateAction<number>>;
  incrementUnread: (val?: number) => void;
  decrementUnread: (val?: number) => void;
};

const NotificationCountContext =
  createContext<NotificationCountContextValue | null>(null);

export function NotificationCountProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  const incrementUnread = useCallback((val: number = 1) => {
    if (val <= 0) return;
    setUnreadCount((prev) => prev + val);
  }, []);

  const decrementUnread = useCallback((val: number = 1) => {
    if (val <= 0) return;
    setUnreadCount((prev) => Math.max(0, prev - val));
  }, []);

  const value = useMemo(
    () => ({
      unreadCount,
      setUnreadCount,
      incrementUnread,
      decrementUnread,
    }),
    [unreadCount]
  );

  return (
    <NotificationCountContext.Provider value={value}>
      {children}
    </NotificationCountContext.Provider>
  );
}

export function useNotificationCount() {
  const ctx = useContext(NotificationCountContext);

  if (!ctx) {
    throw new Error("Context error occured");
  }

  return ctx;
}
