import { createContext, useContext } from "react"
import type { SetObjectState } from "./hooks/useLiveState"
import { getDefaultParams } from "./util"
import { isInitialDarkMode, getInitialLanguage } from "./localStorage"
export const defaultStore: Store = {
    settings: {
        darkMode: isInitialDarkMode(true),
        language: getInitialLanguage(),
        view: getDefaultParams(),
    },
    searching: false,
}
type ContextType = [Store, SetObjectState<Store>]
export const StoreContext = createContext<ContextType>(
    undefined as unknown as ContextType,
)
export function useStore() {
    return useContext(StoreContext)
}
