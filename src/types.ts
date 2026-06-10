export type FishSpecies = "Sturgeon" | "Carp" | "Vobla";

export interface SupplyChainStage {
  stageId: number;
  name: string;
  location: string;
  checkedBy: string;
  timestamp: string;
  verificationType: "QR_Verification_Scan" | "MultiSig_Bluetooth" | "Digital_Stamp_Approval";
  temp?: number | null;
}

export interface CatchTransaction {
  id: string;
  weight: number;
  species: FishSpecies;
  vessel: string;
  timestamp: string;
  location: [number, number];
  status: "Pending" | "Verified" | "Suspicious" | "Blocked";
  imageBase64: string;
  aiConfidence: number;
  oilDetected: boolean;
  coldChainStatus: "Normal" | "Violation";
  currentStage: number;
  gyroAngle: number;
  stages: SupplyChainStage[];
  aisStatus: "Active" | "Blackout" | "Mismatch";
  vesselsDetectedOnPhoto: number;
  satelliteOverlayImg: string;
  satelliteAuditLog?: string;
  hash: string;
}

export interface QuotaLimit {
  species: FishSpecies;
  totalAllocated: number;
  consumed: number;
}
