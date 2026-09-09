import sqlite3
from datetime import datetime, timezone

def fix_all_datetime_columns():
    conn = sqlite3.connect('prisma/dev.db')
    cur = conn.cursor()

    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall() if not r[0].startswith('sqlite_') and not r[0].startswith('_')]

    for table in tables:
        cur.execute(f"PRAGMA table_info(\"{table}\")")
        columns = cur.fetchall()
        date_cols = [c[1] for c in columns if c[2].upper() in ('DATETIME', 'TIMESTAMP') or c[1].endswith('At') or c[1].endswith('Date')]
        
        if not date_cols:
            continue

        print(f"Table '{table}' date columns: {date_cols}")
        cur.execute(f"SELECT rowid, * FROM \"{table}\"")
        rows = cur.fetchall()
        col_names = ['_rowid_'] + [c[1] for c in columns]

        for row in rows:
            updates = []
            rowid = row[0]
            for col in date_cols:
                idx = col_names.index(col)
                val = row[idx]
                if val is not None:
                    if isinstance(val, (int, float)):
                        ts = val / 1000.0 if val > 10000000000 else float(val)
                        try:
                            iso_val = datetime.fromtimestamp(ts, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
                            updates.append((col, iso_val))
                        except Exception as e:
                            print(f"Error converting ts {val}: {e}")
                    elif isinstance(val, str):
                        if val.isdigit():
                            val_num = int(val)
                            ts = val_num / 1000.0 if val_num > 10000000000 else float(val_num)
                            iso_val = datetime.fromtimestamp(ts, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
                            updates.append((col, iso_val))
                        elif not val.endswith('Z') and 'T' in val:
                            updates.append((col, val + 'Z'))

            if updates:
                set_clauses = ", ".join([f"\"{col}\" = ?" for col, _ in updates])
                values = [new_val for _, new_val in updates]
                values.append(rowid)
                cur.execute(f"UPDATE \"{table}\" SET {set_clauses} WHERE rowid = ?", values)

        conn.commit()

    conn.close()
    print("All datetime columns converted successfully with rowid!")

if __name__ == '__main__':
    fix_all_datetime_columns()
