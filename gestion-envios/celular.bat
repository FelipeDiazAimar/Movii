@echo off
rem Abre la app del repartidor en el celular con Expo Go.
rem Doble clic = pregunta. Directo: celular.bat prod wifi  /  celular.bat prod tunel  /  celular.bat local
chcp 65001 >nul
cd /d "%~dp0"
title Movii - app en el celular

where node >nul 2>nul || (echo Falta Node.js: instalarlo desde https://nodejs.org & pause & exit /b 1)

if not exist "apps\mobile\node_modules" (
  echo Instalando las dependencias de la app ^(una sola vez^)...
  call npm --prefix apps\mobile install || (echo Fallo la instalacion. & pause & exit /b 1)
)

node scripts\celular.mjs %*
pause
