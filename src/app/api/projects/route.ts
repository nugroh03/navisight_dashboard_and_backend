import { authOptions } from "@/auth/config";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const projectSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters"),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get user ID from email if not in session
    let userId = session.user.id;
    if (!userId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
      });
      if (!user) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
      }
      userId = user.id;
    }

    // Get projects where the user is a member
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        userId: userId,
        project: {
          deletedAt: null
        }
      },
      include: {
        project: {
          include: {
            projectUsers: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    // Extract projects from the join table
    const projects = projectUsers.map(pu => ({
      ...pu.project,
      userRole: pu.role,
      users: pu.project.projectUsers
    }));

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = projectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        errors: parsed.error.flatten().fieldErrors
      }, { status: 400 });
    }

    // Get user ID from email if not in session
    let userId = session.user.id;
    if (!userId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
      });
      if (!user) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
      }
      userId = user.id;
    }

    // Create project and add creator as ADMIN in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: parsed.data.name
        }
      });

      // Add the creator as an admin of the project
      const projectUser = await tx.projectUser.create({
        data: {
          projectId: project.id,
          userId: userId,
          role: "ADMIN"
        },
        include: {
          project: {
            include: {
              projectUsers: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      return {
        ...projectUser.project,
        userRole: projectUser.role,
        users: projectUser.project.projectUsers
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
