import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getDockerStatus, pullDockerImage, getDockerInstallInstructions } from "@/app/api/(services)/docker-manager"
import { getSandboxImage } from "@/app/api/(services)/docker-config"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const imageName = getSandboxImage()
  const status = await getDockerStatus(imageName)

  return NextResponse.json({
    ...status,
    imageName,
    installInstructions: !status.installed || !status.running ? getDockerInstallInstructions() : undefined,
  })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const imageName = getSandboxImage()
  
  // Check if Docker is ready
  const status = await getDockerStatus(imageName)
  
  if (!status.installed) {
    return NextResponse.json({
      success: false,
      error: "Docker is not installed",
      installInstructions: getDockerInstallInstructions(),
    }, { status: 400 })
  }

  if (!status.running) {
    return NextResponse.json({
      success: false,
      error: "Docker daemon is not running",
      installInstructions: getDockerInstallInstructions(),
    }, { status: 400 })
  }

  if (status.imagePresent) {
    return NextResponse.json({
      success: true,
      message: "Docker image is already present",
    })
  }

  // Pull the image
  const pullResult = await pullDockerImage(imageName, (progress) => {
    // Progress is logged but not streamed to client in this simple implementation
    console.log("Docker pull progress:", progress)
  })

  if (!pullResult.success) {
    return NextResponse.json({
      success: false,
      error: pullResult.error || "Failed to pull Docker image",
    }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: "Docker image pulled successfully",
  })
}
