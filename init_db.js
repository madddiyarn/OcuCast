/**
 * OcuCast — Database Initialization Script
 * Connects to Neon PostgreSQL and creates tables + inserts seed data.
 */

const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_d5E1qhHoARUC@ep-winter-bonus-apomsfmg-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function init() {
  const client = new Client({ connectionString });
  
  try {
    console.log('Connecting to PostgreSQL database on Neon...');
    await client.connect();
    console.log('Connected successfully!');

    // 1. Create tables
    console.log('Creating tables...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS fishermen (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        login VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        vessel VARCHAR(100) NOT NULL,
        vessel_id VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        green_score INT NOT NULL,
        license_expires VARCHAR(20) NOT NULL,
        personal_quota JSONB NOT NULL,
        used_quota JSONB NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS catches (
        id VARCHAR(50) PRIMARY KEY,
        fisherman_id VARCHAR(50) REFERENCES fishermen(id) ON DELETE SET NULL,
        vessel VARCHAR(100) NOT NULL,
        species VARCHAR(100) NOT NULL,
        species_en VARCHAR(50) NOT NULL,
        weight_kg NUMERIC(6, 2) NOT NULL,
        verified BOOLEAN DEFAULT TRUE,
        hardware_verified BOOLEAN DEFAULT TRUE,
        timestamp TIMESTAMPTZ NOT NULL,
        gps_lat NUMERIC(9, 6) NOT NULL,
        gps_lng NUMERIC(9, 6) NOT NULL,
        gps_label VARCHAR(100) NOT NULL,
        freshness_index INT NOT NULL,
        oil_detected BOOLEAN DEFAULT FALSE,
        price_per_kg NUMERIC(10, 2) NOT NULL,
        quota_share_used BOOLEAN DEFAULT FALSE,
        quota_share_partner_vessel VARCHAR(50),
        quota_share_partner_name VARCHAR(100),
        hash VARCHAR(255) NOT NULL,
        supply_chain JSONB NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS antifrod_log (
        id VARCHAR(50) PRIMARY KEY,
        ts TIMESTAMPTZ NOT NULL,
        vessel VARCHAR(100) NOT NULL,
        species VARCHAR(50) NOT NULL,
        weight NUMERIC(6, 2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        sent_to_moderator BOOLEAN DEFAULT FALSE
      );
    `);

    console.log('Tables created or already exist.');

    // 2. Insert seed data if empty
    const checkFishermen = await client.query('SELECT COUNT(*) FROM fishermen');
    if (parseInt(checkFishermen.rows[0].count) === 0) {
      console.log('Seeding fishermen...');
      await client.query(`
        INSERT INTO fishermen (id, name, login, password, vessel, vessel_id, status, green_score, license_expires, personal_quota, used_quota)
        VALUES 
        ('F-001', 'Ержан Сейтжанов', 'fisher1', 'demo', 'Каспий-Стар', 'KZ-MNG-4412', 'approved', 94, '2026-12-31', '{"sturgeon": 80, "carp": 600, "roach": 1200}', '{"sturgeon": 12, "carp": 287, "roach": 541}'),
        ('F-002', 'Болат Жунисов', 'fisher2', 'demo', 'Мангистау', 'KZ-MNG-2287', 'pending', 71, '2026-06-30', '{"sturgeon": 60, "carp": 450, "roach": 900}', '{"sturgeon": 0, "carp": 0, "roach": 0}'),
        ('F-003', 'Серік Аблаев', 'fisher3', 'demo', 'Ак-Жол', 'KZ-MNG-8801', 'approved', 88, '2026-12-31', '{"sturgeon": 100, "carp": 700, "roach": 1400}', '{"sturgeon": 8, "carp": 312, "roach": 688}')
      `);
    }

    const checkCatches = await client.query('SELECT COUNT(*) FROM catches');
    if (parseInt(checkCatches.rows[0].count) === 0) {
      console.log('Seeding catches...');
      await client.query(`
        INSERT INTO catches (id, fisherman_id, vessel, species, species_en, weight_kg, verified, hardware_verified, timestamp, gps_lat, gps_lng, gps_label, freshness_index, oil_detected, price_per_kg, quota_share_used, quota_share_partner_vessel, quota_share_partner_name, hash, supply_chain)
        VALUES 
        ('OC-2026-000184', 'F-001', 'Каспий-Стар', 'Вобла', 'roach', 11.8, true, true, '2026-06-10T07:32:14Z', 43.6521, 51.1753, 'Актау, Каспийское море', 96, false, 1200, true, 'EX-992', 'Баутино-Стар', 'sha256:a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9', '[
          {"stage": "sea", "label": "⚓ Море (Вылов)", "done": true, "time": "2026-06-10T07:32:14Z", "inspector": "GPS автофиксация", "temp": null, "multisig": "auto"},
          {"stage": "port", "label": "🏗️ Порт Баутино", "done": true, "time": "2026-06-10T09:15:00Z", "inspector": "Айгерим Бекова (INS-01)", "temp": 2, "multisig": "confirmed"},
          {"stage": "factory", "label": "🏭 Завод (-4°C Guard)", "done": true, "time": "2026-06-10T11:40:00Z", "inspector": "Дамир Нурмагамбетов", "temp": -4, "multisig": "confirmed"},
          {"stage": "retail", "label": "🛒 Ритейл в Актау", "done": false, "time": null, "inspector": null, "temp": null, "multisig": null}
        ]'),
        ('OC-2026-000201', 'F-003', 'Ак-Жол', 'Сазан', 'carp', 6.2, true, true, '2026-06-10T09:12:00Z', 44.1234, 50.8876, 'Баутино, Мангистау', 99, false, 950, false, null, null, 'sha256:b4g9c3d2e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1', '[
          {"stage": "sea", "label": "⚓ Море (Вылов)", "done": true, "time": "2026-06-10T09:12:00Z", "inspector": "GPS автофиксация", "temp": null, "multisig": "auto"},
          {"stage": "port", "label": "🏗️ Порт Курык", "done": false, "time": null, "inspector": null, "temp": null, "multisig": null},
          {"stage": "factory", "label": "🏭 Завод", "done": false, "time": null, "inspector": null, "temp": null, "multisig": null},
          {"stage": "retail", "label": "🛒 Ритейл", "done": false, "time": null, "inspector": null, "temp": null, "multisig": null}
        ]')
      `);
    }

    const checkAntifrod = await client.query('SELECT COUNT(*) FROM antifrod_log');
    if (parseInt(checkAntifrod.rows[0].count) === 0) {
      console.log('Seeding antifrod logs...');
      await client.query(`
        INSERT INTO antifrod_log (id, ts, vessel, species, weight, reason, status, sent_to_moderator)
        VALUES 
        ('AF-0041', '2026-06-10T06:12:00Z', 'Мангистау-2', 'roach', 4.6, 'Превышен биологический максимум (>3 кг)', 'blocked', false),
        ('AF-0039', '2026-06-09T14:33:00Z', 'Маркум-5', 'roach', 3.8, 'Превышен биологический максимум (>3 кг)', 'blocked', true),
        ('AF-0035', '2026-06-08T09:11:00Z', 'Каспий-7', 'bream', 7.1, 'Превышен лимит вида (>6 кг) + Наклон 52°', 'blocked', true)
      `);
    }

    console.log('Database seeded successfully!');
  } catch (err) {
    console.error('Error during database initialization:', err);
  } finally {
    await client.end();
  }
}

init();
