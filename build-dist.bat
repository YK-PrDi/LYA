@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul

rem ============================================================
rem  LY-Automation 一键打包（内嵌 JRE + 便携 node + Chromium）
rem  产物：dist-electron\*.exe（安装包）
rem  前置：tools\node\node.exe、tools\node_modules、tools\browsers 已就位
rem        electron\node_modules 已 npm install
rem ============================================================

cd /d "%~dp0"

echo ============================================================
echo  LY-Automation build
echo ============================================================
echo.

rem ---- 1/6 clean ----
echo [1/6] cleaning dist / dist-electron / target ...
if exist "dist-electron" rd /s /q "dist-electron"
if exist "target"        rd /s /q "target"
if exist "dist\app.jar"  del /q  "dist\app.jar"
if exist "dist\frontend" rd /s /q "dist\frontend"
if not exist "dist" mkdir "dist"

rem ---- 2/6 Maven build ----
echo [2/6] Maven build (clean package -DskipTests) ...
where mvn > nul 2>&1
if errorlevel 1 ( echo  [ERROR] mvn not on PATH. & pause & exit /b 1 )
call mvn clean package -DskipTests -q
if errorlevel 1 ( echo  [ERROR] Maven build failed. & pause & exit /b 1 )

set "APP_JAR="
for %%f in (target\ly-automation-*.jar) do (
    set "FN=%%~nxf"
    rem 排除 spring repackage 生成的 *.jar.original
    echo !FN! | findstr /E ".original" > nul || set "APP_JAR=%%f"
)
if not defined APP_JAR ( echo  [ERROR] fat jar not found. & pause & exit /b 1 )
echo        artifact: !APP_JAR!

rem ---- 3/6 copy jar + frontend ----
echo [3/6] copying app.jar + frontend to dist\ ...
copy /Y "!APP_JAR!" "dist\app.jar" > nul
mkdir "dist\frontend"
xcopy /Y /I /E /Q "frontend\*" "dist\frontend\" > nul

rem ---- 4/6 verify tools (node / node_modules / browsers) ----
echo [4/6] verifying bundled tools ...
if not exist "tools\node\node.exe" ( echo  [ERROR] tools\node\node.exe missing. & pause & exit /b 1 )
if not exist "tools\node_modules\playwright" ( echo  [ERROR] tools\node_modules\playwright missing. Run npm install in tools\. & pause & exit /b 1 )
dir /b "tools\browsers\chromium-*" > nul 2>&1
if errorlevel 1 ( echo  [ERROR] tools\browsers Chromium missing. Run: cd tools ^&^& npx playwright install chromium & pause & exit /b 1 )
echo        node.exe / playwright / chromium OK

rem ---- 5/6 embedded JRE (jlink) ----
if exist "dist\runtime\bin\java.exe" (
    echo [5/6] reusing existing dist\runtime
    goto after_jre
)
echo [5/6] jlink embedded JRE ...
set "JDK_HOME="
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\jlink.exe" set "JDK_HOME=%JAVA_HOME%"
if "%JDK_HOME%"=="" (
    for /d %%d in ("%USERPROFILE%\.jdks\*") do (
        if exist "%%d\bin\jlink.exe" ( set "JDK_HOME=%%d" & goto jdk_found )
    )
)
:jdk_found
if "%JDK_HOME%"=="" ( echo  [ERROR] no JDK with jlink. Set JAVA_HOME. & pause & exit /b 1 )
echo        using JDK: %JDK_HOME%
if exist "dist\runtime" rd /s /q "dist\runtime"
"%JDK_HOME%\bin\jlink.exe" --module-path "%JDK_HOME%\jmods" --add-modules ALL-MODULE-PATH --no-header-files --no-man-pages --compress=2 --output "dist\runtime"
if errorlevel 1 ( echo  [ERROR] jlink failed. & pause & exit /b 1 )
"dist\runtime\bin\java.exe" -version
:after_jre

rem ---- 6/6 electron-builder ----
echo [6/6] packaging Electron (electron-builder --win) ...
if not exist "electron\node_modules\.bin\electron-builder.cmd" (
    echo  [ERROR] electron\node_modules missing. Run npm install in electron\. & pause & exit /b 1
)
pushd electron
set "CSC_IDENTITY_AUTO_DISCOVERY=false"
call node_modules\.bin\electron-builder.cmd --win
set "EB_ERR=%errorlevel%"
popd
if not "%EB_ERR%"=="0" ( echo  [ERROR] electron-builder failed (%EB_ERR%). & pause & exit /b %EB_ERR% )

echo.
echo ============================================================
echo  Build complete:
for %%f in (dist-electron\*.exe) do echo    dist-electron\%%~nxf
echo ============================================================
endlocal
