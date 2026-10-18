@echo off
cd /d "%~dp0"
set "SCHOOL_NODE=node"
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "SCHOOL_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%SCHOOL_NODE%" --use-env-proxy --env-file-if-exists=.env server.mjs
pause

