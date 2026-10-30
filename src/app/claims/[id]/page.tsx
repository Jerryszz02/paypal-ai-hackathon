import { ClaimDetailView } from '@/components/claim-detail';
export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClaimDetailView key={id} id={id} />;
}
