"""
Репозиторий расписания: читает справочники + UROKI из MDB и строит
структурированный снимок для отдачи фронту.

ВАЖНО о датах:
  - pyodbc возвращает datetime.datetime
  - mdbtools через CSV — строку в формате '%Y-%m-%d %H:%M:%S'
  Repo нормализует оба к datetime.date.
"""
from __future__ import annotations

import logging
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any

from .base import MDBBackend

log = logging.getLogger(__name__)

WEEKDAY_RU = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]


# ---------------------------------------------------------------------------
# Утилиты нормализации
# ---------------------------------------------------------------------------
def _to_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        # частые форматы: '2025-09-02 00:00:00', '09/02/25 00:00:00'
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d",
                    "%m/%d/%y %H:%M:%S", "%m/%d/%Y %H:%M:%S",
                    "%d.%m.%Y %H:%M:%S", "%d.%m.%Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue
    log.debug("Unrecognized date value: %r", value)
    return None


def _to_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None


def _clean(value: Any) -> str:
    if value is None:
        return ""
    s = str(value).strip()
    return s


# ---------------------------------------------------------------------------
# Модели для отдачи
# ---------------------------------------------------------------------------
@dataclass
class Lesson:
    ur: int
    subject: str = ""
    teacher: str = ""
    room: str = ""
    lesson_type: str = ""
    time_range: str = ""

    def to_dict(self) -> dict:
        return {
            "ur": self.ur,
            "subject": self.subject,
            "teacher": self.teacher,
            "room": self.room,
            "type": self.lesson_type,
            "time": self.time_range,
        }


@dataclass
class GroupSchedule:
    id: int
    name: str
    kind: str          # 'college' | 'university'
    shift: int         # 1 или 2 (по данным недели)
    course: int = 0
    department: str = ""
    # {iso_date: {ur: [Lesson,...]}}
    days: dict[str, dict[int, list[Lesson]]] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "kind": self.kind,
            "shift": self.shift,
            "course": self.course,
            "department": self.department,
            "has_lessons": bool(self.days),
            "days": {
                d: {str(ur): [l.to_dict() for l in lst] for ur, lst in urs.items()}
                for d, urs in self.days.items()
            },
        }


# ---------------------------------------------------------------------------
# Собственно репозиторий
# ---------------------------------------------------------------------------
def _compile_replacements(mapping: dict | None) -> list[tuple]:
    """Компилирует dict {regex: replacement} в список (compiled_pattern, replacement).
    Пропускает некорректные regex'ы (логирует WARNING)."""
    result: list[tuple] = []
    if not mapping:
        return result
    for pattern, repl in mapping.items():
        try:
            result.append((re.compile(pattern, re.IGNORECASE | re.UNICODE), str(repl)))
        except re.error as e:  # noqa: PERF203
            log.warning("Invalid regex %r in replacements: %s", pattern, e)
    return result


def _apply_replacements(text: str, compiled: list[tuple]) -> str:
    for pat, repl in compiled:
        text = pat.sub(repl, text)
    return text


