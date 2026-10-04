import { NavLink } from "react-router-dom"
import { Contrast, Code2, Orbit, Search, Telescope } from "lucide-react"
import styles from "~styles"
import clsx from "clsx"
import { useStore } from "../store"
import { useLingui } from "#lingui"
import { toggleDarkMode, toggleLanguage } from "../localStorage"
export default function Header() {
    const [store, setStore] = useStore()
    const { t } = useLingui()
    return (
        <header className={styles.header}>
            <div className={styles.title}>
                <Orbit size={20} />
                {t`DSP Seed Finder`}
            </div>
            <nav aria-label="Main navigation" className={styles.buttons}>
                {[
                    ["/find-galaxy", t`Galaxy Finder`, Search],
                    ["/galaxy", t`Galaxy Viewer`, Telescope],
                    ["/find-star", t`Star Finder`, Search],
                ].map(([path, label, Icon], i) => {
                    const Glyph = Icon as typeof Search
                    return (
                        <NavLink
                            key={String(path)}
                            to={String(path)}
                            aria-disabled={store.searching}
                            onClick={(e) => {
                                if (store.searching) e.preventDefault()
                            }}
                            className={({ isActive }) =>
                                clsx(
                                    styles.button,
                                    isActive && styles.active,
                                    i === 2 && styles.legacy,
                                )
                            }
                        >
                            <Glyph size={15} />
                            {String(label)}
                        </NavLink>
                    )
                })}
            </nav>
            <div className={styles.icons}>
                <button
                    aria-label="Change language"
                    className={styles.language}
                    onClick={() =>
                        setStore("settings", "language", toggleLanguage)
                    }
                >
                    {store.settings.language === "en" ? "中" : "En"}
                </button>
                <a
                    href="https://github.com/idkwhodatis/DSP-Seed-Finder"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Source code"
                    className={styles.icon}
                >
                    <Code2 size={17} />
                </a>
                <button
                    aria-label="Toggle dark mode"
                    className={styles.icon}
                    onClick={() =>
                        setStore("settings", "darkMode", toggleDarkMode)
                    }
                >
                    <Contrast size={17} />
                </button>
            </div>
        </header>
    )
}
