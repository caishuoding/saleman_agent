# 虚构 CRM 产品资料的官方参考

核查日期为 2026-11-12。本文供编写“云序 CRM”训练资料使用，记录 Salesforce Sales Cloud、HubSpot CRM / Sales Hub 和 Zoho CRM 的公开产品事实。各厂商能力与限制以对应官方文档为准。

## 已核实的真实产品事实

| 主题 | 官方资料支持的事实 | 来源 |
| --- | --- | --- |
| 客户与联系人 | Salesforce 将企业客户、联系人及商机作为相互关联的记录。线索经过资格确认后可以转换为这些记录，具体资格标准由企业业务流程决定。 | [Salesforce 客户、联系人、线索与商机](https://trailhead.salesforce.com/content/learn/modules/sales-cloud-configuration-basics/customize-sales-cloud)、[Salesforce 线索转换](https://trailhead.salesforce.com/content/learn/modules/prospect-tracking-with-salesforce-leads-quick-look/track-prospects-with-salesforce-leads) |
| 商机阶段 | HubSpot 使用阶段展示业务进展，商机管道用于跟踪交易。创建和调整管道或阶段需要对应权限，部分对象和能力受订阅限制。 | [HubSpot 管道与阶段设置](https://knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines) |
| 跟进任务 | HubSpot 任务可以关联联系人、公司或交易，并记录任务类型、负责人、优先级、到期日期和提醒。部分能力需要相应席位或订阅。 | [HubSpot 创建任务](https://knowledge.hubspot.com/tasks/create-tasks) |
| 报表 | HubSpot 自定义报表可分析对象与活动，也提供漏斗分析。创建报表需要对应权限，报表种类与数量受订阅限制。 | [HubSpot 自定义报表](https://knowledge.hubspot.com/reports/create-custom-reports) |
| 数据访问 | Zoho 将记录可见范围与功能操作权限分别管理，角色层级影响数据可见范围，权限配置影响用户能执行的操作。管理员与普通用户的权限不同。 | [Zoho 初始设置与角色配置](https://help.zoho.com/portal/en/kb/crm/getting-started/articles/admin-quick-start) |
| 操作权限 | Zoho 支持针对模块配置查看、新建、编辑、删除权限，并单独控制导入、导出及报表相关操作。某些高级操作依赖先具备基础权限。 | [Zoho 权限配置](https://help.zoho.com/portal/en/kb/crm/security-control/profile-management/articles/manage-profile-permissions) |
| 导入准备 | HubSpot 表格导入有格式、表头、编码及技术限制。导入多种对象时需要处理对象间关联，导入记录或活动需要对应权限，已有邮件、会议、备注和任务不能通过导入直接更新。 | [HubSpot 导入文件要求](https://knowledge.hubspot.com/import-and-export/set-up-your-import-file)、[HubSpot 多对象导入](https://knowledge.hubspot.com/import-and-export/import-objects) |
| 导入范围 | Zoho 支持表格与 CSV 等格式，批次数量和部分格式额度受版本约束。通用导入工具有对象范围限制，不能把所有类型的数据一律按同一方式导入。 | [Zoho 数据导入](https://help.zoho.com/portal/en/kb/crm/data-administration/import-data/articles/import-data) |
| 导出 | Zoho 支持模块数据导出、备份和报表导出。模块导出需要对应权限，文件格式、单次记录数和每日次数存在限制。 | [Zoho 数据导出](https://help.zoho.com/portal/en/kb/crm/data-administration/export-data/articles/export-crm-data) |

## 产品操作与界面参考补充

以下五个官方帮助页用于细化同一产品范围内的字段、页面和操作，核查日期同为 2026-11-12。界面的视觉样式、业务样例、字段必填规则和提示文案仍由云序 CRM 自行设计。

| 界面主题 | 已核实的具体事实 | 来源 |
| --- | --- | --- |
| 商机列表与详情 | Zoho 商机列表及阶段视图可展示名称、金额、客户、预计成交日、负责人和未完成活动。详情可快捷更新阶段及成交日，关联活动、联系人、备注、附件和阶段历史。选择成交阶段时会核对金额及日期，流失阶段可填写流失原因。字段是否可见、可编辑受业务配置和字段权限影响。 | [Zoho 创建和管理商机](https://help.zoho.com/portal/en/kb/crm/sales-force-automation/deal-management/articles/create-deals) |
| 客户详情 | Zoho 客户详情聚合联系人、商机、活动、备注及附件，提供概览和时间线视图，也可从客户页新增关联联系人、任务及其他记录。创建客户需要对应模块创建权限。 | [Zoho 客户详情与关联记录](https://help.zoho.com/portal/en/kb/crm/sales-force-automation/accounts/articles/create-accounts) |
| 导入字段映射 | HubSpot 导入会将文件列匹配到对象字段，用户需要确认映射。唯一标识用于更新记录、防止重复和建立关联。单对象文件中每行代表一条记录，多对象文件中的一行可表示相互关联的记录。预览映射发现的错误并不等于整份文件已通过校验。 | [HubSpot 导入工具与字段映射](https://knowledge.hubspot.com/import-and-export/understand-the-import-tool) |
| 导入结果及错误行 | HubSpot 导入结果包含行数、新建和更新数量，并可查看错误涉及的行列、下载错误文件。某些错误导致整行未导入，另一些只使字段为空或记录未关联。修正后可重新导入或更新受影响记录。必填字段缺失、日期格式、无效负责人和关联标识均可能影响结果。 | [HubSpot 导入错误排查](https://knowledge.hubspot.com/import-and-export/troubleshoot-import-errors) |
| 任务管理 | HubSpot 任务列表支持筛选后编辑任务，也可在客户等关联记录中编辑任务。单条编辑在面板中保存，批量编辑会把同一字段值应用到选中任务。编辑与删除需要任务编辑权限，删除有确认步骤。任务的负责人、到期时间和提醒字段见前文创建任务来源。 | [HubSpot 编辑与删除任务](https://knowledge.hubspot.com/tasks/edit-or-delete-tasks) |

用于云序 CRM 演示的具体取舍可以是以下内容。

- 商机详情展示金额、阶段、预计成交日、关联客户、联系人、负责人及下一步行动。阶段更新后，同一条记录的列表和看板应展示一致值。流失原因的必填规则采用云序 CRM 自己的产品设定。
- 客户详情中的联系人、商机、跟进与任务应有可辨认的关联关系。新增关联记录后，客户页与对应模块应能查看到同一结果。
- 导入步骤可沿用上传、字段映射、校验预览、执行和查看结果的常见流程。正式导入前的预览校验和导入后的结果需要分别展示。失败时应说明错误发生在整行、字段还是关联，避免把“创建了记录”当作“所有资料都导入成功”。
- 任务完成、延期和删除应改变同一任务记录的状态。记录跟进摘要与完成任务是不同操作，页面文案应写明实际发生的动作。

## 用于虚构产品的设计取舍

下列内容是依据上述事实提出的训练产品设计建议。

- 基础功能可覆盖线索、企业客户、联系人、商机、跟进任务、权限和标准报表。它们能支撑需求沟通与方案介绍、商务谈判与合作推进两个专项。
- 手册应具体描述一条销售工作流程，例如登记线索、确认需求、关联企业与联系人、创建商机、维护阶段与下一步任务，让学员理解各功能怎样配合。
- 任务提醒应说明触发条件与通知渠道。能创建待办和提醒，不等于自动替销售完成沟通。
- 权限应同时交代谁能看见哪些记录、谁能执行修改或导出等动作。可把普通销售、主管和管理员设为三个示例角色，具体名称及权限属于虚构设定。
- 标准报表可设为线索来源、商机阶段分布、预计金额、赢单与丢单、逾期跟进。统计口径需要在虚构产品中明确定义，资料完整性会影响报表的解释。
- 表格迁移应写清对象范围、字段映射、唯一标识、重复记录处理、关联关系及失败行处理。复杂历史邮件、附件和外部系统数据可列为另行评估的迁移服务。
- 为功能套餐明确能力边界。高级自动化、第三方系统对接、复杂报表和定制实施可以采用单独评估或增值能力的虚构设定。
- 交付方式可安排需求确认、基础配置、数据准备、试导入、试用、培训和验收。周期与验收条件需要自洽地编定。

## 编写时的事实边界

“云序 CRM”的名称、厂商、定价、套餐数量、起订账号数、存储额度、实施周期、折扣权限、服务时间及客户故事均由本项目虚构。上述参考页面不为这些数值和条款背书。

真实资料的功能结构可为虚构设计提供依据。最终手册需要自行确定功能组合及限制，并写出统一的产品事实，避免把多个真实厂商的不同版本能力混成无条件提供的承诺。

收益可描述为减少信息分散、方便交接、帮助负责人了解进展。量化收益、实际客户评价、认证资质和法律合规结论需要独立证据，当前参考资料不用于编造这些背书。
