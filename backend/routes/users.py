import random
import string
from datetime import datetime, timezone
from pathlib import Path

from flask import Blueprint, jsonify, request

from backend.config import get_data_dir
from backend.utils.file_utils import read_json, write_json

users_bp = Blueprint('users', __name__, url_prefix='/api/users')


def _users_path() -> Path:
    return Path(get_data_dir()) / 'users.json'


def _load_users() -> list:
    data = read_json(_users_path())
    return data if isinstance(data, list) else []


def _save_users(users: list) -> None:
    write_json(_users_path(), users)


def _rand(k=5) -> str:
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=k))


@users_bp.route('', methods=['GET'])
def list_users():
    users = _load_users()
    meta = [
        {'id': u['id'], 'name': u['name'], 'has_pin': bool(u.get('pin')),
         'project_count': len(u.get('projects', []))}
        for u in users
    ]
    return jsonify({'users': meta})


@users_bp.route('', methods=['POST'])
def create_user():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    users = _load_users()
    uid = f"usr_{int(datetime.now(timezone.utc).timestamp() * 1000)}_{_rand()}"
    user = {
        'id': uid,
        'name': name,
        'pin': data.get('pin') or None,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'projects': [],
    }
    users.append(user)
    _save_users(users)
    return jsonify({'user': {'id': user['id'], 'name': user['name'], 'project_count': 0}}), 201


@users_bp.route('/login', methods=['POST'])
def login_user():
    data = request.get_json() or {}
    user_id = data.get('user_id')
    pin = data.get('pin')
    users = _load_users()
    user = next((u for u in users if u['id'] == user_id), None)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if user.get('pin') and user['pin'] != str(pin):
        return jsonify({'success': False, 'error': 'Invalid PIN'}), 401
    return jsonify({'success': True, 'user': {'id': user['id'], 'name': user['name']}})


@users_bp.route('/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    users = _load_users()
    user = next((u for u in users if u['id'] == user_id), None)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    # Delete user's project files
    projects_dir = Path(get_data_dir()) / 'projects'
    for pid in user.get('projects', []):
        pfile = projects_dir / f'{pid}.json'
        if pfile.exists():
            pfile.unlink()
    _save_users([u for u in users if u['id'] != user_id])
    return jsonify({'success': True})


@users_bp.route('/<user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.get_json() or {}
    users = _load_users()
    user = next((u for u in users if u['id'] == user_id), None)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if 'name' in data:
        user['name'] = data['name']
    if 'pin' in data:
        user['pin'] = data['pin'] or None
    _save_users(users)
    return jsonify({'success': True})
