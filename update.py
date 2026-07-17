#!/usr/bin/env python3

import re
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG_JS = ROOT / "js" / "config.js"
SW_JS = ROOT / "sw.js"


def today():
    return date.today().isoformat()


def read_current_version():
    content = CONFIG_JS.read_text(encoding="utf-8")
    version_match = re.search(r'window\.APP_VERSION\s*=\s*["\']([^"\']+)["\']', content)
    version = version_match.group(1) if version_match else "1.0.0"
    date_match = re.search(r'window\.APP_UPDATED_AT\s*=\s*["\']([^"\']+)["\']', content)
    date_str = date_match.group(1) if date_match else ""
    return version, date_str


def replace_required(content, pattern, replacement, label):
    updated, count = re.subn(pattern, replacement, content, count=1)
    if count != 1:
        raise RuntimeError(f"Tidak dapat memperbarui {label}.")
    return updated


def update_config_js(new_version, new_date):
    content = CONFIG_JS.read_text(encoding="utf-8")
    content = replace_required(
        content,
        r'(window\.APP_VERSION\s*=\s*["\'])[^"\']+(["\'])',
        rf'\g<1>{new_version}\g<2>',
        "APP_VERSION",
    )
    content = replace_required(
        content,
        r'(window\.APP_UPDATED_AT\s*=\s*["\'])[^"\']+(["\'])',
        rf'\g<1>{new_date}\g<2>',
        "APP_UPDATED_AT",
    )
    CONFIG_JS.write_text(content, encoding="utf-8")


def update_service_worker(new_version, new_date):
    safe_version = re.sub(r"[^a-zA-Z0-9._-]+", "-", new_version).strip("-") or "app"
    safe_date = new_date.replace("-", ".")
    cache_name = f"klem-kayu-app-{safe_version}-{safe_date}"
    content = SW_JS.read_text(encoding="utf-8")
    content = replace_required(
        content,
        r'(CACHE_NAME\s*=\s*["\'])[^"\']+(["\'])',
        rf'\g<1>{cache_name}\g<2>',
        "CACHE_NAME",
    )
    SW_JS.write_text(content, encoding="utf-8")


def ask_input(prompt, default, previous=""):
    if previous:
        prompt_display = f"{prompt} [{previous}]: "
    else:
        prompt_display = f"{prompt}: "
    user_input = input(prompt_display).strip()
    if not user_input:
        return default
    return user_input


def format_date(date_str):
    if not date_str:
        return "Belum ada"
    try:
        dt = datetime.fromisoformat(date_str.replace("+07:00", "+07:00"))
        return dt.strftime("%d %B %Y, %H:%M") + " WIB"
    except (ValueError, AttributeError):
        return date_str


def main():
    current_version, current_date = read_current_version()

    print("==================================================")
    print("  Update Versi BliForest")
    print("==================================================")
    print()
    print(f"  Versi saat ini  : {current_version}")
    print(f"  Tanggal update   : {format_date(current_date)}")
    print()
    print("-" * 50)

    if len(sys.argv) > 1:
        new_version = sys.argv[1]
    else:
        new_version = ask_input("  Masukkan versi baru", current_version, current_version)

    if len(sys.argv) > 2:
        new_date = sys.argv[2]
    else:
        default_date = today()
        new_date = ask_input("  Masukkan tanggal (YYYY-MM-DD)", default_date, default_date)

    try:
        datetime.strptime(new_date, "%Y-%m-%d")
    except ValueError:
        print()
        print("  Format tanggal harus YYYY-MM-DD, contoh: 2026-08-01")
        sys.exit(1)

    print()
    print("-" * 50)
    print(f"  Versi baru  : {new_version}")
    print(f"  Tanggal baru: {new_date}")
    print("-" * 50)

    confirm = input("  Konfirmasi update? (y/n): ").strip().lower()
    if confirm not in ("y", "yes"):
        print()
        print("  Update dibatalkan.")
        sys.exit(0)

    print()
    print("  Memperbarui file...")

    try:
        update_config_js(new_version, new_date)
        update_service_worker(new_version, new_date)
        print()
        print("  Update selesai!")
        print()
        print("  File yang diperbarui:")
        print(f"    js/config.js    -> versi {new_version}, {new_date}")
        print(f"    sw.js           -> cache name")
        print()
    except Exception as e:
        print()
        print(f"  Gagal update: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
