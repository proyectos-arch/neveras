import { GelPackClient } from './gel-pack-client';

export async function generateStaticParams() {
  // Return empty array for static export compatibility
  // Actual routing will be handled client-side
  return [];
}

export default function GelPackDetailPage() {
  return <GelPackClient />;
}
