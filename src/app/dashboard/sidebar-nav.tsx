"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", section: "main" },
  { label: "CCTV", href: "/dashboard/cctv", section: "main" },
  { label: "Maps", href: "/dashboard/maps", section: "main" },
  // { label: "Message", href: "/dashboard/message", section: "main" },
  { label: "Users", href: "/dashboard/users", section: "manage", allowedRoles: ["ADMINISTRATOR", "CLIENT"] },
  { label: "Projects", href: "/dashboard/projects", section: "manage", allowedRoles: ["ADMINISTRATOR"] },
  { label: "Ports", href: "/dashboard/ports", section: "manage", allowedRoles: ["ADMINISTRATOR"] },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { data } = useSession();
  const role = data?.user?.role;

  return (
    <nav className="space-y-6">
      {(() => {
        const items = navItems.filter((item) => {
          if (!item.allowedRoles) return true;
          if (!role) return false;
          return item.allowedRoles.includes(role);
        });
        return (
          <div className="space-y-1">
            {items.map((item) => {
              const isRoot = item.href === "/dashboard";
              const active = isRoot
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center justify-between overflow-hidden rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-[var(--color-primary-strong)] text-white shadow hover:text-white"
                      : "text-[var(--color-text)] hover:bg-[#f1f5f9]"
                  }`}
                >
                  <span className={active ? "text-white" : "text-[var(--color-text)]"}>{item.label}</span>
                  <span
                    className={`h-2 w-2 rounded-full transition ${
                      active ? "bg-white/90" : "bg-[var(--color-border)]"
                    }`}
                  />
                  {active ? <span className="absolute inset-y-0 left-0 w-1 bg-white/60" /> : null}
                </Link>
              );
            })}
          </div>
        );
      })()}
    </nav>
  );
}
