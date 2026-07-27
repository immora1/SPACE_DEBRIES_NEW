import { useCallback, useMemo } from 'react'
import useAppStore from '../store/useAppStore'
import { createTranslator, localize } from './index'

export default function useI18n() {
  const language = useAppStore((state) => state.language)
  const setLanguage = useAppStore((state) => state.setLanguage)
  const t = useMemo(() => createTranslator(language), [language])
  const pick = useCallback(
    (zhValue, enValue) => localize(language, zhValue, enValue),
    [language],
  )

  return { language, setLanguage, t, pick }
}
