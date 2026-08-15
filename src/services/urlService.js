import {generateShortCode} from '../utils/generateShortCode.js';
import {saveURL} from '../repositories/urlRepository.js';

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

export  {shortenURL} ;