# The Spotiflix "Cinematic Intelligence" Architecture

Instead of treating tracks as isolated rows in a database, this architecture treats the user's session as a cinematic journey. It consists of four distinct AI pillars working in harmony:

## 1. The "Universe Graph" (Multi-Modal GNN)
* **Inspired by:** *Socially Aware Music Recommendation: A Multi-Modal GNN Approach*
* **The Concept:** Standard engines group songs by audio (`danceability`, `tempo`). But since Spotiflix plays *videos*, the visual aesthetic matters immensely. We construct a multi-partite Knowledge Graph connecting users, tracks, and visual semantics.
* **How it works:** By using Graph Neural Networks (GNNs), the engine passes "messages" between nodes. It can recommend a Rap song right after a Synth-Pop song not because they sound the same, but because their music videos share a "Neon Cyberpunk Aesthetic." 
* **Data Mapping:** This leverages `db_clickhistory.csv` and `data.csv` to map complex, non-obvious transitions that standard filtering misses.

## 2. The "Director" Layer (Conversational LLM Interface)
* **Inspired by:** *Multimodal Music Recommendation Systems using Tool-Augmented LLMs*
* **The Concept:** Traditional UIs rely on static genres or playlists. The "Director" is an LLM that parses deep, highly subjective user intents.
* **How it works:** Imagine a search bar or a voice prompt where a user says, *"Play something moody and cinematic with high production value for a late-night drive."* The LLM translates this semantic request into exact vector constraints (e.g., `valence < 0.3`, `acousticness > 0.5`, `video_style = cinematic`), queries the GNN, and instantly generates a bespoke Netflix-style "row" as a temporary playlist.

## 3. The "Flow Engine" (Contrastive Sequence Transformers)
* **Inspired by:** *Enhancing Sequential Music Recommendation with Contrastive Learning (SASRec/BERT4Rec)*
* **The Concept:** Music listening is highly repetitive, yet moods can shift instantly. Traditional models struggle to balance long-term preferences with short-term mood swings.
* **How it works:** As the user watches videos (the "Up Next" autoplay feature), a Transformer model (like BERT4Rec) analyzes the exact sequence of the last 10 videos. Utilizing *contrastive learning*, it disentangles immediate session intent from long-term taste. If a user manually skips a high-energy video (`skipSource = 'manual'`), the Flow Engine instantly pivots the latent trajectory toward slower-paced content in real time.
* **Data Mapping:** This is powered entirely by the micro-signals in `db_watchhistory.csv` (specifically `durationWatched` and `skipSource`).

## 4. The "Showrunner" (Deep Reinforcement Learning & Contextual Bandits)
* **Inspired by:** *Reinforcement Learning and Contextual Bandits for Playlist Generation*
* **The Concept:** The biggest flaw in Spotify and YouTube algorithms is the "Echo Chamber"—recommending the exact same artists repeatedly because they have a high immediate click-through rate.
* **How it works:** Spotiflix treats the user's lifetime on the platform as a Markov Decision Process (MDP). An RL agent (the "Showrunner") optimizes for **long-term cumulative watch time** rather than instant clicks. 
  * It uses **Contextual Bandits** to intentionally inject "Exploration" tracks (risky, novel music videos) between "Exploitation" tracks (guaranteed favorites).
  * If the user hovers over an exploration track but doesn't click (captured in `db_hoverhistory.csv`), the bandit updates its confidence interval instantly without penalizing the track as a hard "dislike."

---

### How to Build This (Phase-by-Phase Execution)

You don't have to build this all at once. Since you have the telemetry data ready in `spotiflix/ml/synthetic_data/`, you can layer this in iteratively:

1. **V1 (The Baseline):** Start with **Contextual Bandits (LinUCB)** for your Netflix rows. It's incredibly computationally cheap but provides that dynamic "Exploration vs. Exploitation" feel immediately. Use `data.csv` (audio features) as your context vector and `db_like.csv` + `db_watchhistory.csv` as your reward signal.
2. **V2 (The Flow):** Implement a lightweight **SASRec (Self-Attention Sequential Recommendation)** model for the "Autoplay / Up Next" video queue to capture short-term session intent.
3. **V3 (The Universe):** Train the **Multi-Modal GNN** to start mapping visual similarities between music videos, breaking out of standard genre constraints.

This approach transitions Spotiflix from being a "music player" into a highly dynamic, intelligent visual DJ that constantly adapts to the user's micro-interactions in real time. 

Does this cinematic, multi-agent architecture align better with the ambitious vision you have for the project? We can dive into the math or Python code for the Contextual Bandit (V1) if you are ready to start experimenting!