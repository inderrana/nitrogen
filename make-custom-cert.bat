@echo off
title Create Custom SSL Certificate with Git OpenSSL

echo 🔒 Creating custom SSL certificate with your details...
echo.

REM Set Git OpenSSL path directly
set "OPENSSL=C:\Program Files\Git\usr\bin\openssl.exe"

REM Test OpenSSL
echo ✅ Testing OpenSSL...
"%OPENSSL%" version
if %ERRORLEVEL% NEQ 0 (
    echo ❌ OpenSSL test failed!
    pause
    exit /b 1
)

echo.

REM Get certificate details (pre-filled with your previous values)
set "COUNTRY=Blah"
set "STATE=Yeah" 
set "CITY=Sure"
set "ORG=Nitrogen"
set "OU=One"
set "CN=localhost"

echo 📋 Creating certificate with these details:
echo    Country: %COUNTRY%
echo    State: %STATE%
echo    City: %CITY%
echo    Organization: %ORG%
echo    Organizational Unit: %OU%
echo    Common Name: %CN%
echo.

REM Create directories
if not exist "ssl\ca" mkdir "ssl\ca"

REM Create CA configuration
echo 📝 Creating CA configuration...
echo [req] > ssl\ca\ca.cnf
echo default_bits = 2048 >> ssl\ca\ca.cnf
echo prompt = no >> ssl\ca\ca.cnf
echo distinguished_name = req_distinguished_name >> ssl\ca\ca.cnf
echo x509_extensions = v3_ca >> ssl\ca\ca.cnf
echo. >> ssl\ca\ca.cnf
echo [req_distinguished_name] >> ssl\ca\ca.cnf
echo C = %COUNTRY% >> ssl\ca\ca.cnf
echo ST = %STATE% >> ssl\ca\ca.cnf
echo L = %CITY% >> ssl\ca\ca.cnf
echo O = %ORG% >> ssl\ca\ca.cnf
echo OU = %OU% >> ssl\ca\ca.cnf
echo CN = %CN% >> ssl\ca\ca.cnf
echo. >> ssl\ca\ca.cnf
echo [v3_ca] >> ssl\ca\ca.cnf
echo subjectKeyIdentifier = hash >> ssl\ca\ca.cnf
echo authorityKeyIdentifier = keyid:always,issuer >> ssl\ca\ca.cnf
echo basicConstraints = critical,CA:true >> ssl\ca\ca.cnf
echo keyUsage = critical, digitalSignature, cRLSign, keyCertSign >> ssl\ca\ca.cnf

REM Generate CA private key
echo 🔑 Generating CA private key...
"%OPENSSL%" genrsa -out ssl\ca\ca-key.pem 2048

REM Generate CA certificate
echo 📜 Generating CA certificate...
"%OPENSSL%" req -new -x509 -days 3650 -key ssl\ca\ca-key.pem -out ssl\ca\ca-cert.pem -config ssl\ca\ca.cnf -extensions v3_ca

REM Create server certificate configuration
echo 📝 Creating server certificate configuration...
echo [req] > ssl\server.cnf
echo default_bits = 2048 >> ssl\server.cnf
echo prompt = no >> ssl\server.cnf
echo distinguished_name = req_distinguished_name >> ssl\server.cnf
echo req_extensions = v3_req >> ssl\server.cnf
echo. >> ssl\server.cnf
echo [req_distinguished_name] >> ssl\server.cnf
echo C = %COUNTRY% >> ssl\server.cnf
echo ST = %STATE% >> ssl\server.cnf
echo L = %CITY% >> ssl\server.cnf
echo O = %ORG% >> ssl\server.cnf
echo OU = %OU% >> ssl\server.cnf
echo CN = localhost >> ssl\server.cnf
echo. >> ssl\server.cnf
echo [v3_req] >> ssl\server.cnf
echo basicConstraints = CA:FALSE >> ssl\server.cnf
echo keyUsage = nonRepudiation, digitalSignature, keyEncipherment >> ssl\server.cnf
echo extendedKeyUsage = serverAuth >> ssl\server.cnf
echo subjectAltName = @alt_names >> ssl\server.cnf
echo. >> ssl\server.cnf
echo [alt_names] >> ssl\server.cnf
echo DNS.1 = localhost >> ssl\server.cnf
echo DNS.2 = *.localhost >> ssl\server.cnf
echo DNS.3 = %COMPUTERNAME% >> ssl\server.cnf
echo DNS.4 = %COMPUTERNAME%.local >> ssl\server.cnf
echo IP.1 = 127.0.0.1 >> ssl\server.cnf
echo IP.2 = ::1 >> ssl\server.cnf

REM Generate server private key
echo 🔑 Generating server private key...
"%OPENSSL%" genrsa -out ssl\key.pem 2048

REM Generate server certificate request
echo 📋 Generating certificate signing request...
"%OPENSSL%" req -new -key ssl\key.pem -out ssl\server.csr -config ssl\server.cnf

REM Sign server certificate with CA
echo ✍️ Signing server certificate with custom CA...
"%OPENSSL%" x509 -req -in ssl\server.csr -CA ssl\ca\ca-cert.pem -CAkey ssl\ca\ca-key.pem -CAcreateserial -out ssl\cert.pem -days 365 -extensions v3_req -extfile ssl\server.cnf

REM Install CA certificate to Windows trust store
echo 🔐 Installing CA certificate to Windows trust store...
certutil -addstore -f "ROOT" ssl\ca\ca-cert.pem

if %ERRORLEVEL% EQU 0 (
    echo.
    echo 🎉 Custom SSL certificate created and installed successfully!
    echo.
    echo 📁 Files created:
    echo    ssl\cert.pem     - Server certificate (%ORG% - %OU%)
    echo    ssl\key.pem      - Server private key
    echo    ssl\ca\ca-cert.pem - Custom Certificate Authority (%CN%)
    echo.
    echo 🔍 Certificate details:
    echo    Organization: %ORG%
    echo    Organizational Unit: %OU%
    echo    Issued by: %CN%
    echo    Country: %COUNTRY%
    echo    State: %STATE%
    echo    City: %CITY%
    echo.
    echo 🌐 Your server will work at https://localhost:3443 WITHOUT warnings!
    echo 🚀 Run: start-https.bat
    echo.
    
    REM Clean up temporary files
    del ssl\server.csr >nul 2>&1
) else (
    echo.
    echo ❌ Failed to install CA certificate
    echo 💡 Make sure you ran this as Administrator
    echo.
)

pause