import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/config";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="space-y-6">
      <div className="card border-[var(--color-border)] bg-white p-8 shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]">
          Dashboard
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-[var(--color-text)]">Selamat datang di NAVISIGHT</h1>
        <p className="mt-2 text-[var(--color-muted)]">
          {session?.user?.email ? `Anda masuk sebagai ${session.user.email}.` : "Sesi autentikasi aktif."}{" "}
          {session?.user?.role ? `(Role: ${session.user.role})` : null}
        </p>
        <p className="mt-6 rounded-lg bg-[#f8fafc] px-4 py-3 text-sm text-[var(--color-muted)]">
          Halaman ini placeholder terproteksi oleh middleware NextAuth. Ganti atau perluas sesuai modul dashboard
          operasional.
        </p>
      </div>
    </div>
  );
}
