import json
import os
from pathlib import Path


def read_json(path) -> dict | list:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except Exception:
        return {}


def write_json(path, data) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def safe_filename(name: str) -> str:
    """Return a safe file-system name, preventing path traversal."""
    return os.path.basename(str(name)).replace('..', '').strip()


def ensure_dir(path) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def list_project_files(data_dir: str) -> list[str]:
    projects_dir = Path(data_dir) / 'projects'
    if not projects_dir.exists():
        return []
    return [str(p) for p in sorted(projects_dir.glob('*.json'))]
