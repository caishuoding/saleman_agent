# 本地任务跟踪

需求和开发任务保存在 `.scratch/`。

## 文件约定

- 每个功能使用 `.scratch/<feature>/` 目录。
- 功能规格保存在 `spec.md`。
- 每张开发任务单独保存为 `issues/<NN>-<slug>.md`，从 01 编号。
- 任务文件顶部使用 `Status:` 记录分流状态，取值见 `triage-labels.md`。
- 讨论记录追加在文件末尾的 `## Comments` 下。

技能要求发布任务时，在对应功能目录创建文件。
技能要求读取任务时，读取用户指定路径或编号对应的文件。

## Wayfinder 约定

- 工作地图保存在 `.scratch/<effort>/map.md`。
- 子任务保存在 `issues/<NN>-<slug>.md`。
- 使用 `Type:` 标记 research、prototype、grilling 或 task。
- 使用 `Status:` 标记 claimed 或 resolved，领取前为开放状态。
- 使用 `Blocked by:` 记录依赖任务编号。
- 选择依赖均已解决、开放且未领取的任务，按编号顺序处理。
- 开始工作前将状态设为 claimed。
- 完成后在 `## Answer` 下记录答案，将状态设为 resolved，并更新地图中的结论与文件链接。
