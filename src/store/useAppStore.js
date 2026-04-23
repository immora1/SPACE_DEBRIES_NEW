import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAppStore = create(
  persist(
    (set) => ({
      // 用户信息
      user: { name: '', city: '', importantEvent: '' },
      setUser: (u) => set({ user: u }),

      // 卫星数据
      satellite: null,
      setSatellite: (s) => set({ satellite: s }),

      // M1 材料选择
      material: null,
      setMaterial: (m) => set({ material: m }),

      // 故事章节（AI 生成）
      storyChapters: { opening: '' },
      setStoryChapter: (key, val) =>
        set((s) => ({ storyChapters: { ...s.storyChapters, [key]: val } })),

      // 模块解锁/完成进度
      unlockedModules: ['entrance'],
      completedModules: [],
      unlockModule: (id) =>
        set((s) => ({
          unlockedModules: s.unlockedModules.includes(id)
            ? s.unlockedModules
            : [...s.unlockedModules, id],
        })),
      completeModule: (id) =>
        set((s) => ({
          completedModules: s.completedModules.includes(id)
            ? s.completedModules
            : [...s.completedModules, id],
        })),

      reset: () => set({
        user: { name: '', city: '', importantEvent: '' },
        satellite: null,
        material: null,
        storyChapters: { opening: '' },
        unlockedModules: ['entrance'],
        completedModules: [],
      }),
    }),
    { name: 'space-debris-state', version: 1 }
  )
)

export default useAppStore
