const assert = (await import("node:assert/strict")).default;
const task = await taskSpace("销售陪练前端回归");
const page = task.page("p1");

/** 在浏览器网络边界提供隔离练习，测试不会写入真实记录或调用模型。 */
function installFixtures() {
  const practice = {
    id: "browser-regression",
    product_id: "crm",
    kind: 0,
    name: "前端回归练习",
    status: "ongoing",
    started_at: "2026-11-12T10:00:00Z",
    favorite: false,
    scenario: {
      company: "测试公司",
      person: "测试负责人",
      role: "采购负责人",
      introduction: "了解客户需求。".repeat(80),
    },
    report: "## 复盘总结\n\n" + "先确认需求，再介绍方案。\n\n".repeat(80),
    report_status: "complete",
    last_error: "",
    exchanges: [],
  };
  const product = {
    id: "crm",
    name: "客户关系管理系统",
    category: "CRM",
    description: "管理客户与销售机会。",
    slug: "crm",
    manual: "# 产品资料\n\n" + "产品功能与交付服务。\n\n".repeat(100),
    demo_url: "/products/crm/demo",
  };
  const originalFetch = window.fetch;
  window.fixture = {
    practice,
    requests: [],
    writes: [],
    failNext: false,
    holdNext: false,
  };
  /** 模拟公开 API 和 SSE 回复，保留应用真实的表单提交与消息渲染路径。 */
  window.fetch = async function fixtureFetch(input, options = {}) {
    const path = new URL(String(input), location.origin).pathname;
    if (!path.startsWith("/api/")) return originalFetch(input, options);
    if (options.method && options.method !== "GET")
      window.fixture.writes.push({ path, method: options.method });
    let value;
    if (path === "/api/health") value = { model_configured: true };
    else if (path === "/api/products") value = [product];
    else if (path === "/api/products/crm") value = product;
    else if (path === "/api/practices") value = [practice];
    else if (path.endsWith("/product")) value = product;
    else if (path.endsWith("/messages")) {
      const body = JSON.parse(options.body);
      window.fixture.requests.push(body);
      if (window.fixture.failNext) {
        window.fixture.failNext = false;
        return new Response("生成失败", { status: 503 });
      }
      if (window.fixture.holdNext) {
        window.fixture.holdNext = false;
        /** 等待测试主动释放回复，以覆盖生成期间的重复提交。 */
        function holdReply(resolve) {
          window.fixture.resumeReply = resolve;
        }
        await new Promise(holdReply);
      }
      practice.exchanges.push({
        seq: practice.exchanges.length + 1,
        ...body,
        input: body.content,
        output: "已收到消息。\n\n" + "这是一段较长的回复。".repeat(20),
        status: "complete",
        error: "",
      });
      return new Response(
        "event: done\ndata: " + JSON.stringify({ practice }) + "\n\n",
        { headers: { "Content-Type": "text/event-stream" } },
      );
    } else value = practice;
    return Response.json(value);
  };
}

const injection = await page.cdp("Page.addScriptToEvaluateOnNewDocument", {
  source: `(${installFixtures.toString()})();`,
});
await page.goto(
  `http://127.0.0.1:4174/?regression=${Date.now()}#practice/browser-regression`,
);
await page.cdp("Page.removeScriptToEvaluateOnNewDocument", {
  identifier: injection.identifier,
});
await page.waitForSelector('textarea[aria-label="发送给客户的消息"]');
console.log(await page.snapshot());
await page.fill(
  'textarea[aria-label="发送给客户的消息"]',
  "你好，想了解贵司需求",
);
await page.press('textarea[aria-label="发送给客户的消息"]', "Enter");
/** 读取发送产生的公开请求数量，判定 Enter 是否触发表单。 */
function requestCount() {
  return window.fixture.requests.length;
}
await page.waitForFunction(requestCount, undefined, { timeout: 3000 });
assert.equal(await page.evaluate(requestCount), 1, "Enter 应直接发送客户消息");
/** 从用户可见的消息中确认提交结果，避免只验证发出了请求。 */
function sentMessageVisible() {
  return (
    document.querySelector(".message.mine .message-text")?.textContent ===
    "你好，想了解贵司需求"
  );
}
await page.waitForFunction(sentMessageVisible);
console.log("PASS Enter 发送客户消息");

