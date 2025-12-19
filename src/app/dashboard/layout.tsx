"use client";

import type { ReactNode } from "react";
import { signOut } from "next-auth/react";
import { SidebarNav } from "./sidebar-nav";
import { useSession } from "next-auth/react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { data } = useSession();
  const userLabel = data?.user?.email ?? "User";
  const userRole = data?.user?.role ?? "";

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="mx-auto flex w-full max-w-none gap-8 px-0 py-0 lg:px-0">
        <aside className="flex h-screen w-72 shrink-0 flex-col justify-between border-r border-[var(--color-border)] bg-white/95 px-5 py-8 shadow-xl backdrop-blur">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-strong)] text-base font-semibold text-white shadow">
                N
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-strong)]">
                  NAVISIGHT
                </p>
                <p className="text-xs text-[var(--color-muted)]">Control Deck</p>
              </div>
            </div>
            <div className="mt-4 h-[1px] bg-[var(--color-border)]/80" />
            <SidebarNav />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-[#f8fafc] px-3 py-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-strong)] text-sm font-semibold text-white">
                U
              </div>
              <div className="text-sm">
                <p className="font-semibold text-[var(--color-text)]">{userLabel}</p>
                <p className="text-[var(--color-muted)]">{userRole || "Profil"}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-primary-strong)] transition hover:bg-[#f1f5f9]"
            >
              Logout
              <span className="h-2 w-2 rounded-full bg-[var(--color-primary-strong)]/60" />
            </button>
          </div>
        </aside>

        <main className="flex-1 px-6 py-10 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
