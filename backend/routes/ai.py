from flask import Blueprint, jsonify, request

from backend.config import is_ai_available
from backend.services import ai_service

ai_bp = Blueprint('ai', __name__, url_prefix='/api/ai')


def _check_ai():
    if not is_ai_available():
        return jsonify({
            'error': 'AI service not configured',
            'detail': 'AZURE_OPENAI_API_KEY and ENDPOINT_URL are required',
        }), 503
    return None


@ai_bp.route('/suggest-tasks', methods=['POST'])
def suggest_tasks():
    err = _check_ai()
    if err:
        return err
    data = request.get_json() or {}
    try:
        suggestions = ai_service.suggest_tasks(
            data.get('project_title', ''),
            data.get('description', ''),
            data.get('existing_tasks', []),
        )
        return jsonify({'suggestions': suggestions})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ai_bp.route('/summarize', methods=['POST'])
def summarize():
    err = _check_ai()
    if err:
        return err
    data = request.get_json() or {}
    try:
        summary = ai_service.summarize_project(
            data.get('project_name', ''),
            data.get('tasks', []),
        )
        return jsonify({'summary': summary})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ai_bp.route('/smart-deadline', methods=['POST'])
def smart_deadline():
    err = _check_ai()
    if err:
        return err
    data = request.get_json() or {}
    try:
        result = ai_service.estimate_deadline(
            data.get('task_title', ''),
            data.get('description', ''),
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ai_bp.route('/detect-blockers', methods=['POST'])
def detect_blockers():
    err = _check_ai()
    if err:
        return err
    data = request.get_json() or {}
    try:
        blockers = ai_service.detect_blockers(data.get('tasks', []))
        return jsonify({'blockers': blockers})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ai_bp.route('/ask', methods=['POST'])
def ask():
    err = _check_ai()
    if err:
        return err
    data = request.get_json() or {}
    try:
        answer = ai_service.ask_question(
            data.get('question', ''),
            data.get('context', {}),
        )
        return jsonify({'answer': answer})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