/** 等待发送结束，避免下一次操作与禁用输入框的状态竞争。 */
function composerReady() {
  return !document.querySelector("textarea")?.disabled;
}
await page.waitForFunction(composerReady);
/** 确认回车发送后焦点回到消息输入，用户可直接继续下一轮。 */
function composerFocused() {
  return document.activeElement === document.querySelector("textarea");
}
await page.waitForFunction(composerFocused, undefined, { timeout: 3000 });
assert.equal(
  await page.evaluate(composerFocused),
  true,
  "回车发送后应可继续输入",
);
await page.fill('textarea[aria-label="发送给客户的消息"]', "第一行");
await page.press('textarea[aria-label="发送给客户的消息"]', "Shift+Enter");
/** 读取用户可见的消息草稿，确认换行没有触发发送。 */
function customerDraft() {
  return document.querySelector('textarea[aria-label="发送给客户的消息"]')
    .value;
}
assert.equal(await page.evaluate(customerDraft), "第一行\n");
assert.equal(await page.evaluate(requestCount), 1, "Shift+Enter 应只换行");
console.log("PASS Shift+Enter 换行");

/** 通过原生键盘事件覆盖输入法确认、旧式 229 标识和长按重复事件。 */
function inputMethodKeys() {
  const textarea = document.querySelector("textarea");
  for (const options of [
    { isComposing: true },
    { keyCode: 229 },
    { repeat: true },
  ]) {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        ...options,
      }),
    );
  }
}
await page.evaluate(inputMethodKeys);
assert.equal(await page.evaluate(requestCount), 1, "输入法确认和长按不应发送");
console.log("PASS 中文输入法与长按保护");

for (const shortcut of ["Control+Enter", "Meta+Enter"]) {
  await page.waitForFunction(composerReady);
  await page.fill('textarea[aria-label="发送给客户的消息"]', shortcut);
  await page.press('textarea[aria-label="发送给客户的消息"]', shortcut);
  await page.waitForFunction(composerReady);
}
assert.equal(await page.evaluate(requestCount), 3, "保留原有快捷键发送");
await page.fill('textarea[aria-label="发送给客户的消息"]', "   ");
await page.press('textarea[aria-label="发送给客户的消息"]', "Enter");
assert.equal(await page.evaluate(requestCount), 3, "空白输入不应发送");
console.log("PASS 组合快捷键与空白输入保护");

await page.click('[data-action="coach"]');
await page.waitForSelector('textarea[aria-label="向教练提问"]');
console.log(await page.snapshot());
await page.fill('textarea[aria-label="向教练提问"]', "我下一步该问什么？");
await page.press('textarea[aria-label="向教练提问"]', "Enter");
await page.waitForFunction(composerReady);
/** 读取最近请求的目标与内容，确保教练输入发送给正确对象。 */
function lastRequest() {
  return window.fixture.requests.at(-1);
}
assert.equal((await page.evaluate(lastRequest)).agent, "coach");
console.log("PASS Enter 发送教练消息");

await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 600,
  deviceScaleFactor: 1,
  mobile: false,
});
/** 检查桌面输入区实际几何位置，捕获固定高度导致的底部裁切。 */
function desktopComposersVisible() {
  /** 判定单个输入表单是否完整位于当前视口。 */
  function isVisible(form) {
    const rect = form.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight + 1;
  }
  return [...document.querySelectorAll(".composer")].every(isVisible);
}
assert.equal(
  await page.evaluate(desktopComposersVisible),
  true,
  "矮窗口应完整显示客户和教练输入区",
);
console.log("PASS 矮窗口输入区可见");

/** 让下一次网络请求失败，以检查用户草稿仍可重发。 */
function failNextRequest() {
  window.fixture.failNext = true;
}
await page.evaluate(failNextRequest);
await page.fill('textarea[aria-label="发送给客户的消息"]', "保留这条草稿");
await page.press('textarea[aria-label="发送给客户的消息"]', "Enter");
await page.waitForSelector('[role="alert"]');
await page.waitForFunction(composerReady);
assert.equal(await page.evaluate(customerDraft), "保留这条草稿");
await page.click('.composer[data-agent="customer"] button');
await page.waitForFunction(composerReady);
assert.equal(await page.evaluate(customerDraft), "");
console.log("PASS 失败保留草稿与按钮重发");

