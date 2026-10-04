import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"
import NumberInput from "./NumberInput"
import styles from "~styles"
export default function Pagination(props: {
    current: integer
    total: integer
    onChange: (page: integer) => void
}) {
    const [page, setPage] = useState(props.current)
    useEffect(() => setPage(props.current), [props.current])
    function change(value: number) {
        if (Number.isInteger(value) && value >= 1 && value <= props.total) {
            props.onChange(value)
            setPage(value)
        }
    }
    return (
        <form
            className={styles.pagination}
            onSubmit={(e) => {
                e.preventDefault()
                change(page)
            }}
        >
            <button
                aria-label="Previous page"
                type="button"
                className={styles.paginationButton}
                disabled={props.current <= 1}
                onClick={() => change(props.current - 1)}
            >
                <ChevronLeft size={16} />
            </button>
            Page{" "}
            <NumberInput
                aria-label="Page number"
                className={styles.paginationInput}
                value={page}
                onChange={setPage}
                onBlur={() => change(page)}
                emptyValue={-1}
                error={
                    !Number.isInteger(page) || page <= 0 || page > props.total
                }
            />{" "}
            of {props.total}{" "}
            <button
                aria-label="Next page"
                type="button"
                className={styles.paginationButton}
                disabled={props.current >= props.total}
                onClick={() => change(props.current + 1)}
            >
                <ChevronRight size={16} />
            </button>
        </form>
    )
}
