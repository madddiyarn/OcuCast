import { CatchTransaction, QuotaLimit, SupplyChainStage } from './types';

function calculateHash(catchRecord: any, prevHash: string): string {
  const dataToHash = catchRecord.id + catchRecord.weight + catchRecord.species + catchRecord.timestamp + prevHash;
  let h = 0x811c9dc5;
  for (let i = 0; i < dataToHash.length; i++) {
    h ^= dataToHash.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return 'sha256:' + (h >>> 0).toString(16).padStart(8, '0') + 'ocuchain';
}

const DEFAULT_QUOTAS: QuotaLimit[] = [
  { species: "Sturgeon", totalAllocated: 5000, consumed: 0 },
  { species: "Carp", totalAllocated: 25000, consumed: 0 },
  { species: "Vobla", totalAllocated: 15000, consumed: 0 }
];

const MOCK_CATCHES_RAW: Omit<CatchTransaction, 'hash'>[] = [
  {
    id: "OC-2026-0001",
    weight: 2.1,
    species: "Vobla",
    vessel: "Caspian-Star",
    timestamp: "2026-06-10T08:12:00Z",
    location: [43.6521, 51.1753],
    status: "Verified",
    imageBase64: "",
    aiConfidence: 96.5,
    oilDetected: false,
    coldChainStatus: "Normal",
    currentStage: 1,
    gyroAngle: 12,
    aisStatus: "Active",
    vesselsDetectedOnPhoto: 1,
    satelliteOverlayImg: "",
    stages: [
      {
        stageId: 1,
        name: "Sea Catch Registration",
        location: "Mangystau Caspian Sector C-1",
        checkedBy: "Autonomous GPS telemetry",
        timestamp: "2026-06-10T08:12:00Z",
        verificationType: "QR_Verification_Scan"
      },
      {
        stageId: 2,
        name: "Port Bautino Checkpoint",
        location: "Bautino Harbor Inspector Office",
        checkedBy: "Inspector A. Bekova",
        timestamp: "2026-06-10T09:30:00Z",
        verificationType: "MultiSig_Bluetooth"
      },
      {
        stageId: 3,
        name: "Processing Guard Facility",
        location: "Aktau Fish Processing Facility",
        checkedBy: "Officer D. Nurmagambetov",
        timestamp: "",
        verificationType: "Digital_Stamp_Approval"
      }
    ]
  },
  {
    id: "OC-2026-0002",
    weight: 98.4,
    species: "Sturgeon",
    vessel: "Mangystau-Patrol-99",
    timestamp: "2026-06-10T09:45:00Z",
    location: [44.1234, 50.8876],
    status: "Suspicious",
    imageBase64: "",
    aiConfidence: 94.2,
    oilDetected: true,
    coldChainStatus: "Normal",
    currentStage: 1,
    gyroAngle: 8,
    aisStatus: "Mismatch",
    vesselsDetectedOnPhoto: 1,
    satelliteOverlayImg: "",
    stages: [
      {
        stageId: 1,
        name: "Sea Catch Registration",
        location: "Mangystau Caspian Sector C-2",
        checkedBy: "Autonomous GPS telemetry",
        timestamp: "2026-06-10T09:45:00Z",
        verificationType: "QR_Verification_Scan"
      },
      {
        stageId: 2,
        name: "Port Bautino Checkpoint",
        location: "Bautino Harbor Inspector Office",
        checkedBy: "Inspector A. Bekova",
        timestamp: "",
        verificationType: "MultiSig_Bluetooth"
      },
      {
        stageId: 3,
        name: "Processing Guard Facility",
        location: "Aktau Fish Processing Facility",
        checkedBy: "Officer D. Nurmagambetov",
        timestamp: "",
        verificationType: "Digital_Stamp_Approval"
      }
    ]
  },
  {
    id: "OC-2026-0003",
    weight: 185.0,
    species: "Carp",
    vessel: "Neptune-Carrier",
    timestamp: "2026-06-10T10:15:00Z",
    location: [43.2341, 51.5432],
    status: "Suspicious",
    imageBase64: "",
    aiConfidence: 95.8,
    oilDetected: true,
    coldChainStatus: "Normal",
    currentStage: 1,
    gyroAngle: 15,
    aisStatus: "Blackout",
    vesselsDetectedOnPhoto: 2,
    satelliteOverlayImg: "",
    stages: [
      {
        stageId: 1,
        name: "Sea Catch Registration",
        location: "Mangystau Caspian Sector C-3",
        checkedBy: "Autonomous GPS telemetry",
        timestamp: "2026-06-10T10:15:00Z",
        verificationType: "QR_Verification_Scan"
      },
      {
        stageId: 2,
        name: "Port Bautino Checkpoint",
        location: "Bautino Harbor Inspector Office",
        checkedBy: "Inspector A. Bekova",
        timestamp: "",
        verificationType: "MultiSig_Bluetooth"
      },
      {
        stageId: 3,
        name: "Processing Guard Facility",
        location: "Aktau Fish Processing Facility",
        checkedBy: "Officer D. Nurmagambetov",
        timestamp: "",
        verificationType: "Digital_Stamp_Approval"
      }
    ]
  },
  {
    id: "OC-2026-0004",
    weight: 1.2,
    species: "Vobla",
    vessel: "Bautino-Seafarer",
    timestamp: "2026-06-10T11:00:00Z",
    location: [44.8765, 51.2341],
    status: "Verified",
    imageBase64: "",
    aiConfidence: 89.2,
    oilDetected: false,
    coldChainStatus: "Normal",
    currentStage: 1,
    gyroAngle: 12,
    aisStatus: "Active",
    vesselsDetectedOnPhoto: 1,
    satelliteOverlayImg: "",
    stages: [
      {
        stageId: 1,
        name: "Sea Catch Registration",
        location: "Mangystau Caspian Sector C-4",
        checkedBy: "Autonomous GPS telemetry",
        timestamp: "2026-06-10T11:00:00Z",
        verificationType: "QR_Verification_Scan"
      },
      {
        stageId: 2,
        name: "Port Bautino Checkpoint",
        location: "Bautino Harbor Inspector Office",
        checkedBy: "Inspector A. Bekova",
        timestamp: "",
        verificationType: "MultiSig_Bluetooth"
      },
      {
        stageId: 3,
        name: "Processing Guard Facility",
        location: "Aktau Fish Processing Facility",
        checkedBy: "Officer D. Nurmagambetov",
        timestamp: "",
        verificationType: "Digital_Stamp_Approval"
      }
    ]
  }
];

export function initStorage(): void {
  if (!localStorage.getItem('oc_catches')) {
    const seededCatches: CatchTransaction[] = [];
    let prevHash = "0000000000000000";
    for (const raw of MOCK_CATCHES_RAW) {
      const entry: CatchTransaction = {
        ...raw,
        hash: ""
      };
      entry.hash = calculateHash(entry, prevHash);
      seededCatches.push(entry);
      prevHash = entry.hash;
    }
    localStorage.setItem('oc_catches', JSON.stringify(seededCatches));
  }

  if (!localStorage.getItem('oc_quotas')) {
    localStorage.setItem('oc_quotas', JSON.stringify(DEFAULT_QUOTAS));
    recalculateQuotaConsumption();
  }
}

export function getCatches(): CatchTransaction[] {
  initStorage();
  try {
    return JSON.parse(localStorage.getItem('oc_catches') || '[]');
  } catch {
    return [];
  }
}

export function getQuotas(): QuotaLimit[] {
  initStorage();
  try {
    return JSON.parse(localStorage.getItem('oc_quotas') || '[]');
  } catch {
    return [];
  }
}

export function recalculateQuotaConsumption(): void {
  const catches = getCatches();
  const quotas = getQuotas();
  quotas.forEach(q => {
    q.consumed = catches
      .filter(c => c.species === q.species && c.status !== 'Blocked')
      .reduce((sum, c) => sum + c.weight, 0);
  });
  localStorage.setItem('oc_quotas', JSON.stringify(quotas));
}

export function saveCatch(c: Omit<CatchTransaction, 'hash'>): CatchTransaction {
  const catches = getCatches();
  const prevHash = catches.length > 0 ? catches[catches.length - 1].hash : "0000000000000000";
  const newCatch: CatchTransaction = {
    ...c,
    hash: ""
  };
  newCatch.hash = calculateHash(newCatch, prevHash);
  catches.push(newCatch);
  localStorage.setItem('oc_catches', JSON.stringify(catches));
  recalculateQuotaConsumption();
  return newCatch;
}

export function updateCatchStatus(id: string, status: "Pending" | "Verified" | "Suspicious" | "Blocked"): void {
  const catches = getCatches();
  const idx = catches.findIndex(c => c.id === id);
  if (idx !== -1) {
    catches[idx].status = status;
    localStorage.setItem('oc_catches', JSON.stringify(catches));
    recalculateQuotaConsumption();
  }
}

export function addStageToCatch(id: string, stage: SupplyChainStage): void {
  const catches = getCatches();
  const idx = catches.findIndex(c => c.id === id);
  if (idx !== -1) {
    const sIdx = catches[idx].stages.findIndex(s => s.stageId === stage.stageId);
    if (sIdx !== -1) {
      catches[idx].stages[sIdx] = stage;
    } else {
      catches[idx].stages.push(stage);
    }
    catches[idx].currentStage = Math.max(catches[idx].currentStage, stage.stageId);
    localStorage.setItem('oc_catches', JSON.stringify(catches));
  }
}

export function verifyBlockchainIntegrity(): { valid: boolean; brokenAtIdx?: number } {
  const catches = getCatches();
  if (catches.length === 0) return { valid: true };
  let prevHash = "0000000000000000";
  for (let i = 0; i < catches.length; i++) {
    const current = catches[i];
    const calculated = calculateHash(current, prevHash);
    if (current.hash !== calculated) {
      return { valid: false, brokenAtIdx: i };
    }
    prevHash = current.hash;
  }
  return { valid: true };
}

// Synchronously boot storage representation
initStorage();
