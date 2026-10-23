import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import log from 'electron-log';
import { v4 as uuidv4 } from 'uuid';
import type { AppSettings, PricingRule, ActivityLogEntry } from '../../shared/types';
import type { Database as SqlJsDatabase } from 'sql.js';

let _db: SqlJsDatabase | null = null;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'bybit-p2p-bot.db');
}

function scheduleSave(): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try { if (_db) { fs.writeFileSync(getDbPath(), Buffer.from(_db.export())); } }
    catch(e) { log.error('DB save error:', e); }
  }, 500);
}

export async function startDatabase(): Promise<void> {
  const initSqlJs = (await import('sql.js')).default;
  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  const SQL = await initSqlJs();
  let dbData: Buffer | null = null;
  if (fs.existsSync(dbPath)) {
    try { dbData = fs.readFileSync(dbPath); log.info('Loaded existing DB:', dbPath); } catch(e) { log.warn('Could not read DB file, creating new:', e); }
  }
  _db = dbData ? new SQL.Database(dbData) : new SQL.Database();
  const schema = [
    'CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1),theme TEXT DEFAULT"dark",launch_at_login INTEGER DEFAULT 0,polling_interval_ms INTEGER DEFAULT 60000,show_notifications INTEGER DEFAULT 1,sound_alerts INTEGER DEFAULT 0,language TEXT DEFAULT"en");',
    'INSERT OR IGNORE INTO settings(id) VALUES(1);',
    'CREATE TABLE IF NOT EXISTS credentials (id INTEGER PRIMARY KEY CHECK(id=1),api_key TEXT,api_secret TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);',
    'CREATE TABLE IF NOT EXISTS ads (id TEXT PRIMARY KEY,account_id TEXT,direction TEXT,asset TEXT,fiat_currency TEXT,price TEXT,available_quantity TEXT,min_order_amount TEXT,max_order_amount TEXT,status TEXT,last_update_time TEXT,payment_methods TEXT,created_time TEXT,is_selected INTEGER DEFAULT 0,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);',
    'CREATE TABLE IF NOT EXISTS pricing_rules (id TEXT PRIMARY KEY,name TEXT,direction TEXT,asset TEXT,fiat_currency TEXT,strategy TEXT,fixed_price REAL,offset_amount REAL DEFAULT 0,offset_type TEXT DEFAULT"percentage",min_price REAL,max_price REAL,max_change_percent REAL DEFAULT 5,min_interval_ms INTEGER DEFAULT 60000,max_updates_per_hour INTEGER DEFAULT 10,max_updates_per_day INTEGER DEFAULT 100,price_precision INTEGER DEFAULT 2,max_deviation_percent REAL DEFAULT 10,manual_approval INTEGER DEFAULT 1,dry_run INTEGER DEFAULT 1,enabled INTEGER DEFAULT 0,payment_method_ids TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,target_position INTEGER,price_offset REAL);',
    'CREATE TABLE IF NOT EXISTS activity_logs (id TEXT PRIMARY KEY,timestamp TEXT DEFAULT CURRENT_TIMESTAMP,level TEXT,category TEXT,message TEXT,details TEXT,ad_id TEXT,previous_value TEXT,new_value TEXT);',
    'CREATE TABLE IF NOT EXISTS bot_state (id INTEGER PRIMARY KEY CHECK(id=1),status TEXT DEFAULT"stopped",message TEXT,last_update TEXT,last_successful_update TEXT,current_ip TEXT,last_working_ip TEXT,error_count INTEGER DEFAULT 0,update_count INTEGER DEFAULT 0,ip_whitelist_enabled INTEGER DEFAULT 0,ip_whitelist TEXT);',
    'INSERT OR IGNORE INTO bot_state(id) VALUES(1);',
    'CREATE TABLE IF NOT EXISTS rankings (id TEXT PRIMARY KEY,market_key TEXT,competitors TEXT,last_refresh TEXT,data_stale INTEGER DEFAULT 1,refresh_error TEXT);',
  ];
  for (const sql of schema) _db.run(sql);
  scheduleSave();
  log.info('Database initialized: ' + dbPath);
}

