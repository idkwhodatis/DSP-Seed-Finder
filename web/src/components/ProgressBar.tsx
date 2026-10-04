import styles from "~styles"
import clsx from "clsx"
export default function ProgressBar(props: {
    className?: string
    total: number
    current: number
}) {
    const total = Math.max(0, props.total)
    const current = Math.max(0, Math.min(total, props.current))
    return (
        <div className={clsx(styles.content, props.className)}>
            <div
                className={styles.progressBar}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={current}
            >
                <div
                    className={styles.inner}
                    style={{
                        width: total ? `${(current * 100) / total}%` : "0%",
                    }}
                />
            </div>
            <div className={styles.text}>
                {current} / {total}
            </div>
        </div>
    )
}
