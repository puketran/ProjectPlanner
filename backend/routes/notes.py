from datetime import datetime, timezone
from pathlib import Path

from flask import Blueprint, jsonify, request

from backend.config import get_data_dir
from backend.utils.file_utils import read_json, safe_filename, write_json

notes_bp = Blueprint('notes', __name__, url_prefix='/api/notes')


def _project_path(project_id: str) -> Path:
    return Path(get_data_dir()) / 'projects' / f'{safe_filename(project_id)}.json'


def _load(project_id: str) -> dict:
    return read_json(_project_path(project_id))


def _save(project_id: str, data: dict) -> None:
    data['updated_at'] = datetime.now(timezone.utc).isoformat()
    write_json(_project_path(project_id), data)


@notes_bp.route('/create', methods=['POST'])
def create_note():
    data = request.get_json() or {}
    project_id = data.get('project_id')
    note = data.get('note', {})
    if not project_id or not note:
        return jsonify({'error': 'project_id and note required'}), 400
    project = _load(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    now = datetime.now(timezone.utc).isoformat()
    note.setdefault('created_at', now)
    note.setdefault('updated_at', now)
    note.setdefault('pinned', False)
    note.setdefault('content', '')
    project.setdefault('notes', []).append(note)
    _save(project_id, project)
    return jsonify({'note_id': note['id']}), 201


@notes_bp.route('/update', methods=['PUT'])
def update_note():
    data = request.get_json() or {}
    project_id = data.get('project_id')
    note_id = data.get('note_id')
    updates = data.get('updates', {})
    project = _load(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    for note in project.get('notes', []):
        if note['id'] == note_id:
            note.update(updates)
            note['updated_at'] = datetime.now(timezone.utc).isoformat()
            break
    _save(project_id, project)
    return jsonify({'success': True})


@notes_bp.route('/<note_id>', methods=['DELETE'])
def delete_note(note_id):
    project_id = request.args.get('project_id')
    project = _load(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    project['notes'] = [n for n in project.get('notes', []) if n['id'] != note_id]
    _save(project_id, project)
    return jsonify({'success': True})
