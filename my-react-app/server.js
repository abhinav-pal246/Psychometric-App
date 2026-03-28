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
const port = 3000; //Standard Express app on port 3000.


const CLIENT_URL = "http://localhost:5173";

// ====== Middleware==========================================================================================================
//-----------------------------------------------------------------------------------------------------------------------------
//origin = protocol + domain + port
// CORS (Cross-Origin Resource Sharing) is the server's way of telling the browser:
// "Hey, I trust requests coming from this other origin — let them through."
// By default, browsers block JavaScript from making requests to a different origin.
//  This is called the Same-Origin Policy — a browser security rule.
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true, //allowing cookirs from to be sent
  }),
);

//--------------------------------------------------------------------------------------------------------------------------- 
// req.body      // data sent in the request body (POST/PUT) It holds the data the client sent in the body of the request.
// req.params    // URL parameters  → /user/:id  → req.params.id
// req.user      // logged in user (added by Passport)
//these lines act as active translators (or parsers) for every single piece of data that comes into your server.
//without these two lines req.body wont work
app.use(express.urlencoded({ extended: true })); //This middleware acts as an HTML form parser.
app.use(express.json()); //This middleware acts as a JSON parser. bytes to -> { questionId: 3, answer: 2 }
//-----------------------------------------------------------------------------------------------------------------------------

//express-session stores session data server-side. The session ID is sent to the browser as a cookie.
//  This is what keeps users "logged in" between requests. Session middleware

// The key inside your .env file (GOOGLE_CLIENT_SECRET or SESSION_SECRET) is a static, unchanging password that belongs exclusively to your server.
// There is only one secret key.
// It is never given to User A or User B.

//Secret_Key is the stamp which autharise the random generate key by the session 


// The server's internal memory looks something like this:
// {
    //"ID_SecretKey"
//   "999_AAA": { user_id: 1, name: "User A", expires: "Tomorrow" },
//   "111_BBB": { user_id: 2, name: "User B", expires: "Tomorrow" }
// }


app.use(
  session({ // session create ID , before sending id to the client browser , it attach secretKey on the end of id as stam but stores ID only in server's ram
    secret: process.env.GOOGLE_CLIENT_SECRET,  //The Stamp is the mathematical signature. its  mathematical signature not random, The key is random but remain static for project , using the key a mathematical operation is applied whihc generates this secret stamp
    resave: false, //If the user's session data didn't change during their visit, don't bother saving a new copy of it back into the server's memory
    saveUninitialized: false, //Do not save this empty session into our memory, and do not send a cookie to the user's browser, until we actually put some data in it (like when they log in)."
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
  }),
);
//-------------------------------------------------------------------------------------------------------------------------
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













// // Frontend sends this: with api url || fetch is what sends the request from the browser
// fetch("/api/quiz/submit", {
//   method: "POST",
//   headers: { "Content-Type": "application/json" },
//   body: JSON.stringify({ questionId: 3, answer: 2 })
// })

// // Backend receives this: ||  req is what receives that request on the server
// app.post("/api/quiz/submit", (req, res) => {
//   console.log(req.body)
//   // → { questionId: 3, answer: 2 }
// })
// fetch()  =  you writing and posting the letter
// req      =  the letter after it arrives at the destination