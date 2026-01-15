import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Voyage feature is currently unavailable",
      message: "Voyage model is not enabled in the Prisma schema.",
    },
    { status: 501 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error: "Voyage feature is currently unavailable",
      message: "Voyage model is not enabled in the Prisma schema.",
    },
    { status: 501 }
  );
}
