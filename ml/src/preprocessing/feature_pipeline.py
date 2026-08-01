import os
import pandas as pd
import numpy as np
import ast
import joblib
import json
from datetime import datetime
from sklearn.preprocessing import StandardScaler, MultiLabelBinarizer
from collections import Counter

# Define paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW_DATA_DIR = os.path.join(BASE_DIR, 'synthetic_data', 'raw')
FEATURE_STORE_DIR = os.path.join(BASE_DIR, 'feature_store')

# Define features
AUDIO_FEATURES = [
    'acousticness', 'danceability', 'energy', 'instrumentalness',
    'liveness', 'loudness', 'speechiness', 'tempo', 'valence', 'key', 'mode'
]

MIN_GENRE_FREQ = 20

def load_data():
    data_path = os.path.join(RAW_DATA_DIR, 'data.csv')
    genres_path = os.path.join(RAW_DATA_DIR, 'data_w_genres.csv')
    
    print("Loading data.csv...")
    df_data = pd.read_csv(data_path)
    print("Loading data_w_genres.csv...")
    df_genres = pd.read_csv(genres_path)
    
    return df_data, df_genres

def process_features(df_data, df_genres):
    print("Normalizing audio features...")
    # Normalize audio features
    scaler = StandardScaler()
    normalized_audio = scaler.fit_transform(df_data[AUDIO_FEATURES])
    
    # Save normalization statistics
    means = scaler.mean_
    stds = scaler.scale_
    
    print("Encoding genres...")
    # data_w_genres.csv has 'artists' and 'genres' columns.
    def safe_eval(val):
        if pd.isna(val):
            return []
        try:
            val_list = ast.literal_eval(val)
            if isinstance(val_list, list):
                return val_list
            return []
        except:
            return []

    df_genres['genres_list'] = df_genres['genres'].apply(safe_eval)
    artist_to_genres = dict(zip(df_genres['artists'], df_genres['genres_list']))
    
    def get_track_genres(artists_str):
        try:
            track_artists = ast.literal_eval(artists_str)
            if not isinstance(track_artists, list):
                track_artists = [artists_str]
        except:
            track_artists = [artists_str]
            
        track_genres = []
        for artist in track_artists:
            track_genres.extend(artist_to_genres.get(artist, []))
        return list(set(track_genres))
        
    df_data['track_genres'] = df_data['artists'].apply(get_track_genres)
    
    # Filter genres by frequency
    all_genres = [g for sublist in df_data['track_genres'] for g in sublist]
    genre_counts = Counter(all_genres)
    valid_genres = [g for g, c in genre_counts.items() if c >= MIN_GENRE_FREQ]
    
    # Sort valid genres for consistent ordering
    valid_genres.sort()
    
    def filter_top_genres(genres_list):
        return [g for g in genres_list if g in valid_genres]
        
    df_data['filtered_genres'] = df_data['track_genres'].apply(filter_top_genres)
    
    mlb = MultiLabelBinarizer(classes=valid_genres)
    encoded_genres = mlb.fit_transform(df_data['filtered_genres'])
    
    # Feature names
    genre_feature_names = [f"genre_{g}" for g in valid_genres]
    feature_names = AUDIO_FEATURES + genre_feature_names
    
    print("Assembling final vectors...")
    feature_vectors = np.hstack([normalized_audio, encoded_genres]).astype(np.float32)
    track_index = df_data['id'].tolist()
    
    # Integrity checks
    print("Running integrity checks...")
    assert len(feature_vectors) == len(track_index), "Mismatch between vector count and index count"
    assert not np.isnan(feature_vectors).any(), "NaN values found in feature vectors"
    assert np.isfinite(feature_vectors).all(), "Non-finite values found in feature vectors"
    
    metadata = {
        "num_tracks": len(feature_vectors),
        "dimension": feature_vectors.shape[1],
        "audio_features": len(AUDIO_FEATURES),
        "genre_features": len(valid_genres),
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    
    return feature_vectors, track_index, scaler, means, stds, valid_genres, feature_names, metadata

def main():
    os.makedirs(FEATURE_STORE_DIR, exist_ok=True)
    
    df_data, df_genres = load_data()
    (feature_vectors, track_index, scaler, means, stds, 
     valid_genres, feature_names, metadata) = process_features(df_data, df_genres)
    
    print(f"Feature vectors shape: {feature_vectors.shape}")
    
    print("Saving artifacts to feature_store...")
    np.save(os.path.join(FEATURE_STORE_DIR, 'track_vectors.npy'), feature_vectors)
    np.save(os.path.join(FEATURE_STORE_DIR, 'means.npy'), means)
    np.save(os.path.join(FEATURE_STORE_DIR, 'stds.npy'), stds)
    
    joblib.dump(track_index, os.path.join(FEATURE_STORE_DIR, 'track_index.pkl'))
    joblib.dump(scaler, os.path.join(FEATURE_STORE_DIR, 'scaler.pkl'))
    joblib.dump(valid_genres, os.path.join(FEATURE_STORE_DIR, 'genres.pkl'))
    joblib.dump(feature_names, os.path.join(FEATURE_STORE_DIR, 'feature_names.pkl'))
    
    with open(os.path.join(FEATURE_STORE_DIR, 'metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=4)
        
    print("Phase 1 Feature Pipeline completed successfully.")

if __name__ == "__main__":
    main()
