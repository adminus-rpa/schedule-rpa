"""
schedule_app — пакет.
Экспортируем create_app для удобства импорта из run.py.
"""
from .server import create_app, main

__all__ = ["create_app", "main"]
