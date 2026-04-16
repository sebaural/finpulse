import { FeedSource } from '@/types';

interface AdminFeedSettingsProps {
  feedError: string | null;
  feedSaving: boolean;
  hasPendingFeedChanges: boolean;
  feedLoading: boolean;
  draftFeedSources: FeedSource[];
  toggleFeedEnabled: (source: FeedSource) => void;
  applyFeedChanges: () => void;
}

export function AdminFeedSettings({
  feedError,
  feedSaving,
  hasPendingFeedChanges,
  feedLoading,
  draftFeedSources,
  toggleFeedEnabled,
  applyFeedChanges,
}: AdminFeedSettingsProps) {
  return (
    <section className="widget">
      <div className="widget-title">Feed Selection</div>

      {feedError && <div className="feed-error">{feedError}</div>}

      {hasPendingFeedChanges && (
        <div className="side-story-time">You have unapplied feed changes.</div>
      )}

      <div className="feed-list-label">Choose Feed/s to display</div>

      <div className="feed-list">
        {feedLoading && <div className="side-story-time">Loading sources...</div>}
        {!feedLoading &&
          draftFeedSources.map((source) => (
            <div className="feed-row" key={source.id}>
              <label className="feed-toggle-wrap">
                <input
                  type="checkbox"
                  checked={source.enabled}
                  onChange={() => {
                    void toggleFeedEnabled(source);
                  }}
                />
                <span>{source.enabled ? 'On' : 'Off'}</span>
              </label>
              <div className="feed-row-main">
                <div className="feed-row-name">{source.name}</div>
                <div className="feed-row-meta">
                  {source.type.toUpperCase()} • {source.category}
                </div>
              </div>
            </div>
          ))}
      </div>

      <div className="feed-apply-actions">
        <button
          className={`action-btn feed-apply-btn ${hasPendingFeedChanges ? 'pending' : ''}`}
          onClick={() => void applyFeedChanges()}
          disabled={feedSaving || !hasPendingFeedChanges}
        >
          {feedSaving ? 'Applying...' : 'Apply'}
        </button>
      </div>
    </section>
  );
}
