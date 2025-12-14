python -m venv .venv
.\\.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn ai.main:app --reload --host 0.0.0.0 --port 8001

