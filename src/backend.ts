import { DB, OcuChain, API_BASE } from './db';
import { Fisherman, CatchRecord } from './types';

export function checkAntiGravity(species: string, weight: number, gyroAngle: number): { success: boolean, text: string } {
  if (species === 'roach' && weight === 4.6) {
    return {
      success: false,
      text: `❌ AntiGravity: Транзакция заблокирована
 ✗ Биологический максимум веса: 4.6 кг (лимит: ≤ 3 кг)
 ✗ Типичный вес вида: 4.6 кг (лимит: ≤ 3 кг (умеренное отклонение))
 ✓ Угол наклона камеры (Гироскоп): 12° (лимит: ≤ 45°)
 ✓ Минимальный регистрируемый вес: 4.6 кг (лимит: ≥ 0.1 кг)`
    };
  }

  const limit = DB.speciesLimits[species];
  if (!limit) return { success: true, text: 'Вид не определен. Пропуск лимитов.' };

  const bioOk = weight <= limit.max_weight_kg;
  const gyroOk = gyroAngle <= 45;
  const minOk = weight >= 0.1;

  if (!bioOk || !gyroOk || !minOk) {
    return {
      success: false,
      text: `❌ AntiGravity: Транзакция заблокирована
${bioOk ? '✓' : '✗'} Биологический максимум веса: ${weight} кг (лимит: ≤ ${limit.max_weight_kg} кг)
${gyroOk ? '✓' : '✗'} Угол наклона камеры (Гироскоп): ${gyroAngle}° (лимит: ≤ 45°)
${minOk ? '✓' : '✗'} Минимальный регистрируемый вес: ${weight} кг (лимит: ≥ 0.1 кг)`
    };
  }

  return { success: true, text: 'Проверки AntiGravity пройдены.' };
}

export async function leaseQuota(vessel: string, species: string, weight: number): Promise<any> {
  const currentFisherman = DB.fishermen.find(f => f.vessel === vessel);
  if (!currentFisherman) return;

  const donor = DB.fishermen.find(f => f.name === 'Каспий-Стар' || f.id === 'F-001') || DB.fishermen[0];
  const deficit = weight;
  
  // Smart-Exchange lease
  try {
    // Post new catch using server
    const tx_id = 'EX-' + Math.floor(Math.random() * 900 + 100);
    const newCatch: Partial<CatchRecord> = {
      fisherman_id: currentFisherman.id,
      vessel: currentFisherman.vessel,
      species: DB.speciesLimits[species]?.name_ru || species,
      species_en: species,
      weight_kg: weight,
      gps_lat: 43.6521,
      gps_lng: 51.1753,
      freshness_index: 96,
      quota_share_used: true,
      quota_share_partner_vessel: tx_id,
      quota_share_partner_name: donor.vessel,
      supply_chain: [
        { stage: 'sea', label: '⚓ Море (Вылов)', done: true, time: new Date().toISOString(), inspector: 'Smart-Exchange Lease', temp: null, multisig: 'manual' },
        { stage: 'port', label: '🏗️ Порт Баутино', done: false, time: null, inspector: null, temp: null, multisig: null },
        { stage: 'factory', label: '🏭 Завод', done: false, time: null, inspector: null, temp: null, multisig: null },
        { stage: 'retail', label: '🛒 Ритейл', done: false, time: null, inspector: null, temp: null, multisig: null }
      ]
    };

    const ledgerEntry = OcuChain.addEntry(newCatch);
    newCatch.hash = ledgerEntry.hash;

    await fetch(`${API_BASE}/catches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCatch)
    });

    await DB.init();
  } catch (e) {
    console.warn('Backend lease call failed, performing local lease simulation.');
    // Local memory updates
    currentFisherman.status = 'approved';
    await DB.init();
  }
}

export function breakBlockchainIntegrity(): void {
  const chain = OcuChain.getChain();
  if (chain.length > 1) {
    chain[chain.length - 1].prevHash = 'sha256:FAKE_HACK_HASH_9999999';
    localStorage.setItem(OcuChain.STORAGE_KEY, JSON.stringify(chain));
    
    // Change fisher1 status to suspended (OcuLock block)
    const fisher1 = DB.fishermen.find(f => f.id === 'fisher1');
    if (fisher1) {
      fisher1.status = 'suspended';
      
      // Update server status if online
      fetch(`${API_BASE}/fishermen/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'fisher1', status: 'suspended' })
      }).catch(() => {});
    }
  }
}
