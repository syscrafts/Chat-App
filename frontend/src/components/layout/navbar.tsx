"use client";

import { SignedIn, SignedOut, useAuth, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "../ui/button";
import { Bell, Menu, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSocket } from "@/hooks/use-socket";
import { apiGet, createBrowserApiClient } from "@/lib/api-client";
import { Notification } from "@/types/notification";
import { useNotificationCount } from "@/hooks/use-notification-count";
import { toast } from "sonner";

function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { getToken, userId } = useAuth();
  const { socket } = useSocket();

  const { unreadCount, setUnreadCount, incrementUnread } =
    useNotificationCount();

  const apiClient = useMemo(() => createBrowserApiClient(getToken), [getToken]);

  useEffect(() => {
    let isMounted = true;

    async function loadUnreadNotifications() {
      if (!userId) {
        if (isMounted) setUnreadCount(0);
        return;
      }

      try {
        const data = await apiGet<Notification[]>(
          apiClient,
          "/api/notifications?unreadOnly=true"
        );

        if (!isMounted) return;
        console.log(data);

        setUnreadCount(data.length);
      } catch (e) {
        if (!isMounted) return;
        console.log(`Error ocuured`);
      }
    }

    loadUnreadNotifications();
  }, [userId]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleNewNotification = (payload: Notification) => {
      incrementUnread();

      toast("New Notification", {
        description:
          payload.type === "REPLY_ON_THREAD"
            ? `${payload.actor.handle ?? "Someone"} commented to your thread`
            : `${payload.actor.handle ?? "Someone"} liked your thread`,
      });
    };

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, [socket, incrementUnread]);

  const navItems = [
    {
      href: "/chat",
      label: "Chat",
      match: (p?: string | null) => p?.startsWith("chat"),
    },
    {
      href: "/profile",
      label: "Profile",
      match: (p?: string | null) => p?.startsWith("profile"),
    },
    {
      href: "/admin/categories",
      label: "Categories",
      match: (p?: string | null) => p?.startsWith("admin"),
    },
  ];

  const renderNavLinks = (item: (typeof navItems)[number]) => {
    return (
      <Link
        key={item.href}
        href={item.href}
        className="flex items-center rounded-full px-3 py-2 text-sm font-medium transition-colors bg-primary/20 text-primary shadow-sm"
      >
        {item.label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-sidebar-border bg-sidebar/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg text-sidebar-foreground"
          >
            <span className="bg-linear-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              Chat App
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(renderNavLinks)}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <SignedIn>
            <Link href="/notifications">
              <Button
                size="icon"
                variant="ghost"
                className="relative h-9 w-9 text-muted-foreground hover:bg-card/10 hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute -right-1 -top-1 inline-flex min-w-5 min-h-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm shadow-primary/40">
                  {unreadCount > 0 ? unreadCount : 0}
                </span>
              </Button>
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Link href="/sign-in">
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/90"
              >
                Sign In
              </Button>
            </Link>
          </SignedOut>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent text-muted-foreground transition-colors md:hidden"
          >
            {mobileMenuOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="border-t border-sidebar-border bg-sidebar/90 md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 pb-4 pt-2">
            {navItems.map(renderNavLinks)}
          </nav>
        </div>
      )}
    </header>
  );
}

export default Navbar;
