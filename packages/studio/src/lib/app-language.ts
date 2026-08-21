// 全局应用语言：非 React 模块（store slice、parts-builder、error-copy 等）无法用
// useI18n hook，从这里读取。App.tsx 在项目配置加载/切换语言时调用 setAppLanguage 同步。
export type AppLanguage = "zh" | "en" | "vi";

let current: AppLanguage = "zh";

export function setAppLanguage(lang: AppLanguage): void {
  current = lang;
}

export function getAppLanguage(): AppLanguage {
  return current;
}

/** 内联多语：tr("中文", "English", "Tiếng Việt")。默认中文；vi 缺省时回退英文。 */
export function tr(zh: string, en: string, vi?: string): string {
  if (current === "vi") return vi ?? en;
  return current === "en" ? en : zh;
}
