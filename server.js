import express from "express";
import dotenv from 'dotenv'
import pool from './src/db/connection.js';
import shortUrlRouter from './src/routes/shortUrl.js';
import authRouter from './src/routes/authRouter.js';
import { errorHandler } from "./src/middleware/errorHandler.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use('/', shortUrlRouter);
app.use('/auth', authRouter);
app.use(errorHandler);

app.listen(process.env.PORT, () => {
    pool.query('SELECT NOW()',(err) => {
        if (err) {
            console.error('Error connecting to the database:', err);
        } else {
            console.log('Successfully connected to the database');
        }
    });
    console.log(`Server is running on port ${process.env.PORT}`);
})