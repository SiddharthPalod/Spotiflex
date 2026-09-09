import sqlite3

def check():
    conn = sqlite3.connect('prisma/dev.db')
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    print('TABLES:', cur.fetchall())

    cur.execute("PRAGMA table_info(WatchHistory)")
    print('WatchHistory schema:', cur.fetchall())

    cur.execute("SELECT * FROM WatchHistory")
    rows = cur.fetchall()
    print(f'WatchHistory rows ({len(rows)}):')
    for r in rows:
        print(' ', r)

    cur.execute("SELECT * FROM \"Like\"")
    likes = cur.fetchall()
    print(f'Like rows ({len(likes)}):')
    for l in likes:
        print(' ', l)

    cur.execute("SELECT * FROM Playlist")
    pl = cur.fetchall()
    print('Playlists:', pl)

    cur.execute("SELECT * FROM PlaylistTrack")
    plt = cur.fetchall()
    print('PlaylistTracks:', plt)

    cur.execute("SELECT id, name, email FROM User")
    users = cur.fetchall()
    print('Users:', users)

if __name__ == '__main__':
    check()
