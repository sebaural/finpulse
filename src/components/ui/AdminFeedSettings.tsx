import { FeedSource } from '@/types';

interface FeedFormState {
  name: string;
  type: 'rss' | 'api';
  url: string;
  category: string;
  apiKeyEnv: string;
  priority: 1 | 2 | 3;
  enabled: boolean;
}

interface AdminFeedSettingsProps {
  feedError: string | null;
  feedForm: FeedFormState;
  setFeedForm: React.Dispatch<React.SetStateAction<FeedFormState>>;
  saveFeedSource: () => void;
  feedSaving: boolean;
  editingFeedId: string | null;
  resetFeedForm: () => void;
  hasPendingFeedChanges: boolean;
  feedLoading: boolean;
  draftFeedSources: FeedSource[];
  toggleFeedEnabled: (source: FeedSource) => void;
  startEditFeed: (source: FeedSource) => void;
  removeFeedSource: (sourceId: string) => void;
  applyFeedChanges: () => void;
}

export function AdminFeedSettings({
  feedError,
  feedForm,
  setFeedForm,
  saveFeedSource,
  feedSaving,
  editingFeedId,
  resetFeedForm,
  hasPendingFeedChanges,
  feedLoading,
  draftFeedSources,
  toggleFeedEnabled,
  startEditFeed,
  removeFeedSource,
  applyFeedChanges,
}: AdminFeedSettingsProps) {
  return (
    <section className="widget">
      <div className="widget-title">Admin Feed Settings</div>

      {feedError && <div className="feed-error">{feedError}</div>}

      <div className="feed-form-grid">
        <input
          className="feed-input"
          placeholder="Source name"
          value={feedForm.name}
          onChange={(e) => setFeedForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <select
          className="feed-input"
          value={feedForm.type}
          onChange={(e) =>
            setFeedForm((prev) => ({
              ...prev,
              type: e.target.value as 'rss' | 'api',
            }))
          }
        >
          <option value="rss">RSS</option>
          <option value="api">API</option>
        </select>
        <input
          className="feed-input feed-input-full"
          placeholder="https://..."
          value={feedForm.url}
          onChange={(e) => setFeedForm((prev) => ({ ...prev, url: e.target.value }))}
        />
        <input
          className="feed-input"
          placeholder="Category"
          value={feedForm.category}
          onChange={(e) => setFeedForm((prev) => ({ ...prev, category: e.target.value }))}
        />
        <input
          className="feed-input"
          placeholder="API key env (optional)"
          value={feedForm.apiKeyEnv}
          onChange={(e) => setFeedForm((prev) => ({ ...prev, apiKeyEnv: e.target.value }))}
        />
        <select
          className="feed-input"
          value={feedForm.priority}
          onChange={(e) =>
            setFeedForm((prev) => ({ ...prev, priority: Number(e.target.value) as 1 | 2 | 3 }))
          }
        >
          <option value={1}>1 Breaking</option>
          <option value={2}>2 Important</option>
          <option value={3}>3 Regular</option>
        </select>
      </div>

      <div className="feed-actions">
        <button className="action-btn" onClick={saveFeedSource} disabled={feedSaving}>
          {editingFeedId ? 'Queue update' : 'Queue add'}
        </button>
        {editingFeedId && (
          <button className="action-btn" onClick={resetFeedForm}>
            Cancel edit
          </button>
        )}
      </div>

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
              <button className="action-btn" onClick={() => startEditFeed(source)}>
                Edit
              </button>
              <button className="action-btn" onClick={() => void removeFeedSource(source.id)}>
                Delete
              </button>
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
