@echo off
REM Bump version, commit, tag, push. CI does the rest.
REM Usage:   release.bat 1.0.6
REM Or double-click and you'll be prompted for the version.

cd /d "%~dp0"

if "%~1"=="" (
    set /p RELEASE_VERSION="New version (e.g. 1.0.6): "
) else (
    set "RELEASE_VERSION=%~1"
)

node scripts\release.js "%RELEASE_VERSION%"
set EXITCODE=%errorlevel%

echo.
echo Press any key to close...
pause >nul
exit /b %EXITCODE%
