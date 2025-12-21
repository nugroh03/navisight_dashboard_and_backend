import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await prisma.user.findFirst({
          where: { email, deletedAt: null },
          include: { role: true },
        });
        if (!user?.passwordHash) return null;
        const match = await compare(password, user.passwordHash);
        if (!match) return null;
        const { passwordHash, role, ...userData } = user;
        return {
          ...userData,
          role: role ?? undefined,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        if ("role" in user && user.role) {
          token.role = user.role.name;
        }
      }
      if (!token.role && token.email) {
        const dbUser = await prisma.user.findFirst({
          where: { email: token.email, deletedAt: null },
          select: {
            id: true,
            role: { select: { name: true } }
          },
        });
        if (dbUser) {
          if (dbUser.id) token.id = dbUser.id;
          if (dbUser.role?.name) token.role = dbUser.role.name;
        } else {
          delete token.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id) {
          session.user.id = token.id as string;
        }
        if (token.role) {
          session.user.role = token.role as string;
        }
      }
      return session;
    },
  },
};
