import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

/** 启动独立本机前端并运行真实浏览器回归，结束后释放服务端口。 */
async function runBrowserTests() {
  const server = await createServer({
    server: { host: "127.0.0.1", port: 4174, strictPort: true },
  });
  try {
    await server.listen();
    const source = await readFile(
      new URL("./browser-checks.mjs", import.meta.url),
      "utf8",
    );
    const child = spawn("ego-browser", ["nodejs"], {
      stdio: ["pipe", "inherit", "inherit"],
    });
    child.stdin.end(source);
    /** 将浏览器进程失败传递为测试失败，保留原始诊断输出。 */
    function waitForBrowser(resolve, reject) {
      child.once("error", reject);
      /** 根据浏览器测试退出码决定整个回归是否通过。 */
      function onClose(code) {
        if (code === 0) resolve();
        else reject(new Error(`浏览器回归失败，退出码 ${code}`));
      }
      child.once("close", onClose);
    }
    await new Promise(waitForBrowser);
  } finally {
    await server.close();
  }
}

await runBrowserTests();
