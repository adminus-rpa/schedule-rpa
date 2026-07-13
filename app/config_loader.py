"""
Загрузчик конфигурации с "горячей перезагрузкой" (hot-reload).
Файл config.yaml перечитывается автоматически при изменении mtime.
"""
from __future__ import annotations

import logging
import threading
from copy import deepcopy
from pathlib import Path
from typing import Any

import yaml

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Дефолты — используются при отсутствии значения в yaml.
# ---------------------------------------------------------------------------
DEFAULTS: dict[str, Any] = {
    "database": {
        "path": "./schedule.mdb",
        "driver": "auto",
        "odbc_driver": "Microsoft Access Driver (*.mdb, *.accdb)",
    },
    "sync": {
        "interval_seconds": 900,
        "read_timeout_seconds": 60,
        "snapshots_kept": 3,
    },
    "display": {
        "period": "day",
        "start": "today",
        "show_weekends": False,
        "hide_empty_groups": True,
        "layout": "alternate",
        "alternate_interval_seconds": 20,
        "show_teacher": True,

        # Пагинация групп (вертикальный layout)
        "groups_per_page": 0,
        "group_col_min_px": 220,
        "group_col_max_px": 340,
        "page_interval_seconds": 15,
        "page_animation": "slide",
        "page_animation_ms": 500,

        # Автоскролл
        "auto_scroll": True,
        "auto_scroll_speed": 30,
        "auto_scroll_pause_ms": 2500,

        # Троеточие и спец-замены
        "subject_max_chars": 0,
        # ВАЖНО: автозамены применяются на СТОРОНЕ СЕРВЕРА (в БД-репозитории).
        # Клиент получает уже нормализованные строки.
        #
        # Задача: любой предмет, суть которого = ЭИОС
        # («ЭИОС», «Э.И.О.С.», «с пр ЭИОС», «пр. ЭИОС», «лек ЭИОС»,
        # «Электронная информационно-образовательная среда» и т.д.), должен
        # превратиться ровно в "ЭИОС".
        #
        # Порядок применения ВАЖЕН — Python 3.7+ гарантирует insertion order,
        # регэкспы применяются последовательно (см. _apply_replacements).
        #
        # \A и \Z — якори начала/конца всей строки. Мы намеренно матчим ВСЮ
        # строку целиком, чтобы «съедать» префиксы вида «с пр», «лек» и т.д.
        # Внутри осмысленного контекста («Информатика в ЭИОС») строка НЕ
        # начинается с ЭИОС-паттерна, поэтому эти правила не срабатывают —
        # такие вхождения оставляем как есть.
        "subject_replacements": {
            # ---- 1. Полное название («Электронная информационно-образовательная среда»),
            #        возможно с любым префиксом-типом занятия. Префикс =
            #        до 3-х токенов из коротких кириллических слов («с», «пр», «лек», «сем»...)
            #        с возможными точками/слешами/дефисами между ними.
            # Префикс — строго белый список аббревиатур типа занятия:
            # л, лек, лекц, лекция, п, пр, практ, практика, с, сем, семинар, сам и т.п.
            # Запись: (?:…|…){0,3} — до 3-х токенов, разделённых точкой/слешем/пробелом/дефисом.
            r"\A\s*(?:(?:лекция|лекц|лек|практика|практ|семинар|сем|конс|кол|лаб|сам|пр|л|с|к|н)\.?[\s/\\\-]*){0,3}Электронн[а-я]*[\s\-]+информационн[а-я]*[\s\-]+образовательн[а-я]*[\s\-]+сред[а-я]*\s*\Z":
                "ЭИОС",

            # ---- 2. Полная строка = (опциональный префикс) + ЭИОС.
            #        Префикс — до 3-х токенов вида «с пр», «пр.», «лек», «сем»,
            #        «практика», «лекция», «л/пр», «с/пр» и т.п.
            #        Между префиксом и ЭИОС может быть точка/пробел/ничего.
            #        Символы префикса: только короткие кириллические слова,
            #        чтобы не зацепить «Информатика в ЭИОС».
            # Анкоры \A и \Z + белый список префиксов. Покрывает варианты:
            # «с пр ЭИОС», «с пр. ЭИОС», «пр.ЭИОС», «лек. ЭИОС», «лекция ЭИОС»,
            # «с/пр ЭИОС», «л/пр ЭИОС» и т.п. При этом «Информатика в ЭИОС»
            # НЕ срабатывает, так как «Информатика» / «в» не в белом списке.
            r"\A\s*(?:(?:лекция|лекц|лек|практика|практ|семинар|сем|конс|кол|лаб|сам|пр|л|с|к|н)\.?[\s/\\\-]*){0,3}(?:Э\.?\s*И\.?\s*О\.?\s*С\.?|ЭИО[\s\-]?С|ЭИ[\s\-]?ОС)\s*\Z":
                "ЭИОС",

            # ---- 3. "ЭИОС" внутри более сложного текста ("Информатика в ЭИОС") —
            #        нормализуем только начертание, оставляя контекст.
            r"\bЭ\.\s*И\.\s*О\.\s*С\.?(?=\W|$)": "ЭИОС",
            r"\bЭ\s+И\s+О\s+С\b": "ЭИОС",
            r"\b(?:ЭИО[\s\-]С|ЭИ[\s\-]ОС)\b": "ЭИОС",
            # приводим к верхнему регистру внутри контекста
            r"\b[Ээ][Ии][Оо][Сс]\b": "ЭИОС",

            # ---- 4. Полное название внутри контекста
            r"\bЭлектронн[а-я]*\s+информационн[а-я]*[\s\-]+образовательн[а-я]*\s+сред[а-я]*\b": "ЭИОС",
            r"\bЭлектронн[а-я]*[\s\-]+информационн[а-я]*[\s\-]+образовательн[а-я]*[\s\-]+сред[а-я]*\b": "ЭИОС",
        },
        "room_replacements": {
            r"\(Ст\.\s*с\)":   "Ст.с",
            r"\(Ст\.\s*с\.\)": "Ст.с",
        },

        # =====================================================================
        # ДИЗАЙН «ОСТРОВКОВ» И АНИМАЦИИ
        # =====================================================================
        # Рассеянное свечение вокруг островков (по умолчанию выключено).
        "island_glow_enabled": False,
        # Цвет свечения. Пусто = использовать цвет-акцент (колледж/вуз).
        "island_glow_color": "",
        # Интенсивность (радиус blur в px) и непрозрачность (0..1)
        "island_glow_radius": 40,
        "island_glow_opacity": 0.35,
        # Пульсация свечения (легкая, дизайнерская)
        "island_glow_pulse": False,

        # Расширенные анимации (плавные переходы иконки/названия панели и т.д.)
        "fancy_animations": True,
        # Длительность общих микро-анимаций (icon/title fly-in, hover feedback)
        "micro_anim_ms": 420,

        # Прогресс-бар пагинации сверху панелей.
        # Показывает сколько страниц ещё осталось до конца цикла.
        "progress_bar_enabled": True,
    },
    "theme": {
        "preset": "light",
        "overrides": {},
        "background_image": "",
        "background_opacity": 0.10,
        "floor_colors": {
            "1": "#0ea5e9",
            "2": "#10b981",
            "3": "#f59e0b",
            "4": "#ef4444",
            "5": "#8b5cf6",
            "6": "#ec4899",
            "7": "#14b8a6",
            "8": "#f97316",
            "9": "#6366f1",
            "default": "#64748b",
        },
    },
    "typography": {
        "cell_font_size": 0.9,
        "header_font_size": 1.15,
        "title_font_size": 1.55,
        "font_family": "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
    },
    "behavior": {
        "hide_topbar_on_load": True,
        "client_refresh_seconds": 60,
        "client_config_poll_seconds": 5,
        "show_status_indicator": True,
        "show_clock": True,
        # Полноэкранный режим по F11 доступен всегда, но эта опция позволяет
        # автоматически перейти в fullscreen при первом взаимодействии пользователя.
        "fullscreen_on_first_interaction": False,
    },
    "logging": {
        "level": "INFO",
        "file": "./logs/app.log",
        "max_bytes": 5 * 1024 * 1024,
        "backup_count": 5,
    },
    "classification": {
        "college_ido": [],
        "university_ido": [],
        "college_kod_regex": r"^40\.02\.",
    },
    "bells": {
        "university": {
            "shift1": [
                {"ur": 1, "time": "08:00–09:30"},
                {"ur": 2, "time": "09:40–11:10"},
                {"ur": 3, "time": "11:20–12:50"},
                {"ur": 4, "time": "13:20–14:50"},
            ],
            "shift2": [
                {"ur": 5, "time": "15:00–16:30"},
                {"ur": 6, "time": "17:00–18:30"},
                {"ur": 7, "time": "18:40–20:10"},
            ],
        },
        "college": {
            "shift1": [
                {"ur": 1, "time": "08:00–09:30"},
                {"ur": 2, "time": "09:40–11:10"},
                {"ur": 3, "time": "11:40–13:10"},
            ],
            "shift2": [
                {"ur": 4, "time": "13:20–14:50"},
                {"ur": 5, "time": "15:20–16:50"},
                {"ur": 6, "time": "17:00–18:30"},
            ],
        },
    },
}


