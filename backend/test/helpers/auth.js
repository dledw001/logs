import { createClient } from "./client.js";
import { query } from "../../src/db/db.js";

export async function registerUser(client, { username, email, password }, { cleanup = true } = {}) {
    if (cleanup) {
        const cleanUsername = typeof username === "string" ? username.trim().toLowerCase() : "";
        if (cleanUsername) {
            await query(
                `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username = $1)`,
                [cleanUsername]
            );
            await query(
                `DELETE FROM email_verification_tokens WHERE user_id IN (SELECT id FROM users WHERE username = $1)`,
                [cleanUsername]
            );
            await query(
                `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username = $1)`,
                [cleanUsername]
            );
            await query(`DELETE FROM users WHERE username = $1`, [cleanUsername]);
        }
    }

    return client.register({ username, email, password });
}

export function loginUser(client, { username, password }) {
    return client.login({ identifier: username, password });
}

export function agent() {
    return createClient();
}
