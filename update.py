#!/usr/bin/env python3

import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG_JS = ROOT / "js" / "config.js"
SW_JS = ROOT / "sw.js"
README_MD = ROOT / "README.md"


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


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
    safe_date = new_date.replace("-", ".").replace(" ", "-")
    cache_name = f"BliForest-{safe_version}-{safe_date}"
    content = SW_JS.read_text(encoding="utf-8")
    content = replace_required(
        content,
        r'(const CACHE_NAME\s*=\s*CACHE_PREFIX\s*\+\s*)"[^"]+"',
        rf'\g<1>"{cache_name}"',
        "CACHE_NAME",
    )
    SW_JS.write_text(content, encoding="utf-8")


def update_readme(new_version, new_date):
    if not README_MD.exists():
        return

    content = README_MD.read_text(encoding="utf-8")

    content = replace_required(
        content,
        r'(\*\*Versi\*\*\s*\|\s*`)[^`]+(`)',
        rf'\g<1>{new_version}\g<2>',
        "versi README",
    )

    formatted_date = format_date_badge(new_date)
    content = replace_required(
        content,
        r'(\*\*Terakhir Diperbarui\*\*\s*\|\s*`)[^`]+(`)',
        rf'\g<1>{formatted_date}\g<2>',
        "tanggal README",
    )

    safe_version = re.sub(r"[^a-zA-Z0-9._-]+", "-", new_version).strip("-") or "app"
    safe_date = new_date.replace("-", ".").replace(" ", "-")
    cache_name = f"BliForest-{safe_version}-{safe_date}"
    content = replace_required(
        content,
        r'(\*\*Cache\*\*\s*\|\s*`)[^`]+(`)',
        rf'\g<1>{cache_name}\g<2>',
        "cache README",
    )

    README_MD.write_text(content, encoding="utf-8")


def format_date_badge(date_str):
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M")
        bulan = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                 "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
        return f"{dt.day:02d} {bulan[dt.month]} {dt.year}, {dt.hour:02d}.{dt.minute:02d} WIB"
    except ValueError:
        return date_str


def format_date(date_str):
    if not date_str:
        return "Belum ada"
    try:
        dt = datetime.fromisoformat(date_str)
        return dt.strftime("%d %B %Y, %H:%M") + " WIB"
    except (ValueError, AttributeError):
        return date_str


def main():
    current_version, current_date = read_current_version()

    print("Update Versi BliForest")
    print("=" * 40)
    print()
    print(f"Versi saat ini   : {current_version}")
    print(f"Tanggal update   : {format_date(current_date)}")
    print()

    if len(sys.argv) > 1:
        new_version = sys.argv[1]
    else:
        new_version = input(f"Masukkan versi baru [{current_version}]: ").strip()
        if not new_version:
            new_version = current_version

    new_date = now()

    print()
    print(f"Versi baru       : {new_version}")
    print(f"Tanggal update   : {new_date}")
    print()

    confirm = input("Konfirmasi update? (y/n): ").strip().lower()
    if confirm not in ("y", "yes"):
        print("Update dibatalkan.")
        sys.exit(0)

    print("Memperbarui file...")

    try:
        update_config_js(new_version, new_date)
        update_service_worker(new_version, new_date)
        update_readme(new_version, new_date)
        print("Update selesai!")
    except Exception as e:
        print(f"Gagal update: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
