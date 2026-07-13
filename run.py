"""
Тонкая обёртка для запуска: `python run.py`
Использует waitress (WSGI) на порту 8080 по умолчанию.
"""
from app.server import main

if __name__ == "__main__":
    main()