class ScheduleRepository:
    def __init__(self, backend: MDBBackend, cfg_snapshot: dict):
        self.backend = backend
        self.cfg = cfg_snapshot
        disp = cfg_snapshot.get("display", {}) if cfg_snapshot else {}
        self._subject_replacements = _compile_replacements(disp.get("subject_replacements"))
        self._room_replacements = _compile_replacements(disp.get("room_replacements"))

    # -------- вспомогательные загрузчики --------
    def _load_dict(self, table: str, key: str) -> dict[int, dict]:
        result: dict[int, dict] = {}
        for row in self.backend.query_all(table):
            k = _to_int(row.get(key))
            if k is not None:
                result[k] = row
        return result

    def _classify_departments(self, spotd: dict[int, dict]) -> dict[int, str]:
        """Возвращает {IDO: 'college' | 'university'}."""
        college_list = set(self.cfg.get("classification", {}).get("college_ido") or [])
        uni_list = set(self.cfg.get("classification", {}).get("university_ido") or [])
        regex = re.compile(
            self.cfg.get("classification", {}).get("college_kod_regex", r"^40\.02\.")
        )
        mapping: dict[int, str] = {}
        for ido, row in spotd.items():
            if ido in college_list:
                mapping[ido] = "college"
            elif ido in uni_list:
                mapping[ido] = "university"
            else:
                kod = _clean(row.get("KOD"))
                mapping[ido] = "college" if regex.match(kod) else "university"
        return mapping

    def _determine_shift(self, ur_time_by_group: dict[int, dict[int, str]],
                         idg: int, kind: str,
                         group_urs: set[int] | None = None) -> int:
        """
        Определяет смену группы.

        Приоритеты:
          1) Если по данным UROKI группа использует пары, характерные для 2-й смены
             (для вуза UR>=5, для колледжа UR>=4) и НЕ использует ранние пары —
             считаем это 2-й сменой.
          2) Иначе смотрим UR_TIME: время UR1 = 08:00 → 1 см., начинается позже → 2 см.
          3) По умолчанию — 1 смена.
        """
        early_urs = {1, 2, 3} if kind == "university" else {1, 2}
        late_urs = {5, 6, 7} if kind == "university" else {4, 5, 6}

        if group_urs:
            has_early = any(u in early_urs for u in group_urs)
            has_late = any(u in late_urs for u in group_urs)
            if has_late and not has_early:
                return 2
            if has_early:
                return 1

        ur_map = ur_time_by_group.get(idg, {})
        for ur, tm in ur_map.items():
            if not tm:
                continue
            t = tm.strip()
            if ur == 1 and (t.startswith("8.") or t.startswith("08")):
                return 1

        if group_urs:
            # если UR_TIME пустой, но у группы есть только «поздние» пары
            return 2 if any(u in late_urs for u in group_urs) else 1
        return 1

    # -------- основной метод --------
    def build_snapshot(self, start_date: date, end_date: date) -> dict:
        """
        Читает БД и собирает снапшот расписания за [start_date; end_date] включительно.
        Возвращает dict, готовый к JSON-сериализации.
        """
        log.info("Building schedule snapshot for %s .. %s", start_date, end_date)

        # 1. Справочники
        spotd = self._load_dict("SPOTD", "IDO")
        spgrup = self._load_dict("SPGRUP", "IDG")
        sppred = self._load_dict("SPPRED", "IDD")
        spprep = self._load_dict("SPPREP", "IDP")
        spkaud = self._load_dict("SPKAUD", "IDA")
        try:
            sptipz = self._load_dict("SPTIPZ", "IDZ")
        except Exception:  # noqa: BLE001
            sptipz = {}

        classify = self._classify_departments(spotd)

        # 2. UR_TIME — расписание звонков (у разных групп разное!)
        ur_time_by_group: dict[int, dict[int, str]] = defaultdict(dict)
        try:
            for row in self.backend.query_all("UR_TIME"):
                idg = _to_int(row.get("IDG"))
                idur = _to_int(row.get("IDUR"))
                naim = _clean(row.get("NAIM"))
                if idg and idur is not None:
                    ur_time_by_group[idg][idur] = naim
        except Exception as e:  # noqa: BLE001
            log.warning("UR_TIME read failed: %s", e)

        # 3. UROKI — фильтруем по диапазону дат
        lessons_by_group_day: dict[int, dict[date, dict[int, list[Lesson]]]] = \
            defaultdict(lambda: defaultdict(lambda: defaultdict(list)))

        total_read = 0
        for row in self.backend.query_all("UROKI"):
            d = _to_date(row.get("DAT"))
            if d is None or d < start_date or d > end_date:
                continue
            total_read += 1
            idg = _to_int(row.get("IDG"))
            ur = _to_int(row.get("UR"))
            if idg is None or ur is None:
                continue

            idd = _to_int(row.get("IDD"))
            idp = _to_int(row.get("IDP"))
            ida = _to_int(row.get("IDA"))
            idn = _to_int(row.get("IDN"))  # тип занятия (см. SPTIPZ)

            subject = _clean(sppred.get(idd, {}).get("NAIM")) if idd else ""
            teacher = _clean(spprep.get(idp, {}).get("FAMIO")) if idp else ""
            room = _clean(spkaud.get(ida, {}).get("KAUDI")) if ida else ""
            ltype = _clean(sptipz.get(idn, {}).get("shname")) if idn else ""

            # Централизованные автозамены из конфига.
            if subject and self._subject_replacements:
                subject = _apply_replacements(subject, self._subject_replacements)
            if room is None:
                room = ""
            if self._room_replacements:
                room = _apply_replacements(room, self._room_replacements)

            time_range = ur_time_by_group.get(idg, {}).get(ur, "")

            lesson = Lesson(
                ur=ur, subject=subject, teacher=teacher, room=room,
                lesson_type=ltype, time_range=time_range,
            )
            lessons_by_group_day[idg][d][ur].append(lesson)

        log.info("UROKI: %d rows in range", total_read)

        # 4. Собираем группы (все группы, даже пустые — клиент сам решит, что показать)
        college_groups: list[GroupSchedule] = []
        university_groups: list[GroupSchedule] = []
        hide_empty = bool(self.cfg.get("display", {}).get("hide_empty_groups", True))

        for idg, g in spgrup.items():
            ido = _to_int(g.get("IDO"))
            if ido is None:
                continue
            kind = classify.get(ido, "university")
            g_days = lessons_by_group_day.get(idg, {})
            if hide_empty and not g_days:
                continue
            # группа должна быть активна в этом уч. году (DATNN/DATKK)
            g_start = _to_date(g.get("DATNN"))
            g_end = _to_date(g.get("DATKK"))
            if g_start and end_date < g_start:
                continue
            if g_end and start_date > g_end:
                continue

            days_dict: dict[str, dict[int, list[Lesson]]] = {}
            for d, urs in g_days.items():
                days_dict[d.isoformat()] = dict(urs)

            # собираем набор UR, реально встречающихся у группы, для определения смены
            group_urs: set[int] = set()
            for urs in g_days.values():
                group_urs.update(urs.keys())

            gs = GroupSchedule(
                id=idg,
                name=_clean(g.get("NAIM")),
                kind=kind,
                shift=self._determine_shift(ur_time_by_group, idg, kind, group_urs),
                course=_to_int(g.get("KURS")) or 0,
                department=_clean(spotd.get(ido, {}).get("SOKR")),
                days=days_dict,
            )
            # если в выбранном диапазоне у группы нет занятий — всё равно включаем её
            # (если hide_empty=False), но помечаем has_lessons=False. Клиент сам решает.
            if kind == "college":
                college_groups.append(gs)
            else:
                university_groups.append(gs)

        # Сортировка групп по возрастанию курса (1 курс → 2 курс → ...).
        #
        # Формат имени группы в БД (пример): "06-кПДо22-1".
        #   "06"  — код отделения
        #   "кПДо" — префикс специальности
        #   "22"  — год приёма (2 цифры)
        #   "1"   — номер подгруппы
        #
        # Свежий приём → большее число года → 1 курс.
        # Поэтому:
        #   1) если в БД есть KURS — используем его как главный ключ
        #      (курс=0 трактуем как ”неизвестен“ → в конец);
        #   2) иначе — вычисляем курс из года приёма (чем больше год, тем младше).
        # Вторичный ключ — год приёма по убыванию (на случай разных KURS в одном подразделении).
        # Далее — естественная сортировка по имени для стабильного порядка внутри курса.

        def _extract_year(name: str) -> int:
            """
            Из названия группы вида "06-кПДо22-1" вернём год приёма (22).
            Ищем число, стоящее перед последним "-N" (номером подгруппы).
            """
            m = re.search(r"(\d{2,4})-\d+\s*$", name)
            if m:
                y = int(m.group(1))
                # если 4 цифры (2022) — обрежем до 2
                return y % 100
            # Фоллбэк: первое двузначное число, похожее на год (10..99).
            for token in re.findall(r"\d{2}", name):
                v = int(token)
                if 10 <= v <= 99:
                    return v
            return 0

        def _extract_subgroup(name: str) -> int:
            m = re.search(r"-(\d+)\s*$", name)
            return int(m.group(1)) if m else 0

        def _sort_key(g: GroupSchedule):
            year = _extract_year(g.name)
            sub  = _extract_subgroup(g.name)
            # 1) Курс из БД. Если он 0 — вычисляем из года приёма.
            if g.course and g.course > 0:
                course = g.course
            else:
                # Современный год (2 цифры): если today — сентябрь-декабрь — тот же год,
                # если январь-август — предыдущий (учебный год).
                today = date.today()
                academic_year_start = today.year if today.month >= 9 else today.year - 1
                course = max(1, (academic_year_start % 100) - year + 1) if year else 99
            # Главный ключ: курс по возрастанию (1 -> 2 -> 3 -> ...).
            # Дальше — год приёма по убыванию (больше год = младше курс).
            # Затем — номер подгруппы по возрастанию, и в конце — естественная сортировка.
            natural = [int(p) if p.isdigit() else p.lower()
                       for p in re.split(r"(\d+)", g.name)]
            return (course, -year, sub, natural)

        college_groups.sort(key=_sort_key)
        university_groups.sort(key=_sort_key)

        # 5. Список дней
        show_weekends = bool(self.cfg.get("display", {}).get("show_weekends", False))
        days: list[dict] = []
        cursor = start_date
        while cursor <= end_date:
            if show_weekends or cursor.weekday() < 5:
                days.append({
                    "date": cursor.isoformat(),
                    "weekday": WEEKDAY_RU[cursor.weekday()],
                    "short": cursor.strftime("%d.%m"),
                })
            cursor += timedelta(days=1)

        return {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "days": days,
            "college": [g.to_dict() for g in college_groups],
            "university": [g.to_dict() for g in university_groups],
            "stats": {
                "college_groups": len(college_groups),
                "university_groups": len(university_groups),
                "lessons": total_read,
            },
        }


# ---------------------------------------------------------------------------
# Помощник расчёта диапазона дат по конфигу
# ---------------------------------------------------------------------------
def compute_date_range(cfg_snapshot: dict, today: date | None = None) -> tuple[date, date]:
    disp = cfg_snapshot.get("display", {}) if cfg_snapshot else {}
    period = disp.get("period", "week")
    start_mode = disp.get("start", "monday")

    if today is None:
        today = date.today()

    if start_mode == "monday":
        start = today - timedelta(days=today.weekday())
    else:  # 'today'
        start = today

    lengths = {"day": 1, "week": 7, "2weeks": 14, "3weeks": 21, "month": 30}
    length = lengths.get(period, 7)
    end = start + timedelta(days=length - 1)
    return start, end
