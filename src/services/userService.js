import bcrypt from 'bcrypt';
import { createUser } from '../repositories/userRepository.js';

async function registerUser(email, password) {
    const hash = await bcrypt.hash(password, 10);

    try {
        return await createUser(email, hash);
    } catch (error) {
        if (error.code === "23505" && error.constraint === "users_email_key") {
            const appError = new Error("Email already registered");
            appError.statusCode = 409;
            throw appError;
        }
        throw error;
    }
}

export { registerUser };
