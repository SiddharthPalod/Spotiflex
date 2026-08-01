import os
import pandas as pd
import numpy as np
import joblib
import scipy.sparse as sp
import implicit

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEATURE_STORE_DIR = os.path.join(BASE_DIR, 'feature_store')

def main():
    print("Loading resources...")
    user_index = joblib.load(os.path.join(FEATURE_STORE_DIR, 'user_index.pkl'))
    track_index = joblib.load(os.path.join(FEATURE_STORE_DIR, 'track_index.pkl'))
    
    user_id_to_idx = {uid: idx for idx, uid in enumerate(user_index)}
    track_id_to_idx = {tid: idx for idx, tid in enumerate(track_index)}
    
    num_users = len(user_index)
    num_tracks = len(track_index)
    print(f"Aligning matrices: {num_users} users, {num_tracks} tracks")
    
    print("Reading implicit rewards...")
    df_rewards = pd.read_csv(os.path.join(FEATURE_STORE_DIR, 'implicit_rewards.csv'))
    
    df_rewards = df_rewards[
        df_rewards['userId'].isin(user_id_to_idx) & 
        df_rewards['trackId'].isin(track_id_to_idx)
    ]
    
    print("Building CSR matrix...")
    user_indices = df_rewards['userId'].map(user_id_to_idx).values
    track_indices = df_rewards['trackId'].map(track_id_to_idx).values
    rewards = df_rewards['reward'].values
    
    user_item_matrix = sp.csr_matrix(
        (rewards, (user_indices, track_indices)), 
        shape=(num_users, num_tracks)
    )
    
    print("Training ALS model...")
    # In implicit >= 0.6, we pass the user_item matrix directly
    # Optimal parameters from tuning
    model = implicit.als.AlternatingLeastSquares(
        factors=128,
        regularization=0.1,
        iterations=15,
        calculate_training_loss=True,
        random_state=42
    )
    
    model.fit(user_item_matrix)
    
    print("Extracting latent factors...")
    user_factors = model.user_factors
    item_factors = model.item_factors
    
    print(f"User factors shape: {user_factors.shape}")
    print(f"Item factors shape: {item_factors.shape}")
    
    print("Saving artifacts...")
    np.save(os.path.join(FEATURE_STORE_DIR, 'als_user_factors.npy'), user_factors)
    np.save(os.path.join(FEATURE_STORE_DIR, 'als_track_factors.npy'), item_factors)
    
    print("Phase 5 ALS Builder completed successfully.")

if __name__ == "__main__":
    main()
