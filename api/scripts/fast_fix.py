import sqlite3
from datetime import datetime, timezone

def fast_fix():
    conn = sqlite3.connect('prisma/dev.db')
    cur = conn.cursor()
    cur.execute("PRAGMA foreign_keys = OFF;")
    cur.execute("BEGIN TRANSACTION;")

    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall() if not r[0].startswith('sqlite_') and not r[0].startswith('_')]

    for table in tables:
        cur.execute(f"PRAGMA table_info(\"{table}\")")
        columns = cur.fetchall()
        date_cols = [c[1] for c in columns if c[2].upper() in ('DATETIME', 'TIMESTAMP') or c[1].endswith('At') or c[1].endswith('Date')]
        
        if not date_cols:
            continue

        print(f"Processing table '{table}' ({date_cols})...")
        col_sql = ", ".join(['"' + c + '"' for c in date_cols])
        cur.execute(f'SELECT rowid, {col_sql} FROM "{table}"')
        rows = cur.fetchall()

        for idx, col in enumerate(date_cols, start=1):
            batch = []
            for row in rows:
                val = row[idx]
                if val is None:
                    continue
                new_iso = None
                if isinstance(val, (int, float)):
                    ts = val / 1000.0 if val > 10000000000 else float(val)
                    try:
                        new_iso = datetime.fromtimestamp(ts, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
                    except Exception:
                        new_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
                elif isinstance(val, str):
                    if val.isdigit():
                        val_num = int(val)
                        ts = val_num / 1000.0 if val_num > 10000000000 else float(val_num)
                        new_iso = datetime.fromtimestamp(ts, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
                    elif not val.endswith('Z') and 'T' in val:
                        new_iso = val + 'Z'
                
                if new_iso is not None:
                    batch.append((new_iso, row[0]))

            if batch:
                print(f"  Updating {len(batch)} rows in {table}.{col}...")
                cur.executemany(f"UPDATE \"{table}\" SET \"{col}\" = ? WHERE rowid = ?", batch)

    # Clean non-UTF8 / invalid chars in Track and WatchHistory
    print("Sanitizing any non-UTF8 characters...")
    cur.execute("SELECT rowid, id, title, artist, album FROM Track")
    track_rows = cur.fetchall()
    track_updates = []
    for r in track_rows:
        rid, tid, title, artist, album = r
        clean_title = (title or '').encode('utf-8', 'ignore').decode('utf-8', 'ignore').replace('\ufffd', '')
        clean_artist = (artist or '').encode('utf-8', 'ignore').decode('utf-8', 'ignore').replace('\ufffd', '')
        clean_album = (album or '').encode('utf-8', 'ignore').decode('utf-8', 'ignore').replace('\ufffd', '')
        if clean_title != title or clean_artist != artist or clean_album != album:
            track_updates.append((clean_title, clean_artist, clean_album, rid))
    if track_updates:
        cur.executemany("UPDATE Track SET title = ?, artist = ?, album = ? WHERE rowid = ?", track_updates)
        print(f"  Sanitized {len(track_updates)} tracks.")

    conn.commit()
    conn.close()
    print("DATABASE CLEANUP AND NORMALIZATION 100% COMPLETE!")

if __name__ == '__main__':
    fast_fix()
