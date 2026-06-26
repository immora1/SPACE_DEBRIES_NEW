import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const initialState = {
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
  currentModule: 'm1',
  unlockedModules: ['m1'],
  completedModules: [],
  scrollLocked: false,
}

const persistKeys = [
  'user',
  'satellite',
  'materials',
  'mission',
  'clickedHistoryEvents',
  'damageLevel',
  'gameResult',
  'debrisGenerated',
  'storyOutline',
  'storyChapters',
  'preTest',
  'postTest',
]

const useAppStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      setUser: (user) => set({ user }),
      setSatellite: (satellite) => set({ satellite }),
      setMaterialPart: (key, value) => set((state) => ({
        materials: { ...state.materials, [key]: value },
      })),
      setMission: (mission) => set({ mission }),
      setClickedHistoryEvents: (clickedHistoryEvents) => set({ clickedHistoryEvents }),
      setDamageLevel: (damageLevel) => set({ damageLevel }),
      setGameResult: (gameResult) => set({ gameResult }),
      setDebrisGenerated: (debrisGenerated) => set({ debrisGenerated }),
      setStoryOutline: (storyOutline) => set({ storyOutline }),
      setStoryChapter: (key, value) => set((state) => ({
        storyChapters: { ...state.storyChapters, [key]: value },
      })),
      setPreTest: (preTest) => set({ preTest }),
      setPostTest: (postTest) => set({ postTest }),
      setCurrentModule: (currentModule) => set({ currentModule }),
      setScrollLocked: (scrollLocked) => set({ scrollLocked }),

      unlockModule: (id) => set((state) => ({
        unlockedModules: state.unlockedModules.includes(id)
          ? state.unlockedModules
          : [...state.unlockedModules, id],
      })),
      completeModule: (id) => set((state) => ({
        completedModules: state.completedModules.includes(id)
          ? state.completedModules
          : [...state.completedModules, id],
      })),
      markModuleComplete: (id) => get().completeModule(id),
      reset: () => set(initialState),
    }),
    {
      name: 'space-debris-state',
      version: 2,
      partialize: (state) => Object.fromEntries(persistKeys.map((key) => [key, state[key]])),
    },
  ),
)

export default useAppStore