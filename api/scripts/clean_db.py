import sqlite3
import re

def clean_database():
    conn = sqlite3.connect('prisma/dev.db')
    cur = conn.cursor()

    tables = ['Track', 'WatchHistory', 'Like', 'Playlist', 'PlaylistTrack', 'SearchHistory', 'ClickHistory', 'HoverHistory', 'User', 'Profile']

    print('--- Scanning database tables for corrupted characters ---')
    for table in tables:
        try:
            cur.execute(f"PRAGMA table_info({table})")
            columns = [col[1] for col in cur.fetchall()]
            
            cur.execute(f"SELECT * FROM \"{table}\"")
            rows = cur.fetchall()
            print(f"Table '{table}' has {len(rows)} rows.")

            for row in rows:
                updated_row = []
                has_corrupt = False
                for idx, val in enumerate(row):
                    if isinstance(val, str):
                        # check for replacement character or invalid surrogates
                        if '\ufffd' in val or any(ord(c) >= 0xD800 and ord(c) <= 0xDFFF for c in val):
                            cleaned_str = val.encode('utf-8', 'ignore').decode('utf-8', 'ignore').replace('\ufffd', '')
                            updated_row.append((columns[idx], cleaned_str))
                            has_corrupt = True
                        else:
                            # check if it's a date string that needs standard ISO format
                            if columns[idx].endswith('At') or columns[idx].endswith('Date'):
                                # ensure standard ISO
                                updated_row.append((columns[idx], val))
                
                if has_corrupt:
                    row_id = row[0]
                    id_col = columns[0]
                    set_clauses = ", ".join([f"\"{col}\" = ?" for col, _ in updated_row])
                    values = [val for _, val in updated_row]
                    values.append(row_id)
                    cur.execute(f"UPDATE \"{table}\" SET {set_clauses} WHERE \"{id_col}\" = ?", values)
                    print(f"  Fixed corrupted row in {table} id={row_id}")
            conn.commit()
        except Exception as e:
            print(f"Error checking table {table}: {e}")

    conn.close()
    print('--- Scan & Cleanup Complete ---')

if __name__ == '__main__':
    clean_database()
