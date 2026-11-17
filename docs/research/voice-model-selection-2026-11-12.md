# 中文销售陪练语音模型选型调研

核查日期为 2026-11-12。本文采用官方公开文档，价格以人民币、中国大陆可用地域为口径。中文效果、实际网络延迟和专项提示词服从度尚未进行真实调用实测。

## 实时语音候选

### 阿里云 Qwen-Audio 3.1 Realtime Flash

`qwen-audio-3.1-realtime-flash` 已有正式 API 文档。北京地域单价如下，单位均为元／百万 Token。文本与音频同时输出时，输出侧仅收音频费用。文本上下文上限为 262,144 Token，音频历史最多 50 轮、累计 300 秒。长陪练需要独立保存逐轮转写，并管理超出音频历史窗口的已确认事实。[官方模型信息](https://help.aliyun.com/en/model-studio/qwen-audio-3-1-realtime-flash)

| 文本输入 | 音频输入 | 纯文本输出 | 音频输出 |
| --- | --- | --- | --- |
| 1.5 | 6 | 4.5 | 12 |

支持 WebSocket、WebRTC 和 AOQ，支持中文、流式双向语音与文字输出。可选择声学判停、语义判停或按键说话模式，语义判停可过滤部分附和声。新用户讲话可触发打断，应用需要同步清空尚未播放的音频。官方文档提供了相关示例。[官方使用指南](https://help.aliyun.com/en/model-studio/qwen-audio-realtime-user-guides)

通过会话级 `instructions` 配置采购方身份与专项边界。输入支持中文转写配置，可读取用户转写及模型回复文本，适合接入练习中的训练教练与结束后的复盘。[客户端事件文档](https://help.aliyun.com/en/model-studio/fun-audiochat-client-events)

### 阿里云 Qwen3.8 Omni Flash Realtime

`qwen3.8-omni-flash-realtime` 支持北京地域实时音视频交互。北京文本／图片／视频输入为 1.5 元、音频输入为 6 元、文本输出为 4.5 元、音频输出为 12 元，均按百万 Token 计。语音及伴随文本会分别收取输出费用。其输入上下文上限为 196,608 Token，音频历史最多 100 轮、累计 600 秒。北京提供 100 万 Token 免费额度，自开通、模型发布或申请通过的较晚日期起有效 90 天。[官方模型信息](https://help.aliyun.com/en/model-studio/qwen3-8-omni-flash-realtime)

官方实时接入文档展示了用户输入转写与模型输出转写事件，支持按需启用输入转写。文档建议客服或商务场景使用 `semantic_vad_ec`，增强插话时的打断响应。该建议属于厂商说明，实际效果需要在学员设备与网络上验证。[官方实时指南](https://help.aliyun.com/en/model-studio/realtime)

### 火山引擎豆包实时语音 3.0 Seeduplex

最新全双工 API 使用 `session.model = "1.2.6.1"`，通过 WebSocket 接入，并提供浏览器体验 Demo。支持会话级 `instructions`，系统词、内部提示、历史与工具结果合计上限 64K Token。用户转写、模型回复文本、音频及用量均有事件返回。需要按实际播放进度管理被打断内容，保持客户与教练记录一致。[官方全双工 API](https://docs.volcengine.com/docs/doubao-voice/end-to-end-real-time-voice-full-duplex-version?lang=zh)

旧接口同时列出 O2.0 与 SC2.0。O2.0 使用 `system_role` 等配置，SC2.0 使用 `character_manifest` 进行角色控制，二者文档所示上下文均为 12K。新项目评估应同时确认所用端点和协议版本。[官方旧接口与版本说明](https://docs.volcengine.com/docs/doubao-voice/end-to-endreal-time-speech-large-model-api-access-document?lang=en)

豆包语音计费页按“豆包实时语音大模型”列音频输入 80 元、音频输出 300 元，单位为百万 Token，输入缓存价为 5 元。该页将输入音频按约 6.25 Token／秒、输出约 25 Token／秒折算。文本输入、文本输出、上下文及语音识别回传文本另有计量。免费额度抵扣与实际单价需核对账号控制台。公开表格的文本输出单价为 80 元，计算示例却采用 30 元，存在页面内部冲突。[官方计费说明](https://docs.volcengine.com/docs/doubao-voice/billing-instructions?lang=zh)

上述计费页未对 Seeduplex 3.0 单列价格。应在采购前确认 `1.2.6.1` 实际账单对应的计费项。端到端语音支持按量后付费，计费概览列明不支持资源包抵扣。通过 RTC 产品组合接入时，还需核对音视频传输等附加费用。[官方计费概览](https://docs.volcengine.com/docs/doubao-voice/billing-overview?lang=zh)

## 10 分钟陪练的费用口径

统一示例为学员说 5 分钟、客户说 5 分钟，总对话时长 10 分钟。以下计算只说明语音推理部分，文字、历史上下文、网络传输、教练与复盘调用还需累加。

阿里实时语音计费文档统一按每秒 12.5 个音频 Token 折算。用户音频、文本与系统词会在后续轮次重新计入输入，模型生成的音频只在输出时收费。因此新音频费用与整场实际账单需要分别估算。[官方语音对话计费规则](https://help.aliyun.com/zh/model-studio/model-pricing)

按 Qwen-Audio 3.1 Realtime Flash 的北京价格推算，新增音频输入费用为 `300 × 12.5 × 6 ÷ 1,000,000 = 0.0225` 元，输出费用为 `300 × 12.5 × 12 ÷ 1,000,000 = 0.045` 元，合计 0.0675 元。若具体为 10 轮、每轮双方各说 30 秒，且每轮携带全部此前用户音频，累计音频输入为 20,625 Token，输入与输出音频合计约 0.16875 元，另加文本与系统词。此为依据官方规则的算例，实际以 `usage` 和账单为准。[官方模型价格](https://help.aliyun.com/en/model-studio/qwen-audio-3-1-realtime-flash)

按豆包公开音频折算与费率计算，新增音频输入约 0.15 元，输出约 2.25 元，合计约 2.40 元。文字、上下文费用及具体 Seeduplex 计费项另行核对。[官方计费说明](https://docs.volcengine.com/docs/doubao-voice/billing-instructions?lang=zh)

### 智谱 GLM-Realtime

官方提供 `glm-realtime-flash` 和 `glm-realtime-air`，音频通话分别为 0.18 元／分钟和 0.30 元／分钟。按公开单价计算，10 分钟分别为 1.80 元和 3.00 元。支持系统指令、服务端语音检测与自动打断，并提供用户转写和回复转写事件。文档列出的音频上下文为 8K、约 20 轮，长陪练需关注历史记忆容量。可以作为按分钟计费的备选。[官方模型与 API 文档](https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-realtime)

## 复用现有文本模型的语音方案

语音识别将学员语音转为文字，现有 DeepSeek 客户生成回复，语音合成再将回复转为音频。根据当前代码结构推断，这种接法便于复用专项提示词、训练教练、持久化记录及上下文压缩。端到端延迟由多个服务和网络传输共同决定，打断还需要应用取消生成、停止播放并同步对话记录。

### 阿里识别与合成

北京地域 `qwen3-asr-flash-realtime` 为 0.00033 元／秒，折合 0.0198 元／分钟。该模型输出为文字，可以通过 WebSocket 接入。[官方识别模型信息](https://help.aliyun.com/zh/model-studio/qwen3-asr-flash-realtime)

北京地域 `cosyvoice-v3-flash` 为 1 元／万计费字符，支持系统音色。`cosyvoice-v3.5-flash` 为 0.8 元／万计费字符，需使用设计或复刻音色。阿里当前按字符收费的语音合成采用一个汉字计两个字符、其他字符通常计一个的规则。[官方价格及计费字符规则](https://help.aliyun.com/zh/model-studio/model-pricing) [官方音色支持范围](https://help.aliyun.com/zh/model-studio/tts-model)

低延迟合成还可试用 `qwen-audio-3.1-tts-flash`，官方将其列为实时对话场景的推荐模型，支持分段输入文字与流式输出音频。它按输入文本 Token 和输出音频 Token 计费，和按字符计费的 CosyVoice 需根据同一语料的实际用量比较。[官方合成选型说明](https://help.aliyun.com/zh/model-studio/tts-model)

在一个明确用量的算例中，累计上传音频 10 分钟，客户回复共 1,500 个汉字，忽略标点，使用 `qwen3-asr-flash-realtime` 与 `cosyvoice-v3-flash` 时，识别为 `600 × 0.00033 = 0.198` 元，合成为 `1500 × 2 ÷ 10000 × 1 = 0.30` 元，语音部分合计约 0.498 元，再累加 DeepSeek 客户、教练和复盘费用。上传音频时长按实际发送量统计，可能包含静音，此算例没有假定学员仅上传说话片段。[官方识别价格](https://help.aliyun.com/zh/model-studio/qwen3-asr-flash-realtime) [官方合成计费](https://help.aliyun.com/zh/model-studio/model-pricing)

### MiniMax Speech 2.8

`speech-2.8-turbo` 是语音合成组件，可以接在 DeepSeek 回复之后，通过 WebSocket 按句输入文本并流式返回音频。声音风格和中文听感可以与 CosyVoice 一起试听。[官方流式合成 API](https://platform.minimax.cn/docs/api-reference/speech-t2a-websocket)

国内官方按量价为 Turbo 2 元／万计费字符、HD 3.5 元／万计费字符。一个汉字计两个字符，所以纯中文约折合 4 元／万汉字和 7 元／万汉字，标点等另计。以上述 1,500 汉字为例，Turbo 合成部分为 0.60 元，HD 为 1.05 元，识别和文本模型另外计费。音色设计和快速复刻均为 9.9 元／音色，首次用于合成时计费，使用系统音色可按其合成用量计费。语音套餐起步为 Turbo 360 元／月、HD 630 元／月，额度到期清零。[官方人民币价格与字符规则](https://platform.minimax.cn/docs/pricing/overview)

## 腾讯云托管实时对话

TRTC AI 实时对话可以组合语音识别、文本模型、语音合成和音频通话。官方 AI 对话服务费为 0.01 元／分钟，还要累加音频通话、识别、合成及自购文本模型费用。其计费页的双端音频通话示例按 `0.007 × 分钟 × 2` 计算。它适合希望托管实时音频链路的场景，预算应按整条链路汇总。[官方实时对话费用](https://cloud.tencent.com/document/product/647/115755)

2026-09-01 起的新用户 AI 智能语音页面列实时识别 0.017 元／分钟，合成基础档为 3 元／万字符。实时对话旧示例仍使用旧识别单价，采购时需按实际开通版本合计费用。[官方新用户智能语音计费](https://cloud.tencent.com.cn/document/product/647/137853)

## 当前建议

优先把 Qwen-Audio 3.1 Realtime Flash 放入实时语音试用名单，结合相同销售案例测试中文自然度、打断与专项边界。豆包 Seeduplex 适合进入同一轮体验对照，重点观察客户语气与插话，同时确认 3.0 账单口径。以上顺序基于公开能力和计费文档作出，实际质量排名需以统一用例实测确定。

项目现有训练教练可继续基于持久化的文字记录工作。语音客户端需要保存用户最终转写、客户实际播报内容及打断位置，便于练习中求助与复盘读取可靠上下文。这是结合当前项目流程作出的集成建议。

若优先复用现有客户 Agent 的提示词和记忆，可以同时评估“阿里实时识别 + DeepSeek + CosyVoice v3 Flash”。MiniMax Turbo 可以替换语音合成环节进行音色对照。若优先体验直接语音对话，首轮比较 Qwen-Audio 3.1 Realtime Flash 和豆包 Seeduplex 3.0。该选择基于项目适配性与公开成本口径，最终采购仍应使用同一案例实测后确定。

## 同场试听应覆盖的场景

- 需求专项中，学员主动问预算或报价，观察客户是否遵守当前系统提示词的讨论范围。
- 商务专项连续商议付款、交付和服务条款，检查前后信息一致性。
- 学员说“嗯”“我想一下”或在句中短暂停顿，检查误打断与抢话。
- 客户播报到一半被打断，核对实际听到的内容与记录中保存的内容。
- 连续练习 20 分钟，检查历史事实、文字转写和训练教练读取的记录。

记录首音延迟、被打断后停止播放的时延、金额及产品术语识别错误、专项越界次数，以及每场完整账单。这些数据可支持后续选型，当前报告采用公开文档与明示假设的算例。
