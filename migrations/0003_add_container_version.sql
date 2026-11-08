ALTER TABLE containers
ADD COLUMN version INTEGER NOT NULL DEFAULT 1
CHECK (
    typeof(version) = 'integer'
    AND version >= 1
    AND version <= 9007199254740991
);
