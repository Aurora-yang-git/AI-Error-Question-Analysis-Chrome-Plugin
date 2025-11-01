# Supabase 配置说明

## 概述

本插件支持两种运行模式：

1. **本地模式**：无需 Supabase 配置，所有数据仅存储在浏览器本地
2. **云同步模式**：配置 Supabase 后，可以使用云端推荐分析和用户反馈功能

## 配置步骤（可选）

如果您想启用云同步功能，请按照以下步骤配置：

### 1. 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com/)
2. 创建一个新项目
3. 获取项目的 URL 和 anon key

### 2. 配置数据库表结构

在 Supabase SQL 编辑器中执行以下 SQL：

\`\`\`sql
-- 创建分析表
CREATE TABLE analyses (
  id BIGSERIAL PRIMARY KEY,
  url_hash TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  content TEXT,
  student_answer TEXT,
  correct_answer TEXT,
  misconception TEXT,
  knowledge_points JSONB,
  helpful_count INT DEFAULT 0,
  not_helpful_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建反馈表
CREATE TABLE feedback (
  id BIGSERIAL PRIMARY KEY,
  url_hash TEXT NOT NULL,
  user_id TEXT NOT NULL,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(url_hash, user_id)
);

-- 创建索引
CREATE INDEX idx_analyses_url_hash ON analyses(url_hash);
CREATE INDEX idx_feedback_url_hash ON feedback(url_hash);
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
\`\`\`

### 3. 配置插件

1. 复制 `supabase-config.example.js` 为 `supabase-config.js`：
   \`\`\`bash
   cp supabase-config.example.js supabase-config.js
   \`\`\`

2. 编辑 `supabase-config.js`，填入您的 Supabase 项目信息：
   \`\`\`javascript
   const SUPABASE_URL = '您的 Supabase URL';
   const SUPABASE_ANON_KEY = '您的 Supabase Anon Key';
   \`\`\`

3. 重新构建项目：
   \`\`\`bash
   npm run build
   \`\`\`

## 注意事项

- **安全性**：`supabase-config.js` 文件已被添加到 `.gitignore`，不会被提交到 Git
- **可选功能**：即使不配置 Supabase，插件的核心功能仍然可以正常使用
- **降级处理**：当 Supabase 不可用时，插件会自动降级到本地模式

## 功能对比

| 功能 | 本地模式 | 云同步模式 |
|------|---------|-----------|
| AI 分析题目 | ✅ | ✅ |
| 保存分析结果 | ✅ (本地) | ✅ (云端) |
| 查看历史记录 | ✅ (本地) | ✅ (本地+云端) |
| 推荐分析 | ❌ | ✅ |
| 用户反馈统计 | ❌ | ✅ |
| 跨设备同步 | ❌ | ✅ |

## 故障排除

如果遇到 Supabase 相关错误：

1. 检查 `supabase-config.js` 文件是否存在且配置正确
2. 检查 Supabase 项目是否正常运行
3. 检查数据库表是否已正确创建
4. 查看浏览器控制台的错误信息

如果问题仍然存在，插件会自动切换到本地模式继续工作。

