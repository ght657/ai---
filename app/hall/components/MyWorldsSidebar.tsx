// components/MyWorldsSidebar.tsx
import { World } from '@/app/types/db';

interface MyWorldsSidebarProps {
    myWorlds: World[];
    onSelectWorld: (worldId: number) => void;
}

export default function MyWorldsSidebar({ myWorlds, onSelectWorld }: MyWorldsSidebarProps) {
    return (
        <aside className="w-full max-w-xs shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold">我的世界</h2>
                </div>

                <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                    {myWorlds.length > 0 ? (
                        <ul>
                            {myWorlds.map(world => (
                                <li key={world.id}>
                                    <button
                                        onClick={() => onSelectWorld(world.id)}
                                        className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex flex-col"
                                    >
                                        <div className="flex items-center">
                                            <span>{world.name}</span>
                                            <span className="ml-2 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-1.5 py-0.5 rounded">
                                                {world.is_public ? '公开' : '私有'}
                                            </span>
                                        </div>
                                        <span className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                            创建时间: {world.create_time}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                            暂无世界
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}