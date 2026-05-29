'use client';

import { useState } from 'react';
import { X_SECTIONS, type XPosterSection, type XPostResult } from '@/types';

interface ArticleData {
  title:     string;
  slug:      string;
  summary:   string;
  keyPoints: string[];
  date:      string;
}

interface SectionState {
  article:       ArticleData | null;
  tweet:         string;
  action:        'refresh' | 'generate' | 'post' | null;
  status:        { type: 'success' | 'error'; message: string; tweetId?: string } | null;
  lastPostedUrl: string | null;
}

const initial: SectionState = {
  article:       null,
  tweet:         '',
  action:        null,
  status:        null,
  lastPostedUrl: null,
};

type State = Record<XPosterSection, SectionState>;

const SITE_BASE = 'https://macrostance.com';

function articleUrl(section: XPosterSection, slug: string) {
  return `${SITE_BASE}/${section}/${slug}`;
}

function charCount(s: string) {
  return s.length;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<XPosterSection>('markets');
  const [state, setState]         = useState<State>({
    markets:     { ...initial },
    geopolitics: { ...initial },
    tech:        { ...initial },
  });

  function setSection(section: XPosterSection, patch: Partial<SectionState>) {
    setState((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...patch },
    }));
  }

  async function handleRefresh(section: XPosterSection) {
    setSection(section, { action: 'refresh', status: null });
    try {
      const res  = await fetch(`/api/${section}/articles`);
      const data = (await res.json()) as { articles?: ArticleData[]; error?: string };
      if (!res.ok || !data.articles?.length) {
        throw new Error(data.error ?? 'No articles returned');
      }
      setSection(section, { article: data.articles[0], action: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSection(section, { action: null, status: { type: 'error', message } });
    }
  }

  async function handleGenerateTweet(section: XPosterSection) {
    const art = state[section].article;
    if (!art) return;

    setSection(section, { action: 'generate', status: null });
    try {
      const briefing = {
        section,
        title:    art.title,
        url:      articleUrl(section, art.slug),
        date:     art.date,
        bodyText: art.summary + '\n' + art.keyPoints.join('. '),
      };
      const res  = await fetch('/api/generate-tweet', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ briefing }),
      });
      const data = (await res.json()) as { tweet?: string; error?: string };
      if (!res.ok || !data.tweet) throw new Error(data.error ?? 'No tweet returned');
      setSection(section, { tweet: data.tweet, action: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSection(section, { action: null, status: { type: 'error', message } });
    }
  }

  async function handlePostTweet(section: XPosterSection) {
    const { tweet, article } = state[section];
    if (!tweet || !article) return;

    if (!confirm('Post this tweet to X?')) return;

    setSection(section, { action: 'post', status: null });
    const briefingUrl = articleUrl(section, article.slug);
    try {
      const res  = await fetch('/api/post-tweet', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tweet, briefingUrl, section }),
      });
      const data = (await res.json()) as XPostResult & { error?: string };

      if (res.status === 409) {
        setSection(section, {
          action: null,
          status: { type: 'error', message: 'Already posted for this article.' },
          lastPostedUrl: briefingUrl,
        });
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Post failed');
      }

      setSection(section, {
        action:        null,
        lastPostedUrl: briefingUrl,
        status: {
          type:    'success',
          message: `Tweet posted!`,
          tweetId: data.tweetId,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSection(section, { action: null, status: { type: 'error', message } });
    }
  }

  const s = state[activeTab];
  const isLoading = s.action !== null;
  const count = charCount(s.tweet);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', padding: '2rem' }}>
      <h1 style={{ fontFamily: 'Gideon Roman, serif', fontSize: '1.75rem', marginBottom: '1.5rem', color: 'var(--accent)' }}>
        X Auto-Poster Dashboard
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        {X_SECTIONS.map(({ section, label }) => (
          <button
            key={section}
            onClick={() => setActiveTab(section)}
            style={{
              padding:         '0.5rem 1.25rem',
              borderRadius:    '4px 4px 0 0',
              border:          'none',
              cursor:          'pointer',
              background:      activeTab === section ? 'var(--surface2)' : 'transparent',
              color:           activeTab === section ? 'var(--accent)' : 'var(--muted)',
              fontWeight:      activeTab === section ? 700 : 400,
              fontSize:        '0.95rem',
              transition:      'color 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Status Banner */}
      {s.status && (
        <div style={{
          marginBottom: '1rem',
          padding:      '0.75rem 1rem',
          borderRadius: '6px',
          background:   s.status.type === 'success' ? 'rgba(62,207,142,0.1)' : 'rgba(245,95,95,0.1)',
          border:       `1px solid ${s.status.type === 'success' ? 'var(--positive)' : 'var(--negative)'}`,
          color:        s.status.type === 'success' ? 'var(--positive)' : 'var(--negative)',
          fontSize:     '0.9rem',
        }}>
          {s.status.message}
          {s.status.tweetId && (
            <a
              href={`https://twitter.com/i/web/status/${s.status.tweetId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: '0.5rem', color: 'var(--accent2)', textDecoration: 'underline' }}
            >
              View tweet ↗
            </a>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>

        {/* Latest Article Card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Latest Article
            </h2>
            <button
              onClick={() => handleRefresh(activeTab)}
              disabled={isLoading}
              style={btnStyle(isLoading)}
            >
              {s.action === 'refresh' ? <Spinner /> : 'Refresh Article'}
            </button>
          </div>

          {s.article ? (
            <>
              <p style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                {s.article.title}
              </p>
              <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                {s.article.date}
              </p>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                {s.article.summary.slice(0, 280)}{s.article.summary.length > 280 ? '…' : ''}
              </p>
              <a
                href={articleUrl(activeTab, s.article.slug)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent2)', fontSize: '0.85rem', textDecoration: 'underline' }}
              >
                Read on macrostance.com ↗
              </a>
            </>
          ) : (
            <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
              Click &quot;Refresh Article&quot; to load the latest article.
            </p>
          )}
        </div>

        {/* Tweet Preview */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Tweet Preview
            </h2>
            <span style={{ fontSize: '0.85rem', color: count > 280 ? 'var(--negative)' : 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
              {count} / 280
            </span>
          </div>

          <textarea
            value={s.tweet}
            onChange={(e) => setSection(activeTab, { tweet: e.target.value })}
            rows={5}
            placeholder="Generate a tweet first…"
            style={{
              width:        '100%',
              background:   'var(--surface2)',
              border:       `1px solid ${count > 280 ? 'var(--negative)' : 'var(--border)'}`,
              borderRadius: '6px',
              color:        'var(--text)',
              padding:      '0.75rem',
              fontSize:     '0.95rem',
              lineHeight:   1.5,
              resize:       'vertical',
              outline:      'none',
              fontFamily:   'inherit',
            }}
          />

          {/* Image Preview */}
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/macrostance_X.png"
              alt="X attachment preview"
              style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border)' }}
            />
            <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>macrostance_X.png will be attached</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleGenerateTweet(activeTab)}
            disabled={isLoading || !s.article}
            style={btnStyle(isLoading || !s.article, 'var(--accent2)')}
          >
            {s.action === 'generate' ? <Spinner /> : 'Generate Tweet'}
          </button>

          <button
            onClick={() => handlePostTweet(activeTab)}
            disabled={isLoading || !s.tweet || !s.article || count > 280}
            style={btnStyle(isLoading || !s.tweet || !s.article || count > 280, 'var(--positive)')}
          >
            {s.action === 'post' ? <Spinner /> : 'Post to X'}
          </button>
        </div>

        {/* Last Posted */}
        {s.lastPostedUrl && (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Last posted:{' '}
            <a
              href={s.lastPostedUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent2)', textDecoration: 'underline' }}
            >
              {s.lastPostedUrl}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

function btnStyle(disabled: boolean, color = 'var(--accent)'): React.CSSProperties {
  return {
    padding:      '0.5rem 1rem',
    borderRadius: '6px',
    border:       `1px solid ${disabled ? 'var(--border)' : color}`,
    background:   disabled ? 'var(--surface2)' : 'transparent',
    color:        disabled ? 'var(--muted)' : color,
    cursor:       disabled ? 'not-allowed' : 'pointer',
    fontSize:     '0.9rem',
    fontWeight:   600,
    display:      'flex',
    alignItems:   'center',
    gap:          '0.4rem',
    transition:   'opacity 0.15s',
    opacity:      disabled ? 0.6 : 1,
  };
}

function Spinner() {
  return (
    <span
      style={{
        display:       'inline-block',
        width:         '14px',
        height:        '14px',
        border:        '2px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius:  '50%',
        animation:     'spin 0.7s linear infinite',
      }}
    />
  );
}
