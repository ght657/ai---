'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { World, UserWorld, WorldCharacter} from '../../types/db';
import Navbar from '../components/Navbar';
import FilterBar from '../components/FilterBar';
import MyWorldsSidebar from '../components/MyWorldsSidebar';
import WorldCard from '../components/WorldCard';
import { useRouter } from 'next/navigation';

const tags = ['魔法', '末世', '科幻', '古风', '校园', '武侠', '异能', '历史', '太空'];
const DEFAULT_WORLD_COVER = '/images/default-world-cover.png';

export default function WorldHall() {
  const Router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('热度');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allWorlds, setAllWorlds] = useState<World[]>([]);
  const [allCharacters, setAllCharacters] = useState<WorldCharacter[]>([]); // 角色数据

  const [myWorlds, setMyWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredWorldId, setHoveredWorldId] = useState<number | null>(null);

  const params = useParams<{ userId: string }>();
  const currentUserId = Number(params.userId || '0');

  // 1. 获取所有公开世界
  useEffect(() => {
    const fetchAllWorlds = async () => {
      try {
        const res = await fetch('/api/db/worlds');
        if (!res.ok) throw new Error('获取世界列表失败');
        
        const data = await res.json();
        const worldsWithCovers = data.map((world: World) => ({
          ...world,
          cover_url: world.cover_url || DEFAULT_WORLD_COVER
        }));
        setAllWorlds(worldsWithCovers);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '获取世界数据异常';
        setError(errMsg);
        console.error(errMsg, err);
      }
    };

    fetchAllWorlds();
  }, []);

  // 新增：获取所有角色数据（关键修复，确保有角色数据可传递）
  useEffect(() => {
    const fetchAllCharacters = async () => {
      try {
        const res = await fetch('/api/db/worlds'); // 假设接口返回所有角色
        
        const data: WorldCharacter[] = await res.json();
        setAllCharacters(data);
        console.log("获取人物数据成功", data)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '获取角色数据异常';
        console.error(errMsg, err); // 非致命错误，不阻断页面加载
      }
    };

    fetchAllCharacters();
  }, []);

  // 2. 获取当前用户的世界
  useEffect(() => {
    if (isNaN(currentUserId) || currentUserId === 0) {
      setError('无效的用户ID');
      setLoading(false);
      return;
    }

    const fetchUserWorlds = async () => {
      try {
        const res = await fetch(`/api/db/user-worlds?user_id=${currentUserId}&role=creator`);
        if (!res.ok) throw new Error('获取个人世界失败');
        
        const userWorlds: UserWorld[] = await res.json();
        const userOwnedWorlds = allWorlds.filter(world => 
          userWorlds.some(uw => uw.world_id === world.id)
        ).sort((a, b) => 
          new Date(b.create_time).getTime() - new Date(a.create_time).getTime()
        );
        
        setMyWorlds(userOwnedWorlds);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '获取个人世界异常';
        setError(errMsg);
        console.error(errMsg, err);
      } finally {
        setLoading(false);
      }
    };

    if (allWorlds.length > 0) {
      fetchUserWorlds();
    }
  }, [currentUserId, allWorlds]);

  // 筛选逻辑
  const filteredWorlds = allWorlds
    .filter(world => {
      if (!world.is_public) return false;
      if (selectedTags.length > 0 && !selectedTags.some(tag => world.tags.includes(tag))) return false;
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        return world.name.toLowerCase().includes(lowerQuery) 
          || world.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === '热度') return (b.popularity || 0) - (a.popularity || 0);
      if (sortBy === '更新时间') return new Date(b.create_time).getTime() - new Date(a.create_time).getTime();
      return 0;
    });

  // 进入创作逻辑（修复角色数据传递）
  const startCreation = async (worldId: number, from: 'sidebar' | 'card') => {  
    setError(null);
    setLoading(true);
    
    try {
      // 1. 调用后端接口，获取目标世界的详情（包含角色）
      const res = await fetch(`/api/db/worlds/${worldId}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '获取世界详情失败');
      }
      const targetWorld = await res.json();
      console.log("从后端获取的世界详情：", targetWorld);


      // --------------------------
      // 新增：2. 获取该世界的章节列表（调用指定接口）
      // --------------------------
      let targetChapters: any[] = []; // 存储章节数据，类型可根据实际定义（如Chapter[]）
      const chaptersRes = await fetch(
        `/api/db/worlds/${worldId}/chapters?creator_user_id=${targetWorld.user_id}` // 必传creator_user_id
      );
      if (!chaptersRes.ok) {
        // 章节获取失败不阻断主流程（可根据业务调整是否抛错）
        const chaptersErr = await chaptersRes.json().catch(() => ({}));
        console.warn('获取章节列表失败，将使用空白章节：', chaptersErr.error || '未知错误');
      } else {
        targetChapters = await chaptersRes.json();
        console.log("目标世界ID:", worldId, "后端返回的章节数据:", targetChapters);
      }


      // 3. 提取角色数据（原有逻辑不变）
      const targetCharacters = targetWorld.main_characters || [];
      console.log("目标世界ID:", worldId, "后端返回的角色数据:", targetCharacters);


      // 4. 构造传递给下一页的数据（新增chapters字段）
      const worldData = {
        name: targetWorld.name,
        tags: targetWorld.tags,
        is_public: false,
        worldview: targetWorld.worldview,
        master_setting: targetWorld.master_setting,
        origin_world_id: targetWorld.id,
        popularity: targetWorld.popularity,
        characters: targetCharacters.map((char: any) => ({ // 原有角色字段
          name: char.name, 
          background: char.background 
        })),
        chapters: targetChapters.map((chap: any) => ({ // 新增章节字段（保留需要的字段）
          id: chap.id.toString(), // 下一页ChapterForm的id是string，这里转一下
          name: chap.name,
          opening: chap.opening,
          background: chap.background
        })),
        from: from 
      };


      // 5. 拼接URL参数（新增chapters参数）
      const queryParams = new URLSearchParams();
      // 原有参数...
      queryParams.append('worldName', encodeURIComponent(worldData.name));
      queryParams.append('tags', JSON.stringify(worldData.tags));
      queryParams.append('isPublic', worldData.is_public.toString());
      queryParams.append('worldview', encodeURIComponent(worldData.worldview || ''));
      queryParams.append('masterSetting', encodeURIComponent(worldData.master_setting || ''));
      queryParams.append('originWorldId', worldData.origin_world_id.toString());
      queryParams.append('popularity', worldData.popularity.toString());
      queryParams.append('characters', encodeURIComponent(JSON.stringify(worldData.characters)));
      // 新增：传递章节参数（格式与characters一致）
      queryParams.append('chapters', encodeURIComponent(JSON.stringify(worldData.chapters)));

      queryParams.append('from', from); 
      console.log("已添加from参数到URL：", from); // 验证是否添加成功

      // 6. 跳转（原有逻辑不变）
      const jumpUrl = `/hall/${currentUserId}/world-chapters?${queryParams.toString()}`;
      Router.push(jumpUrl);

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '进入世界创作异常';
      setError(errMsg);
      console.error(errMsg, err);
    } finally {
      setLoading(false);
    }
};

  const createWorld = () => {
    setError(null);
    setLoading(true);

    try{
      Router.push(`/hall/${currentUserId}/world-chapters`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '创建世界异常';
      setError(errMsg);
      console.error(errMsg, err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
        <div className="w-12 h-12 mb-4 text-indigo-600">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 20V10M18 10L12 4M18 10L22 6M8 14H4M8 18H4M8 10H4" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round">
              <animate attributeName="stroke-dasharray" from="0 20" to="20 0" dur="1s" repeatCount="indefinite"/>
            </path>
          </svg>
        </div>
        <p className="text-gray-600 text-lg">正在加载你的创作世界...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
        <div className="w-16 h-16 mb-4 text-red-500">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2"/>
            <path d="M15 9L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M9 9L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="text-red-500 text-lg mb-6">加载失败：{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
        >
          重试加载
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white"> 
      <Navbar
        title="幻境协创"
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        style={{
            backgroundColor: 'rgba(255, 255, 255, 1)',
            backdropFilter: 'saturate(200%) blur(10px)',
            WebkitBackdropFilter: 'saturate(200%) blur(10px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            padding: '0.875rem 2rem',
            position: 'sticky',
            top: 0,
            zIndex: 100,
        }}
        />

      <div className="bg-white py-3 transition-all duration-300 w-full">
        <FilterBar
        sortBy={sortBy}
        setSortBy={setSortBy}
        tags={tags}
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
        tagStyle={{
            selected: 'bg-gray-800 text-white hover:bg-gray-700',
            unselected: 'bg-gray-800 text-white hover:bg-gray-700',
            padding: '0.375rem 0.75rem',
            borderRadius: '0.5rem',
            margin: '0 0.5rem 0.5rem 0'
        }}
    />
    </div>

      <div className="flex flex-1 container mx-auto px-4 py-6 gap-6">
        <MyWorldsSidebar
          myWorlds={myWorlds}
          onSelectWorld={(worldId) => startCreation(worldId, 'sidebar')}
          style={{
            width: '280px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
            padding: '1.5rem',
            flexShrink: 0
            }}
        />

        <main className="flex-1">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">
            公开世界 {filteredWorlds.length > 0 ? `（共 ${filteredWorlds.length} 个）` : ''}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorlds.length > 0 ? (
              filteredWorlds.map(world => (
                <div
                  key={world.id}
                  onMouseEnter={() => setHoveredWorldId(world.id)}
                  onMouseLeave={() => setHoveredWorldId(null)}
                  style={{
                    transform: hoveredWorldId === world.id ? 'translateY(-5px)' : 'translateY(0)',
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                    boxShadow: hoveredWorldId === world.id ? '0 10px 20px rgba(255, 255, 255, 0.15)' : '0 4px 12px rgba(0, 0, 0, 0.05)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    backgroundColor: 'white'
                  }}
                >
                  <WorldCard
                    world={world}
                    onClick={() => startCreation(world.id, 'card')}
                    cardStyle={{
                      padding: '0',
                      borderRadius: '12px'
                    }}
                    textStyle={{
                      title: 'font-semibold text-gray-800 text-lg mb-1',
                      tags: 'text-gray-500 text-sm',
                      info: 'text-gray-400 text-xs mt-2'
                    }}
                  />
                </div>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-sm">
                <div className="w-20 h-20 mb-4 text-gray-300">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-gray-500 text-lg">没有找到符合条件的公开世界</p>
              </div>
            )}
          </div>
        </main>
      </div>

        <div className="py-30 px-4">
            <div className="container mx-auto flex justify-center">
                <button
                onClick={createWorld}
                className="px-10 py-4 rounded-lg border border-gray-800 bg-gray-800 text-white 
                            hover:bg-gray-700 hover:border-gray-700 transition-all duration-300 
                            text-lg font-medium shadow-md hover:shadow-lg transform hover:scale-105"
                >
                立即创作
                </button>
            </div>
        </div>
    </div>
  );
}