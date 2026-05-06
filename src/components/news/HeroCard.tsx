import { NewsArticle } from '@/types';

interface HeroCardProps {
  article: NewsArticle;
  onRead: (id: string) => void;
  relativeTime: string;
}

export function HeroCard({ article, onRead, relativeTime }: HeroCardProps) {
  return (
    <section className="hero-card">
      <div className="hero-label">Breaking</div>
      <div className="hero-title">{article.title}</div>
      <div className="hero-summary">{article.summary}</div>
      <div className="hero-footer">
        <span className={`source-tag ${article.cls}`}>{article.source}</span>
        <span className="card-time">{relativeTime}</span>
        <button className="read-btn" onClick={() => onRead(article.id)}>
          Read Aloud
        </button>
        <a href={article.link} className="card-link" target="_blank" rel="noreferrer">
          Read full story {'->'}
        </a>
      </div>
    </section>
  );
}