/** 挂起下一次回复，让生成期间的表单保持忙碌状态。 */
function holdNextRequest() {
  window.fixture.holdNext = true;
}
await page.evaluate(holdNextRequest);
const beforePending = await page.evaluate(requestCount);
await page.fill('textarea[aria-label="发送给客户的消息"]', "生成期间保护");
await page.press('textarea[aria-label="发送给客户的消息"]', "Enter");
/** 等待回复已挂起，保证重复提交实际发生在生成期间。 */
function replyPending() {
  return Boolean(window.fixture.resumeReply);
}
await page.waitForFunction(replyPending);
/** 尝试在生成期间重复提交客户和教练表单，随后释放回复。 */
function retryWhileBusy() {
  document.querySelector('.composer[data-agent="customer"]').requestSubmit();
  document.querySelector('.composer[data-agent="coach"]').requestSubmit();
  window.fixture.resumeReply();
}
await page.evaluate(retryWhileBusy);
await page.waitForFunction(composerReady);
assert.equal(await page.evaluate(requestCount), beforePending + 1);
console.log("PASS 生成期间不重复提交");

/** 收集布局越界和消息区可用高度，不依赖具体 CSS 实现。 */
function layoutProblems() {
  const problems = [];
  if (document.documentElement.scrollWidth > innerWidth + 1)
    problems.push("页面横向越界");
  for (const selector of [
    ".work",
    ".chat-layout",
    ".review-layout",
    ".customer-pane",
    ".coach-pane",
    ".report",
    ".voice-layout",
    ".voice-customer",
    ".voice-coach",
  ]) {
    for (const element of document.querySelectorAll(selector)) {
      if (element.scrollWidth > element.clientWidth + 1)
        problems.push(`${selector} 横向越界`);
    }
  }
  for (const messages of document.querySelectorAll(".messages")) {
    if (messages.clientHeight < 30) problems.push("消息区无法阅读");
  }
  for (const form of document.querySelectorAll(".composer")) {
    const formRect = form.getBoundingClientRect();
    const paneRect = form.parentElement.getBoundingClientRect();
    if (formRect.bottom > paneRect.bottom + 1) problems.push("输入区超出面板");
  }
  return problems;
}

/** 通过浏览器定位控件，验证它能滚动进入工作区可视范围。 */
async function assertReachable(selector) {
  /** 将控件实际位置与工作区及视口边界比较。 */
  function controlVisible(target) {
    const control = document.querySelector(target);
    control.scrollIntoView({ block: "center", behavior: "instant" });
    const rect = control.getBoundingClientRect();
    const work = document.querySelector(".work").getBoundingClientRect();
    return {
      visible:
        rect.top >= Math.max(work.top, 0) - 1 &&
        rect.bottom <= Math.min(work.bottom, innerHeight) + 1,
      top: rect.top,
      bottom: rect.bottom,
      workTop: work.top,
      workBottom: work.bottom,
      width: innerWidth,
      height: innerHeight,
    };
  }
  const geometry = await page.evaluate(controlVisible, selector);
  assert.equal(
    geometry.visible,
    true,
    `${selector} 应可滚动进入可视区域 ${JSON.stringify(geometry)}`,
  );
}

for (const [width, height] of [
  [1440, 900],
  [1280, 600],
  [1024, 420],
  [850, 600],
  [768, 480],
  [680, 400],
  [390, 844],
  [320, 568],
]) {
  await page.cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  assert.deepEqual(
    await page.evaluate(layoutProblems),
    [],
    `${width}×${height} 聊天布局`,
  );
  await assertReachable('textarea[aria-label="发送给客户的消息"]');
  await assertReachable('.composer[data-agent="customer"] button');
  await assertReachable('textarea[aria-label="向教练提问"]');
  await assertReachable('.composer[data-agent="coach"] button');
  console.log(`PASS ${width}×${height} 聊天布局及输入可达`);
}

