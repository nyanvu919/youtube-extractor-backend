import { Router } from 'itty-router';
import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import axios from 'axios';

// Helper for CORS and JSON responses
const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // Be more specific in production
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
};

const router = Router();

// Middleware to handle CORS preflight requests
router.options('*', () => new Response(null, {
    headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
}));


// Middleware for Authentication
const authMiddleware = async (request, env) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return jsonResponse({ message: 'Authentication token required' }, 401);
    }
    const token = authHeader.split(' ')[1];
    try {
        const secret = new TextEncoder().encode(env.JWT_SECRET);
        const { payload } = await jose.jwtVerify(token, secret);
        request.user = payload; // Attach user info to the request
    } catch (error) {
        return jsonResponse({ message: 'Invalid or expired token' }, 401);
    }
};

// ================== ROUTES ==================

// REGISTER
router.post('/api/auth/register', async (request, env) => {
    const { email, password } = await request.json();
    if (!email || !password) return jsonResponse({ message: 'Email and password are required' }, 400);

    const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await client.query('INSERT INTO users (email, password_hash) VALUES ($1, $2)', [email, hashedPassword]);
        return jsonResponse({ message: 'User registered successfully' }, 201);
    } catch (error) {
        return jsonResponse({ message: 'User already exists or server error' }, 500);
    } finally {
        await client.end();
    }
});

// LOGIN
router.post('/api/auth/login', async (request, env) => {
    const { email, password } = await request.json();
    const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    try {
        const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return jsonResponse({ message: 'Invalid credentials' }, 400);

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return jsonResponse({ message: 'Invalid credentials' }, 400);
        
        const secret = new TextEncoder().encode(env.JWT_SECRET);
        const token = await new jose.SignJWT({ id: user.id, email: user.email })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('7d')
            .sign(secret);
            
        return jsonResponse({ token });
    } catch (error) {
        return jsonResponse({ message: 'Server error' }, 500);
    } finally {
        await client.end();
    }
});


// GET VIDEO INFO (Protected Route)
router.post('/api/youtube/getVideoInfo', authMiddleware, async (request, env) => {
    const userId = request.user.id;
    const { youtubeUrl, userApiKey } = await request.json();
    if (!youtubeUrl || !userApiKey) return jsonResponse({ message: 'URL and API Key are required.' }, 400);

    const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
        const userResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];

        const isPaidUser = user.subscription_status !== 'free' && new Date(user.subscription_ends_at) > new Date();
        const hasFreeTurns = user.usage_count < 3;

        if (!isPaidUser && !hasFreeTurns) {
            return jsonResponse({ code: 'LIMIT_REACHED', message: 'Free limit reached.' }, 402);
        }

        const videoIdMatch = youtubeUrl.match(/(?:v=|\/|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;
        if (!videoId) return jsonResponse({ message: 'Invalid YouTube URL' }, 400);

        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,status&id=${videoId}&key=${userApiKey}`;
        const youtubeResponse = await axios.get(apiUrl);

        if (!isPaidUser) {
            await client.query('UPDATE users SET usage_count = usage_count + 1 WHERE id = $1', [userId]);
        }

        return jsonResponse(youtubeResponse.data);

    } catch (error) {
        if (error.response) return jsonResponse(error.response.data, error.response.status);
        return jsonResponse({ message: 'Internal Server Error' }, 500);
    } finally {
        await client.end();
    }
});


// Fallback route for 404
router.all('*', () => new Response('404, not found!', { status: 404 }));

export default {
    async fetch(request, env, ctx) {
        return router.handle(request, env, ctx);
    },
};
