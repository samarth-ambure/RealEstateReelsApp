import dotenv from "dotenv";
dotenv.config();

import http from "http";
import net from "net";
import jwt from "jsonwebtoken";
import { pool } from "../config/db";

const PORT = Number(process.env.PORT) || 5000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const isPortOpen = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
};

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}

const makeRequest = (
  path: string,
  options: RequestOptions = {}
): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const bodyStr = options.body ? JSON.stringify(options.body) : null;

    const reqHeaders: Record<string, string> = {
      ...(options.headers || {}),
    };

    if (bodyStr) {
      reqHeaders["Content-Type"] = "application/json";
      reqHeaders["Content-Length"] = Buffer.byteLength(bodyStr).toString();
    }

    const req = http.request(
      url,
      {
        method: options.method || "GET",
        headers: reqHeaders,
      },
      (res) => {
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          let parsed: any;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }
          resolve({
            status: res.statusCode || 0,
            data: parsed,
            headers: res.headers,
          });
        });
      }
    );

    req.on("error", reject);

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
};

async function runRegressionSuite() {
  console.log("=================================================");
  console.log("🔍 RUNNING BACKEND REGRESSION TEST SUITE");
  console.log("=================================================");

  let spawnedServer: http.Server | null = null;
  const running = await isPortOpen(PORT);

  if (!running) {
    console.log(`Starting backend server on port ${PORT}...`);
    const serverModule = await import("../server");
    spawnedServer = serverModule.server;
    await new Promise((r) => setTimeout(r, 600));
  } else {
    console.log(`Backend server is active on port ${PORT}.`);
  }

  const results: { name: string; passed: boolean; details?: string }[] = [];

  try {
    // -------------------------------------------------------------
    // REGRESSION TEST 1: Healthcheck GET /
    // -------------------------------------------------------------
    console.log("\n[TEST 1] Root Healthcheck Endpoint (GET /)");
    const healthRes = await makeRequest("/");
    const t1Passed =
      healthRes.status === 200 &&
      healthRes.data?.message === "Real Estate API is running";
    console.log(`  Status: ${healthRes.status}, Response:`, healthRes.data);
    results.push({
      name: "REST: Root healthcheck (GET /)",
      passed: t1Passed,
      details: `Status ${healthRes.status}`,
    });

    // -------------------------------------------------------------
    // REGRESSION TEST 2: Public Properties Listing (GET /api/properties)
    // -------------------------------------------------------------
    console.log("\n[TEST 2] Public Properties Endpoint (GET /api/properties)");
    const propRes = await makeRequest("/api/properties");
    const propertyList = propRes.data?.properties ?? propRes.data?.data ?? propRes.data;
    const t2Passed = propRes.status === 200 && Array.isArray(propertyList);
    console.log(`  Status: ${propRes.status}, Properties found: ${propertyList?.length ?? 0}`);
    results.push({
      name: "REST: Properties list (GET /api/properties)",
      passed: t2Passed,
      details: `Status ${propRes.status}`,
    });

    // -------------------------------------------------------------
    // REGRESSION TEST 3: Protected Route Authentication Rejection
    // -------------------------------------------------------------
    console.log("\n[TEST 3] Protected Conversations Endpoint - Unauthenticated (GET /api/conversations)");
    const unauthRes = await makeRequest("/api/conversations");
    const t3Passed = unauthRes.status === 401;
    console.log(`  Status: ${unauthRes.status}, Error message:`, unauthRes.data?.message);
    results.push({
      name: "REST: Protected route rejects missing token (GET /api/conversations)",
      passed: t3Passed,
      details: `Status ${unauthRes.status}`,
    });

    // -------------------------------------------------------------
    // Fetch test user & conversation from DB for authenticated tests
    // -------------------------------------------------------------
    const convRes = await pool.query(
      `SELECT c.id, c.user_id_1, c.user_id_2,
              u1.name AS u1_name, u2.name AS u2_name
       FROM conversations c
       JOIN users u1 ON u1.id = c.user_id_1
       JOIN users u2 ON u2.id = c.user_id_2
       ORDER BY c.id ASC
       LIMIT 1`
    );

    if (convRes.rows.length === 0) {
      throw new Error("No conversation found in database to execute tests.");
    }

    const testConv = convRes.rows[0];
    const userAId: number = testConv.user_id_1;
    const conversationId: number = testConv.id;
    const jwtSecret = process.env.JWT_SECRET || "realestate_super_secret_key_change_later";
    const tokenA = jwt.sign({ userId: userAId }, jwtSecret, { expiresIn: "1h" });

    // -------------------------------------------------------------
    // REGRESSION TEST 4: Protected Conversations Endpoint - Authenticated
    // -------------------------------------------------------------
    console.log("\n[TEST 4] Protected Conversations Endpoint - Authenticated (GET /api/conversations)");
    const authConvRes = await makeRequest("/api/conversations", {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const t4Passed = authConvRes.status === 200 && Array.isArray(authConvRes.data?.data ?? authConvRes.data?.conversations);
    console.log(`  Status: ${authConvRes.status}, Conversations returned: ${(authConvRes.data?.data ?? authConvRes.data?.conversations)?.length ?? 0}`);
    results.push({
      name: "REST: Authenticated conversations query (GET /api/conversations)",
      passed: t4Passed,
      details: `Status ${authConvRes.status}`,
    });

    // -------------------------------------------------------------
    // REGRESSION TEST 5: Get Conversation Messages (GET /api/conversations/:id/messages)
    // -------------------------------------------------------------
    console.log(`\n[TEST 5] Get Messages (GET /api/conversations/${conversationId}/messages)`);
    const messagesRes = await makeRequest(`/api/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const t5Passed = messagesRes.status === 200 && Array.isArray(messagesRes.data?.messages);
    console.log(`  Status: ${messagesRes.status}, Message history count: ${messagesRes.data?.messages?.length ?? 0}`);
    results.push({
      name: `REST: Conversation messages query (GET /api/conversations/:id/messages)`,
      passed: t5Passed,
      details: `Status ${messagesRes.status}`,
    });

    // -------------------------------------------------------------
    // REGRESSION TEST 6: REST Send Message (POST /api/conversations/:id/messages)
    // -------------------------------------------------------------
    console.log(`\n[TEST 6] REST Send Message (POST /api/conversations/${conversationId}/messages)`);
    const restMsgText = `Regression test message from REST - ${Date.now()}`;
    const sendMsgRes = await makeRequest(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { message: restMsgText },
    });
    const t6Passed = sendMsgRes.status === 201 && sendMsgRes.data?.data?.message === restMsgText;
    console.log(`  Status: ${sendMsgRes.status}, Saved message ID: ${sendMsgRes.data?.data?.id}`);
    results.push({
      name: "REST: Send message to conversation (POST /api/conversations/:id/messages)",
      passed: t6Passed,
      details: `Status ${sendMsgRes.status}`,
    });

    // -------------------------------------------------------------
    // REGRESSION TEST 7: CORS Headers Verification
    // -------------------------------------------------------------
    console.log("\n[TEST 7] CORS Header Verification for Mobile Clients");
    const corsRes = await makeRequest("/api/properties", {
      headers: { Origin: "http://localhost:8081" },
    });
    const accessControlAllowOrigin =
      corsRes.headers["access-control-allow-origin"] || "";
    const t7Passed = accessControlAllowOrigin === "*";
    console.log(`  Access-Control-Allow-Origin: "${accessControlAllowOrigin}"`);
    results.push({
      name: "Config: CORS Access-Control-Allow-Origin header is wildcard (*)",
      passed: t7Passed,
      details: accessControlAllowOrigin,
    });

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log("\n=================================================");
    console.log("🏁 REGRESSION TEST SUMMARY");
    console.log("=================================================");
    let allPassed = true;
    for (const r of results) {
      console.log(` [${r.passed ? "PASS" : "FAIL"}] ${r.name} (${r.details})`);
      if (!r.passed) allPassed = false;
    }
    console.log("=================================================");

    if (allPassed) {
      console.log("🎉 ALL REST REGRESSION CHECKS PASSED!\n");
    } else {
      console.error("⚠️ SOME REGRESSION CHECKS FAILED!\n");
    }

    if (spawnedServer) {
      spawnedServer.close();
    }
    await pool.end();

    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error("❌ Regression test error:", err);
    if (spawnedServer) {
      spawnedServer.close();
    }
    await pool.end();
    process.exit(1);
  }
}

runRegressionSuite();
