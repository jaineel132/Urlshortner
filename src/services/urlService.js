import {generateShortCode} from '../utils/generateShortCode.js';
import {saveURL ,getURLByShortCode,updateClickCount,deleteURL} from '../repositories/urlRepository.js';


async function shortenURL(original_url, custom_alias, expires_at) {
    const maxRetries = 3;

    // Custom alias: one attempt only
    if (custom_alias) {
        try {
            const savedUrl = await saveURL(
                original_url,
                custom_alias,
                expires_at
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
                expires_at
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

async function getOgURL(shortcode){
    try{
        const result = await getURLByShortCode(shortcode);

        if (result === undefined || result === null) {
            const notFoundError = new Error('Shortcode not found');
            notFoundError.statusCode = 404;
            throw notFoundError;
        }
        else if (result.expires_at < new Date() && result.expires_at !== null){
            const expiredError = new Error('Shortcode has expired');
            expiredError.statusCode = 410;
            throw expiredError;
        }
        else {
           const updatedRow = await updateClickCount(shortcode);
           return updatedRow;  
        }
    }
    catch(error){
        console.error('Error retrieving URL from the database:', error);
        throw error;
    }   
}

async function deleteShortURL(shortcode){
    try{
        const result = await deleteURL(shortcode);
        if(result === 1){
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



export  {shortenURL , getOgURL,deleteShortURL}