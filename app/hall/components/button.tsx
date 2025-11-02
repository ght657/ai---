import React from 'react';

// 按钮类型枚举：主要按钮(渐变背景)、次要按钮(毛玻璃)、文本按钮(仅文字)
type ButtonVariant = 'primary' | 'secondary' | 'text';

// 按钮尺寸枚举
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  // 按钮文字内容
  children: React.ReactNode;
  // 点击事件回调
  onClick: () => void;
  // 按钮类型
  variant?: ButtonVariant;
  // 按钮尺寸
  size?: ButtonSize;
  // 是否禁用
  disabled?: boolean;
  // 自定义样式
  style?: React.CSSProperties;
  // 图标(可选)，放在文字前
  icon?: React.ReactNode;
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  style,
  icon
}: ButtonProps) {
  // 基础样式：所有按钮共用的过渡效果和禁用状态
  const baseStyles = `
    relative inline-flex items-center justify-center
    rounded-lg transition-all duration-300 font-medium
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
  `;

  // 尺寸样式：不同尺寸的 padding 和文字大小
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2 text-base',
    lg: 'px-8 py-3 text-lg'
  };

  // 变体样式：不同类型按钮的视觉差异
  const variantStyles = {
    // 主要按钮：渐变背景，贴合Navbar标题风格
    primary: `
      bg-gradient-to-r from-indigo-600 to-purple-600 text-white
      hover:from-indigo-700 hover:to-purple-700 hover:scale-105
      active:scale-95 shadow-md hover:shadow-lg
    `,
    // 次要按钮：毛玻璃效果，贴合Navbar搜索框风格
    secondary: `
      bg-white/60 backdrop-blur-sm border border-gray-100 text-gray-800
      hover:border-indigo-200 hover:bg-white/80 hover:scale-105
      active:scale-95
    `,
    // 文本按钮：仅文字，适合辅助操作
    text: `
      text-indigo-600 hover:text-purple-600 hover:scale-105
      active:scale-95 bg-transparent
    `
  };

  // 组合所有样式
  const combinedClasses = `
    ${baseStyles}
    ${sizeStyles[size]}
    ${variantStyles[variant]}
    ${disabled ? 'cursor-not-allowed' : ''}
  `.replace(/\s+/g, ' ').trim();

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={combinedClasses}
      style={style}
    >
      {/* 图标（如果有） */}
      {icon && <span className="mr-2">{icon}</span>}
      {/* 按钮文字 */}
      <span>{children}</span>
    </button>
  );
}

// 常用图标组件（与Navbar风格统一的线性图标）
export const ButtonIcons = {
  // 新建/创作图标
  Create: () => (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  // 搜索图标
  Search: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  // 重置图标
  Reset: () => (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
};
