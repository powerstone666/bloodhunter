---
name: shodan
description: Shodan API usage for reconnaissance and exposed service discovery
---

# Shodan Reconnaissance

## API Key
Use the Shodan API key from environment: `$SHODAN_API_KEY`

## Installation
```bash
pip install shodan
```

## Basic Usage

### Search for exposed services
```bash
shodan search "hostname:target.com" --fields ip_str,port,org,hostnames
```

### Get host information
```bash
shodan host <IP_ADDRESS>
```

### Search for specific technologies
```bash
shodan search "apache 2.4.49 hostname:target.com"
shodan search "nginx hostname:target.com"
shodan search "mysql hostname:target.com"
```

### Find open ports
```bash
shodan search "hostname:target.com" --fields ip_str,port | sort -u
```

### Search for vulnerabilities
```bash
shodan search "hostname:target.com vuln:CVE-2021-44228"
```

## Python API Usage

```python
import shodan
import os

api = shodan.Shodan(os.environ['SHODAN_API_KEY'])

# Search for hosts
results = api.search('hostname:target.com')
for result in results['matches']:
    print(f"{result['ip_str']}:{result['port']} - {result.get('org', 'N/A')}")

# Get specific host info
host = api.host('1.2.3.4')
print(f"Ports: {host['ports']}")
print(f"Vulns: {host.get('vulns', [])}")
```

## Common Queries

### Find admin panels
```bash
shodan search "hostname:target.com http.title:admin"
shodan search "hostname:target.com http.title:login"
```

### Find databases
```bash
shodan search "hostname:target.com product:MySQL"
shodan search "hostname:target.com product:MongoDB"
shodan search "hostname:target.com product:PostgreSQL"
```

### Find development/staging environments
```bash
shodan search "hostname:target.com http.title:staging"
shodan search "hostname:target.com http.title:dev"
shodan search "hostname:target.com http.title:test"
```

### Find exposed services
```bash
shodan search "hostname:target.com port:21"  # FTP
shodan search "hostname:target.com port:22"  # SSH
shodan search "hostname:target.com port:3306"  # MySQL
shodan search "hostname:target.com port:6379"  # Redis
```

## Integration with Workflow

1. **Recon phase**: Use Shodan to discover exposed services and open ports
2. **Enumeration**: Find admin panels, databases, dev environments
3. **Vulnerability search**: Check for known CVEs on discovered services
4. **Prioritization**: Focus on high-value targets (databases, admin panels)

## Important Notes

- Shodan shows INTERNET-EXPOSED services only
- Verify findings manually (ports may be filtered/firewalled)
- Cross-reference with nmap scans for accuracy
- Use for reconnaissance, not exploitation
