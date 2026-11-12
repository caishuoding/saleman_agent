import React, {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import { createRoot } from "react-dom/client";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  LayoutGrid,
  FolderOpen,
  Clock3,
  Star,
  MessagesSquare,
  Handshake,
  Route,
  ArrowUp,
  X,
  AudioLines,
  ArrowLeft,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";
import {
  api,
  stream,
  type Product,
  type Practice,
  type Exchange,
  type StreamEvent,
} from "./api";
import "./style.css";

const TYPES = ["需求沟通与方案介绍", "商务谈判与合作推进", "完整流程练习"];
const GOALS = [
  "了解甲方需求，结合产品能力介绍合适的方案。",
  "讨论价格、付款与服务条件，确认合作安排和下一步。",
  "从初次沟通开始，持续推进到双方确认下一步。",
];
const ICONS = [MessagesSquare, Handshake, Route];

/** 按浏览器时区显示真实开始时间，准备阶段使用明确占位。 */
function time(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
        hour12: false,
      }).format(new Date(value))
    : "尚未开始";
}

/** 统一渲染安全 Markdown，保留产品手册中的本地配图与表格。 */
function RichText({ text, product }: { text: string; product?: Product }) {
  /** 将手册中的相对图片地址解析到后端白名单产品目录。 */
  function image({ src, alt }: { src?: string; alt?: string }) {
    const path =
      src?.startsWith("images/") && product
        ? `/products/${product.slug}/${src}`
        : src;
    return <img src={path} alt={alt || ""} loading="lazy" />;
  }
  return (
    <div className="markdown">
      <Markdown remarkPlugins={[remarkGfm]} components={{ img: image }}>
        {text}
      </Markdown>
    </div>
  );
}

