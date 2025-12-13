/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
    pgm.createTable("roles", {
        id: "id",
        name: { type: "text", notNull: true, unique: true },
        created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    });

    pgm.createTable("user_roles", {
        id: "id",
        user_id: { type: "integer", notNull: true, references: '"users"', onDelete: "CASCADE" },
        role_id: { type: "integer", notNull: true, references: '"roles"', onDelete: "CASCADE" },
        created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    });

    pgm.createIndex("user_roles", ["user_id"]);
    pgm.createIndex("user_roles", ["role_id"]);
    pgm.addConstraint("user_roles", "user_roles_user_role_unique", {
        unique: ["user_id", "role_id"],
    });

    pgm.sql(`
        INSERT INTO roles (name) VALUES ('admin'), ('user')
        ON CONFLICT DO NOTHING;
    `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
    pgm.dropTable("user_roles");
    pgm.dropTable("roles");
};
