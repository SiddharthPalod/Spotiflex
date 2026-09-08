export const DEFAULT_AVATAR = 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png';

export const AVATAR_OPTIONS = [
  'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
  '/avatars/netflix-avatar-frog.png',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Shadow&backgroundColor=0284c7',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Spark&backgroundColor=16a34a',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Bandit&backgroundColor=d97706',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Cosmo&backgroundColor=9333ea',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Nova&backgroundColor=dc2626',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Alex',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Luna',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Leo',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=Spotiflex',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=Retro',
];

export const getAvatar = (avatarUrl?: string): string => {
  return avatarUrl || DEFAULT_AVATAR;
};