# Spotiflix Telemetry Dataset Schema

This document details the database schemas and CSV structures for the ML Telemetry Dataset. It is designed to help Data Engineers and Machine Learning Engineers understand the shapes, null handling, and expected values for each table to build robust recommendation models (Collaborative Filtering, Content-Based Filtering, Reinforcement Learning).

> [!NOTE]
> All IDs in this dataset are either UUIDs or standard Last.fm/Spotify string IDs. Null handling is strictly enforced at the database level.

---

## 1. Track (`db_track.csv`)
Represents the core catalog of playable media (songs and albums).

| Column | Type | Null Handling | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String (PK) | Cannot be null | Unique identifier (Spotify/Last.fm ID). | `4BJqT0PrAfrxzMOxytFOIz` |
| `title` | String | Fallback to `'Unknown'` | Title of the track or album. | `Highway to Hell` |
| `artist` | String | Fallback to `'Unknown'` | Primary artist name(s). | `AC/DC` |
| `album` | String | Fallback to empty string `''` | Name of the album (if applicable). | `Back in Black` |
| `isAlbum` | Boolean (0/1) | Cannot be null | `1` if this row represents a full album, `0` for a track. | `0` |
| `youtubeVideoId` | String | `NULL` if not yet cached | Resolved YouTube Video ID for playback. | `l482T0yNkeo` |
| `coverArtUrl` | String | `NULL` if not found | URL to high-res album art. | `https://lastfm.freetls...` |
| `tags` | String | `NULL` if no tags | Comma-separated genres/moods for Content Filtering. | `rock,metal,classic` |
| `createdAt` | DateTime | Cannot be null | ISO-8601 timestamp of creation. | `2026-07-28T00:00:00.000Z` |

---

## 2. User (`db_user.csv`)
Represents the users generating interactions.

| Column | Type | Null Handling | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String (PK) | Cannot be null | UUID of the user. | `a1b2c3d4...` |
| `email` | String | Cannot be null | Unique email address. | `rockfan1@kaggle.local` |
| `name` | String | `NULL` if not provided | Display name. | `ML User 1` |
| `createdAt` | DateTime | Cannot be null | Account creation time. | `2026-07-28T00:00:00.000Z` |

---

## 3. Like (`db_like.csv`)
Explicit user feedback (Thumbs Up / Thumbs Down). High weight for Collaborative Filtering.

| Column | Type | Null Handling | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String (PK) | Cannot be null | UUID of the like event. | `b2c3d4e5...` |
| `userId` | String | Cannot be null | Foreign Key to User. | `a1b2c3d4...` |
| `trackId` | String | Cannot be null | Foreign Key to Track. | `4BJqT0Pr...` |
| `isLike` | Boolean (0/1) | Cannot be null | `1` for Like, `0` for Unlike (Dislike). | `1` |
| `createdAt` | DateTime | Cannot be null | Timestamp of the like event. | `2026-07-27T23:55:00.000Z` |

---

## 4. WatchHistory (`db_watchhistory.csv`)
Rich implicit feedback capturing how long a user engaged with media and how they exited.

| Column | Type | Null Handling | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String (PK) | Cannot be null | UUID of the watch session. | `c3d4e5f6...` |
| `userId` | String | Cannot be null | Foreign Key to User. | `a1b2c3d4...` |
| `trackId` | String | Cannot be null | Foreign Key to Track. | `4BJqT0Pr...` |
| `watchedAt` | DateTime | Cannot be null | Timestamp of when the session started. | `2026-07-15T14:30:00.000Z` |
| `durationWatched`| Integer | Defaults to `0` | Total seconds the media was actively played. | `180` |
| `completed` | Boolean (0/1) | Defaults to `0` | `1` if media played to the end, `0` if skipped. | `1` |
| `skipSource` | String | `NULL` if `completed = 1` | Reason for aborting: `'manual'` (clicked next), `'closed'` (exited player), `'auto'` (auto-play timeout). | `manual` |

---

## 5. HoverHistory (`db_hoverhistory.csv`)
Micro-interaction data tracking user interest and hesitation. Excellent for measuring passive engagement.

| Column | Type | Null Handling | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String (PK) | Cannot be null | UUID of the hover event. | `d4e5f6g7...` |
| `userId` | String | Cannot be null | Foreign Key to User. | `a1b2c3d4...` |
| `trackId` | String | Cannot be null | Foreign Key to Track. | `4BJqT0Pr...` |
| `isAlbum` | Boolean (0/1) | Cannot be null | `1` if the hovered card was an album, `0` for track. | `0` |
| `durationMs` | Integer | Cannot be null | Milliseconds the cursor rested on the card. | `3500` |
| `hoveredAt` | DateTime | Cannot be null | Timestamp of the hover event. | `2026-07-20T10:15:00.000Z` |

