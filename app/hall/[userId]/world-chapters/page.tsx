'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CreateWorldPayload, CreateChapterPayload } from '../../../types/db';

// 1. 扩展ChapterForm接口：新增apiId（存储后端返回的真实chapterId）
interface ChapterForm {
  id: string; // 前端临时ID（字符串）
  apiId?: number | null; // 后端真实ID（数字或null）
  name: string;
  opening: string;
  background: string;
  isSubmitted: boolean;
}

// 角色类型定义（与传递的结构匹配）
interface Character {
  world_id: number;
  id: number;
  name: string;
  background: string;
}


export default function WorldChaptersPage() {
  const searchParams = useSearchParams();
  const params = useParams<{ userId: string }>();
  const router = useRouter(); // 用于跳转
  const currentUserId = Number(params.userId || '0');

  // 【修改1：将enterFrom状态移到最顶部，确保先声明后使用】
  const [enterFrom, setEnterFrom] = useState<'sidebar' | 'card' | 'new' | 'unknown'>('unknown');
  // 1. 解析传递的数据结构：传递的章节需补全apiId和isSubmitted
  const [passedWorldData, setPassedWorldData] = useState<{
    name?: string;
    tags?: string[];
    isPublic?: boolean;
    worldview?: string;
    masterSetting?: string;
    originWorldId?: number;
    popularity?: number;
    characters?: { name: string; background: string }[];
    chapters?: Omit<ChapterForm, 'isSubmitted' | 'apiId'> & { apiId?: number }[]; // 兼容传递的apiId
  } | null>(null);

  // 新增：章节创建成功的Toast状态
  const [showChapterToast, setShowChapterToast] = useState(false);
  // 新增：控制“添加新章节”按钮权限
  const [hasCreatedChapters, setHasCreatedChapters] = useState(false);
  // 新增：章节删除加载状态（键=章节前端id，值=是否正在删除，防止重复点击）
  const [chapterDeletingIds, setChapterDeletingIds] = useState<Record<string, boolean>>({});

  // 其他状态（保持不变）
  const [worldLoading, setWorldLoading] = useState(false);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentWorldId, setCurrentWorldId] = useState<number | null>(null);
  // 新增：章节数据加载状态
  const [chapterDataLoading, setChapterDataLoading] = useState(false);


  useEffect(() => {
    try {
      const worldName = searchParams.get('worldName');
      const isPublic = searchParams.get('isPublic');
      const worldview = searchParams.get('worldview');
      const masterSetting = searchParams.get('masterSetting');
      const originWorldId = searchParams.get('originWorldId');
      const popularity = searchParams.get('popularity');
      const tagsStr = searchParams.get('tags');
      const charactersStr = searchParams.get('characters');
      const chaptersStr = searchParams.get('chapters');
      // 1. 新增：从 URL 参数中获取 from（来源标识）
      const from = searchParams.get('from') as 'sidebar' | 'card' | null;
      console.log('URL中的from参数：', from); 

      const parsedData: any = {};
      if (worldName) parsedData.name = decodeURIComponent(worldName);
      if (isPublic) parsedData.isPublic = isPublic === 'true';
      if (worldview) parsedData.worldview = decodeURIComponent(worldview);
      if (masterSetting) parsedData.masterSetting = decodeURIComponent(masterSetting);
      if (originWorldId) parsedData.originWorldId = Number(originWorldId);
      if (popularity) parsedData.popularity = Number(popularity);
      if (tagsStr) parsedData.tags = JSON.parse(decodeURIComponent(tagsStr));
      // 2. 新增：将 from 存储到 parsedData 中
      if (from) parsedData.from = from;

      if (from === 'sidebar' && originWorldId) {
        const worldId = Number(originWorldId);
        if (!isNaN(worldId)) {
          setCurrentWorldId(worldId); // 自动设置世界ID，跳过创建
        }
      }

      // 【此处now使用enterFrom已声明，无报错】
      if (parsedData.from === 'sidebar') {
        setEnterFrom('sidebar'); // 从侧边栏进入
      } else if (parsedData.from === 'card') {
        setEnterFrom('card'); // 从公开卡片进入
      } else if (!originWorldId) {
        setEnterFrom('new'); // 无 originWorldId → 新建世界（直接点“立即创作”）
      } else {
        setEnterFrom('unknown'); // 异常情况
      }

      // 处理角色解析
      if (charactersStr) {
        const decodedCharacters = decodeURIComponent(charactersStr);
        parsedData.characters = JSON.parse(decodedCharacters);
      }

      // 处理章节解析：补全apiId（传递的有则用，无则null）和isSubmitted（默认false）
      if (chaptersStr) {
        const decodedChapters = decodeURIComponent(chaptersStr);
        const rawChapters = JSON.parse(decodedChapters) as Omit<ChapterForm, 'isSubmitted' | 'apiId'> & { apiId?: number }[];
        parsedData.chapters = rawChapters.map(ch => ({
          ...ch,
          apiId: ch.apiId || null, // 传递的apiId或默认null
          isSubmitted: false // 初始未提交
        }));
        console.log('解析得到的章节数据（含apiId）：', parsedData.chapters);
      }


      console.log('解析得到的传递世界数据：', parsedData);
      // 3. 新增：打印解析到的来源，验证是否成功接收
      console.log('解析得到的来源标识（from）：', parsedData.from);
      setPassedWorldData(parsedData);
    } catch (err) {
      console.error('解析传递的世界数据失败：', err);
      setPassedWorldData(null);
    }
  }, [searchParams]);

  // 【新增：from是sidebar时，自动加载章节数据】
  useEffect(() => {
    // 仅在“从侧边栏进入”且“有世界ID”时执行
    if (enterFrom !== 'sidebar' || !currentWorldId) return;

    // 加载章节数据前，设置加载状态
    setChapterDataLoading(true);
    setError(null);

    const fetchSidebarWorldChapters = async () => {
      try {
        // 请求该世界的章节数据（接口需返回该worldId对应的所有章节）
        const res = await fetch(
          `/api/db/worlds/${currentWorldId}/chapters?creator_user_id=${currentUserId}`
        );
        if (!res.ok) throw new Error('加载章节数据失败');

        const chapterData: ChapterForm[] = await res.json();
        console.log('后端返回的章节原始数据：', chapterData); 
        // 处理章节数据（补全isSubmitted为true，因为是已创建的章节）
        const formattedChapters = chapterData.map(ch => ({
          ...ch,
          isSubmitted: true,
          apiId: ch.id || null, // 直接使用后端返回的数字ID，类型匹配`number | null`
          id: ch.id.toString() // 前端ID保持字符串类型
        }));

        // 更新章节状态，显示已有内容
        setChapters(formattedChapters);
        // 同时更新hasCreatedChapters，允许添加新章节
        setHasCreatedChapters(formattedChapters.length > 0);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '加载章节时发生未知错误';
        setError(errMsg);
        console.error(errMsg, err);
      } finally {
        // 结束加载状态
        setChapterDataLoading(false);
      }
  };

  fetchSidebarWorldChapters();
}, [enterFrom, currentWorldId]); // 依赖from和世界ID，变化时重新加载


  // 世界表单状态（保持不变）
  type WorldFormState = Omit<CreateWorldPayload, 'tags' | 'characters'> & {
    tags: string[];
    characters: { name: string; background: string }[];
  };

  const [worldForm, setWorldForm] = useState<WorldFormState>({
    user_id: currentUserId,
    name: passedWorldData?.name || '',
    tags: passedWorldData?.tags || [],
    is_public: passedWorldData?.isPublic || false,
    worldview: passedWorldData?.worldview || '',
    master_setting: passedWorldData?.masterSetting || '',
    origin_world_id: passedWorldData?.originWorldId || null,
    popularity: passedWorldData?.popularity || 0,
    characters: passedWorldData?.characters?.map(char => ({
      name: char.name,
      background: char.background
    })) || []
  });

  useEffect(() => {
    if (passedWorldData) {
      setWorldForm(prev => ({
        ...prev,
        name: passedWorldData.name || '',
        tags: passedWorldData.tags || [],
        is_public: passedWorldData.isPublic || false,
        worldview: passedWorldData.worldview || '',
        master_setting: passedWorldData.masterSetting || '',
        origin_world_id: passedWorldData.originWorldId || null,
        popularity: passedWorldData.popularity || 0,
        characters: passedWorldData.characters?.map(char => ({
          name: char.name,
          background: char.background
        })) || []
      }));
    }
  }, [passedWorldData]);


  // 标签输入状态（完全不变）
  const [tagInput, setTagInput] = useState('');

  // 角色状态管理（完全不变）
  const [characters, setCharacters] = useState<Character[]>(() => {
    if (passedWorldData?.characters?.length) {
      return passedWorldData.characters.map((char, index) => ({
        id: index + 1,
        world_id: passedWorldData.originWorldId || 0,
        name: char.name || '',
        background: char.background || ''
      }));
    }
    return [{ id: 1, world_id: 1, name: '', background: '' }];
  });

  useEffect(() => {
    if (passedWorldData?.characters?.length) {
      const syncedCharacters = passedWorldData.characters.map((char, index) => ({
        id: index + 1,
        world_id: passedWorldData.originWorldId || 0,
        name: char.name || '',
        background: char.background || ''
      }));
      setCharacters(syncedCharacters);
      console.log("获取人物数据成功", syncedCharacters)
    }
  }, [passedWorldData]);

  // 2. 章节表单状态：初始化时apiId设为null
  const [chapters, setChapters] = useState<ChapterForm[]>(() => {
    if (passedWorldData?.chapters?.length) {
      return passedWorldData.chapters as ChapterForm[]; // 传递的章节已含apiId
    }
    // 默认章节：apiId初始null
    return [{
      id: '1',
      apiId: null,
      name: '',
      opening: '',
      background: '',
      isSubmitted: false
    }];
  });

  // 同步传递的章节数据（含apiId）
  useEffect(() => {
    if (passedWorldData?.chapters?.length) {
      setChapters(passedWorldData.chapters as ChapterForm[]);
      console.log('从URL参数加载章节数据（含apiId）：', passedWorldData.chapters);
    }
  }, [passedWorldData?.chapters]);


  // 以下基础方法（世界表单/标签/角色/章节修改）保持不变
  const handleWorldInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const field = target.name as 'name' | 'worldview' | 'master_setting' | 'is_public';
    const isCheckbox = target instanceof HTMLInputElement && target.type === 'checkbox';
    const nextValue = isCheckbox ? (target as HTMLInputElement).checked : target.value;

    setWorldForm(prev => ({
      ...prev,
      [field]: nextValue
    }));
  };

  const handleTagInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (tagInput.trim() && !worldForm.tags.includes(tagInput.trim())) {
      setWorldForm(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setWorldForm(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleCharacterChange = (id: string, field: 'name' | 'background', value: string) => {
    setCharacters(prev =>
      prev.map(char =>
        char.id === parseInt(id) ? { ...char, [field]: value } : char
      )
    );
  };

  const addCharacter = () => {
    const newId = Date.now();
    setCharacters(prev => [...prev, { id: newId, name: '', background: '', world_id: 1 }]);
  };

  const removeCharacter = (id: string) => {
    if (characters.length > 1) {
      setCharacters(prev => prev.filter(char => char.id !== parseInt(id)));
    }
  };

  const handleChapterChange = (id: string, field: 'name' | 'opening' | 'background', value: string) => {
    setChapters(prev =>
      prev.map(chapter =>
        chapter.id === id ? { ...chapter, [field]: value } : chapter
      )
    );
  };

  // 3. 新增章节：apiId初始设为null
  const addChapter = () => {
    const newId = Date.now().toString();
    setChapters(prev => [
      ...prev,
      {
        id: newId,
        apiId: null, // 新章节默认无apiId
        name: '',
        opening: '',
        background: '',
        isSubmitted: false
      }
    ]);
  };

  // 【关键修改1】修改removeChapter：新增后端DELETE请求逻辑（保持不变）
  const removeChapter = async (id: string) => {
    // 1. 根据前端id找到对应章节，获取后端真实apiId
    const chapter = chapters.find(ch => ch.id === id);
    if (!chapter) return;

    // 2. 防止重复点击（正在删除时不执行）
    if (chapterDeletingIds[id]) return;

    // 3. 弹出确认框，避免误删
    const isConfirm = window.confirm(`确定删除章节「${chapter.name || '未命名章节'}」？删除后关联的消息和小说也会同步删除！`);
    if (!isConfirm) return;

    // 4. 标记该章节为“正在删除”
    setChapterDeletingIds(prev => ({ ...prev, [id]: true }));
    setError(null);
    setSuccess(null);

    try {
      // 5. 调用后端DELETE接口（用章节的真实apiId）
      const response = await fetch(`/api/db/chapters/${chapter.apiId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      const deleteData = await response.json();
      if (!response.ok) {
        throw new Error(deleteData.error || '删除章节失败');
      }

      // 6. 接口成功：删除前端章节列表中的该章节
      setChapters(prev => prev.filter(ch => ch.id !== id));
      // 7. 显示成功提示（包含后端返回的关联删除数据）
      setSuccess(`章节删除成功！已同步删除${deleteData.deleted_messages}条消息和${deleteData.deleted_novels}部小说`);
      setShowChapterToast(true);
      setTimeout(() => setShowChapterToast(false), 3000);

    } catch (err) {
      // 8. 接口失败：提示错误，不删除前端章节
      setError(err instanceof Error ? err.message : '删除章节时发生未知错误');
    } finally {
      // 9. 取消“正在删除”标记
      setChapterDeletingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  // 提交世界表单（保持不变）
  const handleCreateWorld = async () => {
    setError(null);
    setSuccess(null);
    setWorldLoading(true);

    if (!worldForm.name.trim()) {
      setError('世界名称不能为空');
      setWorldLoading(false);
      return;
    }

    const payload: CreateWorldPayload = {
      ...worldForm,
      user_id: currentUserId,
      characters: characters.map(char => ({
        name: char.name,
        background: char.background
      }))
    };

    try {
      const worldResponse = await fetch('/api/db/worlds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const worldData = await worldResponse.json();

      if (!worldResponse.ok) {
        throw new Error(worldData.error || '创建世界失败');
      }

      // 用户-世界关联请求（保持不变）
      const worldId = worldData.id;
      const requestData = {
        user_id: currentUserId,
        world_id: worldId,
        role: "creator",
        create_time: new Date().toISOString()
      };

      const userWorldResponse = await fetch('/api/db/user-worlds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!userWorldResponse.ok) {
        const userWorldError = await userWorldResponse.json();
        console.warn('用户与世界关联失败：', userWorldError.error || '关联接口返回未知错误');
      } else {
        const userWorldData = await userWorldResponse.json();
        console.log('用户与世界关联成功：', userWorldData);
      }

      setSuccess('世界创建成功，已自动关联你的参与身份！');
      setCurrentWorldId(worldId);

    } catch (err) {
      setError(err instanceof Error ? err.message : '创建世界或关联身份时发生错误');
    } finally {
      setWorldLoading(false);
    }
  };

  // 4. 提交章节表单：创建章节 + 发送章节消息（保持不变）
  const handleCreateChapters = async () => {
    setError(null);
    setSuccess(null);
    setChapterLoading(true);

    // 筛选未提交且名称不为空的章节
    const unSubmittedChapters = chapters.filter(ch => !ch.isSubmitted && ch.name.trim());
    if (unSubmittedChapters.length === 0) {
      setError('没有新的章节可提交（已提交的章节不会重复创建）');
      setChapterLoading(false);
      return;
    }

    try {
      // 遍历提交未提交的章节，创建章节 + 发送消息
      for (const chapter of unSubmittedChapters) {
        // --------------------------
        // 第一步：创建章节（原有逻辑）
        // --------------------------
        const chapterPayload: CreateChapterPayload = {
          world_id: currentWorldId,
          creator_user_id: currentUserId,
          name: chapter.name,
          opening: chapter.opening,
          background: chapter.background,
          is_default: chapters.indexOf(chapter) === 0,
          origin_chapter_id: null
        };

        const chapterResponse = await fetch('/api/db/chapters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chapterPayload)
        });

        const chapterData = await chapterResponse.json();
        if (!chapterResponse.ok) {
          throw new Error(chapterData.error || `创建章节 "${chapter.name}" 失败`);
        }

        // 拿到章节真实ID（chapterData.id 即接口返回的 chapter_id）
        const realChapterId = chapterData.id;
        console.log(`章节 "${chapter.name}" 创建成功，真实ID：${realChapterId}`);

        // --------------------------
        // 第二步：创建章节成功后，发送章节消息（新增逻辑）
        // --------------------------
        // 1. 构建消息Payload（按接口要求）
        const messagePayload = {
          user_id: currentUserId, // 发送者ID（当前用户）
          role: "user", // 角色（固定为user，按接口示例）
          // 消息内容：结合章节开篇和背景，生成初始请求（可自定义）
          content: `${chapter.opening || '无'}`,
          create_time: new Date().toISOString() // 当前时间（ISO格式）
        };

        // 2. 发送消息请求（URL替换为真实chapter_id）
        const messageResponse = await fetch(`/api/db/chapters/${realChapterId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messagePayload)
        });

        // 3. 处理消息响应（单独捕获错误，不影响章节创建）
        if (messageResponse.ok) {
          const messageData = await messageResponse.json();
          console.log(`章节 "${chapter.name}" 消息发送成功：`, messageData);
        } else {
          const messageError = await messageResponse.json();
          console.warn(`章节 "${chapter.name}" 消息发送失败：`, messageError.error || '未知错误');
        }

        // --------------------------
        // 第三步：更新章节状态（原有逻辑）
        // --------------------------
        setChapters(prev =>
          prev.map(ch =>
            ch.id === chapter.id
              ? { ...ch, apiId: realChapterId, isSubmitted: true } // 存储真实ID
              : ch
          )
        );
      }

      // 所有章节处理完成后的反馈
      setHasCreatedChapters(true);
      setSuccess(`成功创建 ${unSubmittedChapters.length} 个章节，并自动发送初始消息！`);
      setShowChapterToast(true);
      setTimeout(() => setShowChapterToast(false), 3000);
      document.querySelector('.bg-emerald-50')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

    } catch (err) {
      // 捕获章节创建错误（消息错误不进入此处）
      setError(err instanceof Error ? err.message : '创建章节时发生错误');
    } finally {
      setChapterLoading(false);
    }
  };

  // 5. 章节跳转方法：拼接路径（/hall/用户ID/章节ID）（保持不变）
  const goToChapter = (chapterId: number) => {
    if (currentUserId && chapterId) {
      router.push(`/hall/${currentUserId}/${chapterId}`); // 跳转目标路径
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 transition-colors duration-300">
      {/* Toast提示（保持不变） */}
      {showChapterToast && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          {success}
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* 幻境协创标志（保持不变） */}
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            margin: '0',
            letterSpacing: '-0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ transition: 'transform 0.3s ease', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget as SVGElement).style.transform = 'rotate(5deg)'}
              onMouseLeave={(e) => (e.currentTarget as SVGElement).style.transform = 'rotate(0)'}
            >
              <path d="M20 20H4C3.4 20 3 19.6 3 19V5C3 4.4 3.4 4 4 4H18L21 7V19C21 19.6 20.6 20 20 20Z" stroke="url(#titleGradient)" strokeWidth="2"/>
              <path d="M16 2V6" stroke="url(#titleGradient)" strokeWidth="2" strokeLinecap="round"/>
              <path d="M8 11H16" stroke="url(#titleGradient)" strokeWidth="2" strokeLinecap="round"/>
              <path d="M8 15H13" stroke="url(#titleGradient)" strokeWidth="2" strokeLinecap="round"/>
              <defs>
                <linearGradient id="titleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1"/>
                  <stop offset="100%" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
            幻境协创
          </h1>
          <p style={{
            fontSize: '12px',
            color: '#64748b',
            margin: '0 0 0 12px',
            letterSpacing: '0.2px',
            alignSelf: 'flex-end',
            marginBottom: '2px'
          }}>
            和AI一起，把灵感写成小说
          </p>
        </div>

        {/* 页面标题（保持不变） */}
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-8 pb-2 border-b border-gray-200 dark:border-gray-700">
          世界与章节管理
        </h1>

        {/* 提示区域（保持不变） */}
        {error && (
          <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 p-4 rounded-lg mb-6 shadow-sm border border-rose-100 dark:border-rose-800/50 transition-all duration-300">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-lg mb-6 shadow-sm border border-emerald-100 dark:border-emerald-800/50 transition-all duration-300">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <span>{success}</span>
            </div>
          </div>
        )}

        {/* 创建世界板块（保持不变） */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8 transition-all duration-300 hover:shadow-lg">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
            </svg>
            创建新世界
          </h2>

          <div className="space-y-5">
            {/* 创建世界表单内容（保持不变） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">世界名称 *</label>
              <input
                type="text"
                name="name"
                value={worldForm.name}
                onChange={handleWorldInputChange}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all duration-200 outline-none"
                placeholder="输入世界名称（如：魔法大陆）"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">标签</label>
              <form onSubmit={handleTagInput} className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all duration-200 outline-none"
                  placeholder="输入标签后按回车添加（如：魔法、末世）"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-all duration-200 flex items-center gap-1.5 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                  </svg>
                  添加
                </button>
              </form>

              <div className="flex flex-wrap gap-2.5">
                {worldForm.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full text-sm text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50 transition-all duration-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1.5 text-indigo-500 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
                      aria-label={`删除标签 ${tag}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="is_public"
                  checked={worldForm.is_public}
                  onChange={handleWorldInputChange}
                  className="w-4 h-4 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded transition-colors"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">设为公开世界（他人可查看）</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">世界观描述</label>
              <textarea
                name="worldview"
                value={worldForm.worldview}
                onChange={handleWorldInputChange}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all duration-200 outline-none min-h-[120px] resize-none"
                placeholder="描述这个世界的基本设定和背景"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">核心设定</label>
              <textarea
                name="master_setting"
                value={worldForm.master_setting}
                onChange={handleWorldInputChange}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all duration-200 outline-none min-h-[120px] resize-none"
                placeholder="描述这个世界的核心规则和设定"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">主要角色</label>

              {characters.map((char, index) => (
                <div key={char.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3.5 bg-gray-50 dark:bg-gray-800/50 transition-all duration-200 hover:border-indigo-200 dark:hover:border-indigo-700/50">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium text-gray-800 dark:text-white">角色 {index + 1}</h3>
                    <button
                      type="button"
                      onClick={() => removeCharacter(char.id.toString())}
                      disabled={characters.length <= 1}
                      className="text-sm text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label={`删除角色 ${index + 1}`}
                    >
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={char.name}
                      onChange={(e) => handleCharacterChange(char.id.toString(), 'name', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all duration-200 outline-none"
                      placeholder="角色名称"
                    />

                    <textarea
                      value={char.background}
                      onChange={(e) => handleCharacterChange(char.id.toString(), 'background', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all duration-200 outline-none min-h-[90px] resize-none"
                      placeholder="角色背景故事"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addCharacter}
                className="mt-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 flex items-center gap-1.5 text-sm shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                + 添加角色
              </button>
            </div>

            <button
              onClick={handleCreateWorld}
              disabled={worldLoading}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm flex items-center justify-center gap-2"
            >
              {worldLoading ? (
                <>
                  <svg className="w-4.5 h-4.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  创建中...
                </>
              ) : (
                <>
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                </svg>
                  创建世界
                </>
              )}
            </button>
          </div>
        </div>

        {/* 章节管理板块：关键修改2——删除按钮添加enterFrom权限控制 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 transition-all duration-300 hover:shadow-lg">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
            章节管理
          </h2>

          {/* 根据 from 显示不同提示（保持不变） */}
          {enterFrom === 'sidebar' && (
            <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 p-3 rounded-lg mb-4 border border-blue-100 dark:border-blue-800/50">
              <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              欢迎回到你的世界！可继续编辑已有的章节内容
            </div>
          )}
          {enterFrom === 'card' && (
            <div className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 p-3 rounded-lg mb-4 border border-purple-100 dark:border-purple-800/50">
              <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
              </svg>
              你正在编辑公开世界，修改后将同步更新公开内容
            </div>
          )}

          {currentWorldId ? (
            <div className="space-y-5">
              <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700">
                <span className="font-medium text-gray-600 dark:text-gray-300">当前编辑的世界 ID:</span> {currentWorldId}
              </p>

              {/* 章节列表：【关键修改】删除按钮添加enterFrom === 'card' 禁用条件 */}
              {chapters.map((chapter, index) => (
                <div
                  key={chapter.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3.5 bg-gray-50 dark:bg-gray-800/50 transition-all duration-200 hover:border-emerald-200 dark:hover:border-emerald-700/50"
                >
                  {/* 章节标题+状态+删除+跳转按钮 */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-800 dark:text-white">章节 {index + 1}</h3>
                      {/* 章节状态标签 */}
                      {chapter.isSubmitted && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                          已提交（ID: {chapter.apiId}）
                        </span>
                      )}
                      {index === 0 && !chapter.isSubmitted && (
                        <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                          默认章节（未提交）
                        </span>
                      )}
                    </div>

                    {/* 操作按钮组：删除 + 跳转 */}
                    <div className="flex gap-2">
                      {/* 跳转按钮：仅当apiId存在（章节已创建成功）时显示 */}
                      {chapter.apiId && (
                        <button
                          type="button"
                          onClick={() => goToChapter(chapter.apiId)} // 调用跳转方法
                          className="text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          进入章节
                        </button>
                      )}

                      {/* 【关键修改】删除按钮：添加 enterFrom === 'card' 禁用条件 */}
                      <button
                        type="button"
                        onClick={() => removeChapter(chapter.id)}
                        disabled={chapters.length <= 1 || chapterDeletingIds[chapter.id] || enterFrom === 'card'}
                        className={`text-sm text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${chapterDeletingIds[chapter.id] ? 'animate-pulse' : ''}`}
                        aria-label={`删除章节 ${index + 1}`}
                      >
                        {chapterDeletingIds[chapter.id] ? (
                          // 加载中：显示旋转图标
                          <svg className="w-4.5 h-4.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                          </svg>
                        ) : (
                          // 正常状态：显示删除图标
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 章节内容输入（保持不变） */}
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={chapter.name}
                      onChange={(e) => handleChapterChange(chapter.id, 'name', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-emerald-500 dark:focus:border-emerald-400 transition-all duration-200 outline-none"
                      placeholder="章节名称 *（如：第一章：初入魔法森林）"
                    />

                    <textarea
                      value={chapter.opening}
                      onChange={(e) => handleChapterChange(chapter.id, 'opening', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-emerald-500 dark:focus:border-emerald-400 transition-all duration-200 outline-none min-h-[90px] resize-none"
                      placeholder="章节开篇"
                    />

                    <textarea
                      value={chapter.background}
                      onChange={(e) => handleChapterChange(chapter.id, 'background', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-emerald-500 dark:focus:border-emerald-400 transition-all duration-200 outline-none min-h-[90px] resize-none"
                      placeholder="章节背景"
                    />
                  </div>
                </div>
              ))}

              {/* 章节操作按钮（保持不变） */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={addChapter}
                  disabled={!hasCreatedChapters}
                  className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 flex items-center justify-center gap-1.5 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                  </svg>
                  + 添加新章节
                </button>

                <button
                  onClick={handleCreateChapters}
                  disabled={chapterLoading}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-1.5 text-sm shadow-sm"
                >
                  {chapterLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                      </svg>
                      创建中...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      创建章节
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            // 未创建世界提示（保持不变）
            <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 transition-all duration-300">
              <div className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-lg">请先创建一个世界，然后才能添加章节</p>
              <button
                onClick={() => document.querySelector('.bg-indigo-600')?.scrollIntoView({ behavior: 'smooth' })}
                className="mt-4 px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
              >
                去创建世界 →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}