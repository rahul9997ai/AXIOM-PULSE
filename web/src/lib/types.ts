export type Role = 'FSM' | 'General Manager' | 'Master Administrator' | 'Salesperson';

export interface Profile {
  id: string;
  email: string | null;
  name: string;
  role: Role;
  dealership_id: string | null;
  active: boolean;
}

export type RequirementStatus = 'outstanding' | 'completed' | 'exception';

export interface DeliveryRequirement {
  id: string;
  delivery_id: string;
  kind: string;
  label: string;
  status: RequirementStatus;
  exception_reason: string | null;
  completed_by: string | null;
  completed_at: string | null;
}

export type DeliveryStatus = 'new' | 'requirements_outstanding' | 'ready' | 'delivered' | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'conditional' | 'declined';

export interface Delivery {
  id: string;
  dealership_id: string;
  fsm_id: string;
  salesperson_id: string;
  customer_name: string;
  vehicle: string;
  vin: string | null;
  lender_name: string | null;
  approval_status: ApprovalStatus;
  delivery_at: string;
  status: DeliveryStatus;
  fsm_notes: string | null;
  money_due_cents: number;
  refund_cents: number;
  delivered_at: string | null;
  delivery_requirements?: DeliveryRequirement[];
}

export interface DeliveryEvent {
  id: string;
  delivery_id: string;
  actor_id: string | null;
  event_type: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  new: 'New',
  requirements_outstanding: 'Requirements Outstanding',
  ready: 'Ready for Delivery',
  delivered: 'Delivery Complete',
  cancelled: 'Cancelled',
};
