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
    pgm.createExtension("citext", { ifNotExists: true });

    pgm.createTable("users", {
        id: "id",

        // canonical username (store normalized in app too, but DB enforces it)
        username: { type: "citext", notNull: true, unique: true },

        username_display: { type: "text", notNull: true },

        email: { type: "citext", notNull: true, unique: true },
        email_verified_at: { type: "timestamptz" },

        password_hash: { type: "text", notNull: true },

        is_admin: { type: "boolean", notNull: true, default: false },

        created_at: {
            type: "timestamptz",
            notNull: true,
            default: pgm.func("now()"),
        },
        updated_at: {
            type: "timestamptz",
            notNull: true,
            default: pgm.func("now()"),
        },
    });

    pgm.createFunction(
        "set_updated_at",
        [],
        { returns: "trigger", language: "plpgsql" },
        `
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    `
    );

    pgm.createTrigger("users", "users_set_updated_at", {
        when: "BEFORE",
        operation: "UPDATE",
        level: "ROW",
        function: "set_updated_at",
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTrigger("users", "users_set_updated_at", { ifExists: true });
    pgm.dropFunction("set_updated_at", [], { ifExists: true });
    pgm.dropTable("users");
    pgm.dropExtension("citext", { ifExists: true });
};
