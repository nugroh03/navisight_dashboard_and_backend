import { authOptions } from "@/auth/config";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const projectUpdateSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters"),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        projectUsers: {
          some: {
            userId: userId
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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

    const body = await request.json();
    const parsed = projectUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        errors: parsed.error.flatten().fieldErrors
      }, { status: 400 });
    }

    const project = await prisma.project.updateMany({
      where: {
        id: projectId,
        deletedAt: null,
        projectUsers: {
          some: {
            userId: userId
          }
        }
      },
      data: {
        name: parsed.data.name
      }
    });

    if (project.count === 0) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    const updatedProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null
      }
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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

    const project = await prisma.project.updateMany({
      where: {
        id: projectId,
        deletedAt: null,
        projectUsers: {
          some: {
            userId: userId
          }
        }
      },
      data: {
        deletedAt: new Date()
      }
    });

    if (project.count === 0) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
