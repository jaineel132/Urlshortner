import pool from '../db/connection.js';

async function saveURL(original_url, short_code, expires_at) {
    try {
        const result = await pool.query('insert into urls (original_url, short_code, expires_at) values ($1, $2, $3) returning *', [original_url, short_code, expires_at]);
        return result.rows[0];
    } catch (error) {
        console.error('Error saving URL to the database:', error);
        throw error;
    }}

async function getURLByShortCode(shortcode){
    try{
        const result = await pool.query('select * from urls where short_code=$1',[shortcode])
        return result.rows[0]
    }
    catch(error){
        console.error('Error retrieving URL from the database:', error);
        throw error;
    }
}
export { saveURL  , getURLByShortCode };