// components/WorldCard.tsx
import { World } from '@/app/types/db';

export default function WorldCard({ world, onClick }: { world: World; onClick: () => void; }) {
    return (
        <div 
            className="
                bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700
                overflow-hidden cursor-pointer hover:shadow-md transition-shadow
            "
            onClick={onClick}
        >
            <div className="p-4">
                <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-lg">{world.name}</h3>
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {world.is_public ? '公开' : '私有'}
                    </span>
                </div>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    创建者: {world.user_id}
                </p>
                
                <div className="flex flex-wrap gap-1 mt-2">
                    {world.tags.map(tag => (
                        <span 
                            key={tag} 
                            className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-1.5 py-0.5 rounded"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
                
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                    {world.worldview}
                </p>
                
                <div className="mt-3 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <span>热度: {world.popularity}</span>
                    <span>创建于: {world.create_time}</span>
                </div>
            </div>
        </div>
    );
}