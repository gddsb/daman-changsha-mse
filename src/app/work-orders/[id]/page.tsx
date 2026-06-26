import { WorkOrderDetailView } from '@/components/work-orders/work-order-detail-view';

export default function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WorkOrderDetailView params={params} />;
}
