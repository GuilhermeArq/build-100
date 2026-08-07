@echo off
title GUIA - Servidor Local TCC
cd /d "%~dp0"
echo Iniciando o site do TCC...
powershell -ExecutionPolicy Bypass -File "%~dp0servidor.ps1"
pause
