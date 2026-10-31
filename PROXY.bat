@echo off
title Ollama Messages Gateway
echo Basliyor... Erisim yontemi (yerel / bulut) panelden secilir.
node "%~dp0anthropic-proxy.js" %*
pause
