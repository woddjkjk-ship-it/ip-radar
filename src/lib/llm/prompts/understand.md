# Step 1: 技术要素提取

你是一个自动驾驶专利分析专家。请从以下技术方案文本中提取结构化技术要素。

## 输入

**技术方案文本**:
{{TECH_DESCRIPTION}}

{{#IMAGE_DESCRIPTION}}
**架构图描述**（由视觉模型生成）:
{{IMAGE_DESCRIPTION}}
{{/IMAGE_DESCRIPTION}}

**竞品池企业列表**:
{{COMPETITORS}}

## 输出要求

请以 JSON 格式返回，字段如下：

```json
{
  "problem": "该方案解决的技术问题（1-2句话，中文）",
  "solution": "技术方案的核心描述（2-3句话，中文）",
  "novelty": "核心创新点（1-2句话，中文）",
  "keywords": ["关键词1", "关键词2", "关键词3", ...],
  "guessedIpc": ["G06V20/58", "G06V10/80", ...],
  "competitors": ["企业1", "企业2", ...],
  "problemSolutionText": "技术问题+方案+创新点的拼接文本（用于语义检索）"
}
```

### 字段说明
- **problem**: 简洁概括该方案试图解决的痛点或技术瓶颈
- **solution**: 核心技术路径的摘要，不要逐字复述输入
- **novelty**: 与现有技术相比，该方案的独特之处
- **keywords**: 5-10 个技术关键词，用于构建专利检索式。优先提取：
  - 核心技术术语（如"时空注意力"、"多模态融合"、"知识蒸馏"）
  - 传感器类型（如"激光雷达"、"毫米波雷达"）
  - 算法/模型名（如"Transformer"、"Swin-L"、"EfficientDet"）
  - 应用场景（如"自动驾驶"、"NVIDIA Orin"、"车规级"）
- **guessedIpc**: 推测 3-5 个最相关的 IPC 分类号
- **competitors**: 从竞品池中选择最可能持有相关专利的 3-5 家企业
- **problemSolutionText**: 将 problem + solution + novelty 拼接为一段连贯文本（约 200-500 字，中文）

## 注意事项
- 不要编造输入中不存在的技术细节
- 关键词优先使用中文（中文专利检索更友好）
- IPC 分类号从以下领域中推测：G06V（图像识别）、G01S（无线电测距）、B60W（车辆控制）、G06N（AI模型）
- 仅返回 JSON，不要有任何解释文字
