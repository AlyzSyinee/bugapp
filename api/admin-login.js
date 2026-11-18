import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON belum diatur.");
  const serviceAccount = JSON.parse(raw);
  return initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username, password } = req.body || {};
  const expectedUsername = process.env.USERNAME_APP;
  const expectedPassword = process.env.PASSWORD_APP;

  if (!expectedUsername || !expectedPassword) {
    return res.status(500).json({ error: "Environment admin belum lengkap." });
  }
  if (typeof username !== "string" || typeof password !== "string" ||
      username.trim().toLowerCase() !== expectedUsername.trim().toLowerCase() ||
      password !== expectedPassword) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  try {
    const app = getAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);
    const email = `${expectedUsername.trim().toLowerCase()}@alyz.local`;
    let user;
    try {
      user = await auth.getUserByEmail(email);
      // Keep the server-controlled environment password synchronized for this admin account.
      await auth.updateUser(user.uid, { password: expectedPassword, displayName: "Alyz Admin" });
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
      user = await auth.createUser({
        email,
        password: expectedPassword,
        displayName: "Alyz Admin",
        emailVerified: true
      });
    }

    await auth.setCustomUserClaims(user.uid, { admin: true });
    await db.collection("admins").doc(user.uid).set({
      active: true,
      label: "ALYZ Admin",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await db.collection("users").doc(user.uid).set({
      username: expectedUsername.trim().toLowerCase(),
      displayName: "Alyz",
      role: "ADMIN",
      status: "active",
      isAdmin: true
    }, { merge: true });

    const customToken = await auth.createCustomToken(user.uid, { admin: true });
    return res.status(200).json({ customToken });
  } catch (error) {
    console.error("Admin bootstrap failed:", error);
    return res.status(500).json({ error: "Admin authentication setup failed." });
  }
}
