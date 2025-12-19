import { authOptions } from "@/auth/config";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get current user ID
    let currentUserId = session.user.id;
    if (!currentUserId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, role: { select: { name: true } } }
      });
      if (!user) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
      }
      currentUserId = user.id;

      // Check if user is a system administrator
      if (user.role?.name !== "ADMINISTRATOR") {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    const projectId = params.id;
    const body = await req.json();
    const parsed = addMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        errors: parsed.error.flatten().fieldErrors
      }, { status: 400 });
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    // Check if user exists
    const userToAdd = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, name: true, email: true }
    });

    if (!userToAdd) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Check if user is already a member
    const existingMember = await prisma.projectUser.findUnique({
      where: {
        projectId_userId: {
          projectId: projectId,
          userId: parsed.data.userId
        }
      }
    });

    if (existingMember) {
      return NextResponse.json({
        message: "User is already a member of this project"
      }, { status: 400 });
    }

    // Add user to project
    const projectUser = await prisma.projectUser.create({
      data: {
        projectId: projectId,
        userId: parsed.data.userId,
        role: parsed.data.role
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json({
      message: "User added to project successfully",
      member: projectUser
    }, { status: 201 });

  } catch (error) {
    console.error("Error adding user to project:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// Get all members of a project
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get current user ID
    let currentUserId = session.user.id;
    if (!currentUserId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
      });
      if (!user) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
      }
      currentUserId = user.id;
    }

    const projectId = params.id;

    // Check if user is a member of the project
    const currentUserMembership = await prisma.projectUser.findUnique({
      where: {
        projectId_userId: {
          projectId: projectId,
          userId: currentUserId
        }
      }
    });

    if (!currentUserMembership) {
      return NextResponse.json({ message: "Access denied" }, { status: 403 });
    }

    // Get all members of the project
    const members = await prisma.projectUser.findMany({
      where: {
        projectId: projectId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return NextResponse.json(members);

  } catch (error) {
    console.error("Error fetching project members:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}