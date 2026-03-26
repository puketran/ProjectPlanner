import json
import os
import re

from backend.config import get_azure_openai_client, get_app_config


def _language() -> str:
    return get_app_config().get('ai_response_language', 'English')


def _deployment() -> str:
    return os.environ.get('DEPLOYMENT_NAME', 'gpt-4o')


def _chat(messages: list) -> str:
    client = get_azure_openai_client()
    if not client:
        raise RuntimeError('AI not configured: AZURE_OPENAI_API_KEY or ENDPOINT_URL missing')
    resp = client.chat.completions.create(
        model=_deployment(),
        messages=messages,
        temperature=0.7,
        max_tokens=1000,
    )
    return resp.choices[0].message.content.strip()


def suggest_tasks(project_title: str, description: str, existing_tasks: list) -> list:
    lang = _language()
    existing = ', '.join(existing_tasks) if existing_tasks else 'none yet'
    system = f'You are a project planning assistant. Respond in {lang}.'
    user = (
        f'Project: {project_title}\n'
        f'Description: {description or "N/A"}\n'
        f'Existing tasks: {existing}\n\n'
        f'Suggest 5-8 concrete actionable tasks. '
        f'Return ONLY a JSON array of strings, e.g. ["Task 1", "Task 2"]'
    )
    result = _chat([{'role': 'system', 'content': system}, {'role': 'user', 'content': user}])
    match = re.search(r'\[.*\]', result, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return [line.strip('- •').strip() for line in result.split('\n') if line.strip()]


def summarize_project(project_name: str, tasks: list) -> str:
    lang = _language()
    total = len(tasks)
    done = sum(1 for t in tasks if t.get('status') == 'done')
    in_prog = sum(1 for t in tasks if t.get('status') == 'in-progress')
    blocked = sum(1 for t in tasks if t.get('status') == 'blocked')
    titles = ', '.join(t.get('title', '') for t in tasks[:20])
    system = f'You are a project status summarizer. Respond in {lang}. Be concise (2-3 sentences).'
    user = (
        f'Project: {project_name}\n'
        f'Total: {total}, Done: {done}, In-progress: {in_prog}, Blocked: {blocked}\n'
        f'Tasks: {titles}\n\nWrite a brief status summary.'
    )
    return _chat([{'role': 'system', 'content': system}, {'role': 'user', 'content': user}])


def estimate_deadline(task_title: str, description: str) -> dict:
    lang = _language()
    from datetime import date
    today = date.today().isoformat()
    system = f'You are a project estimation expert. Respond in {lang}. Today is {today}.'
    user = (
        f'Task: {task_title}\n'
        f'Description: {description or "N/A"}\n\n'
        f'Suggest a realistic due date and reason. '
        f'Return JSON: {{"date": "YYYY-MM-DD", "reasoning": "..."}}'
    )
    result = _chat([{'role': 'system', 'content': system}, {'role': 'user', 'content': user}])
    match = re.search(r'\{.*\}', result, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return {'date': None, 'reasoning': result}


def detect_blockers(tasks: list) -> list:
    lang = _language()
    active = [
        {'id': t.get('id'), 'title': t.get('title'), 'description': t.get('description', ''), 'status': t.get('status')}
        for t in tasks if t.get('status') != 'done' and not t.get('deleted')
    ]
    system = f'You are a project risk analyst. Respond in {lang}.'
    user = (
        f'Tasks: {json.dumps(active)}\n\n'
        f'Identify tasks that appear blocked or at risk. '
        f'Return JSON array: [{{"task_id": "...", "reason": "..."}}]. Return [] if none.'
    )
    result = _chat([{'role': 'system', 'content': system}, {'role': 'user', 'content': user}])
    match = re.search(r'\[.*\]', result, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return []


def ask_question(question: str, context: dict) -> str:
    lang = _language()
    system = f'You are a helpful project planning assistant. Respond in {lang}.'
    user = f'Context: {json.dumps(context)}\n\nQuestion: {question}'
    return _chat([{'role': 'system', 'content': system}, {'role': 'user', 'content': user}])
