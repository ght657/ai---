'use client';

import { useState } from 'react';

export default function NovelTestPage() {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string>('');
    const [error, setError] = useState<string>('');

    const handleSend = async () => {
        if (!prompt.trim() || loading) return;
        setLoading(true);
        setError('');
        setResult('');

        try {
            const res = await fetch('/api/novel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });

            const data = await res.json();
            if (!res.ok || data.error) {
                setError(data.error || `请求失败：HTTP ${res.status}`);
            } else {
                setResult(data.response || '');
            }
        } catch (e: any) {
            setError(String(e?.message || e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="container mx-auto max-w-3xl px-4 py-6">
            <h1 className="text-2xl font-semibold mb-4">小说生成测试</h1>

            {/* 输入框与发送按钮 */}
            <div className="flex flex-col gap-3 mb-6">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="在此输入提示词（prompt），如：写一篇古风奇幻短篇小说，主角是一位女侠……"
                    className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg"
                />
                <button
                    onClick={handleSend}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-60"
                >
                    {loading ? '生成中...' : '发送'}
                </button>
            </div>

            {/* 返回结果展示 */}
            <div className="border border-gray-200 rounded-lg p-4 min-h-24 whitespace-pre-wrap">
                {error ? (
                    <p className="text-red-600">错误：{error}</p>
                ) : result ? (
                    <p>{result}</p>
                ) : (
                    <p className="text-gray-500">生成结果将显示在这里</p>
                )}
            </div>
        </main>
    );
}