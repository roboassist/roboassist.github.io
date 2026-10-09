@echo off
setlocal
cd /d "%~dp0"
echo RoboAssist preview requires byte-range support for video seeking.
echo Open http://127.0.0.1:8000/#video after the server starts.
echo If port 8000 is busy, close the old preview terminal first.
python tools\preview.py --port 8000
if errorlevel 1 pause
