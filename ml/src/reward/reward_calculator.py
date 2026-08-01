import os
import pandas as pd
import numpy as np

# Define paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW_DATA_DIR = os.path.join(BASE_DIR, 'synthetic_data', 'raw')
FEATURE_STORE_DIR = os.path.join(BASE_DIR, 'feature_store')

# Weights
W1 = 3.0
W2 = 2.5
W3 = 0.3
W4 = 0.2

# W_t multipliers
RHO = {'back': 1.5, 'closed': 1.0, 'manual': 0.6, 'auto': 0.3}
BONUS = {'back': -0.1, 'closed': 0.0, 'manual': 0.15, 'auto': 0.0}

def load_data():
    print("Loading datasets...")
    df_like = pd.read_csv(os.path.join(RAW_DATA_DIR, 'db_like.csv'))
    df_watch = pd.read_csv(os.path.join(RAW_DATA_DIR, 'db_watchhistory.csv'))
    df_hover = pd.read_csv(os.path.join(RAW_DATA_DIR, 'db_hoverhistory.csv'))
    df_click = pd.read_csv(os.path.join(RAW_DATA_DIR, 'db_clickhistory.csv'))
    
    df_tracks = pd.read_csv(os.path.join(RAW_DATA_DIR, 'data.csv'), usecols=['id', 'duration_ms'])
    
    return df_like, df_watch, df_hover, df_click, df_tracks

def process_likes(df_like):
    print("Computing L_t (Likes)...")
    df = df_like[['userId', 'trackId', 'isLike']].copy()
    df['L_t'] = df['isLike'].apply(lambda x: 1 if x == 1 else -1)
    df['reward_like'] = W1 * df['L_t']
    return df[['userId', 'trackId', 'reward_like']]

def process_watches(df_watch, df_tracks):
    print("Computing W_t (Watches)...")
    df = df_watch.merge(df_tracks, left_on='trackId', right_on='id', how='left')
    df = df.dropna(subset=['duration_ms'])
    
    df['duration_seconds'] = df['duration_ms'] / 1000.0
    df['duration_seconds'] = df['duration_seconds'].replace(0, 1)
    
    df['ratio'] = df['durationWatched'] / df['duration_seconds']
    df['ratio'] = df['ratio'].clip(0, 1)
    
    df['E'] = 2 * df['ratio'] - 1
    
    def calculate_wt(row):
        E = row['E']
        exit_type = row['skipSource'] if pd.notna(row['skipSource']) else 'auto'
        
        if row['completed'] == 1:
            exit_type = 'auto'
            
        rho = RHO.get(exit_type, 1.0)
        bonus = BONUS.get(exit_type, 0.0)
        
        if E < 0:
            W_t = E * rho
        else:
            if row['completed'] == 1:
                W_t = E + bonus + 0.1
            else:
                W_t = E + bonus
                
        return min(max(W_t, -1.0), 1.0)
        
    df['W_t'] = df.apply(calculate_wt, axis=1)
    df['reward_watch'] = W2 * df['W_t']
    
    return df[['userId', 'trackId', 'reward_watch']]

def process_hovers(df_hover):
    print("Computing H_t (Hovers)...")
    df = df_hover[['userId', 'trackId', 'durationMs']].copy()
    df['H_t'] = (np.log(1 + df['durationMs']) / np.log(1 + 10000)).clip(upper=1.0)
    df['reward_hover'] = W3 * df['H_t']
    return df[['userId', 'trackId', 'reward_hover']]

def process_clicks(df_click):
    print("Computing K_t (Clicks)...")
    df = df_click[['userId', 'trackId', 'source']].copy()
    
    def get_k(source):
        if source == 'recommendation': return 0.5
        elif source == 'browse': return 0.2
        elif source == 'search': return 0.1
        return 0.0
        
    df['K_t'] = df['source'].apply(get_k)
    df['reward_click'] = W4 * df['K_t']
    return df[['userId', 'trackId', 'reward_click']]

def aggregate_rewards(df_l, df_w, df_h, df_k):
    print("Aggregating rewards...")
    df_l = df_l.rename(columns={'reward_like': 'reward'})
    df_w = df_w.rename(columns={'reward_watch': 'reward'})
    df_h = df_h.rename(columns={'reward_hover': 'reward'})
    df_k = df_k.rename(columns={'reward_click': 'reward'})
    
    all_events = pd.concat([df_l, df_w, df_h, df_k], ignore_index=True)
    
    aggregated = all_events.groupby(['userId', 'trackId'])['reward'].sum().reset_index()
    aggregated['reward'] = aggregated['reward'].clip(-3.0, 3.0)
    
    return aggregated

def main():
    os.makedirs(FEATURE_STORE_DIR, exist_ok=True)
    
    df_like, df_watch, df_hover, df_click, df_tracks = load_data()
    
    df_l = process_likes(df_like)
    df_w = process_watches(df_watch, df_tracks)
    df_h = process_hovers(df_hover)
    df_k = process_clicks(df_click)
    
    final_rewards = aggregate_rewards(df_l, df_w, df_h, df_k)
    
    print(f"Aggregated implicit feedback matrix shape: {final_rewards.shape}")
    
    out_path = os.path.join(FEATURE_STORE_DIR, 'implicit_rewards.csv')
    print(f"Saving to {out_path} ...")
    final_rewards.to_csv(out_path, index=False)
    print("Phase 2 Reward Engine completed successfully.")

if __name__ == "__main__":
    main()
