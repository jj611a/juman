# PostgreSQL Installation Guide (Juman)

Juman requires **PostgreSQL 16** on Windows before you run **Install Juman.exe**.
Juman Setup does **not** install PostgreSQL automatically.

## What you need

- Windows 10/11 x64
- Administrator rights
- The file **Install PostgreSQL.exe** from the Juman release ZIP (official EDB installer)

## Steps

1. Close other installers. Run **Install PostgreSQL.exe** as Administrator.
2. Accept the EDB license and keep the default installation directory under Program Files (`PostgreSQL\16`).
3. Set a strong **postgres** superuser password. Store it offline; you will type it once in the Juman Setup Wizard.
4. Keep port **5432** unless you intentionally change it (then use the same port in the Juman wizard).
5. Complete the installer. Stack Builder is optional and not required for Juman.
6. Open **services.msc** and confirm service **`postgresql-x64-16`** is **Running**.
7. (Optional) From a command prompt:

```bat
"%ProgramFiles%\PostgreSQL\16\bin\psql.exe" -U postgres -c "SELECT version();"
```

## Supported version

Juman’s Windows service depends on **`postgresql-x64-16`**. Major version **16** is required.
If you install 15 or 17 only, the Juman wizard will fail verification with upgrade/install instructions.

## Next

Run **Install Juman.exe** and complete the Setup Wizard.
See **Quick Start.pdf**.
