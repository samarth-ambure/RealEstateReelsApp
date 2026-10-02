import dotenv from "dotenv";
dotenv.config();

import http from "http";
import net from "net";
import jwt from "jsonwebtoken";
import { io, Socket } from "socket.io-client";
import { pool } from "../config/db";

const PORT = Number(process.env.PORT) || 5000;
const SERVER_URL = `http://localhost:${PORT}`;

// Helper to check if server port is already open
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

async function runTestSuite() {
  console.log("=================================================");
  console.log("🚀 STARTING AUTOMATED SOCKET.IO TEST SUITE");
  console.log("=================================================");

  let spawnedServer: http.Server | null = null;
  const running = await isPortOpen(PORT);

  if (!running) {
    console.log(`Starting backend server on port ${PORT}...`);
    const serverModule = await import("../server");
    spawnedServer = serverModule.server;
    // Brief pause to allow HTTP and Socket.IO server to bind
    await new Promise((r) => setTimeout(r, 600));
  } else {
    console.log(`Backend server is already running on port ${PORT}.`);
  }

  const results: { name: string; passed: boolean }[] = [];

  try {
    // -------------------------------------------------------------
    // TEST 1: Unauthenticated connection rejected
    // -------------------------------------------------------------
    console.log("\n[TEST 1] Unauthenticated Connection Verification");
    const unauthSocket: Socket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: false,
      autoConnect: true,
      timeout: 3000,
    });

    const test1Passed = await new Promise<boolean>((resolve) => {
      let resolved = false;

      unauthSocket.on("connect", () => {
        if (!resolved) {
          resolved = true;
          console.error("  ❌ FAIL: Unauthenticated connection unexpectedly succeeded.");
          unauthSocket.disconnect();
          resolve(false);
        }
      });

      unauthSocket.on("connect_error", (err: Error) => {
        if (!resolved) {
          resolved = true;
          console.log(`  ✔ PASS: Rejected unauthenticated connection. Error: "${err.message}"`);
          unauthSocket.disconnect();
          resolve(true);
        }
      });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.error("  ❌ FAIL: Timeout waiting for connection error.");
          unauthSocket.disconnect();
          resolve(false);
        }
      }, 3500);
    });

    results.push({ name: "1. Unauthenticated connection rejected", passed: test1Passed });

    // -------------------------------------------------------------
    // Fetch valid test conversation & participants from DB
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
    const userBId: number = testConv.user_id_2;
    const sharedConvId: number = testConv.id;

    console.log(`\n📋 Test Fixture Loaded:`);
    console.log(`   Shared Conversation ID: ${sharedConvId}`);
    console.log(`   User A: ID=${userAId} ("${testConv.u1_name}")`);
    console.log(`   User B: ID=${userBId} ("${testConv.u2_name}")`);

    const jwtSecret = process.env.JWT_SECRET || "realestate_super_secret_key_change_later";
    const tokenA = jwt.sign({ userId: userAId }, jwtSecret, { expiresIn: "1h" });
    const tokenB = jwt.sign({ userId: userBId }, jwtSecret, { expiresIn: "1h" });

    // -------------------------------------------------------------
    // TEST 2: Authenticated connection for User A and User B
    // -------------------------------------------------------------
    console.log("\n[TEST 2] Authenticated Connections for User A & User B");
    const socketA: Socket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: false,
      auth: { token: tokenA },
    });

    const socketB: Socket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: false,
      auth: { token: `Bearer ${tokenB}` },
    });

    const [socketAConnected, socketBConnected] = await Promise.all([
      new Promise<boolean>((resolve) => {
        socketA.on("connect", () => {
          console.log(`  ✔ PASS: User A authenticated and connected (Socket ID: ${socketA.id})`);
          resolve(true);
        });
        socketA.on("connect_error", (err: Error) => {
          console.error(`  ❌ FAIL: User A authentication failed: ${err.message}`);
          resolve(false);
        });
      }),
      new Promise<boolean>((resolve) => {
        socketB.on("connect", () => {
          console.log(`  ✔ PASS: User B authenticated and connected (Socket ID: ${socketB.id})`);
          resolve(true);
        });
        socketB.on("connect_error", (err: Error) => {
          console.error(`  ❌ FAIL: User B authentication failed: ${err.message}`);
          resolve(false);
        });
      }),
    ]);

    results.push({
      name: "2. Authenticated connections for User A & User B",
      passed: socketAConnected && socketBConnected,
    });

    // -------------------------------------------------------------
    // TEST 3: Room authorization check (Unauthorized room join)
    // -------------------------------------------------------------
    console.log("\n[TEST 3] Room Authorization Rejection Check");
    const unauthorizedQuery = await pool.query(
      "SELECT id FROM conversations WHERE user_id_1 != $1 AND user_id_2 != $1 LIMIT 1",
      [userAId]
    );
    const unauthorizedConvId =
      unauthorizedQuery.rows.length > 0 ? unauthorizedQuery.rows[0].id : 999999;
    console.log(`  Attempting unauthorized room join by User A on Conversation ID: ${unauthorizedConvId}`);

    const test3Passed = await new Promise<boolean>((resolve) => {
      let resolved = false;

      const onError = (err: any) => {
        if (!resolved) {
          resolved = true;
          console.log(`  ✔ PASS: Received error event on unauthorized join: "${err.message}"`);
          socketA.off("error", onError);
          resolve(true);
        }
      };

      socketA.on("error", onError);

      socketA.emit(
        "join_conversation",
        { conversationId: unauthorizedConvId },
        (ack: any) => {
          if (ack?.status === "error") {
            if (!resolved) {
              resolved = true;
              console.log(`  ✔ PASS: Received error acknowledgement: "${ack.message}"`);
              socketA.off("error", onError);
              resolve(true);
            }
          }
        }
      );

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socketA.off("error", onError);
          console.error("  ❌ FAIL: Unauthorized join was not rejected within timeout.");
          resolve(false);
        }
      }, 3000);
    });

    results.push({
      name: "3. Room authorization check (unauthorized room rejected)",
      passed: test3Passed,
    });

    // -------------------------------------------------------------
    // TEST 4: Valid room join for User A & User B
    // -------------------------------------------------------------
    console.log("\n[TEST 4] Valid Room Join for Shared Conversation");
    const joinRoom = (sock: Socket, label: string): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        sock.emit(
          "join_conversation",
          { conversationId: sharedConvId },
          (ack: any) => {
            if (ack?.status === "ok" && ack?.room === `conversation:${sharedConvId}`) {
              console.log(`  ✔ PASS: ${label} joined room "${ack.room}" successfully`);
              resolve(true);
            } else {
              console.error(`  ❌ FAIL: ${label} room join response invalid:`, ack);
              resolve(false);
            }
          }
        );
      });
    };

    const joinAPassed = await joinRoom(socketA, "User A");
    const joinBPassed = await joinRoom(socketB, "User B");

    results.push({
      name: "4. Valid room join for User A & User B",
      passed: joinAPassed && joinBPassed,
    });

    // -------------------------------------------------------------
    // TEST 5: Real-time message exchange and acknowledgement
    // -------------------------------------------------------------
    console.log("\n[TEST 5] Real-Time Message Exchange (User A -> User B)");
    const testMessageText = `Hello from Socket test - ${Date.now()}`;

    const receivePromise = new Promise<{ received: boolean; data?: any }>((resolve) => {
      const timeout = setTimeout(() => {
        console.error("  ❌ FAIL: Timeout waiting for new_message on User B socket.");
        resolve({ received: false });
      }, 5000);

      socketB.once("new_message", (messagePayload: any) => {
        clearTimeout(timeout);
        resolve({ received: true, data: messagePayload });
      });
    });

    const sendPromise = new Promise<{ acked: boolean; data?: any }>((resolve) => {
      socketA.emit(
        "send_message",
        { conversationId: sharedConvId, message: testMessageText },
        (ack: any) => {
          if (ack?.status === "ok" && ack?.data) {
            console.log("  ✔ PASS: User A received send_message ack with status 'ok'");
            resolve({ acked: true, data: ack.data });
          } else {
            console.error("  ❌ FAIL: User A send_message ack returned error:", ack);
            resolve({ acked: false });
          }
        }
      );
    });

    const [sendResult, receiveResult] = await Promise.all([sendPromise, receivePromise]);

    let test5Passed = false;
    if (sendResult.acked && receiveResult.received) {
      const msg = receiveResult.data;
      const isIdentical =
        msg.message === testMessageText &&
        msg.conversation_id === sharedConvId &&
        msg.sender_id === userAId &&
        msg.sender?.id === userAId;

      if (isIdentical) {
        console.log(`  ✔ PASS: User B received new_message with matching payload:`);
        console.log(`     ID: ${msg.id}`);
        console.log(`     Message: "${msg.message}"`);
        console.log(`     Sender ID: ${msg.sender_id} (${msg.sender?.name})`);
        console.log(`     Created At: ${msg.created_at}`);
        test5Passed = true;
      } else {
        console.error("  ❌ FAIL: Message payload mismatch on User B receiver:", msg);
      }
    }

    results.push({
      name: "5. Real-time message exchange & client acknowledgement",
      passed: test5Passed,
    });

    // -------------------------------------------------------------
    // TEST 6: Persistence verification in PostgreSQL
    // -------------------------------------------------------------
    console.log("\n[TEST 6] Persistence Verification in PostgreSQL");
    const dbCheck = await pool.query(
      `SELECT id, conversation_id, sender_id, message, created_at
       FROM messages
       WHERE conversation_id = $1 AND message = $2
       ORDER BY id DESC
       LIMIT 1`,
      [sharedConvId, testMessageText]
    );

    let test6Passed = false;
    if (dbCheck.rows.length > 0) {
      const row = dbCheck.rows[0];
      if (row.sender_id === userAId) {
        console.log(`  ✔ PASS: Database row confirmed in 'messages' table:`);
        console.log(`     Message ID: ${row.id}`);
        console.log(`     Conversation ID: ${row.conversation_id}`);
        console.log(`     Sender ID: ${row.sender_id}`);
        console.log(`     Content: "${row.message}"`);
        console.log(`     Created At: ${row.created_at}`);
        test6Passed = true;
      } else {
        console.error(`  ❌ FAIL: sender_id mismatch in DB row: expected ${userAId}, got ${row.sender_id}`);
      }
    } else {
      console.error("  ❌ FAIL: No database record found for sent message.");
    }

    results.push({
      name: "6. Database row persistence confirmed",
      passed: test6Passed,
    });

    // Clean up sockets
    socketA.disconnect();
    socketB.disconnect();

    // -------------------------------------------------------------
    // Output Summary
    // -------------------------------------------------------------
    console.log("\n=================================================");
    console.log("🏁 TEST SUITE SUMMARY");
    console.log("=================================================");
    let allPassed = true;
    for (const r of results) {
      console.log(` [${r.passed ? "PASS" : "FAIL"}] ${r.name}`);
      if (!r.passed) allPassed = false;
    }
    console.log("=================================================");

    if (allPassed) {
      console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!\n");
    } else {
      console.error("⚠️ SOME TESTS FAILED!\n");
    }

    // Clean exit
    if (spawnedServer) {
      spawnedServer.close();
    }
    await pool.end();

    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error("❌ Unexpected test execution error:", err);
    if (spawnedServer) {
      spawnedServer.close();
    }
    await pool.end();
    process.exit(1);
  }
}

runTestSuite();
