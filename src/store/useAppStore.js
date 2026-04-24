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

      // M1 材料选择（四个部位独立选择）
      materials: { frame: null, solar: null, insulation: null, propulsion: null },
      setMaterialPart: (key, val) =>
        set((s) => ({ materials: { ...s.materials, [key]: val } })),

      // M2 任务选择
      mission: null,
      setMission: (m) => set({ mission: m }),

      // M3 历史事件
      clickedHistoryEvents: [],
      damageLevel: 0,
      setClickedHistoryEvents: (events) => set({ clickedHistoryEvents: events }),
      setDamageLevel: (level) => set({ damageLevel: level }),

      // M4 游戏结果
      gameResult: null,
      debrisGenerated: [],
      setGameResult: (r) => set({ gameResult: r }),
      setDebrisGenerated: (d) => set({ debrisGenerated: d }),

      // 故事大纲（Entrance 生成后全程不变，所有模块 AI 调用时传入作为约束）
      storyOutline: null,
      setStoryOutline: (outline) => set({ storyOutline: outline }),

      // 故事章节（AI 生成）
      storyChapters: { opening: '' },
      setStoryChapter: (key, val) =>
        set((s) => ({ storyChapters: { ...s.storyChapters, [key]: val } })),

      // 前后测
      preTest: null,
      postTest: null,
      setPreTest: (t) => set({ preTest: t }),
      setPostTest: (t) => set({ postTest: t }),

      // 模块解锁/完成进度
      currentModule: 'entrance',
      setCurrentModule: (id) => set({ currentModule: id }),

      unlockedModules: ['entrance'],
      completedModules: [],

      unlockModule: (id) =>
        set((s) => ({
          unlockedModules: s.unlockedModules.includes(id)
            ? s.unlockedModules
            : [...s.unlockedModules, id],
        })),

      // completeModule / markModuleComplete 同义
      completeModule: (id) =>
        set((s) => ({
          completedModules: s.completedModules.includes(id)
            ? s.completedModules
            : [...s.completedModules, id],
        })),
      markModuleComplete: (id) =>
        set((s) => ({
          completedModules: s.completedModules.includes(id)
            ? s.completedModules
            : [...s.completedModules, id],
        })),

      // M4 游戏时锁定页面滚动
      scrollLocked: false,
      setScrollLocked: (v) => set({ scrollLocked: v }),

      reset: () => set({
        user: { name: '', city: '', importantEvent: '' },
        satellite: null,
        materials: { frame: null, solar: null, insulation: null, propulsion: null },
        mission: null,
        clickedHistoryEvents: [],
        damageLevel: 0,
        gameResult: null,
        debrisGenerated: [],
        storyOutline: null,
        storyChapters: { opening: '' },
        preTest: null,
        postTest: null,
        currentModule: 'entrance',
        unlockedModules: ['entrance'],
        completedModules: [],
        scrollLocked: false,
      }),
    }),
    { name: 'space-debris-state', version: 2 }
  )
)

export default useAppStore