await page.click('[data-action="task"]');
/** 长任务详情应在自身区域滚动，不挤掉聊天输入。 */
function taskScrollable() {
  const panel = document.querySelector(".materials");
  return (
    panel.scrollHeight > panel.clientHeight &&
    panel.clientHeight <= innerHeight * 0.36 + 1
  );
}
assert.equal(await page.evaluate(taskScrollable), true);
await assertReachable('.composer[data-agent="customer"] button');
assert.deepEqual(await page.evaluate(layoutProblems), []);
console.log("PASS 长任务详情独立滚动");

await page.click('[data-action="materials"]');
await page.waitForSelector(".material-dialog");
console.log(await page.snapshot());
/** 弹窗应完整位于视口内，长资料通过弹窗自身滚动。 */
function dialogFits() {
  const dialog = document.querySelector("dialog");
  const rect = dialog.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.bottom <= innerHeight + 1 &&
    rect.left >= 0 &&
    rect.right <= innerWidth + 1 &&
    dialog.scrollHeight > dialog.clientHeight
  );
}
for (const [width, height] of [
  [1280, 400],
  [390, 400],
  [320, 300],
]) {
  await page.cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  assert.equal(
    await page.evaluate(dialogFits),
    true,
    `${width}×${height} 资料弹窗应可完整滚动`,
  );
}
await page.press("dialog", "Escape");
console.log("PASS 矮窗口和窄窗口资料弹窗");

/** 通过测试记录的公开路由进入复盘，覆盖第三个消息输入入口。 */
function openReview() {
  window.fixture.practice.status = "done";
  location.hash = "review/browser-regression";
}
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 600,
  deviceScaleFactor: 1,
  mobile: false,
});
await page.evaluate(openReview);
await page.waitForSelector(".review-layout");
console.log(await page.snapshot());
await page.fill('textarea[aria-label="向教练提问"]', "如何改进沟通？");
await page.press('textarea[aria-label="向教练提问"]', "Enter");
await page.waitForFunction(composerReady);
assert.equal((await page.evaluate(lastRequest)).content, "如何改进沟通？");
for (const [width, height] of [
  [1440, 900],
  [1024, 420],
  [1000, 600],
  [768, 480],
  [390, 844],
  [320, 568],
]) {
  await page.cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  assert.deepEqual(
    await page.evaluate(layoutProblems),
    [],
    `${width}×${height} 复盘布局`,
  );
  await assertReachable('.composer[data-agent="coach"] button');
  console.log(`PASS ${width}×${height} 复盘布局及教练输入可达`);
}

/** 切换公开页面，检查应用外壳变化后普通页面仍能完整滚动。 */
function changeRoute(route) {
  location.hash = route;
}
/** 等待目标页面完成加载，避免在旧页面上测量布局。 */
function pageTitleMatches(title) {
  return document.querySelector(".page h1")?.textContent === title;
}
/** 普通页面的最末内容应能滚动进入工作区。 */
function pageEndReachable() {
  const work = document.querySelector(".work");
  const content = document.querySelector(".page");
  work.scrollTop = work.scrollHeight;
  return (
    content.getBoundingClientRect().bottom <=
    work.getBoundingClientRect().bottom + 1
  );
}
for (const [route, title] of [
  ["home", "开始今天的练习"],
  ["library", "项目资料"],
  ["history", "历史记录"],
  ["favorites", "收藏"],
  ["product/crm", "客户关系管理系统"],
]) {
  await page.evaluate(changeRoute, route);
  await page.waitForFunction(pageTitleMatches, title);
  for (const [width, height] of [
    [1440, 900],
    [320, 568],
  ]) {
    await page.cdp("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    assert.deepEqual(
      await page.evaluate(layoutProblems),
      [],
      `${title} ${width}×${height}`,
    );
    assert.equal(
      await page.evaluate(pageEndReachable),
      true,
      `${title} 页面末尾可达`,
    );
  }
  console.log(`PASS ${title} 桌面与窄窗口滚动`);
}

