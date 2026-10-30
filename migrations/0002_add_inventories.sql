-- Ejecutar como una única migración transaccional.
-- Solo admite una estructura sin ubicaciones existentes.

PRAGMA defer_foreign_keys = ON;

CREATE TABLE inventories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE locations_new (
    id TEXT PRIMARY KEY,
    inventory_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (inventory_id)
        REFERENCES inventories(id)
        ON DELETE RESTRICT
);

-- Protección frente a datos existentes:
-- si locations contiene alguna fila, el NULL explícito viola NOT NULL
-- y la migración falla antes de eliminar la tabla original.
-- Si está vacía, esta sentencia no inserta ninguna fila.
INSERT INTO locations_new (
    id,
    inventory_id,
    name,
    created_at,
    updated_at
)
SELECT
    id,
    NULL,
    name,
    created_at,
    updated_at
FROM locations;

DROP TABLE locations;

ALTER TABLE locations_new RENAME TO locations;

CREATE INDEX idx_locations_inventory_id
    ON locations(inventory_id);

PRAGMA defer_foreign_keys = OFF;
