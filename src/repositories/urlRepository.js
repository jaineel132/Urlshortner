import pool from '../db/connection.js';

async function saveURL(original_url, short_code, expires_at, userId) {
    try {
        const result = await pool.query('insert into urls (original_url, short_code, expires_at, user_id) values ($1, $2, $3, $4) returning *', [original_url, short_code, expires_at, userId]);
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

async function updateClickCount(shortcode){
    try{
        const result = await pool.query('update urls set click_count = click_count + 1 where short_code=$1 returning *',[shortcode])
        return result.rows[0]
    }
    catch(error){
        console.error('Error updating click count in the database:', error);
        throw error;
    }
}

async function deleteURL(shortcode, userId){
    try{
        const result = await pool.query('delete from urls where short_code=$1 and user_id=$2',[shortcode, userId])
        return result.rowCount
    }
    catch(error){
        console.error('Error deleting URL from the database:', error);
        throw error;
    }
}

async function getURLsByUserId(userId){
    try{
        const result = await pool.query('select * from urls where user_id=$1 order by id',[userId])
        return result.rows
    }
    catch(error){
        console.error('Error retrieving URLs from the database:', error);
        throw error;
    }
}

export { saveURL  , getURLByShortCode ,updateClickCount , deleteURL, getURLsByUserId};