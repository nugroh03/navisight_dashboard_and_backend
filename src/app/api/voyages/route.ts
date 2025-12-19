import { authOptions } from "@/auth/config";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const voyageSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(3),
  status: z.string().optional(),
  etd: z.string().datetime().optional(),
  eta: z.string().datetime().optional(),
});

export async function GET() {
  const data = await prisma.voyage.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = voyageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }

  const voyage = await prisma.voyage.create({ data: parsed.data });
  return NextResponse.json(voyage);
}
