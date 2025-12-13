// Lightweight in-memory Postgres-ish implementation for tests and sandboxes
// where a real database connection is not available. It only supports the
// limited set of queries used by the app and test suite.

const state = {
    users: [],
    sessions: [],
    passwordResetTokens: [],
    roles: [],
    userRoles: [],
    seq: {
        users: 1,
        sessions: 1,
        resetTokens: 1,
        userRoles: 1,
    },
};

const now = () => new Date();

function seedRoles() {
    state.roles = [
        { id: 1, name: "admin", created_at: now() },
        { id: 2, name: "user", created_at: now() },
    ];
}

seedRoles();

export function resetMemory() {
    state.users = [];
    state.sessions = [];
    state.passwordResetTokens = [];
    state.userRoles = [];
    state.seq = {
        users: 1,
        sessions: 1,
        resetTokens: 1,
        userRoles: 1,
    };
    seedRoles();
}

function cloneRow(row) {
    const copy = {};
    for (const [k, v] of Object.entries(row)) {
        copy[k] = v instanceof Date ? new Date(v) : v;
    }
    return copy;
}

function uniqueViolation(constraint) {
    const err = new Error("duplicate key value violates unique constraint");
    err.code = "23505";
    err.constraint = constraint;
    return err;
}

export function createMemoryDb() {
    async function query(text, params = []) {
        const sql = text.trim().replace(/\s+/g, " ").toLowerCase();

        // test helpers cleanup
        if (sql.startsWith("delete from sessions where user_id in (select id from users where username = $1)")) {
            const username = params[0];
            const userIds = state.users.filter(u => u.username === username).map(u => u.id);
            const before = state.sessions.length;
            state.sessions = state.sessions.filter(s => !userIds.includes(s.user_id));
            return { rowCount: before - state.sessions.length, rows: [] };
        }

        if (sql.startsWith("delete from user_roles where user_id in (select id from users where username = $1)")) {
            const username = params[0];
            const userIds = state.users.filter(u => u.username === username).map(u => u.id);
            const before = state.userRoles.length;
            state.userRoles = state.userRoles.filter(ur => !userIds.includes(ur.user_id));
            return { rowCount: before - state.userRoles.length, rows: [] };
        }

        if (sql.startsWith("delete from users where username = $1")) {
            const username = params[0];
            const before = state.users.length;
            const removedUsers = state.users.filter(u => u.username === username).map(u => u.id);
            state.users = state.users.filter(u => u.username !== username);
            // cascade deletes
            state.sessions = state.sessions.filter(s => !removedUsers.includes(s.user_id));
            state.passwordResetTokens = state.passwordResetTokens.filter(t => !removedUsers.includes(t.user_id));
            return { rowCount: before - state.users.length, rows: [] };
        }

        // auth/register
        if (sql.startsWith("insert into users")) {
            const [username, username_display, email, password_hash] = params;

            if (state.users.some(u => u.username === username)) {
                if (process.env.DEBUG_MEMORY_DB === "true") {
                    console.log("memory users duplicate username", username);
                }
                throw uniqueViolation("users_username_key");
            }
            if (state.users.some(u => u.email === email)) {
                if (process.env.DEBUG_MEMORY_DB === "true") {
                    console.log("memory users duplicate email", email);
                }
                throw uniqueViolation("users_email_key");
            }

            const user = {
                id: state.seq.users++,
                username,
                username_display,
                email,
                password_hash,
                is_admin: false,
                created_at: now(),
                updated_at: now(),
                email_verified_at: null,
            };

            state.users.push(user);
            // assign default user role
            const userRole = {
                id: state.seq.userRoles++,
                user_id: user.id,
                role_id: 2,
                created_at: now(),
            };
            state.userRoles.push(userRole);
            return { rowCount: 1, rows: [cloneRow(user)] };
        }

        // auth/login lookup
        if (sql.startsWith("select u.id") && sql.includes("from users u left join user_roles")) {
            const [identifier] = params;
            const user = state.users.find(u => u.username === identifier || u.email === identifier);
            if (!user) return { rowCount: 0, rows: [] };
            const roles = state.userRoles
                .filter(ur => ur.user_id === user.id)
                .map(ur => state.roles.find(r => r.id === ur.role_id)?.name)
                .filter(Boolean);
            return { rowCount: 1, rows: [cloneRow({ ...user, roles })] };
        }

        if (sql.startsWith("select username, password_hash from users where username = $1")) {
            const [username] = params;
            const user = state.users.find(u => u.username === username);
            if (!user) return { rowCount: 0, rows: [] };
            return { rowCount: 1, rows: [cloneRow(user)] };
        }

        if (sql.startsWith("select username, username_display, email, password_hash from users where username = $1")) {
            const [username] = params;
            const user = state.users.find(u => u.username === username);
            return { rowCount: user ? 1 : 0, rows: user ? [cloneRow(user)] : [] };
        }

        if (sql.startsWith("insert into user_roles")) {
            const [user_id, role_idParam] = params;
            let role_id = role_idParam;
            if (!role_id) {
                if (sql.includes("name = 'admin'")) {
                    role_id = state.roles.find(r => r.name === "admin")?.id;
                } else if (sql.includes("name = 'user'")) {
                    role_id = state.roles.find(r => r.name === "user")?.id;
                }
            }
            if (state.userRoles.some(ur => ur.user_id === user_id && ur.role_id === role_id)) {
                if (sql.includes("on conflict do nothing")) {
                    return { rowCount: 0, rows: [] };
                }
                throw uniqueViolation("user_roles_user_role_unique");
            }
            const row = {
                id: state.seq.userRoles++,
                user_id,
                role_id,
                created_at: now(),
            };
            state.userRoles.push(row);
            return { rowCount: 1, rows: [cloneRow(row)] };
        }

        if (sql.startsWith("select id, name from roles where name = $1")) {
            const [name] = params;
            const role = state.roles.find(r => r.name === name);
            return { rowCount: role ? 1 : 0, rows: role ? [cloneRow(role)] : [] };
        }

        // password reset token lookup
        if (sql.startsWith("select id, username, username_display, email, is_admin, created_at, password_hash from users where id = $1")) {
            const [userId] = params;
            const user = state.users.find(u => u.id === userId);
            return { rowCount: user ? 1 : 0, rows: user ? [cloneRow(user)] : [] };
        }

        // sessions insert
        if (sql.startsWith("insert into sessions")) {
            const [user_id, token_hash, expires_at] = params;

            if (state.sessions.some(s => s.token_hash === token_hash)) {
                throw uniqueViolation("sessions_token_hash_key");
            }

            const session = {
                id: state.seq.sessions++,
                user_id,
                token_hash,
                created_at: now(),
                expires_at: new Date(expires_at),
                revoked_at: null,
                last_seen_at: now(),
            };

            state.sessions.push(session);
            return { rowCount: 1, rows: [] };
        }

        // logout (by token)
        if (sql.startsWith("update sessions set revoked_at = now() where token_hash = $1 and revoked_at is null")) {
            const [token_hash] = params;
            let count = 0;
            for (const session of state.sessions) {
                if (session.token_hash === token_hash && session.revoked_at === null) {
                    session.revoked_at = now();
                    count++;
                }
            }
            return { rowCount: count, rows: [] };
        }

        // revoke all sessions for a user (password reset)
        if (sql.startsWith("update sessions set revoked_at = now() where user_id = $1 and revoked_at is null")) {
            const [user_id] = params;
            let count = 0;
            for (const session of state.sessions) {
                if (session.user_id === user_id && session.revoked_at === null) {
                    session.revoked_at = now();
                    count++;
                }
            }
            return { rowCount: count, rows: [] };
        }

        // requireAuth lookup
        if (sql.startsWith("select s.user_id, s.expires_at, s.last_seen_at, u.id, u.username, u.username_display, u.email, u.is_admin, u.created_at, coalesce(array_agg(")) {
            const [token_hash] = params;
            const session = state.sessions.find(
                s => s.token_hash === token_hash && s.revoked_at === null && s.expires_at > now()
            );
            if (!session) return { rowCount: 0, rows: [] };

            const user = state.users.find(u => u.id === session.user_id);
            if (!user) return { rowCount: 0, rows: [] };

            const roles = state.userRoles
                .filter(ur => ur.user_id === user.id)
                .map(ur => state.roles.find(r => r.id === ur.role_id)?.name)
                .filter(Boolean);
            const row = {
                user_id: session.user_id,
                id: user.id,
                username: user.username,
                username_display: user.username_display,
                email: user.email,
                is_admin: user.is_admin,
                created_at: user.created_at,
                expires_at: session.expires_at,
                last_seen_at: session.last_seen_at,
                roles,
            };
            return { rowCount: 1, rows: [cloneRow(row)] };
        }

        // bump session last_seen_at
        if (sql.startsWith("update sessions set last_seen_at = now() where token_hash = $1")) {
            const [token_hash] = params;
            let count = 0;
            for (const session of state.sessions) {
                if (session.token_hash === token_hash) {
                    session.last_seen_at = now();
                    count++;
                }
            }
            return { rowCount: count, rows: [] };
        }

        if (sql.startsWith("update sessions set last_seen_at = $1 where token_hash = $2")) {
            const [ts, token_hash] = params;
            let count = 0;
            for (const session of state.sessions) {
                if (session.token_hash === token_hash) {
                    session.last_seen_at = new Date(ts);
                    count++;
                }
            }
            return { rowCount: count, rows: [] };
        }

        // password reset: insert token
        if (sql.startsWith("insert into password_reset_tokens")) {
            const [user_id, token_hash, expires_at] = params;

            if (state.passwordResetTokens.some(t => t.token_hash === token_hash)) {
                throw uniqueViolation("password_reset_tokens_token_hash_key");
            }

            const token = {
                id: state.seq.resetTokens++,
                user_id,
                token_hash,
                created_at: now(),
                expires_at: new Date(expires_at),
                used_at: null,
            };
            state.passwordResetTokens.push(token);
            return { rowCount: 1, rows: [] };
        }

        // password reset lookup (by token hash)
        if (sql.startsWith("select prt.id, prt.user_id, prt.token_hash, prt.expires_at, prt.used_at from password_reset_tokens prt where prt.token_hash = $1")) {
            const [token_hash] = params;
            const token = state.passwordResetTokens.find(t => t.token_hash === token_hash);
            return { rowCount: token ? 1 : 0, rows: token ? [cloneRow(token)] : [] };
        }

        // mark token used
        if (sql.startsWith("update password_reset_tokens set used_at = now() where id = $1")) {
            const [id] = params;
            let count = 0;
            for (const token of state.passwordResetTokens) {
                if (token.id === id) {
                    token.used_at = now();
                    count++;
                }
            }
            return { rowCount: count, rows: [] };
        }

        // update user password
        if (sql.startsWith("update users set password_hash = $1 where id = $2")) {
            const [password_hash, id] = params;
            let count = 0;
            for (const user of state.users) {
                if (user.id === id) {
                    user.password_hash = password_hash;
                    user.updated_at = now();
                    count++;
                }
            }
            return { rowCount: count, rows: [] };
        }

        throw new Error(`Unsupported in-memory query:\n${text}`);
    }

    const pool = {
        query,
        async end() {
            // nothing to clean up for in-memory
        },
    };

    return { pool, query, resetMemory };
}
