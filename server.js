// server.js
import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

// Temporary in-memory OTP store
const otpStore = {};

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
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.json({ valid: false });
    }

    const record = otpStore[email];
    if (!record) {
        return res.json({ valid: false });
    }

    if (record.expires < Date.now()) {
        delete otpStore[email];
        return res.json({ valid: false });
    }

    if (record.otp !== otp) {
        return res.json({ valid: false });
    }

    // OTP valid
    delete otpStore[email];
    res.json({ valid: true });
});

// Endpoint: Home page with brief intro
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
