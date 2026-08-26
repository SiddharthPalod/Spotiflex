# Spotiflix ML Final Architecture Document

## 1. System Overview

The Spotiflix Recommendation Engine is a hybrid, multi-stage recommender system designed to serve personalized track recommendations with low latency while continuously adapting to user feedback. The system follows a standard two-stage funnel:
1. **Candidate Retrieval (Stage 1):** Retrieves ~200 candidates from a large catalog using multiple blended channels (Content ANN, ALS Collaborative Filtering, and Popularity Fallback).
2. **Re-ranking (Stage 2):** Scores and ranks candidates using a contextual bandit (Hybrid LinUCB) to balance exploitation of known user preferences with exploration of the long-tail catalog.

## 2. Ingestion & Reward Engine

User interactions are mapped to explicit and implicit reward signals, converting streams of behavioral telemetry into numeric values.

### Reward Formulation
The system captures multiple modalities of feedback:
- **Like Signal ($L_t$):** Explicit feedback (+1 for like, -1 for unlike).
- **Watch Signal ($W_t$):** Primary implicit feedback based on the listen duration ratio, modulated by the exit type (`manual`, `auto`, `closed`, `back`). Short watch times combined with explicit exit actions (e.g., back button) yield heavy negative rewards.
- **Hover Signal ($H_t$):** Log-compressed passive interest signal.
- **Click Signal ($K_t$):** Contextual weight based on where the track was clicked (recommendation vs search).

**Total Reward Function:**
$$r_t = 3.0 \cdot L_t + 2.5 \cdot W_t + 0.3 \cdot H_t + 0.2 \cdot K_t$$

These rewards feed into the online user profile updates, the online LinUCB re-ranker, and the offline implicit ALS matrix.

## 3. Feature Engineering & Vector Representation

### Track Vectors (Static Features)
Raw audio features (acousticness, danceability, energy, etc.) are standardized using Z-score normalization (`StandardScaler`). These are concatenated with genre embeddings to form a comprehensive static feature vector for each track, $x_a$.

### User Profile Vectors (Dynamic Features)
Instead of relying strictly on historical lists, the system maintains a unified profile vector $u_t$ for each user in the same dimensionality space as the track vectors. The profile is updated dynamically online via an Exponentially Weighted Moving Average (EMA):

$$u_t = (1 - \alpha)u_{t-1} + \alpha \cdot r_t \cdot x_{a_t}$$

Where $\alpha$ dictates the decay rate (taste drift) and $r_t$ pulls the user's vector toward or away from the track's region based on the reward.

## 4. Stage 1: Candidate Generation

The retrieval phase utilizes three independent channels to generate ~200 candidate tracks.

### Channel A: Content-Based ANN (FAISS)
Uses the user profile vector $u_t$ to query a Hierarchical Navigable Small World (HNSW) index via FAISS. It operates on cosine similarity against the track vector $x_a$. Approximate Nearest Neighbors allows the retrieval to be highly scalable and non-exhaustive.

### Channel B: Collaborative Filtering (ALS)
Builds an implicit feedback matrix using aggregated rewards. The matrix is factorized using Alternating Least Squares (ALS) to generate learned latent factors for users ($p_u$) and tracks ($q_a$).
$$Score_{CF}(a) = p_u^T q_a$$

### Channel C: Popularity & Fallback
A fallback strategy geared toward cold-start users. Ranks tracks primarily by Last.fm playcounts and genre matching heuristics, dampened by a time-decay freshness factor.

### Candidate Blending & Soft Filtering
Scores from the three channels are blended using dynamically adjusted weights ($\gamma_1, \gamma_2, \gamma_3$) based on the user's interaction count. A language soft-filter is applied multiplicatively to dampen (but not entirely exclude) tracks outside of the user's active listening languages.

## 5. Stage 2: Re-ranking via Hybrid LinUCB

The top ~50 blended candidates from Stage 1 are passed to Stage 2 for contextual re-ranking. Rather than independent arm models that starve long-tail tracks, the system uses a **Hybrid Linear Bandit**.

The expected reward relies on two sets of weights:
- **Shared Parameters ($\beta$):** A global parameter vector learned from *all* interactions across *all* tracks, leveraging shared cross-features (e.g., element-wise product of user profile and track features).
- **Per-Arm Parameters ($\theta_a$):** Track-specific weights maintained only for "hot arms" (tracks exceeding a minimum interaction threshold).

**UCB Score Function:**
$$p_t(a) = z_{t,a}^T \beta + x_{t,a}^T \theta_a + \alpha_{ucb} \sqrt{z_{t,a}^T A_0^{-1} z_{t,a} + x_{t,a}^T A_a^{-1} x_{t,a}}$$

Candidates are sorted descending by $p_t(a)$, and the top 10 are served to the client API.

## 6. System Architecture & Tech Stack

The architecture distinctly splits workloads to ensure low-latency online serving.

### Offline / Batch Layer
- **Cadence:** Hourly / Nightly
- **Responsibilities:** Ingesting catalog metadata, normalizing audio features, updating FAISS indices, computing ALS factorizations, and batch API enrichments (Last.fm metadata).
- **Tools:** Pandas, scikit-learn, FAISS, `implicit` library.

### Online / Streaming Layer
- **Cadence:** Real-time (sub-second)
- **Responsibilities:** Reward calculation, updating EMA user profiles, candidate blending, and Hybrid LinUCB scoring and state updates.
- **Tools:** FastAPI (Inference Server), NumPy, SciPy (Sparse operations).

### Workflow
1. User interacts (listen, like, skip).
2. Telemetry gateway captures event.
3. Online reward calculator formulates $r_t$.
4. User profile $u_t$ is updated in memory/store.
5. LinUCB matrices ($A_0, A_a, b_0, b_a$) are incrementally updated.
6. The next API request fetches updated recommendations seamlessly.
