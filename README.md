# Spotiflix 🎵📺

Spotiflix (or AudioFlix) is a next-generation music streaming application that combines the **binge-worthy visual hierarchy of Netflix** with the **auditory accuracy of Spotify's recommendation algorithms**, while utilizing **YouTube as the underlying CDN** for playing official music videos. 

Instead of traditional albums or playlists, Spotiflix presents music in a visual format where each banner represents a song or album, acting like "episodes" or "seasons" of a TV show.

---

## 🎯 Features & Core Concepts
- **Netflix UI for Music**: A highly engaging, visually rich interface tailored for music discovery.
- **Music Videos Only**: Never just audio—Spotiflix dynamically fetches and plays the official music video for every track via the YouTube IFrame Player API.
- **Global & Personal Recommendations**: 
  - **Cold Start**: Uses Spotify's API for curated global lists (Trending Now, Moods, Because you like [Artist]).
  - **Warm/Hot**: Transitions to a highly personalized custom Machine Learning engine as you interact with the app.
- **Albums as Seasons**: Albums are treated as shows, with variations (e.g., Remasters, Taylor's Versions) treated as different seasons!

---

## 🏗️ Project Structure

The project is split into three main microservices/folders:

- `netflix/` - **Frontend**: The React/Vite-based UI (inspired by Netflix clones) that handles the presentation layer and YouTube IFrame player integration.
- `api/` - **Backend**: A lightweight Node.js/Express server that acts as an API gateway, proxies requests to avoid exposing API keys, and manages the database (`dev.db`).
- `ml/` - **Recommendation Engine**: The Python-based data science and machine learning pipeline that computes personalized tracks and user profiling.

---

## 🧠 The Recommendation Engine Pipeline

To provide a personalized experience that matches or beats standard music apps, Spotiflix uses a hybrid Machine Learning architecture that blends content similarity, collaborative filtering, and sequential modeling.

### 1. Telemetry & Reward Function
Spotiflix relies on both explicit and implicit feedback:
- **Explicit Feedback**: Likes/Dislikes (`isLike`), Adding to playlists.
- **Implicit Feedback (Dominant Signal)**: Watch-time ratio (`durationWatched / track_duration_seconds`). A manual skip after 90% watch time is a positive signal, while a back-button press after 3 seconds is a strong negative signal. Hover durations and click sources also contribute minor weights.

### 2. Multi-Channel Candidate Retrieval (Stage 1)
For any user request, we retrieve ~200 candidate tracks by blending three channels:
- **Channel A (Content ANN)**: Uses Approximate Nearest Neighbors (HNSW via FAISS) to find tracks similar to the user's continuously evolving profile vector `u_t`.
- **Channel B (Collaborative Filtering)**: Implicit Alternating Least Squares (ALS) matches latent user factors with latent track factors based on aggregate interactions.
- **Channel C (Popularity Fallback)**: Used primarily for cold-starts (< 5 interactions). Relies on Last.fm playcounts and genre matching.

*(A Language Soft-Filter is applied to dampen tracks outside the user's active language set without completely killing discovery).*

### 3. Hybrid LinUCB Re-ranking (Stage 2)
The top ~50 candidates from Stage 1 are passed to a Contextual Bandit (Hybrid LinUCB).
- **Shared Parameters**: Captures global trends (time of day, session position) to give sensible scores to new tracks.
- **Per-Arm Parameters**: Captures specific behaviors for tracks with enough historical data.
- **Exploration Bonus**: Ensures the model occasionally surfaces under-explored tracks to refine its understanding of the user's taste.

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)
- YouTube Data API Key
- Spotify Web API Credentials

### 1. Frontend (`netflix/`)
```bash
cd spotiflix/netflix
npm install
npm run dev
```

### 2. Backend API (`api/`)
```bash
cd spotiflix/api
npm install
# Set up your .env file with database URLs and API keys
node server.js
```

### 3. ML Pipeline (`ml/`)
```bash
cd spotiflix/ml
python -m venv venv
source venv/bin/activate  # Or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
# Follow instructions in ml_plan.md to run offline batches and indexing
```

---

## 🔮 Future Scope
- Transitioning to **Deep Feature Interaction (PNN)** and **Sequential Short-Term modeling (BERT4Rec)** for advanced deep dive recommendations once telemetry data is vast.
- **Graph Self-Attention (gSASRec)** for surfacing deep cuts and preventing recommendation echo chambers.

---
*Spotiflix is an ongoing experiment at the intersection of UI/UX and advanced RecSys architecture.*
