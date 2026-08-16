import {generateShortCode} from '../utils/generateShortCode.js';
import {saveURL ,getURLByShortCode,updateClickCount} from '../repositories/urlRepository.js';


async function shortenURL(original_url, custom_alias, expires_at) {
    try{ if (!custom_alias) {
        const shortcode = generateShortCode();
        const savedurl = await saveURL(original_url, shortcode, expires_at);
        return {short_code: savedurl.short_code, expires_at: savedurl.expires_at};
    }
    else{
        const savedurl = await saveURL(original_url, custom_alias, expires_at);
        return {short_code: savedurl.short_code, expires_at: savedurl.expires_at};
    }}
   catch (error) {
    if (
        error.code === '23505' &&
        error.constraint === 'urls_short_code_key' &&
        custom_alias
    ) {
        const appError = new Error(
            'Custom alias already exists. Please choose a different alias.'
        );

        appError.statusCode = 409;

        throw appError;
    }

    throw error;
}
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

export  {shortenURL , getOgURL}