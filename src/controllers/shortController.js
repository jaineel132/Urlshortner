import {shortenURL,getOgURL,deleteShortURL} from "../services/urlService.js";

async function shortenURLController(req, res,next) {
    const { original_url, custom_alias, expires_at } = req.body;
    try{
     const result = await shortenURL(original_url, custom_alias, expires_at);
            res.status(201).json({ short_url: process.env.BASE_URL+"/"+result.short_code ,expires_at: result.expires_at });
        }
    catch(error) {
            next(error);
        }

}

async function getOriginalURLController(req, res,next) {
    const { shortcode } = req.params;
    try{
        const result = await getOgURL(shortcode);
        res.redirect(result.original_url);
    }
    catch(error) {
        next(error);
    }
}


async function deleteShortURLController(req, res,next) {
    const {shortcode} = req.params
    try{
        const result = await deleteShortURL(shortcode);
        res.status(200).json({ message: 'Short URL deleted successfully' });
    }
    catch(error){
        next(error);
}
}


function healthCheck(req, res) {
    res.status(200).json({ Status: "OK" });
}

export { healthCheck , shortenURLController, getOriginalURLController, deleteShortURLController };