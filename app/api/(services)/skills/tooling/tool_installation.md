---
name: tool-installation
description: Exact install commands for all security tools. Use this before installing anything to avoid wrong packages, old versions, or hallucinated commands.
---

# Tool Installation Reference

ALWAYS check if a tool is already installed before installing:
```bash
which <tool> && <tool> --version
```

ALWAYS use the exact commands below. Do NOT guess package names or invent install commands.

## ProjectDiscovery Tools (Go)

These are the most reliable recon/scanning tools. Install via `go install`:

```bash
# Install ALL ProjectDiscovery tools in one batch:
go install github.com/projectdiscovery/httpx/cmd/httpx@latest
go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install github.com/projectdiscovery/naabu/v2/cmd/naabu@latest
go install github.com/projectdiscovery/katana/cmd/katana@latest
go install github.com/projectdiscovery/notify/cmd/notify@latest
```

Verify after install:
```bash
httpx -version
nuclei -version
subfinder -version
naabu -version
katana -version
```

## System Packages (apk)

```bash
# Recon & Network
apk add nmap whois bind-tools tcpdump

# SQL Injection
apk add sqlmap

# Web & HTTP
apk add httpie

# Secrets & Forensics
apk add exiftool

# Utilities
apk add tree ripgrep fd bat
```

## Python Tools (pip)

```bash
# SAST / Static Analysis
pip install semgrep

# Security Linting
pip install bandit

# Parameter Discovery
pip install arjun

# Directory Discovery
pip install dirsearch

# WAF Detection
pip install wafw00f

# Web Fuzzing (alternative to ffuf)
pip install wfuzz

# JWT Testing
pip install pyjwt cryptography

# HTTP Library (for custom scripts)
pip install httpx requests beautifulsoup4 lxml
```

Verify:
```bash
semgrep --version
bandit --version
arjun --version
```

## Node.js Tools (npm)

```bash
# Vulnerable JS Detection
npm install -g retire

# JS Static Analysis
npm install -g eslint jshint

# JS Beautifier / Deobfuscator
npm install -g js-beautify

# AST-Grep (structural code search)
npm install -g @ast-grep/cli
```

## Go Tools (Non-ProjectDiscovery)

```bash
# Web Crawler
go install github.com/hakluke/hakrawler@latest

# Subdomain Enumeration (alternative)
go install github.com/owasp-amass/amass/v4/...@master

# HTTP Parameter Fuzzing
go install github.com/ffuf/ffuf/v2@latest

# CVE Mapping
go install github.com/projectdiscovery/cvemap/cmd/cvemap@latest

# Interactsh (OOB testing)
go install github.com/projectdiscovery/interactsh/cmd/interactsh-client@latest
```

## Binary Downloads (wget/curl)

Use ONLY when `go install` or `apk add` is not available:

```bash
# JWT Tool (Python, git clone)
git clone https://github.com/ticarpi/jwt_tool.git /home/pentester/tools/jwt_tool
cd /home/pentester/tools/jwt_tool && pip install -r requirements.txt

# SecLists wordlists
wget -qO /home/pentester/tools/wordlists/common.txt https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/common.txt
wget -qO /home/pentester/tools/wordlists/raft-large-directories.txt https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/raft-large-directories.txt
wget -qO /home/pentester/tools/wordlists/raft-large-words.txt https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/raft-large-words.txt

# XSS payloads
wget -qO /home/pentester/tools/wordlists/xss-payloads.txt https://raw.githubusercontent.com/payloadbox/xss-payload-list/master/Intruder/xss-payload-list.txt

# SQLi payloads
wget -qO /home/pentester/tools/wordlists/sqli-payloads.txt https://raw.githubusercontent.com/payloadbox/sql-injection-payload-list/master/SQLi-payloads.txt
```

## Batch Install Recipes

Install by scan phase to minimize wait time:

### Recon Phase Setup
```bash
go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest && \
go install github.com/projectdiscovery/naabu/v2/cmd/naabu@latest && \
go install github.com/projectdiscovery/httpx/cmd/httpx@latest && \
go install github.com/projectdiscovery/katana/cmd/katana@latest && \
apk add nmap whois
```

### Vulnerability Scanning Phase Setup
```bash
go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest && \
apk add sqlmap && \
pip install semgrep
```

### Fuzzing Phase Setup
```bash
go install github.com/ffuf/ffuf/v2@latest && \
pip install arjun dirsearch && \
wget -qO /home/pentester/tools/wordlists/common.txt https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/common.txt
```

### Full Setup (all at once)
```bash
go install github.com/projectdiscovery/httpx/cmd/httpx@latest && \
go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest && \
go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest && \
go install github.com/projectdiscovery/naabu/v2/cmd/naabu@latest && \
go install github.com/projectdiscovery/katana/cmd/katana@latest && \
go install github.com/ffuf/ffuf/v2@latest && \
apk add nmap sqlmap whois bind-tools && \
pip install semgrep arjun dirsearch wafw00f httpx requests beautifulsoup4 && \
npm install -g retire js-beautify
```

## Common Mistakes to Avoid

| WRONG | RIGHT |
|-------|-------|
| `apt install nuclei` | `go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest` |
| `pip install nuclei` | nuclei is a Go tool, not Python |
| `npm install nmap` | `apk add nmap` |
| `pip install nmap` | `apk add nmap` |
| `go get github.com/...` | `go install github.com/...@latest` (go get is deprecated for binaries) |
| `apt-get install` | `apk add` (this is Alpine, not Debian/Ubuntu) |
| `yum install` | `apk add` (this is Alpine) |
| `pip3 install nuclei` | nuclei is not a Python package |
| `npm install -g sqlmap` | `apk add sqlmap` |
| `brew install` | brew is not available in the sandbox |
| `docker run` | Docker is not available inside the sandbox |
| `snap install` | snap is not available |
| Inventing package names | Use ONLY the exact commands listed above |

## Tool Selection Guide

| Task | Tool | Install |
|------|------|---------|
| Subdomain enumeration | subfinder | `go install .../subfinder/v2/cmd/subfinder@latest` |
| Port scanning | naabu | `go install .../naabu/v2/cmd/naabu@latest` |
| HTTP probing | httpx | `go install .../httpx/cmd/httpx@latest` |
| Web crawling | katana | `go install .../katana/cmd/katana@latest` |
| Vulnerability scanning | nuclei | `go install .../nuclei/v3/cmd/nuclei@latest` |
| Web fuzzing | ffuf | `go install .../ffuf/v2@latest` |
| SQL injection | sqlmap | `apk add sqlmap` |
| Network scanning | nmap | `apk add nmap` |
| Static analysis | semgrep | `pip install semgrep` |
| Parameter discovery | arjun | `pip install arjun` |
| Directory discovery | dirsearch | `pip install dirsearch` |
| WAF detection | wafw00f | `pip install wafw00f` |
| JS vulnerability scan | retire | `npm install -g retire` |
| JWT testing | jwt_tool | `git clone` (see Binary Downloads above) |
| OOB interaction | interactsh | `go install .../interactsh/cmd/interactsh-client@latest` |
| CVE lookup | cvemap | `go install .../cvemap/cmd/cvemap@latest` |
