import { exec } from "child_process"
import { promisify } from "util"
import { log } from "./logger"

const execAsync = promisify(exec)

export interface DockerStatus {
  installed: boolean
  running: boolean
  imagePresent: boolean
  imagePulling: boolean
  pullProgress?: string
  error?: string
}

export async function checkDockerInstalled(): Promise<boolean> {
  log.debug("DOCKER", "Checking if Docker is installed...")
  try {
    const { stdout } = await execAsync("docker --version")
    log.success("DOCKER", "Docker installed", { version: stdout.trim() })
    return true
  } catch {
    log.warn("DOCKER", "Docker not installed or not in PATH")
    return false
  }
}

export async function checkDockerRunning(): Promise<boolean> {
  log.debug("DOCKER", "Checking if Docker daemon is running...")
  try {
    await execAsync("docker info")
    log.success("DOCKER", "Docker daemon is running")
    return true
  } catch {
    log.warn("DOCKER", "Docker daemon is not running")
    return false
  }
}

export async function checkImagePresent(imageName: string): Promise<boolean> {
  log.debug("DOCKER", "Checking if image exists", { image: imageName })
  try {
    const { stdout } = await execAsync(`docker images --format "{{.Repository}}:{{.Tag}}" | grep -c "^${imageName}$" || true`)
    const present = parseInt(stdout.trim(), 10) > 0
    if (present) {
      log.success("DOCKER", "Image found", { image: imageName })
    } else {
      log.warn("DOCKER", "Image not found", { image: imageName })
    }
    return present
  } catch {
    log.error("DOCKER", "Failed to check image presence", { image: imageName })
    return false
  }
}

export async function pullDockerImage(
  imageName: string,
  onProgress?: (progress: string) => void
): Promise<{ success: boolean; error?: string }> {
  log.info("DOCKER", "Pulling Docker image", { image: imageName })
  log.startTimer("docker-pull")

  return new Promise((resolve) => {
    const child = exec(`docker pull ${imageName}`)
    
    let lastProgress = ""
    let lineCount = 0
    const outputLines: string[] = []

    const captureLine = (line: string) => {
      outputLines.push(line)
      if (outputLines.length > 20) {
        outputLines.shift()
      }
    }
    
    child.stdout?.on("data", (data) => {
      const lines = data.toString().split("\n").filter(Boolean)
      for (const line of lines) {
        captureLine(line)
        if (line !== lastProgress) {
          lastProgress = line
          lineCount++
          if (lineCount % 5 === 0) {
            log.debug("DOCKER", "Pull progress", { line: line.substring(0, 100) })
          }
          onProgress?.(line)
        }
      }
    })

    child.stderr?.on("data", (data) => {
      const lines = data.toString().split("\n").filter(Boolean)
      for (const line of lines) {
        captureLine(line)
        if (line !== lastProgress) {
          lastProgress = line
          log.warn("DOCKER", "Pull stderr", { line: line.substring(0, 100) })
          onProgress?.(line)
        }
      }
    })

    child.on("close", (code) => {
      log.stopTimer("docker-pull", "DOCKER")
      if (code === 0) {
        log.success("DOCKER", "Image pulled successfully", { image: imageName })
        resolve({ success: true })
      } else {
        const output = outputLines.join("\n").trim()
        const error = output
          ? `Docker pull failed with exit code ${code}: ${output}`
          : `Docker pull failed with exit code ${code}`
        log.error("DOCKER", "Image pull failed", { image: imageName, exitCode: code, output: output.substring(0, 1000) })
        resolve({ success: false, error })
      }
    })

    child.on("error", (error) => {
      log.stopTimer("docker-pull", "DOCKER")
      log.error("DOCKER", "Image pull process error", { image: imageName, error: error.message })
      resolve({ success: false, error: error.message })
    })
  })
}

export async function getDockerStatus(imageName: string): Promise<DockerStatus> {
  log.info("DOCKER", "Getting Docker status", { image: imageName })

  const installed = await checkDockerInstalled()
  
  if (!installed) {
    log.warn("DOCKER", "Docker not installed")
    return {
      installed: false,
      running: false,
      imagePresent: false,
      imagePulling: false,
      error: "Docker is not installed",
    }
  }

  const running = await checkDockerRunning()
  
  if (!running) {
    log.warn("DOCKER", "Docker daemon not running")
    return {
      installed: true,
      running: false,
      imagePresent: false,
      imagePulling: false,
      error: "Docker daemon is not running",
    }
  }

  const imagePresent = await checkImagePresent(imageName)

  log.success("DOCKER", "Docker status check complete", { installed: true, running: true, imagePresent })
  return {
    installed: true,
    running: true,
    imagePresent,
    imagePulling: false,
  }
}

