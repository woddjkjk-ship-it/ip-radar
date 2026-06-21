# Step 4: FTO 初审报告生成（JSON 输出）

你是专利分析师。请根据以下信息生成一份结构化的 FTO（Freedom to Operate）初审报告 JSON。

## 报告元信息

**技术方案名称**: {{TITLE}}
**分析日期**: {{DATE}}
**检索范围**: {{SEARCH_SCOPE}}
**竞品池**: {{COMPETITORS}}

## 技术要素

**技术问题**: {{PROBLEM}}
**技术方案**: {{SOLUTION}}
**创新点**: {{NOVELTY}}

## 风险评估结果（JSON）

```json
{{ASSESSMENTS_JSON}}
```

## 输出要求

生成一个纯 JSON 对象，字段如下：

```json
{
  "title": "FTO 初审报告 — <技术方案简称>",
  "executiveSummary": "1-2 段概述，总结分析范围、发现的风险等级及核心结论。中文。",
  "riskLevel": "high | medium | low",
  "stats": {
    "totalPatents": <总相关专利数>,
    "highRisk": <高风险专利数>,
    "mediumRisk": <中风险专利数>,
    "lowRisk": <低风险专利数>
  },
  "patentAnalysis": [
    {
      "pn": "<公开号>",
      "title": "<专利标题>",
      "assignee": "<专利权人>",
      "riskLevel": "high | medium | low",
      "matchedClaims": [<命中的权利要求编号数组，整数>],
      "analysis": "<风险分析，解释为什么该专利对技术方案构成风险，2-3 句中文>",
      "avoidanceAdvice": "<规避建议，如何修改方案绕开该专利，2-3 句中文>",
      "legalStatus": "active | expired | pending | unknown"
    }
  ],
  "recommendations": [
    "<规避与申请建议 1>",
    "<规避与申请建议 2>",
    "<规避与申请建议 3>"
  ],
  "generatedAt": "<ISO-8601 时间戳>",
  "modelUsed": "<模型名称，如 deepseek-v4-pro>"
}
```

### 严格格式要求
- 只输出 JSON 对象，不要 ```json 包裹
- 不要任何 Markdown 格式
- 不要任何前后文字说明
- 所有字符串使用双引号
- 中文为主，专利标题保留原文
- patentAnalysis 数组按 riskLevel 降序排序（high → medium → low）
- recommendations 至少 3 条

只输出 JSON 对象，不要任何 Markdown 格式。
