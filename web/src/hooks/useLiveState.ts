import { useCallback, useReducer, useRef, useState } from "react"
export function useLiveState<T>(
    initial: T | (() => T),
): [() => T, (value: T | ((old: T) => T)) => T] {
    const [start] = useState(initial)
    const current = useRef(start)
    const [, render] = useReducer((n: number) => n + 1, 0)
    const get = useCallback(() => current.current, [])
    const set = useCallback((value: T | ((old: T) => T)) => {
        const next =
            typeof value === "function"
                ? (value as (old: T) => T)(current.current)
                : value
        if (!Object.is(next, current.current)) {
            current.current = next
            render()
        }
        return next
    }, [])
    return [get, set]
}
type Update<T> = T | ((old: T) => T)
export interface SetObjectState<T> {
    (value: Partial<T> | ((old: T) => Partial<T>)): void
    <K extends keyof T>(key: K, value: Update<T[K]>): void
    <K extends keyof T, L extends keyof T[K]>(
        key: K,
        key2: L,
        value: Update<T[K][L]>,
    ): void
    <K extends keyof T, L extends keyof T[K], M extends keyof T[K][L]>(
        key: K,
        key2: L,
        key3: M,
        value: Update<T[K][L][M]>,
    ): void
}
export function useObjectState<T extends object>(
    initial: T | (() => T),
): [T, SetObjectState<T>] {
    const [get, set] = useLiveState(initial)
    const [proxy] = useState(
        () =>
            new Proxy({} as T, {
                get: (_, key) => Reflect.get(get(), key),
                ownKeys: () => Reflect.ownKeys(get()),
                getOwnPropertyDescriptor: (_, key) => ({
                    ...Object.getOwnPropertyDescriptor(get(), key),
                    configurable: true,
                }),
            }),
    )
    const update = useCallback(
        (...args: any[]) => {
            set((old) => {
                const value = args.pop()
                if (args.length === 0)
                    return {
                        ...old,
                        ...(typeof value === "function" ? value(old) : value),
                    }
                const root: any = { ...old }
                let next = root
                let previous: any = old
                for (const key of args.slice(0, -1)) {
                    next[key] = Array.isArray(previous[key])
                        ? [...previous[key]]
                        : { ...previous[key] }
                    next = next[key]
                    previous = previous[key]
                }
                const key = args.at(-1)
                next[key] =
                    typeof value === "function" ? value(previous[key]) : value
                return root
            })
        },
        [set],
    ) as SetObjectState<T>
    return [proxy, update]
}
