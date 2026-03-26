import os
import json
from pathlib import Path

_BASE_DIR = Path(__file__).parent.parent


def _resolve_data_dir_from_env():
    return os.environ.get('DATA_DIR', str(_BASE_DIR / 'data'))


def _resolve_data_dir():
    # Try reading app_config.json from the default data directory
    default_data = Path(_resolve_data_dir_from_env())
    config_path = default_data / 'app_config.json'
    if config_path.exists():
        try:
            with open(config_path, encoding='utf-8') as f:
                cfg = json.load(f)
            data_dir = cfg.get('data_dir', '')
            if data_dir:
                p = Path(data_dir)
                if p.is_absolute() and p.exists():
                    return str(p)
        except Exception:
            pass
    return str(default_data)


def get_data_dir() -> str:
    data_dir = _resolve_data_dir()
    path = Path(data_dir)
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


def get_app_config() -> dict:
    data_dir = get_data_dir()
    config_path = Path(data_dir) / 'app_config.json'
    defaults = {
        'data_dir': data_dir,
        'ai_response_language': 'English',
        'theme': 'dark',
    }
    if config_path.exists():
        try:
            with open(config_path, encoding='utf-8') as f:
                stored = json.load(f)
            defaults.update(stored)
        except Exception:
            pass
    return defaults


def save_app_config(updates: dict) -> dict:
    data_dir = get_data_dir()
    config_path = Path(data_dir) / 'app_config.json'
    current = get_app_config()
    current.update(updates)
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(current, f, indent=2)
    return current


def is_ai_available() -> bool:
    return bool(os.environ.get('AZURE_OPENAI_API_KEY') or os.environ.get('OPENAI_API_KEY'))


def get_azure_openai_client():
    try:
        from openai import AzureOpenAI
    except ImportError:
        return None
    api_key = os.environ.get('AZURE_OPENAI_API_KEY') or os.environ.get('OPENAI_API_KEY')
    endpoint = os.environ.get('ENDPOINT_URL')
    api_version = os.environ.get('API_VERSION', '2024-02-01')
    if not api_key or not endpoint:
        return None
    return AzureOpenAI(api_key=api_key, azure_endpoint=endpoint, api_version=api_version)
