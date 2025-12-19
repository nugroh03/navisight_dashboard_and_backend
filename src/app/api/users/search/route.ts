import { authOptions } from "@/auth/config";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q");
    const projectId = searchParams.get("projectId");

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    // Build the where clause
    let whereClause: any = {
      deletedAt: null,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } }
      ]
    };

    // If projectId is provided, exclude users who are already members
    if (projectId) {
      const existingMemberIds = await prisma.projectUser.findMany({
        where: { projectId },
        select: { userId: true }
      });

      whereClause.id = {
        notIn: existingMemberIds.map(m => m.userId)
      };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: {
          select: {
            name: true
          }
        }
      },
      take: 10,
      orderBy: [
        { name: "asc" },
        { email: "asc" }
      ]
    });

    return NextResponse.json(users);

  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
