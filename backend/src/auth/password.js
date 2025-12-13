import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import bcrypt from 'bcrypt';

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
const PEPPER = process.env.PASSWORD_PEPPER || '';

export async function hashPassword(plainPassword) {
    if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
        throw new Error('Password must be a non-empty string');
    }

    const pepperedPassword = plainPassword + PEPPER;
    return await bcrypt.hash(pepperedPassword, SALT_ROUNDS );
}

export async function verifyPassword(plainPassword, hashedPassword) {
    if (!hashedPassword) return false;
    if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
        return false;
    }

    const pepperedPassword = plainPassword + PEPPER;
    return await bcrypt.compare(pepperedPassword, hashedPassword);
}
