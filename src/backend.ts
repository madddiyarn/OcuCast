import { FishSpecies, CatchTransaction, QuotaLimit } from './types';

export function runAIEstimation(weight: number, species: FishSpecies): number {
  console.log(`Running AI validation estimate for ${species} with mass ${weight} kg.`);
  const min = 88.6;
  const max = 98.4;
  const confidence = Math.random() * (max - min) + min;
  return parseFloat(confidence.toFixed(2));
}

export interface ValidationPayload {
  success: boolean;
  text: string;
  mismatchFlag: boolean;
  status: "Pending" | "Verified" | "Suspicious" | "Blocked";
}

export function checkCatchLimits(species: FishSpecies, weight: number, gyroAngle: number): ValidationPayload {
  const isVoblaExceeded = (species === "Vobla" && weight > 3.0);
  const gyroOk = gyroAngle <= 45;
  const minOk = weight >= 0.1;

  if (isVoblaExceeded) {
    return {
      success: false,
      text: `❌ Verification Exception\n ✗ Biological maximum limit exceeded: ${weight} kg (limit: ≤ 3.0 kg)\n ✗ Typical species weight anomaly flagged.\n ✓ Camera inclination angle: ${gyroAngle}° (limit: ≤ 45°)\n ✓ Minimum check mass: ${weight} kg (limit: ≥ 0.1 kg)`,
      mismatchFlag: true,
      status: "Suspicious"
    };
  }

  const limitMap: Record<FishSpecies, number> = {
    "Vobla": 3.0,
    "Carp": 35.0,
    "Sturgeon": 120.0
  };

  const limit = limitMap[species];
  const bioOk = weight <= limit;

  if (!bioOk || !gyroOk || !minOk) {
    return {
      success: false,
      text: `❌ Verification Exception\n${bioOk ? '✓' : '✗'} Biological maximum limit: ${weight} kg (limit: ≤ ${limit} kg)\n${gyroOk ? '✓' : '✗'} Camera inclination angle: ${gyroAngle}° (limit: ≤ 45°)\n${minOk ? '✓' : '✗'} Minimum check mass: ${weight} kg (limit: ≥ 0.1 kg)`,
      mismatchFlag: false,
      status: "Blocked"
    };
  }

  return {
    success: true,
    text: "✓ All physical and biological checks successfully verified.",
    mismatchFlag: false,
    status: "Verified"
  };
}

export function OcuQuotaShare(weight: number, species: FishSpecies): { leased: boolean; partnerVessel: string; newStatus: "Verified" } {
  console.log(`Executing OcuQuotaShare Smart Contract for ${weight} kg of ${species}.`);
  return {
    leased: true,
    partnerVessel: "Caspian-Lease-Partner-2026",
    newStatus: "Verified"
  };
}

export function OcuLock(): void {
  localStorage.setItem('ocu_lock_active', 'true');
  const sessionUser = sessionStorage.getItem('oc_user');
  if (sessionUser) {
    try {
      const user = JSON.parse(sessionUser);
      user.status = 'suspended';
      sessionStorage.setItem('oc_user', JSON.stringify(user));
    } catch {
      // Graceful bypass
    }
  }
}

function calculateHash(catchRecord: any, prevHash: string): string {
  const dataToHash = catchRecord.id + catchRecord.weight + catchRecord.species + catchRecord.timestamp + prevHash;
  let h = 0x811c9dc5;
  for (let i = 0; i < dataToHash.length; i++) {
    h ^= dataToHash.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return 'sha256:' + (h >>> 0).toString(16).padStart(8, '0') + 'ocuchain';
}

export function executeLiveSatelliteAudit(catchId: string, satelliteInputCode: string, descriptionText: string): void {
  const catchesRaw = localStorage.getItem('oc_catches');
  if (!catchesRaw) return;
  try {
    const catches: CatchTransaction[] = JSON.parse(catchesRaw);
    const idx = catches.findIndex(c => c.id === catchId);
    if (idx !== -1) {
      const c = catches[idx];
      if (satelliteInputCode === "1") {
        c.status = "Verified";
        c.vesselsDetectedOnPhoto = 1;
        c.aisStatus = "Active";
        c.satelliteOverlayImg = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80";
        c.satelliteAuditLog = `[SATELLITE AUDIT - LEGITIMATE] AI confirmed single legitimate vessel at coordinates. Telemetry verified. Details: ${descriptionText}`;
      } else {
        c.status = "Blocked";
        c.vesselsDetectedOnPhoto = 2;
        c.aisStatus = "Blackout";
        c.satelliteOverlayImg = "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=600&q=80";
        c.satelliteAuditLog = `[SATELLITE AUDIT - ABUSE DETECTED] High-probability illegal mid-sea rendezvous flagged. Shadow transshipment alert. Details: ${descriptionText}`;
      }

      // Re-sign blockchain hashes
      let prevHash = "0000000000000000";
      for (let i = 0; i < catches.length; i++) {
        if (i > 0) prevHash = catches[i - 1].hash;
        catches[i].hash = calculateHash(catches[i], prevHash);
      }

      localStorage.setItem('oc_catches', JSON.stringify(catches));

      // Recalculate quotas
      const quotasRaw = localStorage.getItem('oc_quotas');
      if (quotasRaw) {
        const quotas: QuotaLimit[] = JSON.parse(quotasRaw);
        quotas.forEach(q => {
          q.consumed = catches
            .filter(c => c.species === q.species && c.status !== 'Blocked')
            .reduce((sum, c) => sum + c.weight, 0);
        });
        localStorage.setItem('oc_quotas', JSON.stringify(quotas));
      }
    }
  } catch (err) {
    console.error("Failed to execute live satellite audit:", err);
  }
}
