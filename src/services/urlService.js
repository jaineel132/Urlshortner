import {generateShortCode} from '../utils/generateShortCode.js';
import {saveURL ,getURLByShortCode,updateClickCount,deleteURL,getURLsByUserId} from '../repositories/urlRepository.js';
import {getCachedURL, setCachedURL, invalidateCachedURL} from '../cache/urlCache.js';

function isExpired(expiresAt) {
    return expiresAt !== null && expiresAt !== undefined && new Date(expiresAt) < new Date();
}


async function shortenURL(original_url, custom_alias, expires_at, userId) {
    const maxRetries = 3;

    // Custom alias: one attempt only
    if (custom_alias) {
        try {
            const savedUrl = await saveURL(
                original_url,
                custom_alias,
                expires_at,
                userId
            );

            return {
                short_code: savedUrl.short_code,
                expires_at: savedUrl.expires_at
            };
        } catch (error) {
            if (
                error.code === "23505" &&
                error.constraint === "urls_short_code_key"
            ) {
                const appError = new Error(
                    "Custom alias already exists. Please choose a different alias."
                );

                appError.statusCode = 409;
                throw appError;
            }

            throw error;
        }
    }

    // No custom alias: generate and retry if collision occurs
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const shortcode = generateShortCode();

        try {
            const savedUrl = await saveURL(
                original_url,
                shortcode,
                expires_at,
                userId
            );

            return {
                short_code: savedUrl.short_code,
                expires_at: savedUrl.expires_at
            };
        } catch (error) {
            if (
                error.code === "23505" &&
                error.constraint === "urls_short_code_key"
            ) {
                continue;
            }

            throw error;
        }
    }

    const appError = new Error(
        "Could not generate a unique short code. Please try again."
    );

    appError.statusCode = 500;
    throw appError;
}

async function getOriginalURL(shortcode){
    try{
        const cached = await getCachedURL(shortcode);

        if (cached) {
            if (isExpired(cached.expires_at)) {
                await invalidateCachedURL(shortcode);
                const expiredError = new Error('Shortcode has expired');
                expiredError.statusCode = 410;
                throw expiredError;
            }

            await updateClickCount(shortcode);
            return cached;
        }

        const result = await getURLByShortCode(shortcode);

        if (result === undefined || result === null) {
            const notFoundError = new Error('Shortcode not found');
            notFoundError.statusCode = 404;
            throw notFoundError;
        }
        else if (isExpired(result.expires_at)){
            const expiredError = new Error('Shortcode has expired');
            expiredError.statusCode = 410;
            throw expiredError;
        }
        else {
           await setCachedURL(shortcode, { original_url: result.original_url, expires_at: result.expires_at });
           const updatedRow = await updateClickCount(shortcode);
           return updatedRow;  
        }
    }
    catch(error){
        console.error('Error retrieving URL from the database:', error);
        throw error;
    }   
}

async function deleteShortURL(shortcode, userId){
    try{
        const result = await deleteURL(shortcode, userId);
        if(result === 1){
            await invalidateCachedURL(shortcode);
            return {message: 'Shortcode deleted successfully'};
        }
        else{
            const notFoundError = new Error('Shortcode not found');
            notFoundError.statusCode = 404;
            throw notFoundError;
        }
    }
    catch(error){
        console.error('Error deleting URL from the database:', error);
        throw error;
    }
}

async function getURLsByUser(userId){
    return getURLsByUserId(userId);
}


export  {shortenURL , getOriginalURL,deleteShortURL, getURLsByUser}