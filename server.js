// server.js

import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import cors from "cors";

dotenv.config();
const dbConfig = {
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
};
const pool = new Pool(dbConfig);
const client = await pool.connect();
const app = express();
app.use(bodyParser.json());

// Temporary in-memory OTP store
const otpStore = {};
app.use(cors({
    origin: ['http://localhost:5173', 'https://*.tsxr1ck.com'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Generate random 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Endpoint: Request OTP
app.post("/get-otp", (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    const otp = generateOTP();

    // Store OTP with 5-minute expiry
    otpStore[email] = {
        otp,
        expires: Date.now() + 24 * 60 * 60 * 1000,
    };

    // Return OTP directly to client
    res.json({ otp });
});

// Endpoint: Verify OTP
app.post("/verify-otp", (req, res) => {
    const { token, otp } = req.body;

    if (!token || !otp) {
        return res.json({ valid: false, error: "Token and OTP are required" });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return res.json({ valid: false, error: "Invalid or expired token" });
    }

    const email = decoded.email;
    if (!email) {
        return res.json({ valid: false, error: "Token missing email" });
    }
    // Query the database for the user matching the email
    client.query(
        'SELECT id FROM users WHERE email = $1',
        [email],
        (err, result) => {
            if (err) {
                return res.status(500).json({ valid: false, error: "Database error" });
            }
            if (result.rows.length === 0) {
                return res.json({ valid: false, error: "No matching user found" });
            }
            const userId = result.rows[0].id;

            // Query the database for the OTP and email match
            client.query(
                'SELECT otp, expires FROM verification_tokens WHERE user_id = $1 AND token = $2 ORDER BY expires DESC LIMIT 1',
                [userId, otp],
                (err, result) => {
                    if (err) {
                        return res.status(500).json({ valid: false, error: "Database error" });
                    }
                    if (result.rows.length === 0) {
                        return res.json({ valid: false, error: "No matching OTP record found" });
                    }
                    const record = result.rows[0];
                    if (record.expires < Date.now()) {
                        return res.json({ valid: false, error: "OTP expired" });
                    }
                    // Update OTP usage count
                    client.query(
                        'UPDATE verification_tokens SET used = TRUE WHERE user_id = $1 AND token = $2',
                        [userId, otp],
                        (err) => {
                            if (err) {
                                return res.status(500).json({ valid: false, error: "Database error" });
                            }
                            // OTP valid
                            res.json({ valid: true });
                        }
                    );
                    // Update user isVerified status
                    client.query(
                        'UPDATE users SET is_verified = TRUE WHERE id = $1',
                        [userId],
                        (err) => {
                            if (err) {
                                return res.status(500).json({ valid: false, error: "Database error" });
                            }
                            // User is verified
                            res.json({ valid: true });
                        }
                    );
                }
            );
        });

    // Endpoint: Home page with brief intro

});
app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>OTPify</title>
            <style>
                body { font-family: Arial, sans-serif; background: #f7f7f7; color: #222; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 60px auto; background: #fff; border-radius: 10px; box-shadow: 0 2px 8px #0001; padding: 32px; }
                h1 { color: #4f8cff; }
                p { font-size: 1.1em; }
                 .footer { margin-top: 2em; color: #888; font-size: 0.95em; }
                code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>OTPify</h1>
                <p><b>OTPify</b> is a simple Node.js server for generating and verifying One-Time Passwords (OTP) via API endpoints.</p>
                <ul>
                    <li>POST <code>/get-otp</code> — Request a new OTP for an email address.</li>
                    <li>POST <code>/verify-otp</code> — Verify an OTP for an email address.</li>
                </ul>
                <p>Send JSON requests to these endpoints to use OTPify in your app or for testing.</p>
                <p style="color:#888;font-size:0.95em;">Made with Node.js & Express</p>
                <p class="footer">
                    Powered by <a href="https://github.com/tsxr1ck/otpify" target="_blank">tsxr1ck/otpify</a> &mdash; Node.js and Express.
                </p>
            </div>
        </body>
            
        </html>
    `);
});

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`✅ OTP server running at http://localhost:${PORT}`);
});
