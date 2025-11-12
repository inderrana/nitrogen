@echo off
title Build and Run N2 Server in Docker
echo 🐳 Building Docker image for N2 Server...
echo.

REM Build the Docker image
docker build -t n2-server .

if %errorLevel% NEQ 0 (
    echo.
    echo ❌ Docker build failed!
    pause
    exit /b 1
)

echo.
echo ✅ Docker image built successfully!
echo.
echo 🚀 Starting container...
echo.

REM Start the container using docker-compose
docker-compose up -d

if %errorLevel% NEQ 0 (
    echo.
    echo ❌ Failed to start container!
    pause
    exit /b 1
)

echo.
echo ✅ Container started successfully!
echo.
echo 📋 Container Details:
echo    Name: n2-server
echo    Port: 3443 (HTTPS)
echo    Status: Running
echo.
echo 🌐 Access your app:
echo    Local: https://localhost:3443
echo    Network: https://YOUR-IP:3443
echo.
echo 🔧 Docker Commands:
echo    docker ps                    # View running containers
echo    docker logs n2-server        # View logs
echo    docker stop n2-server        # Stop container
echo    docker start n2-server       # Start container
echo    docker-compose down          # Stop and remove container
echo.
pause
