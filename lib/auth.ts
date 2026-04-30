import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: { email: { label: "Email", type: "email" }, name: { label: "Name", type: "text" } },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        if (!email) return null;
        const user = await prisma.user.upsert({
          where: { email },
          update: { name: credentials?.name?.trim() || undefined },
          create: { email, name: credentials?.name?.trim() || "Collector" }
        });
        return { id: user.id, email: user.email, name: user.name };
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) session.user.id = token.sub ?? "";
      return session;
    }
  }
};

export async function getDemoUser() {
  return prisma.user.upsert({
    where: { email: "demo@cardrate.local" },
    update: {},
    create: { email: "demo@cardrate.local", name: "Demo Collector" }
  });
}
