import os
import pandas as pd
import numpy as np
import joblib
import scipy.sparse as sp
import implicit
from implicit.evaluation import train_test_split, mean_average_precision_at_k
import json

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
    
    print("Reading implicit rewards...")
    df_rewards = pd.read_csv(os.path.join(FEATURE_STORE_DIR, 'implicit_rewards.csv'))
    df_rewards = df_rewards[
        df_rewards['userId'].isin(user_id_to_idx) & 
        df_rewards['trackId'].isin(track_id_to_idx)
    ]
    
    user_indices = df_rewards['userId'].map(user_id_to_idx).values
    track_indices = df_rewards['trackId'].map(track_id_to_idx).values
    rewards = df_rewards['reward'].values
    
    user_item_matrix = sp.csr_matrix(
        (rewards, (user_indices, track_indices)), 
        shape=(num_users, num_tracks)
    )
    
    print("Creating Train/Test split...")
    # Mask 20% of interactions for testing
    train, test = train_test_split(user_item_matrix, train_percentage=0.8, random_state=42)
    
    best_map = 0
    best_params = {}
    
    factors_list = [32, 64, 128]
    reg_list = [0.01, 0.1, 1.0]
    iter_list = [15, 30]
    
    print("\nTuning ALS model...")
    for factors in factors_list:
        for reg in reg_list:
            for iterations in iter_list:
                print(f"Training (factors={factors}, reg={reg}, iter={iterations})...")
                model = implicit.als.AlternatingLeastSquares(
                    factors=factors,
                    regularization=reg,
                    iterations=iterations,
                    calculate_training_loss=False,
                    random_state=42
                )
                
                # implicit >= 0.6 expects user_item matrix
                model.fit(train, show_progress=False)
                
                # Evaluate MAP@200
                map_k = mean_average_precision_at_k(model, train, test, K=200, show_progress=False)
                print(f"  MAP@200: {map_k:.4f}")
                
                if map_k > best_map:
                    best_map = map_k
                    best_params = {'factors': factors, 'regularization': reg, 'iterations': iterations}
                    
    print("\nBest Parameters:")
    print(best_params)
    print(f"Best MAP@200: {best_map:.4f}")
    
    print("\nRetraining final model on FULL dataset with best parameters...")
    final_model = implicit.als.AlternatingLeastSquares(
        factors=best_params['factors'],
        regularization=best_params['regularization'],
        iterations=best_params['iterations'],
        calculate_training_loss=True,
        random_state=42
    )
    
    final_model.fit(user_item_matrix)
    
    print("Extracting latent factors...")
    als_user_factors = final_model.user_factors
    als_track_factors = final_model.item_factors
    
    print("Saving artifacts...")
    np.save(os.path.join(FEATURE_STORE_DIR, 'als_user_factors.npy'), als_user_factors)
    np.save(os.path.join(FEATURE_STORE_DIR, 'als_track_factors.npy'), als_track_factors)
    
    with open(os.path.join(FEATURE_STORE_DIR, 'als_params.json'), 'w') as f:
        json.dump(best_params, f)
        
    print("Phase 5.5 ALS Tuning completed successfully.")

if __name__ == "__main__":
    main()
