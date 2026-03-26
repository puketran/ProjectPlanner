import os
from flask import Flask, request, Response, send_from_directory, jsonify


def create_app():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    frontend_dir = os.path.join(base_dir, 'frontend')
    static_dir = os.path.join(frontend_dir, 'static')

    app = Flask(
        __name__,
        static_folder=static_dir,
        static_url_path='/static'
    )

    from flask_cors import CORS
    CORS(app)

    # Register blueprints
    from backend.routes.projects import projects_bp
    from backend.routes.tasks import tasks_bp
    from backend.routes.notes import notes_bp
    from backend.routes.ai import ai_bp
    from backend.routes.users import users_bp
    from backend.routes.settings import settings_bp
    from backend.routes.calendar import calendar_bp

    app.register_blueprint(projects_bp)
    app.register_blueprint(tasks_bp)
    app.register_blueprint(notes_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(calendar_bp)

    # Optional Basic Auth
    auth_user = os.environ.get('APP_AUTH_USER')
    auth_pass = os.environ.get('APP_AUTH_PASS')

    if auth_user and auth_pass:
        @app.before_request
        def require_auth():
            if request.path == '/health':
                return None
            auth = request.authorization
            if not auth or auth.username != auth_user or auth.password != auth_pass:
                return Response(
                    'Authentication required',
                    401,
                    {'WWW-Authenticate': 'Basic realm="ProjectPlanner"'}
                )

    @app.route('/health')
    def health():
        return jsonify({'status': 'ok'})

    @app.route('/')
    def index():
        return send_from_directory(frontend_dir, 'index.html')

    @app.route('/<path:path>')
    def catch_all(path):
        return send_from_directory(frontend_dir, 'index.html')

    return app
