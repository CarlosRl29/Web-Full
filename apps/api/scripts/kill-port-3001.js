#!/usr/bin/env node
/**
 * Mata el proceso que usa el puerto 3001.
 * Útil cuando EADDRINUSE aparece tras reiniciar la API.
 * Uso: node scripts/kill-port-3001.js
 */
const { execSync } = require("child_process");
const port = 3001;

function killPort(port) {
  if (process.platform === "win32") {
    let result;
    try {
      result = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    } catch (e) {
      if (e.status === 1) {
        console.log(`Puerto ${port} libre.`);
        return;
      }
      throw e;
    }
    const lines = result.trim().split("\n").filter(Boolean);
    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== "0" && /^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "inherit" });
        console.log(`Puerto ${port}: proceso ${pid} terminado.`);
      } catch (e) {
        // Ignorar si ya no existe
      }
    }
    if (pids.size === 0) console.log(`Puerto ${port} libre.`);
  } else {
    execSync(`npx kill-port ${port}`, { stdio: "inherit" });
  }
}

killPort(port);
