export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  slug: string;
  manual?: string;
  demo_url?: string;
}
export interface Exchange {
  seq: number;
  request_id: string;
  agent: "customer" | "coach" | "review";
  input: string;
  output: string;
  status: string;
  error: string;
}
export interface Practice {
  id: string;
  product_id: string;
  kind: number;
  name: string;
  status: string;
  started_at: string | null;
  favorite: boolean;
  scenario: {
    company?: string;
    person?: string;
    role?: string;
    introduction?: string;
    opening?: string;
  };
  report: string;
  report_status: string;
  last_error: string;
  exchanges?: Exchange[];
}
export interface StreamEvent {
  message?: string;
  text?: string;
  practice?: Practice;
}

/** 请求同源接口，将后端业务错误转换为界面可显示的信息。 */
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(readFallbackError);
    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : `请求失败（${response.status}）`,
    );
  }
  return response.json() as Promise<T>;
}

/** 在服务器没有 JSON 错误正文时提供稳定的错误对象。 */
function readFallbackError() {
  return { detail: "服务暂时不可用，请检查后端是否启动。" };
}

/** 消费 SSE 事件，只有收到持久化完成事件才将请求视为成功。 */
export async function stream(
  path: string,
  body: unknown,
  onEvent: (name: string, data: StreamEvent) => void,
): Promise<void> {
  const response = await fetch("/api" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body)
    throw new Error("无法连接生成服务，请重试。");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;
  try {
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let name = "message",
          data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) name = line.slice(6).trim();
          if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (data) {
          const value = JSON.parse(data) as StreamEvent;
          if (name === "error")
            throw new Error(value.message || "生成失败，请重试。");
          if (name === "done") done = true;
          onEvent(name, value);
        }
        boundary = buffer.indexOf("\n\n");
      }
      if (chunk.done) break;
    }
    if (!done) throw new Error("连接中断，已保存的消息可重新生成。");
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
