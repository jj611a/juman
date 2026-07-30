"""Unit tests for env generator / uninstall retention / migrate CLI parsing."""

from pathlib import Path
import sys

from generate_env import (
    EnvGenInput,
    build_database_url,
    generate_install_secrets,
    patch_juman_env,
    render_juman_env,
    uninstall_should_drop_database,
    uninstall_should_preserve_storage,
    write_juman_env,
)


def test_build_database_url_encodes_password():
    url = build_database_url(
        EnvGenInput(install_root=Path("C:/Program Files/Juman"), db_password="a@b")
    )
    assert "a%40b" in url
    assert url.startswith("postgresql+asyncpg://")


def test_render_contains_bootstrap_and_storage(tmp_path: Path):
    text = render_juman_env(EnvGenInput(install_root=tmp_path, company_name="Acme"))
    assert "IDENTITY_BOOTSTRAP_USERNAME=admin" in text
    assert "MEDIA_STORAGE_ROOT=" in text
    assert "APP_ENV=production" in text
    assert "SECRET_KEY=" in text
    assert "JUMAN_TIMEZONE=Asia/Baghdad" in text
    assert "JUMAN_LANGUAGE=ar" in text


def test_write_juman_env(tmp_path: Path):
    out = write_juman_env(EnvGenInput(install_root=tmp_path))
    assert out.is_file()
    assert "DATABASE_URL=" in out.read_text(encoding="utf-8")


def test_patch_juman_env(tmp_path: Path):
    path = write_juman_env(EnvGenInput(install_root=tmp_path))
    patch_juman_env(path, {"JUMAN_COMPANY_NAME": "Shop", "JUMAN_LANGUAGE": "ar"})
    text = path.read_text(encoding="utf-8")
    assert "JUMAN_COMPANY_NAME=Shop" in text


def test_uninstall_retention_policy():
    assert uninstall_should_drop_database(retain_database=True) is False
    assert uninstall_should_drop_database(retain_database=False) is True
    assert uninstall_should_preserve_storage(True) is True
    assert uninstall_should_preserve_storage(False) is False


def test_generate_install_secrets_unique():
    a = generate_install_secrets()
    b = generate_install_secrets()
    assert a["secret_key"] and a["db_password"]
    assert a["secret_key"] != b["secret_key"]


def test_migrate_cli_dispatch(monkeypatch):
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import run_api

    called = {"migrate": False}

    def fake_migrate(root=None):
        called["migrate"] = True
        return 0

    monkeypatch.setattr(run_api, "run_migrate", fake_migrate)
    monkeypatch.setattr(run_api, "run_server", lambda root=None: (_ for _ in ()).throw(RuntimeError("server")))
    try:
        run_api.main(["migrate"])
    except SystemExit as exc:
        assert exc.code == 0
    assert called["migrate"] is True