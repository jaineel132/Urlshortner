    function validateShorten(req, res, next) {
        try{
            const original_url = req.body.original_url;

            if(typeof original_url !== "string"){
                return res.status(400).json({ error: 'Original URL must be a string' });
            }
            else if (original_url.trim() === '') {
                return res.status(400).json({ error: 'Original URL is required' });
            }
            const url = new URL(original_url);
            if(url.protocol !== "http:" && url.protocol !== "https:"){
                return res.status(400).json({ error: 'Original URL must be a valid HTTP or HTTPS URL' });
            }
            next();
        }
        catch(error){
            res.status(400).json({ error: 'Invalid URL format' });
        }
    }

    export {validateShorten}