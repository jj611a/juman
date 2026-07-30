# -*- mode: python ; coding: utf-8 -*-
# Build from repo root:
#   pyinstaller deployment/backend/juman-api.spec --noconfirm

from PyInstaller.building.build_main import Analysis, PYZ, EXE
from PyInstaller.utils.hooks import collect_submodules

import sys
from pathlib import Path

SPECDIR = Path(SPECPATH).resolve()
REPO = SPECDIR.parents[1]
BACKEND = REPO / "backend"
DEPLOY_BACKEND = SPECDIR

sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(DEPLOY_BACKEND))

a = Analysis(
    [str(DEPLOY_BACKEND / "run_api.py")],
    pathex=[str(BACKEND), str(DEPLOY_BACKEND)],
    binaries=[],
    datas=[
        (str(BACKEND / "alembic"), "alembic"),
        (str(BACKEND / "alembic.ini"), "."),
        (str(BACKEND / "app"), "app"),
    ],
    hiddenimports=[
        "asyncpg",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "wait_for_db",
        "app.main",
    ] + collect_submodules("app"),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="juman-api",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
)