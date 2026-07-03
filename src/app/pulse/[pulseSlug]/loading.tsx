import PulseHeader from '@/components/pulse/PulseHeader';
import '@/components/pulse/pulse.css';

export default function PulseCategoryLoading() {
  return (
    <>
      <PulseHeader />
      <main className="pulse-page">
        <div className="pulse-container">
          <div className="pulse-loading" aria-hidden="true">
            <div className="pulse-loading-line pulse-loading-line--short" />
            <div className="pulse-loading-line" />
            <div className="pulse-loading-line" />
            <div className="pulse-loading-line pulse-loading-line--short" />
          </div>
        </div>
      </main>
    </>
  );
}
