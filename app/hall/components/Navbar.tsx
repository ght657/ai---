// components/Navbar.tsx
interface NavbarProps {
    title: string;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    style: React.CSSProperties; // 注意：之前漏了接收 style 参数，这里要加上
}

// 关键：接收 style 参数，用于应用外部传入的半透明、模糊等样式
export default function Navbar({ title, searchQuery, setSearchQuery, style }: NavbarProps) {
    return (
        // 1. 应用外部传入的 style，覆盖默认 bg-white，实现高级背景
        <header style={style} className="border-b border-gray-100/50 transition-all duration-300">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                {/* 2. 标题优化：加主题渐变+hover动画，替代纯文本 */}
                <div className="flex items-center gap-2 group">
                    {/* 新增：小说主题小图标，贴合创作场景 */}
                    <svg
                        width="30"
                        height="30"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="text-indigo-600 transition-transform duration-300 group-hover:rotate-3"
                    >
                        <path
                            d="M19 20H5C4.4 20 4 19.6 4 19V5C4 4.4 4.4 4 5 4H12L16 8V19C16 19.6 15.6 20 15 20H12"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </svg>
                    {/* 标题：渐变文字+hover放大，替代原 text-foreground */}
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-300 group-hover:scale-105">
                        {title}
                    </h1>
                </div>
                
                {/* 3. 搜索框优化：增强质感，保留原有功能 */}
                <div className="relative w-full max-w-md mx-4 group">
                    {/* 新增：搜索框背景层，实现毛玻璃内阴影 */}
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-full border border-indigo-100 transition-all duration-300 group-hover:border-indigo-200"></div>
                    {/* 输入框：改为透明背景，叠加在背景层上 */}
                    <input
                        type="text"
                        placeholder="搜索世界名称、标签或创建者..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="relative z-10 w-full px-4 py-2 rounded-full bg-transparent border-none focus:outline-none focus:ring-0 text-gray-700 placeholder-gray-400 transition-all duration-300"
                    />
                    {/* 搜索图标：替换为精致SVG，加hover变色 */}
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 transition-colors duration-300 group-hover:text-indigo-600">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </span>
                </div>

                {/* 4. 新增：用户头像占位，提升完整性（不新增功能，仅优化视觉） */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium cursor-pointer hover:scale-105 transition-transform duration-300">
                        U
                    </div>
                </div>
            </div>
        </header>
    );
}