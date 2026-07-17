export interface OperationalEntry {
  metric_date: string;
  store_number: string;
  column_name: string;
  column_key: string;
  value: string;
  value_numeric: number | null;
}

export interface OpStatusHistory {
  id: number;
  status: string;
  effective_date: string | null;
  notes: string | null;
  store?: { id: number; store_number: string } | null;
}

export interface OpObsession {
  birth_date: string | null;
  t_shirt: string | null;
  image_url: string | null;
  religion: string | null;
  race: string | null;
  notes: string | null;
}

export interface OpEmployeeStore {
  id: number;
  effective_date: string | null;
  store?: { id: number; store_number: string } | null;
}

export interface OperationalEmployee {
  id: number;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  gender: string | null;
  employment_type: string | null;
  status_histories: OpStatusHistory[];
  pay_histories: unknown[];
  contacts: unknown[];
  addresses: unknown[];
  obsession: OpObsession | null;
  positions: unknown[];
  stores: OpEmployeeStore[];
  maritals: unknown[];
  attachments: unknown[];
  [key: string]: unknown;
}

export interface OperationalResult {
  employee: OperationalEmployee;
  entries: OperationalEntry[];
  currentPage: number | null;
  lastPage: number | null;
  total: number | null;
}
