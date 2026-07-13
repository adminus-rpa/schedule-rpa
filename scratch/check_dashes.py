import sys
from app.db.base import MDBToolsBackend

backend = MDBToolsBackend('schedule.mdb')

import subprocess
tables_output = subprocess.check_output(['mdb-tables', '-1', 'schedule.mdb'], text=True)
tables = [t.strip() for t in tables_output.splitlines() if t.strip()]

empty_rooms = set()
dash_rooms = set()
eois_variants = set()

for table in tables:
    try:
        rows = backend.query_all(table)
        for row in rows:
            for k, v in row.items():
                val = str(v).strip()
                if 'ЭОИС' in val.upper():
                    eois_variants.add(val)
                # Check if it's the room column. We don't know the exact name, let's assume it contains 'Ауд' or 'Каб' or we just check all columns
                if val == '-' or val == '—' or val == '–':
                    dash_rooms.add(val)
    except Exception as e:
        pass

print("ЭОИС variants found:", eois_variants)
print("Dash variants found:", dash_rooms)