export function db(): SqlJsDatabase { if (!_db) throw new Error('DB not init'); return _db; }
export function saveDb(): void { try { if (_db) fs.writeFileSync(getDbPath(), Buffer.from(_db.export())); } catch(e) { log.error('DB save error:', e); } }

function run(sql: string, params: any[] = []): void { db().run(sql, params); scheduleSave(); }
function getOne(sql: string, params: any[] = []): any { const stmt = db().prepare(sql); stmt.bind(params); const row = stmt.step() ? stmt.getAsObject() : null; stmt.free(); return row; }
function getAll(sql: string, params: any[] = []): any[] { const results: any[] = []; const stmt = db().prepare(sql); stmt.bind(params); while (stmt.step()) results.push(stmt.getAsObject()); stmt.free(); return results; }

export function getAppSettings(): AppSettings {
  const r = getOne('SELECT * FROM settings WHERE id=1');
  return { theme: (r?.theme || 'dark') as 'dark'|'light', launchAtLogin: Boolean(r?.launch_at_login), pollingIntervalMs: r?.polling_interval_ms || 60000, showNotifications: Boolean(r?.show_notifications), soundAlerts: Boolean(r?.sound_alerts), language: r?.language || 'en' };
}

export function saveAppSettings(s: AppSettings): void {
  run('UPDATE settings SET theme=?,launch_at_login=?,polling_interval_ms=?,show_notifications=?,sound_alerts=?,language=? WHERE id=1', [s.theme, s.launchAtLogin?1:0, s.pollingIntervalMs, s.showNotifications?1:0, s.soundAlerts?1:0, s.language]);
}

export function getCredentials(): { apiKey: string; apiSecret: string } | null {
  const r = getOne('SELECT api_key,api_secret FROM credentials WHERE id=1');
  if (!r?.api_key || !r?.api_secret) return null;
  return { apiKey: r.api_key, apiSecret: r.api_secret };
}

export function saveCredentials(apiKey: string, apiSecret: string): void { run('INSERT OR REPLACE INTO credentials(id,api_key,api_secret,updated_at)VALUES(1,?,?,datetime("now"))', [apiKey, apiSecret]); scheduleSave(); }
export function deleteCredentials(): void { run('DELETE FROM credentials WHERE id=1', []); }

export function getAds(): any[] { return getAll('SELECT * FROM ads ORDER BY created_time DESC'); }

export function saveAds(ads: any[]): void {
  for (const ad of ads) {
    run('INSERT OR REPLACE INTO ads(id,account_id,direction,asset,fiat_currency,price,available_quantity,min_order_amount,max_order_amount,status,last_update_time,payment_methods,created_time,is_selected,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime("now"))',
      [ad.id, ad.accountId||ad.account_id, ad.direction||ad.side, ad.asset||ad.assets, ad.fiatCurrency||ad.fiat_ccy, ad.price, ad.availableQuantity||ad.amount, ad.minOrderAmount||ad.min_amount, ad.maxOrderAmount||ad.max_amount, ad.status, ad.lastUpdateTime||ad.update_time, JSON.stringify(ad.paymentMethods||[]), ad.createdTime||ad.create_time, ad.isSelected?1:0]);
  }
}

export function updateAdSelected(adId: string, selected: boolean): void { run('UPDATE ads SET is_selected=? WHERE id=?', [selected?1:0, adId]); }

export function getRules(): PricingRule[] {
  return getAll('SELECT * FROM pricing_rules ORDER BY created_at DESC').map((r: any) => ({
    id: r.id, name: r.name, direction: r.direction, asset: r.asset, fiatCurrency: r.fiat_currency,
    strategy: r.strategy as PricingRule['strategy'], fixedPrice: r.fixed_price, offsetAmount: r.offset_amount,
    offsetType: r.offset_type, minPrice: r.min_price, maxPrice: r.max_price, maxChangePercent: r.max_change_percent,
    minIntervalMs: r.min_interval_ms, maxUpdatesPerHour: r.max_updates_per_hour, maxUpdatesPerDay: r.max_updates_per_day,
    pricePrecision: r.price_precision, maxDeviationPercent: r.max_deviation_percent,
    manualApproval: Boolean(r.manual_approval), dryRun: Boolean(r.dry_run), enabled: Boolean(r.enabled),
    paymentMethodIds: r.payment_method_ids ? JSON.parse(r.payment_method_ids) : [],
    targetPosition: r.target_position, priceOffset: r.price_offset,
  }));
}

