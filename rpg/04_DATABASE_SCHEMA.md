# Database Schema — SQLite

## `rpg_users`

```sql
CREATE TABLE rpg_users (
  telegram_user_id   TEXT PRIMARY KEY,
  class_name         TEXT NOT NULL CHECK (class_name IN ('ksatria','penyihir','pencuri')),
  level              INTEGER NOT NULL DEFAULT 1,
  xp                 INTEGER NOT NULL DEFAULT 0,
  gold               INTEGER NOT NULL DEFAULT 0,
  hp                 INTEGER NOT NULL,
  max_hp             INTEGER NOT NULL,
  atk                INTEGER NOT NULL,
  def                INTEGER NOT NULL,
  energy_current     INTEGER NOT NULL DEFAULT 10,
  energy_last_update INTEGER NOT NULL,     -- unix timestamp
  dungeon_tickets    INTEGER NOT NULL DEFAULT 3,
  dungeon_tickets_reset_at INTEGER NOT NULL,
  last_daily_claim_at INTEGER,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
```

## `rpg_inventory`

```sql
CREATE TABLE rpg_inventory (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
  item_id       TEXT NOT NULL,      -- ref ke items_catalog.item_id
  quantity      INTEGER NOT NULL DEFAULT 1,
  upgrade_tier  INTEGER DEFAULT 0,  -- khusus equipment
  UNIQUE(telegram_user_id, item_id)
);
```

## `items_catalog` (data statis, di-seed sekali)

```sql
CREATE TABLE items_catalog (
  item_id       TEXT PRIMARY KEY,   -- 'ramuan_kecil', 'pedang_karatan', dst
  display_name  TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('consumable','material','weapon','armor')),
  rarity        TEXT NOT NULL CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  sell_price    INTEGER DEFAULT 0,  -- 0 = tidak bisa dijual
  effect_json   TEXT                -- JSON: {"heal_pct": 15} atau {"atk_bonus": 2}
);
```

## `transactions_log` (audit gold, penting buat debug ekonomi & anti-cheat)

```sql
CREATE TABLE transactions_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user_id      TEXT,           -- NULL kalau dari sistem (loot/shop sell)
  to_user_id        TEXT,           -- NULL kalau ke sistem (shop buy)
  amount            INTEGER NOT NULL,
  reason            TEXT NOT NULL,  -- 'hunt_reward', 'give_transfer', 'shop_purchase', dst
  created_at        INTEGER NOT NULL
);
```

## `dungeon_runs` (histori raid, buat cooldown & statistik)

```sql
CREATE TABLE dungeon_runs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  player_a_id       TEXT NOT NULL,
  player_b_id       TEXT NOT NULL,
  boss_id           TEXT NOT NULL,
  result            TEXT NOT NULL CHECK (result IN ('win','lose')),
  loot_json         TEXT,           -- item_id yang didrop
  started_at        INTEGER NOT NULL,
  ended_at          INTEGER
);
```

## Index yang Perlu

```sql
CREATE INDEX idx_inventory_user ON rpg_inventory(telegram_user_id);
CREATE INDEX idx_transactions_user ON transactions_log(from_user_id, to_user_id);
CREATE INDEX idx_dungeon_players ON dungeon_runs(player_a_id, player_b_id);
```

## Catatan Migrasi

Kalau P0.1 (migrasi utama bot ke SQLite) udah jalan duluan, tabel-tabel
di atas tinggal ditambahkan ke file schema yang sama — tidak perlu
database terpisah.
