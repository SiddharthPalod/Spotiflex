# Recommendation System Approaches for Spotiflix

Here is a simplified comparison of the possible approaches we can implement, ordered roughly from easiest to most complex.

| Approach | Scoring Method | Advantages | Disadvantages | Difficulty (1-5) |
| :--- | :--- | :--- | :--- | :--- |
| **1. Content-Based Filtering** (KNN / Cosine) | Cosine similarity between track audio features (`valence`, `energy`, etc.) and the user's top genres/tags. | Solves the cold-start problem easily. No need for historical user data. Great for finding sonically similar tracks. | Can create "filter bubbles" where the user only gets very similar songs. Misses out on community trends. | ⭐ (1/5) |
| **2. Collaborative Filtering** (Matrix Factorization / ALS) | Dot product of User Embeddings and Track Embeddings learned from historical interactions. | Discovers non-obvious connections (e.g., users who like Metal also like this specific Classical track). | "Cold Start" problem: Cannot recommend new songs that have zero plays, or understand new users with zero history. | ⭐⭐ (2/5) |
| **3. Hybrid (Two-Tower Neural Net)** | Neural network mapping both User/History vectors and Track/Audio vectors into the same space. | Best of both worlds: handles cold starts (via audio features) AND community trends (via interaction history). | Requires more setup (PyTorch/TensorFlow). Needs tuning of hyperparameters and negative sampling. | ⭐⭐⭐ (3/5) |
| **4. Contextual Bandits** (LinUCB / Thompson) | Reward-based (Reward = Likes + Watch Duration - Skips). Updates confidence bounds in real-time. | Instantly adapts to user mood. Intentionally explores new music to prevent echo chambers. | Requires a real-time feedback loop. Harder to debug than static models. | ⭐⭐⭐⭐ (4/5) |
| **5. Sequential Deep Learning** (SASRec / RNNs) | Transformer/RNN predicting the *next* item based on the sequence of the last N watched tracks. | Perfectly captures short-term session intent (e.g., late-night chill vs. workout mode). High accuracy for "Up Next". | Computationally heavy. Requires long session sequences to train effectively. | ⭐⭐⭐⭐⭐ (5/5) |

## Useful Links (Copy and retrain to our needs)
https://www.kaggle.com/code/vatsalmavani/music-recommendation-system-using-spotify-dataset
https://www.kaggle.com/code/phamvanvung/linucb-thompson-sampling
https://github.com/kang205/SASRec
