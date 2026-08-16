import {shortenURL,getOgURL,deleteShortURL} from "../services/urlService.js";

async function shortenURLController(req, res) {
    const { original_url, custom_alias, expires_at } = req.body;
    try{
     const result = await shortenURL(original_url, custom_alias, expires_at);
            res.status(201).json({ short_url: process.env.BASE_URL+"/"+result.short_code ,expires_at: result.expires_at });
        }
    catch(error) {
            console.error('Error shortening URL:', error);
            if (error.statusCode === 409) {
                res.status(409).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'An error occurred while shortening the URL' });
            }
        }

}

async function getOriginalURLController(req, res) {
    const { shortcode } = req.params;
    try{
        const result = await getOgURL(shortcode);
        res.redirect(result.original_url);
    }
    catch(error) {
        if(error.statusCode){
            res.status(error.statusCode).json({ error: error.message });
        }
        else{
            res.status(500).json({ error: 'An error occurred while retrieving the original URL' });
        }
    }
}


async function deleteShortURLController(req, res) {
    const {shortcode} = req.params
    try{
        const result = await deleteShortURL(shortcode);
        res.status(200).json({ message: 'Short URL deleted successfully' });
    }
    catch(error){
        if(error.statusCode){
            res.status(error.statusCode).json({ error: error.message });
        }
        else{
            res.status(500).json({ error: 'An error occurred while deleting the short URL' });
        }
}
}


function healthCheck(req, res) {
    res.status(200).json({ Status: "OKKKKK" });
}

export { healthCheck , shortenURLController, getOriginalURLController, deleteShortURLController };