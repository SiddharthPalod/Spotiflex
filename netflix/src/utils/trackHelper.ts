/**
 * Normalizes song title for fuzzy duplicate detection.
 * Strips parentheses, brackets, (From ...), (Official ...), etc.
 */
export function normalizeSongTitle(title?: string | null): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/\s*\((from|feat|ft|with|prod|official|audio|video|lyric|remix|lofi|slowed|reverb|version|edit|hd|4k|movie|original)[^)]*\)/gi, '')
    .replace(/\s*\[(from|feat|ft|with|prod|official|audio|video|lyric|remix|lofi|slowed|reverb|version|edit|hd|4k|movie|original)[^\]]*\]/gi, '')
    .replace(/\s*[-–—]\s*(from|official|audio|video|lyric|remix|lofi|slowed|reverb|version|edit).*/gi, '')
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts the primary artist name from a multi-artist collaboration string.
 * E.g., "Shashwat Sachdev, Madhubanti Bagchi & Jasmine Sandlas" -> "Shashwat Sachdev"
 */
export function getPrimaryArtist(artist?: string | null): string {
  if (!artist) return '';
  const parts = artist.split(/,|&|\bfeat\.?\b|\bft\.?\b|\bwith\b|\bx\b|\bvs\.?\b/i);
  return (parts[0] || artist).trim();
}
