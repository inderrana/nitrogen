@echo off
title Stop N2 Server Docker Container
echo 🛑 Stopping N2 Server container...
echo.

docker-compose down

if %errorLevel% EQU 0 (
    echo.
    echo ✅ Container stopped and removed successfully!
    echo.
) else (
    echo.
    echo ⚠️  Failed to stop container
    echo.
)

pause
