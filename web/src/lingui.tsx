import { useEffect, useState, type PropsWithChildren } from "react"
import { i18n } from "@lingui/core"
import {
    I18nProvider as Provider,
    Trans as RuntimeTrans,
    useLingui as useRuntimeLingui,
} from "@lingui/react"
import { useStore } from "./store"
export const Trans =
    RuntimeTrans as unknown as typeof import("@lingui/react/macro").Trans
export const useLingui = useRuntimeLingui as unknown as () => ReturnType<
    typeof import("@lingui/react/macro").useLingui
>
export function I18nProvider({ children }: PropsWithChildren) {
    const [store] = useStore()
    const lang = store.settings.language
    const [ready, setReady] = useState(false)
    const [error, setError] = useState(false)
    useEffect(() => {
        let active = true
        setError(false)
        import(`../i18n/${lang}.po`)
            .then(({ messages }) => {
                if (!active) return
                i18n.load(lang, messages)
                i18n.activate(lang)
                document.documentElement.lang = lang
                setReady(true)
            })
            .catch(() => {
                if (active) setError(true)
            })
        return () => {
            active = false
        }
    }, [lang])
    if (error)
        return <p role="alert">Unable to load language. Please reload.</p>
    return ready ? (
        <Provider i18n={i18n}>{children}</Provider>
    ) : (
        <p role="status">Loading…</p>
    )
}
