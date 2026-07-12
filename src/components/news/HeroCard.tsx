import { NewsArticle } from '@/types';

interface HeroCardProps {
  article: NewsArticle;
  relativeTime: string;
}

export function HeroCard({ article, relativeTime }: HeroCardProps) {
  return (
    <a className="hero-card" href="/live-feed" aria-label={`Open live feed: ${article.title}`}>
      <div className="hero-label">Breaking</div>
      <div className="hero-title">{article.title}</div>
      <div className="hero-summary">{article.summary}</div>
      <div className="hero-footer">
        <span className={`source-tag ${article.cls}`}>{article.source}</span>
        <span className="card-time">{relativeTime}</span>
        <span className="card-link">Live Feed {'->'}</span>
      </div>
    </a>
  );
}
