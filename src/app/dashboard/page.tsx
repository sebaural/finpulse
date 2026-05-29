import type { Metadata } from 'next';
import DashboardLoader from './DashboardLoader';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <DashboardLoader />;
}
