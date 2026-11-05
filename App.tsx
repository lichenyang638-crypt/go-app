import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { Calendar } from 'react-native-calendars';
import { StatusBar } from 'expo-status-bar';
import {
  type ComponentRef,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

/* -------------------------------------------------------------------------- */
/*                                   常量                                     */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = '@growth-app/records/v1';
/** 用户自定义的「专业课学习方式」标签 */
const CUSTOM_METHODS_STORAGE_KEY = '@growth-app/custom_methods';
/** 用户自定义的「拓展技能学习方式」标签 */
const CUSTOM_SKILL_METHODS_STORAGE_KEY = '@growth-app/custom_skill_methods';
/** 用户自定义的「英语学习方式」标签 */
const CUSTOM_ENGLISH_METHODS_STORAGE_KEY = '@growth-app/custom_english_methods';
/** 用户自定义的「健身动作」标签 */
const CUSTOM_FITNESS_ACTIONS_STORAGE_KEY = '@growth-app/custom_fitness_actions';
/** 用户自定义的「理财类别」标签 */
const CUSTOM_FINANCE_STORAGE_KEY = '@growth-app/custom_finance';

const H_PADDING = 20; // 页面左右留白
const CARD_GAP = 12; // 卡片间距
const CHIP_GAP = 10; // 分类按钮间距

const COLORS = {
  background: '#F4F6FA',
  card: '#FFFFFF',
  primary: '#3B6EF6',
  primaryPressed: '#2F5AD0',
  primaryDisabled: '#C6D5F9',
  text: '#181C27',
  subText: '#5A6273',
  muted: '#7B8395',
  faint: '#B4BAC7',
  border: '#E7EBF3',
  danger: '#D64545',
  chipDot: '#CBD2E0',
};

/** 表单输入框：无边框填色 + 聚焦高亮 */
const FIELD_BACKGROUND = '#F3F4F6';
const FIELD_BACKGROUND_FOCUSED = '#FFFFFF';
const FIELD_FOCUS_RING = 'rgba(74, 144, 226, 0.45)';
const FIELD_ERROR_BACKGROUND = '#FFF7F7';

/** 主按钮渐变：深蓝 → 浅蓝 */
const SAVE_GRADIENT_COLORS: readonly [string, string] = ['#4A90E2', '#357ABD'];
const SAVE_GRADIENT_DISABLED_COLORS: readonly [string, string] = ['#C6D5F9', '#B7C8F0'];

/**
 * 触觉反馈是否可用：
 * iOS 用 Taptic Engine、Android 用 Vibrator（expo-haptics 两个平台都支持），
 * Web 只有 Web Vibration API 且体验不稳定，这里统一跳过。
 */
const HAPTICS_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

/** 轻震：按钮按下时使用（失败静默，避免影响交互） */
function triggerImpactHaptic() {
  if (!HAPTICS_SUPPORTED) {
    return;
  }
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
    // 低电量模式 / 系统关闭触感时会 reject，忽略即可
  });
}

/** 成功震动：保存成功、删除成功时使用 */
function triggerSuccessHaptic() {
  if (!HAPTICS_SUPPORTED) {
    return;
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
    // 同上，系统设置可能导致调用失败
  });
}

/**
 * 首页轮播两侧渐隐色：
 * 使用当前实际背景色 #F4F6FA 对应的 rgba，避免 'transparent' 在 RN 中
 * 被当作透明黑而产生灰色过渡。
 */
const CAROUSEL_FADE_COLOR = 'rgba(244, 246, 250, 1)';
const CAROUSEL_FADE_CLEAR = 'rgba(244, 246, 250, 0)';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

type CategoryId =
  | 'study'
  | 'skill'
  | 'english'
  | 'fitness'
  | 'finance'
  | 'skincare'
  | 'journal';

type Category = {
  id: CategoryId;
  label: string;
  /** 该分类数值的计量单位 */
  unit: string;
  /** 卡片/选中态使用的主色 */
  accent: string;
  /** 选中态的浅色背景 */
  tint: string;
};

const CATEGORIES: Category[] = [
  { id: 'study', label: '专业课', unit: '分钟', accent: '#3B6EF6', tint: '#EAF0FF' },
  { id: 'skill', label: '拓展技能', unit: '分钟', accent: '#1F9D74', tint: '#E8F7F1' },
  { id: 'english', label: '英语', unit: '分钟', accent: '#E07B26', tint: '#FFF3E6' },
  { id: 'fitness', label: '健身', unit: 'kg', accent: '#E2555F', tint: '#FFEDEE' },
  { id: 'finance', label: '理财', unit: '元', accent: '#7A5AF8', tint: '#F2EDFF' },
  { id: 'skincare', label: '护肤', unit: '次', accent: '#D4519A', tint: '#FFEFF8' },
  { id: 'journal', label: '日记', unit: '篇', accent: '#1D8FB3', tint: '#E9F6FB' },
];

