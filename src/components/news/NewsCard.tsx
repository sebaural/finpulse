import { NewsArticle } from '@/types';

interface ArticleCardProps {
  article: NewsArticle;
  isReading: boolean;
  onRead: (id: string) => void;
  relativeTime: string;
}

export function NewsCard({
  article,
  isReading,
  onRead,
  relativeTime,
}: ArticleCardProps) {
  const priorityCls =
    article.importance === 1
      ? 'breaking'
      : article.importance === 2
        ? 'important'
        : 'regular';
  const priorityTitle =
    article.importance === 1
      ? 'Breaking'
      : article.importance === 2
        ? 'Important'
        : 'Regular';

  return (
    <article
      className={`news-card ${article.cls} ${isReading ? 'is-reading' : ''}`}
      onClick={() => onRead(article.id)}
    >
      <div className="card-meta">
        <span className={`priority-dot ${priorityCls}`} title={priorityTitle} />
        <span className={`source-tag ${article.cls}`}>{article.source}</span>
        <span className="card-category-badge">{article.category}</span>
        {article.impact && (
          <span className={`impact-badge ${article.impact.toLowerCase()}`}>
            {article.impact}
          </span>
        )}
        <span className="card-time">{relativeTime}</span>
      </div>
      <h2 className="card-title">{article.title}</h2>
      <p className="card-summary">{article.summary}</p>
      <div className="card-actions">
        <a
          href={article.link}
          className="action-btn"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          Open
        </a>
        <button
          className={`action-btn play-btn ${isReading ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onRead(article.id);
          }}
        >
          ▶ Play
        </button>

      </div>
    </article>
  );
}
