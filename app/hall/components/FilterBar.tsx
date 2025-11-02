// components/FilterBar.tsx
import { useState } from 'react';

interface FilterBarProps {
    sortBy: string;
    setSortBy: (sort: string) => void;
    tags: string[];
    selectedTags: string[];
    setSelectedTags: (tags: string[]) => void;
    tagStyle: {
    selected: string;
    unselected: string;
    padding: string;
    borderRadius: string;
    margin: string;
  };
}

export default function FilterBar({
    sortBy,
    setSortBy,
    tags,
    selectedTags,
    setSelectedTags
}: FilterBarProps) {
    const [showAllTags, setShowAllTags] = useState(false);

    return (
        <div className="bg-white py-3 transition-all duration-300 w-full">
            <div className="w-full px-4"> 
                <div className="flex flex-wrap items-center gap-4">
                    {/* 排序筛选 */}
                    <div>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-3 py-1 rounded border border-gray-200 bg-white"
                        >
                            <option value="热度">按热度排序</option>
                            <option value="更新时间">按更新时间排序</option>
                        </select>
                    </div>
                    
                    {/* 标签筛选（支持多选） */}
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                        <span className="text-sm text-gray-700">标签:</span>

                        <div className="flex flex-wrap gap-2 max-w-full">
                            {tags.slice(0, showAllTags ? tags.length : 5).map(tag => {
                                const isSelected = selectedTags.includes(tag);
                                return (
                                    <button
                                    key={tag}
                                    onClick={() =>
                                        setSelectedTags(
                                        isSelected
                                            ? selectedTags.filter(t => t !== tag)
                                            : [...selectedTags, tag]
                                        )
                                    }
                                    className={`px-2 py-1 rounded text-sm border transition-colors duration-200 ${
                                        isSelected
                                        // 选中状态：深色背景+白色文字（强对比）
                                        ? 'border-gray-800 bg-gray-800 text-white hover:bg-gray-700'
                                        // 未选中状态：浅色边框+灰色文字（弱对比）
                                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                                    }`}
                                    >
                                    {tag}
                                    </button>
                                );
                                })}

                            {tags.length > 5 && (
                                <button
                                    onClick={() => setShowAllTags(!showAllTags)}
                                    className="px-2 py-1 text-sm text-blue-500 hover:underline"
                                >
                                    {showAllTags ? '收起' : `+${tags.length - 5}个标签`}
                                </button>
                            )}

                            {selectedTags.length > 0 && (
                                <button
                                    onClick={() => setSelectedTags([])}
                                    className="px-2 py-1 text-sm text-gray-500 hover:text-red-500"
                                >
                                    清除标签筛选
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}