/** 统计业务写请求，确认语音 UI 预览仅进行页面浏览。 */
function writeCount() {
  return window.fixture.writes.length;
}
/** 读取首页两个模式的入口数量，确保三个练习均有双入口。 */
function practiceEntryCounts() {
  return {
    text: document.querySelectorAll('.entry-actions [data-action="choose"]')
      .length,
    voice: document.querySelectorAll('.entry-actions [data-id^="voice/"]')
      .length,
  };
}
/** 读取语音待接入界面的状态，确认通话及教练发送均禁用。 */
function voicePreviewState() {
  return {
    type: document.querySelector(".voice-session-title p")?.textContent,
    status: document.querySelector("#voice-service-status")?.textContent,
    callDisabled: document.querySelector(".voice-start")?.disabled,
    coachDisabled: document.querySelector("#voice-coach textarea")?.disabled,
  };
}
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await page.evaluate(changeRoute, "home");
await page.waitForFunction(pageTitleMatches, "开始今天的练习");
assert.deepEqual(await page.evaluate(practiceEntryCounts), {
  text: 3,
  voice: 3,
});
const beforeVoiceUi = await page.evaluate(writeCount);
/** 读取资料页的返回按钮文字，检查导航目的地与文案一致。 */
function productReturnText() {
  return document.querySelector(".section-head button")?.textContent.trim();
}
for (const [kind, title] of [
  [0, "需求沟通与方案介绍"],
  [1, "商务谈判与合作推进"],
  [2, "完整流程练习"],
]) {
  await page.click(`[data-action="choose"][data-kind="${kind}"]`);
  await page.waitForSelector('[data-action="prepare"]');
  assert.equal(new URL(await page.url()).hash, `#choose/${kind}`);
  await page.evaluate(changeRoute, "home");
  await page.waitForFunction(pageTitleMatches, "开始今天的练习");
  await page.click(`[data-action="nav"][data-id="voice/${kind}"]`);
  await page.waitForSelector(`[data-id="voice/${kind}/crm"]`);
  await page.click('[data-id="product/crm"]');
  await page.waitForFunction(pageTitleMatches, "客户关系管理系统");
  assert.equal(await page.evaluate(productReturnText), "返回产品选择");
  await page.click(`[data-id="voice/${kind}"]`);
  await page.waitForSelector(`[data-id="voice/${kind}/crm"]`);
  await page.click(`[data-id="voice/${kind}/crm"]`);
  await page.waitForSelector(".voice-preview");
  /** 判断教练面板是否已展开，避免前一页面的展开状态影响操作。 */
  function voiceCoachOpen() {
    return Boolean(document.querySelector("#voice-coach"));
  }
  if (!(await page.evaluate(voiceCoachOpen)))
    await page.click('[data-action="coach"]');
  await page.waitForSelector("#voice-coach");
  assert.deepEqual(await page.evaluate(voicePreviewState), {
    type: title,
    status: "语音模型待接入",
    callDisabled: true,
    coachDisabled: true,
  });
  await page.click('[aria-label="返回语音产品选择"]');
  await page.waitForSelector(`[data-id="voice/${kind}/crm"]`);
  await page.evaluate(changeRoute, "home");
  await page.waitForFunction(pageTitleMatches, "开始今天的练习");
  console.log(`PASS ${title} 文字与语音入口`);
}
await page.click('[data-id="voice/0"]');
await page.waitForSelector('[data-id="voice/0/crm"]');
await page.click('[data-id="voice/0/crm"]');
await page.waitForSelector(".voice-preview");
await page.click('[data-id="product/crm"]');
await page.waitForFunction(pageTitleMatches, "客户关系管理系统");
assert.equal(await page.evaluate(productReturnText), "返回语音练习");
await page.click('[data-id="voice/0/crm"]');
await page.waitForSelector(".voice-preview");
for (const [width, height] of [
  [1440, 900],
  [1024, 600],
  [768, 480],
  [390, 844],
  [320, 568],
]) {
  await page.cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  assert.deepEqual(
    await page.evaluate(layoutProblems),
    [],
    `${width}×${height} 语音界面`,
  );
  await assertReachable(".voice-start");
  await assertReachable(".voice-transcript summary");
  await assertReachable("#voice-coach textarea");
  console.log(`PASS ${width}×${height} 语音界面及控件可达`);
}
assert.equal(
  await page.evaluate(writeCount),
  beforeVoiceUi,
  "语音 UI 预览应仅浏览页面",
);
console.log("PASS 语音 UI 预览无业务写入");

await task.finish({ keep: [] });
