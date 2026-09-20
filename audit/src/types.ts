export type Tier =
  | 'state'
  | 'directorate'
  | 'agency'
  | 'statutory'
  | 'university'
  | 'college'
  | 'psu'
  | 'district'
  | 'lsg';

export type Scope = 'state' | 'district' | 'local';

export type LsgType =
  | 'corporation'
  | 'municipality'
  | 'district_panchayat'
  | 'block_panchayat'
  | 'grama_panchayat';

export type Platform = 'lsgkerala' | 's3waas' | 'nic-cms';

export interface Site {
  id: string;
  name: string;
  name_ml?: string;
  url: string;
  aliases: string[];
  tier: Tier;
  kind: string;
  department: string;
  org_parent: string | null;
  scope: Scope;
  district: string | null;
  place: string | null;
  lsg_type: LsgType | null;
  platform: Platform | null;
  priority: 1 | 2 | 3;
  tags: string[];
  source: string;
  added: string;
  lifecycle: string;
  notes: string;
}

export interface Department {
  id: string;
  name: string;
  name_ml?: string;
  website: string | null;
}

export interface District {
  id: string;
  name: string;
  name_ml: string;
  hq_place: string;
}

export interface Place {
  id: string;
  name: string;
  name_ml?: string;
  district: string;
  lat: number | null;
  lon: number | null;
}

export interface Minister {
  id: string;
  name: string;
  holder: string;
  departments: string[];
}

export interface IgnoreEntry {
  pattern: string;
  reason: string;
}

export interface Registry {
  sites: Site[];
  departments: Department[];
  districts: District[];
  places: Place[];
  kinds: string[];
  ministers: Minister[];
  ignore: IgnoreEntry[];
  byId: Map<string, Site>;
  byDepartment: Map<string, Site[]>;
  byDistrict: Map<string, Site[]>;
  byMinistry: Map<string, Site[]>;
}
