# UI设计参考全量审查（DESIGN-*.md）

- 审查文件数: **58**
- 风格分布: light **9**, dark **7**, mixed **42**
- 结论: 多数文件在“克制排版 + 明确层级 + 高可读性”上高度一致，主要差异在明暗基调和强调色。

## 文件清单摘要

| 文件 | 名称 | 视觉基调 | 颜色数 | 关键词 |
|---|---|---:|---:|---|
| DESIGN-airbnb.md | Airbnb-design-analysis | mixed | 19 | card |
| DESIGN-airtable.md | Airtable-design-analysis | mixed | 23 | editorial, bold, workflow, card, dark |
| DESIGN-apple.md | Apple-design-analysis | mixed | 17 | dark, light |
| DESIGN-bmw.md | BMW-design-analysis | mixed | 22 | card, dark, light |
| DESIGN-cal.md | Cal.com-design-analysis | mixed | 21 | card, dark |
| DESIGN-claude.md | Claude-design-analysis | mixed | 23 | editorial, card, dark |
| DESIGN-clay.md | Clay-design-analysis | mixed | 26 | data, card, dark |
| DESIGN-clickhouse.md | ClickHouse-design-analysis | mixed | 18 | data, card, dark |
| DESIGN-cohere.md | Cohere-design-analysis | mixed | 21 | editorial, card |
| DESIGN-coinbase.md | Coinbase-design-analysis | mixed | 15 | editorial, minimal, card, dark |
| DESIGN-composio.md | Composio-design-analysis | dark | 18 | technical, card, dark, light |
| DESIGN-cursor.md | Cursor-design-analysis | light | 19 | editorial, minimal, bold, card, dark |
| DESIGN-elevenlabs.md | ElevenLabs-design-analysis | light | 19 | editorial, dark, light |
| DESIGN-expo.md | Expo-design-analysis | light | 21 | editorial, minimal |
| DESIGN-ferrari.md | Ferrari-design-analysis | mixed | 17 | editorial, luxury, light |
| DESIGN-figma.md | Figma-design-analysis | light | 14 | editorial, technical |
| DESIGN-framer.md | Framer-design-analysis | dark | 14 | card, dark, light |
| DESIGN-hashicorp.md | HashiCorp-design-analysis | dark | 22 | technical, card |
| DESIGN-ibm.md | IBM-design-analysis | mixed | 15 | card, light |
| DESIGN-intercom.md | Intercom-design-analysis | mixed | 19 | editorial, minimal, card |
| DESIGN-kraken.md | kraken | mixed | 0 | - |
| DESIGN-lamborghini.md | lamborghini | mixed | 0 | - |
| DESIGN-linear.app.md | Linear-design-analysis | dark | 21 | technical, card, dark, light |
| DESIGN-lovable.md | lovable | mixed | 0 | - |
| DESIGN-minimax.md | MiniMax-design-analysis | mixed | 24 | bold, card |
| DESIGN-mintlify.md | Mintlify-design-analysis | mixed | 26 | dark |
| DESIGN-miro.md | Miro-design-analysis | light | 34 | playful, workflow |
| DESIGN-mistral.ai.md | Mistral AI-design-analysis | light | 26 | - |
| DESIGN-mongodb.md | MongoDB-design-analysis | mixed | 26 | card, dark |
| DESIGN-notion.md | Notion-design-analysis | mixed | 42 | data, card |
| DESIGN-nvidia.md | NVIDIA-design-analysis | mixed | 22 | - |
| DESIGN-ollama.md | Ollama-design-analysis | mixed | 13 | - |
| DESIGN-opencode.ai.md | OpenCode-design-analysis | dark | 20 | - |
| DESIGN-pinterest.md | Pinterest-design-analysis | mixed | 21 | - |
| DESIGN-posthog.md | PostHog-design-analysis | light | 25 | - |
| DESIGN-raycast.md | Raycast-design-analysis | mixed | 21 | - |
| DESIGN-renault.md | Renault-design-analysis | light | 17 | - |
| DESIGN-replicate.md | Replicate-design-analysis | mixed | 17 | - |
| DESIGN-resend.md | Resend-design-analysis | mixed | 14 | - |
| DESIGN-revolut.md | Revolut-design-analysis | dark | 27 | - |
| DESIGN-runwayml.md | Runwai-design-analysis | mixed | 14 | editorial |
| DESIGN-sanity.md | Saniti-design-analysis | mixed | 15 | editorial, technical, dark, light |
| DESIGN-sentry.md | Sentri-design-analysis | mixed | 17 | playful, dark, light |
| DESIGN-spacex.md | Spasex-design-analysis | mixed | 8 | minimal |
| DESIGN-spotify.md | spotify | mixed | 0 | - |
| DESIGN-stripe.md | Stripi-design-analysis | mixed | 19 | editorial, card, dark |
| DESIGN-supabase.md | Supabaze-design-analysis | mixed | 25 | minimal, technical, data |
| DESIGN-superhuman.md | Superhumon-design-analysis | mixed | 14 | editorial, dark |
| DESIGN-tesla.md | tesla | mixed | 0 | - |
| DESIGN-together.ai.md | Together AI-design-analysis | mixed | 9 | - |
| DESIGN-uber.md | Uber-design-analysis | mixed | 10 | editorial |
| DESIGN-vercel.md | Vercel-design-analysis | mixed | 30 | technical |
| DESIGN-voltagent.md | Voltagent-design-analysis | light | 12 | card, dark |
| DESIGN-warp.md | Warp-design-analysis | mixed | 7 | - |
| DESIGN-webflow.md | Webflow-design-analysis | dark | 17 | - |
| DESIGN-wise.md | Wise-design-analysis | mixed | 21 | card |
| DESIGN-x.ai.md | xAI-design-analysis | mixed | 15 | - |
| DESIGN-zapier.md | Zapier-design-analysis | mixed | 9 | workflow |

## 共性设计规则（全量抽取）

1. 登录页以单一主任务为核心：账号输入 + 主按钮，避免干扰。
2. 层级稳定：标题、说明、表单、状态反馈应可快速扫描。
3. 主按钮强对比，次按钮弱化，不能多个同级主操作并列。
4. 细线边框体系 + 8-16px 圆角是高频共性。
5. 装饰应低干扰，不影响可读性和输入效率。
6. 状态语义必须固定：success/warn/error 信息块可见。
