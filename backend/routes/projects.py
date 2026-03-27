import copy
import io
import json
import random
import string
from datetime import datetime, timezone
from pathlib import Path

from flask import Blueprint, jsonify, request, send_file

from backend.config import get_data_dir
from backend.utils.file_utils import (
    list_project_files, read_json, safe_filename, write_json,
)

projects_bp = Blueprint('projects', __name__, url_prefix='/api/projects')


def _projects_dir() -> Path:
    d = Path(get_data_dir()) / 'projects'
    d.mkdir(parents=True, exist_ok=True)
    return d


def _project_path(project_id: str) -> Path:
    return _projects_dir() / f'{safe_filename(project_id)}.json'


def _rand(k=5) -> str:
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=k))


@projects_bp.route('', methods=['GET'])
def list_projects():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    project_files = list_project_files(get_data_dir())
    projects = []
    for pf in project_files:
        try:
            p = read_json(pf)
            if p.get('user_id') != user_id or p.get('status') == 'deleted':
                continue
            tasks = [t for t in p.get('tasks', []) if not t.get('deleted')]
            total = len(tasks)
            done = sum(1 for t in tasks if t.get('status') == 'done')
            projects.append({
                'id': p['id'],
                'name': p['name'],
                'description': p.get('description', ''),
                'color': p.get('color', '#6366f1'),
                'icon': p.get('icon', '📁'),
                'status': p.get('status', 'active'),
                'task_total': total,
                'task_done': done,
                'updated_at': p.get('updated_at', ''),
                'created_at': p.get('created_at', ''),
            })
        except Exception:
            continue
    projects.sort(key=lambda x: x.get('updated_at', ''), reverse=True)
    return jsonify({'projects': projects})


@projects_bp.route('/save', methods=['POST'])
def save_projects():
    data = request.get_json() or {}
    user_id = data.get('user_id')
    projects = data.get('projects', {})
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    project_ids = []
    for pid, project in projects.items():
        # Never overwrite a project that already belongs to a different user
        existing_path = _project_path(pid)
        if existing_path.exists():
            existing = read_json(existing_path)
            if existing.get('user_id') and existing['user_id'] != user_id:
                continue  # skip — belongs to another user
        # Only save if the project's own user_id matches the requester
        project_owner = project.get('user_id')
        if project_owner and project_owner != user_id:
            continue  # client sent another user's project — skip it
        project['user_id'] = user_id
        write_json(_project_path(pid), project)
        project_ids.append(pid)
    # Update user's project list
    users_path = Path(get_data_dir()) / 'users.json'
    users_data = read_json(users_path)
    if isinstance(users_data, list):
        for user in users_data:
            if user['id'] == user_id:
                existing = set(user.get('projects', []))
                existing.update(project_ids)
                user['projects'] = list(existing)
                break
        write_json(users_path, users_data)
    return jsonify({'success': True})


@projects_bp.route('/export', methods=['GET'])
def export_project():
    project_id = request.args.get('project_id')
    if not project_id:
        return jsonify({'error': 'project_id required'}), 400
    path = _project_path(project_id)
    if not path.exists():
        return jsonify({'error': 'Project not found'}), 404
    p = read_json(path)
    buf = io.BytesIO(json.dumps(p, indent=2, ensure_ascii=False).encode('utf-8'))
    buf.seek(0)
    filename = f"{p.get('name', project_id)}.json".replace('/', '-')
    return send_file(buf, mimetype='application/json', as_attachment=True, download_name=filename)


@projects_bp.route('/import', methods=['POST'])
def import_project():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    f = request.files['file']
    try:
        data = json.loads(f.read().decode('utf-8'))
    except Exception:
        return jsonify({'error': 'Invalid JSON file'}), 400
    if not isinstance(data, dict) or 'id' not in data:
        return jsonify({'error': 'Invalid project format'}), 400
    user_id = request.form.get('user_id')
    if user_id:
        data['user_id'] = user_id
    write_json(_project_path(data['id']), data)
    return jsonify({'success': True, 'project_id': data['id']}), 201


@projects_bp.route('/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    path = _project_path(project_id)
    if path.exists():
        path.unlink()
    return jsonify({'success': True})


@projects_bp.route('/rename', methods=['POST'])
def rename_project():
    data = request.get_json() or {}
    project_id = data.get('project_id')
    new_name = (data.get('new_name') or '').strip()
    if not project_id or not new_name:
        return jsonify({'error': 'project_id and new_name required'}), 400
    path = _project_path(project_id)
    if not path.exists():
        return jsonify({'error': 'Project not found'}), 404
    project = read_json(path)
    project['name'] = new_name
    project['updated_at'] = datetime.now(timezone.utc).isoformat()
    write_json(path, project)
    return jsonify({'success': True})


@projects_bp.route('/duplicate', methods=['POST'])
def duplicate_project():
    data = request.get_json() or {}
    project_id = data.get('project_id')
    path = _project_path(project_id)
    if not path.exists():
        return jsonify({'error': 'Project not found'}), 404
    project = copy.deepcopy(read_json(path))
    now = datetime.now(timezone.utc).isoformat()
    new_id = f"proj_{int(datetime.now(timezone.utc).timestamp() * 1000)}_{_rand()}"
    project['id'] = new_id
    project['name'] = project['name'] + ' (copy)'
    project['created_at'] = now
    project['updated_at'] = now
    write_json(_project_path(new_id), project)
    return jsonify({'new_project_id': new_id}), 201
