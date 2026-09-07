import bcrypt from 'bcrypt';
import { createUser, findUserByEmail } from '../repositories/userRepository.js';
import { generateAccessToken, generateRefreshToken } from './tokenService.js';

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

async function loginUser(email, password) {
    const user = await findUserByEmail(email);

    const valid = user && await bcrypt.compare(password, user.password_hash);

    if (!valid) {
        const appError = new Error("Invalid email or password");
        appError.statusCode = 401;
        throw appError;
    }

    return {
        accessToken: generateAccessToken(user.id),
        refreshToken: generateRefreshToken(user.id)
    };
}

export { registerUser, loginUser };
