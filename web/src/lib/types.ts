export type Role = 'FSM' | 'General Manager' | 'Master Administrator' | 'Salesperson';

export interface Profile {
  id: string;
  email: string | null;
  name: string;
  role: Role;
  dealership_id: string | null;
  active: boolean;
}

export interface DeliveryRequirement {
  id: string;
  delivery_id: string;
  kind: string;
  label: string;
  completed: boolean;
  completed_at: string | null;
}

export interface Delivery {
  id: string;
  dealership_id: string;
  fsm_id: string;
  salesperson_id: string;
  customer_name: string;
  vehicle: string;
  lender_name: string | null;
  delivery_at: string;
  status: 'scheduled' | 'delivered' | 'cancelled';
  fsm_notes: string | null;
  delivered_at: string | null;
  delivery_requirements?: DeliveryRequirement[];
}
