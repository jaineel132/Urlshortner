import {shortenURL,getOriginalURL,deleteShortURL,getURLsByUser} from "../services/urlService.js";

async function shortenURLController(req, res,next) {
    const { original_url, custom_alias, expires_at } = req.body;
    const userId = req.user.id;
    try{
     const result = await shortenURL(original_url, custom_alias, expires_at, userId);
            res.status(201).json({ short_url: process.env.BASE_URL+"/"+result.short_code ,expires_at: result.expires_at });
        }
    catch(error) {
            next(error);
        }

}

async function getOriginalURLController(req, res,next) {
    const { shortcode } = req.params;
    try{
        const result = await getOriginalURL(shortcode);
        res.redirect(result.original_url);
    }
    catch(error) {
        next(error);
    }
}


async function deleteShortURLController(req, res,next) {
    const {shortcode} = req.params
    const userId = req.user.id;
    try{
        await deleteShortURL(shortcode, userId);
        res.status(200).json({ message: 'Short URL deleted successfully' });
    }
    catch(error){
        next(error);
}
}

async function getURLsController(req, res, next) {
    const userId = req.user.id;
    try {
        const urls = await getURLsByUser(userId);
        res.status(200).json({ urls });
    } catch (error) {
        next(error);
    }
}


function healthCheck(req, res) {
    res.status(200).json({ Status: "OK" });
}

export { healthCheck , shortenURLController, getOriginalURLController, deleteShortURLController, getURLsController };