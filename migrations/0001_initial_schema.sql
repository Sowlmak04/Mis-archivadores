CREATE TABLE locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE zones (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
    UNIQUE (id, location_id)
);

CREATE TABLE containers (
    number INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT GENERATED ALWAYS AS ('C' || printf('%03d', number)) STORED UNIQUE,
    uid TEXT NOT NULL UNIQUE,
    location_id TEXT NOT NULL,
    zone_id TEXT,
    name TEXT NOT NULL,
    type TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id, location_id) REFERENCES zones(id, location_id) ON DELETE CASCADE
);

CREATE TABLE items (
    id TEXT PRIMARY KEY,
    container_id TEXT NOT NULL,
    name TEXT NOT NULL,
    note TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE CASCADE
);

CREATE TABLE item_photos (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    position INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT,
    size_bytes INTEGER,
    width INTEGER,
    height INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);
