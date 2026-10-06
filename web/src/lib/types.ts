export type Role = 'FSM' | 'General Manager' | 'Master Administrator' | 'Salesperson' | 'Sales Manager';

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
export type VehicleCondition = 'new' | 'used';

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
  // The date the deal was actually sold/written, from the deal jacket —
  // entered by the FSM when creating the delivery (they have the contract
  // in front of them), since it drives hat-trick bonus eligibility and can
  // differ from delivery_at (the scheduled handover date, which may land
  // days or weeks later once financing is approved). A salesperson can
  // still fill it in on older deliveries that predate this field.
  sold_at: string | null;
  vehicle_condition: VehicleCondition | null;
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

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  new: 'New',
  requirements_outstanding: 'Requirements Outstanding',
  ready: 'Ready for Delivery',
  delivered: 'Delivery Complete',
  cancelled: 'Cancelled',
};

// Single source of truth for status coloring — `solid` is the flat-fill
// tone used for the Deliveries list pill, `bg`/`fg`/`border` the tinted
// badge used on the detail page and calendar. Keeping both here means a
// future palette tweak can't desync the list from the detail/calendar view.
export const STATUS_COLOR: Record<DeliveryStatus, { bg: string; fg: string; border: string; solid: string }> = {
  new: { bg: '#eaf2ff', fg: '#0a55e6', border: '#0a6cf0', solid: '#0a6cf0' },
  requirements_outstanding: { bg: '#fef3e2', fg: '#b45309', border: '#f59e0b', solid: '#f59e0b' },
  ready: { bg: '#eafaf0', fg: '#15803d', border: '#22c55e', solid: '#16a34a' },
  delivered: { bg: '#eef2f7', fg: '#334155', border: '#94a3b8', solid: '#64748b' },
  cancelled: { bg: '#fdecea', fg: '#a3261b', border: '#ef4444', solid: '#ef4444' },
};

// Roles that can create/edit/approve/manage — Sales Manager is deliberately
// excluded: they get the same dealership-wide visibility as these roles
// (see DEALERSHIP_VIEW_ROLES) but no write access anywhere, enforced both
// here (gates every create/edit UI and route) and in the deliveries RLS
// policy (no insert/update/delete policy references 'Sales Manager').
export const MANAGER_ROLES: Role[] = ['FSM', 'General Manager', 'Master Administrator'];

// Roles that see the dealership's full delivery list rather than just their
// own — a superset of MANAGER_ROLES that also includes the read-only Sales
// Manager. Use this (not MANAGER_ROLES) for view-scope checks; keep using
// MANAGER_ROLES for anything that performs or offers a write action.
export const DEALERSHIP_VIEW_ROLES: Role[] = [...MANAGER_ROLES, 'Sales Manager'];

export const ROLE_LABEL: Record<Role, string> = {
  FSM: 'FSM view',
  'General Manager': 'General Manager view',
  'Master Administrator': 'Master Administrator view',
  Salesperson: 'Salesperson view',
  'Sales Manager': 'Sales Manager view',
};