const CATEGORY_MAP = CATEGORIES.reduce<Record<CategoryId, Category>>((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {} as Record<CategoryId, Category>);

/** 首页三倍数据源，用于无限循环轮播 */
const LOOP_CATEGORIES: Category[] = [...CATEGORIES, ...CATEGORIES, ...CATEGORIES];

/** 首页大卡片的莫兰迪浅色背景 */
const HOME_CARD_TINTS: Record<CategoryId, string> = {
  study: '#EDF3FF',
  skill: '#EAF7F0',
  english: '#FFF5E9',
  fitness: '#FFF0F1',
  finance: '#ECF7F0',
  skincare: '#FDF0F6',
  journal: '#ECF7FB',
};

/** 首页大卡片图标 */
const CATEGORY_ICONS: Record<CategoryId, keyof typeof Ionicons.glyphMap> = {
  study: 'book-outline',
  skill: 'color-palette-outline',
  english: 'language-outline',
  fitness: 'barbell-outline',
  finance: 'wallet-outline',
  skincare: 'sparkles-outline',
  journal: 'journal-outline',
};

/** 学习型分类（专业课 / 拓展技能）的数值单位 */
const STUDY_UNITS = ['分钟', '页', '章', '套'] as const;

type StudyUnit = (typeof STUDY_UNITS)[number];

/** 学习型分类（专业课 / 拓展技能）的默认学习方式标签 */
const DEFAULT_STUDY_METHODS = ['看书', '看网课', '刷题', '复习'];
const DEFAULT_SKILL_METHODS = ['看视频', '动手练', '跟练', '模仿'];

/** 共用「学习型表单」的分类：专业课 + 拓展技能 */
type StudyLikeCategoryId = 'study' | 'skill';

function isStudyLikeCategory(category: CategoryId | null): category is StudyLikeCategoryId {
  return category === 'study' || category === 'skill';
}

/** 学习型表单的可变文案：只有名称、标签、数值占位不同，其余 UI / 逻辑完全复用 */
type StudyLikeFormCopy = {
  subjectLabel: string;
  subjectPlaceholder: string;
  subjectAccessibilityLabel: string;
  subjectError: string;
  methodPlaceholder: string;
  methodOptions: string[];
  valuePlaceholder: string;
};

const STUDY_LIKE_FORM_COPY: Record<StudyLikeCategoryId, StudyLikeFormCopy> = {
  study: {
    subjectLabel: '科目',
    subjectPlaceholder: '例如：高数',
    subjectAccessibilityLabel: '科目名称',
    subjectError: '请填写科目名称',
    methodPlaceholder: '输入新的学习方式',
    methodOptions: DEFAULT_STUDY_METHODS,
    valuePlaceholder: '例如 90',
  },
  skill: {
    subjectLabel: '技能名称',
    subjectPlaceholder: '例如：吉他 / 摄影',
    subjectAccessibilityLabel: '技能名称',
    subjectError: '请填写技能名称',
    methodPlaceholder: '输入新的学习方式',
    methodOptions: DEFAULT_SKILL_METHODS,
    valuePlaceholder: '例如 60',
  },
};

/** 理财专属：收支类型（存在 subject 字段） */
type FinanceFlow = 'income' | 'expense';

/** 理财专属：默认消费 / 收入类别标签（存在 method 字段） */
const DEFAULT_FINANCE_CATEGORIES = ['餐饮', '购物', '交通', '娱乐', '工资', '其他'];

const FINANCE_EXPENSE_COLOR = '#E2555F';
const FINANCE_INCOME_COLOR = '#1F9D74';
const FINANCE_EXPENSE_TINT = '#FFEDEE';
const FINANCE_INCOME_TINT = '#E8F7F1';

/** 护肤打卡：固定两个时段，subject 存时段 id */
const SKINCARE_SLOTS = [
  { id: 'morning', label: '早间护肤', shortLabel: '早间', icon: '☀️' },
  { id: 'evening', label: '晚间护肤', shortLabel: '晚间', icon: '🌙' },
] as const;

type SkincareSlot = (typeof SKINCARE_SLOTS)[number]['id'];

/** 今天两个时段是否已打卡 */
type SkincareStatus = Record<SkincareSlot, boolean>;

const SKINCARE_DONE_COLOR = '#1F9D74';
const SKINCARE_DONE_TINT = '#E8F7F1';

/** 英语专属：默认学习方式 */
const DEFAULT_ENGLISH_METHODS = ['背单词', '精听', '阅读', '写作'];

/** 英语专属：数量单位（自定义方式可手动切换） */
const ENGLISH_UNITS = ['个', '分钟', '篇', '次'] as const;

type EnglishUnit = (typeof ENGLISH_UNITS)[number];

/** 学习方式 → 默认单位 */
const ENGLISH_METHOD_UNITS: Record<string, EnglishUnit> = {
  背单词: '个',
  精听: '分钟',
  看美剧: '分钟',
  阅读: '篇',
  写作: '篇',
};

/** 首页卡片上的短标签 */
const ENGLISH_METHOD_LABELS: Record<string, string> = {
  背单词: '单词',
  精听: '精听',
  阅读: '阅读',
  写作: '写作',
  看美剧: '美剧',
};

function getEnglishUnitForMethod(method: string): EnglishUnit {
  return ENGLISH_METHOD_UNITS[method] ?? '次';
}

/** 健身专属：预设训练动作 */
const DEFAULT_FITNESS_ACTIONS = ['深蹲', '卧推', '硬拉', '引体向上', '跑步'];

/** v1 版本使用的分类 id，读取时自动迁移到新 id */
const LEGACY_CATEGORY_ALIASES: Record<string, CategoryId> = { major: 'study' };

/* -------------------------------------------------------------------------- */
/*                                   类型                                     */
/* -------------------------------------------------------------------------- */

type GrowthRecord = {
  id: string;
  category: CategoryId;
  /** 本次记录的数值（分钟数 / 篇数；护肤固定为 1；健身为重量） */
  value: number;
  note: string;
  /** 记录归属的日期，格式 YYYY-MM-DD */
  date: string;
  createdAt: number;
  /**
   * 专业课（study）：科目名称
   * 拓展技能（skill）：技能名称
   * 日记（journal）：标题
   * 理财（finance）：收支类型 'income' | 'expense'
   * 护肤（skincare）：打卡时段 'morning' | 'evening'
   * 健身（fitness）：动作名称
   */
  subject?: string;
  /**
   * 专业课（study）：学习方式
   * 拓展技能（skill）：学习方式
   * 理财（finance）：消费 / 收入类别（餐饮、购物、工资…）
   * 英语（english）：学习方式
   * 健身（fitness）：组数x次数，如 4x12
   */
  method?: string;
  /** 记录数值的单位：分钟 / 页 / 章 / 套 / 个 / 篇 / kg 等 */
  unit?: string;
};

type TabId = 'home' | 'calendar' | 'stats' | 'profile';

/** 个人中心可以进入的二级全屏页面 */
type ProfileRoute = 'tag_manager' | 'about';

type TodayStat = { count: number; total: number };

type SaveInput = {
  category: CategoryId;
  value: number;
  note: string;
  subject?: string;
  method?: string;
  unit?: string;
  /** 自定义记录日期（仅日记使用），格式 YYYY-MM-DD */
  date?: string;
};

type StudyLikeSummary = {
  count: number;
  /** 全部为「分钟」单位时的合计分钟数；存在其他单位时为 null */
  minutes: number | null;
  /** 今天记录过的科目 / 技能（已去重，保持录入顺序） */
  subjects: string[];
};

type FinanceSummary = {
  count: number;
  /** 今日总支出 */
  expense: number;
  /** 今日总收入 */
  income: number;
  /** 今日结余 = 收入 - 支出 */
  balance: number;
};

type EnglishSummaryItem = {
  method: string;
  value: number;
  unit: string;
};

type EnglishSummary = {
  count: number;
  /** 按学习方式分组后的数量与单位 */
  items: EnglishSummaryItem[];
};

type FitnessSummary = {
  count: number;
  /** 今天练过的动作（已去重，保持记录顺序） */
  actions: string[];
  /** 今天所有记录的总组数 */
  totalSets: number;
};

/* -------------------------------------------------------------------------- */
/*                                 工具函数                                   */
/* -------------------------------------------------------------------------- */

/** 本地时区的今天，格式 YYYY-MM-DD */
function getTodayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 顶部展示用：11月4日 周三 */
function formatDateLabel(date: Date = new Date()): string {
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;
}

/** 日期行展示用：2026年11月4日 周三 */
function formatDateLong(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${
    WEEKDAYS[date.getDay()]
  }`;
}

/** 把 'YYYY-MM-DD' 转成「11月4日」，跨年时带上年份 */
function formatRecordDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) {
    return dateKey;
  }
  return year === new Date().getFullYear()
    ? `${month}月${day}日`
    : `${year}年${month}月${day}日`;
}

/** 统一把选中日期归一到当天中午，避免时区/夏令时导致日期漂移 */
function normalizeDate(date: Date): Date {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

/** 把 'YYYY-MM-DD' 还原为当天中午的 Date（用于编辑时回填日期） */
function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) {
    return normalizeDate(new Date());
  }
  return normalizeDate(new Date(year, month - 1, day));
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 使用天数（含今天）：按最早一条记录的日期算到今天。
 * 没有任何记录时按第 1 天计算，避免出现「第 0 天」。
 */
function getUsageDays(records: GrowthRecord[], todayKey: string = getTodayKey()): number {
  if (records.length === 0) {
    return 1;
  }
  const earliestDate = records.reduce(
    (earliest, record) => (record.date < earliest ? record.date : earliest),
    records[0].date,
  );
  // parseDateKey 统一归一到当天中午，跨夏令时也不会少算一天
  const start = parseDateKey(earliestDate);
  const today = parseDateKey(todayKey);
  const diffDays = Math.round((today.getTime() - start.getTime()) / MS_PER_DAY);
  return Math.max(1, diffDays + 1);
}

/**
 * 连续打卡天数：从今天开始往前逐日回溯，
 * 某天有记录就 +1，一旦某天没有记录立即停止。
 */
function getStreakDays(records: GrowthRecord[], todayKey: string = getTodayKey()): number {
  if (records.length === 0) {
    return 0;
  }
  const recordedDates = new Set(records.map((record) => record.date));
  const cursor = parseDateKey(todayKey);
  let streak = 0;
  while (recordedDates.has(getTodayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** 历史列表 & 卡片使用的核心摘要文案 */
function formatRecordSummary(record: GrowthRecord): string {
  switch (record.category) {
    case 'finance': {
      const flow = record.subject === 'income' ? '收入' : '支出';
      const methodPrefix = record.method ? `${record.method} · ` : '';
      return `${methodPrefix}${flow} ${formatMoney(record.value)}元`;
    }
    case 'skincare':
      return record.subject === 'evening' ? '晚间打卡' : '早间打卡';
    case 'fitness':
      return `${record.subject?.trim() || '训练'} · ${formatMoney(record.value)}kg${
        record.method ? ` · ${record.method}` : ''
      }`;
    case 'english':
      return `${record.method?.trim() || '英语'} ${roundMoney(record.value)}${
        record.unit || ''
      }`;
    case 'journal': {
      const title = record.subject?.trim();
      if (title) {
        return title;
      }
      const note = record.note.trim();
      return note ? `${note.slice(0, 16)}${note.length > 16 ? '…' : ''}` : '无标题日记';
    }
    case 'study':
    case 'skill':
      return `${record.subject?.trim() || (record.category === 'study' ? '专业课' : '拓展技能')} · ${roundMoney(
        record.value,
      )}${record.unit || '分钟'}`;
    default:
      return `${roundMoney(record.value)}${record.unit || ''}`;
  }
}

function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_MAP, value);
}

/** 兼容旧数据：把 'major' 等历史 id 归一化为现在的分类 id */
function normalizeCategoryId(value: unknown): CategoryId | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = LEGACY_CATEGORY_ALIASES[value] ?? value;
  return isCategoryId(normalized) ? normalized : null;
}

/** 容错解析本地存储，脏数据直接丢弃，避免启动崩溃 */
function parseRecords(raw: string | null): GrowthRecord[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const records: GrowthRecord[] = [];
    parsed.forEach((item: unknown) => {
      if (typeof item !== 'object' || item === null) {
        return;
      }
      const candidate = item as Partial<GrowthRecord>;
      const category = normalizeCategoryId(candidate.category);
      if (
        typeof candidate.id !== 'string' ||
        !category ||
        typeof candidate.value !== 'number' ||
        !Number.isFinite(candidate.value) ||
        typeof candidate.date !== 'string'
      ) {
        return;
      }
      records.push({
        id: candidate.id,
        category,
        value: candidate.value,
        note: typeof candidate.note === 'string' ? candidate.note : '',
        date: candidate.date,
        createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : 0,
        subject: typeof candidate.subject === 'string' ? candidate.subject : undefined,
        method: typeof candidate.method === 'string' ? candidate.method : undefined,
        unit: typeof candidate.unit === 'string' ? candidate.unit : undefined,
      });
    });
    return records;
  } catch {
    return [];
  }
}

function createRecordId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 容错解析自定义标签：
 * - 只保留非空字符串并去重
 * - 剔除与系统预设重复的标签，避免预设标签被误判为「可删除」
 */
function parseCustomTags(raw: string | null, presets: readonly string[] = []): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const tags: string[] = [];
    parsed.forEach((item: unknown) => {
      if (typeof item !== 'string') {
        return;
      }
      const tag = item.trim();
      if (!tag || presets.includes(tag) || tags.includes(tag)) {
        return;
      }
      tags.push(tag);
    });
    return tags;
  } catch {
    return [];
  }
}

/** 预设标签在前，自定义标签随后追加并去重 */
function mergeTags(presets: readonly string[], customTags: string[]): string[] {
  const merged = [...presets];
  customTags.forEach((tag) => {
    if (!merged.includes(tag)) {
      merged.push(tag);
    }
  });
  return merged;
}

/** 自定义标签持久化：失败仅告警，不阻塞当前交互 */
async function persistCustomTags(storageKey: string, tags: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(tags));
  } catch (error) {
    console.warn('保存自定义标签失败', error);
  }
}

/**
 * 汇总学习型分类（专业课 / 拓展技能）的记录：
 * - 全部为「分钟」时才计算总时长
 * - 存在「页 / 章 / 套」等非时间单位时，改为展示科目 / 技能名称
 */
function summarizeStudyLike(records: GrowthRecord[]): StudyLikeSummary {
  let minutes = 0;
  let hasOtherUnit = false;
  const subjects: string[] = [];

  records.forEach((record) => {
    if (record.unit && record.unit !== '分钟') {
      hasOtherUnit = true;
    } else {
      minutes += record.value;
    }

    const subject = record.subject?.trim();
    if (subject && !subjects.includes(subject)) {
      subjects.push(subject);
    }
  });

  return {
    count: records.length,
    minutes: hasOtherUnit ? null : minutes,
    subjects,
  };
}

/** 金额统一保留两位小数，避免 0.1 + 0.2 之类的浮点误差 */
function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** 金额展示：整数不带小数，有小数时最多保留两位（去掉末尾 0） */
function formatMoney(value: number): string {
  const rounded = roundMoney(Math.abs(value));
  const fixed = rounded.toFixed(2);
  if (fixed.endsWith('.00')) {
    return fixed.slice(0, -3);
  }
  return fixed.endsWith('0') ? fixed.slice(0, -1) : fixed;
}

/** 结余展示：负数把「-」放在 ¥ 前面，例如 -¥12.5 */
function formatBalance(value: number): string {
  return `${value < 0 ? '-' : ''}¥${formatMoney(value)}`;
}

/**
 * 汇总今天的理财记录：
 * - subject 为 'income' 计入收入，其余（含旧数据）计入支出
 * - value 统一按绝对值计算，结余 = 收入 - 支出
 */
function summarizeFinance(records: GrowthRecord[]): FinanceSummary {
  let expense = 0;
  let income = 0;

  records.forEach((record) => {
    const amount = Math.abs(record.value);
    if (record.subject === 'income') {
      income += amount;
    } else {
      expense += amount;
    }
  });

  expense = roundMoney(expense);
  income = roundMoney(income);

  return {
    count: records.length,
    expense,
    income,
    balance: roundMoney(income - expense),
  };
}

/**
 * 汇总今天的英语记录：
 * - 按 method 分组累加 value
 * - 使用该方式最新一条记录的单位（自定义方式可能手动切换过单位）
 */
function summarizeEnglish(records: GrowthRecord[]): EnglishSummary {
  const groups = new Map<string, EnglishSummaryItem>();

  records.forEach((record) => {
    const method = record.method?.trim() || '其他';
    const existing = groups.get(method);
    if (existing) {
      existing.value += record.value;
      return;
    }
    groups.set(method, {
      method,
      value: record.value,
      unit: record.unit || '次',
    });
  });

  const items = Array.from(groups.values()).sort((a, b) => {
    const aIndex = DEFAULT_ENGLISH_METHODS.indexOf(a.method);
    const bIndex = DEFAULT_ENGLISH_METHODS.indexOf(b.method);
    const aRank = aIndex === -1 ? DEFAULT_ENGLISH_METHODS.length : aIndex;
    const bRank = bIndex === -1 ? DEFAULT_ENGLISH_METHODS.length : bIndex;
    return aRank - bRank;
  });

  return { count: records.length, items };
}

/** 解析 method 中的组数，例如 4x12 -> 4；无法解析返回 0 */
function parseFitnessSets(method: string | undefined): number {
  const { sets } = parseFitnessMethod(method);
  return sets ? Number(sets) : 0;
}

/** 解析 method 中的组数和次数，例如 4x12 -> { sets: '4', reps: '12' } */
function parseFitnessMethod(method: string | undefined): { sets: string; reps: string } {
  if (!method) {
    return { sets: '', reps: '' };
  }
  const match = method.trim().match(/^(\d+)\s*[xX×]\s*(\d+)$/);
  return {
    sets: match?.[1] ?? '',
    reps: match?.[2] ?? '',
  };
}

/**
 * 汇总今天的健身记录：
 * - 动作名称去重
 * - 从 method（如 4x12）中提取组数并累加
 */
function summarizeFitness(records: GrowthRecord[]): FitnessSummary {
  const actions: string[] = [];
  let totalSets = 0;

  records.forEach((record) => {
    const action = record.subject?.trim() || '其他';
    if (!actions.includes(action)) {
      actions.push(action);
    }
    totalSets += parseFitnessSets(record.method);
  });

  return { count: records.length, actions, totalSets };
}

/**
 * 金额输入清洗：
 * - 只允许数字和一个小数点
 * - 整数部分最多 7 位，小数部分最多 2 位
 */
function sanitizeMoneyInput(text: string): string {
  // 兼容部分 Android 数字键盘输出逗号作小数点，同时处理「1,234.56」这类粘贴内容
  const normalizedSeparators = text.includes(',')
    ? text.includes('.')
      ? text.replace(/,/g, '')
      : text.replace(/,/g, '.')
    : text;
  const digitsAndDots = normalizedSeparators.replace(/[^0-9.]/g, '');
  const firstDotIndex = digitsAndDots.indexOf('.');
  const withoutExtraDots =
    firstDotIndex === -1
      ? digitsAndDots
      : `${digitsAndDots.slice(0, firstDotIndex + 1)}${digitsAndDots
          .slice(firstDotIndex + 1)
          .replace(/\./g, '')}`;

  const [rawInteger, rawDecimal] = withoutExtraDots.split('.');
  const integerPart = rawInteger.replace(/^0+(?=\d)/, '').slice(0, 7);

  if (rawDecimal === undefined) {
    return integerPart;
  }
  return `${integerPart || '0'}.${rawDecimal.slice(0, 2)}`;
}

/** 结余颜色：负数红、正数绿、0 黑 */
function getBalanceColor(balance: number): string {
  if (balance < 0) {
    return COLORS.danger;
  }
  if (balance > 0) {
    return FINANCE_INCOME_COLOR;
  }
  return COLORS.text;
}

/* -------------------------------------------------------------------------- */
/*                                 根组件                                     */
/* -------------------------------------------------------------------------- */

export default function App() {
  return (
    <SafeAreaProvider>
      <GrowthApp />
    </SafeAreaProvider>
  );
}

function GrowthApp() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [isAddOpen, setIsAddOpen] = useState(false);
  /**
   * 个人中心的二级全屏页面：
   * 'tag_manager' = 管理自定义标签，'about' = 关于 Go，null = 停留在 Tab 主界面。
   * 非 null 时整页替换主界面，底部 Tab Bar 自然隐藏。
   */
  const [profileRoute, setProfileRoute] = useState<ProfileRoute | null>(null);
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [todayKey, setTodayKey] = useState<string>(getTodayKey);
  /** 进入添加页时预选的分类（点击首页「专业课」卡片时会带上 'study'） */
  const [addInitialCategory, setAddInitialCategory] = useState<CategoryId | null>(null);
  /** 正在编辑的历史记录；为 null 时是新增模式 */
  const [editingRecord, setEditingRecord] = useState<GrowthRecord | null>(null);
  /**
   * 首页轮播上次停留的卡片索引（0 基，对应 CATEGORIES）。
   * 用 ref 存：滑动时只记录、不触发首页重渲染；
   * 从 add/edit 页或其它 Tab 返回时首页会重新挂载，再读它作为初始位置。
   */
  const homeCardIndexRef = useRef(0);

  /** 首页卡片滑动结束时回写索引（稳定引用，避免每次滑动都重建 FlatList 回调） */
  const handleHomeCardIndexChange = useCallback((index: number) => {
    homeCardIndexRef.current = index;
  }, []);
  /** 用户自定义标签与系统预设分开始存，便于判断长按是否可删除 */
  const [customMethods, setCustomMethods] = useState<string[]>([]);
  const [customSkillMethods, setCustomSkillMethods] = useState<string[]>([]);
  const [customEnglishMethods, setCustomEnglishMethods] = useState<string[]>([]);
  const [customFitnessActions, setCustomFitnessActions] = useState<string[]>([]);
  const [customFinanceCategories, setCustomFinanceCategories] = useState<string[]>([]);

  // 首次启动读取本地数据（记录 + 五类自定义标签）
  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        const [
          rawRecords,
          rawCustomMethods,
          rawCustomSkillMethods,
          rawCustomEnglishMethods,
          rawCustomFitnessActions,
          rawCustomFinance,
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(CUSTOM_METHODS_STORAGE_KEY),
          AsyncStorage.getItem(CUSTOM_SKILL_METHODS_STORAGE_KEY),
          AsyncStorage.getItem(CUSTOM_ENGLISH_METHODS_STORAGE_KEY),
          AsyncStorage.getItem(CUSTOM_FITNESS_ACTIONS_STORAGE_KEY),
          AsyncStorage.getItem(CUSTOM_FINANCE_STORAGE_KEY),
        ]);
        if (isActive) {
          setRecords(parseRecords(rawRecords));
          setCustomMethods(parseCustomTags(rawCustomMethods, DEFAULT_STUDY_METHODS));
          setCustomSkillMethods(
            parseCustomTags(rawCustomSkillMethods, DEFAULT_SKILL_METHODS),
          );
          setCustomEnglishMethods(
            parseCustomTags(rawCustomEnglishMethods, DEFAULT_ENGLISH_METHODS),
          );
          setCustomFitnessActions(
            parseCustomTags(rawCustomFitnessActions, DEFAULT_FITNESS_ACTIONS),
          );
          setCustomFinanceCategories(
            parseCustomTags(rawCustomFinance, DEFAULT_FINANCE_CATEGORIES),
          );
        }
      } catch (error) {
        console.warn('读取成长记录失败', error);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  const handleCustomMethodsChange = useCallback((tags: string[]) => {
    setCustomMethods(tags);
    void persistCustomTags(CUSTOM_METHODS_STORAGE_KEY, tags);
  }, []);

  const handleCustomSkillMethodsChange = useCallback((tags: string[]) => {
    setCustomSkillMethods(tags);
    void persistCustomTags(CUSTOM_SKILL_METHODS_STORAGE_KEY, tags);
  }, []);

  const handleCustomEnglishMethodsChange = useCallback((tags: string[]) => {
    setCustomEnglishMethods(tags);
    void persistCustomTags(CUSTOM_ENGLISH_METHODS_STORAGE_KEY, tags);
  }, []);

  const handleCustomFitnessActionsChange = useCallback((tags: string[]) => {
    setCustomFitnessActions(tags);
    void persistCustomTags(CUSTOM_FITNESS_ACTIONS_STORAGE_KEY, tags);
  }, []);

  const handleCustomFinanceCategoriesChange = useCallback((tags: string[]) => {
    setCustomFinanceCategories(tags);
    void persistCustomTags(CUSTOM_FINANCE_STORAGE_KEY, tags);
  }, []);

  // 今天护肤两个时段的打卡状态（首页卡片和专属表单共用）
  const skincareStatus = useMemo<SkincareStatus>(() => {
    const todayRecords = records.filter(
      (record) => record.category === 'skincare' && record.date === todayKey,
    );
    return {
      morning: todayRecords.some((record) => record.subject === 'morning'),
      evening: todayRecords.some((record) => record.subject === 'evening'),
    };
  }, [records, todayKey]);

  const openAddScreen = useCallback((initialCategory: CategoryId | null = null) => {
    setEditingRecord(null);
    setAddInitialCategory(initialCategory);
    setTodayKey(getTodayKey());
    setIsAddOpen(true);
  }, []);

  const openEditScreen = useCallback((record: GrowthRecord) => {
    setEditingRecord(record);
    setAddInitialCategory(record.category);
    setTodayKey(getTodayKey());
    setIsAddOpen(true);
  }, []);

  const closeAddScreen = useCallback(() => {
    setEditingRecord(null);
    setAddInitialCategory(null);
    setTodayKey(getTodayKey());
    setIsAddOpen(false);
  }, []);

  const changeTab = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setTodayKey(getTodayKey());
  }, []);

  /** 进入个人中心的二级页面（整页替换主界面，底部 Tab Bar 随之隐藏） */
  const openProfileRoute = useCallback((route: ProfileRoute) => {
    setProfileRoute(route);
  }, []);

  /** 二级页面返回「个人」Tab */
  const closeProfileRoute = useCallback(() => {
    setProfileRoute(null);
  }, []);

  const handleSave = useCallback(
    async (input: SaveInput) => {
      const existing = editingRecord;
      const record: GrowthRecord = {
        id: existing?.id ?? createRecordId(),
        category: input.category,
        value: input.value,
        note: input.note,
        date: input.date ?? existing?.date ?? getTodayKey(),
        createdAt: existing?.createdAt ?? Date.now(),
      };

      // 学习型记录（专业课 / 拓展技能）额外保存名称 / 学习方式 / 单位
      if (isStudyLikeCategory(input.category)) {
        record.subject = input.subject;
        record.method = input.method;
        record.unit = input.unit;
      }

      // 日记：标题存在 subject，正文存在 note，日期可回填
      if (input.category === 'journal') {
        record.subject = input.subject;
      }

      // 英语：method 存学习方式，unit 存动态单位
      if (input.category === 'english') {
        record.method = input.method;
        record.unit = input.unit;
      }

      // 健身：subject 存动作，value 存重量，unit 固定 kg，method 存 组数x次数
      if (input.category === 'fitness') {
        record.subject = input.subject;
        record.value = input.value;
        record.unit = 'kg';
        record.method = input.method;
      }

      // 理财：subject 存收支类型，method 存消费/收入类别，value 统一为绝对值
      if (input.category === 'finance') {
        record.value = Math.abs(input.value);
        record.subject = input.subject === 'income' ? 'income' : 'expense';
        record.method = input.method;
      }

      // 护肤：value 固定 1，subject 保留原有打卡时段
      if (input.category === 'skincare') {
        record.value = 1;
        record.subject = input.subject ?? existing?.subject;
      }

      const nextRecords = existing
        ? records.map((item) => (item.id === existing.id ? record : item))
        : [record, ...records];

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));

      setRecords(nextRecords);
      // 首页始终以“今天”为基准，避免补记往日日记后统计错位
      setTodayKey(getTodayKey());
      setEditingRecord(null);
      setAddInitialCategory(null);
      setIsAddOpen(false);
    },
    [records, editingRecord],
  );

  /** 删除正在编辑的记录，并返回历史列表 */
  const handleDeleteRecord = useCallback(
    async (id: string) => {
      const nextRecords = records.filter((record) => record.id !== id);
      if (nextRecords.length !== records.length) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
        setRecords(nextRecords);
      }
      setTodayKey(getTodayKey());
      setEditingRecord(null);
      setAddInitialCategory(null);
      setIsAddOpen(false);
    },
    [records],
  );

  /** 护肤打卡：同一时段当天只保留一条，成功后立即回首页 */
  const handleSkincareCheckIn = useCallback(
    async (slot: SkincareSlot) => {
      const date = getTodayKey();
      const alreadyChecked = records.some(
        (record) =>
          record.category === 'skincare' &&
          record.date === date &&
          record.subject === slot,
      );
      if (alreadyChecked) {
        setTodayKey(date);
        setIsAddOpen(false);
        return;
      }

      const record: GrowthRecord = {
        id: createRecordId(),
        category: 'skincare',
        value: 1,
        note: '',
        date,
        createdAt: Date.now(),
        subject: slot,
      };
      const nextRecords = [record, ...records];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));

      setRecords(nextRecords);
      setTodayKey(date);
      setIsAddOpen(false);
    },
    [records],
  );

  /** 取消护肤打卡：删除该时段当天的全部记录，成功后立即回首页 */
  const handleSkincareCancel = useCallback(
    async (slot: SkincareSlot) => {
      const date = getTodayKey();
      const nextRecords = records.filter(
        (record) =>
          !(
            record.category === 'skincare' &&
            record.date === date &&
            record.subject === slot
          ),
      );

      if (nextRecords.length !== records.length) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
        setRecords(nextRecords);
      }
      setTodayKey(date);
      setIsAddOpen(false);
    },
    [records],
  );

  // Android 硬件返回键：add/edit 返回刚才的 Tab，个人中心二级页返回个人 Tab，其他 Tab 返回首页
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isAddOpen) {
        closeAddScreen();
        return true;
      }
      if (profileRoute !== null) {
        closeProfileRoute();
        return true;
      }
      if (activeTab !== 'home') {
        changeTab('home');
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [isAddOpen, profileRoute, activeTab, closeAddScreen, closeProfileRoute, changeTab]);

  if (isAddOpen) {
    return (
      <AddRecordScreen
        initialCategory={addInitialCategory}
        editingRecord={editingRecord}
        customMethods={customMethods}
        customSkillMethods={customSkillMethods}
        customEnglishMethods={customEnglishMethods}
        customFitnessActions={customFitnessActions}
        customFinanceCategories={customFinanceCategories}
        skincareStatus={skincareStatus}
        onCustomMethodsChange={handleCustomMethodsChange}
        onCustomSkillMethodsChange={handleCustomSkillMethodsChange}
        onCustomEnglishMethodsChange={handleCustomEnglishMethodsChange}
        onCustomFitnessActionsChange={handleCustomFitnessActionsChange}
        onCustomFinanceCategoriesChange={handleCustomFinanceCategoriesChange}
        onSkincareCheckIn={handleSkincareCheckIn}
        onSkincareCancel={handleSkincareCancel}
        onDelete={handleDeleteRecord}
        onBack={closeAddScreen}
        onSave={handleSave}
      />
    );
  }

  if (profileRoute === 'tag_manager') {
    return (
      <TagManagerScreen
        customMethods={customMethods}
        customSkillMethods={customSkillMethods}
        customEnglishMethods={customEnglishMethods}
        customFitnessActions={customFitnessActions}
        customFinanceCategories={customFinanceCategories}
        onCustomMethodsChange={handleCustomMethodsChange}
        onCustomSkillMethodsChange={handleCustomSkillMethodsChange}
        onCustomEnglishMethodsChange={handleCustomEnglishMethodsChange}
        onCustomFitnessActionsChange={handleCustomFitnessActionsChange}
        onCustomFinanceCategoriesChange={handleCustomFinanceCategoriesChange}
        onBack={closeProfileRoute}
      />
    );
  }

  if (profileRoute === 'about') {
    return <AboutScreen onBack={closeProfileRoute} />;
  }

  return (
    <View style={styles.appShell}>
      <View style={styles.appContent}>
        {activeTab === 'home' ? (
          <HomeScreen
            records={records}
            todayKey={todayKey}
            isLoading={isLoading}
            onCategoryPress={openAddScreen}
            initialCategoryIndex={homeCardIndexRef.current}
            onCategoryIndexChange={handleHomeCardIndexChange}
          />
        ) : activeTab === 'calendar' ? (
          <CalendarScreen
            records={records}
            isLoading={isLoading}
            onEditRecord={openEditScreen}
          />
        ) : activeTab === 'stats' ? (
          <StatsScreen records={records} />
        ) : (
          <ProfileScreen
            records={records}
            isLoading={isLoading}
            onOpenTagManager={() => openProfileRoute('tag_manager')}
            onOpenAbout={() => openProfileRoute('about')}
          />
        )}
      </View>

      <BottomTabBar
        activeTab={activeTab}
        onChangeTab={changeTab}
        onAddPress={() => openAddScreen()}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  首页                                      */
/* -------------------------------------------------------------------------- */

type HomeScreenProps = {
  records: GrowthRecord[];
  todayKey: string;
  isLoading: boolean;
  onCategoryPress: (category: CategoryId) => void;
  /** 上次离开首页时居中的卡片索引（0 基），用于无动画还原位置 */
  initialCategoryIndex: number;
  /** 卡片停止滑动时回传当前居中的索引 */
  onCategoryIndexChange: (index: number) => void;
};

function HomeScreen({
  records,
  todayKey,
  isLoading,
  onCategoryPress,
  initialCategoryIndex,
  onCategoryIndexChange,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(width * 0.45);
  const cardHeight = Math.max(150, Math.min(220, Math.round(cardWidth * 1.1)));
  const cardGap = 12;
  const snapInterval = cardWidth + cardGap;
  const carouselSidePadding = Math.max(H_PADDING, Math.round((width - cardWidth) / 2));
  const logoFontSize = Math.round(width * 1.2);
  const logoLineHeight = Math.round(logoFontSize * 1.1);
  const carouselRef = useRef<FlatList<Category>>(null);
  /** 当前居中卡片的逻辑索引（0 基，对应 CATEGORIES），不参与渲染 */
  const currentIndexRef = useRef(
    Math.min(CATEGORIES.length - 1, Math.max(0, initialCategoryIndex)),
  );
  /** 记住的卡片在三倍数据源里的偏移量（中间段），用于无动画归位 */
  const carouselInitialOffset = (CATEGORIES.length + currentIndexRef.current) * snapInterval;
  /** 最近一次滚动偏移量：点击卡片时用它兜底记录位置（例如减速过程中直接点卡片） */
  const lastScrollOffsetRef = useRef(carouselInitialOffset);
  /**
   * 三倍数据源：把记住的索引放进中间段，
   * 这样返回首页后左右两个方向都还有卡片，无限循环不会被卡在边界。
   */
  const initialScrollIndex = CATEGORIES.length + currentIndexRef.current;
  const dateLabel = useMemo(() => formatDateLabel(), []);

  /** 无动画回到记住的卡片（中间段同一张卡的位置） */
  const restoreCarouselIndex = useCallback(() => {
    if (!Number.isFinite(snapInterval) || snapInterval <= 0) {
      return;
    }
    carouselRef.current?.scrollToOffset({
      offset: (CATEGORIES.length + currentIndexRef.current) * snapInterval,
      animated: false,
    });
  }, [snapInterval]);

  /** 记录当前居中的卡片：三倍数据源换算成 0 基逻辑索引 */
  const recordCarouselIndex = useCallback(
    (offsetX: number) => {
      if (!Number.isFinite(offsetX) || snapInterval <= 0) {
        return;
      }
      const rawIndex = Math.round(offsetX / snapInterval);
      const clampedIndex = Math.max(0, Math.min(LOOP_CATEGORIES.length - 1, rawIndex));
      const logicalIndex = clampedIndex % CATEGORIES.length;
      currentIndexRef.current = logicalIndex;
      onCategoryIndexChange(logicalIndex);
    },
    [onCategoryIndexChange, snapInterval],
  );

  /** 滚动过程中只缓存偏移量（写 ref，不触发重渲染） */
  const handleCarouselScroll = useCallback((offsetX: number) => {
    lastScrollOffsetRef.current = offsetX;
  }, []);

  /** 点击卡片离开首页前，再按当前偏移同步一次位置 */
  const handleCardPress = useCallback(
    (categoryId: CategoryId) => {
      recordCarouselIndex(lastScrollOffsetRef.current);
      onCategoryPress(categoryId);
    },
    [onCategoryPress, recordCarouselIndex],
  );

  /** 惯性滚动结束：先记录索引，再把越界的索引静默拉回中间段以维持循环 */
  const handleCarouselMomentumEnd = useCallback(
    (offsetX: number) => {
      recordCarouselIndex(offsetX);
      if (!Number.isFinite(offsetX) || snapInterval <= 0) {
        return;
      }
      const rawIndex = Math.round(offsetX / snapInterval);
      const middleStart = CATEGORIES.length;
      const rightStart = CATEGORIES.length * 2;
      let targetIndex = rawIndex;
      if (rawIndex < middleStart) {
        targetIndex = rawIndex + middleStart;
      } else if (rawIndex >= rightStart) {
        targetIndex = rawIndex - middleStart;
      }
      if (targetIndex !== rawIndex) {
        carouselRef.current?.scrollToOffset({
          offset: targetIndex * snapInterval,
          animated: false,
        });
      }
    },
    [recordCarouselIndex, snapInterval],
  );

  /**
   * 从 add/edit 页或其它 Tab 返回时，首页会重新挂载：
   * 首帧里 initialScrollIndex 已就位，这里再补一次无动画归位，
   * 确保记录位置生效且用户看到的是「本来就在那里」。
   */
  useEffect(() => {
    if (isLoading) {
      return;
    }
    const frame = requestAnimationFrame(restoreCarouselIndex);
    return () => cancelAnimationFrame(frame);
  }, [isLoading, restoreCarouselIndex]);

  // 学习型分类（专业课 / 拓展技能）需要区分单位、名称，按分类分别汇总
  const studyLikeSummaries = useMemo(() => {
    const todayRecords = records.filter(
      (record) =>
        record.date === todayKey &&
        isStudyLikeCategory(record.category),
    );
    return {
      study: summarizeStudyLike(
        todayRecords.filter((record) => record.category === 'study'),
      ),
      skill: summarizeStudyLike(
        todayRecords.filter((record) => record.category === 'skill'),
      ),
    };
  }, [records, todayKey]);

  // 理财需要区分收入 / 支出，单独汇总今天的记录
  const financeSummary = useMemo(
    () =>
      summarizeFinance(
        records.filter((record) => record.date === todayKey && record.category === 'finance'),
      ),
    [records, todayKey],
  );

  // 护肤是纯打卡：只看今天早间 / 晚间是否已有记录
  const skincareToday = useMemo<SkincareStatus>(() => {
    const todayRecords = records.filter(
      (record) => record.date === todayKey && record.category === 'skincare',
    );
    return {
      morning: todayRecords.some((record) => record.subject === 'morning'),
      evening: todayRecords.some((record) => record.subject === 'evening'),
    };
  }, [records, todayKey]);

  // 日记卡片：优先展示今天的日记，没有则展示最近一篇
  const journalEntry = useMemo(() => {
    const entries = records.filter((record) => record.category === 'journal');
    if (entries.length === 0) {
      return null;
    }
    const todays = entries.filter((record) => record.date === todayKey);
    const pool = todays.length > 0 ? todays : entries;
    return pool.reduce((latest, record) => {
      if (record.date > latest.date) {
        return record;
      }
      if (record.date === latest.date && record.createdAt > latest.createdAt) {
        return record;
      }
      return latest;
    });
  }, [records, todayKey]);

  // 英语：按学习方式分组，分别累计数量与单位
  const englishSummary = useMemo(
    () =>
      summarizeEnglish(
        records.filter((record) => record.date === todayKey && record.category === 'english'),
      ),
    [records, todayKey],
  );

  // 健身：动作去重 + 累加 method 中的组数
  const fitnessSummary = useMemo(
    () =>
      summarizeFitness(
        records.filter((record) => record.date === todayKey && record.category === 'fitness'),
      ),
    [records, todayKey],
  );

  const getCardContent = (category: Category): HomeCardContent => {
    switch (category.id) {
      case 'study':
      case 'skill': {
        const summary =
          category.id === 'study' ? studyLikeSummaries.study : studyLikeSummaries.skill;
        if (summary.count === 0) {
          return {
            primary: '暂无记录',
            secondary: '今天还没有记录',
            primaryColor: category.accent,
          };
        }
        if (summary.minutes !== null) {
          const subjectText = summary.subjects.slice(0, 2).join('、');
          return {
            primary: `${summary.minutes} 分钟`,
            secondary: subjectText
              ? `共 ${summary.count} 条 · 重点：${subjectText}`
              : `共 ${summary.count} 条记录`,
            primaryColor: category.accent,
          };
        }
        return {
          primary: summary.subjects.slice(0, 3).join('、') || '多种记录',
          secondary: `共 ${summary.count} 条记录`,
          primaryColor: category.accent,
        };
      }
      case 'finance': {
        const parts: string[] = [];
        if (financeSummary.expense > 0) {
          parts.push(`支出 ¥${formatMoney(financeSummary.expense)}`);
        }
        if (financeSummary.income > 0) {
          parts.push(`收入 ¥${formatMoney(financeSummary.income)}`);
        }
        return {
          primary: formatBalance(financeSummary.balance),
          secondary: parts.length > 0 ? parts.join(' · ') : '今日暂无收支',
          primaryColor: getBalanceColor(financeSummary.balance),
        };
      }
      case 'skincare': {
        const { morning, evening } = skincareToday;
        const primary =
          morning && evening ? '全部完成' : morning || evening ? '已完成 1/2' : '待打卡';
        return {
          primary,
          secondary: `早间 ${morning ? '✅' : '⬜'} · 晚间 ${evening ? '✅' : '⬜'}`,
          primaryColor: morning && evening ? FINANCE_INCOME_COLOR : category.accent,
        };
      }
      case 'english': {
        if (englishSummary.count === 0) {
          return {
            primary: '今日未打卡',
            secondary: '背单词 · 精听 · 阅读',
            primaryColor: category.accent,
          };
        }
        const visibleItems = englishSummary.items.slice(0, 2);
        const text = visibleItems
          .map(
            (item) =>
              `${ENGLISH_METHOD_LABELS[item.method] ?? item.method} ${roundMoney(
                item.value,
              )}${item.unit}`,
          )
          .join(' · ');
        return {
          primary: `${text}${englishSummary.items.length > 2 ? ' 等' : ''}`,
          secondary: `共 ${englishSummary.count} 条学习记录`,
          primaryColor: category.accent,
        };
      }
      case 'fitness': {
        if (fitnessSummary.count === 0) {
          return {
            primary: '今日未练',
            secondary: '深蹲 · 卧推 · 硬拉',
            primaryColor: category.accent,
          };
        }
        const actions = fitnessSummary.actions.slice(0, 3).join('、');
        return {
          primary: `${fitnessSummary.totalSets} 组`,
          secondary: `重点动作：${actions}${fitnessSummary.actions.length > 3 ? ' 等' : ''}`,
          primaryColor: category.accent,
        };
      }
      case 'journal': {
        if (!journalEntry) {
          return {
            primary: '今日未写',
            secondary: '写点什么，留住今天',
            primaryColor: category.accent,
          };
        }
        const title = journalEntry.subject?.trim();
        const body = journalEntry.note.trim();
        const preview =
          title || (body ? (body.length > 18 ? `${body.slice(0, 18)}…` : body) : '无标题日记');
        return {
          primary: preview,
          secondary: journalEntry.date === todayKey ? '今天' : formatRecordDate(journalEntry.date),
          primaryColor: category.accent,
        };
      }
      default:
        return {
          primary: '暂无记录',
          secondary: '今天还没有记录',
          primaryColor: category.accent,
        };
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.homeCenterContent, { paddingTop: insets.top }]}>
        <View style={styles.homeHero}>
          <Text
            style={[
              styles.homeHeroTitle,
              { fontSize: logoFontSize, lineHeight: logoLineHeight },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            allowFontScaling={false}
          >
            Go
          </Text>
          <Text style={styles.homeHeroDate}>{dateLabel}</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.homeLoading} color={COLORS.primary} />
        ) : (
          <View style={styles.homeCarouselWrap}>
          {/* 45% 宽卡片按卡片宽度吸附，保留下一张卡片的露边效果 */}
          <FlatList
            ref={carouselRef}
            data={LOOP_CATEGORIES}
            extraData={records}
            initialScrollIndex={initialScrollIndex}
            initialNumToRender={3}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={snapInterval}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            removeClippedSubviews={false}
            renderItem={({ item }) => (
              <HomeCategoryCard
                category={item}
                content={getCardContent(item)}
                width={cardWidth}
                height={cardHeight}
                onPress={() => handleCardPress(item.id)}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ width: cardGap }} />}
            contentContainerStyle={[
              styles.homeCarouselContent,
              { paddingHorizontal: carouselSidePadding },
            ]}
            style={[styles.homeCarousel, { height: cardHeight + 28 }]}
            getItemLayout={(_, index) => ({
              length: snapInterval,
              offset: snapInterval * index,
              index,
            })}
            onScrollToIndexFailed={() => {
              // 兜底：直接回到记住的卡片，避免异常时跳回第一张
              restoreCarouselIndex();
            }}
            onScroll={(event) => handleCarouselScroll(event.nativeEvent.contentOffset.x)}
            scrollEventThrottle={16}
            onScrollEndDrag={(event) => {
              // 轻扫后没有惯性（不会触发 momentum end）时也要记住位置
              recordCarouselIndex(event.nativeEvent.contentOffset.x);
            }}
            onMomentumScrollEnd={(event) => {
              handleCarouselMomentumEnd(event.nativeEvent.contentOffset.x);
            }}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[CAROUSEL_FADE_COLOR, CAROUSEL_FADE_CLEAR]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.carouselFade, styles.carouselFadeLeft]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[CAROUSEL_FADE_CLEAR, CAROUSEL_FADE_COLOR]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.carouselFade, styles.carouselFadeRight]}
          />
        </View>
        )}
      </View>
    </View>
  );
}

type HomeCardContent = {
  primary: string;
  secondary?: string;
  primaryColor: string;
};

type HomeCategoryCardProps = {
  category: Category;
  content: HomeCardContent;
  width: number;
  height: number;
  onPress: () => void;
};

/** 首页横向滑动卡片 */
function HomeCategoryCard({
  category,
  content,
  width,
  height,
  onPress,
}: HomeCategoryCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${category.label}，${content.primary}`}
      style={({ pressed }) => [
        styles.homeCategoryCard,
        { width, height, backgroundColor: HOME_CARD_TINTS[category.id] },
        pressed && styles.homeCategoryCardPressed,
      ]}
    >
      <View style={styles.homeCardTop}>
        <View style={styles.homeCardIconWrap}>
          <Ionicons
            name={CATEGORY_ICONS[category.id]}
            size={16}
            color={category.accent}
          />
        </View>
        <Text style={styles.homeCardTitle}>{category.label}</Text>
      </View>

      <View style={styles.homeCardMain}>
        <Text
          style={[styles.homeCardPrimary, { color: content.primaryColor }]}
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {content.primary}
        </Text>
        {content.secondary ? (
          <Text style={styles.homeCardSecondary} numberOfLines={2}>
            {content.secondary}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => {
          triggerImpactHaptic();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`添加${category.label}记录`}
        style={({ pressed }) => [
          styles.homeCardAdd,
          { backgroundColor: category.accent },
          pressed && styles.homeCardAddPressed,
        ]}
      >
        <Ionicons name="add" size={18} color="#FFFFFF" />
      </Pressable>
    </Pressable>
  );
}

type CalendarScreenProps = {
  records: GrowthRecord[];
  isLoading: boolean;
  onEditRecord: (record: GrowthRecord) => void;
};

type CalendarMarking = {
  marked?: boolean;
  dotColor?: string;
  selected?: boolean;
  selectedColor?: string;
  selectedTextColor?: string;
  selectedDotColor?: string;
};

/** 日历 Tab：月历 + 选中日期的记录 */
function CalendarScreen({ records, isLoading, onEditRecord }: CalendarScreenProps) {
  const insets = useSafeAreaInsets();
  const todayKey = getTodayKey();
  const dateLabel = useMemo(() => formatDateLabel(), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayKey());

  const monthlyRecordDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const days = new Set<string>();
    records.forEach((record) => {
      const [recordYear, recordMonth, recordDay] = record.date.split('-').map(Number);
      if (recordYear === year && recordMonth === month && recordDay) {
        days.add(record.date);
      }
    });
    return days.size;
  }, [records]);

  const markedDates = useMemo(() => {
    const marks: Record<string, CalendarMarking> = {};
    records.forEach((record) => {
      marks[record.date] = {
        ...(marks[record.date] ?? {}),
        marked: true,
        dotColor: COLORS.primary,
      };
    });

    const selectedMark: CalendarMarking = {
      ...(marks[selectedDate] ?? {}),
      selected: true,
      selectedColor: COLORS.primary,
      selectedTextColor: '#FFFFFF',
    };
    if (selectedMark.marked) {
      selectedMark.dotColor = '#FFFFFF';
      selectedMark.selectedDotColor = '#FFFFFF';
    }
    marks[selectedDate] = selectedMark;
    return marks;
  }, [records, selectedDate]);

  const selectedRecords = useMemo(
    () =>
      records
        .filter((record) => record.date === selectedDate)
        .sort((a, b) => b.createdAt - a.createdAt),
    [records, selectedDate],
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.homeContent,
          { paddingTop: insets.top + 24, paddingBottom: 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>{dateLabel}</Text>
        <Text style={styles.title}>日历</Text>

        <View style={styles.calendarStatCard}>
          <View style={styles.calendarStatIcon}>
            <Ionicons name="flame-outline" size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.calendarStatText}>
            本月已坚持记录
            <Text style={styles.calendarStatNumber}> {monthlyRecordDays} </Text>
            天
          </Text>
        </View>

        <View style={styles.calendarCard}>
          <Calendar
            current={todayKey}
            markedDates={markedDates}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            firstDay={1}
            hideExtraDays
            enableSwipeMonths
            monthFormat="yyyy年 M月"
            theme={{
              backgroundColor: COLORS.card,
              calendarBackground: COLORS.card,
              textSectionTitleColor: COLORS.muted,
              selectedDayBackgroundColor: COLORS.primary,
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: COLORS.primary,
              dayTextColor: COLORS.text,
              textDisabledColor: COLORS.faint,
              monthTextColor: COLORS.text,
              arrowColor: COLORS.primary,
              dotColor: COLORS.primary,
              selectedDotColor: '#FFFFFF',
              textMonthFontWeight: '700',
              textDayFontSize: 14,
              textDayHeaderFontSize: 11,
            }}
            style={styles.calendarInner}
          />
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.loading} color={COLORS.primary} />
        ) : (
          <>
            <View style={styles.calendarSelectedHeader}>
              <Text style={styles.historyDateText}>
                {selectedDate === todayKey ? '今天' : formatRecordDate(selectedDate)}
              </Text>
              <Text style={styles.historyDateCount}>{selectedRecords.length} 条</Text>
            </View>

            {selectedRecords.length === 0 ? (
              <View style={styles.historyEmpty}>
                <Text style={styles.historyEmptyTitle}>这一天没有记录</Text>
                <Text style={styles.historyEmptyText}>
                  点击其他日期查看，或点击底部 + 记录一条。
                </Text>
              </View>
            ) : (
              selectedRecords.map((record) => {
                const category = CATEGORY_MAP[record.category];
                const summary = formatRecordSummary(record);
                const note = record.note.trim();
                return (
                  <Pressable
                    key={record.id}
                    onPress={() => onEditRecord(record)}
                    accessibilityRole="button"
                    accessibilityLabel={`编辑${category.label}记录，${summary}`}
                    style={({ pressed }) => [
                      styles.historyItem,
                      pressed && styles.historyItemPressed,
                    ]}
                  >
                    <View
                      style={[styles.historyItemDot, { backgroundColor: category.accent }]}
                    />
                    <View style={styles.historyItemBody}>
                      <Text
                        style={[styles.historyItemCategory, { color: category.accent }]}
                      >
                        {category.label}
                      </Text>
                      <Text style={styles.historyItemSummary} numberOfLines={2}>
                        {summary}
                      </Text>
                      {note ? (
                        <Text style={styles.historyItemNote} numberOfLines={1}>
                          {note}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.historyItemChevron}>›</Text>
                  </Pressable>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                             底部导航 & 其他 Tab                              */
/* -------------------------------------------------------------------------- */

type TabItemConfig = {
  id: TabId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const TAB_ITEMS: TabItemConfig[] = [
  { id: 'home', label: '首页', icon: 'home-outline' },
  { id: 'calendar', label: '日历', icon: 'calendar-outline' },
  { id: 'stats', label: '统计', icon: 'stats-chart-outline' },
  { id: 'profile', label: '个人', icon: 'person-outline' },
];

type BottomTabBarProps = {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
  onAddPress: () => void;
};

function BottomTabBar({ activeTab, onChangeTab, onAddPress }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const leftTabs = TAB_ITEMS.slice(0, 2);
  const rightTabs = TAB_ITEMS.slice(2);

  const renderTab = (item: TabItemConfig) => {
    const isActive = item.id === activeTab;
    return (
      <Pressable
        key={item.id}
        onPress={() => {
          triggerImpactHaptic();
          onChangeTab(item.id);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={item.label}
        style={({ pressed }) => [
          styles.tabBarItem,
          pressed && styles.tabBarItemPressed,
        ]}
      >
        <Ionicons
          name={item.icon}
          size={22}
          color={isActive ? COLORS.primary : COLORS.faint}
        />
        <Text
          style={[styles.tabBarLabel, isActive && styles.tabBarLabelActive]}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.tabBarRow}>
        {leftTabs.map(renderTab)}

        <View style={styles.tabCenterSlot}>
          <Pressable
            onPress={() => {
              triggerImpactHaptic();
              onAddPress();
            }}
            accessibilityRole="button"
            accessibilityLabel="添加记录"
            style={({ pressed }) => [
              styles.tabAddButton,
              pressed && styles.tabAddButtonPressed,
            ]}
          >
            <LinearGradient
              colors={['#6C9BFF', '#3B6EF6']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={styles.tabAddGradient}
            >
              <Ionicons name="add" size={30} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </View>

        {rightTabs.map(renderTab)}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                               统计页数据工具                                 */
/* -------------------------------------------------------------------------- */

type StatsSectionId = 'study' | 'finance' | 'habit';

const STATS_SECTIONS: { id: StatsSectionId; label: string }[] = [
  { id: 'study', label: '📊 学习分析' },
  { id: 'finance', label: '💰 财务分析' },
  { id: 'habit', label: '🏋️ 习惯分析' },
];

/** 学习趋势三条线的固定配色 */
const STATS_STUDY_COLOR = '#3B6EF6';
const STATS_ENGLISH_COLOR = '#1F9D74';
const STATS_SKILL_COLOR = '#E07B26';
const STATS_MORNING_COLOR = '#E07B26';
const STATS_EVENING_COLOR = '#7A5AF8';

/** 饼图 / 科目柱状图的配色（循环取色） */
const STATS_PIE_COLORS = [
  '#4A90E2',
  '#1F9D74',
  '#E07B26',
  '#E2555F',
  '#7A5AF8',
  '#D4519A',
  '#1D8FB3',
  '#B4BAC7',
];

const STATS_BAR_COLORS = [STATS_STUDY_COLOR, STATS_ENGLISH_COLOR, STATS_SKILL_COLOR];

type StatsDayBucket = { key: string; label: string };

/** 最近 N 天（含今天）的日期桶，label 形如 11/4 */
function getRecentDays(count: number, today: Date = new Date()): StatsDayBucket[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - (count - 1 - index),
    );
    return {
      key: getTodayKey(date),
      label: `${date.getMonth() + 1}/${date.getDate()}`,
    };
  });
}

/** 当前月份前缀，形如 2026-11 */
function getMonthKey(date: Date = new Date()): string {
  return getTodayKey(date).slice(0, 7);
}

/** X 轴标签太挤时隔天显示（保留首尾），其余位置留空 */
function thinAxisLabels(labels: string[], maxLabels = 4): string[] {
  if (labels.length <= maxLabels) {
    return labels;
  }
  return labels.map((label, index) => (index % 2 === 0 ? label : ''));
}

/** 给十六进制颜色叠加透明度，用于 chart-kit 的 color 回调 */
function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 统一图表配置：纯白背景、无网格线、无 Y 轴数字 */
function createChartConfig(accent: string) {
  return {
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    backgroundGradientFromOpacity: 1,
    backgroundGradientToOpacity: 1,
    decimalPlaces: 0,
    color: (opacity = 1) => withAlpha(accent, opacity),
    labelColor: (opacity = 1) => `rgba(123, 131, 149, ${opacity})`,
    propsForBackgroundLines: { stroke: 'transparent' },
    propsForLabels: { fontSize: 10 },
    propsForDots: { r: '3.5' },
    paddingRight: 12,
    paddingTop: 12,
  };
}

/** 学习类记录（专业课 / 拓展技能 / 英语）且单位为分钟 */
function isMinuteStudyRecord(record: GrowthRecord): boolean {
  return (
    (record.category === 'study' ||
      record.category === 'skill' ||
      record.category === 'english') &&
    (!record.unit || record.unit === '分钟')
  );
}

/** 本月支出按 method 分组降序；超过 8 类时把尾部合并成「其他」 */
function summarizeMonthExpense(
  records: GrowthRecord[],
  monthKey: string,
): { name: string; amount: number }[] {
  const totals = new Map<string, number>();
  records.forEach((record) => {
    if (record.category !== 'finance' || record.subject === 'income') {
      return;
    }
    if (!record.date.startsWith(monthKey)) {
      return;
    }
    const method = record.method?.trim() || '未分类';
    totals.set(method, roundMoney((totals.get(method) ?? 0) + Math.abs(record.value)));
  });

  const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  if (sorted.length <= 8) {
    return sorted.map(([name, amount]) => ({ name, amount }));
  }
  const head = sorted.slice(0, 7).map(([name, amount]) => ({ name, amount }));
  const rest = sorted
    .slice(7)
    .reduce((sum, [, amount]) => roundMoney(sum + amount), 0);
  return [...head, { name: '其他', amount: rest }];
}


type StatsCardProps = {
  title: string;
  badge?: string;
  children: ReactNode;
};

/** 统计卡片：纯白、大圆角、轻微阴影 */
function StatsCard({ title, badge, children }: StatsCardProps) {
  return (
    <View style={styles.statsChartCard}>
      <View style={styles.statsChartHeader}>
        <Text style={styles.statsChartTitle}>{title}</Text>
        {badge ? (
          <View style={styles.statsChartBadge}>
            <Text style={styles.statsChartBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

type StatsEmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
};

/** 卡片内空状态 */
function StatsEmptyState({ icon, title, hint }: StatsEmptyStateProps) {
  return (
    <View style={styles.statsChartEmpty}>
      <View style={styles.statsChartEmptyIcon}>
        <Ionicons name={icon} size={30} color={COLORS.primary} />
      </View>
      <Text style={styles.statsChartEmptyTitle}>{title}</Text>
      <Text style={styles.statsChartEmptyText}>{hint}</Text>
    </View>
  );
}

type StatsLegendItemProps = {
  color: string;
  label: string;
};

/** 自绘图例（chart-kit 自带图例样式不可控） */
function StatsLegendItem({ color, label }: StatsLegendItemProps) {
  return (
    <View style={styles.statsLegendItem}>
      <View style={[styles.statsLegendDot, { backgroundColor: color }]} />
      <Text style={styles.statsLegendText}>{label}</Text>
    </View>
  );
}

type StatsGroupedBarsProps = {
  labels: string[];
  series: { values: number[]; color: string }[];
};

/**
 * 简易分组柱状图：chart-kit 的 BarChart 只渲染第一组数据，
 * 这里用纯 View 实现「收入 / 支出」并排对比，无网格线、无 Y 轴数字。
 */
function StatsGroupedBars({ labels, series }: StatsGroupedBarsProps) {
  const maxValue = Math.max(
    1,
    ...series.reduce<number[]>((all, item) => [...all, ...item.values], []),
  );

  return (
    <View style={styles.statsGroupedChart}>
      {labels.map((label, index) => (
        <View key={`${label}-${index}`} style={styles.statsGroupedColumn}>
          <View style={styles.statsGroupedBars}>
            {series.map((item, seriesIndex) => {
              const value = item.values[index] ?? 0;
              return (
                <View
                  key={seriesIndex}
                  style={[
                    styles.statsGroupedBar,
                    {
                      height:
                        value > 0
                          ? Math.max(4, Math.round((value / maxValue) * 118))
                          : 2,
                      backgroundColor: item.color,
                      opacity: value > 0 ? 1 : 0.2,
                    },
                  ]}
                />
              );
            })}
          </View>
          <Text style={styles.statsGroupedLabel} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

type StatsSectionProps = {
  records: GrowthRecord[];
  chartWidth: number;
};

type StatsScreenProps = {
  records: GrowthRecord[];
};

function StatsScreen({ records }: StatsScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(200, width - H_PADDING * 2 - 32);
  const [section, setSection] = useState<StatsSectionId>('study');

  const handleSectionPress = useCallback((next: StatsSectionId) => {
    triggerImpactHaptic();
    setSection(next);
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.homeContent,
          { paddingTop: insets.top + 24, paddingBottom: 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>成长统计</Text>
        <Text style={styles.title}>数据分析</Text>
        <Text style={styles.statsSubtitle}>多维度看清你的节奏与投入</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsSegments}
        >
          {STATS_SECTIONS.map((item) => {
            const isActive = item.id === section;
            return (
              <Pressable
                key={item.id}
                onPress={() => handleSectionPress(item.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={item.label}
                style={({ pressed }) => [
                  styles.statsSegment,
                  isActive && styles.statsSegmentActive,
                  pressed && styles.statsSegmentPressed,
                ]}
              >
                <Text
                  style={[
                    styles.statsSegmentText,
                    isActive && styles.statsSegmentTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 只挂载当前维度的图表，避免一次性渲染所有数据造成卡顿 */}
        {section === 'study' ? (
          <StudySection records={records} chartWidth={chartWidth} />
        ) : section === 'finance' ? (
          <FinanceSection records={records} chartWidth={chartWidth} />
        ) : (
          <HabitSection records={records} chartWidth={chartWidth} />
        )}

        <Text style={styles.statsFootnote}>
          学习图表仅统计单位为分钟的记录；财务金额按绝对值累计
        </Text>
      </ScrollView>
    </View>
  );
}

/** 学习分析：最近 7 天三线趋势 + 本月科目耗时 TOP 3 */
function StudySection({ records, chartWidth }: StatsSectionProps) {
  const stats = useMemo(() => {
    const days = getRecentDays(7);
    const monthKey = getMonthKey();
    const studyByDate = new Map<string, number>();
    const englishByDate = new Map<string, number>();
    const skillByDate = new Map<string, number>();
    const subjectTotals = new Map<string, number>();

    records.forEach((record) => {
      if (!isMinuteStudyRecord(record)) {
        return;
      }
      if (record.category === 'study') {
        studyByDate.set(record.date, (studyByDate.get(record.date) ?? 0) + record.value);
      } else if (record.category === 'english') {
        englishByDate.set(record.date, (englishByDate.get(record.date) ?? 0) + record.value);
      } else {
        skillByDate.set(record.date, (skillByDate.get(record.date) ?? 0) + record.value);
      }

      if (
        (record.category === 'study' || record.category === 'skill') &&
        record.date.startsWith(monthKey)
      ) {
        const subject = record.subject?.trim() || '未命名';
        subjectTotals.set(subject, (subjectTotals.get(subject) ?? 0) + record.value);
      }
    });

    const toSeries = (bucket: Map<string, number>) =>
      days.map((day) => Math.round(bucket.get(day.key) ?? 0));

    const studySeries = toSeries(studyByDate);
    const englishSeries = toSeries(englishByDate);
    const skillSeries = toSeries(skillByDate);

    const topSubjects = Array.from(subjectTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, minutes]) => ({ name, minutes: Math.round(minutes) }));

    return {
      labels: thinAxisLabels(days.map((day) => day.label)),
      studySeries,
      englishSeries,
      skillSeries,
      topSubjects,
      maxSubjectMinutes: topSubjects[0]?.minutes ?? 0,
      hasTrend: [...studySeries, ...englishSeries, ...skillSeries].some(
        (value) => value > 0,
      ),
    };
  }, [records]);

  const chartConfig = createChartConfig(STATS_STUDY_COLOR);

  return (
    <>
      <StatsCard title="最近 7 天学习趋势" badge="分钟">
        {stats.hasTrend ? (
          <>
            <View style={styles.statsLegendRow}>
              <StatsLegendItem color={STATS_STUDY_COLOR} label="专业课" />
              <StatsLegendItem color={STATS_ENGLISH_COLOR} label="英语" />
              <StatsLegendItem color={STATS_SKILL_COLOR} label="拓展技能" />
            </View>
            <LineChart
              data={{
                labels: stats.labels,
                datasets: [
                  {
                    data: stats.studySeries,
                    color: (opacity = 1) => withAlpha(STATS_STUDY_COLOR, opacity),
                    strokeWidth: 2.5,
                  },
                  {
                    data: stats.englishSeries,
                    color: (opacity = 1) => withAlpha(STATS_ENGLISH_COLOR, opacity),
                    strokeWidth: 2.5,
                  },
                  {
                    data: stats.skillSeries,
                    color: (opacity = 1) => withAlpha(STATS_SKILL_COLOR, opacity),
                    strokeWidth: 2.5,
                  },
                ],
              }}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              bezier
              fromZero
              segments={4}
              withDots
              withShadow={false}
              withInnerLines={false}
              withOuterLines={false}
              withHorizontalLines={false}
              withVerticalLines={false}
              withHorizontalLabels={false}
              withVerticalLabels
              style={styles.statsChart}
            />
          </>
        ) : (
          <StatsEmptyState
            icon="trending-up-outline"
            title="最近 7 天还没有学习记录"
            hint="打卡后这里会出现专业课 / 英语 / 拓展技能三条趋势线"
          />
        )}
      </StatsCard>

      <StatsCard title="本月科目耗时 TOP 3" badge="分钟">
        {stats.topSubjects.length > 0 ? (
          <View style={styles.statsBarList}>
            {stats.topSubjects.map((item, index) => (
              <View key={item.name} style={styles.statsBarRow}>
                <View style={styles.statsBarHeader}>
                  <Text style={styles.statsBarName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.statsBarValue}>{item.minutes} 分钟</Text>
                </View>
                <View style={styles.statsBarTrack}>
                  <View
                    style={[
                      styles.statsBarFill,
                      {
                        width: `${Math.max(
                          6,
                          Math.round(
                            (item.minutes / (stats.maxSubjectMinutes || 1)) * 100,
                          ),
                        )}%`,
                        backgroundColor:
                          STATS_BAR_COLORS[index % STATS_BAR_COLORS.length],
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <StatsEmptyState
            icon="bar-chart-outline"
            title="本月还没有学习记录"
            hint="按科目累计的学习时长会显示在这里"
          />
        )}
      </StatsCard>
    </>
  );
}

/** 财务分析：最近 7 天收支对比 + 本月支出分类环形图 */
function FinanceSection({ records, chartWidth }: StatsSectionProps) {
  const stats = useMemo(() => {
    const days = getRecentDays(7);
    const monthKey = getMonthKey();
    const incomeByDate = new Map<string, number>();
    const expenseByDate = new Map<string, number>();
    let monthExpenseTotal = 0;

    records.forEach((record) => {
      if (record.category !== 'finance') {
        return;
      }
      const amount = Math.abs(record.value);
      if (record.subject === 'income') {
        incomeByDate.set(record.date, (incomeByDate.get(record.date) ?? 0) + amount);
        return;
      }
      expenseByDate.set(record.date, (expenseByDate.get(record.date) ?? 0) + amount);
      if (record.date.startsWith(monthKey)) {
        monthExpenseTotal += amount;
      }
    });

    const toSeries = (bucket: Map<string, number>) =>
      days.map((day) => roundMoney(bucket.get(day.key) ?? 0));

    const incomeSeries = toSeries(incomeByDate);
    const expenseSeries = toSeries(expenseByDate);

    return {
      labels: thinAxisLabels(days.map((day) => day.label)),
      incomeSeries,
      expenseSeries,
      hasCompare: [...incomeSeries, ...expenseSeries].some((value) => value > 0),
      monthExpense: summarizeMonthExpense(records, monthKey),
      monthExpenseTotal: roundMoney(monthExpenseTotal),
    };
  }, [records]);

  const chartConfig = createChartConfig(FINANCE_INCOME_COLOR);
  const pieHeight = 200;
  const holeSize = 96;
  const pieData = stats.monthExpense.map((item, index) => ({
    name: item.name,
    population: item.amount,
    color: STATS_PIE_COLORS[index % STATS_PIE_COLORS.length],
    legendFontColor: COLORS.subText,
    legendFontSize: 12,
  }));

  return (
    <>
      <StatsCard title="最近 7 天收支对比" badge="元">
        {stats.hasCompare ? (
          <>
            <View style={styles.statsLegendRow}>
              <StatsLegendItem color={FINANCE_INCOME_COLOR} label="收入" />
              <StatsLegendItem color={FINANCE_EXPENSE_COLOR} label="支出" />
            </View>
            <StatsGroupedBars
              labels={stats.labels}
              series={[
                { values: stats.incomeSeries, color: FINANCE_INCOME_COLOR },
                { values: stats.expenseSeries, color: FINANCE_EXPENSE_COLOR },
              ]}
            />
          </>
        ) : (
          <StatsEmptyState
            icon="swap-vertical-outline"
            title="最近 7 天还没有收支记录"
            hint="记一笔账，这里就会显示收入与支出对比"
          />
        )}
      </StatsCard>

      <StatsCard title="本月支出分类" badge="元">
        {stats.monthExpense.length > 0 ? (
          <>
            <View style={styles.statsPieWrap}>
              <PieChart
                data={pieData}
                width={chartWidth}
                height={pieHeight}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft={String(Math.round(chartWidth / 4))}
                hasLegend={false}
                chartConfig={chartConfig}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.statsPieHole,
                  {
                    width: holeSize,
                    height: holeSize,
                    borderRadius: holeSize / 2,
                    left: chartWidth / 2 - holeSize / 2,
                    top: pieHeight / 2 - holeSize / 2,
                  },
                ]}
              >
                <Text style={styles.statsPieHoleLabel}>本月支出</Text>
                <Text
                  style={styles.statsPieHoleValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  ¥{formatMoney(stats.monthExpenseTotal)}
                </Text>
              </View>
            </View>

            <View style={styles.statsPieLegend}>
              {stats.monthExpense.map((item, index) => {
                const percent =
                  stats.monthExpenseTotal > 0
                    ? Math.round((item.amount / stats.monthExpenseTotal) * 100)
                    : 0;
                return (
                  <View key={item.name} style={styles.statsPieLegendRow}>
                    <View
                      style={[
                        styles.statsLegendDot,
                        {
                          backgroundColor:
                            STATS_PIE_COLORS[index % STATS_PIE_COLORS.length],
                        },
                      ]}
                    />
                    <Text style={styles.statsPieLegendName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.statsPieLegendValue}>
                      ¥{formatMoney(item.amount)}
                    </Text>
                    <Text style={styles.statsPieLegendPercent}>{percent}%</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <StatsEmptyState
            icon="pie-chart-outline"
            title="本月还没有支出记录"
            hint="按类别统计的支出占比会显示在这里"
          />
        )}
      </StatsCard>
    </>
  );
}

const STATS_FITNESS_COLOR = '#E2555F';

/** 习惯分析：最近 7 天健身组数 + 本月护肤打卡进度 */
function HabitSection({ records, chartWidth }: StatsSectionProps) {
  const stats = useMemo(() => {
    const days = getRecentDays(7);
    const monthKey = getMonthKey();
    const setsByDate = new Map<string, number>();
    let morningCount = 0;
    let eveningCount = 0;

    records.forEach((record) => {
      if (record.category === 'fitness') {
        setsByDate.set(
          record.date,
          (setsByDate.get(record.date) ?? 0) + parseFitnessSets(record.method),
        );
        return;
      }
      if (record.category !== 'skincare' || !record.date.startsWith(monthKey)) {
        return;
      }
      if (record.subject === 'evening') {
        eveningCount += 1;
      } else if (record.subject === 'morning') {
        morningCount += 1;
      }
    });

    const setsSeries = days.map((day) => Math.round(setsByDate.get(day.key) ?? 0));
    const elapsedDays = new Date().getDate();

    return {
      labels: thinAxisLabels(days.map((day) => day.label)),
      setsSeries,
      hasFitness: setsSeries.some((value) => value > 0),
      morningCount,
      eveningCount,
      elapsedDays,
      hasSkincare: morningCount + eveningCount > 0,
    };
  }, [records]);

  const chartConfig = createChartConfig(STATS_FITNESS_COLOR);
  const barChartConfig = { ...chartConfig, barPercentage: 0.6 };

  const renderSkincareProgress = (label: string, count: number, color: string) => {
    const ratio = stats.elapsedDays > 0 ? Math.min(1, count / stats.elapsedDays) : 0;
    return (
      <View style={styles.statsProgressRow}>
        <View style={styles.statsProgressHeader}>
          <Text style={styles.statsProgressLabel}>{label}</Text>
          <Text style={[styles.statsProgressValue, { color }]}>{count} 次</Text>
        </View>
        <View style={styles.statsProgressTrack}>
          <View
            style={[
              styles.statsProgressFill,
              { width: `${Math.round(ratio * 100)}%`, backgroundColor: color },
            ]}
          />
        </View>
      </View>
    );
  };

  return (
    <>
      <StatsCard title="最近 7 天健身组数" badge="组">
        {stats.hasFitness ? (
          <BarChart
            data={{
              labels: stats.labels,
              datasets: [
                {
                  data: stats.setsSeries,
                  color: (opacity = 1) => withAlpha(STATS_FITNESS_COLOR, opacity),
                },
              ],
            }}
            width={chartWidth}
            height={200}
            chartConfig={barChartConfig}
            fromZero
            segments={3}
            withInnerLines={false}
            withHorizontalLabels={false}
            withVerticalLabels
            showBarTops={false}
            yAxisLabel=""
            yAxisSuffix=""
            style={styles.statsChart}
          />
        ) : (
          <StatsEmptyState
            icon="barbell-outline"
            title="最近 7 天还没有健身记录"
            hint="记录力量训练后这里会显示每天的组数"
          />
        )}
      </StatsCard>

      <StatsCard title="本月护肤打卡" badge="次">
        {stats.hasSkincare ? (
          <View style={styles.statsProgressList}>
            {renderSkincareProgress('☀️ 早间打卡', stats.morningCount, STATS_MORNING_COLOR)}
            {renderSkincareProgress('🌙 晚间打卡', stats.eveningCount, STATS_EVENING_COLOR)}
            <Text style={styles.statsProgressHint}>
              本月已过 {stats.elapsedDays} 天，进度按天计算
            </Text>
          </View>
        ) : (
          <StatsEmptyState
            icon="sparkles-outline"
            title="本月还没有护肤打卡"
            hint="早间 / 晚间的打卡次数会显示在这里"
          />
        )}
      </StatsCard>
    </>
  );
}

type ProfileScreenProps = {
  records: GrowthRecord[];
  isLoading: boolean;
  /** 打开「管理自定义标签」全屏页 */
  onOpenTagManager: () => void;
  /** 打开「关于 Go」全屏页 */
  onOpenAbout: () => void;
};

/** 个人中心：使用天数、连续打卡 / 累计记录 + 设置入口 */
function ProfileScreen({
  records,
  isLoading,
  onOpenTagManager,
  onOpenAbout,
}: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const usageDays = useMemo(() => getUsageDays(records), [records]);
  const streakDays = useMemo(() => getStreakDays(records), [records]);

  const handleManageTagsPress = useCallback(() => {
    triggerImpactHaptic();
    onOpenTagManager();
  }, [onOpenTagManager]);

  const handleAboutPress = useCallback(() => {
    triggerImpactHaptic();
    onOpenAbout();
  }, [onOpenAbout]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.homeContent,
          { paddingTop: insets.top + 36, paddingBottom: 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator style={styles.loading} color={COLORS.primary} />
        ) : (
          <>
            <View style={styles.profileHeader}>
              <View style={styles.profileAvatar}>
                <Ionicons name="person" size={46} color={COLORS.primary} />
              </View>
              <Text style={styles.profileName}>你好，用户</Text>
              <Text style={styles.profileSubtitle}>
                这是你使用 Go 的第 {usageDays} 天
              </Text>
            </View>

            <View style={styles.profileStatsRow}>
              <View style={[styles.profileStatCard, { backgroundColor: '#FFF4E8' }]}>
                <Text style={styles.profileStatLabel}>🔥 连续打卡</Text>
                <Text style={styles.profileStatValue}>
                  {streakDays}
                  <Text style={styles.profileStatUnit}> 天</Text>
                </Text>
              </View>
              <View style={[styles.profileStatCard, { backgroundColor: '#EAF0FF' }]}>
                <Text style={styles.profileStatLabel}>📝 累计记录</Text>
                <Text style={styles.profileStatValue}>
                  {records.length}
                  <Text style={styles.profileStatUnit}> 条</Text>
                </Text>
              </View>
            </View>

            <View style={styles.profileMenuCard}>
              <Pressable
                onPress={handleManageTagsPress}
                accessibilityRole="button"
                accessibilityLabel="管理自定义标签"
                style={({ pressed }) => [
                  styles.profileMenuRow,
                  pressed && styles.profileMenuRowPressed,
                ]}
              >
                <View style={styles.profileMenuIconWrap}>
                  <Ionicons name="pricetags-outline" size={18} color={COLORS.primary} />
                </View>
                <Text style={styles.profileMenuLabel}>管理自定义标签</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.faint} />
              </Pressable>

              <View style={styles.profileMenuDivider} />

              <Pressable
                onPress={handleAboutPress}
                accessibilityRole="button"
                accessibilityLabel="关于 Go"
                style={({ pressed }) => [
                  styles.profileMenuRow,
                  pressed && styles.profileMenuRowPressed,
                ]}
              >
                <View style={[styles.profileMenuIconWrap, { backgroundColor: '#F2EDFF' }]}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color="#7A5AF8"
                  />
                </View>
                <Text style={styles.profileMenuLabel}>关于 Go</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.faint} />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                          个人中心 · 标签管理                                */
/* -------------------------------------------------------------------------- */

type TagGroupConfig = {
  key: string;
  title: string;
  tags: string[];
  onChange: (tags: string[]) => void;
};

type TagManagerScreenProps = {
  customMethods: string[];
  customSkillMethods: string[];
  customEnglishMethods: string[];
  customFitnessActions: string[];
  customFinanceCategories: string[];
  onCustomMethodsChange: (tags: string[]) => void;
  onCustomSkillMethodsChange: (tags: string[]) => void;
  onCustomEnglishMethodsChange: (tags: string[]) => void;
  onCustomFitnessActionsChange: (tags: string[]) => void;
  onCustomFinanceCategoriesChange: (tags: string[]) => void;
  onBack: () => void;
};

/**
 * 管理自定义标签：按分类分组列出用户自己添加的标签。
 * 删除时二次确认，确认后通过上层回调同时更新内存状态与 AsyncStorage。
 */
function TagManagerScreen({
  customMethods,
  customSkillMethods,
  customEnglishMethods,
  customFitnessActions,
  customFinanceCategories,
  onCustomMethodsChange,
  onCustomSkillMethodsChange,
  onCustomEnglishMethodsChange,
  onCustomFitnessActionsChange,
  onCustomFinanceCategoriesChange,
  onBack,
}: TagManagerScreenProps) {
  const insets = useSafeAreaInsets();

  const groups: TagGroupConfig[] = useMemo(
    () => [
      {
        key: 'study',
        title: '专业课学习方式',
        tags: customMethods,
        onChange: onCustomMethodsChange,
      },
      {
        key: 'skill',
        title: '拓展技能学习方式',
        tags: customSkillMethods,
        onChange: onCustomSkillMethodsChange,
      },
      {
        key: 'finance',
        title: '理财类别',
        tags: customFinanceCategories,
        onChange: onCustomFinanceCategoriesChange,
      },
      {
        key: 'english',
        title: '英语学习方式',
        tags: customEnglishMethods,
        onChange: onCustomEnglishMethodsChange,
      },
      {
        key: 'fitness',
        title: '健身动作',
        tags: customFitnessActions,
        onChange: onCustomFitnessActionsChange,
      },
    ],
    [
      customMethods,
      customSkillMethods,
      customEnglishMethods,
      customFitnessActions,
      customFinanceCategories,
      onCustomMethodsChange,
      onCustomSkillMethodsChange,
      onCustomEnglishMethodsChange,
      onCustomFitnessActionsChange,
      onCustomFinanceCategoriesChange,
    ],
  );

  const handleBackPress = useCallback(() => {
    triggerImpactHaptic();
    onBack();
  }, [onBack]);

  const handleRemovePress = useCallback((group: TagGroupConfig, tag: string) => {
    triggerImpactHaptic();
    Alert.alert('删除自定义标签', `确定要删除「${tag}」吗？删除后不可恢复。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          group.onChange(group.tags.filter((item) => item !== tag));
          triggerSuccessHaptic();
        },
      },
    ]);
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.subScreenHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={handleBackPress}
          accessibilityRole="button"
          accessibilityLabel="返回个人中心"
          style={({ pressed }) => [
            styles.subScreenBack,
            pressed && styles.subScreenBackPressed,
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
          <Text style={styles.subScreenBackText}>返回</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.tagManagerContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subScreenTitle}>管理自定义标签</Text>
        <Text style={styles.subScreenSubtitle}>
          这里只列出你手动添加的标签，系统预设不可删除
        </Text>

        {groups.map((group) => (
          <View key={group.key} style={styles.tagGroup}>
            <Text style={styles.tagGroupLabel}>{group.title}</Text>
            <View style={styles.tagGroupCard}>
              {group.tags.length === 0 ? (
                <Text style={styles.tagEmptyText}>暂无自定义标签</Text>
              ) : (
                group.tags.map((tag, index) => (
                  <View key={tag}>
                    {index > 0 ? <View style={styles.tagRowDivider} /> : null}
                    <View style={styles.tagRow}>
                      <Text style={styles.tagRowText} numberOfLines={1}>
                        {tag}
                      </Text>
                      <Pressable
                        onPress={() => handleRemovePress(group, tag)}
                        accessibilityRole="button"
                        accessibilityLabel={`删除自定义标签 ${tag}`}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.tagRemoveButton,
                          pressed && styles.tagRemoveButtonPressed,
                        ]}
                      >
                        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                           个人中心 · 关于 Go                                */
/* -------------------------------------------------------------------------- */

type AboutScreenProps = {
  onBack: () => void;
};

/** 关于页：渐变 App 图标 + 名称 + Slogan + 来自 app.json 的版本号 */
function AboutScreen({ onBack }: AboutScreenProps) {
  const insets = useSafeAreaInsets();
  // 版本号读取 app.json 的 expo.version（expo-constants），不做硬编码
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleBackPress = useCallback(() => {
    triggerImpactHaptic();
    onBack();
  }, [onBack]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.subScreenHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={handleBackPress}
          accessibilityRole="button"
          accessibilityLabel="返回个人中心"
          style={({ pressed }) => [
            styles.subScreenBack,
            pressed && styles.subScreenBackPressed,
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
          <Text style={styles.subScreenBackText}>返回</Text>
        </Pressable>
      </View>

      <View style={styles.aboutContent}>
        <LinearGradient
          colors={['#6C9BFF', '#4A90E2', '#357ABD']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.aboutIcon}
        >
          <Text style={styles.aboutIconText} allowFontScaling={false}>
            Go
          </Text>
        </LinearGradient>

        <Text style={styles.aboutTitle}>Go</Text>
        <Text style={styles.aboutSlogan}>陪伴你的每一次微小进步</Text>
      </View>

      <View style={[styles.aboutFooter, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.aboutVersion}>Version {appVersion}</Text>
      </View>
    </View>
  );
}

type JournalCardBodyProps = {
  entry: GrowthRecord | null;
  todayKey: string;
  accent: string;
};

/** 首页「日记」卡片的内容区域：优先标题，其次正文摘要 */
function JournalCardBody({ entry, todayKey, accent }: JournalCardBodyProps) {
  if (!entry) {
    return <Text style={styles.cardEmpty}>暂无记录</Text>;
  }

  const title = entry.subject?.trim();
  const body = entry.note.trim();
  const preview = title || (body.length > 15 ? `${body.slice(0, 15)}…` : body) || '无标题';

  return (
    <>
      <Text style={[styles.cardSubjects, { color: accent }]} numberOfLines={2}>
        {preview}
      </Text>
      <Text style={styles.cardMeta}>
        {entry.date === todayKey ? '今天' : formatRecordDate(entry.date)}
      </Text>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                              表单输入基础组件                                */
/* -------------------------------------------------------------------------- */

/** 复合输入行（金额 / 重量等 + 单位）把聚焦状态回传给外层容器 */
type FieldFocusHandler = (focused: boolean) => void;

const FieldFocusContext = createContext<FieldFocusHandler | null>(null);

type FieldShellProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 错误态：红色细边框 + 淡红底色 */
  hasError?: boolean;
};

/**
 * 复合输入行的填色容器：内部 TextInput 通过 context 上报聚焦状态，
 * 聚焦时整行变纯白并浮起一层淡主题色阴影。
 */
function FieldShell({ children, style, hasError }: FieldShellProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <FieldFocusContext.Provider value={setIsFocused}>
      <View
        style={[
          styles.fieldShell,
          isFocused && styles.fieldShellFocused,
          hasError && styles.fieldShellError,
          style,
        ]}
      >
        {children}
      </View>
    </FieldFocusContext.Provider>
  );
}

type FormTextInputProps = TextInputProps & {
  /** 错误态：红色细边框 + 淡红底色 */
  hasError?: boolean;
};

/**
 * 全局表单输入框：
 * - 无边框填色 #F3F4F6、圆角 12、paddingHorizontal 16 / paddingVertical 14
 * - 聚焦时底色变纯白，并加一层淡主题色描边 + 阴影
 * - 放在 FieldShell 内时自动退化为「透明 + 无内边距」，由外层负责填色
 */
function FormTextInput({ style, hasError, onFocus, onBlur, ...rest }: FormTextInputProps) {
  const fieldFocusHandler = useContext(FieldFocusContext);
  const [isFocused, setIsFocused] = useState(false);
  // 被 FieldShell 包裹时只负责上报聚焦，不再自绘背景
  const isBare = fieldFocusHandler !== null;

  return (
    <TextInput
      {...rest}
      onFocus={(event) => {
        setIsFocused(true);
        fieldFocusHandler?.(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setIsFocused(false);
        fieldFocusHandler?.(false);
        onBlur?.(event);
      }}
      style={[
        isBare ? styles.textInputBare : styles.textField,
        isFocused && !isBare && styles.textFieldFocused,
        hasError && !isBare && styles.textFieldError,
        style,
      ]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                                添加记录页                                   */
/* -------------------------------------------------------------------------- */

type SkincareCardBodyProps = {
  status: SkincareStatus;
};

/** 首页「护肤」卡片：早间 / 晚间打卡状态 */
function SkincareCardBody({ status }: SkincareCardBodyProps) {
  return (
    <View style={styles.skincareCardList}>
      {SKINCARE_SLOTS.map((slot) => (
        <Text
          key={slot.id}
          style={[
            styles.skincareCardStatus,
            status[slot.id] && styles.skincareCardStatusDone,
          ]}
        >
          {slot.shortLabel}：{status[slot.id] ? '✅' : '⬜'}
        </Text>
      ))}
    </View>
  );
}

type EnglishCardBodyProps = {
  summary: EnglishSummary;
};

/** 首页「英语」卡片：按学习方式分项汇总 */
function EnglishCardBody({ summary }: EnglishCardBodyProps) {
  if (summary.count === 0) {
    return <Text style={styles.cardEmpty}>今日未打卡</Text>;
  }

  const visibleItems = summary.items.slice(0, 3);
  const summaryText = visibleItems
    .map((item) => {
      const label = ENGLISH_METHOD_LABELS[item.method] ?? item.method;
      return `${label}：${roundMoney(item.value)}${item.unit}`;
    })
    .join(' | ');

  return (
    <Text style={styles.englishCardSummary} numberOfLines={3} ellipsizeMode="tail">
      {summaryText}
      {summary.items.length > 3 ? ' 等' : ''}
    </Text>
  );
}

type FitnessCardBodyProps = {
  summary: FitnessSummary;
  accent: string;
};

/** 首页「健身」卡片：重点动作 + 总组数 */
function FitnessCardBody({ summary, accent }: FitnessCardBodyProps) {
  if (summary.count === 0) {
    return <Text style={styles.cardEmpty}>今日未练</Text>;
  }

  const visibleActions = summary.actions.slice(0, 3);
  const actionText = `${visibleActions.join(', ')}${
    summary.actions.length > 3 ? ' 等' : ''
  }`;

  return (
    <>
      <Text style={[styles.cardSubjects, { color: accent }]} numberOfLines={3}>
        重点动作：{actionText}
      </Text>
      <Text style={styles.cardMeta}>共 {summary.totalSets} 组</Text>
    </>
  );
}

type StudyLikeCardBodyProps = {
  summary: StudyLikeSummary;
  accent: string;
};

/** 首页「专业课 / 拓展技能」卡片共用的数值区域 */
function StudyLikeCardBody({ summary, accent }: StudyLikeCardBodyProps) {
  if (summary.count === 0) {
    return <Text style={styles.cardEmpty}>暂无记录</Text>;
  }

  const subjectText = summary.subjects.slice(0, 3).join('、');
  const subjectLabel = subjectText
    ? `重点：${subjectText}${summary.subjects.length > 3 ? ' 等' : ''}`
    : '多种记录';

  return (
    <>
      {summary.minutes !== null ? (
        <Text style={[styles.cardValue, { color: accent }]}>
          {summary.minutes}
          <Text style={styles.cardUnit}> 分钟</Text>
        </Text>
      ) : (
        <Text style={[styles.cardSubjects, { color: accent }]} numberOfLines={2}>
          {subjectLabel}
        </Text>
      )}
      <Text style={styles.cardMeta}>共 {summary.count} 条记录</Text>
    </>
  );
}

type FinanceCardBodyProps = {
  summary: FinanceSummary;
};

/** 首页「理财」卡片：今日收支概览 + 结余（负红 / 正绿 / 0 黑） */
function FinanceCardBody({ summary }: FinanceCardBodyProps) {
  if (summary.count === 0) {
    return <Text style={styles.cardEmpty}>暂无记录</Text>;
  }

  const parts: string[] = [];
  if (summary.expense > 0) {
    parts.push(`支出 ¥${formatMoney(summary.expense)}`);
  }
  if (summary.income > 0) {
    parts.push(`收入 ¥${formatMoney(summary.income)}`);
  }

  return (
    <>
      {parts.length > 0 ? (
        <Text
          style={styles.financeBreakdown}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {parts.join(' | ')}
        </Text>
      ) : null}
      <Text
        style={[styles.financeBalance, { color: getBalanceColor(summary.balance) }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        今日结余：{formatBalance(summary.balance)}
      </Text>
      <Text style={styles.cardMeta}>{summary.count} 条记录</Text>
    </>
  );
}

type AddRecordScreenProps = {
  initialCategory: CategoryId | null;
  editingRecord: GrowthRecord | null;
  customMethods: string[];
  customSkillMethods: string[];
  customEnglishMethods: string[];
  customFitnessActions: string[];
  customFinanceCategories: string[];
  skincareStatus: SkincareStatus;
  onCustomMethodsChange: (tags: string[]) => void;
  onCustomSkillMethodsChange: (tags: string[]) => void;
  onCustomEnglishMethodsChange: (tags: string[]) => void;
  onCustomFitnessActionsChange: (tags: string[]) => void;
  onCustomFinanceCategoriesChange: (tags: string[]) => void;
  onSkincareCheckIn: (slot: SkincareSlot) => Promise<void>;
  onSkincareCancel: (slot: SkincareSlot) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBack: () => void;
  onSave: (input: SaveInput) => Promise<void>;
};

function AddRecordScreen({
  initialCategory,
  editingRecord,
  customMethods,
  customSkillMethods,
  customEnglishMethods,
  customFitnessActions,
  customFinanceCategories,
  skincareStatus,
  onCustomMethodsChange,
  onCustomSkillMethodsChange,
  onCustomEnglishMethodsChange,
  onCustomFitnessActionsChange,
  onCustomFinanceCategoriesChange,
  onSkincareCheckIn,
  onSkincareCancel,
  onDelete,
  onBack,
  onSave,
}: AddRecordScreenProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const chipWidth = (width - H_PADDING * 2 - CHIP_GAP * 2) / 3;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const journalBodyHeight = Math.max(220, Math.min(340, height * 0.32));

  const initialEditDate = editingRecord
    ? parseDateKey(editingRecord.date)
    : normalizeDate(new Date());
  const initialFitnessParts = parseFitnessMethod(
    editingRecord?.category === 'fitness' ? editingRecord.method : undefined,
  );

  const [category, setCategory] = useState<CategoryId | null>(initialCategory);
  const [valueInput, setValueInput] = useState(() =>
    editingRecord &&
    (isStudyLikeCategory(editingRecord.category) || editingRecord.category === 'english')
      ? String(editingRecord.value)
      : '',
  );
  const [note, setNote] = useState(editingRecord?.note ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const translateX = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  /** 页面向右飞出后返回上一页 */
  const closeWithAnimation = useCallback(() => {
    if (isClosingRef.current) {
      return;
    }
    isClosingRef.current = true;
    Keyboard.dismiss();
    translateX.stopAnimation();
    overlayOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: width + 40,
        duration: 230,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0.3,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onBack();
    });
  }, [onBack, overlayOpacity, translateX, width]);

  /** 松手未达到阈值时弹回原位 */
  const springBack = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        damping: 20,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [overlayOpacity, translateX]);

  // iOS 左边缘右滑：跟手位移 + 遮罩 + 速度/距离判定返回
  const iosBackPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          if (Platform.OS !== 'ios' || isClosingRef.current) {
            return false;
          }
          // x0 等价于触摸起始点的 pageX，严格限制在左边缘 30px 内
          const startedAtLeftEdge = gestureState.x0 < 30;
          const movingRight = gestureState.dx > 8;
          const mostlyHorizontal =
            Math.abs(gestureState.dy) < 8 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2;
          return (
            gestureState.numberActiveTouches === 1 &&
            startedAtLeftEdge &&
            movingRight &&
            mostlyHorizontal
          );
        },
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderGrant: () => {
          translateX.stopAnimation();
          overlayOpacity.stopAnimation();
        },
        onPanResponderMove: (_event, gestureState) => {
          const dragX = Math.max(0, Math.min(width, gestureState.dx));
          translateX.setValue(dragX);
          overlayOpacity.setValue((dragX / width) * 0.3);
        },
        onPanResponderRelease: (_event, gestureState) => {
          const shouldClose =
            gestureState.dx > width / 3 || gestureState.vx > 0.5;
          if (shouldClose) {
            closeWithAnimation();
          } else {
            springBack();
          }
        },
        onPanResponderTerminate: () => {
          if (!isClosingRef.current) {
            springBack();
          }
        },
        onPanResponderTerminationRequest: () => true,
        onShouldBlockNativeResponder: () => false,
      }),
    [closeWithAnimation, overlayOpacity, springBack, translateX, width],
  );

  // 专业课专属字段
  const [subject, setSubject] = useState(() =>
    editingRecord &&
    (isStudyLikeCategory(editingRecord.category) || editingRecord.category === 'journal')
      ? editingRecord.subject ?? ''
      : '',
  );
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(() =>
    editingRecord && isStudyLikeCategory(editingRecord.category)
      ? editingRecord.method ?? null
      : null,
  );
  const [isAddingMethod, setIsAddingMethod] = useState(false);
  const [newMethod, setNewMethod] = useState('');
  const [unit, setUnit] = useState<StudyUnit>(() => {
    if (
      editingRecord &&
      isStudyLikeCategory(editingRecord.category) &&
      editingRecord.unit &&
      (STUDY_UNITS as readonly string[]).includes(editingRecord.unit)
    ) {
      return editingRecord.unit as StudyUnit;
    }
    return '分钟';
  });
  const [isUnitSheetOpen, setIsUnitSheetOpen] = useState(false);

  // 日记专属字段：记录日期（默认今天）+ iOS 日期面板
  const [entryDate, setEntryDate] = useState<Date>(initialEditDate);
  const [draftDate, setDraftDate] = useState<Date>(initialEditDate);
  const [isDateSheetOpen, setIsDateSheetOpen] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // 理财专属字段：收支类型（默认支出）、金额、消费类别
  const [financeFlow, setFinanceFlow] = useState<FinanceFlow>(() =>
    editingRecord?.category === 'finance' && editingRecord.subject === 'income'
      ? 'income'
      : 'expense',
  );
  const [financeAmount, setFinanceAmount] = useState(() =>
    editingRecord?.category === 'finance' ? String(editingRecord.value) : '',
  );
  const [financeAmountError, setFinanceAmountError] = useState<string | null>(null);
  const [selectedFinanceCategory, setSelectedFinanceCategory] = useState<string | null>(() =>
    editingRecord?.category === 'finance' ? editingRecord.method ?? null : null,
  );
  const [isAddingFinanceCategory, setIsAddingFinanceCategory] = useState(false);
  const [newFinanceCategory, setNewFinanceCategory] = useState('');
  const [financeCategoryError, setFinanceCategoryError] = useState<string | null>(null);

  // 护肤打卡：防重复点击 + 错误提示
  const [isSkincareSubmitting, setIsSkincareSubmitting] = useState(false);
  const [skincareError, setSkincareError] = useState<string | null>(null);
  const skincareSubmittingRef = useRef(false);

  // 英语专属字段：学习方式 + 动态单位
  const [selectedEnglishMethod, setSelectedEnglishMethod] = useState<string | null>(() =>
    editingRecord?.category === 'english' ? editingRecord.method ?? null : null,
  );
  const [englishMethodError, setEnglishMethodError] = useState<string | null>(null);
  const [isAddingEnglishMethod, setIsAddingEnglishMethod] = useState(false);
  const [newEnglishMethod, setNewEnglishMethod] = useState('');
  const [englishUnit, setEnglishUnit] = useState<EnglishUnit>(() => {
    if (
      editingRecord?.category === 'english' &&
      editingRecord.unit &&
      (ENGLISH_UNITS as readonly string[]).includes(editingRecord.unit)
    ) {
      return editingRecord.unit as EnglishUnit;
    }
    if (editingRecord?.category === 'english' && editingRecord.method) {
      return getEnglishUnitForMethod(editingRecord.method);
    }
    return '次';
  });

  // 健身专属字段：动作 + 重量 / 组数 / 次数
  const [selectedFitnessAction, setSelectedFitnessAction] = useState<string | null>(() =>
    editingRecord?.category === 'fitness' ? editingRecord.subject ?? null : null,
  );
  const [fitnessActionError, setFitnessActionError] = useState<string | null>(null);
  const [isAddingFitnessAction, setIsAddingFitnessAction] = useState(false);
  const [newFitnessAction, setNewFitnessAction] = useState('');
  const [weightInput, setWeightInput] = useState(() =>
    editingRecord?.category === 'fitness' ? String(editingRecord.value) : '',
  );
  const [setsInput, setSetsInput] = useState(initialFitnessParts.sets);
  const [repsInput, setRepsInput] = useState(initialFitnessParts.reps);
  const [fitnessInputError, setFitnessInputError] = useState<string | null>(null);
  const [fitnessErrorField, setFitnessErrorField] = useState<
    'weight' | 'sets' | 'reps' | null
  >(null);

  const isEditing = editingRecord !== null;

  const isStudy = category === 'study';
  const isSkill = category === 'skill';
  const isStudyLike = isStudy || isSkill;
  const isJournal = category === 'journal';
  const isFinance = category === 'finance';
  const isSkincare = category === 'skincare';
  const isEnglish = category === 'english';
  const isFitness = category === 'fitness';
  const englishAccent = CATEGORY_MAP.english.accent;
  const englishTint = CATEGORY_MAP.english.tint;
  const fitnessAccent = CATEGORY_MAP.fitness.accent;
  const fitnessTint = CATEGORY_MAP.fitness.tint;
  const skincareCircleSize = Math.min(170, (width - H_PADDING * 2 - 16) / 2);
  const studyLikeCopy = isStudy
    ? STUDY_LIKE_FORM_COPY.study
    : isSkill
      ? STUDY_LIKE_FORM_COPY.skill
      : null;

  // 专业课 / 拓展技能各自使用独立的预设标签与自定义标签池
  const activeCustomMethods = isSkill ? customSkillMethods : customMethods;
  const activeMethodPresets = isSkill
    ? STUDY_LIKE_FORM_COPY.skill.methodOptions
    : STUDY_LIKE_FORM_COPY.study.methodOptions;
  const onActiveCustomMethodsChange = isSkill
    ? onCustomSkillMethodsChange
    : onCustomMethodsChange;
  const methodOptions = useMemo(() => {
    const merged = mergeTags(activeMethodPresets, activeCustomMethods);
    if (selectedMethod && !merged.includes(selectedMethod)) {
      return [...merged, selectedMethod];
    }
    return merged;
  }, [activeMethodPresets, activeCustomMethods, selectedMethod]);
  const financeCategoryOptions = useMemo(() => {
    const merged = mergeTags(DEFAULT_FINANCE_CATEGORIES, customFinanceCategories);
    if (selectedFinanceCategory && !merged.includes(selectedFinanceCategory)) {
      return [...merged, selectedFinanceCategory];
    }
    return merged;
  }, [customFinanceCategories, selectedFinanceCategory]);
  const englishMethodOptions = useMemo(() => {
    const merged = mergeTags(DEFAULT_ENGLISH_METHODS, customEnglishMethods);
    if (selectedEnglishMethod && !merged.includes(selectedEnglishMethod)) {
      return [...merged, selectedEnglishMethod];
    }
    return merged;
  }, [customEnglishMethods, selectedEnglishMethod]);
  const isSelectedEnglishMethodCustom =
    selectedEnglishMethod !== null && customEnglishMethods.includes(selectedEnglishMethod);
  const fitnessActionOptions = useMemo(() => {
    const merged = mergeTags(DEFAULT_FITNESS_ACTIONS, customFitnessActions);
    if (selectedFitnessAction && !merged.includes(selectedFitnessAction)) {
      return [...merged, selectedFitnessAction];
    }
    return merged;
  }, [customFitnessActions, selectedFitnessAction]);
  // 从首页具体卡片进入时锁定分类，此时不再展示分类选择器
  const lockedCategory = initialCategory ? CATEGORY_MAP[initialCategory] : null;
  const selectedCategory = category ? CATEGORY_MAP[category] : null;
  const parsedValue = Number(valueInput);
  const parsedWeight = Number(weightInput);
  const parsedSets = Number(setsInput);
  const parsedReps = Number(repsInput);
  const parsedFinanceAmount = Number(financeAmount);
  const isFinanceAmountValid =
    financeAmount.length > 0 && Number.isFinite(parsedFinanceAmount) && parsedFinanceAmount > 0;
  const financeAccent = financeFlow === 'expense' ? FINANCE_EXPENSE_COLOR : FINANCE_INCOME_COLOR;
  const financeTint = financeFlow === 'expense' ? FINANCE_EXPENSE_TINT : FINANCE_INCOME_TINT;
  const canSave =
    category !== null &&
    (isJournal ||
      isFitness ||
      isSkincare ||
      (isFinance ? isFinanceAmountValid : valueInput.length > 0 && parsedValue > 0)) &&
    !isSaving &&
    !isDeleting;

  // 最多只能选到今天
  const maxSelectableDate = useMemo(() => {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date;
  }, []);

  // 切换分类时滚回顶部，避免原生输入框/滚动位置残留造成裁切错觉
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [category]);

  const handleAddMethod = () => {
    const nextMethod = newMethod.trim();
    if (!nextMethod) {
      return;
    }
    // 预设标签或已存在的自定义标签都不重复写入
    if (!methodOptions.includes(nextMethod)) {
      onActiveCustomMethodsChange([...activeCustomMethods, nextMethod]);
    }
    setSelectedMethod(nextMethod);
    setNewMethod('');
    setIsAddingMethod(false);
    Keyboard.dismiss();
  };

  const handleRemoveCustomMethod = (option: string) => {
    Keyboard.dismiss();
    Alert.alert(
      '删除自定义标签',
      `确定要删除自定义标签「${option}」吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            onActiveCustomMethodsChange(activeCustomMethods.filter((item) => item !== option));
            setSelectedMethod((prev) => (prev === option ? null : prev));
          },
        },
      ],
    );
  };

  const handleAddFinanceCategory = () => {
    const nextCategory = newFinanceCategory.trim();
    if (!nextCategory) {
      return;
    }
    // 预设标签或已存在的自定义标签都不重复写入
    if (!financeCategoryOptions.includes(nextCategory)) {
      onCustomFinanceCategoriesChange([...customFinanceCategories, nextCategory]);
    }
    setSelectedFinanceCategory(nextCategory);
    setFinanceCategoryError(null);
    setNewFinanceCategory('');
    setIsAddingFinanceCategory(false);
    Keyboard.dismiss();
  };

  const handleRemoveCustomFinanceCategory = (option: string) => {
    Keyboard.dismiss();
    Alert.alert(
      '删除自定义标签',
      `确定要删除自定义标签「${option}」吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            onCustomFinanceCategoriesChange(
              customFinanceCategories.filter((item) => item !== option),
            );
            setSelectedFinanceCategory((prev) => (prev === option ? null : prev));
          },
        },
      ],
    );
  };

  const handleSelectEnglishMethod = (option: string) => {
    if (option === selectedEnglishMethod) {
      setSelectedEnglishMethod(null);
      setEnglishUnit('次');
      setEnglishMethodError(null);
      return;
    }
    setSelectedEnglishMethod(option);
    setEnglishUnit(getEnglishUnitForMethod(option));
    setEnglishMethodError(null);
  };

  const handleAddEnglishMethod = () => {
    const nextMethod = newEnglishMethod.trim();
    if (!nextMethod) {
      return;
    }
    // 预设或已存在的自定义标签不重复写入
    if (!englishMethodOptions.includes(nextMethod)) {
      onCustomEnglishMethodsChange([...customEnglishMethods, nextMethod]);
    }
    setSelectedEnglishMethod(nextMethod);
    setEnglishUnit(getEnglishUnitForMethod(nextMethod));
    setEnglishMethodError(null);
    setNewEnglishMethod('');
    setIsAddingEnglishMethod(false);
    Keyboard.dismiss();
  };

  const handleRemoveCustomEnglishMethod = (option: string) => {
    Keyboard.dismiss();
    Alert.alert(
      '删除自定义标签',
      `确定要删除自定义标签「${option}」吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            onCustomEnglishMethodsChange(
              customEnglishMethods.filter((item) => item !== option),
            );
            if (selectedEnglishMethod === option) {
              setSelectedEnglishMethod(null);
              setEnglishUnit('次');
            }
            setEnglishMethodError(null);
          },
        },
      ],
    );
  };

  const cycleEnglishUnit = () => {
    setEnglishUnit((prev) => {
      const index = ENGLISH_UNITS.indexOf(prev);
      return ENGLISH_UNITS[(index + 1) % ENGLISH_UNITS.length];
    });
  };

  const handleSelectFitnessAction = (option: string) => {
    setSelectedFitnessAction((prev) => (prev === option ? null : option));
    setFitnessActionError(null);
  };

  /** 键盘弹出时把训练数据行滚到可视区域，避免被键盘遮挡 */
  const focusFitnessRow = () => {
    scrollRef.current?.scrollTo({ y: 360, animated: true });
  };

  const handleAddFitnessAction = () => {
    const nextAction = newFitnessAction.trim();
    if (!nextAction) {
      return;
    }
    if (!fitnessActionOptions.includes(nextAction)) {
      onCustomFitnessActionsChange([...customFitnessActions, nextAction]);
    }
    setSelectedFitnessAction(nextAction);
    setFitnessActionError(null);
    setNewFitnessAction('');
    setIsAddingFitnessAction(false);
    Keyboard.dismiss();
  };

  const handleRemoveCustomFitnessAction = (option: string) => {
    Keyboard.dismiss();
    Alert.alert(
      '删除自定义标签',
      `确定要删除自定义标签「${option}」吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            onCustomFitnessActionsChange(
              customFitnessActions.filter((item) => item !== option),
            );
            if (selectedFitnessAction === option) {
              setSelectedFitnessAction(null);
            }
            setFitnessActionError(null);
          },
        },
      ],
    );
  };

  const handleSkincarePress = async (slot: SkincareSlot, shortLabel: string) => {
    if (skincareSubmittingRef.current) {
      return;
    }

    if (skincareStatus[slot]) {
      Alert.alert(
        '取消打卡',
        `确定要取消今天的${shortLabel}打卡吗？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '确认取消',
            style: 'destructive',
            onPress: async () => {
              if (skincareSubmittingRef.current) {
                return;
              }
              skincareSubmittingRef.current = true;
              setIsSkincareSubmitting(true);
              setSkincareError(null);
              try {
                await onSkincareCancel(slot);
              } catch (error) {
                console.warn('取消护肤打卡失败', error);
                setSkincareError('取消打卡失败，请稍后重试');
                setIsSkincareSubmitting(false);
                skincareSubmittingRef.current = false;
              }
            },
          },
        ],
      );
      return;
    }

    skincareSubmittingRef.current = true;
    setIsSkincareSubmitting(true);
    setSkincareError(null);
    try {
      await onSkincareCheckIn(slot);
    } catch (error) {
      console.warn('护肤打卡失败', error);
      setSkincareError('打卡失败，请稍后重试');
      setIsSkincareSubmitting(false);
      skincareSubmittingRef.current = false;
    }
  };

  const openDatePicker = () => {
    Keyboard.dismiss();
    // Android 用系统对话框，避免额外渲染一整块日历
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: entryDate,
        mode: 'date',
        maximumDate: maxSelectableDate,
        onValueChange: (_event, date) => {
          if (date) {
            setEntryDate(normalizeDate(date));
          }
        },
      });
      return;
    }

    setDraftDate(entryDate);
    setIsDateSheetOpen(true);
  };

  const handleDeletePress = () => {
    if (!editingRecord) {
      return;
    }
    Keyboard.dismiss();
    Alert.alert(
      '删除记录',
      '确定要删除这条记录吗？删除后无法恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            setFormError(null);
            try {
              await onDelete(editingRecord.id);
              triggerSuccessHaptic();
            } catch (error) {
              console.warn('删除记录失败', error);
              setFormError('删除失败，请稍后重试');
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  const handleSubmit = async () => {
    if (!category) {
      setFormError('请先选择一个分类');
      return;
    }
    if (
      !isJournal &&
      !isFinance &&
      !isFitness &&
      !isSkincare &&
      (!Number.isFinite(parsedValue) || parsedValue <= 0)
    ) {
      setFormError(isEnglish ? '请输入大于 0 的数量' : '请输入大于 0 的数值');
      return;
    }
    if (isFinance) {
      if (!isFinanceAmountValid) {
        setFinanceAmountError('请输入大于 0 的金额');
        setFormError(null);
        scrollRef.current?.scrollTo({ y: 200, animated: true });
        return;
      }
      if (!selectedFinanceCategory) {
        setFinanceCategoryError('请选择或输入一个类别');
        setFinanceAmountError(null);
        setFormError(null);
        scrollRef.current?.scrollTo({ y: 320, animated: true });
        return;
      }
    }
    if (isStudyLike && !subject.trim()) {
      setSubjectError(studyLikeCopy?.subjectError ?? '请填写名称');
      setFormError(null);
      scrollRef.current?.scrollTo({ y: 140, animated: true });
      return;
    }
    if (isEnglish && !selectedEnglishMethod) {
      setEnglishMethodError('请选择学习方式');
      setFormError(null);
      scrollRef.current?.scrollTo({ y: 140, animated: true });
      return;
    }
    if (isFitness) {
      if (!selectedFitnessAction) {
        setFitnessActionError('请选择训练动作');
        setFitnessInputError(null);
        setFitnessErrorField(null);
        setFormError(null);
        scrollRef.current?.scrollTo({ y: 140, animated: true });
        return;
      }
      if (weightInput.length === 0 || !Number.isFinite(parsedWeight) || parsedWeight <= 0) {
        setFitnessInputError('请输入大于 0 的重量');
        setFitnessErrorField('weight');
        setFitnessActionError(null);
        setFormError(null);
        scrollRef.current?.scrollTo({ y: 220, animated: true });
        return;
      }
      if (setsInput.length === 0 || !Number.isInteger(parsedSets) || parsedSets <= 0) {
        setFitnessInputError('请输入大于 0 的组数');
        setFitnessErrorField('sets');
        setFitnessActionError(null);
        setFormError(null);
        scrollRef.current?.scrollTo({ y: 220, animated: true });
        return;
      }
      if (repsInput.length === 0 || !Number.isInteger(parsedReps) || parsedReps <= 0) {
        setFitnessInputError('请输入大于 0 的次数');
        setFitnessErrorField('reps');
        setFitnessActionError(null);
        setFormError(null);
        scrollRef.current?.scrollTo({ y: 220, animated: true });
        return;
      }
    }
    if (category === 'journal' && !note.trim()) {
      setNoteError('正文不能为空，写点什么吧');
      setFormError(null);
      scrollRef.current?.scrollToEnd({ animated: true });
      return;
    }

    setFormError(null);
    setSubjectError(null);
    setNoteError(null);
    setFinanceAmountError(null);
    setFinanceCategoryError(null);
    setEnglishMethodError(null);
    setFitnessActionError(null);
    setFitnessInputError(null);
    setFitnessErrorField(null);
    setIsSaving(true);

    const input: SaveInput = {
      category,
      value: category === 'journal' ? 0 : parsedValue,
      note: note.trim(),
    };
    if (isStudyLike) {
      input.subject = subject.trim();
      input.method = selectedMethod ?? undefined;
      input.unit = unit;
    }
    if (category === 'journal') {
      input.subject = subject.trim() || undefined;
      input.date = getTodayKey(entryDate);
    }
    if (category === 'english') {
      // 英语：method 存学习方式，unit 存动态单位
      input.method = selectedEnglishMethod ?? undefined;
      input.unit = englishUnit;
    }
    if (category === 'fitness') {
      // 健身：subject 存动作，value 存重量，method 存 组数x次数
      input.subject = selectedFitnessAction ?? undefined;
      input.value = parsedWeight;
      input.unit = 'kg';
      input.method = `${parsedSets}x${parsedReps}`;
    }
    if (category === 'finance') {
      // 沿用现有字段：subject 存收支类型，method 存消费/收入类别
      input.value = roundMoney(parsedFinanceAmount);
      input.subject = financeFlow;
      input.method = selectedFinanceCategory ?? undefined;
    }
    if (category === 'skincare') {
      // 护肤打卡编辑：保留原时段，仅允许修改备注
      input.value = 1;
      input.subject = editingRecord?.subject;
    }

    try {
      await onSave(input);
      triggerSuccessHaptic();
    } catch (saveError) {
      console.warn('保存成长记录失败', saveError);
      setFormError('保存失败，请稍后重试');
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Animated.View
        style={[styles.screen, { transform: [{ translateX }] }]}
        {...(Platform.OS === 'ios' ? iosBackPanResponder.panHandlers : {})}
      >
        <StatusBar style="dark" />
        <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.formContent,
            { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/*
            切换分类时强制重新挂载表单内容，避免理财大号金额输入框的原生样式
            残留在通用数字输入框上（iOS / Android 都可能出现原生视图复用问题）
          */}
          <View key={category ?? 'no-category'}>
          <Pressable
            onPress={closeWithAnimation}
            hitSlop={20}
            accessibilityRole="button"
            accessibilityLabel={editingRecord ? '返回历史记录' : '返回首页'}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <Ionicons name="close" size={28} color={COLORS.subText} />
          </Pressable>

          <Text style={styles.formTitle}>
            {editingRecord
              ? '编辑记录'
              : isFitness
                ? '力量训练'
                : isSkincare
                  ? '护肤打卡'
                  : isEnglish
                    ? '英语学习'
                    : '添加记录'}
          </Text>
          <Text style={styles.formSubtitle}>
            {editingRecord
              ? `${formatRecordDate(editingRecord.date)} · 修改后保存或删除`
              : isJournal
                ? '留住当下的想法'
                : isFinance
                  ? `${formatDateLabel()} · 记录今天的一笔收支`
                  : isFitness
                    ? `${formatDateLabel()} · 记录今天的力量训练`
                    : isSkincare
                      ? `${formatDateLabel()} · 早晚各一次，照顾好自己`
                      : isEnglish
                        ? `${formatDateLabel()} · 记录今天的学习`
                        : isSkill
                          ? `${formatDateLabel()} · 记录今天的新技能`
                          : `${formatDateLabel()} · 记录今天的一点进步`}
          </Text>

          {lockedCategory ? (
            <View
              style={[styles.lockedBanner, { backgroundColor: lockedCategory.tint }]}
              accessible
              accessibilityLabel={`${
                editingRecord ? '正在编辑' : '正在记录'
              }：${lockedCategory.label}`}
            >
              <View style={[styles.lockedDot, { backgroundColor: lockedCategory.accent }]} />
              <Text style={styles.lockedText}>
                {editingRecord ? '正在编辑：' : '正在记录：'}
                <Text style={[styles.lockedCategoryName, { color: lockedCategory.accent }]}>
                  {lockedCategory.label}
                </Text>
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.fieldLabel}>分类</Text>
              <View style={styles.chipGrid}>
                {CATEGORIES.map((item) => {
                  const isActive = item.id === category;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        setCategory(item.id);
                        setFormError(null);
                        setSubjectError(null);
                        setNoteError(null);
                        setFinanceAmountError(null);
                        setFinanceCategoryError(null);
                        setSkincareError(null);
                        if (item.id !== category) {
                          // 分类变化时清空已选标签，避免不同分类的标签串用
                          setSelectedMethod(null);
                          setIsAddingMethod(false);
                          setNewMethod('');
                          setSelectedEnglishMethod(null);
                          setEnglishUnit('次');
                          setEnglishMethodError(null);
                          setIsAddingEnglishMethod(false);
                          setNewEnglishMethod('');
                          setSelectedFitnessAction(null);
                          setFitnessActionError(null);
                          setIsAddingFitnessAction(false);
                          setNewFitnessAction('');
                          setWeightInput('');
                          setSetsInput('');
                          setRepsInput('');
                          setFitnessInputError(null);
                          setFitnessErrorField(null);
                          Keyboard.dismiss();
                        }
                        if (item.id !== 'finance') {
                          setIsAddingFinanceCategory(false);
                          setNewFinanceCategory('');
                          Keyboard.dismiss();
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      style={({ pressed }) => [
                        styles.chip,
                        { width: chipWidth },
                        isActive && { backgroundColor: item.tint, borderColor: item.accent },
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.chipDot,
                          { backgroundColor: isActive ? item.accent : COLORS.chipDot },
                        ]}
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.chipText,
                          isActive && { color: item.accent, fontWeight: '600' },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {isStudyLike ? (
            <>
              <Text style={styles.fieldLabel}>{studyLikeCopy?.subjectLabel}</Text>
              <FormTextInput
                value={subject}
                onChangeText={(text) => {
                  setSubject(text);
                  if (subjectError) {
                    setSubjectError(null);
                  }
                }}
                placeholder={studyLikeCopy?.subjectPlaceholder}
                placeholderTextColor={COLORS.faint}
                maxLength={20}
                returnKeyType="done"
                accessibilityLabel={studyLikeCopy?.subjectAccessibilityLabel}
                hasError={Boolean(subjectError)}
              />
              {subjectError ? <Text style={styles.fieldError}>{subjectError}</Text> : null}

              <Text style={styles.fieldLabel}>学习方式</Text>
              <View style={styles.chipGrid}>
                {methodOptions.map((option) => {
                  const isActive = option === selectedMethod;
                  const isCustom = activeCustomMethods.includes(option);
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setSelectedMethod(isActive ? null : option)}
                      onLongPress={
                        isCustom ? () => handleRemoveCustomMethod(option) : undefined
                      }
                      delayLongPress={400}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`学习方式 ${option}`}
                      accessibilityHint={isCustom ? '长按可删除这个自定义标签' : undefined}
                      style={({ pressed }) => [
                        styles.methodChip,
                        isActive && styles.methodChipActive,
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.methodChipText,
                          isActive && styles.methodChipTextActive,
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => {
                    if (isAddingMethod) {
                      setIsAddingMethod(false);
                      setNewMethod('');
                      Keyboard.dismiss();
                      return;
                    }
                    setIsAddingMethod(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={isAddingMethod ? '取消自定义学习方式' : '自定义学习方式'}
                  style={({ pressed }) => [
                    styles.methodChip,
                    styles.methodChipDashed,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={[styles.methodChipText, styles.methodChipAddText]}>
                    {isAddingMethod ? '取消' : '+ 自定义'}
                  </Text>
                </Pressable>
              </View>

              {activeCustomMethods.length > 0 ? (
                <Text style={styles.customHint}>提示：长按自定义标签可删除</Text>
              ) : null}

              {isAddingMethod ? (
                <View style={styles.customMethodRow}>
                  <FormTextInput
                    value={newMethod}
                    onChangeText={setNewMethod}
                    placeholder={studyLikeCopy?.methodPlaceholder}
                    placeholderTextColor={COLORS.faint}
                    maxLength={12}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleAddMethod}
                    accessibilityLabel="新的学习方式"
                    style={styles.customMethodInput}
                  />
                  <Pressable
                    onPress={handleAddMethod}
                    accessibilityRole="button"
                    accessibilityLabel="添加学习方式"
                    style={({ pressed }) => [
                      styles.customMethodButton,
                      pressed && styles.customMethodButtonPressed,
                    ]}
                  >
                    <Text style={styles.customMethodButtonText}>添加</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : null}

          {isJournal ? (
            <>
              <Text style={styles.fieldLabel}>日期</Text>
              <Pressable
                onPress={openDatePicker}
                accessibilityRole="button"
                accessibilityLabel={`选择日期，当前为 ${formatDateLong(entryDate)}`}
                style={({ pressed }) => [
                  styles.fieldShell,
                  styles.dateRow,
                  pressed && styles.dateRowPressed,
                ]}
              >
                <Text style={styles.dateRowText}>{formatDateLong(entryDate)}</Text>
                <Text style={styles.unitCaret}>▾</Text>
              </Pressable>

              <Text style={styles.fieldLabel}>标题</Text>
              <FormTextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="无标题（选填）"
                placeholderTextColor={COLORS.faint}
                maxLength={40}
                returnKeyType="next"
                accessibilityLabel="日记标题"
              />

              <Text style={styles.fieldLabel}>正文</Text>
              <FormTextInput
                value={note}
                onChangeText={(text) => {
                  setNote(text);
                  if (noteError) {
                    setNoteError(null);
                  }
                }}
                placeholder="写点什么..."
                placeholderTextColor={COLORS.faint}
                multiline
                maxLength={2000}
                textAlignVertical="top"
                accessibilityLabel="日记正文"
                hasError={Boolean(noteError)}
                style={[styles.journalInput, { height: journalBodyHeight }]}
              />
              {noteError ? (
                <Text style={styles.fieldError}>{noteError}</Text>
              ) : (
                <Text style={styles.counter}>{note.length}/2000</Text>
              )}
            </>
          ) : null}

          {isFinance ? (
            <>
              <Text style={styles.fieldLabel}>收支类型</Text>
              <View style={styles.flowToggle}>
                {(['expense', 'income'] as const).map((flow) => {
                  const isActive = financeFlow === flow;
                  const label = flow === 'expense' ? '支出' : '收入';
                  return (
                    <Pressable
                      key={flow}
                      onPress={() => setFinanceFlow(flow)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={label}
                      style={({ pressed }) => [
                        styles.flowOption,
                        isActive && {
                          backgroundColor: financeTint,
                          borderColor: financeAccent,
                        },
                        pressed && styles.flowOptionPressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.flowDot,
                          { backgroundColor: isActive ? financeAccent : COLORS.chipDot },
                        ]}
                      />
                      <Text
                        style={[
                          styles.flowOptionText,
                          isActive && { color: financeAccent, fontWeight: '700' },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>金额</Text>
              <FieldShell
                style={styles.financeAmountCard}
                hasError={Boolean(financeAmountError)}
              >
                <Text style={[styles.financeCurrency, { color: financeAccent }]}>¥</Text>
                <FormTextInput
                  value={financeAmount}
                  onChangeText={(text) => {
                    setFinanceAmount(sanitizeMoneyInput(text));
                    setFinanceAmountError(null);
                    setFormError(null);
                  }}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder="0.00"
                  placeholderTextColor={COLORS.faint}
                  style={[styles.financeAmountInput, { color: financeAccent }]}
                  maxLength={10}
                  accessibilityLabel="金额"
                />
              </FieldShell>
              {financeAmountError ? (
                <Text style={styles.fieldError}>{financeAmountError}</Text>
              ) : null}

              <Text style={styles.fieldLabel}>类别</Text>
              <View style={styles.chipGrid}>
                {financeCategoryOptions.map((option) => {
                  const isActive = option === selectedFinanceCategory;
                  const isCustom = customFinanceCategories.includes(option);
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        setSelectedFinanceCategory(isActive ? null : option);
                        setFinanceCategoryError(null);
                      }}
                      onLongPress={
                        isCustom
                          ? () => handleRemoveCustomFinanceCategory(option)
                          : undefined
                      }
                      delayLongPress={400}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`类别 ${option}`}
                      accessibilityHint={isCustom ? '长按可删除这个自定义标签' : undefined}
                      style={({ pressed }) => [
                        styles.methodChip,
                        isActive && {
                          backgroundColor: financeTint,
                          borderColor: financeAccent,
                        },
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.methodChipText,
                          isActive && { color: financeAccent, fontWeight: '600' },
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => {
                    if (isAddingFinanceCategory) {
                      setIsAddingFinanceCategory(false);
                      setNewFinanceCategory('');
                      Keyboard.dismiss();
                      return;
                    }
                    setIsAddingFinanceCategory(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isAddingFinanceCategory ? '取消自定义类别' : '自定义类别'
                  }
                  style={({ pressed }) => [
                    styles.methodChip,
                    styles.methodChipDashed,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={[styles.methodChipText, { color: financeAccent }]}>
                    {isAddingFinanceCategory ? '取消' : '+ 自定义'}
                  </Text>
                </Pressable>
              </View>

              {customFinanceCategories.length > 0 ? (
                <Text style={styles.customHint}>提示：长按自定义标签可删除</Text>
              ) : null}

              {isAddingFinanceCategory ? (
                <View style={styles.customMethodRow}>
                  <FormTextInput
                    value={newFinanceCategory}
                    onChangeText={(text) => {
                      setNewFinanceCategory(text);
                      if (financeCategoryError) {
                        setFinanceCategoryError(null);
                      }
                    }}
                    placeholder="输入新的类别"
                    placeholderTextColor={COLORS.faint}
                    maxLength={12}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleAddFinanceCategory}
                    accessibilityLabel="新的类别"
                    style={styles.customMethodInput}
                  />
                  <Pressable
                    onPress={handleAddFinanceCategory}
                    accessibilityRole="button"
                    accessibilityLabel="添加类别"
                    style={({ pressed }) => [
                      styles.customMethodButton,
                      { backgroundColor: financeAccent },
                      pressed && styles.chipPressed,
                    ]}
                  >
                    <Text style={styles.customMethodButtonText}>添加</Text>
                  </Pressable>
                </View>
              ) : null}
              {financeCategoryError ? (
                <Text style={styles.fieldError}>{financeCategoryError}</Text>
              ) : null}

              <Text style={styles.fieldLabel}>备注（可选）</Text>
              <FormTextInput
                value={note}
                onChangeText={setNote}
                placeholder={
                  financeFlow === 'expense' ? '这笔钱花在哪了？' : '这笔收入来自哪里？'
                }
                placeholderTextColor={COLORS.faint}
                style={styles.noteInput}
                multiline
                maxLength={200}
                textAlignVertical="top"
                accessibilityLabel="理财备注"
              />
              <Text style={styles.counter}>{note.length}/200</Text>
            </>
          ) : null}

          {isSkincare ? (
            editingRecord ? (
              <>
                <View style={styles.skincareEditCard}>
                  <Text style={styles.skincareEditIcon}>
                    {editingRecord.subject === 'evening' ? '🌙' : '☀️'}
                  </Text>
                  <Text style={styles.skincareEditTitle}>
                    护肤打卡 · {editingRecord.subject === 'evening' ? '晚间' : '早间'}
                  </Text>
                  <Text style={styles.skincareEditSubtitle}>
                    {formatRecordDate(editingRecord.date)}
                  </Text>
                  <Text style={styles.skincareEditHint}>
                    打卡时段不可修改，可编辑备注或删除记录
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>备注（可选）</Text>
                <FormTextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="补一句今天的护肤感受…"
                  placeholderTextColor={COLORS.faint}
                  style={styles.noteInput}
                  multiline
                  maxLength={200}
                  textAlignVertical="top"
                  accessibilityLabel="护肤备注"
                />
                <Text style={styles.counter}>{note.length}/200</Text>
              </>
            ) : (
            <View style={styles.skincareSection}>
              <Text style={styles.skincareSectionTitle}>今天也要好好护肤</Text>
              <Text style={styles.skincareSectionSubtitle}>
                点击完成打卡，再次点击可取消
              </Text>

              <View style={styles.skincareCircleRow}>
                {SKINCARE_SLOTS.map((slot) => {
                  const isDone = skincareStatus[slot.id];
                  return (
                    <Pressable
                      key={slot.id}
                      onPress={() => handleSkincarePress(slot.id, slot.shortLabel)}
                      disabled={isSkincareSubmitting}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: isDone,
                        disabled: isSkincareSubmitting,
                      }}
                      accessibilityLabel={`${slot.label}，${
                        isDone ? '已打卡，点击可取消' : '未打卡，点击打卡'
                      }`}
                      style={({ pressed }) => [
                        styles.skincareCircle,
                        {
                          width: skincareCircleSize,
                          height: skincareCircleSize,
                          borderRadius: skincareCircleSize / 2,
                        },
                        isDone && styles.skincareCircleDone,
                        isSkincareSubmitting && styles.skincareCircleDisabled,
                        pressed && styles.skincareCirclePressed,
                      ]}
                    >
                      <Text style={styles.skincareCircleIcon}>{slot.icon}</Text>
                      <Text
                        style={[
                          styles.skincareCircleLabel,
                          isDone && styles.skincareCircleLabelDone,
                        ]}
                      >
                        {slot.label}
                      </Text>
                      <Text
                        style={[
                          styles.skincareCircleStatus,
                          isDone && styles.skincareCircleStatusDone,
                        ]}
                      >
                        {isSkincareSubmitting
                          ? '处理中…'
                          : isDone
                            ? '已打卡 · 点击取消'
                            : '点击打卡'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {skincareError ? (
                <Text style={[styles.error, styles.skincareError]}>{skincareError}</Text>
              ) : null}
            </View>
            )
          ) : null}

          {isEnglish ? (
            <>
              <Text style={styles.fieldLabel}>学习方式</Text>
              <View style={styles.chipGrid}>
                {englishMethodOptions.map((option) => {
                  const isActive = option === selectedEnglishMethod;
                  const isCustom = customEnglishMethods.includes(option);
                  return (
                    <Pressable
                      key={option}
                      onPress={() => handleSelectEnglishMethod(option)}
                      onLongPress={
                        isCustom ? () => handleRemoveCustomEnglishMethod(option) : undefined
                      }
                      delayLongPress={400}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`学习方式 ${option}`}
                      accessibilityHint={isCustom ? '长按可删除这个自定义标签' : undefined}
                      style={({ pressed }) => [
                        styles.methodChip,
                        isActive && {
                          backgroundColor: englishTint,
                          borderColor: englishAccent,
                        },
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.methodChipText,
                          isActive && { color: englishAccent, fontWeight: '600' },
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => {
                    if (isAddingEnglishMethod) {
                      setIsAddingEnglishMethod(false);
                      setNewEnglishMethod('');
                      Keyboard.dismiss();
                      return;
                    }
                    setIsAddingEnglishMethod(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isAddingEnglishMethod ? '取消自定义学习方式' : '自定义学习方式'
                  }
                  style={({ pressed }) => [
                    styles.methodChip,
                    styles.methodChipDashed,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={[styles.methodChipText, { color: englishAccent }]}>
                    {isAddingEnglishMethod ? '取消' : '+ 自定义'}
                  </Text>
                </Pressable>
              </View>

              {englishMethodError ? (
                <Text style={styles.fieldError}>{englishMethodError}</Text>
              ) : null}
              {customEnglishMethods.length > 0 ? (
                <Text style={styles.customHint}>提示：长按自定义标签可删除</Text>
              ) : null}

              {isAddingEnglishMethod ? (
                <View style={styles.customMethodRow}>
                  <FormTextInput
                    value={newEnglishMethod}
                    onChangeText={(text) => {
                      setNewEnglishMethod(text);
                      if (englishMethodError) {
                        setEnglishMethodError(null);
                      }
                    }}
                    placeholder="输入新的学习方式"
                    placeholderTextColor={COLORS.faint}
                    maxLength={12}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleAddEnglishMethod}
                    accessibilityLabel="新的英语学习方式"
                    style={styles.customMethodInput}
                  />
                  <Pressable
                    onPress={handleAddEnglishMethod}
                    accessibilityRole="button"
                    accessibilityLabel="添加英语学习方式"
                    style={({ pressed }) => [
                      styles.customMethodButton,
                      { backgroundColor: englishAccent },
                      pressed && styles.chipPressed,
                    ]}
                  >
                    <Text style={styles.customMethodButtonText}>添加</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : null}

          {isFitness ? (
            <>
              <Text style={styles.fieldLabel}>训练动作</Text>
              <View style={styles.chipGrid}>
                {fitnessActionOptions.map((option) => {
                  const isActive = option === selectedFitnessAction;
                  const isCustom = customFitnessActions.includes(option);
                  return (
                    <Pressable
                      key={option}
                      onPress={() => handleSelectFitnessAction(option)}
                      onLongPress={
                        isCustom ? () => handleRemoveCustomFitnessAction(option) : undefined
                      }
                      delayLongPress={400}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`训练动作 ${option}`}
                      accessibilityHint={isCustom ? '长按可删除这个自定义标签' : undefined}
                      style={({ pressed }) => [
                        styles.methodChip,
                        isActive && {
                          backgroundColor: fitnessTint,
                          borderColor: fitnessAccent,
                        },
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.methodChipText,
                          isActive && { color: fitnessAccent, fontWeight: '600' },
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => {
                    if (isAddingFitnessAction) {
                      setIsAddingFitnessAction(false);
                      setNewFitnessAction('');
                      Keyboard.dismiss();
                      return;
                    }
                    setIsAddingFitnessAction(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isAddingFitnessAction ? '取消自定义动作' : '自定义训练动作'
                  }
                  style={({ pressed }) => [
                    styles.methodChip,
                    styles.methodChipDashed,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={[styles.methodChipText, { color: fitnessAccent }]}>
                    {isAddingFitnessAction ? '取消' : '+ 自定义'}
                  </Text>
                </Pressable>
              </View>

              {fitnessActionError ? (
                <Text style={styles.fieldError}>{fitnessActionError}</Text>
              ) : null}
              {customFitnessActions.length > 0 ? (
                <Text style={styles.customHint}>提示：长按自定义标签可删除</Text>
              ) : null}

              {isAddingFitnessAction ? (
                <View style={styles.customMethodRow}>
                  <FormTextInput
                    value={newFitnessAction}
                    onChangeText={(text) => {
                      setNewFitnessAction(text);
                      if (fitnessActionError) {
                        setFitnessActionError(null);
                      }
                    }}
                    placeholder="输入新的动作名称"
                    placeholderTextColor={COLORS.faint}
                    maxLength={12}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleAddFitnessAction}
                    accessibilityLabel="新的健身动作"
                    style={styles.customMethodInput}
                  />
                  <Pressable
                    onPress={handleAddFitnessAction}
                    accessibilityRole="button"
                    accessibilityLabel="添加健身动作"
                    style={({ pressed }) => [
                      styles.customMethodButton,
                      { backgroundColor: fitnessAccent },
                      pressed && styles.chipPressed,
                    ]}
                  >
                    <Text style={styles.customMethodButtonText}>添加</Text>
                  </Pressable>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>训练数据</Text>
              <View style={styles.fitnessRow}>
                <View style={[styles.fitnessField, styles.fitnessFieldWeight]}>
                  <Text style={styles.fitnessFieldLabel}>重量</Text>
                  <FieldShell
                    style={styles.fitnessInputCard}
                    hasError={fitnessErrorField === 'weight'}
                  >
                    <FormTextInput
                      value={weightInput}
                      onChangeText={(text) => {
                        setWeightInput(sanitizeMoneyInput(text));
                        setFitnessInputError(null);
                        setFitnessErrorField(null);
                        setFormError(null);
                      }}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      placeholder="0"
                      placeholderTextColor={COLORS.faint}
                      style={styles.fitnessWeightInput}
                      maxLength={8}
                      onFocus={focusFitnessRow}
                      accessibilityLabel="重量"
                    />
                    <Text style={styles.fitnessUnit}>kg</Text>
                  </FieldShell>
                </View>

                <View style={styles.fitnessField}>
                  <Text style={styles.fitnessFieldLabel}>组数</Text>
                  <FieldShell
                    style={[styles.fitnessInputCard, styles.fitnessInputCardSmall]}
                    hasError={fitnessErrorField === 'sets'}
                  >
                    <FormTextInput
                      value={setsInput}
                      onChangeText={(text) => {
                        setSetsInput(text.replace(/[^0-9]/g, '').slice(0, 2));
                        setFitnessInputError(null);
                        setFitnessErrorField(null);
                        setFormError(null);
                      }}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={COLORS.faint}
                      style={styles.fitnessSmallInput}
                      maxLength={2}
                      onFocus={focusFitnessRow}
                      accessibilityLabel="组数"
                    />
                    <Text style={styles.fitnessUnitSmall}>组</Text>
                  </FieldShell>
                </View>

                <View style={styles.fitnessField}>
                  <Text style={styles.fitnessFieldLabel}>次数</Text>
                  <FieldShell
                    style={[styles.fitnessInputCard, styles.fitnessInputCardSmall]}
                    hasError={fitnessErrorField === 'reps'}
                  >
                    <FormTextInput
                      value={repsInput}
                      onChangeText={(text) => {
                        setRepsInput(text.replace(/[^0-9]/g, '').slice(0, 2));
                        setFitnessInputError(null);
                        setFitnessErrorField(null);
                        setFormError(null);
                      }}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={COLORS.faint}
                      style={styles.fitnessSmallInput}
                      maxLength={2}
                      onFocus={focusFitnessRow}
                      accessibilityLabel="次数"
                    />
                    <Text style={styles.fitnessUnitSmall}>次</Text>
                  </FieldShell>
                </View>
              </View>
              {fitnessInputError ? (
                <Text style={styles.fieldError}>{fitnessInputError}</Text>
              ) : null}

              <Text style={styles.fieldLabel}>备注（可选）</Text>
              <FormTextInput
                value={note}
                onChangeText={setNote}
                placeholder="今天练得怎么样？"
                placeholderTextColor={COLORS.faint}
                style={styles.noteInput}
                multiline
                maxLength={200}
                textAlignVertical="top"
                accessibilityLabel="健身备注"
              />
              <Text style={styles.counter}>{note.length}/200</Text>
            </>
          ) : null}

          {isJournal || isFinance || isSkincare || isFitness ? null : (
            <>
              <Text style={styles.fieldLabel}>
                {isEnglish ? '数量' : isStudyLike ? '数值与单位' : '数值'}
              </Text>
              <View style={isStudyLike ? styles.valueRow : undefined}>
                <FieldShell
                  style={[
                    isStudyLike && styles.valueRowInput,
                    isEnglish && styles.englishValueCard,
                  ]}
                >
                  <FormTextInput
                    value={valueInput}
                    onChangeText={(text) => {
                      setValueInput(text.replace(/[^0-9]/g, '').slice(0, 5));
                      setFormError(null);
                    }}
                    keyboardType="number-pad"
                    placeholder={
                      isEnglish ? '例如 50' : studyLikeCopy?.valuePlaceholder ?? '例如 90'
                    }
                    placeholderTextColor={COLORS.faint}
                    style={isEnglish ? styles.englishValueInput : styles.valueInput}
                    maxLength={5}
                    accessibilityLabel={isEnglish ? '英语学习数量' : '记录数值'}
                  />

                  {isEnglish ? (
                    selectedEnglishMethod ? (
                      isSelectedEnglishMethodCustom ? (
                        <Pressable
                          onPress={cycleEnglishUnit}
                          accessibilityRole="button"
                          accessibilityLabel={`切换单位，当前为 ${englishUnit}`}
                          accessibilityHint="点击切换单位"
                          style={({ pressed }) => [
                            styles.englishUnitSwitch,
                            pressed && styles.chipPressed,
                          ]}
                        >
                          <Text style={styles.englishUnitValue}>{englishUnit}</Text>
                          <Text style={styles.englishUnitSwitchHint}>切换</Text>
                        </Pressable>
                      ) : (
                        <Text style={styles.englishUnitSuffix}>{englishUnit}</Text>
                      )
                    ) : (
                      <Text style={styles.englishUnitPlaceholder}>单位</Text>
                    )
                  ) : !isStudyLike ? (
                    <Text style={styles.inputSuffix}>
                      {selectedCategory ? selectedCategory.unit : '数值'}
                    </Text>
                  ) : null}
                </FieldShell>

                {isStudyLike ? (
                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      setIsUnitSheetOpen(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`选择单位，当前为 ${unit}`}
                    style={({ pressed }) => [
                      styles.unitSelect,
                      pressed && styles.unitSelectPressed,
                    ]}
                  >
                    <Text style={styles.unitSelectText}>{unit}</Text>
                    <Text style={styles.unitCaret}>▾</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.fieldLabel}>备注（可选）</Text>
              <FormTextInput
                value={note}
                onChangeText={setNote}
                placeholder="记录今天做了什么、有什么感受…"
                placeholderTextColor={COLORS.faint}
                style={styles.noteInput}
                multiline
                maxLength={200}
                textAlignVertical="top"
                accessibilityLabel="记录备注"
              />
              <Text style={styles.counter}>{note.length}/200</Text>
            </>
          )}

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          {isSkincare && !isEditing ? null : (
            <Pressable
              onPress={() => {
                triggerImpactHaptic();
                void handleSubmit();
              }}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel={isEditing ? '保存修改' : '保存记录'}
              accessibilityState={{ disabled: !canSave }}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && canSave && styles.saveButtonPressed,
              ]}
            >
              <LinearGradient
                colors={
                  canSave || isSaving ? SAVE_GRADIENT_COLORS : SAVE_GRADIENT_DISABLED_COLORS
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveButtonGradient}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>{isEditing ? '保存修改' : '保存'}</Text>
                )}
              </LinearGradient>
            </Pressable>
          )}

          {isEditing ? (
            <Pressable
              onPress={handleDeletePress}
              disabled={isDeleting || isSaving}
              accessibilityRole="button"
              accessibilityLabel="删除此记录"
              accessibilityState={{ disabled: isDeleting || isSaving }}
              style={({ pressed }) => [
                styles.deleteButton,
                (isDeleting || isSaving) && styles.deleteButtonDisabled,
                pressed && !isDeleting && !isSaving && styles.deleteButtonPressed,
              ]}
            >
              {isDeleting ? (
                <ActivityIndicator color={COLORS.danger} />
              ) : (
                <Text style={styles.deleteButtonText}>删除此记录</Text>
              )}
            </Pressable>
          ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Animated.View
        pointerEvents="none"
        style={[styles.swipeOverlay, { opacity: overlayOpacity }]}
      />
      </Animated.View>

      <Modal
        visible={isUnitSheetOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsUnitSheetOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setIsUnitSheetOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="关闭单位选择"
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>选择单位</Text>
            {STUDY_UNITS.map((item) => {
              const isActive = item === unit;
              return (
                <Pressable
                  key={item}
                  onPress={() => {
                    setUnit(item);
                    setIsUnitSheetOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  style={({ pressed }) => [
                    styles.sheetOption,
                    isActive && styles.sheetOptionActive,
                    pressed && styles.sheetOptionPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetOptionText,
                      isActive && styles.sheetOptionTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                  {isActive ? <Text style={styles.sheetCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setIsUnitSheetOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="取消选择单位"
              style={({ pressed }) => [
                styles.sheetCancel,
                pressed && styles.sheetOptionPressed,
              ]}
            >
              <Text style={styles.sheetCancelText}>取消</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {Platform.OS === 'ios' ? (
        <Modal
          visible={isDateSheetOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsDateSheetOpen(false)}
        >
          <View style={styles.modalRoot}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setIsDateSheetOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="关闭日期选择"
            />
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>选择日期</Text>
              <DateTimePicker
                value={draftDate}
                mode="date"
                display="spinner"
                maximumDate={maxSelectableDate}
                themeVariant="light"
                onValueChange={(_event, date) => setDraftDate(normalizeDate(date))}
                style={styles.iosDatePicker}
              />
              <View style={styles.dateSheetActions}>
                <Pressable
                  onPress={() => setIsDateSheetOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="取消选择日期"
                  style={({ pressed }) => [
                    styles.sheetSecondaryButton,
                    pressed && styles.sheetOptionPressed,
                  ]}
                >
                  <Text style={styles.sheetSecondaryText}>取消</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setEntryDate(normalizeDate(draftDate));
                    setIsDateSheetOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="确认日期"
                  style={({ pressed }) => [
                    styles.sheetPrimaryButton,
                    pressed && styles.sheetPrimaryButtonPressed,
                  ]}
                >
                  <Text style={styles.sheetPrimaryText}>完成</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  样式                                       */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  appShell: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  appContent: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },

  /* 首页 */
  homeContent: {
    paddingHorizontal: H_PADDING,
  },
  homeCenterContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  homeHero: {
    width: '100%',
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeHeroTitle: {
    width: '100%',
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 1,
    textAlign: 'center',
    includeFontPadding: true,
    textShadowColor: 'rgba(24, 28, 39, 0.12)',
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 18,
  },
  homeHeroDate: {
    marginTop: 0,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '500',
    color: COLORS.muted,
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
  homeLoading: {
    marginTop: 48,
    alignSelf: 'center',
  },
  homeCarouselWrap: {
    width: '100%',
    position: 'relative',
  },
  homeCarousel: {
    flexGrow: 0,
  },
  homeCarouselContent: {
    flexGrow: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  carouselFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 30,
    zIndex: 10,
  },
  carouselFadeLeft: {
    left: 0,
  },
  carouselFadeRight: {
    right: 0,
  },
  homeCategoryCard: {
    padding: 16,
    borderRadius: 22,
    justifyContent: 'space-between',
    shadowColor: '#10203A',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  homeCategoryCardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  homeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  homeCardIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  homeCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  homeCardMain: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 30,
  },
  homeCardPrimary: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  homeCardSecondary: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.muted,
  },
  homeCardAdd: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10203A',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  homeCardAddPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.94 }],
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    letterSpacing: 0.4,
  },
  title: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
  },
  tabBar: {
    backgroundColor: COLORS.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(231, 235, 243, 0.9)',
    shadowColor: '#10203A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 14,
    zIndex: 20,
    overflow: 'visible',
  },
  tabBarRow: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'flex-start',
    overflow: 'visible',
  },
  tabBarItem: {
    flex: 1,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabBarItemPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.94 }],
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.faint,
  },
  tabBarLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  tabCenterSlot: {
    flex: 1,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  tabAddButton: {
    position: 'relative',
    top: -15,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    shadowColor: '#1B3FA0',
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    zIndex: 21,
  },
  tabAddButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.94 }],
  },
  tabAddGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarStatCard: {
    marginTop: 20,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF0FF',
  },
  calendarStatIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  calendarStatText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.subText,
  },
  calendarStatNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  calendarCard: {
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#10203A',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  calendarInner: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  calendarSelectedHeader: {
    marginTop: 24,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeholderCard: {
    marginTop: 40,
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#10203A',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  placeholderIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF0FF',
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.subText,
    textAlign: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
  },
  statsSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
  },
  statsSegments: {
    marginTop: 20,
    gap: 10,
    paddingRight: 4,
  },
  statsSegment: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statsSegmentActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: '#3B6EF6',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  statsSegmentPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  statsSegmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.subText,
  },
  statsSegmentTextActive: {
    color: '#FFFFFF',
  },
  statsChartCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 24,
    backgroundColor: COLORS.card,
    shadowColor: '#10203A',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  statsChartHeader: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsChartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  statsChartBadge: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsChartBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  statsChart: {
    marginTop: 8,
    borderRadius: 16,
  },
  statsLegendRow: {
    marginTop: 2,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statsLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statsLegendText: {
    fontSize: 12,
    color: COLORS.muted,
  },
  /* 科目耗时横向柱状图 */
  statsBarList: {
    marginTop: 14,
    gap: 16,
    paddingBottom: 2,
  },
  statsBarRow: {
    gap: 8,
  },
  statsBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statsBarName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  statsBarValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
  },
  statsBarTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#F1F3F8',
  },
  statsBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  /* 收支对比分组柱状图 */
  statsGroupedChart: {
    marginTop: 14,
    height: 150,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  statsGroupedColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statsGroupedBars: {
    height: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  statsGroupedBar: {
    width: 9,
    borderRadius: 4,
  },
  statsGroupedLabel: {
    marginTop: 8,
    fontSize: 10,
    color: COLORS.muted,
  },
  /* 支出分类环形图 */
  statsPieWrap: {
    position: 'relative',
    width: '100%',
    marginTop: 2,
  },
  statsPieHole: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  statsPieHoleLabel: {
    fontSize: 11,
    color: COLORS.muted,
  },
  statsPieHoleValue: {
    marginTop: 4,
    maxWidth: 84,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  statsPieLegend: {
    marginTop: 10,
    gap: 10,
  },
  statsPieLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsPieLegendName: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  statsPieLegendValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  statsPieLegendPercent: {
    width: 42,
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'right',
  },
  /* 护肤打卡进度条 */
  statsProgressList: {
    marginTop: 6,
    paddingBottom: 2,
  },
  statsProgressRow: {
    marginTop: 14,
    gap: 8,
  },
  statsProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsProgressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.subText,
  },
  statsProgressValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  statsProgressTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#F1F3F8',
  },
  statsProgressFill: {
    height: '100%',
    borderRadius: 5,
  },
  statsProgressHint: {
    marginTop: 14,
    fontSize: 11,
    color: COLORS.faint,
  },
  statsChartEmpty: {
    minHeight: 170,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsChartEmptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF0FF',
  },
  statsChartEmptyTitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: COLORS.subText,
    textAlign: 'center',
  },
  statsChartEmptyText: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
  },
  statsFootnote: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.faint,
    textAlign: 'center',
  },
  /* 个人中心 */
  profileHeader: {
    alignItems: 'center',
  },
  profileAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF0FF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#3B6EF6',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: COLORS.text,
  },
  profileSubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.muted,
  },
  profileStatsRow: {
    marginTop: 26,
    flexDirection: 'row',
    gap: CARD_GAP,
  },
  profileStatCard: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 18,
  },
  profileStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.subText,
  },
  profileStatValue: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  profileStatUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
  },
  profileMenuCard: {
    marginTop: 20,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    shadowColor: '#10203A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  profileMenuRow: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileMenuRowPressed: {
    opacity: 0.6,
  },
  profileMenuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF0FF',
  },
  profileMenuLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  profileMenuDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 46,
    backgroundColor: COLORS.border,
  },
  /* 个人中心二级页（管理标签 / 关于） */
  subScreenHeader: {
    paddingHorizontal: H_PADDING,
  },
  subScreenBack: {
    alignSelf: 'flex-start',
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  subScreenBackPressed: {
    opacity: 0.6,
  },
  subScreenBackText: {
    marginLeft: 2,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.primary,
  },
  subScreenTitle: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
  },
  subScreenSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
  },
  tagManagerContent: {
    paddingHorizontal: H_PADDING,
  },
  tagGroup: {
    marginTop: 22,
  },
  tagGroupLabel: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.subText,
    letterSpacing: 0.3,
  },
  tagGroupCard: {
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    shadowColor: '#10203A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tagRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagRowText: {
    flex: 1,
    marginRight: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  tagRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
  },
  tagRemoveButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F1',
  },
  tagRemoveButtonPressed: {
    opacity: 0.6,
    backgroundColor: '#FFE3E3',
  },
  tagEmptyText: {
    paddingVertical: 18,
    fontSize: 13,
    color: COLORS.faint,
  },
  aboutContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: H_PADDING,
    paddingBottom: 40,
  },
  aboutIcon: {
    width: 132,
    height: 132,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2C5FAF',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  aboutIconText: {
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#FFFFFF',
  },
  aboutTitle: {
    marginTop: 24,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.text,
  },
  aboutSlogan: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.muted,
  },
  aboutFooter: {
    alignItems: 'center',
  },
  aboutVersion: {
    fontSize: 12,
    color: COLORS.faint,
  },

  loading: {
    marginTop: 48,
  },
  grid: {
    marginTop: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  card: {
    minHeight: 122,
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: 'rgba(231, 235, 243, 0.9)',
    shadowColor: '#10203A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.subText,
  },
  cardBody: {
    flex: 1,
    marginTop: 14,
    justifyContent: 'flex-end',
  },
  cardValue: {
    fontSize: 26,
    fontWeight: '700',
  },
  cardUnit: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.muted,
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.muted,
  },
  cardEmpty: {
    fontSize: 14,
    color: COLORS.faint,
  },
  cardPressed: {
    opacity: 0.86,
  },
  cardAction: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  cardSubjects: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  historyGroup: {
    marginTop: 24,
  },
  historyDateRow: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.subText,
    letterSpacing: 0.3,
  },
  historyDateCount: {
    fontSize: 12,
    color: COLORS.faint,
  },
  historyItem: {
    marginBottom: 10,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: 'rgba(231, 235, 243, 0.9)',
    shadowColor: '#10203A',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  historyItemPressed: {
    opacity: 0.76,
  },
  historyItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 12,
  },
  historyItemBody: {
    flex: 1,
  },
  historyItemCategory: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  historyItemSummary: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    color: COLORS.text,
  },
  historyItemNote: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.muted,
  },
  historyItemChevron: {
    marginLeft: 10,
    marginTop: 2,
    fontSize: 20,
    fontWeight: '300',
    color: COLORS.faint,
  },
  historyEmpty: {
    marginTop: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  historyEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.subText,
  },
  historyEmptyText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: 'center',
  },
  financeBreakdown: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.muted,
  },
  financeBalance: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  skincareCardList: {
    gap: 4,
  },
  skincareCardStatus: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.subText,
  },
  skincareCardStatusDone: {
    color: COLORS.text,
  },
  englishCardSummary: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: COLORS.subText,
  },

  /* 添加页 */
  formContent: {
    paddingHorizontal: H_PADDING,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingRight: 12,
  },
  closeButton: {
    alignSelf: 'flex-start',
    width: 44,
    height: 44,
    borderRadius: 22,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF1F6',
  },
  closeButtonPressed: {
    opacity: 0.7,
    backgroundColor: '#E3E8F2',
  },
  swipeOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000000',
    zIndex: 50,
  },
  backText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.primary,
  },
  formTitle: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
  },
  formSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.muted,
  },
  lockedBanner: {
    marginTop: 26,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
  },
  lockedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  lockedText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.subText,
  },
  lockedCategoryName: {
    fontSize: 16,
    fontWeight: '700',
  },
  fieldLabel: {
    marginTop: 26,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.subText,
    letterSpacing: 0.3,
  },
  /** 独立输入框：无边框填色 + 聚焦高亮 */
  textField: {
    borderRadius: 12,
    // 透明边框占位：聚焦时只换颜色，避免 1px 抖动让文字重新换行
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: FIELD_BACKGROUND,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.text,
  },
  textFieldFocused: {
    backgroundColor: FIELD_BACKGROUND_FOCUSED,
    borderColor: FIELD_FOCUS_RING,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  textFieldError: {
    borderColor: COLORS.danger,
    backgroundColor: FIELD_ERROR_BACKGROUND,
  },
  /** 复合输入行内部的输入框：填色 / 聚焦由外层面板负责 */
  textInputBare: {
    flex: 1,
    padding: 0,
    fontSize: 16,
    color: COLORS.text,
  },
  dateRow: {
    justifyContent: 'space-between',
  },
  dateRowPressed: {
    opacity: 0.72,
  },
  dateRowText: {
    fontSize: 15,
    color: COLORS.text,
  },
  fieldError: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.danger,
  },
  methodChip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#EAF0FF',
  },
  methodChipDashed: {
    borderStyle: 'dashed',
  },
  methodChipText: {
    fontSize: 14,
    color: COLORS.subText,
  },
  methodChipTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  methodChipAddText: {
    color: COLORS.primary,
  },
  customHint: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.2,
    color: COLORS.faint,
  },
  /* 理财专属表单 */
  flowToggle: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: 18,
    backgroundColor: '#EDF0F6',
  },
  flowOption: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  flowOptionPressed: {
    opacity: 0.8,
  },
  flowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  flowOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.subText,
  },
  financeAmountCard: {
    height: 96,
    paddingHorizontal: 16,
    paddingVertical: 0,
    borderRadius: 12,
  },
  financeCurrency: {
    marginRight: 10,
    fontSize: 26,
    fontWeight: '700',
  },
  financeAmountInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlignVertical: 'center',
  },
  /* 护肤专属表单 */
  skincareSection: {
    marginTop: 40,
    alignItems: 'center',
  },
  skincareSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  skincareSectionSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
  },
  skincareCircleRow: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  skincareCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    shadowColor: '#10203A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  skincareCircleDone: {
    borderWidth: 2,
    borderColor: SKINCARE_DONE_COLOR,
    backgroundColor: SKINCARE_DONE_TINT,
  },
  skincareCircleDisabled: {
    opacity: 0.6,
  },
  skincareCirclePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  skincareCircleIcon: {
    fontSize: 38,
    marginBottom: 10,
  },
  skincareCircleLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  skincareCircleLabelDone: {
    color: SKINCARE_DONE_COLOR,
  },
  skincareCircleStatus: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'center',
  },
  skincareCircleStatusDone: {
    color: SKINCARE_DONE_COLOR,
    fontWeight: '600',
  },
  skincareError: {
    marginTop: 18,
    textAlign: 'center',
    alignSelf: 'center',
  },
  skincareEditCard: {
    marginTop: 32,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: '#FFF7FB',
    borderWidth: 1,
    borderColor: '#F6D9EA',
  },
  skincareEditIcon: {
    fontSize: 34,
    marginBottom: 8,
  },
  skincareEditTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  skincareEditSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.muted,
  },
  skincareEditHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.faint,
    textAlign: 'center',
  },
  /* 英语专属表单 */
  englishValueCard: {
    height: 84,
    paddingHorizontal: 16,
    paddingVertical: 0,
    borderRadius: 12,
  },
  englishValueInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    color: COLORS.text,
    textAlignVertical: 'center',
  },
  englishUnitSuffix: {
    marginLeft: 10,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.muted,
  },
  englishUnitPlaceholder: {
    marginLeft: 10,
    fontSize: 14,
    color: COLORS.faint,
  },
  englishUnitSwitch: {
    marginLeft: 10,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F2F4F9',
  },
  englishUnitValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  englishUnitSwitchHint: {
    fontSize: 11,
    color: COLORS.muted,
  },
  /* 健身专属表单 */
  fitnessRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  fitnessField: {
    flex: 1,
  },
  fitnessFieldWeight: {
    flex: 1.8,
  },
  fitnessFieldLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.subText,
    letterSpacing: 0.2,
  },
  fitnessInputCard: {
    height: 64,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: 12,
  },
  fitnessInputCardSmall: {
    paddingHorizontal: 10,
  },
  fitnessWeightInput: {
    flex: 1,
    paddingVertical: 6,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: COLORS.text,
    textAlignVertical: 'center',
  },
  fitnessSmallInput: {
    flex: 1,
    paddingVertical: 6,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    color: COLORS.text,
    textAlignVertical: 'center',
  },
  fitnessUnit: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.muted,
  },
  fitnessUnitSmall: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },
  customMethodRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customMethodInput: {
    flex: 1,
  },
  customMethodButton: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customMethodButtonPressed: {
    backgroundColor: COLORS.primaryPressed,
  },
  customMethodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  valueRowInput: {
    flex: 1,
    height: 56,
    paddingVertical: 0,
  },
  unitSelect: {
    height: 56,
    minWidth: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  unitSelectPressed: {
    opacity: 0.72,
  },
  unitSelectText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  unitCaret: {
    fontSize: 12,
    color: COLORS.muted,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CHIP_GAP,
  },
  chip: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  chipPressed: {
    opacity: 0.72,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    color: COLORS.subText,
  },
  /** 复合输入行（金额 / 重量 / 数值 + 单位）的填色面板 */
  fieldShell: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    // 透明边框占位，聚焦时只换颜色，避免布局抖动
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: FIELD_BACKGROUND,
  },
  fieldShellFocused: {
    backgroundColor: FIELD_BACKGROUND_FOCUSED,
    borderColor: FIELD_FOCUS_RING,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  fieldShellError: {
    borderColor: COLORS.danger,
    backgroundColor: FIELD_ERROR_BACKGROUND,
  },
  valueInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '600',
    color: COLORS.text,
    textAlignVertical: 'center',
  },
  inputSuffix: {
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.muted,
  },
  noteInput: {
    height: 124,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text,
  },
  journalInput: {
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.text,
  },
  counter: {
    marginTop: 6,
    alignSelf: 'flex-end',
    fontSize: 12,
    color: COLORS.faint,
  },
  error: {
    marginTop: 18,
    fontSize: 13,
    color: COLORS.danger,
  },
  saveButton: {
    marginTop: 28,
    height: 50,
    borderRadius: 12,
  },
  saveButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.94 }],
  },
  saveButtonGradient: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2C5FAF',
    shadowOpacity: 0.26,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteButton: {
    marginTop: 14,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1C7C7',
    backgroundColor: '#FFF6F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonPressed: {
    opacity: 0.76,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.danger,
  },

  /* 单位选择弹窗 */
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.38)',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E1E6EF',
    marginBottom: 10,
  },
  sheetTitle: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  sheetOption: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetOptionActive: {
    backgroundColor: '#EAF0FF',
  },
  sheetOptionPressed: {
    opacity: 0.72,
  },
  sheetOptionText: {
    fontSize: 16,
    color: COLORS.subText,
  },
  sheetOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  sheetCheck: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sheetCancel: {
    marginTop: 12,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#F2F4F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.muted,
  },
  iosDatePicker: {
    alignSelf: 'stretch',
    height: 216,
  },
  dateSheetActions: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 10,
  },
  sheetSecondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#F2F4F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.muted,
  },
  sheetPrimaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimaryButtonPressed: {
    backgroundColor: COLORS.primaryPressed,
  },
  sheetPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

