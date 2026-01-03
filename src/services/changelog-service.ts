// Changelog data service for What's New dialog

export interface ChangelogContent {
  added?: string[];
  changed?: string[];
  fixed?: string[];
  removed?: string[];
  security?: string[];
  deprecated?: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  en: ChangelogContent;
  zh: ChangelogContent;
}

// Changelog data - update this when releasing new versions
// Only include the most recent versions that users care about
export const CHANGELOG_DATA: ChangelogEntry[] = [
  {
    version: '0.2.3',
    date: '2026-01-03',
    en: {
      added: [
        'New usage statistics page to view usage for Claude subscription, OpenAI subscription, GitHub Copilot subscription, and Zhipu Coding Plan.',
        'Added OpenCode Zen free provider for free GLM-4.7 model usage, now supporting 9 completely free usage methods.',
        'Support for one-click import of Agent Skills from GitHub repositories.',
        'macOS Dock Menu support for quickly opening recent projects and creating new windows.',
        'New Vue syntax highlighting and LSP support for a better Vue project development experience.',
      ],
      changed: [
        'Improved Plan Agent execution logic.',
        'Refactored Skills to Agent Skills Specification for better standardization of agents.',
        'Optimized call-agent-tool timeout handling mechanism.',
      ],
      fixed: ['Resolved Chinese input method compatibility issues on Linux.'],
    },
    zh: {
      added: [
        '新增使用量统计页面，可查看 Claude 订阅、OpenAI 订阅、GitHub Copilot 订阅、智谱 Coding Plan 的使用情况',
        '新增 OpenCode Zen 免费提供商，可以免费使用 GLM-4.7 模型，目前共支持 9 种完全免费的使用方式',
        '支持一键导入 Github 仓库的 Agent Skills',
        '支持快速打开最近的项目和新建窗口，提升 macOS 用户的使用体验',
        '新增 Vue 语法高亮和 LSP 支持，提供更好的 Vue 项目开发体验',
      ],
      changed: [
        '改进 Plan Agent 的执行逻辑',
        '将 Skills 重构为 Agent Skills Specification，提升智能体的标准化程度',
        '优化 call-agent-tool 的超时处理机制',
      ],
      fixed: ['解决 Linux 平台中文输入法的兼容性问题'],
    },
  },
];

export function getChangelogForVersion(version: string): ChangelogEntry | undefined {
  return CHANGELOG_DATA.find((entry) => entry.version === version);
}

export function getLatestChangelog(): ChangelogEntry | undefined {
  return CHANGELOG_DATA[0];
}
