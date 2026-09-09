import sqlite3
import sys

def check_users():
    conn = sqlite3.connect('prisma/dev.db')
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(User)")
    cols = [c[1] for c in cur.fetchall()]
    print('User columns:', cols)

    cur.execute("SELECT * FROM User")
    users = cur.fetchall()
    print(f'Total Users: {len(users)}')
    for u in users:
        print('--- User Row ---')
        for col_name, val in zip(cols, u):
            print(f"  {col_name} ({type(val)}): {repr(val)}")

if __name__ == '__main__':
    check_users()
