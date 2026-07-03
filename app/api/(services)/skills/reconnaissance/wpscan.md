---
name: wpscan
description: WPScan usage for WordPress vulnerability scanning and enumeration
---

# WPScan - WordPress Security Scanner

## API Key
Use the WPScan API key from environment: `$WPSCAN_API_KEY`

## Installation
```bash
gem install wpscan
```

## Basic Usage

### Scan WordPress site
```bash
wpscan --url https://target.com --api-token $WPSCAN_API_KEY
```

### Enumerate users
```bash
wpscan --url https://target.com --enumerate u --api-token $WPSCAN_API_KEY
```

### Enumerate plugins
```bash
wpscan --url https://target.com --enumerate ap --api-token $WPSCAN_API_KEY
```

### Enumerate themes
```bash
wpscan --url https://target.com --enumerate at --api-token $WPSCAN_API_KEY
```

### Full enumeration
```bash
wpscan --url https://target.com --enumerate u,ap,at,tt,cb,dbe --api-token $WPSCAN_API_KEY
```

## Enumeration Options

- `u` - Users
- `ap` - All plugins
- `vp` - Vulnerable plugins
- `at` - All themes
- `vt` - Vulnerable themes
- `tt` - Timthumbs
- `cb` - Config backups
- `dbe` - Database exports

## Advanced Options

### Aggressive detection
```bash
wpscan --url https://target.com --api-token $WPSCAN_API_KEY --force --random-user-agent
```

### Specific plugin check
```bash
wpscan --url https://target.com --plugins-detection aggressive --api-token $WPSCAN_API_KEY
```

### Password brute force
```bash
wpscan --url https://target.com --usernames admin,user --passwords /path/to/wordlist.txt --api-token $WPSCAN_API_KEY
```

### Output to file
```bash
wpscan --url https://target.com --api-token $WPSCAN_API_KEY --output scan_results.json --format json
```

## Common Vulnerabilities Found

### Plugin vulnerabilities
- SQL injection in plugin parameters
- XSS in plugin output
- File upload vulnerabilities
- Privilege escalation

### Theme vulnerabilities
- XSS in theme files
- File inclusion
- Code execution

### Core vulnerabilities
- User enumeration
- XML-RPC abuse
- REST API exposure
- Default credentials

## Integration with Workflow

1. **Detection phase**: Confirm WordPress is in use
2. **Enumeration**: Discover users, plugins, themes
3. **Vulnerability scan**: Check for known CVEs
4. **Manual testing**: Verify findings and test for custom vulnerabilities
5. **Exploitation**: Use discovered vulnerabilities (with authorization)

## Important Notes

- WPScan requires API token for vulnerability database access
- Free tier has limited requests per day
- Always verify plugin/theme versions manually
- Cross-reference with manual inspection of wp-content/plugins/
- Use for authorized testing only

## Example Workflow

```bash
# 1. Basic scan
wpscan --url https://target.com --api-token $WPSCAN_API_KEY --output scan.json --format json

# 2. Enumerate users
wpscan --url https://target.com --enumerate u --api-token $WPSCAN_API_KEY

# 3. Check for vulnerable plugins
wpscan --url https://target.com --enumerate vp --api-token $WPSCAN_API_KEY

# 4. Manual verification
curl https://target.com/wp-content/plugins/plugin-name/readme.txt
```
