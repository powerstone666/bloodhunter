---
name: mail-tm
description: mail.tm API usage for email testing, account registration, and password reset testing
---

# mail.tm - Temporary Email API

## Purpose
Use mail.tm to:
- Register accounts with temporary emails
- Test password reset flows
- Test email verification flows
- Capture OTP codes and reset links

## API Base URL
`https://api.mail.tm`

## Workflow

### 1. Get available domains
```bash
curl -s https://api.mail.tm/domains | jq '.["hydra:member"][0].domain'
```

### 2. Create account
```bash
DOMAIN=$(curl -s https://api.mail.tm/domains | jq -r '.["hydra:member"][0].domain')
EMAIL="testuser123@$DOMAIN"
PASSWORD="SecurePass123!"

curl -X POST https://api.mail.tm/accounts \
  -H "Content-Type: application/json" \
  -d "{
    \"address\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }"
```

### 3. Get auth token
```bash
TOKEN=$(curl -X POST https://api.mail.tm/token \
  -H "Content-Type: application/json" \
  -d "{
    \"address\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }" | jq -r '.token')
```

### 4. Check inbox
```bash
curl -s https://api.mail.tm/messages \
  -H "Authorization: Bearer $TOKEN" | jq '.["hydra:member"]'
```

### 5. Read specific message
```bash
MESSAGE_ID=$(curl -s https://api.mail.tm/messages \
  -H "Authorization: Bearer $TOKEN" | jq -r '.["hydra:member"][0].id')

curl -s https://api.mail.tm/messages/$MESSAGE_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.text'
```

## Python Script

```python
import requests
import time
import re

class MailTM:
    def __init__(self):
        self.base_url = "https://api.mail.tm"
        self.token = None
        self.email = None
        
    def get_domain(self):
        response = requests.get(f"{self.base_url}/domains")
        return response.json()["hydra:member"][0]["domain"]
    
    def create_account(self, username=None):
        domain = self.get_domain()
        if not username:
            username = f"test{int(time.time())}"
        
        self.email = f"{username}@{domain}"
        password = "SecurePass123!"
        
        response = requests.post(
            f"{self.base_url}/accounts",
            json={"address": self.email, "password": password}
        )
        
        if response.status_code == 201:
            self.password = password
            return self.email
        return None
    
    def get_token(self):
        response = requests.post(
            f"{self.base_url}/token",
            json={"address": self.email, "password": self.password}
        )
        if response.status_code == 200:
            self.token = response.json()["token"]
            return self.token
        return None
    
    def get_messages(self):
        if not self.token:
            self.get_token()
        
        response = requests.get(
            f"{self.base_url}/messages",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        return response.json().get("hydra:member", [])
    
    def wait_for_email(self, timeout=60, check_interval=2):
        start_time = time.time()
        while time.time() - start_time < timeout:
            messages = self.get_messages()
            if messages:
                return messages[0]
            time.sleep(check_interval)
        return None
    
    def extract_otp(self, email_content):
        # Common OTP patterns
        patterns = [
            r'\b\d{6}\b',  # 6-digit OTP
            r'\b\d{4}\b',  # 4-digit OTP
            r'code[:\s]+(\d+)',
            r'OTP[:\s]+(\d+)',
            r'verification[:\s]+(\d+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, email_content, re.IGNORECASE)
            if match:
                return match.group(1) if match.lastindex else match.group(0)
        return None
    
    def extract_reset_link(self, email_content):
        # Common reset link patterns
        patterns = [
            r'(https?://[^\s]+/reset[^\s]*)',
            r'(https?://[^\s]+/password[^\s]*)',
            r'(https?://[^\s]+/verify[^\s]*)',
            r'(https?://[^\s]+token=[^\s]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, email_content, re.IGNORECASE)
            if match:
                return match.group(1)
        return None

# Usage example
mail = MailTM()
email = mail.create_account()
print(f"Created email: {email}")

# Register on target site with this email
# ...

# Wait for verification email
email_data = mail.wait_for_email()
if email_data:
    otp = mail.extract_otp(email_data.get("text", ""))
    reset_link = mail.extract_reset_link(email_data.get("text", ""))
    print(f"OTP: {otp}")
    print(f"Reset link: {reset_link}")
```

## Testing Password Reset Flow

```bash
# 1. Create email
EMAIL="resettest@$(curl -s https://api.mail.tm/domains | jq -r '.["hydra:member"][0].domain')"

# 2. Register account on target (manual or via API)

# 3. Trigger password reset
curl -X POST https://target.com/api/forgot-password \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\"}"

# 4. Get token for mail.tm
TOKEN=$(curl -X POST https://api.mail.tm/token \
  -H "Content-Type: application/json" \
  -d "{\"address\": \"$EMAIL\", \"password\": \"SecurePass123!\"}" | jq -r '.token')

# 5. Wait and check for reset email
sleep 5
curl -s https://api.mail.tm/messages \
  -H "Authorization: Bearer $TOKEN" | jq '.["hydra:member"][0].text'
```

## Integration with Workflow

1. **Account registration**: Use mail.tm emails to register multiple test accounts
2. **Email verification**: Capture verification codes/links automatically
3. **Password reset testing**: Test reset flows and capture reset tokens
4. **OTP bypass testing**: Check if OTPs are predictable or reusable
5. **Email enumeration**: Test if system reveals whether email exists

## Important Notes

- mail.tm emails are temporary (deleted after some time)
- Use unique usernames for each test
- Some sites block temporary email domains
- Always check inbox within 60 seconds of triggering email
- Extract OTPs/links programmatically for automation
