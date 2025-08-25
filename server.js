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

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`✅ OTP server running at http://localhost:${PORT}`);
});
