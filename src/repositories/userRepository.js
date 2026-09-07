import pool from '../db/connection.js';

async function createUser(email, passwordHash) {
    try {
        const result = await pool.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
            [email, passwordHash]
        );
        return result.rows[0];
    } catch (error) {
        console.error('Error creating user in the database:', error);
        throw error;
    }
}

async function findUserByEmail(email) {
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        return result.rows[0];
    } catch (error) {
        console.error('Error finding user by email in the database:', error);
        throw error;
    }
}

export { createUser, findUserByEmail };