/** 依据既有侧栏原型实现产品选择、训练、复盘与历史管理。 */
function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || "home");
  const [products, setProducts] = useState<Product[]>([]);
  const [records, setRecords] = useState<Practice[]>([]);
  const [current, setCurrent] = useState<Practice | null>(null);
  const [manual, setManual] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [coach, setCoach] = useState(false);
  const [materials, setMaterials] = useState(false);
  const [dialog, setDialog] = useState<"finish" | "remove" | null>(null);
  const [removeId, setRemoveId] = useState("");
  const [renameId, setRenameId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    kind: "",
    product_id: "",
  });
  const [health, setHealth] = useState<{ model_configured: boolean } | null>(
    null,
  );
  const [live, setLive] = useState<{
    agent: string;
    input: string;
    text: string;
    request_id: string;
  } | null>(null);
  const [generationStatus, setGenerationStatus] = useState("");
  const [materialOpen, setMaterialOpen] = useState(false);
  const productReturn = useRef("library");
  const prepareKey = useRef<{
    product: string;
    kind: number;
    key: string;
  } | null>(null);
  const [page, arg] = route.split("/");
  const active = current;
  const selected = products.find(findSelected);

  /** 查找当前练习使用的产品，资料弹窗始终跟随本场产品。 */
  function findSelected(p: Product) {
    return p.id === current?.product_id;
  }
  /** 更新 URL，使刷新和历史返回能够恢复当前练习页面。 */
  function navigate(value: string) {
    location.hash = value;
  }
  /** 订阅路由并初始化目录、记录和服务状态，卸载时清理监听。 */
  function initialize() {
    let alive = true;
    /** 将浏览器历史变化同步到 React 路由状态。 */
    function changed() {
      setRoute(location.hash.slice(1) || "home");
      setError("");
      setMaterialOpen(false);
      setDialog(null);
    }
    /** 并行加载首页所需的只读数据。 */
    async function boot() {
      try {
        const [p, r, h] = await Promise.all([
          api<Product[]>("/products"),
          api<Practice[]>("/practices"),
          api<{ model_configured: boolean }>("/health"),
        ]);
        if (alive) {
          setProducts(p);
          setRecords(r);
          setHealth(h);
        }
      } catch (e) {
        if (alive) setError(message(e));
      }
    }
    window.addEventListener("hashchange", changed);
    void boot();
    /** 停止过期初始化结果并解除路由事件订阅。 */
    function cleanup() {
      alive = false;
      window.removeEventListener("hashchange", changed);
    }
    return cleanup;
  }
  useEffect(initialize, []);
  /** 在路由变化时加载原始记录或手册，忽略过期请求结果。 */
  function loadPage() {
    let alive = true;
    /** 以服务端持久化记录恢复练习或资料详情。 */
    async function load() {
      setLoading(true);
      try {
        if (["practice", "prepare", "review"].includes(page) && arg) {
          const value = await api<Practice>("/practices/" + arg);
          if (alive) {
            setCurrent(value);
            if (page === "practice" && value.status === "done")
              navigate("review/" + arg);
          }
        }
        if (page === "product" && arg) {
          const value = await api<Product>("/products/" + arg);
          if (alive) setManual(value);
        }
        if (["home", "history", "favorites"].includes(page)) {
          const value = await api<Practice[]>("/practices");
          if (alive) setRecords(value);
        }
      } catch (e) {
        if (alive) setError(message(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    /** 阻止快速切页时旧数据覆盖当前页面。 */
    function cleanup() {
      alive = false;
    }
    return cleanup;
  }
  useEffect(loadPage, [route]);
  /** 对话更新后将各消息区域滚动到最新内容。 */
  function scrollMessages() {
    for (const element of document.querySelectorAll(".messages"))
      element.scrollTop = element.scrollHeight;
  }
  useEffect(scrollMessages, [live, current, coach]);
  /** 打开确认框时将焦点放入对话框，关闭后由正常焦点顺序继续。 */
  function focusDialog() {
    if (dialog || materialOpen)
      document.querySelector<HTMLElement>("dialog button")?.focus();
  }
  useEffect(focusDialog, [dialog, materialOpen]);

  /** 提取可向用户显示的业务错误文字。 */
  function message(e: unknown) {
    return e instanceof Error ? e.message : "操作失败，请重试。";
  }
  /** 生成请求期间统一禁用冲突操作并显示业务错误。 */
  async function perform(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  /** 从后端重新加载列表，确保收藏和名称在多个入口同步。 */
  async function refresh() {
    setRecords(await api<Practice[]>("/practices"));
  }
  /** 复用准备请求标识，让客户生成失败后重试仍对应同一初始场次。 */
  async function prepareProduct(productId: string, kind: number) {
    if (
      prepareKey.current?.product !== productId ||
      prepareKey.current.kind !== kind
    )
      prepareKey.current = {
        product: productId,
        kind,
        key: crypto.randomUUID(),
      };
    const value = await api<Practice>("/practices/prepare", "POST", {
      product_id: productId,
      kind,
      request_id: prepareKey.current.key,
    });
    setCurrent(value);
    prepareKey.current = null;
    navigate("prepare/" + value.id);
  }
  /** 处理流式状态与正文，完成事件替换为后端已提交的正式记录。 */
  function onStream(name: string, data: StreamEvent) {
    if (name === "delta") {
      /** 将新文字追加到本轮临时显示内容。 */
      function append(value: typeof live) {
        return value
          ? { ...value, text: value.text + (data.text || "") }
          : value;
      }
      setLive(append);
    }
    if (name === "status") setGenerationStatus(data.message || "");
    if (name === "done" && data.practice) {
      setCurrent(data.practice);
      setLive(null);
    }
  }
  /** 发送稳定标识的消息，出错时重新读取服务端状态供原位重试。 */
  async function send(
    agent: string,
    content: string,
    requestId: string = crypto.randomUUID(),
  ) {
    if (!active) return;
    const id = active.id;
    setLive({ agent, input: content, text: "", request_id: requestId });
    setGenerationStatus("正在回复");
    try {
      await stream(
        `/practices/${id}/${agent === "review" ? "finish" : "messages"}`,
        agent === "review"
          ? { request_id: requestId }
          : { request_id: requestId, agent, content },
        onStream,
      );
    } finally {
      setLive(null);
      setGenerationStatus("");
      setCurrent(await api<Practice>("/practices/" + id));
    }
  }
  /** 通过按钮数据处理导航和练习操作，所有写入经过后端接口。 */
  async function action(event: MouseEvent<HTMLElement>) {
    const button = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-action]",
    );
    if (!button || busy) return;
    const name = button.dataset.action,
      id = button.dataset.id || "",
      kind = Number(button.dataset.kind);
    if (name === "nav") {
      if (id.startsWith("product/")) productReturn.current = route;
      navigate(id);
      return;
    }
    if (name === "choose") {
      navigate("choose/" + kind);
      return;
    }
    if (name === "coach") {
      setCoach(!coach);
      return;
    }
    if (name === "task") {
      setMaterials(!materials);
      return;
    }
    if (name === "close") {
      setDialog(null);
      setMaterialOpen(false);
      return;
    }
    if (name === "finish") {
      setDialog("finish");
      return;
    }
    if (name === "remove") {
      setRemoveId(id);
      setDialog("remove");
      return;
    }
    if (name === "rename") {
      const record = records.find(matchId);
      setRenameId(id);
      setRenameValue(record?.name || "");
      return;
    }
    if (name === "cancel-rename") {
      setRenameId("");
      return;
    }
    if (name === "materials") {
      /** 在当前练习上打开资料，保留聊天位置和未提交内容。 */
      async function loadMaterial() {
        setManual(
          await api<Product>(
            active ? "/practices/" + active.id + "/product" : "/products/" + id,
          ),
        );
        setMaterialOpen(true);
      }
      await perform(loadMaterial);
      return;
    }
    /** 在列表中匹配按钮所属练习。 */
    function matchId(record: Practice) {
      return record.id === id;
    }
    /** 执行一次需要后端持久化或模型生成的按钮操作。 */
    async function mutate() {
      if (name === "prepare") await prepareProduct(id, Number(arg));
      if (name === "start" && active) {
        const value = await api<Practice>(
          "/practices/" + active.id + "/start",
          "POST",
        );
        setCurrent(value);
        navigate("practice/" + value.id);
      }
      if (name === "favorite") {
        const record = active?.id === id ? active : records.find(matchId);
        if (record) {
          const value = await api<Practice>("/practices/" + id, "PATCH", {
            favorite: !record.favorite,
          });
          if (active?.id === id) setCurrent(value);
          await refresh();
        }
      }
      if (name === "confirm-remove") {
        await api("/practices/" + removeId, "PATCH", { favorite: false });
        setDialog(null);
        await refresh();
      }
      if (name === "confirm-finish" && active) {
        setDialog(null);
        navigate("review/" + active.id);
        await send("review", "");
        await refresh();
      }
      if (name === "retry-review" && active) {
        let key: string = crypto.randomUUID();
        for (const exchange of active.exchanges || [])
          if (exchange.agent === "review" && exchange.status !== "complete")
            key = exchange.request_id;
        await send("review", "", key);
      }
      if (name === "restart" && active) {
        const value = await api<Practice>(
          "/practices/" + active.id + "/restart",
          "POST",
          { request_id: crypto.randomUUID() },
        );
        setCurrent(value);
        navigate("prepare/" + value.id);
        setCoach(false);
      }
      if (name === "retry" && active) {
        for (const exchange of active.exchanges || [])
          if (exchange.request_id === id)
            await send(exchange.agent, exchange.input, exchange.request_id);
      }
    }
    await perform(mutate);
  }
  /** 提交客户、教练输入或行内名称编辑，保留失败内容供重新提交。 */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const content = String(data.get("content") || "").trim();
    if (!content) return;
    /** 保存当前表单指定的业务操作。 */
    async function save() {
      if (form.dataset.agent === "rename") {
        await api("/practices/" + renameId, "PATCH", { name: content });
        setRenameId("");
        await refresh();
      } else {
        await send(form.dataset.agent || "customer", content);
        form.reset();
      }
    }
    await perform(save);
  }
  /** 同步独立筛选条件及受控的名称输入。 */
  function change(event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) {
    const { name, value } = event.target;
    if (name === "rename") setRenameValue(value);
    else setFilters({ ...filters, [name]: value });
  }
  /** 在输入区支持快捷发送，保留 Enter 换行与中文输入法行为。 */
  function composerKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey) &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }
  /** 让模态框支持 Escape 和焦点循环。 */
  function dialogKey(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      setDialog(null);
      setMaterialOpen(false);
    }
    if (event.key === "Tab") {
      const elements = event.currentTarget.querySelectorAll<HTMLElement>(
        "button,a,input,textarea,select",
      );
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }
  /** 绘制带发送状态和可访问标签的独立输入区。 */
  function composer(agent: string) {
    return (
      <form className="composer" data-agent={agent} onSubmit={submit}>
        <textarea
          name="content"
          aria-label={agent === "customer" ? "发送给客户的消息" : "向教练提问"}
          placeholder={
            agent === "customer"
              ? "输入你想对客户说的话…"
              : "你想向教练请教什么？"
          }
          onKeyDown={composerKey}
          disabled={busy}
          required
        />
        <div className="compose-foot">
          <span className="small muted">
            {agent === "customer" ? "甲方负责人" : "训练教练"}
          </span>
          <button className="button primary" disabled={busy} type="submit">
            发送 <ArrowUp size={16} />
          </button>
        </div>
      </form>
    );
  }
  /** 展示问答原文，进行中的失败请求可重试，已结束客户消息显示终态。 */
  function renderExchange(exchange: Exchange) {
    if (exchange.agent === "review") return null;
    const matches = live?.request_id === exchange.request_id;
    return (
      <React.Fragment key={exchange.request_id}>
        <article className="message mine">
          <div className="message-label">你</div>
          <div className="message-text">{exchange.input}</div>
        </article>
        {exchange.status === "complete" ? (
          <article className="message">
            <div className="message-label">
              {exchange.agent === "customer"
                ? active?.scenario.person
                : "训练教练"}
            </div>
            <div className="message-text">
              <RichText text={exchange.output} />
            </div>
          </article>
        ) : (
          !matches && (
            <div className="message failed">
              <span>
                {exchange.agent === "customer" && active?.status === "done"
                  ? "本轮客户回复未完成"
                  : exchange.error || "上次生成未完成"}
              </span>
              {(exchange.agent !== "customer" || active?.status !== "done") && (
                <button
                  className="button"
                  data-action="retry"
                  data-id={exchange.request_id}
                  disabled={busy}
                >
                  重新生成
                </button>
              )}
            </div>
          )
        )}
      </React.Fragment>
    );
  }
  /** 仅绘制实际保存的对话与当前流式内容，开练时保持聊天为空。 */
  function messages(agent: string) {
    const items = [];
    for (const exchange of active?.exchanges || [])
      if (exchange.agent === agent) items.push(renderExchange(exchange));
    let already = false;
    for (const exchange of active?.exchanges || [])
      if (exchange.request_id === live?.request_id) already = true;
    return (
      <div
        className="messages"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {items}
        {live?.agent === agent && (
          <>
            {!already && (
              <article className="message mine">
                <div className="message-label">你</div>
                <div className="message-text">{live.input}</div>
              </article>
            )}
            <article className="message">
              <div className="message-label">
                {agent === "customer" ? active?.scenario.person : "训练教练"}
              </div>
              <div className="message-text">
                {live.text ? (
                  <RichText text={live.text} />
                ) : (
                  <span className="muted">
                    {generationStatus || "正在回复…"}
                  </span>
                )}
              </div>
            </article>
          </>
        )}
      </div>
    );
  }
  /** 在训练和复盘阶段复用同一个教练对话区域。 */
  function coachPanel(review = false) {
    return (
      <aside className="coach-pane" aria-label="训练教练">
        <header className="coach-heading">
          <h3>训练教练</h3>
          {!review && (
            <button
              className="icon-button"
              data-action="coach"
              aria-label="收起教练"
            >
              <X size={18} />
            </button>
          )}
        </header>
        {messages("coach")}
        {composer("coach")}
      </aside>
    );
  }
  /** 绘制不包含隐藏需求的本场任务信息。 */
  function details() {
    return (
      <dl className="details">
        <div>
          <dt>推销产品</dt>
          <dd>{selected?.name}</dd>
        </div>
        <div>
          <dt>你的角色</dt>
          <dd>乙方产品销售</dd>
        </div>
        <div>
          <dt>甲方公司</dt>
          <dd>{active?.scenario.company}</dd>
        </div>
        <div>
          <dt>甲方负责人</dt>
          <dd>
            {active?.scenario.person} · {active?.scenario.role}
          </dd>
        </div>
        <div>
          <dt>业务背景</dt>
          <dd>{active?.scenario.introduction}</dd>
        </div>
        <div>
          <dt>本次任务</dt>
          <dd>{GOALS[active?.kind || 0]}</dd>
        </div>
      </dl>
    );
  }
  /** 生成可从多个入口操作同场练习的收藏按钮。 */
  function favorite(record: Practice) {
    return (
      <button
        className={
          "button favorite-button " + (record.favorite ? "selected" : "")
        }
        data-action="favorite"
        data-id={record.id}
        aria-pressed={record.favorite}
        disabled={busy}
      >
        <Star size={16} />
        {record.favorite ? "已收藏" : "收藏"}
      </button>
    );
  }
  /** 绘制首页专项入口，沿用原型卡片和主操作。 */
  function renderTraining(kind: number) {
    const Icon = ICONS[kind];
    return (
      <article className="training-card" key={kind}>
        <Icon size={30} />
        <h2>{TYPES[kind]}</h2>
        <p className="muted">{GOALS[kind]}</p>
        <button
          className="button"
          data-action="choose"
          data-kind={kind}
          disabled={busy}
        >
          进入专项 <ChevronRight size={15} />
        </button>
      </article>
    );
  }
  /** 绘制产品目录，并按所处页面提供学习或选择操作。 */
  function renderProduct(p: Product) {
    return (
      <article className="product-card" key={p.id}>
        <FolderOpen size={28} />
        <h2>{p.name}</h2>
        <p className="muted">{p.description}</p>
        <div className="actions">
          <button
            className="button"
            data-action="nav"
            data-id={"product/" + p.id}
            disabled={busy}
          >
            查看资料
          </button>
          {page === "choose" && (
            <button
              className="button primary"
              data-action="prepare"
              data-id={p.id}
              disabled={busy}
            >
              选择此产品
            </button>
          )}
        </div>
      </article>
    );
  }
  /** 为筛选控件生成产品选项。 */
  function productOption(p: Product) {
    return (
      <option key={p.id} value={p.id}>
        {p.name}
      </option>
    );
  }
  /** 为筛选控件生成练习类型选项。 */
  function typeOption(label: string, index: number) {
    return (
      <option key={index} value={index}>
        {label}
      </option>
    );
  }
  /** 匹配历史或收藏列表中的组合筛选条件。 */
  function matchesFilters(record: Practice) {
    return (
      (page !== "favorites" || record.favorite) &&
      (!filters.status || record.status === filters.status) &&
      (!filters.kind || String(record.kind) === filters.kind) &&
      (!filters.product_id || record.product_id === filters.product_id)
    );
  }
  /** 绘制记录行，名称编辑与收藏操作都更新同一服务端记录。 */
  function renderRecord(record: Practice) {
    return (
      <article className="record" key={record.id}>
        <div className="record-info">
          {renameId === record.id ? (
            <form data-agent="rename" onSubmit={submit}>
              <label htmlFor="rename">练习名称</label>
              <input
                id="rename"
                name="content"
                aria-label="练习名称"
                value={renameValue}
                onChange={renameChange}
                maxLength={120}
                required
                autoFocus
              />
              <div className="actions">
                <button className="button primary" disabled={busy}>
                  保存
                </button>
                <button
                  type="button"
                  className="button"
                  data-action="cancel-rename"
                >
                  取消
                </button>
              </div>
            </form>
          ) : (
            <h3>{record.name}</h3>
          )}
          <p className="small muted">
            {TYPES[record.kind]} · {productName(record.product_id)}
          </p>
          <p className="small muted">开始时间 {time(record.started_at)}</p>
        </div>
        <div className="actions">
          <span
            className={
              "status " + (record.status === "ongoing" ? "ongoing" : "")
            }
          >
            {record.status === "ongoing" ? "未完成" : "已完成"}
          </span>
          <button
            className="button quiet"
            data-action="rename"
            data-id={record.id}
            disabled={busy}
          >
            重命名
          </button>
          {page === "favorites" ? (
            <button
              className="button danger"
              data-action="remove"
              data-id={record.id}
              disabled={busy}
            >
              删除
            </button>
          ) : (
            favorite(record)
          )}
          <button
            className="button"
            data-action="nav"
            data-id={`${record.status === "ongoing" ? "practice" : "review"}/${record.id}`}
            disabled={busy}
          >
            {record.status === "ongoing" ? "继续练习" : "查看复盘"}
          </button>
        </div>
      </article>
    );
  }
  /** 同步表单字段名为 content 的名称输入。 */
  function renameChange(event: ChangeEvent<HTMLInputElement>) {
    setRenameValue(event.target.value);
  }
  /** 根据产品标识显示目录名称。 */
  function productName(id: string) {
    for (const p of products) if (p.id === id) return p.name;
    return id;
  }
  /** 根据当前路由绘制主区域，训练布局沿用原型。 */
  function content() {
    if (loading && !busy)
      return (
        <div className="page loading">
          <LoaderCircle className="spin" /> 正在加载
        </div>
      );
    if (page === "home") {
      let recent: Practice | undefined;
      for (const record of records)
        if (record.status === "ongoing") {
          recent = record;
          break;
        }
      return (
        <div className="page">
          <h1>开始今天的练习</h1>
          {recent && (
            <section className="resume">
              <div className="resume-copy">
                <p className="small">最近未完成的练习</p>
                <h3>{recent.name}</h3>
                <p className="small muted">
                  开始时间 {time(recent.started_at)}
                </p>
              </div>
              <button
                className="button primary"
                data-action="nav"
                data-id={"practice/" + recent.id}
                disabled={busy}
              >
                继续练习
              </button>
            </section>
          )}
          <div className="section-head">
            <h2>专项练习</h2>
          </div>
          <div className="practice-grid">{[0, 1].map(renderTraining)}</div>
          <section className="full-case">
            <Route size={30} />
            <div>
              <h2>完整流程练习</h2>
              <p className="muted small">
                需求沟通与方案介绍 → 商务谈判与合作推进
              </p>
            </div>
            <button
              className="button primary"
              data-action="choose"
              data-kind="2"
              disabled={busy}
            >
              进入练习
            </button>
          </section>
        </div>
      );
    }
    if (page === "library" || page === "choose")
      return (
        <div className="page">
          <div className="section-head">
            <h1>{page === "library" ? "项目资料" : "选择推销的产品"}</h1>
            {page === "choose" && (
              <span className="muted">{TYPES[Number(arg)]}</span>
            )}
          </div>
          <div className="product-library">{products.map(renderProduct)}</div>
          {busy && (
            <p className="loading" role="status">
              <LoaderCircle className="spin" /> 正在准备客户情境…
            </p>
          )}
        </div>
      );
    if (page === "product" && manual)
      return (
        <div className="page">
          <div className="section-head">
            <h1>{manual.name}</h1>
            <button
              className="button"
              data-action="nav"
              data-id={productReturn.current}
              disabled={busy}
            >
              <ArrowLeft size={16} />{" "}
              {productReturn.current.startsWith("choose/")
                ? "返回产品选择"
                : "返回项目资料"}
            </button>
          </div>
          <section className="case-banner">
            <a
              className="button"
              href={manual.demo_url}
              target="_blank"
              rel="noreferrer"
            >
              查看产品界面
            </a>
            <RichText text={manual.manual || ""} product={manual} />
          </section>
        </div>
      );
    if (page === "history" || page === "favorites") {
      const filtered = records.filter(matchesFilters);
      return (
        <div className="page">
          <h1>{page === "history" ? "历史记录" : "收藏"}</h1>
          <div className="record-filters">
            <label>
              状态
              <select name="status" value={filters.status} onChange={change}>
                <option value="">全部</option>
                <option value="ongoing">未完成</option>
                <option value="done">已完成</option>
              </select>
            </label>
            <label>
              练习类型
              <select name="kind" value={filters.kind} onChange={change}>
                <option value="">全部</option>
                {TYPES.map(typeOption)}
              </select>
            </label>
            <label>
              产品
              <select
                name="product_id"
                value={filters.product_id}
                onChange={change}
              >
                <option value="">全部</option>
                {products.map(productOption)}
              </select>
            </label>
          </div>
          {filtered.length ? (
            filtered.map(renderRecord)
          ) : (
            <div className="empty">
              {page === "favorites"
                ? "还没有符合条件的收藏"
                : "还没有符合条件的练习记录"}
            </div>
          )}
        </div>
      );
    }
    if (active && ["prepare", "practice", "review"].includes(page)) {
      if (page === "prepare")
        return (
          <div className="page">
            <div className="section-head">
              <h1>{TYPES[active.kind]}</h1>
              <button
                className="button quiet"
                data-action="nav"
                data-id={"choose/" + active.kind}
                disabled={busy}
              >
                更换产品
              </button>
            </div>
            <section className="case-banner">
              <div className="person">
                <div className="avatar">{active.scenario.person?.[0]}</div>
                <div>
                  <h2>
                    与{active.scenario.person}沟通{selected?.category}方案
                  </h2>
                  <p className="small muted">
                    甲方 · {active.scenario.company} · {active.scenario.role}
                  </p>
                </div>
              </div>
              {details()}
              <div className="actions">
                <button
                  className="button"
                  data-action="materials"
                  disabled={busy}
                >
                  查看产品资料
                </button>
                <button
                  className="button primary"
                  data-action="start"
                  disabled={busy}
                >
                  开始练习
                </button>
              </div>
            </section>
          </div>
        );
      if (page === "practice")
        return (
          <>
            <header className="chat-toolbar">
              <div className="person">
                <div className="avatar">{active.scenario.person?.[0]}</div>
                <div>
                  <h2>{active.scenario.person}</h2>
                  <p className="muted small">
                    甲方 · {active.scenario.company} · {active.scenario.role}
                  </p>
                </div>
              </div>
              <div className="actions">
                <button
                  className="button"
                  data-action="materials"
                  disabled={busy}
                >
                  产品资料
                </button>
                <button className="button" data-action="task" disabled={busy}>
                  本次任务
                </button>
                <button
                  className={"button " + (coach ? "primary" : "")}
                  data-action="coach"
                  disabled={busy}
                >
                  问教练
                </button>
                <button
                  className="button danger"
                  data-action="finish"
                  disabled={busy}
                >
                  结束练习
                </button>
              </div>
            </header>
            {materials && <section className="materials">{details()}</section>}
            <div className={"chat-layout " + (coach ? "with-coach" : "")}>
              <section className="customer-pane" aria-label="客户聊天">
                {messages("customer")}
                {composer("customer")}
              </section>
              {coach && coachPanel()}
            </div>
          </>
        );
      return (
        <>
          <header className="chat-toolbar">
            <div>
              <h2>{active.name}</h2>
              <p className="small muted">
                {TYPES[active.kind]} · {selected?.name} ·{" "}
                {time(active.started_at)}
              </p>
            </div>
            <div className="actions">
              {favorite(active)}
              <button
                className="button"
                data-action="materials"
                disabled={busy}
              >
                产品资料
              </button>
              <button
                className="button primary"
                data-action="restart"
                disabled={busy}
              >
                重新练习
              </button>
            </div>
          </header>
          <div className="review-layout">
            <section className="review-transcript" aria-label="原始聊天记录">
              <header className="review-heading">
                <h3>原始聊天记录</h3>
              </header>
              {messages("customer")}
            </section>
            <section className="review-summary" aria-label="复盘总结">
              <header className="review-heading">
                <h3>复盘总结</h3>
              </header>
              <div className="report">
                {live?.agent === "review" ? (
                  <>
                    <p className="muted small" role="status">
                      {generationStatus}
                    </p>
                    <RichText text={live.text} />
                  </>
                ) : active.report ? (
                  <RichText text={active.report} />
                ) : (
                  <>
                    <p className="muted">
                      {active.last_error || "复盘尚未生成完成"}
                    </p>
                    <button
                      className="button primary"
                      data-action="retry-review"
                      disabled={busy}
                    >
                      生成复盘
                    </button>
                  </>
                )}
              </div>
            </section>
            {coachPanel(true)}
          </div>
        </>
      );
    }
    return <div className="page empty">请选择一个练习入口。</div>;
  }
  let title = "训练首页";
  if (page === "library" || page === "product") title = "项目资料";
  if (page === "history") title = "历史记录";
  if (page === "favorites") title = "收藏";
  if (["prepare", "practice", "review"].includes(page) && active)
    title = TYPES[active.kind];
  return (
    <div id="sales-app" onClick={action}>
      <div className="app">
        <aside className="rail">
          <div className="brand">
            <span className="brand-mark">
              <AudioLines size={20} />
            </span>
            销售陪练
          </div>
          <nav aria-label="主导航">
            <button
              className="nav-item"
              data-action="nav"
              data-id="home"
              aria-current={
                ["home", "choose", "prepare", "practice", "review"].includes(
                  page,
                )
                  ? "page"
                  : undefined
              }
              disabled={busy}
            >
              <LayoutGrid size={18} />
              训练首页
            </button>
            <button
              className="nav-item"
              data-action="nav"
              data-id="library"
              aria-current={
                ["library", "product"].includes(page) ? "page" : undefined
              }
              disabled={busy}
            >
              <FolderOpen size={18} />
              项目资料
            </button>
            <button
              className="nav-item"
              data-action="nav"
              data-id="history"
              aria-current={page === "history" ? "page" : undefined}
              disabled={busy}
            >
              <Clock3 size={18} />
              历史记录
            </button>
            <button
              className="nav-item"
              data-action="nav"
              data-id="favorites"
              aria-current={page === "favorites" ? "page" : undefined}
              disabled={busy}
            >
              <Star size={18} />
              收藏
            </button>
          </nav>
          <div className="rail-bottom">文字陪练</div>
        </aside>
        <main className="work">
          <header className="top">
            <div>
              <div className="crumb">销售训练</div>
              <div className="top-title">{title}</div>
            </div>
            {page === "practice" && (
              <button
                className="button quiet"
                data-action="nav"
                data-id="home"
                disabled={busy}
              >
                退出练习
              </button>
            )}
          </header>
          {health && !health.model_configured && (
            <div className="notice" role="status">
              请在后端 .env 中配置 DeepSeek API 密钥后开始练习。
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {content()}
        </main>
      </div>
      {(dialog || materialOpen) && (
        <div className="dialog-shade">
          <dialog
            open
            className={"dialog " + (materialOpen ? "material-dialog" : "")}
            aria-modal="true"
            aria-labelledby="dialog-title"
            onKeyDown={dialogKey}
          >
            {materialOpen ? (
              <>
                <header className="section-head">
                  <h2 id="dialog-title">{manual?.name}</h2>
                  <button
                    className="icon-button"
                    data-action="close"
                    aria-label="关闭产品资料"
                  >
                    <X size={20} />
                  </button>
                </header>
                <a
                  className="button"
                  href={manual?.demo_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看产品界面
                </a>
                <RichText
                  text={manual?.manual || ""}
                  product={manual || undefined}
                />
              </>
            ) : (
              <>
                <h2 id="dialog-title">
                  {dialog === "finish" ? "结束本次练习？" : "删除这条收藏？"}
                </h2>
                <p>
                  {dialog === "finish"
                    ? "确认后将结束本次客户沟通并进入复盘，对话记录会保留。"
                    : "这次练习将从收藏列表移除，历史记录仍会保留。"}
                </p>
                <div className="actions">
                  <button className="button" data-action="close">
                    取消
                  </button>
                  <button
                    className={
                      "button " + (dialog === "finish" ? "primary" : "danger")
                    }
                    data-action={
                      dialog === "finish" ? "confirm-finish" : "confirm-remove"
                    }
                  >
                    {dialog === "finish" ? "结束并复盘" : "删除收藏"}
                  </button>
                </div>
              </>
            )}
          </dialog>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
