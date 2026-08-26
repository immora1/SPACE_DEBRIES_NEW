import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const initialState = {
  language: 'zh',
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
  aiTimeline: [],
  storyId: null,
  storyVersion: 0,
  storyStatus: null,
  storyCheckpoint: null,
  currentStoryNode: null,
  currentStoryOptions: [],
  currentStoryStage: null,
  storyTimeline: [],
  finalStory: null,
  storyLoading: false,
  storyError: null,
  publicGameState: null,
  storySessionReady: false,
  preTest: null,
  postTest: null,
  currentModule: 'm1',
  unlockedModules: ['m1'],
  completedModules: [],
  scrollLocked: false,
}

const persistKeys = [
  'language',
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
  'storyId',
  'storyVersion',
  'storyStatus',
  'storyCheckpoint',
  'currentStoryNode',
  'currentStoryOptions',
  'currentStoryStage',
  'storyTimeline',
  'finalStory',
  'publicGameState',
  'preTest',
  'postTest',
]

const useAppStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      setLanguage: (language) => set({ language: language === 'en' ? 'en' : 'zh' }),
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
      appendAIOutput: (event) => set((state) => (
        state.aiTimeline.some((item) => item.id === event.id)
          ? state
          : { aiTimeline: [...state.aiTimeline, event] }
      )),
      beginStorySession: () => set({
        aiTimeline: [],
        storyOutline: null,
        storyChapters: { opening: '' },
        storyId: null,
        storyVersion: 0,
        storyStatus: null,
        storyCheckpoint: null,
        currentStoryNode: null,
        currentStoryOptions: [],
        currentStoryStage: null,
        storyTimeline: [],
        finalStory: null,
        storyLoading: false,
        storyError: null,
        publicGameState: null,
        storySessionReady: true,
      }),
      setStoryLoading: (storyLoading) => set({ storyLoading }),
      startStoryRequest: () => set({ storyLoading: true, storyError: null }),
      setStoryError: (storyError) => set({ storyError, storyLoading: false }),
      setStorySnapshot: (story) => set({
        storyId: story.story_id,
        storyVersion: story.version,
        storyStatus: story.status,
        storyCheckpoint: story.current_checkpoint,
        currentStoryNode: story.current_node_id || null,
        currentStoryOptions: story.current_options || [],
        currentStoryStage: story.current_stage,
        storyTimeline: story.timeline || [],
        finalStory: story.final_story_if_completed || null,
        publicGameState: story.public_game_state || null,
        storyLoading: false,
        storyError: null,
        storySessionReady: true,
      }),
      clearStorySession: () => set({
        storyId: null,
        storyVersion: 0,
        storyStatus: null,
        storyCheckpoint: null,
        currentStoryNode: null,
        currentStoryOptions: [],
        currentStoryStage: null,
        storyTimeline: [],
        finalStory: null,
        storyLoading: false,
        storyError: null,
        publicGameState: null,
        storySessionReady: false,
      }),
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
      reset: () => set((state) => ({ ...initialState, language: state.language })),
    }),
    {
      name: 'space-debris-state',
      version: 4,
      migrate: (persistedState) => {
        const migratedState = { ...persistedState }
        delete migratedState.aiTimeline
        return migratedState
      },
      partialize: (state) => Object.fromEntries(persistKeys.map((key) => [key, state[key]])),
    },
  ),
)

export default useAppStore
