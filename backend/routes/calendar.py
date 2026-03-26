from flask import Blueprint, jsonify, request

from backend.config import get_data_dir
from backend.utils.file_utils import list_project_files, read_json

calendar_bp = Blueprint('calendar', __name__, url_prefix='/api/calendar')


@calendar_bp.route('/tasks', methods=['GET'])
def calendar_tasks():
    user_id = request.args.get('user_id')
    year = request.args.get('year', type=int)
    month = request.args.get('month', type=int)
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400

    project_files = list_project_files(get_data_dir())
    tasks = []
    for pf in project_files:
        try:
            p = read_json(pf)
            if p.get('user_id') != user_id or p.get('status') == 'deleted':
                continue
            color = p.get('color', '#6366f1')
            project_name = p.get('name', '')
            project_id = p.get('id', '')
            for task in p.get('tasks', []):
                if task.get('deleted'):
                    continue
                due = task.get('due_date')
                if not due:
                    continue
                if year and month:
                    try:
                        parts = due.split('-')
                        ty, tm = int(parts[0]), int(parts[1])
                        if ty != year or tm != month:
                            continue
                    except Exception:
                        continue
                tasks.append({
                    'task_id': task['id'],
                    'task_title': task.get('title', ''),
                    'project_id': project_id,
                    'project_name': project_name,
                    'project_color': color,
                    'due_date': due,
                    'status': task.get('status', 'todo'),
                    'priority': task.get('priority', 'medium'),
                })
        except Exception:
            continue
    tasks.sort(key=lambda x: x.get('due_date', ''))
    return jsonify({'tasks': tasks})
