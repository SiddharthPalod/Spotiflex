import os
import pandas as pd
import numpy as np
import joblib

# Define paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEATURE_STORE_DIR = os.path.join(BASE_DIR, 'feature_store')
RAW_DATA_DIR = os.path.join(BASE_DIR, 'synthetic_data', 'raw')

def main():
    print("Loading resources...")
    track_vectors = np.load(os.path.join(FEATURE_STORE_DIR, 'track_vectors.npy'))
    track_index = joblib.load(os.path.join(FEATURE_STORE_DIR, 'track_index.pkl'))
    
    track_id_to_idx = {tid: idx for idx, tid in enumerate(track_index)}
    
    df_rewards = pd.read_csv(os.path.join(FEATURE_STORE_DIR, 'implicit_rewards.csv'))
    
    # Filter out tracks we don't have vectors for
    df_rewards = df_rewards[df_rewards['trackId'].isin(track_id_to_idx)].copy()
    
    df_tracks = pd.read_csv(os.path.join(RAW_DATA_DIR, 'data.csv'), usecols=['id', 'popularity'])
    
    print("Calculating global popularity-weighted centroid...")
    df_tracks = df_tracks[df_tracks['id'].isin(track_id_to_idx)]
    
    pop_sum = df_tracks['popularity'].sum()
    centroid = np.zeros(track_vectors.shape[1], dtype=np.float32)
    
    if pop_sum > 0:
        # Fast centroid calculation using numpy
        tracks_ordered_ids = df_tracks['id'].values
        tracks_ordered_pops = df_tracks['popularity'].values
        
        for tid, pop in zip(tracks_ordered_ids, tracks_ordered_pops):
            idx = track_id_to_idx[tid]
            centroid += track_vectors[idx] * pop
            
        centroid /= pop_sum
    else:
        centroid = track_vectors.mean(axis=0)
        
    print("Building user profiles...")
    
    # Create unique user index mapping
    unique_users = df_rewards['userId'].unique()
    user_id_to_idx = {uid: idx for idx, uid in enumerate(unique_users)}
    num_users = len(unique_users)
    num_features = track_vectors.shape[1]
    
    user_profiles_matrix = np.zeros((num_users, num_features), dtype=np.float32)
    user_abs_reward_sum = np.zeros(num_users, dtype=np.float32)
    
    # Map to integer indices for fast array operations
    user_indices = df_rewards['userId'].map(user_id_to_idx).values
    track_indices = df_rewards['trackId'].map(track_id_to_idx).values
    rewards = df_rewards['reward'].values
    
    print("Aggregating interactions (vectorized)...")
    for u_idx, t_idx, r in zip(user_indices, track_indices, rewards):
        user_profiles_matrix[u_idx] += track_vectors[t_idx] * r
        user_abs_reward_sum[u_idx] += abs(r)
        
    print("Normalizing user profiles...")
    # Avoid division by zero
    mask = user_abs_reward_sum > 0
    
    # Divide where sum > 0
    user_profiles_matrix[mask] = user_profiles_matrix[mask] / user_abs_reward_sum[mask][:, np.newaxis]
    
    # Fallback to centroid where sum == 0
    user_profiles_matrix[~mask] = centroid
    
    print(f"User profiles matrix shape: {user_profiles_matrix.shape}")
    
    out_matrix_path = os.path.join(FEATURE_STORE_DIR, 'user_profiles.npy')
    out_index_path = os.path.join(FEATURE_STORE_DIR, 'user_index.pkl')
    out_centroid_path = os.path.join(FEATURE_STORE_DIR, 'global_centroid.npy')
    
    print("Saving artifacts...")
    np.save(out_matrix_path, user_profiles_matrix)
    joblib.dump(unique_users.tolist(), out_index_path)
    np.save(out_centroid_path, centroid)
    
    print("Phase 3 User Profile Builder completed successfully.")

if __name__ == "__main__":
    main()