def _deep_merge(base: dict, override: dict) -> dict:
    """Рекурсивно сливает override поверх base (без мутации base)."""
    result = deepcopy(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(result.get(k), dict):
            result[k] = _deep_merge(result[k], v)
        else:
            result[k] = v
    return result


class ConfigLoader:
    """
    Потокобезопасный загрузчик конфигурации с автоматической перезагрузкой
    при изменении файла на диске.
    """

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self._lock = threading.RLock()
        self._data: dict[str, Any] = deepcopy(DEFAULTS)
        self._mtime: float = 0.0
        self._version: int = 0  # инкрементируется при каждой перезагрузке
        self.reload(force=True)

    # -- публичные API --

    @property
    def version(self) -> int:
        """Целочисленная версия конфига — растёт при каждой удачной перезагрузке."""
        with self._lock:
            return self._version

    def get(self, *keys: str, default: Any = None) -> Any:
        """
        Достаёт значение по вложенным ключам: cfg.get('display', 'period').
        Возвращает default, если ключ отсутствует.
        """
        with self._lock:
            node: Any = self._data
            for k in keys:
                if not isinstance(node, dict) or k not in node:
                    return default
                node = node[k]
            return deepcopy(node)

    def snapshot(self) -> dict[str, Any]:
        """Возвращает полный снимок конфига (глубокая копия) + номер версии."""
        with self._lock:
            snap = deepcopy(self._data)
            snap["_version"] = self._version
            return snap

    def reload(self, force: bool = False) -> bool:
        """
        Перечитывает файл если он изменился (или force=True).
        Возвращает True, если конфиг был обновлён.
        """
        with self._lock:
            try:
                if not self.path.exists():
                    if force:
                        log.warning("Config file not found: %s. Using defaults.", self.path)
                    return False

                mtime = self.path.stat().st_mtime
                if not force and mtime == self._mtime:
                    return False

                with open(self.path, "r", encoding="utf-8") as f:
                    raw = yaml.safe_load(f) or {}

                if not isinstance(raw, dict):
                    log.error("Config root must be a mapping. Got: %s", type(raw))
                    return False

                merged = _deep_merge(DEFAULTS, raw)
                self._data = merged
                self._mtime = mtime
                self._version += 1
                log.info("Config reloaded (v%d) from %s", self._version, self.path)
                return True
            except yaml.YAMLError as e:
                log.error("YAML parse error in %s: %s", self.path, e)
                return False
            except Exception as e:  # noqa: BLE001
                log.exception("Failed to reload config: %s", e)
                return False


# ---------------------------------------------------------------------------
# Пресеты тем — цветовые палитры.
# ---------------------------------------------------------------------------
THEME_PRESETS: dict[str, dict[str, str]] = {
    "light": {
        "background":        "#f5f5f7",
        "surface":           "#ffffff",
        "surface_2":         "#fbfbfd",
        "text":              "#1d1d1f",
        "text_muted":        "#6e6e73",
        "accent_college":    "#34c759",
        "accent_university": "#007aff",
        # Пастельно-сиреневый акцент для подсветки текущей пары
        "accent_now":        "#b39ddb",
        "lesson_bg":         "#ffffff",
        "lesson_border":     "#e5e5ea",
        "grid_line":         "#d2d2d7",
        "header_bg":         "#f5f5f7",
    },
    "dark": {
        "background":        "#0b1220",
        "surface":           "#131c2e",
        "surface_2":         "#1a2438",
        "text":              "#f1f5f9",
        "text_muted":        "#94a3b8",
        "accent_college":    "#10b981",
        "accent_university": "#3b82f6",
        "accent_now":        "#b39ddb",  # пастельно-сиреневый
        "lesson_bg":         "#1a2438",
        "lesson_border":     "#2a3654",
        "grid_line":         "#2a3654",
        "header_bg":         "#131c2e",
    },
    "uni_blue": {
        "background":        "#0a1428",
        "surface":           "#132038",
        "surface_2":         "#1a2a48",
        "text":              "#e6ecf5",
        "text_muted":        "#8fa4c2",
        "accent_college":    "#06d6a0",
        "accent_university": "#4cc9f0",
        "accent_now":        "#c4b5fd",  # пастельно-сиреневый
        "lesson_bg":         "#182b48",
        "lesson_border":     "#2b4166",
        "grid_line":         "#243657",
        "header_bg":         "#0f1c33",
    },
    "warm": {
        "background":        "#fffbf5",
        "surface":           "#ffffff",
        "surface_2":         "#fff4e6",
        "text":              "#3f1d0a",
        "text_muted":        "#8b4513",
        "accent_college":    "#d97706",
        "accent_university": "#b45309",
        "accent_now":        "#dc2626",
        "lesson_bg":         "#fef7ec",
        "lesson_border":     "#fcd34d",
        "grid_line":         "#fde68a",
        "header_bg":         "#fef3c7",
    },
    "contrast": {
        "background":        "#000000",
        "surface":           "#0a0a0a",
        "surface_2":         "#151515",
        "text":              "#ffffff",
        "text_muted":        "#cccccc",
        "accent_college":    "#ffe600",
        "accent_university": "#00e5ff",
        "accent_now":        "#ff5555",
        "lesson_bg":         "#151515",
        "lesson_border":     "#ffffff",
        "grid_line":         "#333333",
        "header_bg":         "#0a0a0a",
    },
}


def resolve_theme(cfg: ConfigLoader) -> dict[str, str]:
    """Возвращает финальную палитру = пресет + overrides."""
    preset_name = cfg.get("theme", "preset", default="light")
    palette = deepcopy(THEME_PRESETS.get(preset_name, THEME_PRESETS["light"]))
    overrides = cfg.get("theme", "overrides", default={}) or {}
    for k, v in overrides.items():
        if v:  # только непустые значения
            palette[k] = v
    return palette
