import pool from '../db/connection.js';

async function saveURL(original_url, short_code, expires_at) {
    try {
        const result = await pool.query('insert into urls (original_url, short_code, expires_at) values ($1, $2, $3) returning *', [original_url, short_code, expires_at]);
        return result.rows[0];
    } catch (error) {
        console.error('Error saving URL to the database:', error);
        console.log( error);
        throw error;
    }}
export { saveURL };