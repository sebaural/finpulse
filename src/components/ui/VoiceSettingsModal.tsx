'use client';

import React, { memo } from 'react';
import type { InterruptPolicy, ReadMode, SpeechRules, TraderProfile, VoiceSettings } from '@/hooks/useSpeechReader';

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="vsm-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className={`vsm-toggle-track${checked ? ' on' : ''}`} />
      <span className={`vsm-toggle-thumb${checked ? ' on' : ''}`} />
    </label>
  );
}

function RuleRow({
  label, sub, checked, onChange,
}: {
  label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="vsm-rule-row">
      <div className="vsm-rule-text">
        <span className="vsm-rule-label">{label}</span>
        {sub && <span className="vsm-rule-sub">{sub}</span>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function PolicyBtn({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`vsm-policy-btn${active ? ' active' : ''}`}
    >
      {children}
    </button>
  );
}

function SettingsSelect({
  value, onChange, children,
}: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="vsm-select"
    >
      {children}
    </select>
  );
}

// ── Option constants ──────────────────────────────────────────────────────────

const INTERRUPT_POLICIES: { value: InterruptPolicy; label: string }[] = [
  { value: 'always',   label: 'Always interrupt'       },
  { value: 'critical', label: 'P1 only (recommended)'  },
  { value: 'never',    label: 'Never interrupt'         },
];

const PROFILES: { value: TraderProfile; label: string }[] = [
  { value: 'scalper',   label: 'Scalper'       },
  { value: 'daytrader', label: 'Day trader'    },
  { value: 'swing',     label: 'Swing'         },
  { value: 'macro',     label: 'Macro / Forex' },
];

const RATE_OPTIONS = [
  { value: '0.85', label: '0.85×' },
  { value: '0.92', label: '0.92×' },
  { value: '1.0',  label: '1.0×'  },
  { value: '1.1',  label: '1.1×'  },
  { value: '1.25', label: '1.25×' },
];

const MODE_OPTIONS: { value: ReadMode; label: string }[] = [
  { value: 'headline', label: 'Headline only'       },
  { value: 'summary',  label: 'Headline + context'  },
];

const GAP_OPTIONS = [
  { value: '0.5', label: '0.5 s' },
  { value: '1.0', label: '1.0 s' },
  { value: '1.5', label: '1.5 s' },
  { value: '2.5', label: '2.5 s' },
  { value: '4.0', label: '4.0 s' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface VoiceSettingsModalProps {
  isOpen:           boolean;
  onClose:          () => void;
  // Reading mode
  mode:             ReadMode;
  setMode:          (m: ReadMode) => void;
  // Voice
  voiceSettings:    VoiceSettings;
  setVoiceSettings: (patch: Partial<VoiceSettings>) => void;
  voices:           SpeechSynthesisVoice[];
  // Rules
  rules:            SpeechRules;
  setRules:         (patch: Partial<SpeechRules>) => void;
  // Interrupt policy
  interruptPolicy:  InterruptPolicy;
  setInterruptPolicy: (p: InterruptPolicy) => void;
  // Profiles
  setProfile:       (p: TraderProfile) => void;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export const VoiceSettingsModal = memo(function VoiceSettingsModal({
  isOpen, onClose,
  mode, setMode,
  voiceSettings, setVoiceSettings, voices,
  rules, setRules,
  interruptPolicy, setInterruptPolicy,
  setProfile,
}: VoiceSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="vsm-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="vsm-panel" role="dialog" aria-modal="true" aria-label="Voice settings">

        {/* Header */}
        <div className="vsm-header">
          <span className="vsm-title">⚙ Voice Reader Settings</span>
          <button onClick={onClose} className="vsm-close" aria-label="Close settings">✕</button>
        </div>

        {/* Reading rules */}
        <section className="vsm-section">
          <div className="vsm-section-title">Reading Rules</div>
          <div className="vsm-rule-grid">
            <RuleRow
              label="Skip low-priority articles"
              sub="Omit regular (P3) items from auto-play queue"
              checked={rules.skipLow}
              onChange={v => setRules({ skipLow: v })}
            />
            <RuleRow
              label="Skip already-spoken articles"
              sub="Dedup — do not re-read in the same session"
              checked={rules.dedup}
              onChange={v => setRules({ dedup: v })}
            />
            <RuleRow
              label="Alert tone before breaking news"
              sub="Short beep before importance-1 headlines"
              checked={rules.tone}
              onChange={v => setRules({ tone: v })}
            />
            <RuleRow
              label="Allow interrupt for breaking news"
              sub="Cancel current speech when P1 arrives"
              checked={rules.interrupt}
              onChange={v => setRules({ interrupt: v })}
            />
          </div>
        </section>

        {/* Interrupt policy */}
        <section className="vsm-section">
          <div className="vsm-section-title">Interrupt Policy</div>
          <div className="vsm-btn-row">
            {INTERRUPT_POLICIES.map(p => (
              <PolicyBtn
                key={p.value}
                active={interruptPolicy === p.value}
                onClick={() => setInterruptPolicy(p.value)}
              >
                {p.label}
              </PolicyBtn>
            ))}
          </div>
        </section>

        {/* Voice & reading */}
        <section className="vsm-section">
          <div className="vsm-section-title">Voice &amp; Reading</div>
          <div className="vsm-selects-grid">
            <div className="vsm-select-group">
              <label className="vsm-select-label">Mode</label>
              <SettingsSelect value={mode} onChange={v => setMode(v as ReadMode)}>
                {MODE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SettingsSelect>
            </div>

            <div className="vsm-select-group">
              <label className="vsm-select-label">Voice</label>
              <SettingsSelect
                value={voiceSettings.selectedVoiceName}
                onChange={v => setVoiceSettings({ selectedVoiceName: v })}
              >
                {voices.map(v => (
                  <option key={v.name} value={v.name}>
                    {v.lang.toLowerCase().replace('_', '-').startsWith('en-gb')
                      ? 'English (British)'
                      : 'English (American)'}
                  </option>
                ))}
              </SettingsSelect>
            </div>

            <div className="vsm-select-group">
              <label className="vsm-select-label">Speed</label>
              <SettingsSelect
                value={String(voiceSettings.rate)}
                onChange={v => setVoiceSettings({ rate: parseFloat(v) })}
              >
                {RATE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SettingsSelect>
            </div>

            <div className="vsm-select-group">
              <label className="vsm-select-label">Gap between articles</label>
              <SettingsSelect
                value={String(voiceSettings.gap)}
                onChange={v => setVoiceSettings({ gap: parseFloat(v) })}
              >
                {GAP_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SettingsSelect>
            </div>
          </div>
        </section>

        {/* Trader profiles */}
        <section className="vsm-section">
          <div className="vsm-section-title">Trader Profile Presets</div>
          <div className="vsm-btn-row">
            {PROFILES.map(p => (
              <PolicyBtn key={p.value} active={false} onClick={() => setProfile(p.value)}>
                {p.label}
              </PolicyBtn>
            ))}
          </div>
          <p className="vsm-profile-hint">
            Profiles instantly configure speed, reading mode, and interrupt rules.
          </p>
        </section>

      </div>
    </div>
  );
});
