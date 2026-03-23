import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import pg from "pg";
import cors from "cors";
const { Client } = pg;
import "dotenv/config";
import sarvamRoutes from "./sarvamRoutes.js";


const app = express();
const port = 3000;
const CLIENT_URL = "http://localhost:5173";

// ── Middleware ──────────────────────────────────────────────
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.GOOGLE_CLIENT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// ── Database ───────────────────────────────────────────────
const db = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
db.connect();

//sarvam
app.use("/api/sarvam", sarvamRoutes);

// ── Serialize / Deserialize ────────────────────────────────
passport.serializeUser((user, cb) => {
  cb(null, user.id);
});

passport.deserializeUser(async (id, cb) => {
  try {
    const result = await db.query(
      "SELECT * FROM oautherization WHERE id = $1",
      [id],
    );
    if (result.rows.length > 0) {
      cb(null, result.rows[0]);
    } else {
      cb(new Error("User not found"));
    }
  } catch (err) {
    cb(err);
  }
});

// ── Auth Routes ─────────────────────────────────────────────

// Sign In (register) — store mode in session, then redirect to Google
app.get("/auth/google/signup", (req, res, next) => {
  req.session.authMode = "signup";
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

// Log In — store mode in session, then redirect to Google
app.get("/auth/google/login", (req, res, next) => {
  req.session.authMode = "login";
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

// Google callback — passport handles it, then we send result to the popup
app.get(
  "/auth/google/callback",
  (req, res, next) => {
    passport.authenticate("google", (err, user, info) => {
      if (err || !user) {
        const message = (info && info.message) || "Authentication failed";
        return res.send(popupHTML(false, message));
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) return res.send(popupHTML(false, "Login failed"));
        return res.send(popupHTML(true, "Success", user.email, user.profile_name));
      });
    })(req, res, next);
  },
);

// Helper: HTML page that posts result back to the opener window and closes itself
function popupHTML(success, message, email, name) {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Authentication</title></head>
    <body>
      <p>${success ? "Success! This window will close..." : message}</p>
      <script>
        window.opener.postMessage(
          ${JSON.stringify({ success, message, email, name })},
          "${CLIENT_URL}"
        );
        window.close();
      </script>
    </body>
    </html>
  `;
}

// API endpoint to check current logged-in user
app.get("/api/user", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.profile_name,
      },
    });
  } else {
    res.json({ authenticated: false });
  }
});

app.post("/api/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.json({ success: true });
  });
});

// ── Google Strategy ────────────────────────────────────────
passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, cb) => {
      const mode = req.session.authMode || "login";
      console.log(`Auth mode: ${mode}, Google ID: ${profile.id}, Email: ${profile.emails[0].value}`);

      try {
        const existingUser = await db.query(
          "SELECT * FROM oautherization WHERE id = $1",
          [profile.id],
        );

        if (mode === "signup") {
          // Sign up: user must NOT already exist
          if (existingUser.rows.length > 0) {
            return cb(null, false, { message: "Account already exists. Please use Log In instead." });
          }
          // Create new user
          const newUser = await db.query(
            `INSERT INTO oautherization (id, email, profile_name)
             VALUES ($1, $2, $3) RETURNING *`,
            [profile.id, profile.emails[0].value, profile.displayName],
          );
          console.log("New user created:", newUser.rows[0]);
          return cb(null, newUser.rows[0]);

        } else {
          // Log in: user MUST already exist
          if (existingUser.rows.length === 0) {
            return cb(null, false, { message: "No account found. Please Sign In (register) first." });
          }
          console.log("Returning existing user:", existingUser.rows[0]);
          return cb(null, existingUser.rows[0]);
        }
      } catch (err) {
        console.error("GOOGLE STRATEGY ERROR:", err);
        return cb(err);
      }
    },
  ),
);

// ── Start Server ───────────────────────────────────────────
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
