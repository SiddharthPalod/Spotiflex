import sqlite3
import csv
import random
import uuid
from datetime import datetime, timedelta

DB_PATH = '../api/prisma/dev.db'
CSV_PATH = 'synthetic_data/data.csv'

NUM_USERS = 5000
NUM_LIKES = 200000
NUM_WATCHES = 300000
NUM_HOVERS = 500000
NUM_CLICKS = 400000

print("Connecting to SQLite database...")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# 1. Load Tracks from Kaggle CSV
print(f"Reading tracks from {CSV_PATH}...")
tracks = []
with open(CSV_PATH, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # We only need enough info to populate our Track table
        # Track(id, title, artist, album, isAlbum, youtubeVideoId, coverArtUrl, tags)
        tracks.append({
            'id': row['id'],
            'title': row['name'],
            'artist': row['artists'].strip("[]'").replace("', '", ", "), # Clean array string
            'popularity': int(row['popularity'])
        })

# Sort tracks by popularity so we can weight interactions towards popular songs
tracks.sort(key=lambda x: x['popularity'], reverse=True)
top_tracks = tracks[:20000] # Use top 20k tracks for 90% of interactions
all_track_ids = [t['id'] for t in tracks]
top_track_ids = [t['id'] for t in top_tracks]

print(f"Loaded {len(tracks)} total tracks.")

# Insert tracks into SQLite (ignore if exists)
print("Bulk inserting tracks into DB...")
track_tuples = [(t['id'], t['title'], t['artist'], '', 0, None, None, None) for t in tracks]
cursor.executemany('''
    INSERT OR IGNORE INTO Track (id, title, artist, album, isAlbum, youtubeVideoId, coverArtUrl, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
''', track_tuples)
conn.commit()


# 2. Generate Users
print(f"Generating {NUM_USERS} synthetic users...")
users = []
user_tuples = []
for i in range(NUM_USERS):
    user_id = str(uuid.uuid4())
    users.append(user_id)
    now_ts = datetime.now().isoformat()
    user_tuples.append((user_id, f"SyntheticUser{i}@kaggle.local", f"ML User {i}", now_ts, now_ts))

cursor.executemany('''
    INSERT OR IGNORE INTO User (id, email, name, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?)
''', user_tuples)
conn.commit()


# Helper to pick tracks (Power law distribution: popular tracks get picked more)
def get_random_track_id():
    if random.random() < 0.8:
        return random.choice(top_track_ids)
    return random.choice(all_track_ids)

# 3. Generate Likes
print(f"Generating {NUM_LIKES} likes...")
like_tuples = set()
while len(like_tuples) < NUM_LIKES:
    uid = random.choice(users)
    tid = get_random_track_id()
    # (id, userId, trackId, isLike)
    like_id = str(uuid.uuid4())
    like_tuples.add((like_id, uid, tid, 1))

cursor.executemany('''
    INSERT OR IGNORE INTO Like (id, userId, trackId, isLike)
    VALUES (?, ?, ?, ?)
''', list(like_tuples))
conn.commit()

# 4. Generate Watches
print(f"Generating {NUM_WATCHES} watches...")
watch_tuples = []
now = datetime.now()
for _ in range(NUM_WATCHES):
    uid = random.choice(users)
    tid = get_random_track_id()
    wid = str(uuid.uuid4())
    completed = 1 if random.random() > 0.4 else 0
    duration = 180 if completed else random.randint(5, 120)
    skip = None if completed else random.choice(['manual', 'closed', 'next'])
    
    # timestamp within last 30 days
    ts = (now - timedelta(days=random.randint(0, 30), minutes=random.randint(0, 1000))).isoformat()
    watch_tuples.append((wid, uid, tid, duration, completed, skip, ts))

cursor.executemany('''
    INSERT INTO WatchHistory (id, userId, trackId, durationWatched, completed, skipSource, watchedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
''', watch_tuples)
conn.commit()

# 5. Generate Hovers
print(f"Generating {NUM_HOVERS} hovers...")
hover_tuples = []
for _ in range(NUM_HOVERS):
    uid = random.choice(users)
    tid = get_random_track_id()
    hid = str(uuid.uuid4())
    dur = random.randint(500, 8000)
    ts = (now - timedelta(days=random.randint(0, 30))).isoformat()
    hover_tuples.append((hid, uid, tid, 0, dur, ts))

cursor.executemany('''
    INSERT INTO HoverHistory (id, userId, trackId, isAlbum, durationMs, hoveredAt)
    VALUES (?, ?, ?, ?, ?, ?)
''', hover_tuples)
conn.commit()

# 6. Generate Clicks
print(f"Generating {NUM_CLICKS} clicks...")
click_tuples = []
for _ in range(NUM_CLICKS):
    uid = random.choice(users)
    tid = get_random_track_id()
    cid = str(uuid.uuid4())
    source = random.choice(['browse', 'search', 'recommendation'])
    ts = (now - timedelta(days=random.randint(0, 30))).isoformat()
    click_tuples.append((cid, uid, tid, 0, source, ts))

cursor.executemany('''
    INSERT INTO ClickHistory (id, userId, trackId, isAlbum, source, clickedAt)
    VALUES (?, ?, ?, ?, ?, ?)
''', click_tuples)
conn.commit()

conn.close()
print("Massive dataset successfully seeded into SQLite!")
