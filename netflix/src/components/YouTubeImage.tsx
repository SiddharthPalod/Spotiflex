import { useState, useEffect } from 'react';

interface YouTubeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  finalFallback?: string;
  hideOnFail?: boolean;
}

export default function YouTubeImage({ 
  src, 
  finalFallback, 
  hideOnFail, 
  ...props 
}: YouTubeImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [failed, setFailed] = useState(false);

  // If the parent passes a new source URL, reset our state
  useEffect(() => {
    setCurrentSrc(src);
    setFailed(false);
  }, [src]);

  const handleError = () => {
    // 1st Fallback: If 1080p fails, try 480p
    if (currentSrc.includes('maxresdefault.jpg')) {
      setCurrentSrc(currentSrc.replace('maxresdefault.jpg', 'hqdefault.jpg'));
    } 
    // 2nd Fallback: If 480p fails (or it wasn't a YouTube thumbnail to begin with)
    else {
      if (hideOnFail) {
        setFailed(true);
      } else if (finalFallback && currentSrc !== finalFallback) {
        setCurrentSrc(finalFallback);
      } else {
        // Ultimate generic placeholder so we never show a broken image icon
        setCurrentSrc('https://placehold.co/300x300/1a1a1a/1DB954?text=Track');
      }
    }
  };

  if (failed) return null;

  return <img src={currentSrc} onError={handleError} {...props} />;
}
