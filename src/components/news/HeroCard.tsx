import { NewsArticle } from '@/types';

interface HeroCardProps {
  article: NewsArticle;
  relativeTime: string;
  onRead?: (id: string) => void;
  variant?: 'default' | 'live-feed';
}

export function HeroCard({ article, relativeTime, onRead, variant = 'default' }: HeroCardProps) {
  const isLiveFeed = variant === 'live-feed';
  const Root = isLiveFeed ? 'article' : 'a';

  return (
    <Root
      className={`hero-card ${isLiveFeed ? 'hero-card-live-feed' : ''}`}
      href={!isLiveFeed ? '/live-feed' : undefined}
      aria-label={!isLiveFeed ? `Open live feed: ${article.title}` : undefined}
      onClick={
        isLiveFeed && onRead
          ? () => {
              onRead(article.id);
            }
          : undefined
      }
    >
      <div className="hero-label">Breaking</div>
      <div className="hero-title">{article.title}</div>
      <div className="hero-summary">{article.summary}</div>
      <div className="hero-footer">
        <span className={`source-tag ${article.cls}`}>{article.source}</span>
        <span
          className={`card-time ${isLiveFeed && onRead ? 'card-time-playable' : ''}`}
          role={isLiveFeed && onRead ? 'button' : undefined}
          tabIndex={isLiveFeed && onRead ? 0 : undefined}
          onClick={
            isLiveFeed && onRead
              ? (e) => {
                  e.stopPropagation();
                  onRead(article.id);
                }
              : undefined
          }
          onKeyDown={
            isLiveFeed && onRead
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onRead(article.id);
                  }
                }
              : undefined
          }
          aria-label={isLiveFeed && onRead ? `Play audio for ${article.title}` : undefined}
        >
          {relativeTime}
        </span>
        {isLiveFeed ? (
          <a
            className="card-link"
            href={article.link}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Open source article: ${article.title}`}
          >
            Open Source {'->'}
          </a>
        ) : (
          <span className="card-link">Live Feed {'->'}</span>
        )}
      </div>
    </Root>
  );
}
