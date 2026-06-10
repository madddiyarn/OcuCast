export interface Fisherman {
  id: string;
  name: string;
  vessel: string;
  status: 'approved' | 'pending' | 'suspended';
  greenScore: number;
  login?: string;
  password?: string;
}

export interface SupplyChainStep {
  stage: 'sea' | 'port' | 'factory' | 'retail';
  label: string;
  done: boolean;
  time: string | null;
  inspector: string | null;
  temp: number | null;
  multisig: 'auto' | 'confirmed' | 'manual' | null;
}

export interface CatchRecord {
  id: string;
  fisherman_id: string;
  vessel: string;
  species: string;
  species_en: string;
  weight_kg: number;
  verified: boolean;
  hardware_verified: boolean;
  timestamp: string;
  gps_lat: number;
  gps_lng: number;
  gps_label: string;
  freshness_index: number;
  oil_detected: boolean;
  price_per_kg: number;
  quota_share_used: boolean;
  quota_share_partner_vessel: string | null;
  quota_share_partner_name: string | null;
  hash: string;
  supply_chain: SupplyChainStep[];
}

export interface QuotaLimit {
  species: string;
  allocated: number;
  used: number;
  unit: string;
  icon: string;
  label: string;
}

export interface AnomalyLog {
  id: string;
  timestamp: string;
  vessel: string;
  species: string;
  weight: number;
  description: string;
  status: 'blocked' | 'pending_review' | 'approved_manually' | 'rejected';
  sent_to_moderator: boolean;
}

export interface SpeciesLimit {
  max_weight_kg: number;
  typical_weight: string;
  name_ru: string;
}
