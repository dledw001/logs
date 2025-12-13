/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    pgm.createTable("sessions", {
        id: "id",
        user_id: { type: "integer", notNull: true, references: '"users"', onDelete: "CASCADE" },

        token_hash: { type: "text", notNull: true, unique: true },

        created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
        expires_at: { type: "timestamptz", notNull: true },

        revoked_at: { type: "timestamptz" },
        last_seen_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },

        user_agent: { type: "text" },
        ip: { type: "text" },
    });

    pgm.createIndex("sessions", ["user_id"]);
    pgm.createIndex("sessions", ["expires_at"]);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable("sessions");
};
