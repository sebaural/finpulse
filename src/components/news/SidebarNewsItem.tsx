import { NewsArticle } from '@/types';

interface SidebarNewsItemProps {
  article: NewsArticle;
  onRead: (id: string) => void;
}

export function SidebarNewsItem({ article, onRead }: SidebarNewsItemProps) {
  return (
    <div className="side-story" onClick={() => onRead(article.id)}>
      <div className="side-story-source" style={{ color: `var(--${article.cls})` }}>
        {article.source}
      </div>
      <div className="side-story-title">{article.title}</div>
      <div className="side-story-time">{article.time}</div>
    </div>
  );
}
