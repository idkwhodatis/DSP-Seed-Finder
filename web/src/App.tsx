import { useEffect } from "react"
import { Outlet } from "react-router-dom"
import { StoreContext, defaultStore } from "./store"
import { useObjectState } from "./hooks/useLiveState"
import { I18nProvider } from "./lingui"
import Header from "./partials/Header"
import styles from "~styles"
export default function App() {
    const [store, setStore] = useObjectState(defaultStore)
    useEffect(() => {
        document.documentElement.classList.toggle(
            "dark",
            store.settings.darkMode,
        )
        document.documentElement.style.colorScheme = store.settings.darkMode
            ? "dark"
            : "light"
    }, [store.settings.darkMode])
    useEffect(() => {
        if (!store.searching) return
        const unload = (ev: BeforeUnloadEvent) => ev.preventDefault()
        window.addEventListener("beforeunload", unload)
        return () => window.removeEventListener("beforeunload", unload)
    }, [store.searching])
    return (
        <StoreContext.Provider value={[store, setStore]}>
            <I18nProvider>
                <div className={styles.app}>
                    <Header />
                    <main className={styles.content}>
                        <Outlet />
                    </main>
                    <div id="portal" />
                </div>
            </I18nProvider>
        </StoreContext.Provider>
    )
}
