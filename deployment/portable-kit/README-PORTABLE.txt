Juman Portable
==============

This ZIP runs without Install Juman.exe and without the JumanApi Windows service.
PostgreSQL must already be installed and running on this PC.

Quick start
-----------
1. Install PostgreSQL 16 (service postgresql-x64-16 Running).
2. Create database/user (example):
     CREATE USER juman_app WITH PASSWORD 'change-me';
     CREATE DATABASE juman OWNER juman_app;
3. Copy config\juman.env.example -> config\juman.env
4. Edit DATABASE_URL / SECRET_KEY / bootstrap password in juman.env
5. (Optional first time) run:
     backend\juman-api.exe migrate
6. Double-click "Start Juman Portable.cmd"

Notes
-----
- portable.marker tells the desktop app to use this folder (not Program Files).
- Double-clicking Juman.exe also auto-starts the API when the marker is present.
- First-run / login secrets still use Windows user AppData (not fully self-contained).
- This build is for lab/demo. Production store installs should use the NSIS Setup + WinSW release kit.