from datetime import datetime, timezone
from pathlib import Path

from flask import Blueprint, jsonify, request

from backend.config import get_data_dir
from backend.utils.file_utils import read_json, safe_filename, write_json

tasks_bp = Blueprint('tasks', __name__, url_prefix='/api/tasks')


def _project_path(project_id: str) -> Path:
    return Path(get_data_dir()) / 'projects' / f'{safe_filename(project_id)}.json'


def _load(project_id: str) -> dict:
    return read_json(_project_path(project_id))


def _save(project_id: str, data: dict) -> None:
    data['updated_at'] = datetime.now(timezone.utc).isoformat()
    write_json(_project_path(project_id), data)


@tasks_bp.route('/create', methods=['POST'])
def create_task():
    data = request.get_json() or {}
    project_id = data.get('project_id')
    task = data.get('task', {})
    if not project_id or not task:
        return jsonify({'error': 'project_id and task required'}), 400
    project = _load(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    now = datetime.now(timezone.utc).isoformat()
    task.setdefault('created_at', now)
    task.setdefault('updated_at', now)
    task.setdefault('deleted', False)
    task.setdefault('subtasks', [])
    task.setdefault('comments', [])
    task.setdefault('tags', [])
    project.setdefault('tasks', []).append(task)
    _save(project_id, project)
    return jsonify({'task_id': task['id']}), 201


@tasks_bp.route('/update', methods=['PUT'])
def update_task():
    data = request.get_json() or {}
    project_id = data.get('project_id')
    task_id = data.get('task_id')
    updates = data.get('updates', {})
    project = _load(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    now = datetime.now(timezone.utc).isoformat()
    for task in project.get('tasks', []):
        if task['id'] == task_id:
            task.update(updates)
            task['updated_at'] = now
            if updates.get('status') == 'done' and not task.get('completed_at'):
                task['completed_at'] = now
            break
    _save(project_id, project)
    return jsonify({'success': True})


@tasks_bp.route('/<task_id>', methods=['DELETE'])
def soft_delete_task(task_id):
    project_id = request.args.get('project_id')
    project = _load(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    now = datetime.now(timezone.utc).isoformat()
    for task in project.get('tasks', []):
        if task['id'] == task_id:
            task['deleted'] = True
            task['updated_at'] = now
            break
    _save(project_id, project)
    return jsonify({'success': True})


@tasks_bp.route('/<task_id>/hard', methods=['DELETE'])
def hard_delete_task(task_id):
    project_id = request.args.get('project_id')
    project = _load(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    project['tasks'] = [t for t in project.get('tasks', []) if t['id'] != task_id]
    _save(project_id, project)
    return jsonify({'success': True})


@tasks_bp.route('/restore', methods=['POST'])
def restore_task():
    data = request.get_json() or {}
    project_id = data.get('project_id')
    task_id = data.get('task_id')
    project = _load(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    now = datetime.now(timezone.utc).isoformat()
    for task in project.get('tasks', []):
        if task['id'] == task_id:
            task['deleted'] = False
            task['updated_at'] = now
            break
    _save(project_id, project)
    return jsonify({'success': True})


@tasks_bp.route('/reorder', methods=['PUT'])
def reorder_tasks():
    data = request.get_json() or {}
    project_id = data.get('project_id')
    ordered_ids = data.get('ordered_ids', [])
    project = _load(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    task_map = {t['id']: t for t in project.get('tasks', [])}
    project['tasks'] = [task_map[tid] for tid in ordered_ids if tid in task_map]
    # Include any tasks not in ordered_ids (safety)
    included = set(ordered_ids)
    for t in task_map.values():
        if t['id'] not in included:
            project['tasks'].append(t)
    _save(project_id, project)
    return jsonify({'success': True})


@tasks_bp.route('/bulk-status', methods=['POST'])
def bulk_status():
    data = request.get_json() or {}
    project_id = data.get('project_id')
    task_ids = set(data.get('task_ids', []))
    status = data.get('status')
    project = _load(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    now = datetime.now(timezone.utc).isoformat()
    count = 0
    for task in project.get('tasks', []):
        if task['id'] in task_ids:
            task['status'] = status
            task['updated_at'] = now
            if status == 'done' and not task.get('completed_at'):
                task['completed_at'] = now
            count += 1
    _save(project_id, project)
    return jsonify({'updated': count})
