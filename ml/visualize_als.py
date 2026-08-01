import os
import numpy as np
import pandas as pd
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.manifold import TSNE
import warnings
warnings.filterwarnings('ignore')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FEATURE_STORE_DIR = os.path.join(BASE_DIR, 'feature_store')
RAW_DATA_DIR = os.path.join(BASE_DIR, 'synthetic_data', 'raw')
OUT_DIR = r"C:\Users\Siddharth\.gemini\antigravity\brain\48e52a0f-fa17-4fde-b514-1caf283567e5\scratch"
os.makedirs(OUT_DIR, exist_ok=True)

print("Loading ALS track factors...")
als_factors_path = os.path.join(FEATURE_STORE_DIR, 'als_track_factors.npy')
if not os.path.exists(als_factors_path):
    print("ALS factors not found. Make sure ALS builder finished.")
    exit(1)
    
item_factors = np.load(als_factors_path)
feature_names = joblib.load(os.path.join(FEATURE_STORE_DIR, 'feature_names.pkl'))
track_vectors = np.load(os.path.join(FEATURE_STORE_DIR, 'track_vectors.npy'))

print("Generating t-SNE scatter plot for Collaborative Latent Space...")
# Pick 2000 random tracks for TSNE
np.random.seed(42)
sample_indices = np.random.choice(item_factors.shape[0], size=2000, replace=False)
sample_factors = item_factors[sample_indices]
sample_content = track_vectors[sample_indices]

# Find a primary genre for coloring from the original content vectors
genre_features = sample_content[:, 11:]
primary_genre_idx = np.argmax(genre_features, axis=1)
has_genre_mask = np.max(genre_features, axis=1) > 0

genre_names = [name.replace("genre_", "") for name in feature_names[11:]]
labels = [genre_names[idx] if has else "Unknown" for idx, has in zip(primary_genre_idx, has_genre_mask)]

tsne = TSNE(n_components=2, random_state=42, perplexity=30)
tsne_results = tsne.fit_transform(sample_factors)

from collections import Counter
top_genres = [g for g, c in Counter(labels).most_common(11) if g != "Unknown"][:10]
clean_labels = [g if g in top_genres else "Other" for g in labels]

plt.figure(figsize=(12, 10))
sns.scatterplot(
    x=tsne_results[:, 0], y=tsne_results[:, 1],
    hue=clean_labels,
    palette=sns.color_palette("husl", len(set(clean_labels))),
    s=30, alpha=0.8
)
plt.title("t-SNE Projection of ALS Latent Track Embeddings\n(Clustered by User Behavior, Colored by Genre)", fontsize=14)
plt.legend(bbox_to_anchor=(1.05, 1), loc=2, borderaxespad=0.)
plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, "tsne_als_projection.png"), dpi=150)
plt.close()

print("ALS Visualizations generated successfully!")
