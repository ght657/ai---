export interface User {
    id: number;
    username: string;
    password: string;
    create_time: string;
}

export interface WorldCharacter {
    id: number; // 主键，自增
    world_id: number; // 关联世界（复制时为新世界ID）
    name: string;
    background: string;
}

export interface World {
    id: number;
    user_id: number; // 新世界的创建者ID（复制时为当前用户ID）
    name: string; // 复制时继承原世界name，允许后续修改
    tags: string[]; // 复制时继承原世界tags
    is_public: boolean; // 复制时强制设为false
    worldview: string; // 复制时继承
    master_setting: string; // 复制时继承
    origin_world_id: number | null; // 复制时设为原世界ID，原创世界为null
    create_time: string;
    popularity: number; // 复制时继承原世界popularity，后续独立变化
}

export interface Chapter {
    id: number;
    world_id: number; // 关联当前世界（复制后指向新世界）
    creator_user_id: number; // 章节创建者（复制时为当前用户）
    name: string; // 复制时继承原默认章节name
    opening: string; // 复制时继承
    background: string; // 复制时继承
    is_default: boolean; // 复制时继承原章节的is_default（通常为true）
    origin_chapter_id: number | null; // 复制时设为原世界默认章节ID，原创章节为null
    create_time: string;
}

export interface ConversationMessage {
    id: number;
    chapter_id: number;
    user_id: number;
    role: 'user' | 'ai';
    content: string;
    create_time: string;
}

export interface NovelRecord {
    id: number;
    chapter_id: number;
    user_id: number;
    title: string | null;
    content: string;
    create_time: string;
}

export interface UserWorld {
    id: number;
    user_id: number; // 关联用户
    world_id: number; // 关联世界
    role: 'creator' | 'participant' | 'viewer'; // 角色区分
    create_time: string; // 首次关联时间（创建/参与/查看时）
    last_access_time?: string | null; // 可选：后端未返回时为 undefined
}

// 创建世界请求载荷（用于 POST /api/db/worlds）
export interface CreateWorldPayload {
    user_id: number;
    name: string;
    tags: string[] | string; // 可传数组或逗号分隔字符串，后端均兼容
    is_public: boolean;
    worldview: string;
    master_setting: string;
    origin_world_id: number | null;
    popularity: number;
    characters?: { name: string; background: string }[]; // 同时创建角色
}
// 创建章节请求载荷（用于 POST /api/db/chapters）
export interface CreateChapterPayload {
    world_id: number;
    creator_user_id: number;
    name: string;
    opening: string;
    background: string;
    is_default: boolean;
    origin_chapter_id: number | null;
    create_time?: string; // 若不传，后端使用默认时间
}