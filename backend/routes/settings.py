import os
from pathlib import Path

from flask import Blueprint, jsonify, request

from backend.config import get_app_config, get_data_dir, save_app_config
from backend.utils.file_utils import list_project_files, read_json

settings_bp = Blueprint('settings', __name__, url_prefix='/api/settings')


@settings_bp.route('', methods=['GET'])
def get_settings():
    return jsonify(get_app_config())


@settings_bp.route('', methods=['POST'])
def update_settings():
    data = request.get_json() or {}
    if 'data_dir' in data and data['data_dir']:
        new_dir = Path(data['data_dir'])
        try:
            new_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            return jsonify({'error': f'Cannot create directory: {e}'}), 400
    result = save_app_config(data)
    return jsonify({'success': True, 'config': result})


@settings_bp.route('/status', methods=['GET'])
def status():
    data_dir = get_data_dir()
    project_files = list_project_files(data_dir)
    total_size = 0
    for pf in project_files:
        try:
            total_size += os.path.getsize(pf)
        except Exception:
            pass
    users_path = Path(data_dir) / 'users.json'
    if users_path.exists():
        total_size += users_path.stat().st_size
    return jsonify({
        'data_dir': data_dir,
        'project_count': len(project_files),
        'disk_used_mb': round(total_size / (1024 * 1024), 3),
    })


@settings_bp.route('/files', methods=['GET'])
def list_files():
    data_dir = get_data_dir()
    project_files = list_project_files(data_dir)
    files = []
    for pf in project_files:
        try:
            stat = os.stat(pf)
            p = read_json(pf)
            files.append({
                'name': Path(pf).name,
                'project_name': p.get('name', ''),
                'size_kb': round(stat.st_size / 1024, 2),
                'modified': stat.st_mtime,
            })
        except Exception:
            pass
    return jsonify({'files': files})