---

## 6. ClickHistory (`db_clickhistory.csv`)
Tracks where a user's intent originated from before media playback or modal opening.

| Column | Type | Null Handling | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String (PK) | Cannot be null | UUID of the click event. | `e5f6g7h8...` |
| `userId` | String | Cannot be null | Foreign Key to User. | `a1b2c3d4...` |
| `trackId` | String | Cannot be null | Foreign Key to Track. | `4BJqT0Pr...` |
| `isAlbum` | Boolean (0/1) | Cannot be null | `1` if the clicked card was an album, `0` for track. | `0` |
| `clickedAt` | DateTime | Cannot be null | Timestamp of the click event. | `2026-07-21T09:00:00.000Z` |
| `source` | String | Defaults to `'browse'`| Origin UI area: `'browse'`, `'search'`, or `'recommendation'`. | `search` |

---

## 7. SearchHistory (`db_searchhistory.csv`)
Tracks user search queries to analyze missing content or genre interests.

| Column | Type | Null Handling | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String (PK) | Cannot be null | UUID of the search event. | `f6g7h8i9...` |
| `userId` | String | Cannot be null | Foreign Key to User. | `a1b2c3d4...` |
| `query` | String | Cannot be null | The raw text the user searched for. | `rock` |
| `resultCount` | Integer | Defaults to `0` | How many results Last.fm/DB returned. | `15` |
| `searchedAt` | DateTime | Cannot be null | Timestamp of the search event. | `2026-07-22T08:30:00.000Z` |

---

## 8. Spotify Audio Features (`data.csv`)
Contains raw track data and their audio features extracted from the Spotify dataset.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | String (PK) | Spotify ID for the track. |
| `name` | String | Title of the track. |
| `artists` | String | List of artists. |
| `year`, `release_date` | Integer/String | Year and specific release date of the track. |
| `explicit` | Boolean | Whether the track is explicit (1) or not (0). |
| `popularity` | Integer | Track popularity rating. |
| `duration_ms` | Integer | Length of the track in milliseconds. |
| *Audio Features* | Float/Integer | Attributes like `acousticness`, `danceability`, `energy`, `instrumentalness`, `liveness`, `loudness`, `speechiness`, `tempo`, `valence`, `key`, `mode`. |

---

## 9. Data by Artist (`data_by_artist.csv`)
Aggregated audio features and metrics grouped by artist.

| Column | Type | Description |
| :--- | :--- | :--- |
| `artists` | String (PK) | Primary artist name. |
| `count` | Integer | Number of tracks by the artist. |
| `popularity` | Integer | Average popularity of the artist's tracks. |
| *Audio Features* | Float/Integer | Average values for `acousticness`, `danceability`, `duration_ms`, `energy`, `instrumentalness`, `liveness`, `loudness`, `speechiness`, `tempo`, `valence`, `key`, `mode`. |

---

## 10. Data by Genre (`data_by_genres.csv`)
Aggregated audio features and metrics grouped by genre.

| Column | Type | Description |
| :--- | :--- | :--- |
| `genres` | String (PK) | Genre name. |
| `popularity` | Integer | Average popularity for the genre. |
| *Audio Features* | Float/Integer | Average values for `acousticness`, `danceability`, `duration_ms`, `energy`, `instrumentalness`, `liveness`, `loudness`, `speechiness`, `tempo`, `valence`, `key`, `mode`. |

---

## 11. Data by Year (`data_by_year.csv`)
Aggregated audio features and metrics over time (by year).

| Column | Type | Description |
| :--- | :--- | :--- |
| `year` | Integer (PK) | The release year. |
| `popularity` | Integer | Average popularity of tracks from that year. |
| *Audio Features* | Float/Integer | Average values for `acousticness`, `danceability`, `duration_ms`, `energy`, `instrumentalness`, `liveness`, `loudness`, `speechiness`, `tempo`, `valence`, `key`, `mode`. |

---

## 12. Data with Genres (`data_w_genres.csv`)
Provides artist information combined with their associated genres.

| Column | Type | Description |
| :--- | :--- | :--- |
| `artists` | String (PK) | Artist name. |
| `genres` | String | List of genres associated with the artist. |
| `count` | Integer | Number of tracks by the artist. |
| `popularity` | Integer | Average popularity rating. |
| *Audio Features* | Float/Integer | Average values for `acousticness`, `danceability`, `duration_ms`, `energy`, `instrumentalness`, `liveness`, `loudness`, `speechiness`, `tempo`, `valence`, `key`, `mode`. |