export function saveRule(rule: PricingRule): void {
  run('INSERT OR REPLACE INTO pricing_rules(id,name,direction,asset,fiat_currency,strategy,fixed_price,offset_amount,offset_type,min_price,max_price,max_change_percent,min_interval_ms,max_updates_per_hour,max_updates_per_day,price_precision,max_deviation_percent,manual_approval,dry_run,enabled,payment_method_ids,target_position,price_offset,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime("now"))',
    [rule.id, rule.name, rule.direction, rule.asset, rule.fiatCurrency, rule.strategy, rule.fixedPrice??null, rule.offsetAmount, rule.offsetType, rule.minPrice??null, rule.maxPrice??null, rule.maxChangePercent, rule.minIntervalMs, rule.maxUpdatesPerHour, rule.maxUpdatesPerDay, rule.pricePrecision, rule.maxDeviationPercent, rule.manualApproval?1:0, rule.dryRun?1:0, rule.enabled?1:0, rule.paymentMethodIds?JSON.stringify(rule.paymentMethodIds):null, rule.targetPosition??null, rule.priceOffset??null]);
}

export function deleteRule(ruleId: string): void { run('DELETE FROM pricing_rules WHERE id=?', [ruleId]); }

export async function addLog(entry: any): Promise<string> {
  const id = uuidv4();
  run('INSERT INTO activity_logs(id,timestamp,level,category,message,details,ad_id,previous_value,new_value)VALUES(?,datetime("now"),?,?,?,?,?,?,?)',
    [id, entry.level, entry.category, entry.message, entry.details??null, entry.adId??null, entry.previousValue??null, entry.newValue??null]);
  run('DELETE FROM activity_logs WHERE id NOT IN(SELECT id FROM activity_logs ORDER BY timestamp DESC LIMIT 10000)', []);
  return id;
}

export function getLogs(f?: { level?: string; category?: string; search?: string; limit?: number }): ActivityLogEntry[] {
  let sql = 'SELECT * FROM activity_logs WHERE 1=1'; const params: any[] = [];
  if (f?.level && f.level !== 'all') { sql += ' AND level=?'; params.push(f.level); }
  if (f?.category && f.category !== 'all') { sql += ' AND category=?'; params.push(f.category); }
  if (f?.search) { sql += ' AND (message LIKE ? OR details LIKE ?)'; params.push('%'+f.search+'%', '%'+f.search+'%'); }
  sql += ' ORDER BY timestamp DESC';
  if (f?.limit) { sql += ' LIMIT ?'; params.push(f.limit); }
  return getAll(sql, params) as ActivityLogEntry[];
}

export function clearLogs(): void { run('DELETE FROM activity_logs', []); }

export function getRankings(): any[] {
  return getAll('SELECT * FROM rankings ORDER BY last_refresh DESC').map((r: any) => ({
    ...r, competitors: r.competitors ? JSON.parse(r.competitors) : [], dataStale: Boolean(r.data_stale),
  }));
}

export function saveRanking(ranking: any): void {
  run('INSERT OR REPLACE INTO rankings(id,market_key,competitors,last_refresh,data_stale,refresh_error)VALUES(?,?,?,?,?,?)',
    [ranking.marketKey, ranking.marketKey, JSON.stringify(ranking.competitors), ranking.lastRefresh, ranking.dataStale?1:0, ranking.refreshError??null]);
}

export function getBotState(): any { return getOne('SELECT * FROM bot_state WHERE id=1'); }

export function updateBotState(state: Record<string, any>): void {
  run('UPDATE bot_state SET ' + Object.keys(state).map(k => k+'=?').join(',') + ' WHERE id=1', [...Object.values(state)]);
}
