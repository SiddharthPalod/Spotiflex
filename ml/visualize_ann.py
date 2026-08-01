import os
import numpy as np
import pandas as pd
import faiss
import joblib
import networkx as nx
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

print("Loading data...")
track_vectors = np.load(os.path.join(FEATURE_STORE_DIR, 'track_vectors.npy'))
track_index = joblib.load(os.path.join(FEATURE_STORE_DIR, 'track_index.pkl'))
index = faiss.read_index(os.path.join(FEATURE_STORE_DIR, 'track_faiss.index'))
feature_names = joblib.load(os.path.join(FEATURE_STORE_DIR, 'feature_names.pkl'))
df_tracks = pd.read_csv(os.path.join(RAW_DATA_DIR, 'data.csv'), usecols=['id', 'name', 'artists'])

track_id_to_name = dict(zip(df_tracks['id'], df_tracks['name'] + " - " + df_tracks['artists'].apply(lambda x: x[:15])))

print("Generating t-SNE scatter plot...")
# Pick 2000 random tracks for TSNE
np.random.seed(42)
sample_indices = np.random.choice(track_vectors.shape[0], size=2000, replace=False)
sample_vectors = track_vectors[sample_indices]

# Find a primary genre for coloring. Genres start after audio features (index 11)
genre_features = sample_vectors[:, 11:]
primary_genre_idx = np.argmax(genre_features, axis=1)
# Create a mask for tracks that actually have a genre > 0
has_genre_mask = np.max(genre_features, axis=1) > 0

genre_names = [name.replace("genre_", "") for name in feature_names[11:]]
labels = [genre_names[idx] if has else "Unknown" for idx, has in zip(primary_genre_idx, has_genre_mask)]

tsne = TSNE(n_components=2, random_state=42, perplexity=30)
tsne_results = tsne.fit_transform(sample_vectors)

# To keep the plot clean, only label the top 10 most common genres in the sample, group rest as "Other"
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
plt.title("t-SNE Projection of 2000 Track Vectors", fontsize=16)
plt.legend(bbox_to_anchor=(1.05, 1), loc=2, borderaxespad=0.)
plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, "tsne_projection.png"), dpi=150)
plt.close()


print("Generating Ego Network graph...")
# Ego network for a specific track
seed_idx = 0 # Just pick the first track
k1 = 12 # top 12 neighbors
D, I = index.search(track_vectors[seed_idx:seed_idx+1], k1)
first_degree = I[0][1:] # skip self

G = nx.Graph()
seed_name = track_id_to_name.get(track_index[seed_idx], f"Track {seed_idx}")
G.add_node(seed_idx, label=seed_name, node_type="seed")

for n_idx in first_degree:
    n_name = track_id_to_name.get(track_index[n_idx], f"Track {n_idx}")
    G.add_node(n_idx, label=n_name, node_type="1st")
    G.add_edge(seed_idx, n_idx)

# Find neighbors of neighbors
k2 = 4
D2, I2 = index.search(track_vectors[first_degree], k2)

for i, n_idx in enumerate(first_degree):
    for nn_idx in I2[i]:
        if nn_idx != n_idx and nn_idx != seed_idx:
            nn_name = track_id_to_name.get(track_index[nn_idx], f"Track {nn_idx}")
            if nn_idx not in G:
                G.add_node(nn_idx, label=nn_name, node_type="2nd")
            G.add_edge(n_idx, nn_idx)

plt.figure(figsize=(14, 12))
pos = nx.spring_layout(G, k=0.5, iterations=50)

node_colors = []
for node, data in G.nodes(data=True):
    if data["node_type"] == "seed": node_colors.append("red")
    elif data["node_type"] == "1st": node_colors.append("orange")
    else: node_colors.append("lightblue")

nx.draw_networkx_nodes(G, pos, node_color=node_colors, node_size=300, alpha=0.9)
nx.draw_networkx_edges(G, pos, alpha=0.3)

# Add labels slightly offset
labels = nx.get_node_attributes(G, 'label')
pos_attrs = {}
for node, coords in pos.items():
    pos_attrs[node] = (coords[0], coords[1] + 0.03)
nx.draw_networkx_labels(G, pos_attrs, labels, font_size=8, font_weight="bold")

plt.title(f"FAISS Local Neighborhood (Ego Network) around\n{seed_name}", fontsize=16)
plt.axis('off')
plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, "ego_network.png"), dpi=150)
plt.close()

print("Visualizations generated successfully!")
