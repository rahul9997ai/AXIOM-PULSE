export type Role = 'FSM' | 'General Manager' | 'Master Administrator' | 'Salesperson';

export interface Profile {
  id: string;
  email: string | null;
  name: string;
  role: Role;
  dealership_id: string | null;
  active: boolean;
  must_change_password: boolean;
  has_seen_welcome: boolean;
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
  template_id: string | null;
}

export type DeliveryStatus = 'new' | 'requirements_outstanding' | 'ready' | 'delivered' | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'conditional' | 'declined';
export type DueOnDeliveryType = 'collection' | 'refund';

export interface Lender {
  id: string;
  dealership_id: string;
  name: string;
  address: string | null;
  active: boolean;
}

export interface RequirementTemplate {
  id: string;
  dealership_id: string;
  label: string;
  active: boolean;
  sort_order: number;
}

export interface Delivery {
  id: string;
  dealership_id: string;
  fsm_id: string;
  salesperson_id: string;
  customer_name: string;
  stock_number: string | null;
  vehicle: string | null;
  vin: string | null;
  lender_id: string | null;
  lender_name: string | null;
  approval_status: ApprovalStatus;
  delivery_at: string;
  status: DeliveryStatus;
  fsm_notes: string | null;
  due_on_delivery: boolean;
  due_on_delivery_type: DueOnDeliveryType | null;
  due_on_delivery_amount_cents: number | null;
  delivered_at: string | null;
  fsm_name: string | null;
  salesperson_name: string | null;
  lenders?: Lender | null;
  delivery_requirements?: DeliveryRequirement[];
}

export type CommentStatus = 'pending' | 'approved' | 'denied';

export interface DeliveryComment {
  id: string;
  delivery_id: string;
  author_id: string;
  author_name: string;
  author_role: Role;
  body: string;
  requires_decision: boolean;
  status: CommentStatus;
  decision_reason: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface MonthClosure {
  id: string;
  dealership_id: string;
  fsm_id: string;
  year: number;
  month: number;
  closed_at: string;
  closed_by: string;
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

export const STATUS_COLOR: Record<DeliveryStatus, { bg: string; fg: string; border: string }> = {
  new: { bg: '#eaf2ff', fg: '#0a55e6', border: '#0a6cf0' },
  requirements_outstanding: { bg: '#fef3e2', fg: '#b45309', border: '#f59e0b' },
  ready: { bg: '#eafaf0', fg: '#15803d', border: '#22c55e' },
  delivered: { bg: '#eef2f7', fg: '#334155', border: '#94a3b8' },
  cancelled: { bg: '#fdecea', fg: '#a3261b', border: '#ef4444' },
};

export const MANAGER_ROLES: Role[] = ['FSM', 'General Manager', 'Master Administrator'];

export const ROLE_LABEL: Record<Role, string> = {
  FSM: 'FSM view',
  'General Manager': 'General Manager view',
  'Master Administrator': 'Master Administrator view',
  Salesperson: 'Salesperson view',
};
