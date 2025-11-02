'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Chapter, ConversationMessage, NovelRecord } from '../../../types/db';

// 统一配色方案（适配写作场景的柔和专注色调）
const COLORS = {
  primary: '#6366f1', // 主色（与幻境协创标志呼应）
  primaryLight: '#f0f4ff', // 主色浅背景
  primaryHover: '#4f46e5', // 主色hover
  secondary: '#f1f5f9', // 次要背景
  border: '#e2e8f0', // 边框色
  textDark: '#1e293b', // 正文深色
  textMedium: '#64748b', // 正文中色
  textLight: '#94a3b8', // 正文浅色
  error: '#dc2626', // 错误色（柔和红）
  success: '#10b981', // 成功色
  shadow: '0 4px 12px rgba(0, 0, 0, 0.05)', // 基础阴影
  shadowHeavy: '0 6px 16px rgba(0, 0, 0, 0.08)', // 重阴影
};

// 统一工具样式
const STYLES = {
  card: {
    background: 'white',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    boxShadow: COLORS.shadow,
    transition: 'all 0.25s ease',
  },
  button: {
    borderRadius: '6px',
    border: 'none',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '6px',
    fontSize: '14px',
    transition: 'all 0.25s ease',
    outline: 'none',
    backgroundColor: 'white',
    '&:focus': {
      borderColor: COLORS.primary,
      boxShadow: `0 0 0 2px ${COLORS.primaryLight}`,
    },
  },
};