export function getDockerInstallInstructions(): string {
  log.debug("DOCKER", "Generating install instructions", { platform: process.platform })
  const platform = process.platform
  
  if (platform === "darwin") {
    return `
## Docker Installation Required (macOS)

Docker is not installed or not running on your system. To run security scans, you need Docker Desktop.

### Installation Steps:

1. **Download Docker Desktop for Mac**
   - Visit: https://www.docker.com/products/docker-desktop/
   - Download the Apple Silicon (M1/M2/M3) or Intel version based on your Mac
   - Check your chip: Click Apple menu → About This Mac

2. **Install Docker Desktop**
   - Open the downloaded .dmg file
   - Drag Docker to Applications folder
   - Launch Docker Desktop from Applications

3. **Start Docker**
   - Docker Desktop will start automatically
   - Wait for the Docker icon in the menu bar to show "Docker Desktop is running"
   - This may take 1-2 minutes on first launch
   - You may need to grant permissions when prompted

4. **Verify Installation**
   - Open Terminal and run: \`docker --version\`
   - You should see Docker version information
   - Run: \`docker run hello-world\` to test

Once Docker is running, refresh this page and your scan will start automatically.
`
  } else if (platform === "win32") {
    return `
## Docker Installation Required (Windows)

Docker is not installed or not running on your system. To run security scans, you need Docker Desktop.

### System Requirements:
- Windows 10/11 (64-bit) Pro, Enterprise, or Education
- WSL 2 (Windows Subsystem for Linux) enabled
- Hardware virtualization enabled in BIOS

### Installation Steps:

1. **Enable WSL 2** (if not already enabled)
   - Open PowerShell as Administrator
   - Run: \`wsl --install\`
   - Restart your computer if prompted

2. **Download Docker Desktop for Windows**
   - Visit: https://www.docker.com/products/docker-desktop/
   - Download the Windows installer

3. **Install Docker Desktop**
   - Run the downloaded installer (Docker Desktop Installer.exe)
   - Follow the installation wizard
   - Ensure "Use WSL 2 instead of Hyper-V" is checked
   - Restart your computer when prompted

4. **Start Docker Desktop**
   - Launch Docker Desktop from Start menu
   - Wait for the Docker icon in system tray to show "Docker Desktop is running"
   - This may take 2-3 minutes on first launch
   - Accept the license agreement when prompted

5. **Verify Installation**
   - Open PowerShell or Command Prompt
   - Run: \`docker --version\`
   - You should see Docker version information
   - Run: \`docker run hello-world\` to test

Once Docker is running, refresh this page and your scan will start automatically.

### Troubleshooting:
- If you see "WSL 2 installation is incomplete", run: \`wsl --update\`
- If virtualization is disabled, enable it in BIOS/UEFI settings
- Ensure Windows is up to date (Settings → Windows Update)
`
  } else if (platform === "linux") {
    return `
## Docker Installation Required (Linux)

Docker is not installed or not running on your system. To run security scans, you need Docker Engine.

### Installation Steps:

1. **Install Docker Engine**
   
   **Ubuntu/Debian:**
   \`\`\`bash
   # Update package index
   sudo apt-get update
   
   # Install prerequisites
   sudo apt-get install -y ca-certificates curl gnupg lsb-release
   
   # Add Docker's official GPG key
   sudo mkdir -p /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   
   # Set up repository
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   
   # Install Docker Engine
   sudo apt-get update
   sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   \`\`\`
   
   **Fedora/RHEL/CentOS:**
   \`\`\`bash
   sudo dnf -y install dnf-plugins-core
   sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
   sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   \`\`\`
   
   **Arch Linux:**
   \`\`\`bash
   sudo pacman -S docker docker-compose
   \`\`\`

2. **Add User to Docker Group** (to run without sudo)
   \`\`\`bash
   sudo usermod -aG docker $USER
   newgrp docker
   \`\`\`

3. **Start Docker Service**
   \`\`\`bash
   sudo systemctl start docker
   sudo systemctl enable docker
   \`\`\`

4. **Verify Installation**
   \`\`\`bash
   docker --version
   docker run hello-world
   \`\`\`

Once Docker is running, refresh this page and your scan will start automatically.
`
  } else {
    return `
## Docker Installation Required

Docker is not installed or not running on your system. To run security scans, you need Docker.

### Installation Steps:

1. **Download Docker**
   - Visit: https://www.docker.com/products/docker-desktop/
   - Download the version for your operating system (Windows, macOS, or Linux)

2. **Install Docker**
   - Run the installer
   - Follow the installation wizard for your platform

3. **Start Docker**
   - Launch Docker Desktop (Windows/macOS) or start the Docker service (Linux)
   - Wait for it to initialize

4. **Verify Installation**
   - Open a terminal/command prompt
   - Run: \`docker --version\`
   - Run: \`docker run hello-world\`

Once Docker is running, refresh this page and your scan will start automatically.
`
  }
}
