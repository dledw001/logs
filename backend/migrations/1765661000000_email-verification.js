/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
    pgm.createTable("email_verification_tokens", {
        id: "id",
        user_id: { type: "integer", notNull: true, references: '"users"', onDelete: "CASCADE" },
        token_hash: { type: "text", notNull: true, unique: true },
        created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
        expires_at: { type: "timestamptz", notNull: true },
        used_at: { type: "timestamptz" },
    });

    pgm.createIndex("email_verification_tokens", ["user_id"]);
    pgm.createIndex("email_verification_tokens", ["expires_at"]);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
    pgm.dropTable("email_verification_tokens");
};
