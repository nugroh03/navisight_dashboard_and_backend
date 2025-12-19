import { authOptions } from "@/auth/config";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next-auth/server";
import { z } from "zod";

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

// Update member role
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get current user
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

      // System administrators can modify any project
      if (user.role?.name === "ADMINISTRATOR") {
        const body = await req.json();
        const parsed = updateRoleSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json({
            errors: parsed.error.flatten().fieldErrors
          }, { status: 400 });
        }

        const projectUser = await prisma.projectUser.update({
          where: {
            projectId_userId: {
              projectId: params.id,
              userId: params.memberId
            }
          },
          data: {
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
          message: "Member role updated successfully",
          member: projectUser
        });
      }
    }

    // Check if current user is an admin of the project
    const currentUserMembership = await prisma.projectUser.findUnique({
      where: {
        projectId_userId: {
          projectId: params.id,
          userId: currentUserId
        }
      }
    });

    if (!currentUserMembership || currentUserMembership.role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        errors: parsed.error.flatten().fieldErrors
      }, { status: 400 });
    }

    // Prevent admin from removing their own admin role
    if (params.memberId === currentUserId && parsed.data.role !== "ADMIN") {
      return NextResponse.json({
        message: "You cannot remove your own admin role"
      }, { status: 400 });
    }

    const projectUser = await prisma.projectUser.update({
      where: {
        projectId_userId: {
          projectId: params.id,
          userId: params.memberId
        }
      },
      data: {
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
      message: "Member role updated successfully",
      member: projectUser
    });

  } catch (error) {
    console.error("Error updating member role:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// Remove member from project
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get current user
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

      // System administrators can remove anyone
      if (user.role?.name === "ADMINISTRATOR") {
        await prisma.projectUser.delete({
          where: {
            projectId_userId: {
              projectId: params.id,
              userId: params.memberId
            }
          }
        });

        return NextResponse.json({
          message: "Member removed from project successfully"
        });
      }
    }

    // Check if current user is an admin of the project
    const currentUserMembership = await prisma.projectUser.findUnique({
      where: {
        projectId_userId: {
          projectId: params.id,
          userId: currentUserId
        }
      }
    });

    if (!currentUserMembership || currentUserMembership.role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Prevent admin from removing themselves
    if (params.memberId === currentUserId) {
      return NextResponse.json({
        message: "You cannot remove yourself from the project"
      }, { status: 400 });
    }

    await prisma.projectUser.delete({
      where: {
        projectId_userId: {
          projectId: params.id,
          userId: params.memberId
        }
      }
    });

    return NextResponse.json({
      message: "Member removed from project successfully"
    });

  } catch (error) {
    console.error("Error removing member from project:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}