export default function ChapterPage() {
  const params = useParams<{ userId: string; chapterId: string }>();
  const userId = params.userId;
  const chapterId = params.chapterId;

  const [chapter, setChapter] = useState<Partial<Chapter> | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [novels, setNovels] = useState<NovelRecord[]>([]);
  const [worldContext, setWorldContext] = useState<{
    worldview?: string;
    master_sitting?: string;
    main_characters?: any;
  } | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const [selectedNovel, setSelectedNovel] = useState<NovelRecord | null>(null);
  const [isNovelModalOpen, setIsNovelModalOpen] = useState<boolean>(false);

  const [suggestions, setSuggestions] = useState<Array<{ content: string }>>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState<boolean>(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const [tempIdSeq, setTempIdSeq] = useState<number>(-1);
  const [initializedInput, setInitializedInput] = useState<boolean>(false);

  // 原有逻辑保持不变
  const openNovelModal = (novel: NovelRecord) => {
    setSelectedNovel(novel);
    setIsNovelModalOpen(true);
  };

  const closeNovelModal = () => {
    setIsNovelModalOpen(false);
    setSelectedNovel(null);
  };

  const addEmptyInputBubble = () => {
    const tempId = tempIdSeq;
    const placeholder: ConversationMessage = {
      id: tempId,
      chapter_id: Number(chapterId),
      user_id: Number(userId),
      role: 'user',
      content: '',
      create_time: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, placeholder]);
    setEditingId(tempId);
    setEditText('');
    setTempIdSeq((prev) => prev - 1);
  };

  useEffect(() => {
    let cancelled = false;
    const loadChapter = async () => {
      try {
        const res = await fetch(`/api/db/chapters/${chapterId}`);
        if (!res.ok) throw new Error('暂无章节详情接口');
        const data = await res.json();
        if (!cancelled) setChapter(data as Chapter);
      } catch {
        if (!cancelled) {
          setChapter({
            id: Number(chapterId),
            name: `章节 ${chapterId}`,
            background: '（暂未获取到背景信息）',
          });
        }
      }
    };
    loadChapter();
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  useEffect(() => {
    let cancelled = false;
    const loadMessages = async () => {
      try {
        const res = await fetch(`/api/db/chapters/${chapterId}/messages`);
        if (!res.ok) throw new Error('获取消息失败');
        const data = (await res.json()) as ConversationMessage[];
        if (!cancelled) setMessages(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '获取消息异常');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  useEffect(() => {
    if (!loading && !error && !initializedInput) {
      addEmptyInputBubble();
      setInitializedInput(true);
    }
  }, [loading, error, initializedInput]);

  useEffect(() => {
    let cancelled = false;
    const loadNovels = async () => {
      try {
        const res = await fetch(`/api/db/chapters/${chapterId}/novels`);
        if (!res.ok) throw new Error('获取小说失败');
        const data = (await res.json()) as NovelRecord[];
        if (!cancelled) setNovels(data);
      } catch (e) {
        console.error(e);
      }
    };
    loadNovels();
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  const fetchSuggestions = async () => {
    if (editingId == null) return;
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    try {
      const editedMsg = messages.find((m) => m.id === editingId);
      const baseMsgs =
        editedMsg?.role === 'user' ? messages.filter((m) => m.id !== editingId) : messages;

      const recent = baseMsgs.slice(Math.max(0, baseMsgs.length - 30));
      const history = recent.map((m) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content,
      }));

      const res = await fetch(`/api/chat/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          worldview: worldContext?.worldview,
          master_sitting: worldContext?.master_sitting,
          main_characters: worldContext?.main_characters,
          background: chapter?.background,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string' ? data.error : data?.error?.message || '建议接口错误'
        );
      }

      if (Array.isArray(data?.suggestions)) {
        setSuggestions(data.suggestions as Array<{ content: string }>);
      } else if (typeof data?.raw === 'string') {
        setSuggestions([{ content: data.raw }]);
      } else {
        setSuggestions([]);
      }
    } catch (e) {
      setSuggestionsError(e instanceof Error ? e.message : '获取建议异常');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    if (editingId != null) {
      fetchSuggestions();
    }
  }, [editingId]);

  const handleRollback = async (fromId: number) => {
    if (fromId < 0) {
      setMessages((prev) => prev.filter((m) => m.id !== fromId));
      if (editingId === fromId) {
        setEditingId(null);
        setEditText('');
      }
      return;
    }
    try {
      await fetch(`/api/db/chapters/${chapterId}/messages?id=${fromId}`, { method: 'DELETE' });
      const currentIndex = messages.findIndex((m) => m.id === fromId);
      const current = currentIndex >= 0 ? messages[currentIndex] : undefined;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === fromId);
        if (idx === -1) return prev.filter((m) => m.id <= fromId);
        return prev.slice(0, idx + 1);
      });
      setEditingId(fromId);
      setEditText(current?.content ?? '');
    } catch (e) {
      console.error(e);
    }
  };

  const handleCommitEdit = async () => {
    if (editingId == null || saving) return;
    setSaving(true);
    try {
      const userRes = await fetch(`/api/db/chapters/${chapterId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Number(userId),
          role: 'user',
          content: editText,
        }),
      });
      const createdUserMsg = await userRes.json();
      if (!userRes.ok) {
        throw new Error(createdUserMsg?.error || '保存用户消息失败');
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === editingId ? { ...m, ...createdUserMsg } : m))
      );
      setEditingId(null);

      const histRes = await fetch(`/api/db/chapters/${chapterId}/messages`);
      const allMsgs = (await histRes.json()) as ConversationMessage[];
      if (!histRes.ok) {
        throw new Error('获取近30条消息失败');
      }
      const recent = allMsgs.slice(Math.max(0, allMsgs.length - 30));
      const history = recent.map((m) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content,
      }));

      const chatRes = await fetch(`/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          worldview: worldContext?.worldview,
          master_sitting: worldContext?.master_sitting,
          main_characters: worldContext?.main_characters,
          background: chapter?.background,
        }),
      });
      const chatData = await chatRes.json();
      if (!chatRes.ok) {
        const msg =
          typeof chatData?.error === 'string'
            ? chatData.error
            : chatData?.error?.message || '聊天接口调用失败';
        throw new Error(msg);
      }
      const aiContent: string = chatData.response ?? '';

      const aiSaveRes = await fetch(`/api/db/chapters/${chapterId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Number(userId),
          role: 'ai',
          content: aiContent,
        }),
      });
      const createdAiMsg = await aiSaveRes.json();
      if (!aiSaveRes.ok) {
        throw new Error(createdAiMsg?.error || '保存AI消息失败');
      }

      setMessages((prev) => [...prev, createdAiMsg]);
      addEmptyInputBubble();
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交异常');
    } finally {
      setSaving(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitEdit();
    }
  };

  const [generatingStory, setGeneratingStory] = useState<boolean>(false);
  const [generateStoryError, setGenerateStoryError] = useState<string | null>(null);

  const handleGenerateStory = async () => {
    if (generatingStory) return;
    setGeneratingStory(true);
    setGenerateStoryError(null);
    try {
      const msgRes = await fetch(`/api/db/chapters/${chapterId}/messages`);
      const msgs = (await msgRes.json()) as ConversationMessage[];
      if (!msgRes.ok) throw new Error('获取消息失败');
      const prompt = msgs.map((m) => m.content).join('\n');

      const novelRes = await fetch(`/api/novel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          worldview: worldContext?.worldview,
          master_sitting: worldContext?.master_sitting,
          main_characters: worldContext?.main_characters,
          background: chapter?.background,
        }),
      });
      const novelData = await novelRes.json();
      if (!novelRes.ok) {
        const msg =
          typeof novelData?.error === 'string'
            ? novelData.error
            : novelData?.error?.message || '生成故事失败';
        throw new Error(msg);
      }
      const content: string = novelData?.response ?? novelData?.content ?? '';
      if (!content) throw new Error('生成结果为空');

      const title =
        (content.split('\n').find((line) => line.trim().length) || 'AI故事').slice(0, 50);

      const saveRes = await fetch(`/api/db/chapters/${chapterId}/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Number(userId),
          title,
          content,
        }),
      });
      const saved = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saved?.error || '保存故事失败');
      }

      setNovels((prev) => [saved, ...prev]);
    } catch (e) {
      setGenerateStoryError(e instanceof Error ? e.message : '生成故事异常');
    } finally {
      setGeneratingStory(false);
    }
  };

  // 【优化1：故事详情弹窗 - 高级模态框样式】
  const NovelDetailModal = () => {
    if (!isNovelModalOpen || !selectedNovel) return null;

    return (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)', // 毛玻璃效果
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px',
          animation: 'fadeIn 0.3s ease',
        }}
        onClick={closeNovelModal}
      >
        <div 
          style={{
            ...STYLES.card,
            width: '100%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: COLORS.shadowHeavy,
            transform: 'scale(1)',
            animation: 'scaleIn 0.3s ease',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '20px',
            borderBottom: `1px solid ${COLORS.border}`,
            paddingBottom: '12px'
          }}>
            <h2 style={{ 
              margin: 0, 
              fontSize: '22px', 
              color: COLORS.textDark,
              fontWeight: 600
            }}>
              {selectedNovel.title || '未命名故事'}
            </h2>
            <button
              onClick={closeNovelModal}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: COLORS.secondary,
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: COLORS.textMedium,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: COLORS.border,
                  color: COLORS.textDark,
                }
              }}
            >
              &times;
            </button>
          </div>
          
          <div style={{ 
            color: COLORS.textLight, 
            fontSize: '14px', 
            marginBottom: '16px',
            display: 'flex',
            gap: '12px'
          }}>
            <span>创建时间: {new Date(selectedNovel.create_time).toLocaleString()}</span>
            <span>章节ID: {chapterId}</span>
          </div>
          
          <div style={{ 
            whiteSpace: 'pre-wrap', 
            lineHeight: '1.8', 
            color: COLORS.textDark,
            fontSize: '15px',
            padding: '12px',
            background: COLORS.secondary,
            borderRadius: '6px'
          }}>
            {selectedNovel.content}
          </div>
        </div>

        {/* 动画样式 */}
        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleIn {
              from { transform: scale(0.95); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
          `}
        </style>
      </div>
    );
  };

  // 【优化2：侧边栏 - 卡片化+层次阴影】
  const sidebar = useMemo(() => {
    return (
      <aside
        style={{
          width: 340,
          borderLeft: `1px solid ${COLORS.border}`,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          background: 'white',
          height: '100vh',
          boxShadow: 'inset 1px 0 0 rgba(0,0,0,0.05)',
          overflowY: 'auto',
        }}
      >
        {/* 章节简介卡片 */}
        <section style={{ ...STYLES.card, padding: '16px' }}>
          <div style={{ 
            fontWeight: 600, 
            fontSize: '16px', 
            marginBottom: '12px',
            color: COLORS.primary,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4v16m8-8H4" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round"/>
            </svg>
            章节简介
          </div>
          <div style={{ marginBottom: '10px', lineHeight: '1.5' }}>
            <span style={{ color: COLORS.textMedium, display: 'inline-block', width: '60px' }}>名称：</span>
            <span style={{ color: COLORS.textDark }}>{chapter?.name ?? `章节 ${chapterId}`}</span>
          </div>
          <div style={{ lineHeight: '1.5' }}>
            <div style={{ 
              color: COLORS.textMedium, 
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" stroke={COLORS.textMedium} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17.25 3H21v3.75L9.94 17.81l-3.75-3.75L17.25 3z" stroke={COLORS.textMedium} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              背景：
            </div>
            <div style={{ 
              whiteSpace: 'pre-wrap', 
              color: COLORS.textDark,
              padding: '10px',
              background: COLORS.secondary,
              borderRadius: '6px',
              fontSize: '14px'
            }}>
              {chapter?.background ?? '（暂未获取到背景信息）'}
            </div>
          </div>
        </section>

        {/* 故事集卡片 */}
        <section style={{ ...STYLES.card, padding: '16px', flex: '0 0 auto' }}>
          <div style={{ 
            fontWeight: 600, 
            fontSize: '16px', 
            marginBottom: '12px',
            color: COLORS.primary,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 20H4C3.4 20 3 19.6 3 19V5C3 4.4 3.4 4 4 4H18L21 7V19C21 19.6 20.6 20 20 20Z" stroke={COLORS.primary} strokeWidth="2"/>
              <path d="M16 2V6" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round"/>
              <path d="M8 11H16" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round"/>
              <path d="M8 15H13" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round"/>
            </svg>
            故事集
          </div>
          
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px', 
            maxHeight: '260px', 
            overflowY: 'auto',
            paddingRight: '4px',
            '&::-webkit-scrollbar': { width: '4px' },
            '&::-webkit-scrollbar-track': { background: COLORS.secondary },
            '&::-webkit-scrollbar-thumb': { background: COLORS.border, borderRadius: '2px' }
          }}>
            {novels.length === 0 ? (
              <div style={{ 
                color: COLORS.textMedium, 
                textAlign: 'center',
                padding: '20px',
                background: COLORS.secondary,
                borderRadius: '6px'
              }}>
                暂无故事记录
              </div>
            ) : (
              novels.map((n) => (
                <div
                  key={n.id}
                  style={{
                    ...STYLES.card,
                    padding: '12px',
                    cursor: 'pointer',
                    borderColor: COLORS.border,
                    '&:hover': {
                      transform: 'scale(1.02)',
                      borderColor: COLORS.primary,
                      background: COLORS.primaryLight,
                      boxShadow: `0 2px 8px rgba(99, 102, 241, 0.15)`,
                    }
                  }}
                  onClick={() => openNovelModal(n)}
                >
                  <div style={{ 
                    fontWeight: 500, 
                    color: COLORS.textDark,
                    marginBottom: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {n.title || '未命名故事'}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: COLORS.textLight,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke={COLORS.textLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {new Date(n.create_time).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <button
            type="button"
            onClick={handleGenerateStory}
            style={{
              marginTop: '12px',
              ...STYLES.button,
              background: generatingStory ? COLORS.secondary : COLORS.primaryLight,
              color: generatingStory ? COLORS.textLight : COLORS.primary,
              border: `1px solid ${generatingStory ? COLORS.border : COLORS.primary}`,
              '&:hover': {
                background: !generatingStory ? COLORS.primary : COLORS.secondary,
                color: !generatingStory ? 'white' : COLORS.textLight,
              }
            }}
            disabled={generatingStory}
          >
            {generatingStory && (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            )}
            {generatingStory ? '生成中...' : '生成故事'}
          </button>
          
          {generateStoryError && (
            <div style={{ 
              color: COLORS.error, 
              marginTop: '8px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke={COLORS.error} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {generateStoryError}
            </div>
          )}
        </section>
      </aside>
    );
  }, [chapter?.name, chapter?.background, novels, chapterId, generatingStory, generateStoryError]);

  // 【优化3：写作区 - 模拟纸张质感】
  const paper = useMemo(() => {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          padding: '20px',
          background: COLORS.secondary,
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 880,
            maxWidth: '100%',
            height: 'calc(100vh - 40px)',
            ...STYLES.card,
            padding: '32px',
            overflowY: 'auto',
            background: 'white',
            boxShadow: COLORS.shadowHeavy,
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { background: COLORS.secondary },
            '&::-webkit-scrollbar-thumb': { 
              background: COLORS.border, 
              borderRadius: '3px',
              '&:hover': { background: COLORS.textLight }
            }
          }}
        >
          {loading ? (
            <div style={{ 
              color: COLORS.textMedium, 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              gap: '8px'
            }}>
              <svg className="w-5 h-5 animate-spin" fill="none" stroke={COLORS.textMedium} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              加载对话中...
            </div>
          ) : error ? (
            <div style={{ 
              color: COLORS.error, 
              padding: '20px',
              background: '#fee2e2',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke={COLORS.error} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {error}
            </div>
          ) : messages.length === 0 ? (
            <div style={{ 
              color: COLORS.textMedium, 
              textAlign: 'center',
              padding: '40px',
              background: COLORS.secondary,
              borderRadius: '8px',
              margin: '40px 0'
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto 16px' }}>
                <path d="M20 20H4C3.4 20 3 19.6 3 19V5C3 4.4 3.4 4 4 4H18L21 7V19C21 19.6 20.6 20 20 20Z" stroke={COLORS.textLight} strokeWidth="2"/>
                <path d="M16 2V6" stroke={COLORS.textLight} strokeWidth="2" strokeLinecap="round"/>
                <path d="M8 11H16" stroke={COLORS.textLight} strokeWidth="2" strokeLinecap="round"/>
                <path d="M8 15H13" stroke={COLORS.textLight} strokeWidth="2" strokeLinecap="round"/>
              </svg>
              暂无对话记录
              <button
                onClick={addEmptyInputBubble}
                style={{ ...STYLES.button, marginTop: '16px', background: COLORS.primary, color: 'white' }}
              >
                开始创作
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  onMouseEnter={() => setHoveredId(m.id)}
                  onMouseLeave={() => setHoveredId((prev) => (prev === m.id ? null : prev))}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${hoveredId === m.id ? COLORS.primary : 'transparent'}`,
                    background: hoveredId === m.id ? COLORS.primaryLight : 'white',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  {/* 角色头像 */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: m.role === 'ai' ? COLORS.primaryLight : '#fef2f2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 15c1.66 0 3-4.04 3-9s-1.34-9-3-9-3 4.04-3 9 1.34 9 3 9z" stroke={m.role === 'ai' ? COLORS.primary : '#ef4444'} strokeWidth="2"/>
                      <path d="M19 12v7h-2v-7h2z" stroke={m.role === 'ai' ? COLORS.primary : '#ef4444'} strokeWidth="2"/>
                    </svg>
                  </div>

                  {/* 内容区域 */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {/* 角色名称 */}
                    <div style={{ 
                      fontSize: '13px', 
                      color: m.role === 'ai' ? COLORS.primary : '#dc2626',
                      fontWeight: 500
                    }}>
                      {m.role === 'ai' ? 'AI 助手' : '我'}
                    </div>

                    {/* 内容/输入框 */}
                    {editingId === m.id ? (
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        autoFocus
                        style={{
                          ...STYLES.input,
                          padding: '10px 12px',
                          fontSize: '15px',
                          marginTop: '4px'
                        }}
                        placeholder="输入创作内容，按 Enter 提交"
                      />
                    ) : (
                      <div style={{ 
                        whiteSpace: 'pre-wrap', 
                        color: COLORS.textDark,
                        fontSize: '15px',
                        lineHeight: '1.6'
                      }}>
                        {m.content}
                      </div>
                    )}

                    {/* 回溯按钮（hover显示） */}
                    {hoveredId === m.id && editingId !== m.id && (
                      <button
                        type="button"
                        onClick={() => handleRollback(m.id)}
                        style={{
                          alignSelf: 'flex-start',
                          marginTop: '4px',
                          padding: '4px 8px',
                          fontSize: '12px',
                          borderRadius: '4px',
                          border: `1px solid ${COLORS.border}`,
                          background: 'white',
                          color: COLORS.textMedium,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            borderColor: COLORS.primary,
                            color: COLORS.primary,
                            background: COLORS.primaryLight
                          }
                        }}
                        title="回溯到此处（删除之后所有内容）"
                      >
                        回溯
                      </button>
                    )}
                  </div>

                  {/* 提交状态 */}
                  {editingId === m.id && saving && (
                    <div style={{
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: COLORS.textMedium,
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                      </svg>
                      提交中...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }, [messages, hoveredId, loading, error, editingId, editText, saving]);

  // 【优化4：建议面板 - 轻量化+交互反馈】
  const suggestionPanel = useMemo(() => {
    return (
      <aside
        style={{
          width: 300,
          borderLeft: `1px solid ${COLORS.border}`,
          borderRight: `1px solid ${COLORS.border}`,
          background: 'white',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          height: '100vh',
          overflowY: 'auto',
          boxShadow: 'inset 1px 0 0 rgba(0,0,0,0.02), inset -1px 0 0 rgba(0,0,0,0.02)',
          '&::-webkit-scrollbar': { width: '4px' },
          '&::-webkit-scrollbar-track': { background: COLORS.secondary },
          '&::-webkit-scrollbar-thumb': { background: COLORS.border, borderRadius: '2px' }
        }}
      >
        <div style={{ 
          fontWeight: 600, 
          fontSize: '16px', 
          color: COLORS.primary,
          paddingBottom: '8px',
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke={COLORS.primary} strokeWidth="2"/>
          </svg>
          灵感建议
        </div>

        {editingId == null ? (
          <div style={{ 
            color: COLORS.textMedium, 
            padding: '20px',
            background: COLORS.secondary,
            borderRadius: '6px',
            textAlign: 'center',
            fontSize: '14px'
          }}>
            选择输入框开始编辑，自动生成建议
          </div>
        ) : suggestionsLoading ? (
          <div style={{ 
            color: COLORS.textMedium, 
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <svg className="w-4 h-4 animate-spin" fill="none" stroke={COLORS.textMedium} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            生成建议中...
          </div>
        ) : suggestionsError ? (
          <div style={{ 
            color: COLORS.error, 
            padding: '12px',
            background: '#fee2e2',
            borderRadius: '6px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke={COLORS.error} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {suggestionsError}
          </div>
        ) : suggestions.length === 0 ? (
          <div style={{ 
            color: COLORS.textMedium, 
            padding: '20px',
            background: COLORS.secondary,
            borderRadius: '6px',
            textAlign: 'center',
            fontSize: '14px'
          }}>
            暂无匹配的灵感建议
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setEditText(s.content)}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  ...STYLES.card,
                  borderColor: COLORS.border,
                  background: 'white',
                  color: COLORS.textDark,
                  fontSize: '14px',
                  lineHeight: '1.5',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  '&:hover': {
                    borderColor: COLORS.primary,
                    background: COLORS.primaryLight,
                    color: COLORS.primaryHover,
                    transform: 'translateX(2px)'
                  }
                }}
                title={s.content}
              >
                {s.content}
              </button>
            ))}
          </div>
        )}
      </aside>
    );
  }, [editingId, suggestions, suggestionsLoading, suggestionsError]);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'white',
      }}
    >
      {paper}
      {suggestionPanel}
      {sidebar}
      <NovelDetailModal />
    </div>
  );
}