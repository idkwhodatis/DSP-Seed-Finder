import {
    act,
    fireEvent,
    render,
    renderHook,
    screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { useLiveState, useObjectState } from "../hooks/useLiveState"
import NumberInput from "../components/NumberInput"
import Pagination from "../components/Pagination"
import ProgressBar from "../components/ProgressBar"
import Toggle from "../components/Toggle"
import Modal from "../components/Modal"
import Select from "../components/Select"

describe("React state and compact controls", () => {
    it("reads latest state synchronously in retained async callbacks", () => {
        const { result } = renderHook(() => useLiveState(0))
        const [get, set] = result.current
        act(() => {
            set(1)
            expect(get()).toBe(1)
            set((old) => old + 2)
            expect(get()).toBe(3)
        })
        expect(result.current[0]).toBe(get)
        expect(get()).toBe(3)
    })
    it("updates nested store immutably and snapshots safely", () => {
        const initial = {
            settings: { view: { stars: 32 }, dark: false },
            searching: false,
        }
        const { result } = renderHook(() => useObjectState(initial))
        const [state, set] = result.current
        const original = state.settings
        act(() => set("settings", "view", "stars", 64))
        expect(state.settings.view.stars).toBe(64)
        expect(state.settings).not.toBe(original)
        expect(initial.settings.view.stars).toBe(32)
        expect(structuredClone({ ...state })).toEqual({
            settings: { view: { stars: 64 }, dark: false },
            searching: false,
        })
        act(() => set("settings", "dark", (old) => !old))
        expect(state.settings.dark).toBe(true)
        expect(result.current[0]).toBe(state)
    })
    it("keeps an intermediate decimal then follows external value", () => {
        const change = vi.fn()
        const { rerender } = render(
            <NumberInput
                value={1}
                emptyValue={-1}
                onChange={change}
                aria-label="Amount"
            />,
        )
        fireEvent.change(screen.getByLabelText("Amount"), {
            target: { value: "1." },
        })
        expect(change).toHaveBeenLastCalledWith(1)
        expect(screen.getByLabelText("Amount")).toHaveValue("1.")
        rerender(
            <NumberInput
                value={2.5}
                emptyValue={-1}
                onChange={change}
                aria-label="Amount"
            />,
        )
        expect(screen.getByLabelText("Amount")).toHaveValue("2.5")
        fireEvent.change(screen.getByLabelText("Amount"), {
            target: { value: "Infinity" },
        })
        expect(change).toHaveBeenLastCalledWith(-1)
    })
    it("synchronizes pagination and rejects fractional pages", () => {
        const change = vi.fn()
        const { rerender } = render(
            <Pagination current={1} total={5} onChange={change} />,
        )
        fireEvent.change(screen.getByLabelText("Page number"), {
            target: { value: "1.5" },
        })
        fireEvent.blur(screen.getByLabelText("Page number"))
        expect(change).not.toHaveBeenCalled()
        rerender(<Pagination current={3} total={5} onChange={change} />)
        expect(screen.getByLabelText("Page number")).toHaveValue("3")
        fireEvent.click(screen.getByRole("button", { name: "Next page" }))
        expect(change).toHaveBeenCalledWith(4)
    })
    it("clamps empty and overflowing progress", () => {
        const { rerender } = render(<ProgressBar total={0} current={0} />)
        expect(screen.getByRole("progressbar").firstChild).toHaveStyle({
            width: "0%",
        })
        rerender(<ProgressBar total={2} current={3} />)
        expect(screen.getByRole("progressbar")).toHaveAttribute(
            "aria-valuenow",
            "2",
        )
        expect(screen.getByText("2 / 2")).toBeInTheDocument()
        expect(screen.getByRole("progressbar").firstChild).toHaveStyle({
            width: "100%",
        })
    })
    it("supports keyboard switches and disabled state", async () => {
        const user = userEvent.setup(),
            change = vi.fn()
        const { rerender } = render(
            <Toggle value={false} onChange={change} aria-label="Native mode" />,
        )
        screen.getByRole("switch").focus()
        await user.keyboard(" ")
        expect(change).toHaveBeenCalledWith(true)
        rerender(<Toggle value={false} disabled onChange={change} />)
        await user.click(screen.getByRole("switch"))
        expect(change).toHaveBeenCalledTimes(1)
    })
    it("closes dialogs with Escape", async () => {
        const close = vi.fn(),
            user = userEvent.setup()
        render(
            <Modal visible title="Rules" onClose={close}>
                <button>Inside</button>
            </Modal>,
        )
        expect(
            screen.getByRole("dialog", { name: "Rules" }),
        ).toBeInTheDocument()
        await user.keyboard("{Escape}")
        expect(close).toHaveBeenCalledOnce()
    })
    it("selects an option with the keyboard", async () => {
        const user = userEvent.setup(),
            change = vi.fn()
        render(
            <Select
                value={1}
                options={[1, 2]}
                getLabel={(v) => `Choice ${v}`}
                onChange={change}
                aria-label="Choose"
            />,
        )
        screen.getByRole("combobox").focus()
        await user.keyboard("{ArrowDown}")
        expect(screen.getByRole("listbox")).toBeInTheDocument()
        await user.keyboard("{End}{Enter}")
        expect(change).toHaveBeenCalledWith(2)
    })
})
