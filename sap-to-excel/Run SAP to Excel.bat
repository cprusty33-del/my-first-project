@echo off
cd /d "%~dp0"
python sap_to_excel.py %*
echo.
pause
