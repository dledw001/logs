/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
    pgm.createTable("audit_log", {
        id: "id",
        ts: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
        event: { type: "text", notNull: true },
        user_id: { type: "integer" },
        username: { type: "text" },
        email: { type: "text" },
        ip: { type: "text" },
        meta: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
    }, { ifNotExists: true });

    pgm.createIndex("audit_log", "ts", { ifNotExists: true });
    pgm.createIndex("audit_log", "event", { ifNotExists: true });
    pgm.createIndex("audit_log", "user_id", { ifNotExists: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
    pgm.dropIndex("audit_log", "ts", { ifExists: true });
    pgm.dropIndex("audit_log", "event", { ifExists: true });
    pgm.dropIndex("audit_log", "user_id", { ifExists: true });
    pgm.dropTable("audit_log", { ifExists: true });
};
