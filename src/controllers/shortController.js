import {shortenURL,getOriginalURL,deleteShortURL,getURLsByUser} from "../services/urlService.js";

async function shortenURLController(req, res) {
    const { original_url, custom_alias, expires_at } = req.body;
    const userId = req.user.id;
    const result = await shortenURL(original_url, custom_alias, expires_at, userId);
    res.status(201).json({ short_url: process.env.BASE_URL+"/"+result.short_code ,expires_at: result.expires_at });
}

async function getOriginalURLController(req, res) {
    const { shortcode } = req.params;
    const result = await getOriginalURL(shortcode);
    res.redirect(result.original_url);
}

async function deleteShortURLController(req, res) {
    const {shortcode} = req.params
    const userId = req.user.id;
    await deleteShortURL(shortcode, userId);
    res.status(200).json({ message: 'Short URL deleted successfully' });
}

async function getURLsController(req, res) {
    const userId = req.user.id;
    const urls = await getURLsByUser(userId);
    res.status(200).json({ urls });
}

function healthCheck(req, res) {
    res.status(200).json({ Status: "OK" });
}

export { healthCheck , shortenURLController, getOriginalURLController, deleteShortURLController, getURLsController };
