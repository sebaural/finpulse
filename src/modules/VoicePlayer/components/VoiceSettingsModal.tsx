'use client';

import React, { memo } from 'react';
import styles from '../VoicePlayer.module.css';
import type { InterruptPolicy, ReadMode, SpeechRules, TraderProfile, VoiceSettings } from '../types';

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.vsmToggle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className={styles.srOnly}
      />
      <span className={`${styles.vsmToggleTrack}${checked ? ` ${styles.on}` : ''}`} />
      <span className={`${styles.vsmToggleThumb}${checked ? ` ${styles.on}` : ''}`} />
    </label>
  );
}

// ── Rule row ──────────────────────────────────────────────────────────────────

function RuleRow({
  label, sub, checked, onChange,
}: {
  label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className={styles.vsmRuleRow}>
      <div className={styles.vsmRuleText}>
        <span className={styles.vsmRuleLabel}>{label}</span>
        {sub && <span className={styles.vsmRuleSub}>{sub}</span>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ── Policy / profile button ───────────────────────────────────────────────────

function PolicyBtn({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`${styles.vsmPolicyBtn}${active ? ` ${styles.active}` : ''}`}
    >
      {children}
    </button>
  );
}

// ── Select wrapper ────────────────────────────────────────────────────────────

function SettingsSelect({
  value, onChange, children,
}: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={styles.vsmSelect}
    >
      {children}
    </select>
  );
}

// ── Option constants ──────────────────────────────────────────────────────────

const INTERRUPT_POLICIES: { value: InterruptPolicy; label: string }[] = [
  { value: 'always',   label: 'Always interrupt'      },
  { value: 'critical', label: 'P1 only (recommended)' },
  { value: 'never',    label: 'Never interrupt'        },
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
  { value: 'headline', label: 'Headline only'      },
  { value: 'summary',  label: 'Headline + context' },
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
  isOpen:             boolean;
  onClose:            () => void;
  mode:               ReadMode;
  setMode:            (m: ReadMode) => void;
  voiceSettings:      VoiceSettings;
  setVoiceSettings:   (patch: Partial<VoiceSettings>) => void;
  voices:             SpeechSynthesisVoice[];
  rules:              SpeechRules;
  setRules:           (patch: Partial<SpeechRules>) => void;
  interruptPolicy:    InterruptPolicy;
  setInterruptPolicy: (p: InterruptPolicy) => void;
  setProfile:         (p: TraderProfile) => void;
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
      className={styles.vsmOverlay}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.vsmPanel} role="dialog" aria-modal="true" aria-label="Voice settings">

        {/* Header */}
        <div className={styles.vsmHeader}>
          <span className={styles.vsmTitle}>⚙ Voice Reader Settings</span>
          <button onClick={onClose} className={styles.vsmClose} aria-label="Close settings">✕</button>
        </div>

        {/* Reading rules */}
        <section className={styles.vsmSection}>
          <div className={styles.vsmSectionTitle}>Reading Rules</div>
          <div className={styles.vsmRuleGrid}>
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
        <section className={styles.vsmSection}>
          <div className={styles.vsmSectionTitle}>Interrupt Policy</div>
          <div className={styles.vsmBtnRow}>
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
        <section className={styles.vsmSection}>
          <div className={styles.vsmSectionTitle}>Voice &amp; Reading</div>
          <div className={styles.vsmSelectsGrid}>

            <div className={styles.vsmSelectGroup}>
              <label className={styles.vsmSelectLabel}>Mode</label>
              <SettingsSelect value={mode} onChange={v => setMode(v as ReadMode)}>
                {MODE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SettingsSelect>
            </div>

            <div className={styles.vsmSelectGroup}>
              <label className={styles.vsmSelectLabel}>Voice</label>
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

            <div className={styles.vsmSelectGroup}>
              <label className={styles.vsmSelectLabel}>Speed</label>
              <SettingsSelect
                value={String(voiceSettings.rate)}
                onChange={v => setVoiceSettings({ rate: parseFloat(v) })}
              >
                {RATE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SettingsSelect>
            </div>

            <div className={styles.vsmSelectGroup}>
              <label className={styles.vsmSelectLabel}>Gap between articles</label>
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

        {/* Trader profile presets */}
        <section className={styles.vsmSection}>
          <div className={styles.vsmSectionTitle}>Trader Profile Presets</div>
          <div className={styles.vsmBtnRow}>
            {PROFILES.map(p => (
              <PolicyBtn key={p.value} active={false} onClick={() => setProfile(p.value)}>
                {p.label}
              </PolicyBtn>
            ))}
          </div>
          <p className={styles.vsmProfileHint}>
            Profiles instantly configure speed, reading mode, and interrupt rules.
          </p>
        </section>

      </div>
    </div>
  );
});
