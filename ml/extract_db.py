import sqlite3
import csv
import os

DB_PATH = '../api/prisma/dev.db'
OUTPUT_DIR = 'synthetic_data'

TABLES = [
    'User',
    'Track',
    'Like',
    'WatchHistory',
    'HoverHistory',
    'ClickHistory',
    'SearchHistory'
]

print("Extracting SQLite Database to CSVs...")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

os.makedirs(OUTPUT_DIR, exist_ok=True)

for table in TABLES:
    print(f"Exporting {table}...")
    try:
        cursor.execute(f"SELECT * FROM {table}")
        rows = cursor.fetchall()
        
        # Get column names
        col_names = [description[0] for description in cursor.description]
        
        csv_file_path = os.path.join(OUTPUT_DIR, f"db_{table.lower()}.csv")
        with open(csv_file_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(col_names)
            writer.writerows(rows)
            
        print(f"  - Wrote {len(rows)} rows to {csv_file_path}")
    except Exception as e:
        print(f"  - Failed to export {table}: {e}")

conn.close()
print("Database extraction complete!")
