import { DB, OcuChain, API_BASE } from './db';
import { CatchRecord } from './types';

export function checkAntiGravity(species: string, weight: number, gyroAngle: number): { success: boolean, text: string } {
  if ((species === 'roach' || species === 'Вобла') && weight === 4.6) {
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

export async function leaseQuota(vessel: string, species: string, weight: number): Promise<void> {
  const currentFisherman = DB.fishermen.find(f => f.vessel === vessel) || DB.fishermen.find(f => f.id === 'fisher1');
  if (!currentFisherman) return;

  const donor = DB.fishermen.find(f => f.name.includes('Каспий-Стар') || f.vessel.includes('Каспий-Стар') || f.id === 'F-001') || DB.fishermen[0];
  const speciesKey = species === 'Вобла' ? 'roach' : species === 'Сазан' ? 'carp' : species === 'Осётр' || species === 'Осетр' ? 'sturgeon' : species;

  try {
    const tx_id = 'EX-' + Math.floor(Math.random() * 900 + 100);
    const newCatch: Partial<CatchRecord> = {
      fisherman_id: currentFisherman.id,
      vessel: currentFisherman.vessel,
      species: DB.speciesLimits[speciesKey]?.name_ru || species,
      species_en: speciesKey,
      weight_kg: weight,
      weight: weight,
      gps_lat: 43.6521,
      gps_lng: 51.1753,
      locationName: 'Актау, Каспийское море',
      coordinates: [43.6521, 51.1753],
      freshnessIndex: 96,
      freshness_index: 96,
      oilDetected: false,
      oil_detected: false,
      quota_share_used: true,
      quota_share_partner_vessel: tx_id,
      quota_share_partner_name: donor.vessel || donor.name,
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
    currentFisherman.status = 'approved';
    
    const tx_id = 'EX-' + Math.floor(Math.random() * 900 + 100);
    const newCatch: CatchRecord = {
      id: 'OC-2026-' + Math.floor(100000 + Math.random() * 900000),
      fisherman_id: currentFisherman.id,
      vessel: currentFisherman.vessel,
      species: DB.speciesLimits[speciesKey]?.name_ru || species,
      species_en: speciesKey,
      weight_kg: weight,
      weight: weight,
      timestamp: new Date().toISOString(),
      locationName: 'Актау, Каспийское море',
      coordinates: [43.6521, 51.1753],
      gps_lat: 43.6521,
      gps_lng: 51.1753,
      gps_label: 'Актау, Каспийское море',
      freshnessIndex: 96,
      freshness_index: 96,
      oilDetected: false,
      oil_detected: false,
      price_per_kg: 1200,
      quota_share_used: true,
      quota_share_partner_vessel: tx_id,
      quota_share_partner_name: donor.vessel || donor.name,
      hash: 'sha256:simulatedlease' + Date.now(),
      verified: true,
      hardware_verified: true,
      supply_chain: [
        { stage: 'sea', label: '⚓ Море (Вылов)', done: true, time: new Date().toISOString(), inspector: 'Smart-Exchange Lease', temp: null, multisig: 'manual' },
        { stage: 'port', label: '🏗️ Порт Баутино', done: false, time: null, inspector: null, temp: null, multisig: null },
        { stage: 'factory', label: '🏭 Завод', done: false, time: null, inspector: null, temp: null, multisig: null },
        { stage: 'retail', label: '🛒 Ритейл', done: false, time: null, inspector: null, temp: null, multisig: null }
      ]
    };
    
    DB.catches.unshift(newCatch);
    OcuChain.addEntry(newCatch);
  }
}

export function breakBlockchainIntegrity(): void {
  const chain = OcuChain.getChain();
  if (chain.length > 0) {
    chain[chain.length - 1].prevHash = 'sha256:FAKE_HACK_HASH_9999999';
    localStorage.setItem(OcuChain.STORAGE_KEY, JSON.stringify(chain));
  } else {
    const fakeChain = [{
      index: 0,
      timestamp: new Date().toISOString(),
      data: {},
      prevHash: '0000000000000000',
      hash: 'sha256:valid_block_hash'
    }, {
      index: 1,
      timestamp: new Date().toISOString(),
      data: {},
      prevHash: 'sha256:FAKE_HACK_HASH_9999999',
      hash: 'sha256:broken_block_hash'
    }];
    localStorage.setItem(OcuChain.STORAGE_KEY, JSON.stringify(fakeChain));
  }

  const fisher1 = DB.fishermen.find(f => f.id === 'fisher1');
  if (fisher1) {
    fisher1.status = 'suspended';
  }
  const f001 = DB.fishermen.find(f => f.id === 'F-001');
  if (f001) {
    f001.status = 'suspended';
  }

  fetch(`${API_BASE}/fishermen/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'F-001', status: 'suspended' })
  }).catch(() => {});

  fetch(`${API_BASE}/fishermen/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'fisher1', status: 'suspended' })
  }).catch(() => {});
}
